import { Router } from 'express';
import { login, refresh, getCurrentUser } from '../controllers/authController';
import { validateBody, loginSchema, refreshTokenSchema } from '../validators/authValidator';
import { authenticate } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user credentials, return JWT access & refresh tokens
 * @access  Public (Rate-limited & validated)
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  login
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Exchange valid refresh token for a new access token
 * @access  Public (Validated)
 */
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  refresh
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Retrieve currently authenticated user identity and tenant
 * @access  Protected (Requires Bearer JWT)
 */
router.get(
  '/me',
  authenticate,
  getCurrentUser
);

export default router;
