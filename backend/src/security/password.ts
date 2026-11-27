import bcrypt from 'bcryptjs';
import { securityConfig } from './securityConfig';

/**
 * Result of password strength evaluation
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Hash a plain text password using bcrypt with configured salt rounds.
 *
 * @param password - Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = await bcrypt.genSalt(securityConfig.password.saltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plain text password against a stored bcrypt hash.
 * Uses constant-time comparison to protect against timing attacks.
 *
 * @param password - Plain text password entered by user
 * @param hash - Hashed password stored in database
 * @returns True if password matches hash, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    // Malformed hash or comparison failure - fail securely
    return false;
  }
}

/**
 * Validate that a password meets LedgerGuard security requirements:
 * - At least 8 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one digit
 * - Contains at least one special character
 *
 * @param password - Plain text password to validate
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password must be a non-empty string'] };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
