
import "dotenv/config";
import { createServer } from "node:http";
import {
    connectRedis,
    disconnectRedis
} from "./config/redis";

const PORT = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
    try {
        await connectRedis();

        const server = createServer(async (req, res) => {
            if (req.url === "/health" && req.method === "GET") {
                res.writeHead(200, {
                    "Content-Type": "application/json"
                });

                res.end(JSON.stringify({
                    status: "healthy",
                    service: "LedgerGuard",
                    redis: "connected"
                }));

                return;
            }

            res.writeHead(404, {
                "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
                error: "Route not found"
            }));
        });

        server.listen(PORT, () => {
            console.log(`LedgerGuard server running on port ${PORT}`);
        });

        const shutdown = () => {
            server.close(async () => {
                await disconnectRedis();
                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

    } catch (error) {
        console.error("Server startup failed:", error);
        await disconnectRedis();
        process.exit(1);
    }
}

startServer();
