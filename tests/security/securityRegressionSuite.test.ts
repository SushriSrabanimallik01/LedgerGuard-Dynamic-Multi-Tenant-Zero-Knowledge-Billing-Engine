import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import authRoutes from '../../backend/src/routes/authRoutes';
import { authenticate } from '../../backend/src/middleware/authenticate';
import {
  tenantAccess,
  billingSecurityPipeline,
  analyticsSecurityPipeline,
  getTrustedTenantId
} from '../../backend/src/middleware/tenantAccess';
import { authorize } from '../../backend/src/middleware/authorize';
import { authRateLimiter } from '../../backend/src/middleware/rateLimiter';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken
} from '../../backend/src/security/jwt';
import { hashPassword } from '../../backend/src/security/password';
import { securityConfig } from '../../backend/src/security/securityConfig';
import {
  setUserRepository,
  InMemoryUserRepository
} from '../../backend/src/repositories/userRepository';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';

/**
 * ============================================================================
 * LedgerGuard — Security Regression & Attack Test Suite (Mid-Evaluation)
 * ============================================================================
 *
 * Scope & Guarantees Verified:
 * 1. Missing JWT token rejection.
 * 2. Invalid/tampered JWT rejection.
 * 3. Expired JWT rejection.
 * 4. Token type confusion (refresh token used as access token).
 * 5. Missing trusted tenant context rejection.
 * 6. Malformed tenant context rejection.
 * 7. Cross-tenant access prohibition (Tenant A attempting to access Tenant B).
 * 8. Route parameter tenant ID tampering.
 * 9. Request body tenant ID injection.
 * 10. Request header (x-tenant-id) spoofing.
 * 11. Unauthorized role rejection (RBAC privilege escalation).
 * 12. Authorized role permission grant.
 * 13. Valid authenticated tenant request execution with trusted context.
 * 14. Brute-force login rate limiting (HTTP 429).
 * 15. Malformed login input rejection (Zod schema validation).
 * 16. Invalid credentials (timing-mitigated generic failure).
 * 17. Inactive account access rejection.
 *
 * TESTING SCOPE NOTE:
 * These tests exercise the Express HTTP request/response middleware pipelines
 * and API Gateway security boundaries. They prove that unauthorized, tampered,
 * or cross-tenant requests are intercepted and rejected before business logic runs.
 * They do NOT test physical database-level storage isolation (MongoDB collection
 * isolation or Mongoose connection switching), which is owned by Database and
 * Billing Engine modules.
 */

