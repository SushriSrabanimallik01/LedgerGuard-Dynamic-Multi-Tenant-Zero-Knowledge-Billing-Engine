
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

import {
    connectRedis,
    disconnectRedis
} from "../../backend/src/config/redis";

import {
    setCache,
    getCache,
    deleteCache
} from "../../backend/src/redis/cacheManager";

import {
    acquireLock,
    releaseLock
} from "../../backend/src/redis/redisLock";

// Connect Redis before all tests
beforeAll(async () => {
    await connectRedis();
});

// Disconnect Redis after all tests
afterAll(async () => {
    await disconnectRedis();
});

// Test 1: Store and retrieve cache
test("Redis cache should store and retrieve data", async () => {
    const key = `test:cache:${randomUUID()}`;

    await setCache(key, { name: "LedgerGuard" });

    const result = await getCache<{ name: string }>(key);

    assert.deepEqual(result, { name: "LedgerGuard" });

    await deleteCache(key);
});

// Test 2: Distributed lock
test("Redis lock should prevent duplicate access", async () => {
    const key = `test:lock:${randomUUID()}`;

    const first = await acquireLock(key, "user-1");
    const second = await acquireLock(key, "user-2");

    assert.equal(first, true);
    assert.equal(second, false);

    const released = await releaseLock(key, "user-1");

    assert.equal(released, true);

    const third = await acquireLock(key, "user-2");

    assert.equal(third, true);

    await releaseLock(key, "user-2");
});

// Test 3: Delete cache
test("Redis cache should delete stored data", async () => {
    const key = `test:delete:${randomUUID()}`;

    await setCache(key, { name: "LedgerGuard" });

    await deleteCache(key);

    const result = await getCache(key);

    assert.equal(result, null);
});
