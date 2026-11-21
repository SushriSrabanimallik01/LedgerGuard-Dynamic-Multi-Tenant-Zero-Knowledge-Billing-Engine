
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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

before(async () => {
    await connectRedis();
});

after(async () => {
    await disconnectRedis();
});

test("Redis cache should store and retrieve data", async () => {
    const key = `test:cache:${randomUUID()}`;

    await setCache(key, { name: "LedgerGuard" });

    const result = await getCache<{ name: string }>(key);

    assert.deepEqual(result, { name: "LedgerGuard" });

    await deleteCache(key);
});

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
