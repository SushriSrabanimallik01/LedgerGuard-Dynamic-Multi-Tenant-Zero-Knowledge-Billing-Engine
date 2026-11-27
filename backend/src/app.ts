import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import { generalRateLimiter } from './middleware/rateLimiter';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';

const app = express();

/**
 * Configurable Reverse Proxy Trust
 * Controls whether Express trusts X-Forwarded-* headers to determine client IP (req.ip).
 *
 * Strict Parsing Rules:
 * - Unset, empty, 'false', or '0': returns false (safe default).
 * - 'true': returns true (trust all proxies; suitable only in multi-tier reverse proxy networks).
 * - Strict positive integers (e.g. '1', '2'): returns exact numeric hop count.
 *   Rejects partial numbers ('2abc') or floats ('1.5') without silently truncating.
 * - Valid keywords ('loopback', 'linklocal', 'uniquelocal') or IP/CIDR/subnet lists: returns sanitized string.
 * - Malformed input: logs a warning and safely falls back to false.
 *
 * Deployment Assumptions:
 * - When deployed behind a single trusted reverse proxy (Render, AWS ALB, Nginx):
 *   Set TRUST_PROXY=1 in the environment so rate limiters track real client IPs.
 * - When exposed directly (no reverse proxy) or in local development:
 *   Defaults to false to prevent client IP spoofing via forged X-Forwarded-For headers.
 */
export function resolveTrustProxySetting(rawEnvVal: string | undefined = process.env.TRUST_PROXY): boolean | number | string {
  if (rawEnvVal === undefined || rawEnvVal === null) {
    return false;
  }

  const envVal = rawEnvVal.trim();

  // 1. Empty or explicit false
  if (envVal === '' || envVal.toLowerCase() === 'false' || envVal === '0') {
    return false;
  }

  // 2. Explicit true
  if (envVal.toLowerCase() === 'true') {
    return true;
  }

  // 3. Strict positive integer check (digits only, no decimals, no trailing characters)
  if (/^[1-9]\d*$/.test(envVal)) {
    const hops = Number(envVal);
    if (Number.isSafeInteger(hops)) {
      return hops;
    }
  }

  // 4. Built-in proxy-addr keywords
  const lower = envVal.toLowerCase();
  const validKeywords = ['loopback', 'linklocal', 'uniquelocal'];
  if (validKeywords.includes(lower)) {
    return lower;
  }

  // 5. Valid IPv4, IPv6, CIDR, or comma-separated list of IPs/subnets/keywords
  const tokens = envVal.split(',').map((t) => t.trim().toLowerCase());
  const isValidToken = (t: string) => {
    if (validKeywords.includes(t)) return true;
    // IPv4 with optional CIDR mask (e.g., 10.0.0.1 or 10.0.0.0/8)
    if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(t)) {
      const parts = t.split('/')[0].split('.').map(Number);
      return parts.every((p) => p >= 0 && p <= 255);
    }
    // IPv6 with optional CIDR mask
    if (/^[0-9a-f:]+(\/\d{1,3})?$/i.test(t) && t.includes(':')) {
      return true;
    }
    return false;
  };

  if (tokens.length > 0 && tokens.every(isValidToken)) {
    return envVal;
  }

  // 6. Malformed input (e.g. '2abc', '1.5', '-1', '???') -> safe fallback to false
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

// Apply general rate limiting
app.use(generalRateLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    success: true,
    message: 'LedgerGuard API Gateway healthy',
    data: { timestamp: new Date().toISOString() }
  });
});

// Security & Auth Routes (Srabani)
app.use('/api/v1/auth', authRoutes);

// Coordination Note for Bhaskar (Billing Engine):
// Mount billing and ledger routes here:
// app.use('/api/v1/billing', billingRoutes);
// app.use('/api/v1/ledger', ledgerRoutes);

// 404 Not Found Handler
app.use((_req: Request, res: Response<ApiResponseError>) => {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    message: 'Resource not found',
    error: {
      code: 'ROUTE_NOT_FOUND'
    }
  });
});

// Centralized Error Handling Middleware
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: Error, _req: Request, res: Response<ApiResponseError>, _next: NextFunction) => {
    // Never expose stack traces or secrets in response
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
