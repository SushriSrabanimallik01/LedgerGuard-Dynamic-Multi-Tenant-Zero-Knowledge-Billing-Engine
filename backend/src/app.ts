
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import { generalRateLimiter } from './middleware/rateLimiter';
import redisClient from './config/redis';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';

const app = express();

export function resolveTrustProxySetting(
  rawEnvVal: string | undefined = process.env.TRUST_PROXY
): boolean | number | string {
  if (rawEnvVal === undefined || rawEnvVal === null) {
    return false;
  }

  const envVal = rawEnvVal.trim();

  if (envVal === '' || envVal.toLowerCase() === 'false' || envVal === '0') {
    return false;
  }

  if (envVal.toLowerCase() === 'true') {
    return true;
  }

  if (/^[1-9]\d*$/.test(envVal)) {
    const hops = Number(envVal);
    if (Number.isSafeInteger(hops)) {
      return hops;
    }
  }

  const lower = envVal.toLowerCase();
  const validKeywords = ['loopback', 'linklocal', 'uniquelocal'];

  if (validKeywords.includes(lower)) {
    return lower;
  }

  const tokens = envVal.split(',').map((t) => t.trim().toLowerCase());

  const isValidToken = (t: string) => {
    if (validKeywords.includes(t)) return true;

    if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(t)) {
      const parts = t.split('/')[0].split('.').map(Number);
      return parts.every((p) => p >= 0 && p <= 255);
    }

    if (/^[0-9a-f:]+(\/\d{1,3})?$/i.test(t) && t.includes(':')) {
      return true;
    }

    return false;
  };

  if (tokens.length > 0 && tokens.every(isValidToken)) {
    return envVal;
  }

  console.warn(
    `[LedgerGuard] Warning: Invalid or malformed TRUST_PROXY value "${rawEnvVal}". Falling back to safe default: false.`
  );

  return false;
}

app.set('trust proxy', resolveTrustProxySetting());

// Security and parser middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General rate limiting
app.use(generalRateLimiter);

// Liveness check: API process is running
app.get('/health', (_req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    success: true,
    message: 'LedgerGuard API Gateway healthy',
    data: {
      timestamp: new Date().toISOString(),
      service: 'LedgerGuard',
      redis: redisClient.isReady ? 'connected' : 'disconnected'
    }
  });
});

// Readiness check: API and Redis are ready
app.get('/ready', (_req: Request, res: Response) => {
  const redisReady = redisClient.isReady;

  if (!redisReady) {
    return res.status(503).json({
      success: false,
      message: 'LedgerGuard is not ready',
      data: {
        service: 'LedgerGuard',
        redis: 'disconnected'
      }
    });
  }

  return res.status(HttpStatus.OK).json({
    success: true,
    message: 'LedgerGuard is ready',
    data: {
      service: 'LedgerGuard',
      redis: 'connected'
    }
  });
});

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// Billing and ledger routes will be mounted after team integration
// app.use('/api/v1/billing', billingRoutes);
// app.use('/api/v1/ledger', ledgerRoutes);

// 404 handler
app.use((_req: Request, res: Response<ApiResponseError>) => {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    message: 'Resource not found',
    error: {
      code: 'ROUTE_NOT_FOUND'
    }
  });
});

// Centralized error handler
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: Request, res: Response<ApiResponseError>, _next: NextFunction) => {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error occurred',
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR
      }
    });
  }
);

export default app;
