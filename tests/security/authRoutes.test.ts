import request from 'supertest';
import app, { resolveTrustProxySetting } from '../../backend/src/app';
import {
  InMemoryUserRepository,
  setUserRepository
} from '../../backend/src/controllers/authController';
import { hashPassword } from '../../backend/src/security/password';
import { generateAccessToken } from '../../backend/src/security/jwt';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';

describe('API Gateway & Security: Auth Routes Integration Tests (/api/v1/auth)', () => {
  let userRepo: InMemoryUserRepository;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    setUserRepository(userRepo);

    // Seed test users
    const hashedSecret = await hashPassword('SecureP@ss123');

    userRepo.seedUser({
      id: 'usr_active_admin',
      email: 'admin@acme.com',
      passwordHash: hashedSecret,
      role: UserRole.ORG_ADMIN,
      organizationId: 'org_acme',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    userRepo.seedUser({
      id: 'usr_inactive',
      email: 'inactive@acme.com',
      passwordHash: hashedSecret,
      role: UserRole.MEMBER,
      organizationId: 'org_acme',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login with invalid email format (validation failure)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'not-an-email',
          password: 'SecureP@ss123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@acme.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'WrongPassword999!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    });

    it('should reject login for non-existent user email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@acme.com',
          password: 'SecureP@ss123'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    });

    it('should reject login for inactive / deactivated account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@acme.com',
          password: 'SecureP@ss123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
    });

    it('should successfully log in active user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'SecureP@ss123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.id).toBe('usr_active_admin');
      expect(res.body.data.user.email).toBe('admin@acme.com');
      expect(res.body.data.user.role).toBe(UserRole.ORG_ADMIN);
      expect(res.body.data.user.organizationId).toBe('org_acme');
      // Password hash must NEVER be exposed
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should reject refresh when token is invalid or malformed', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid_token_string'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should exchange valid refresh token for a new access token', async () => {
      // 1. Log in to get valid refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'SecureP@ss123'
        });

      const refreshToken = loginRes.body.data.refreshToken;

      // 2. Use refresh token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
    });

    it('should return user profile when authenticated with valid Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@acme.com',
          password: 'SecureP@ss123'
        });

      const token = loginRes.body.data.accessToken;

      const profileRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.data.user.id).toBe('usr_active_admin');
      expect(profileRes.body.data.user.email).toBe('admin@acme.com');
      expect(profileRes.body.data.user.role).toBe(UserRole.ORG_ADMIN);
      expect(profileRes.body.data.user.organizationId).toBe('org_acme');
    });

    it('should reject access to /me with an invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token.here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    });

    it('should reject access to /me with an expired token', async () => {
      const expiredToken = generateAccessToken(
        {
          userId: 'usr_active_admin',
          email: 'admin@acme.com',
          role: UserRole.ORG_ADMIN,
          organizationId: 'org_acme'
        },
        -10
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
    });
  });

  describe('Rate Limiting (authRateLimiter)', () => {
    it('should enforce rate limit of 10 requests per 15-minute window on /login', async () => {
      let rateLimitedRes;
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'admin@acme.com',
            password: 'WrongPassword!'
          });
        if (res.status === 429) {
          rateLimitedRes = res;
          break;
        }
      }

      expect(rateLimitedRes).toBeDefined();
      expect(rateLimitedRes?.status).toBe(429);
      expect(rateLimitedRes?.body.success).toBe(false);
      expect(rateLimitedRes?.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(rateLimitedRes?.body.message).toMatch(/too many requests/i);
    });
  });

  describe('GET /health', () => {
    it('should return healthy status for API Gateway', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('healthy');
    });
  });

  describe('Proxy Trust Configuration (resolveTrustProxySetting)', () => {
    it('should return false for undefined, empty, or false strings', () => {
      expect(resolveTrustProxySetting(undefined)).toBe(false);
      expect(resolveTrustProxySetting('')).toBe(false);
      expect(resolveTrustProxySetting('   ')).toBe(false);
      expect(resolveTrustProxySetting('false')).toBe(false);
      expect(resolveTrustProxySetting('FALSE')).toBe(false);
      expect(resolveTrustProxySetting('0')).toBe(false);
    });

    it('should return true for explicit true', () => {
      expect(resolveTrustProxySetting('true')).toBe(true);
      expect(resolveTrustProxySetting('TRUE')).toBe(true);
    });

    it('should strictly parse positive integers as hop counts', () => {
      expect(resolveTrustProxySetting('1')).toBe(1);
      expect(resolveTrustProxySetting('2')).toBe(2);
      expect(resolveTrustProxySetting('10')).toBe(10);
    });

    it('should reject malformed numeric strings and safely fall back to false without silently converting', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveTrustProxySetting('2abc')).toBe(false);
      expect(resolveTrustProxySetting('1.5')).toBe(false);
      expect(resolveTrustProxySetting('-1')).toBe(false);
      expect(resolveTrustProxySetting('01')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should accept valid proxy-addr keywords and subnets', () => {
      expect(resolveTrustProxySetting('loopback')).toBe('loopback');
      expect(resolveTrustProxySetting('LOOPBACK')).toBe('loopback');
      expect(resolveTrustProxySetting('linklocal')).toBe('linklocal');
      expect(resolveTrustProxySetting('10.0.0.0/8')).toBe('10.0.0.0/8');
      expect(resolveTrustProxySetting('127.0.0.1, 10.0.0.1')).toBe('127.0.0.1, 10.0.0.1');
    });

    it('should reject invalid IPs and malformed strings safely', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveTrustProxySetting('invalid;injection!@#')).toBe(false);
      expect(resolveTrustProxySetting('999.999.999.999')).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
