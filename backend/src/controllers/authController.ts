import { Request, Response } from 'express';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../security/jwt';
import { comparePassword } from '../security/password';
import { securityConfig } from '../security/securityConfig';
import { IUser, LoginResponseData, UserRole } from '@shared/types/auth.types';
import {
  ApiResponseSuccess,
  ApiResponseError,
  ErrorCode,
  HttpStatus
} from '@shared/types/api.types';
import { LoginInput, RefreshTokenInput } from '../validators/authValidator';

/**
 * Interface for User data operations.
 * Allows seamless plugging into Aniket's Mongoose model when ready.
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(user: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser>;
}

/**
 * In-memory repository for initial development and isolated testing
 */
export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, IUser>();

  async findByEmail(email: string): Promise<IUser | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<IUser | null> {
    return this.users.get(id) || null;
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const newUser: IUser = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, newUser);
    return newUser;
  }

  // Helper for test seeding
  seedUser(user: IUser): void {
    this.users.set(user.id, user);
  }

  clear(): void {
    this.users.clear();
  }
}

// Active user repository (defaults to in-memory, pluggable for Mongoose)
let activeUserRepository: IUserRepository = new InMemoryUserRepository();

export function setUserRepository(repo: IUserRepository): void {
  activeUserRepository = repo;
}

export function getUserRepository(): IUserRepository {
  return activeUserRepository;
}

/**
 * Fixed precomputed dummy bcrypt hash (cost factor 12, matching BCRYPT_SALT_ROUNDS).
 * Used when a user lookup returns null to execute a real bcrypt comparison,
 * mitigating timing-based user enumeration side channels.
 */
const DUMMY_PASSWORD_HASH = '$2a$12$mrDu.ju4jNcwAkvYM05rzu0tzfhqh7frPJgSOfZJQppIhCkXSaXfa';

/**
 * User Login Handler
 */
export async function login(
  req: Request<unknown, unknown, LoginInput>,
  res: Response<ApiResponseSuccess<LoginResponseData> | ApiResponseError>
): Promise<void> {
  const { email, password } = req.body;

  try {
    const user = await activeUserRepository.findByEmail(email);

    // Timing-attack mitigation:
    // If user exists, compare against stored hash; if user does not exist, run comparison against dummy hash.
    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await comparePassword(password, user.passwordHash);
    } else {
      // Execute dummy bcrypt comparison with cost factor 12 (result discarded; user remains null)
      await comparePassword(password, DUMMY_PASSWORD_HASH);
      isPasswordValid = false;
    }

    if (!user || !isPasswordValid) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid email or password',
        error: {
          code: ErrorCode.AUTH_CREDENTIALS_INVALID
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: 'Account is deactivated. Please contact your organization administrator.',
        error: {
          code: ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE
        }
      });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    });

    const refreshToken = generateRefreshToken(user.id, user.organizationId);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        expiresIn: securityConfig.jwt.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId
        }
      }
    });
  } catch {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'An unexpected error occurred during login',
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR
      }
    });
  }
}

/**
 * Refresh Access Token Handler
 *
 * Current Design:
 * - Uses dedicated cryptographic secret (JWT_REFRESH_SECRET) separated from access tokens.
 * - Confirms that user exists in database and is currently active.
 *
 * Security Limitation & Roadmap:
 * - Current refresh tokens are stateless JWTs verified by cryptographic signature and expiration.
 * - Revocation (blacklisting compromised refresh tokens) will integrate with Purnima's Redis
 *   module (`backend/src/redis/`) when Redis infrastructure is deployed.
 */
export async function refresh(
  req: Request<unknown, unknown, RefreshTokenInput>,
  res: Response<ApiResponseSuccess<{ accessToken: string; expiresIn: string | number }> | ApiResponseError>
): Promise<void> {
  const { refreshToken } = req.body;

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await activeUserRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'User session has expired or account is inactive',
        error: {
          code: ErrorCode.AUTH_TOKEN_INVALID
        }
      });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    });

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        expiresIn: securityConfig.jwt.expiresIn
      }
    });
  } catch {
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired refresh token',
      error: {
        code: ErrorCode.AUTH_TOKEN_INVALID
      }
    });
  }
}

/**
 * Current Authenticated User Profile Handler
 */
export async function getCurrentUser(
  req: Request,
  res: Response<ApiResponseSuccess<unknown> | ApiResponseError>
): Promise<void> {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Not authenticated',
      error: {
        code: ErrorCode.AUTH_TOKEN_MISSING
      }
    });
    return;
  }

  res.status(HttpStatus.OK).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      user: req.user
    }
  });
}