describe('LedgerGuard Security Regression & Attack Test Suite', () => {
  let app: express.Application;
  let userRepo: InMemoryUserRepository;

  // Track invocation of test handlers to prove execution is blocked on unauthorized requests
  let protectedHandlerInvoked: boolean;
  let billingHandlerInvoked: boolean;
  let analyticsHandlerInvoked: boolean;

  // Credentials for active seed user
  const rawPassword = 'StrongPassword!2026';
  let activePasswordHash: string;

  beforeAll(async () => {
    activePasswordHash = await hashPassword(rawPassword);
  });

  beforeEach(() => {
    protectedHandlerInvoked = false;
    billingHandlerInvoked = false;
    analyticsHandlerInvoked = false;

    // Set up clean in-memory repository for test isolation
    userRepo = new InMemoryUserRepository();
    setUserRepository(userRepo);

    // Seed test users
    userRepo.seedUser({
      id: 'usr_alice_admin',
      email: 'alice@tenant-a.com',
      passwordHash: activePasswordHash,
      role: UserRole.ORG_ADMIN,
      organizationId: 'org_tenant_a',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    userRepo.seedUser({
      id: 'usr_alice_billing',
      email: 'billing@tenant-a.com',
      passwordHash: activePasswordHash,
      role: UserRole.BILLING_MANAGER,
      organizationId: 'org_tenant_a',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    userRepo.seedUser({
      id: 'usr_alice_member',
      email: 'member@tenant-a.com',
      passwordHash: activePasswordHash,
      role: UserRole.MEMBER,
      organizationId: 'org_tenant_a',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    userRepo.seedUser({
      id: 'usr_inactive_user',
      email: 'inactive@tenant-a.com',
      passwordHash: activePasswordHash,
      role: UserRole.MEMBER,
      organizationId: 'org_tenant_a',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Construct test Express application
    app = express();
    app.use(express.json());

    // 1. Mount Auth Routes (/api/v1/auth)
    app.use('/api/v1/auth', authRoutes);

    // 2. Generic Protected Tenant Route (exercising authenticate + tenantAccess)
    app.get(
      '/api/v1/organizations/:orgId/invoices',
      authenticate,
      tenantAccess(),
      (req: Request, res: Response) => {
        protectedHandlerInvoked = true;
        res.status(200).json({
          success: true,
          message: 'Tenant invoices retrieved',
          data: {
            tenantId: getTrustedTenantId(req),
            invoices: [{ id: 'inv_001', amount: 500 }]
          }
        });
      }
    );

    // 3. Billing Protected Route (exercising billingSecurityPipeline)
    app.post(
      '/api/v1/billing/pay',
      ...billingSecurityPipeline,
      (req: Request, res: Response) => {
        billingHandlerInvoked = true;
        res.status(200).json({
          success: true,
          message: 'Payment processed',
          data: {
            tenantId: getTrustedTenantId(req),
            bodyTenantId: req.body.tenantId,
            amount: req.body.amount
          }
        });
      }
    );

    // 4. Analytics Protected Route (exercising analyticsSecurityPipeline)
    app.get(
      '/api/v1/analytics/:tenantId',
      ...analyticsSecurityPipeline,
      (req: Request, res: Response) => {
        analyticsHandlerInvoked = true;
        res.status(200).json({
          success: true,
          message: 'Analytics retrieved',
          data: {
            tenantId: req.params.tenantId,
            trustedTenantId: getTrustedTenantId(req)
          }
        });
      }
    );
  });

  // Test Tokens
  const tenantAAdminToken = generateAccessToken({
    userId: 'usr_alice_admin',
    email: 'alice@tenant-a.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_tenant_a'
  });

  const tenantABillingToken = generateAccessToken({
    userId: 'usr_alice_billing',
    email: 'billing@tenant-a.com',
    role: UserRole.BILLING_MANAGER,
    organizationId: 'org_tenant_a'
  });

  const tenantAMemberToken = generateAccessToken({
    userId: 'usr_alice_member',
    email: 'member@tenant-a.com',
    role: UserRole.MEMBER,
    organizationId: 'org_tenant_a'
  });

  // ==========================================================================
  // REQUIRED COVERAGE SCENARIOS (1 to 17)
  // ==========================================================================

  // 1. Missing JWT
  it('1. Missing JWT: Rejects request to protected endpoint when Authorization header is absent', async () => {
    const res = await request(app).get('/api/v1/organizations/org_tenant_a/invoices');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
    expect(res.body.message).toMatch(/authorization header is missing/i);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 2. Invalid JWT
  it('2. Invalid JWT: Rejects tampered or cryptographically invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', 'Bearer invalid.tampered.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 3. Expired JWT
  it('3. Expired JWT: Rejects token past its expiration timestamp', async () => {
    const expiredToken = jwt.sign(
      {
        sub: 'usr_alice_admin',
        email: 'alice@tenant-a.com',
        role: UserRole.ORG_ADMIN,
        organizationId: 'org_tenant_a',
        tokenType: 'access'
      },
      securityConfig.jwt.secret,
      {
        algorithm: 'HS256',
        expiresIn: '-10s',
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      }
    );

    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
    expect(res.body.message).toMatch(/token has expired/i);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 4. Refresh Token Used as Access Token (Token Type Differentiation)
  it('4. Refresh token used as access token: Cryptographic secret separation rejects token type confusion', async () => {
    // Generate valid refresh token (signed with JWT_REFRESH_SECRET, tokenType: 'refresh')
    const validRefreshToken = generateRefreshToken('usr_alice_admin', 'org_tenant_a');

    // Attempt to use refresh token as an access token on a protected route
    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${validRefreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 5. Missing Trusted Tenant Context
  it('5. Missing trusted tenant context: Rejects request if token lacks organizationId claim', async () => {
    // Manually forge token without organizationId
    const tokenNoOrg = jwt.sign(
      {
        sub: 'usr_rogue',
        email: 'rogue@test.com',
        role: UserRole.ORG_ADMIN,
        tokenType: 'access'
      },
      securityConfig.jwt.secret,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      }
    );

    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${tokenNoOrg}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 6. Malformed Tenant Context
  it('6. Malformed tenant context: Rejects request if organizationId is whitespace/empty', async () => {
    const tokenBlankOrg = jwt.sign(
      {
        sub: 'usr_blank',
        email: 'blank@test.com',
        role: UserRole.ORG_ADMIN,
        organizationId: '   ',
        tokenType: 'access'
      },
      securityConfig.jwt.secret,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      }
    );

    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${tokenBlankOrg}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 7. Tenant A Attempting to Access Tenant B Data
  it('7. Tenant A attempting to access Tenant B data: Blocked by zero-trust tenant boundary with HTTP 403', async () => {
    // Alice from Tenant A attempts to read invoices of Tenant B
    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_b/invoices')
      .set('Authorization', `Bearer ${tenantAAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/cross-tenant access prohibited/i);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 8. Tenant A Changing Tenant ID in URL
  it('8. Tenant A changing tenant ID in URL: Blocked on analytics route :tenantId parameter', async () => {
    // Alice from Tenant A attempts to query Tenant B analytics via route param
    const res = await request(app)
      .get('/api/v1/analytics/org_tenant_b')
      .set('Authorization', `Bearer ${tenantAAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/route param \(org_tenant_b\)/i);
    expect(analyticsHandlerInvoked).toBe(false);
  });

  // 9. Tenant A Sending Tenant B Tenant ID in Body
  it('9. Tenant A sending Tenant B tenant ID in body: Blocked on billing POST /pay body injection', async () => {
    // Alice attempts to execute a payment on behalf of Tenant B
    const res = await request(app)
      .post('/api/v1/billing/pay')
      .set('Authorization', `Bearer ${tenantABillingToken}`)
      .send({
        tenantId: 'org_tenant_b',
        amount: 500,
        transactionId: 'tx_spoof_body'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/request body \(org_tenant_b\)/i);
    expect(billingHandlerInvoked).toBe(false);
  });

  // 10. Tenant A Sending Tenant B Tenant ID in Headers
  it('10. Tenant A sending Tenant B tenant ID in headers: Blocked on x-tenant-id spoofing attempt', async () => {
    // Alice requests own route but injects x-tenant-id for Tenant B
    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .set('x-tenant-id', 'org_tenant_b');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/header x-tenant-id \(org_tenant_b\)/i);
    expect(protectedHandlerInvoked).toBe(false);
  });

  // 11. Unauthorized Role
  it('11. Unauthorized role: Privilege escalation blocked when MEMBER role attempts billing mutation', async () => {
    const res = await request(app)
      .post('/api/v1/billing/pay')
      .set('Authorization', `Bearer ${tenantAMemberToken}`)
      .send({
        amount: 250,
        transactionId: 'tx_member_escalate'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
    expect(res.body.message).toMatch(/forbidden: role 'member' does not have sufficient permissions/i);
    expect(billingHandlerInvoked).toBe(false);
  });

  // 12. Authorized Role
  it('12. Authorized role: ORG_ADMIN and BILLING_MANAGER granted access on authorized endpoints', async () => {
    // Billing Manager authorized on billing route
    const billingRes = await request(app)
      .post('/api/v1/billing/pay')
      .set('Authorization', `Bearer ${tenantABillingToken}`)
      .send({
        amount: 250,
        transactionId: 'tx_valid_role'
      });

    expect(billingRes.status).toBe(200);
    expect(billingRes.body.success).toBe(true);
    expect(billingHandlerInvoked).toBe(true);

    // Org Admin authorized on analytics route
    const analyticsRes = await request(app)
      .get('/api/v1/analytics/org_tenant_a')
      .set('Authorization', `Bearer ${tenantAAdminToken}`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.success).toBe(true);
    expect(analyticsHandlerInvoked).toBe(true);
  });

  // 13. Valid Authenticated Tenant Request
  it('13. Valid authenticated tenant request: Injects verified req.tenant context and executes handler', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${tenantAAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantId).toBe('org_tenant_a');
    expect(protectedHandlerInvoked).toBe(true);
  });

  // 15. Malformed Login Request (placed before rate limiter to maintain clean state)
  it('15. Malformed login request: Zod validator blocks invalid email and empty/missing password with HTTP 400', async () => {
    // Test 1: Invalid email format
    const resBadEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: rawPassword
      });

    expect(resBadEmail.status).toBe(400);
    expect(resBadEmail.body.success).toBe(false);
    expect(resBadEmail.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

    // Test 2: Missing password field
    const resMissingPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@tenant-a.com'
      });

    expect(resMissingPass.status).toBe(400);
    expect(resMissingPass.body.success).toBe(false);
    expect(resMissingPass.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

    // Test 3: Empty password string
    const resEmptyPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@tenant-a.com',
        password: ''
      });

    expect(resEmptyPass.status).toBe(400);
    expect(resEmptyPass.body.success).toBe(false);
    expect(resEmptyPass.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  // 16. Invalid Credentials
  it('16. Invalid credentials: Nonexistent user and wrong password return identical generic 401', async () => {
    // Attempt 1: Nonexistent user
    const resNonexistent = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'ghost@tenant-a.com',
        password: rawPassword
      });

    expect(resNonexistent.status).toBe(401);
    expect(resNonexistent.body.success).toBe(false);
    expect(resNonexistent.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    expect(resNonexistent.body.message).toBe('Invalid email or password');

    // Attempt 2: Existing user, wrong password
    const resWrongPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@tenant-a.com',
        password: 'CompletelyWrongPassword123!'
      });

    expect(resWrongPass.status).toBe(401);
    expect(resWrongPass.body.success).toBe(false);
    expect(resWrongPass.body.error.code).toBe(ErrorCode.AUTH_CREDENTIALS_INVALID);
    expect(resWrongPass.body.message).toBe('Invalid email or password');

    // Both error responses are identical, mitigating enumeration
    expect(resNonexistent.body.message).toEqual(resWrongPass.body.message);
  });

  // 17. Inactive Account
  it('17. Inactive account: Deactivated user account is denied login with HTTP 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'inactive@tenant-a.com',
        password: rawPassword
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
    expect(res.body.message).toMatch(/account is deactivated/i);
  });

  // 14. Login Rate Limit (tested with loop to trigger 429)
  it('14. Login rate limit: Blocks repeated failed attempts exceeding threshold with HTTP 429', async () => {
    let rateLimitedResponse;

    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'alice@tenant-a.com',
          password: 'IncorrectPasswordAttempt!'
        });

      if (res.status === 429) {
        rateLimitedResponse = res;
        break;
      }
    }

    expect(rateLimitedResponse).toBeDefined();
    expect(rateLimitedResponse?.status).toBe(429);
    expect(rateLimitedResponse?.body.success).toBe(false);
    expect(rateLimitedResponse?.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(rateLimitedResponse?.body.message).toMatch(/too many requests/i);
  });
});
