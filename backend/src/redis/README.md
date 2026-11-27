# Redis Module

**Module Owner:** Purnima
**Technology Stack:** Redis, ioredis

## Purpose & Scope
This directory contains Redis client configuration, distributed locking implementations, and caching utilities.

### Key Responsibilities:
- **Redis Connection Client (`redisClient.ts`):**
  - High-availability Redis client configuration, retry strategy, and health monitoring.
- **Distributed Locking (`distributedLock.ts`):**
  - Mutex locks using `SET resource_key my_random_value NX PX 30000` or Redlock algorithm.
  - Consumed by Bhaskar's billing engine to prevent concurrent double-spending and race conditions.
- **Caching Layer (`cacheService.ts`):**
  - Caching tenant configuration, analytics aggregates, and metadata.
- **Distributed Nonce Store (`redisNonceStore.ts`):**
  - Redis-backed implementation of `INonceStore` for Srabani's RSA replay protection (`SET nonce EX 300 NX`).
