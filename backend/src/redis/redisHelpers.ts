
import redisClient from "../config/redis";

export async function isRedisConnected(): Promise<boolean> {
    return redisClient.isReady;
}

export async function getRedisValue(
    key: string
): Promise<string | null> {
    return await redisClient.get(key);
}

export async function setRedisValue(
    key: string,
    value: string,
    expirySeconds?: number
): Promise<void> {
    if (expirySeconds) {
        await redisClient.set(key, value, {
            EX: expirySeconds
        });
    } else {
        await redisClient.set(key, value);
    }
}

export async function removeRedisValue(
    key: string
): Promise<void> {
    await redisClient.del(key);
}
