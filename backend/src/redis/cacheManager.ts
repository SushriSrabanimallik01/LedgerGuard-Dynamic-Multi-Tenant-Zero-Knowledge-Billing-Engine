
import redisClient from "../config/redis";

export async function setCache(
    key: string,
    value: unknown,
    expirySeconds: number = 3600
): Promise<void> {
    await redisClient.set(
        key,
        JSON.stringify(value),
        { EX: expirySeconds }
    );
}

export async function getCache<T>(
    key: string
): Promise<T | null> {
    const data = await redisClient.get(key);

    if (data === null) {
        return null;
    }

    return JSON.parse(data) as T;
}

export async function deleteCache(
    key: string
): Promise<void> {
    await redisClient.del(key);
}

export async function clearCache(
    pattern: string
): Promise<void> {
    for await (const key of redisClient.scanIterator({
        MATCH: pattern,
        COUNT: 100
    })) {
        await redisClient.del(key);
    }
}
