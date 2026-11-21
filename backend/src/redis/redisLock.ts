
import redisClient from "../config/redis";

export async function acquireLock(
    lockKey: string,
    lockValue: string,
    expirySeconds: number = 30
): Promise<boolean> {
    const result = await redisClient.set(
        lockKey,
        lockValue,
        {
            NX: true,
            EX: expirySeconds
        }
    );

    return result === "OK";
}

export async function releaseLock(
    lockKey: string,
    lockValue: string
): Promise<boolean> {
    const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        else
            return 0
        end
    `;

    const result = await redisClient.eval(script, {
        keys: [lockKey],
        arguments: [lockValue]
    });

    return result === 1;
}
