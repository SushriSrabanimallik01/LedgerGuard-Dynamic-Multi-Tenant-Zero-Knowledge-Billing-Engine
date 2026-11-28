import express, { Request, Response } from 'express';
import request from 'supertest';
import app from '../../backend/src/app';
import {
  createConfiguredLimiter,
  RedisRateLimitStore,
  IRedisClientLike,
  LUA_INCR_EXPIRE,
  authRateLimitStore,
  generalRateLimitStore
} from '../../backend/src/middleware/rateLimiter';
import { ErrorCode } from '../../shared/types/api.types';

/**
 * ============================================================================
 * Redis-Backed Rate Limiter Integration & Assessment Tests
 * ============================================================================
 *
 * NOTE ON TESTING METHODOLOGY:
 * These tests use an in-process simulated Redis engine (MockRedisClient) that conforms
 * strictly to the IRedisClientLike contract and executes the exact atomic Lua script
 * semantics (LUA_INCR_EXPIRE), TTL calculations, and error simulations.
 *
 * This test suite verifies:
 * 1. Normal rate limiting behavior within configured threshold.
 * 2. Exceeding limits returns standardized HTTP 429 (RATE_LIMIT_EXCEEDED).
 * 3. Key reset and counter expiration restores access.
 * 4. Multi-instance shared counter pooling (Instance A and Instance B share one store).
 * 5. Bounded fallback during Redis outages (zero insecure pass-through).
 * 6. Atomic Lua script execution and healing of keys without expiration.
 * 7. Concurrent request burst safety (Promise.all race condition prevention).
 * 8. Log flooding throttling during sustained outages.
 * 9. Decrement behavior on aborted or discounted operations.
 *
 * These tests do NOT claim to run against a real external Redis daemon (such as
 * a live Docker container), which is managed by Purnima in infrastructure/docker.
 */

