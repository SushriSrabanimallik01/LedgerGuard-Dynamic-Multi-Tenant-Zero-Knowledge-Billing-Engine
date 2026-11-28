import rateLimit, { Options, Store, IncrementResponse, MemoryStore } from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';
import { securityConfig } from '../security/securityConfig';
import redisClient from '../config/redis';

/**
 * Atomic Lua script for rate limiting in Redis.
 *
 * Guarantees:
 * 1. Atomicity: Increments the counter and assigns PEXPIRE in a single atomic step.
 * 2. Immortal Key Prevention: If a key is newly created (current == 1) or exists without a TTL (ttl < 0),
 *    PEXPIRE is immediately applied. Keys can NEVER remain without an expiration timestamp.
 * 3. Latency Optimization: Replaces 2-3 network round-trips (INCR, PEXPIRE, PTTL) with a single atomic round-trip.
 */
export const LUA_INCR_EXPIRE = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if current == 1 or ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return { current, ttl }
`.trim();

/**
 * Structural interface matching Purnima's Redis client (from backend/src/config/redis.ts)
 * Allows type safety and dependency injection without hard-coding an uninstalled package import.
 */
export interface IRedisClientLike {
  isOpen?: boolean;
  isReady?: boolean;
  sendCommand?(args: string[]): Promise<unknown>;
  eval?(script: string, ...args: unknown[]): Promise<unknown>;
  get?(key: string): Promise<string | null>;
  set?(key: string, value: string, options?: unknown): Promise<unknown>;
  del?(key: string): Promise<number | unknown>;
  incr?(key: string): Promise<number>;
  decr?(key: string): Promise<number>;
  pExpire?(key: string, milliseconds: number): Promise<number | boolean>;
  pTTL?(key: string): Promise<number>;
}

export interface RedisRateLimitStoreOptions {
  client: IRedisClientLike;
  prefix?: string;
  windowMs?: number;
}

/**
 * Standardized rate limit response handler matching team error format
 */
export const rateLimitHandler = (_req: Request, res: Response<ApiResponseError>): void => {
  res.status(HttpStatus.TOO_MANY_REQUESTS).json({
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED
    }
  });
};

/**
 * Redis-Backed Distributed Rate Limiting Store
 *
 * Architecture & Guarantees:
 * 1. Shared Atomic Counters:
 *    Uses Redis atomic Lua script (`INCR` + `PEXPIRE`) to pool rate limits across
 *    all horizontal backend instances, preventing distributed brute-force attacks.
 * 2. Secure Bounded Fallback (Zero Insecure Pass-Through):
 *    If Redis is disconnected, unavailable, or throws a network timeout, requests
 *    fall back to an internal MemoryStore instance on the current node.
 *    The system NEVER allows unlimited traffic during outages; limits remain strictly
 *    enforced locally on each instance.
 * 3. Log Flooding Mitigation:
 *    Outage warning logs are throttled to at most once per 60 seconds to prevent
 *    uncontrolled logging loops under high concurrent traffic.
 */
export class RedisRateLimitStore implements Store {
  private windowMs: number = 15 * 60 * 1000;
  private readonly fallbackStore = new MemoryStore();
  private readonly client: IRedisClientLike;
  readonly prefix: string;
  readonly localKeys: boolean = false;

  private lastWarningTimestamp: number = 0;
  private static readonly WARNING_THROTTLE_MS = 60_000; // Log warning at most once per 60 seconds

  constructor(options: RedisRateLimitStoreOptions) {
    this.client = options.client;
    this.prefix = options.prefix ?? 'rl:';
    if (options.windowMs) {
      this.windowMs = options.windowMs;
    }
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallbackStore.init(options);
  }

  private logOutageWarning(err: unknown): void {
    const now = Date.now();
    if (now - this.lastWarningTimestamp > RedisRateLimitStore.WARNING_THROTTLE_MS) {
      this.lastWarningTimestamp = now;
      console.warn(
        `[LedgerGuard] Redis rate limiter offline/error: ${(err as Error)?.message ?? 'unknown'}. Falling back to bounded in-memory rate limiting. (Subsequent warnings throttled for 60s)`
      );
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const prefixedKey = `${this.prefix}${key}`;

    if (this.client.isReady || this.client.isOpen) {
      try {
        let totalHits: number | undefined;
        let ttlMs: number | undefined;

        // 1. Try atomic Lua execution via eval (node-redis v4/v6 object format)
        if (typeof this.client.eval === 'function') {
          try {
            const res = await this.client.eval(LUA_INCR_EXPIRE, {
              keys: [prefixedKey],
              arguments: [String(this.windowMs)]
            });
            if (Array.isArray(res) && res.length >= 2) {
              totalHits = Number(res[0]);
              ttlMs = Number(res[1]);
            }
          } catch {
            // Try positional eval: eval(script, numKeys, key, arg)
            const res = await this.client.eval(LUA_INCR_EXPIRE, 1, prefixedKey, String(this.windowMs));
            if (Array.isArray(res) && res.length >= 2) {
              totalHits = Number(res[0]);
              ttlMs = Number(res[1]);
            }
          }
        }

        // 2. Try raw sendCommand(['EVAL', ...])
        if (totalHits === undefined && typeof this.client.sendCommand === 'function') {
          const res = await this.client.sendCommand(['EVAL', LUA_INCR_EXPIRE, '1', prefixedKey, String(this.windowMs)]);
          if (Array.isArray(res) && res.length >= 2) {
            totalHits = Number(res[0]);
            ttlMs = Number(res[1]);
          }
        }

        // 3. Fallback for mock clients that implement incr/pExpire directly without eval
        if (totalHits === undefined && typeof this.client.incr === 'function') {
          totalHits = await this.client.incr(prefixedKey);
          let ttl = typeof this.client.pTTL === 'function' ? await this.client.pTTL(prefixedKey) : -1;
          if (totalHits === 1 || ttl < 0) {
            if (typeof this.client.pExpire === 'function') {
              await this.client.pExpire(prefixedKey, this.windowMs);
            }
            ttl = this.windowMs;
          }
          ttlMs = ttl > 0 ? ttl : this.windowMs;
        }

        if (totalHits !== undefined && ttlMs !== undefined) {
          const resetTime = new Date(Date.now() + (ttlMs > 0 ? ttlMs : this.windowMs));
          return { totalHits, resetTime };
        }

        throw new Error('Redis client lacks eval, sendCommand, or incr implementation');
      } catch (err: unknown) {
        // Fall back to memory store on network/Redis error — NEVER allow unlimited requests!
        this.logOutageWarning(err);
        return this.fallbackStore.increment(key);
      }
    }

    // Graceful fallback to memory store if client is not connected
    return this.fallbackStore.increment(key);
  }

  getClient(): IRedisClientLike {
    return this.client;
  }

  setClient(client: IRedisClientLike): void {
    (this as any).client = client;
  }

  async decrement(key: string): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    if (this.client.isReady || this.client.isOpen) {
      try {
        if (typeof this.client.decr === 'function') {
          await this.client.decr(prefixedKey);
          return;
        } else if (typeof this.client.sendCommand === 'function') {
          await this.client.sendCommand(['DECR', prefixedKey]);
          return;
        }
      } catch {
        // Fall through to memory store
      }
    }
    return this.fallbackStore.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    const prefixedKey = `${this.prefix}${key}`;
    if (this.client.isReady || this.client.isOpen) {
      try {
        if (typeof this.client.del === 'function') {
          await this.client.del(prefixedKey);
        } else if (typeof this.client.sendCommand === 'function') {
          await this.client.sendCommand(['DEL', prefixedKey]);
        }
      } catch {
        // Fall through to memory store
      }
    }
    return this.fallbackStore.resetKey(key);
  }

  async resetAll(): Promise<void> {
    return this.fallbackStore.resetAll?.();
  }

  async shutdown(): Promise<void> {
    if (typeof this.fallbackStore.shutdown === 'function') {
      await this.fallbackStore.shutdown();
    }
  }
}

/**
 * Factory for creating custom or Redis-backed rate limiters
 */
export function createConfiguredLimiter(options: {
  windowMs: number;
  max: number;
  prefix?: string;
  client?: IRedisClientLike;
}) {
  const store = options.client
    ? new RedisRateLimitStore({ client: options.client, prefix: options.prefix, windowMs: options.windowMs })
    : undefined;

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    store
  } as Partial<Options>);
}

/**
 * General API rate limiting store wired to Purnima's Redis client
 */
export const generalRateLimitStore = new RedisRateLimitStore({
  client: redisClient,
  prefix: 'rl:general:',
  windowMs: securityConfig.rateLimit.windowMs
});

/**
 * General API rate limiter (Redis-Backed with Bounded In-Memory Fallback)
 * Protects endpoints from high-volume automated abuse (100 requests per 15 min).
 */
export const generalRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs, // 15 minutes
  max: securityConfig.rateLimit.maxRequests,     // 100 requests per window
  standardHeaders: true,                        // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,                         // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  store: generalRateLimitStore
} as Partial<Options>);

/**
 * Strict authentication rate limiting store wired to Purnima's Redis client
 */
export const authRateLimitStore = new RedisRateLimitStore({
  client: redisClient,
  prefix: 'rl:auth:',
  windowMs: securityConfig.rateLimit.windowMs
});

/**
 * Strict rate limiter for Authentication endpoints (Redis-Backed with Bounded In-Memory Fallback)
 * Mitigates brute-force credential stuffing and password guessing attacks (10 attempts per 15 min).
 */
export const authRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,     // 15 minutes
  max: securityConfig.rateLimit.authMaxRequests, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  store: authRateLimitStore
} as Partial<Options>);
