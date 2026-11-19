import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/types/auth.types';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';

/**
 * Role-Based Authorization Middleware (RBAC)
 * Restricts access to endpoints based on user roles extracted from verified JWT.
 *
 * @param allowedRoles - List of roles permitted to access this endpoint
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response<ApiResponseError>, next: NextFunction): void => {
    // Ensure authentication middleware ran first
    if (!req.user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required before authorization check',
        error: {
          code: ErrorCode.AUTH_TOKEN_MISSING
        }
      });
      return;
    }

    const userRole = req.user.role;

    // SUPER_ADMIN has global privileges
    if (userRole === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    // Check if user's role is in the allowed list
    if (!allowedRoles.includes(userRole)) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: `Forbidden: role '${userRole}' does not have sufficient permissions for this resource`,
        error: {
          code: ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE
        }
      });
      return;
    }

    next();
  };
}
