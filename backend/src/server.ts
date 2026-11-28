import app from './app';
import dotenv from 'dotenv';
import { connectRedis, disconnectRedis } from './config/redis';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to Redis prior to HTTP server startup
connectRedis().catch((err) => {
  console.warn('[LedgerGuard] Redis connection not established at startup:', (err as Error).message);
});

const server = app.listen(PORT, () => {
  console.log(`[LedgerGuard] API Gateway server listening on port ${PORT}`);
  console.log(`[LedgerGuard] Environment: ${process.env.NODE_ENV || 'development'}`);
});

const shutdown = async () => {
  server.close(async () => {
    await disconnectRedis();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
