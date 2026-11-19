import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { UserRole } from '@shared/types/auth.types';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';

/**
 * Validation schema for User Login
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty')
});

/**
 * Validation schema for Token Refresh
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(10, 'Invalid refresh token format')
});

/**
 * Validation schema for User Creation / Member Invitation
 * Note: Public self-registration endpoint is deferred to Organization Onboarding (Aniket).
 * This schema is provided as a reusable validation utility for member creation.
 */
export const registerUserSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Password must contain at least one special character'),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: `Role must be one of: ${Object.values(UserRole).join(', ')}` })
  }),
  organizationId: z
    .string({ required_error: 'Organization ID is required' })
    .trim()
    .min(1, 'Organization ID cannot be empty')
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;

/**
 * Reusable Express middleware factory for validating request bodies with Zod.
 * Returns standardized HTTP 400 error response if validation fails.
 *
 * @param schema - Zod schema to validate req.body against
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response<ApiResponseError>, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const formattedErrors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));

        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Request body validation failed',
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            details: formattedErrors
          }
        });
        return;
      }

      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid request payload',
        error: {
          code: ErrorCode.BAD_REQUEST
        }
      });
    }
  };
}
