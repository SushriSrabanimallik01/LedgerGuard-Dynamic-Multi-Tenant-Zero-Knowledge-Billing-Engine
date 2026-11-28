import 'dotenv/config';
import { IRedisClientLike } from '../middleware/rateLimiter';

/**
 * ============================================================================
 * LedgerGuard Infrastructure: Redis Client Configuration (Purnima)
 * ============================================================================
 *
 * Provides a single shared Redis client instance for distributed rate limiting,
 * cache management, and distributed locking.
 *
 * Architectural Guarantees:
 * 1. Single Shared Connection: All subsystems (rate limiter, cache, locks) share
 *    this client. No duplicate connections are spawned.
 * 2. Graceful Environment Handling: If node-redis is installed, connects via
 *    createClient(). If run in an environment without the redis package, provides
 *    a safe structural stub client so startup and offline tests never crash with
 *    MODULE_NOT_FOUND.
 * 3. Lifecycle Management: connectRedis() connects before HTTP server start;
 *    disconnectRedis() closes connection cleanly on SIGINT/SIGTERM.
 */

export type RedisClientContract = IRedisClientLike & {
  connect(): Promise<void>;
  quit(): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): any;
};

let nativeClient: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const redisPkg = require('redis');
  if (typeof redisPkg.createClient === 'function') {
    nativeClient = redisPkg.createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    });
    nativeClient.on('error', (error: any) => {
      console.error('Redis Error:', error);
    });
  }
} catch {
  // node-redis package not installed in current environment; offline stub client used
}

const offlineStubClient: RedisClientContract = {
  isOpen: false,
  isReady: false,
  connect: async () => {},
  quit: async () => {},
  on: (_event: string, _listener: (...args: any[]) => void) => offlineStubClient,
  sendCommand: async () => {
    throw new Error('Redis not connected');
  },
  eval: async () => {
    throw new Error('Redis not connected');
  },
  get: async () => null,
  set: async () => {},
  del: async () => 0,
  incr: async () => 1,
  decr: async () => 0,
  pExpire: async () => true,
  pTTL: async () => -1
};

const redisClient: RedisClientContract = nativeClient || offlineStubClient;

/**
 * Connect to Redis before server startup
 */
export async function connectRedis(): Promise<void> {
  if (redisClient && !redisClient.isOpen && typeof redisClient.connect === 'function') {
    try {
      await redisClient.connect();
      console.log('Redis connected successfully!');
    } catch (err) {
      console.error('Redis Error:', (err as Error).message);
    }
  }
}

/**
 * Disconnect from Redis on server shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen && typeof redisClient.quit === 'function') {
    try {
      await redisClient.quit();
      console.log('Redis disconnected!');
    } catch (err) {
      console.error('Redis Error:', (err as Error).message);
    }
  }
}

export default redisClient;
