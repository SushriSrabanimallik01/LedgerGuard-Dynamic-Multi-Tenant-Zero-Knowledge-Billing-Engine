
import "dotenv/config";
import { createClient } from "redis";

// Create Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

// Handle Redis errors
redisClient.on("error", (error) => {
    console.error("Redis Error:", error);
});

// Connect to Redis
export async function connectRedis(): Promise<void> {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log("Redis connected successfully!");
    }
}

// Disconnect from Redis
export async function disconnectRedis(): Promise<void> {
    if (redisClient.isOpen) {
        await redisClient.quit();
        console.log("Redis disconnected!");
    }
}

export default redisClient;
