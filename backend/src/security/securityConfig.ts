import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized Security Configuration
 * Following LedgerGuard Security Module Specifications
 */
export const securityConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'ledgerguard_dev_secret_must_be_overridden_in_prod_at_least_32_chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'ledgerguard_dev_refresh_secret_must_be_overridden_in_prod',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'ledgerguard-auth',
    audience: 'ledgerguard-api'
  },
  password: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
  },
  /**
   * RSA Request Verification Configuration
   * Status: Planned specification for Stage 3 (Deferred post-mid-evaluation)
   */
  rsa: {
    algorithm: 'RSA-PSS' as const,
    hashAlgorithm: 'sha256' as const,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    timestampToleranceSeconds: parseInt(process.env.RSA_TIMESTAMP_TOLERANCE_SECONDS || '300', 10),
    keySize: 2048
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10', 10)
  }
};
