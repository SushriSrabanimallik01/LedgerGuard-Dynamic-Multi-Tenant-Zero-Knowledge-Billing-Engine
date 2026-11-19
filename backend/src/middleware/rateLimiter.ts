import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';
import { securityConfig } from '../security/securityConfig';

/**
 * Rate Limiting Middleware
 *
 * Current State:
 * - Uses MemoryStore for initial development and single-container environments.
 * - Production Architecture Note: For multi-instance horizontal deployments (Render/AWS),
 *   this will be backed by Purnima's Redis module via `rate-limit-redis`.
 * - Proxy Note: `app.set('trust proxy', 1)` in `app.ts` ensures client IP is correctly
 *   derived from X-Forwarded-For headers when running behind reverse proxies.
 */

/**
 * Standardized rate limit response handler matching team error format
 */
const rateLimitHandler = (_req: Request, res: Response<ApiResponseError>) => {
  res.status(HttpStatus.TOO_MANY_REQUESTS).json({
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED
    }
  });
};

/**
 * General API rate limiter
 * Protects endpoints from high-volume automated abuse.
 */
export const generalRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs, // 15 minutes
  max: securityConfig.rateLimit.maxRequests,     // 100 requests per window
  standardHeaders: true,                        // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,                         // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler
} as Partial<Options>);

/**
 * Strict rate limiter for Authentication endpoints
 * Mitigates brute-force credential stuffing and password guessing attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,     // 15 minutes
  max: securityConfig.rateLimit.authMaxRequests, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
} as Partial<Options>);
