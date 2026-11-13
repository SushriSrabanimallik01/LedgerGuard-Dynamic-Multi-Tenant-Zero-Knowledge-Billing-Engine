import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { JWTPayload, UserRole } from '@shared/types/auth.types';
import { ErrorCode } from '@shared/types/api.types';
import { securityConfig } from './securityConfig';

/**
 * Custom error class for Authentication/JWT failures
 */
export class AuthSecurityError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(message: string, code: ErrorCode, statusCode = 401) {
    super(message);
    this.name = 'AuthSecurityError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AuthSecurityError.prototype);
  }
}

/**
 * Token payload required to issue a new access token
 */
export interface CreateTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

/**
 * Generate a cryptographically signed JWT access token.
 *
 * @param payload - User identity, role, and organization/tenant ID
 * @param customExpiresIn - Optional override for token expiration (e.g., '15m', '1h')
 * @returns Signed JWT string
 */
export function generateAccessToken(
  payload: CreateTokenPayload,
  customExpiresIn?: string | number
): string {
  if (!payload.userId || !payload.organizationId || !payload.email || !payload.role) {
    throw new AuthSecurityError(
      'Cannot generate token: missing required user or tenant claims',
      ErrorCode.AUTH_TOKEN_INVALID,
      400
    );
  }

  const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId
  };

  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: (customExpiresIn ?? securityConfig.jwt.expiresIn) as SignOptions['expiresIn'],
    issuer: securityConfig.jwt.issuer,
    audience: securityConfig.jwt.audience
  };

  return jwt.sign(jwtPayload, securityConfig.jwt.secret, options);
}

/**
 * Generate a refresh token signed with dedicated refresh secret.
 *
 * @param userId - User identifier
 * @param organizationId - Tenant identifier
 * @returns Signed refresh JWT string
 */
export function generateRefreshToken(userId: string, organizationId: string): string {
  if (!userId || !organizationId) {
    throw new AuthSecurityError(
      'Cannot generate refresh token: missing userId or organizationId',
      ErrorCode.AUTH_TOKEN_INVALID,
      400
    );
  }

  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: securityConfig.jwt.refreshExpiresIn as SignOptions['expiresIn'],
    issuer: securityConfig.jwt.issuer,
    audience: securityConfig.jwt.audience
  };

  return jwt.sign({ sub: userId, organizationId }, securityConfig.jwt.refreshSecret, options);
}

/**
 * Verify and decode a JWT access token.
 * Validates cryptographic signature, expiration, issuer, audience, and required claims.
 *
 * @param token - Raw JWT string
 * @returns Verified JWTPayload
 * @throws AuthSecurityError if missing, invalid, expired, or tampered
 */
export function verifyAccessToken(token: string): JWTPayload {
  if (!token || typeof token !== 'string') {
    throw new AuthSecurityError(
      'Authentication token is missing or malformed',
      ErrorCode.AUTH_TOKEN_MISSING,
      401
    );
  }

  const options: VerifyOptions = {
    algorithms: ['HS256'],
    issuer: securityConfig.jwt.issuer,
    audience: securityConfig.jwt.audience
  };

  try {
    const decoded = jwt.verify(token, securityConfig.jwt.secret, options) as JWTPayload;

    // Verify required claims exist in the decoded payload
    if (!decoded.sub || !decoded.organizationId || !decoded.role || !decoded.email) {
      throw new AuthSecurityError(
        'Token payload is missing required security claims',
        ErrorCode.AUTH_TOKEN_INVALID,
        401
      );
    }

    return decoded;
  } catch (err: unknown) {
    if (err instanceof AuthSecurityError) {
      throw err;
    }

    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthSecurityError(
        'Authentication token has expired',
        ErrorCode.AUTH_TOKEN_EXPIRED,
        401
      );
    }

    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthSecurityError(
        `Invalid authentication token: ${err.message}`,
        ErrorCode.AUTH_TOKEN_INVALID,
        401
      );
    }

    throw new AuthSecurityError(
      'Authentication token verification failed',
      ErrorCode.AUTH_TOKEN_INVALID,
      401
    );
  }
}

/**
 * Verify and decode a refresh token.
 *
 * @param token - Raw refresh token string
 * @returns Decoded payload containing sub and organizationId
 */
export function verifyRefreshToken(token: string): { sub: string; organizationId: string } {
  if (!token || typeof token !== 'string') {
    throw new AuthSecurityError(
      'Refresh token is missing or malformed',
      ErrorCode.AUTH_TOKEN_MISSING,
      401
    );
  }

  const options: VerifyOptions = {
    algorithms: ['HS256'],
    issuer: securityConfig.jwt.issuer,
    audience: securityConfig.jwt.audience
  };

  try {
    const decoded = jwt.verify(token, securityConfig.jwt.refreshSecret, options) as {
      sub: string;
      organizationId: string;
    };

    if (!decoded.sub || !decoded.organizationId) {
      throw new AuthSecurityError(
        'Refresh token is missing required claims',
        ErrorCode.AUTH_TOKEN_INVALID,
        401
      );
    }

    return decoded;
  } catch (err: unknown) {
    if (err instanceof AuthSecurityError) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthSecurityError(
        'Refresh token has expired',
        ErrorCode.AUTH_TOKEN_EXPIRED,
        401
      );
    }
    throw new AuthSecurityError(
      'Invalid refresh token',
      ErrorCode.AUTH_TOKEN_INVALID,
      401
    );
  }
}

/**
 * Decode token payload without cryptographic verification.
 * For diagnostic or client inspection only — NEVER use for authorization decisions!
 *
 * @param token - JWT string
 * @returns Decoded payload or null
 */
export function decodeTokenUnverified(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload | null;
  } catch {
    return null;
  }
}