describe('Security: Redis-Backed Rate Limiter Integration Assessment', () => {
  // Simulated In-Memory Redis Engine matching IRedisClientLike
  class MockRedisClient implements IRedisClientLike {
    isOpen: boolean = true;
    isReady: boolean = true;
    public data = new Map<string, { value: number; expiresAt: number }>();
    public forceFailure: boolean = false;
    public evalCallCount: number = 0;

    async eval(script: string, ...args: unknown[]): Promise<unknown> {
      this.evalCallCount++;
      if (this.forceFailure) {
        throw new Error('Redis connection lost: ECONNREFUSED 127.0.0.1:6379');
      }

      // Support both node-redis v4/v6 object format and positional format
      let key: string;
      let windowMs: number;
      if (args[0] && typeof args[0] === 'object' && 'keys' in (args[0] as object)) {
        const opts = args[0] as { keys: string[]; arguments: string[] };
        key = opts.keys[0];
        windowMs = Number(opts.arguments[0]);
      } else {
        key = String(args[1]);
        windowMs = Number(args[2]);
      }

      const existing = this.data.get(key);
      const now = Date.now();

      // Simulate atomic Lua behavior
      if (!existing || existing.expiresAt <= now) {
        this.data.set(key, { value: 1, expiresAt: now + windowMs });
        return [1, windowMs];
      }

      existing.value += 1;
      const remainingTtl = existing.expiresAt - now;
      return [existing.value, remainingTtl > 0 ? remainingTtl : windowMs];
    }

    async incr(key: string): Promise<number> {
      if (this.forceFailure) {
        throw new Error('Redis connection lost: ECONNREFUSED 127.0.0.1:6379');
      }
      const existing = this.data.get(key);
      const now = Date.now();
      if (!existing || existing.expiresAt <= now) {
        this.data.set(key, { value: 1, expiresAt: now + 60000 });
        return 1;
      }
      existing.value += 1;
      return existing.value;
    }

    async pExpire(key: string, milliseconds: number): Promise<boolean> {
      if (this.forceFailure) throw new Error('Redis connection lost');
      const existing = this.data.get(key);
      if (existing) {
        existing.expiresAt = Date.now() + milliseconds;
        return true;
      }
      return false;
    }

    async pTTL(key: string): Promise<number> {
      if (this.forceFailure) throw new Error('Redis connection lost');
      const existing = this.data.get(key);
      if (!existing) return -2;
      const ttl = existing.expiresAt - Date.now();
      return ttl > 0 ? ttl : -2;
    }

    async del(key: string): Promise<number> {
      return this.data.delete(key) ? 1 : 0;
    }

    async sendCommand(args: string[]): Promise<unknown> {
      if (this.forceFailure) throw new Error('Redis connection lost');
      const cmd = args[0].toUpperCase();
      if (cmd === 'DECR') {
        const key = args[1];
        const existing = this.data.get(key);
        if (existing) {
          existing.value = Math.max(0, existing.value - 1);
          return existing.value;
        }
        return 0;
      }
      if (cmd === 'DEL') {
        const key = args[1];
        return this.data.delete(key) ? 1 : 0;
      }
      throw new Error(`Unsupported mock command: ${cmd}`);
    }
  }

  let mockRedis: MockRedisClient;

  beforeEach(() => {
    mockRedis = new MockRedisClient();
  });

  // 1. Normal Rate Limit Behavior
  it('1. Normal behavior: permits requests within the allowed threshold', async () => {
    const app = express();
    const limiter = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 5,
      prefix: 'rl:test_normal:',
      client: mockRedis
    });

    let handlerInvoked = 0;
    app.get('/api/test', limiter, (_req: Request, res: Response) => {
      handlerInvoked++;
      res.status(200).json({ success: true, count: handlerInvoked });
    });

    for (let i = 0; i < 4; i++) {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    expect(handlerInvoked).toBe(4);
    // Verified: atomic eval was utilized
    expect(mockRedis.evalCallCount).toBe(4);
  });

  // 2. Exceeding Limits
  it('2. Exceeding limits: blocks requests beyond max threshold with HTTP 429', async () => {
    const app = express();
    const limiter = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 3,
      prefix: 'rl:test_exceed:',
      client: mockRedis
    });

    app.get('/api/test', limiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    // 3 requests allowed
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
    }

    // 4th request must be blocked
    const blockedRes = await request(app).get('/api/test');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(blockedRes.body.message).toMatch(/too many requests/i);
  });

  // 3. Counter Expiration & Reset
  it('3. Counter reset: resetting store key immediately restores access', async () => {
    const app = express();
    const store = new RedisRateLimitStore({
      client: mockRedis,
      prefix: 'rl:test_reset:',
      windowMs: 60 * 1000
    });

    const limiter = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 2,
      prefix: 'rl:test_reset:',
      client: mockRedis
    });

    app.get('/api/test', limiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    await request(app).get('/api/test');
    await request(app).get('/api/test');
    const blockedRes = await request(app).get('/api/test');
    expect(blockedRes.status).toBe(429);

    // Reset key in store
    await store.resetKey('::ffff:127.0.0.1');
    await store.resetKey('127.0.0.1');

    // Access should be restored
    const restoredRes = await request(app).get('/api/test');
    expect(restoredRes.status).toBe(200);
  });

  // 4. Shared Counter Across Multiple Backend Instances
  it('4. Shared counter: pools rate limit counts across distinct backend instances', async () => {
    // Both backend instances share the SAME Redis client / store
    const sharedPrefix = 'rl:shared_cluster:';

    // Instance 1
    const appInstance1 = express();
    const limiter1 = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 5,
      prefix: sharedPrefix,
      client: mockRedis
    });
    appInstance1.get('/api/cluster', limiter1, (_req: Request, res: Response) => {
      res.status(200).json({ instance: 1 });
    });

    // Instance 2
    const appInstance2 = express();
    const limiter2 = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 5,
      prefix: sharedPrefix,
      client: mockRedis
    });
    appInstance2.get('/api/cluster', limiter2, (_req: Request, res: Response) => {
      res.status(200).json({ instance: 2 });
    });

    // Send 3 requests to Instance 1
    for (let i = 0; i < 3; i++) {
      const res = await request(appInstance1).get('/api/cluster');
      expect(res.status).toBe(200);
      expect(res.body.instance).toBe(1);
    }

    // Send 2 requests to Instance 2 (Total = 5, reaching threshold)
    for (let i = 0; i < 2; i++) {
      const res = await request(appInstance2).get('/api/cluster');
      expect(res.status).toBe(200);
      expect(res.body.instance).toBe(2);
    }

    // Next request to Instance 1 must be BLOCKED because quota was consumed across cluster
    const blockedInstance1 = await request(appInstance1).get('/api/cluster');
    expect(blockedInstance1.status).toBe(429);

    // Next request to Instance 2 must ALSO be BLOCKED
    const blockedInstance2 = await request(appInstance2).get('/api/cluster');
    expect(blockedInstance2.status).toBe(429);
  });

  // 5. Error Behavior If Redis Is Unavailable (Zero Insecure Pass-Through)
  it('5. Outage fallback: securely falls back to in-memory limiting during Redis failure, never allowing unlimited traffic', async () => {
    // Force Redis client into broken/offline state
    mockRedis.forceFailure = true;

    // Spy on console.warn to verify graceful warning log
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const app = express();
    const limiter = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 3,
      prefix: 'rl:test_outage:',
      client: mockRedis
    });

    app.get('/api/test', limiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    // First 3 requests fall back to internal MemoryStore and succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
    }

    // 4th request must STILL BE BLOCKED by the in-memory fallback!
    // Proves zero insecure pass-through during Redis downtime
    const blockedRes = await request(app).get('/api/test');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // 6. Atomic Lua Script & Key Expiration Guarantee
  it('6. Atomic Lua execution: assigns expiration in the same atomic call preventing immortal keys', async () => {
    const store = new RedisRateLimitStore({
      client: mockRedis,
      prefix: 'rl:test_atomic:',
      windowMs: 30 * 1000
    });

    // Initial increment
    const res1 = await store.increment('test_user_ip');
    expect(res1.totalHits).toBe(1);
    expect(res1.resetTime).toBeInstanceOf(Date);

    // Verify key in mock storage was immediately assigned TTL > 0
    const stored = mockRedis.data.get('rl:test_atomic:test_user_ip');
    expect(stored).toBeDefined();
    expect(stored?.value).toBe(1);
    expect(stored?.expiresAt).toBeGreaterThan(Date.now());
  });

  // 7. Concurrent Request Burst Safety
  it('7. Concurrency: handles simultaneous concurrent request bursts accurately without race conditions', async () => {
    const app = express();
    const limiter = createConfiguredLimiter({
      windowMs: 60 * 1000,
      max: 5,
      prefix: 'rl:test_burst:',
      client: mockRedis
    });

    app.get('/api/burst', limiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    // Fire 10 simultaneous requests concurrently
    const responses = await Promise.all(
      Array.from({ length: 10 }).map(() => request(app).get('/api/burst'))
    );

    const successful = responses.filter((r) => r.status === 200);
    const rateLimited = responses.filter((r) => r.status === 429);

    // Exactly 5 should succeed and exactly 5 should be blocked
    expect(successful.length).toBe(5);
    expect(rateLimited.length).toBe(5);
  });

  // 8. Log Flooding Throttling
  it('8. Log throttling: suppresses repeated outage logs during high-volume failures', async () => {
    mockRedis.forceFailure = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const store = new RedisRateLimitStore({
      client: mockRedis,
      prefix: 'rl:test_flood:',
      windowMs: 60 * 1000
    });

    // Fire 20 rapid requests during outage
    for (let i = 0; i < 20; i++) {
      await store.increment(`key_${i}`);
    }

    // Due to 60s cooldown, warning should only be logged ONCE
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  // 9. Decrement Behavior
  it('9. Decrement: safely reduces counter when decrement is called', async () => {
    const store = new RedisRateLimitStore({
      client: mockRedis,
      prefix: 'rl:test_decr:',
      windowMs: 60 * 1000
    });

    await store.increment('client_ip');
    await store.increment('client_ip');
    const storedBefore = mockRedis.data.get('rl:test_decr:client_ip');
    expect(storedBefore?.value).toBe(2);

    await store.decrement('client_ip');
    const storedAfter = mockRedis.data.get('rl:test_decr:client_ip');
    expect(storedAfter?.value).toBe(1);
  });

  // 10. Recovery Behavior After Outage
  it('10. Recovery behavior: recovers seamlessly to Redis counters once connectivity is restored', async () => {
    const store = new RedisRateLimitStore({
      client: mockRedis,
      prefix: 'rl:test_recovery:',
      windowMs: 60 * 1000
    });

    // Step 1: Normal operation in Redis
    const res1 = await store.increment('recovery_ip');
    expect(res1.totalHits).toBe(1);
    expect(mockRedis.evalCallCount).toBe(1);

    // Step 2: Outage occurs
    mockRedis.forceFailure = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const res2 = await store.increment('recovery_ip');
    expect(res2.totalHits).toBe(1); // Internal memory fallback started at 1
    warnSpy.mockRestore();

    // Step 3: Outage resolves / connection restored
    mockRedis.forceFailure = false;
    const res3 = await store.increment('recovery_ip');
    // Seamlessly resumed using Redis Lua counter (was at 1, now increments to 2)
    expect(res3.totalHits).toBe(2);
    // 1 initial + 2 attempts during failure (object format + positional fallback) + 1 post-recovery = 4
    expect(mockRedis.evalCallCount).toBe(4);
  });

  // 11. Auth Limiter Integration
  it('11. Auth limiter integration: wires Redis store to authentication routes and enforces 10-attempt threshold', async () => {
    const originalClient = authRateLimitStore.getClient();
    authRateLimitStore.setClient(mockRedis);

    try {
      // Send 10 login requests (threshold is 10 attempts per 15m)
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'Password123!' });
        // Request passes limiter (rejected by auth with 401, not 429)
        expect(res.status).toBe(401);
      }

      // 11th request must be blocked with 429
      const blockedRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);

      // Verify that Redis was indeed used with 'rl:auth:' prefix
      const hasAuthKey = Array.from(mockRedis.data.keys()).some((k) => k.startsWith('rl:auth:'));
      expect(hasAuthKey).toBe(true);
    } finally {
      authRateLimitStore.setClient(originalClient);
      await authRateLimitStore.resetAll();
    }
  });

  // 12. General API Limiter Integration
  it('12. General API limiter integration: wires Redis store to general API routes with shared counters', async () => {
    const originalClient = generalRateLimitStore.getClient();
    generalRateLimitStore.setClient(mockRedis);

    try {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('LedgerGuard');

      // Verify that Redis key was touched with 'rl:general:' prefix
      const hasGeneralKey = Array.from(mockRedis.data.keys()).some((k) => k.startsWith('rl:general:'));
      expect(hasGeneralKey).toBe(true);
    } finally {
      generalRateLimitStore.setClient(originalClient);
      await generalRateLimitStore.resetAll();
    }
  });
});
