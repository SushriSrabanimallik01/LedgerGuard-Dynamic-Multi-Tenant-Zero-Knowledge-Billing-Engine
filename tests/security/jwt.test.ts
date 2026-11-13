import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenUnverified,
  AuthSecurityError
} from '../../backend/src/security/jwt';
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength
} from '../../backend/src/security/password';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';
import { securityConfig } from '../../backend/src/security/securityConfig';

describe('Security Module: JWT Authentication Utilities', () => {
  const sampleUser = {
    userId: 'usr_123456',
    email: 'test.user@tenant-alpha.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_alpha_999'
  };

  describe('generateAccessToken & verifyAccessToken', () => {
    it('should successfully generate and verify a valid access token', () => {
      const token = generateAccessToken(sampleUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(sampleUser.userId);
      expect(decoded.email).toBe(sampleUser.email);
      expect(decoded.role).toBe(sampleUser.role);
      expect(decoded.organizationId).toBe(sampleUser.organizationId);
      expect(decoded.iss).toBe(securityConfig.jwt.issuer);
      expect(decoded.aud).toBe(securityConfig.jwt.audience);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should reject a missing or empty token', () => {
      expect(() => verifyAccessToken('')).toThrow(AuthSecurityError);
      try {
        verifyAccessToken('');
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
        expect(error.statusCode).toBe(401);
      }
    });

    it('should reject a completely malformed token string', () => {
      expect(() => verifyAccessToken('not.a.valid.jwt.token')).toThrow(AuthSecurityError);
      try {
        verifyAccessToken('invalid-string');
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
        expect(error.statusCode).toBe(401);
      }
    });

    it('should reject an expired JWT token', () => {
      // Issue token with 0s expiry (instant expiration)
      const expiredToken = generateAccessToken(sampleUser, -10);

      expect(() => verifyAccessToken(expiredToken)).toThrow(AuthSecurityError);
      try {
        verifyAccessToken(expiredToken);
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
        expect(error.statusCode).toBe(401);
      }
    });

    it('should reject a tampered JWT payload (signature mismatch)', () => {
      const validToken = generateAccessToken(sampleUser);
      const [header, payload, signature] = validToken.split('.');

      // Decode the payload base64, alter the organizationId, re-encode
      const decodedJson = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      decodedJson.organizationId = 'org_victim_tampered';
      const tamperedPayload = Buffer.from(JSON.stringify(decodedJson)).toString('base64url');

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      expect(() => verifyAccessToken(tamperedToken)).toThrow(AuthSecurityError);
      try {
        verifyAccessToken(tamperedToken);
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
        expect(error.message).toMatch(/signature/i);
      }
    });

    it('should reject a token signed with an unauthorized/different secret', () => {
      const forgedToken = jwt.sign(
        {
          sub: sampleUser.userId,
          email: sampleUser.email,
          role: sampleUser.role,
          organizationId: sampleUser.organizationId
        },
        'attacker_private_secret_key',
        {
          issuer: securityConfig.jwt.issuer,
          audience: securityConfig.jwt.audience
        }
      );

      expect(() => verifyAccessToken(forgedToken)).toThrow(AuthSecurityError);
      try {
        verifyAccessToken(forgedToken);
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      }
    });

    it('should reject token generation when required claims are missing', () => {
      expect(() => {
        // @ts-expect-error Testing missing userId runtime check
        generateAccessToken({ email: 'a@b.com', role: UserRole.MEMBER, organizationId: 'org1' });
      }).toThrow(AuthSecurityError);
    });

    it('should reject verified token if required claim is missing from decoded payload', () => {
      // Craft a token signed with correct secret but missing organizationId claim
      const incompleteToken = jwt.sign(
        { sub: 'usr_1', email: 'a@b.com', role: UserRole.MEMBER },
        securityConfig.jwt.secret,
        { issuer: securityConfig.jwt.issuer, audience: securityConfig.jwt.audience }
      );

      expect(() => verifyAccessToken(incompleteToken)).toThrow(AuthSecurityError);
      try {
        verifyAccessToken(incompleteToken);
      } catch (err) {
        const error = err as AuthSecurityError;
        expect(error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      }
    });
  });

  describe('generateRefreshToken & verifyRefreshToken', () => {
    it('should successfully issue and verify a refresh token', () => {
      const refreshToken = generateRefreshToken(sampleUser.userId, sampleUser.organizationId);
      expect(typeof refreshToken).toBe('string');

      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.sub).toBe(sampleUser.userId);
      expect(decoded.organizationId).toBe(sampleUser.organizationId);
    });

    it('should not allow an access token to be verified as a refresh token', () => {
      const accessToken = generateAccessToken(sampleUser);
      // Access token was signed with JWT_SECRET, not JWT_REFRESH_SECRET
      expect(() => verifyRefreshToken(accessToken)).toThrow(AuthSecurityError);
    });

    it('should not allow a refresh token to be verified as an access token', () => {
      const refreshToken = generateRefreshToken(sampleUser.userId, sampleUser.organizationId);
      // Refresh token was signed with JWT_REFRESH_SECRET, not JWT_SECRET
      expect(() => verifyAccessToken(refreshToken)).toThrow(AuthSecurityError);
    });
  });

  describe('decodeTokenUnverified', () => {
    it('should decode a token without throwing error', () => {
      const token = generateAccessToken(sampleUser);
      const decoded = decodeTokenUnverified(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(sampleUser.userId);
    });

    it('should return null for malformed string', () => {
      const result = decodeTokenUnverified('bad-jwt');
      expect(result).toBeNull();
    });
  });

  describe('Password Hashing Utilities (password.ts)', () => {
    const rawPassword = 'SecureP@ssw0rd!2026';

    it('should securely hash password with bcrypt', async () => {
      const hash = await hashPassword(rawPassword);
      expect(hash).toBeDefined();
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
      expect(hash).not.toBe(rawPassword);
    });

    it('should correctly verify valid password against hash', async () => {
      const hash = await hashPassword(rawPassword);
      const isValid = await comparePassword(rawPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword(rawPassword);
      const isValid = await comparePassword('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should safely return false for malformed or empty hash without throwing', async () => {
      expect(await comparePassword(rawPassword, '')).toBe(false);
      expect(await comparePassword(rawPassword, 'invalid_hash_string')).toBe(false);
      expect(await comparePassword('', 'some_hash')).toBe(false);
    });

    it('should validate password complexity requirements', () => {
      // Valid password
      expect(validatePasswordStrength('LedgerGuard@2026!').isValid).toBe(true);

      // Too short
      const short = validatePasswordStrength('Sh1!');
      expect(short.isValid).toBe(false);
      expect(short.errors).toContain('Password must be at least 8 characters long');

      // Missing uppercase
      const noUpper = validatePasswordStrength('lowercase123!@#');
      expect(noUpper.isValid).toBe(false);
      expect(noUpper.errors).toContain('Password must contain at least one uppercase letter');

      // Missing digit
      const noDigit = validatePasswordStrength('NoDigitsHere!@#');
      expect(noDigit.isValid).toBe(false);
      expect(noDigit.errors).toContain('Password must contain at least one digit');

      // Missing special character
      const noSpecial = validatePasswordStrength('NoSpecialChars123');
      expect(noSpecial.isValid).toBe(false);
      expect(noSpecial.errors).toContain('Password must contain at least one special character');
    });
  });
});
