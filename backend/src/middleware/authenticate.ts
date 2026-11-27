import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthSecurityError } from '../security/jwt';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';
import { AuthenticatedUser } from '@shared/types/auth.types';

/**
 * Authentication Middleware
 * Validates the Authorization Bearer JWT token on incoming requests.
 *
 * If valid:
 * - Attaches typed `req.user` with user id, email, role, and organizationId
 * - Proceeds to next middleware / route handler
 *
 * If invalid, expired, missing, or tampered:
 * - Halts request execution immediately
 * - Responds with standardized team error format (HTTP 401)
 */
export function authenticate(
  req: Request,
  res: Response<ApiResponseError>,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Authorization header is missing',
      error: {
        code: ErrorCode.AUTH_TOKEN_MISSING
      }
    });
    return;
  }

  // Format must strictly be: "Bearer <token>"
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Authorization header format must be Bearer <token>',
      error: {
        code: ErrorCode.AUTH_TOKEN_INVALID
      }
    });
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyAccessToken(token);

    // Attach validated identity to request
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId
    };

    req.user = user;
    next();
  } catch (err: unknown) {
    if (err instanceof AuthSecurityError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: {
          code: err.code
        }
      });
      return;
    }

    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication failed',
      error: {
        code: ErrorCode.AUTH_TOKEN_INVALID
      }
    });
  }
}
