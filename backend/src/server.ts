
import "dotenv/config";
import app from "./app";
import { connectRedis, disconnectRedis } from "./config/redis";
import { connectDatabase, disconnectDatabase } from "./config/database";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();

    const server = app.listen(PORT, () => {
      console.log(`[LedgerGuard] Server running on port ${PORT}`);
      console.log("[LedgerGuard] MongoDB and Redis connected!");
    });

    const shutdown = async () => {
      console.log("Shutting down server...");

      server.close(async () => {
        try {
          await disconnectRedis();
          await disconnectDatabase();
          process.exit(0);
        } catch (error) {
          console.error("Shutdown error:", error);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("[LedgerGuard] Startup failed:", error);
    await disconnectRedis().catch(() => { });
    await disconnectDatabase().catch(() => { });
    process.exit(1);
  }
}

startServer();

export default startServer;
