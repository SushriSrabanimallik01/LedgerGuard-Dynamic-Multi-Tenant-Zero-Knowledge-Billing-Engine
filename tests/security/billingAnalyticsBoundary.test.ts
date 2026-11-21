import express, { Request, Response } from 'express';
import request from 'supertest';
import { generateAccessToken } from '../../backend/src/security/jwt';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';
import {
  createSecureBillingRouter,
  createSecureAnalyticsRouter,
  getTrustedTenantId,
  getTrustedTenant
} from '../../backend/src/adapters/billingAnalyticsAdapter';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../../backend/src/security/securityConfig';

/**
 * Security Integration Boundary Tests: Billing & Analytics
 *
 * NOTE ON TESTING SCOPE:
 * These tests exercise the Express HTTP request/response middleware pipeline and API security boundary.
 * They verify:
 * - Cryptographic JWT verification, token expiration, and malformed header rejection.
 * - Zero-trust tenant isolation: client-supplied tenant identifiers in route parameters or
 *   request bodies are strictly checked against authenticated JWT claims.
 * - Role-Based Access Control (RBAC): restricted access to authorized administrative roles.
 * - Trusted tenant context injection (`req.tenant`).
 *
 * These tests do NOT test database-level isolation (e.g. MongoDB collection isolation or Mongoose
 * connection pooling), which is owned and tested by the database and billing engine modules.
 */

describe('Security Integration Boundary: Billing & Analytics APIs', () => {
  let app: express.Application;

  // Track mock handler execution to prove handlers are never reached on unauthorized requests
  let billingHandlerInvoked: boolean;
  let analyticsHandlerInvoked: boolean;
  let lastCapturedTenantId: string | null;
  let lastCapturedBodyTenantId: string | null;

  beforeEach(() => {
    billingHandlerInvoked = false;
    analyticsHandlerInvoked = false;
    lastCapturedTenantId = null;
    lastCapturedBodyTenantId = null;

    app = express();
    app.use(express.json());

    // Mock Billing Controller matching Bhaskar's handlePayment contract
    const mockBillingController = (req: Request, res: Response): void => {
      billingHandlerInvoked = true;
      lastCapturedTenantId = getTrustedTenantId(req);
      lastCapturedBodyTenantId = req.body?.tenantId ?? null;

      res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          tenantId: lastCapturedTenantId,
          amount: req.body.amount,
          transactionId: req.body.transactionId,
          status: 'paid'
        }
      });
    };

    // Mock Analytics Controller matching Bhaskar's getUsageAnalytics contract
    const mockAnalyticsController = (req: Request, res: Response): void => {
      analyticsHandlerInvoked = true;
      lastCapturedTenantId = getTrustedTenantId(req);

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: {
          tenantId: req.params.tenantId,
          trustedTenantId: lastCapturedTenantId,
          totalSpent: 1250,
          totalTransactions: 5
        }
      });
    };

    // Mount secure routers constructed via adapter
    app.use('/api/v1/billing', createSecureBillingRouter(mockBillingController));
    app.use('/api/v1/analytics', createSecureAnalyticsRouter(mockAnalyticsController));
  });

  // Valid Test Tokens
  const tenantABillingManagerToken = generateAccessToken({
    userId: 'usr_alice_billing',
    email: 'alice@tenant-a.com',
    role: UserRole.BILLING_MANAGER,
    organizationId: 'org_tenant_a'
  });

  const tenantAAdminToken = generateAccessToken({
    userId: 'usr_alice_admin',
    email: 'admin@tenant-a.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_tenant_a'
  });

  const tenantAMemberToken = generateAccessToken({
    userId: 'usr_alice_member',
    email: 'member@tenant-a.com',
    role: UserRole.MEMBER,
    organizationId: 'org_tenant_a'
  });

  const tenantBAdminToken = generateAccessToken({
    userId: 'usr_bob_admin',
    email: 'bob@tenant-b.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_tenant_b'
  });

  const superAdminToken = generateAccessToken({
    userId: 'usr_super',
    email: 'superadmin@ledgerguard.io',
    role: UserRole.SUPER_ADMIN,
    organizationId: 'org_system'
  });

  // Expired token for testing
  const expiredToken = jwt.sign(
    {
      sub: 'usr_expired',
      email: 'expired@tenant-a.com',
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

  // Token missing organizationId claim
  const missingOrgToken = jwt.sign(
    {
      sub: 'usr_no_org',
      email: 'noorg@test.com',
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

  // Token with blank organizationId claim
  const blankOrgToken = jwt.sign(
    {
      sub: 'usr_blank_org',
      email: 'blankorg@test.com',
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

  // 1. Missing JWT Tests
  describe('1. Missing JWT Authentication', () => {
    it('should reject billing POST /pay when Authorization header is absent', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .send({ amount: 100, transactionId: 'tx_no_jwt' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should reject analytics GET /:tenantId when Authorization header is absent', async () => {
      const res = await request(app).get('/api/v1/analytics/org_tenant_a');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
      expect(analyticsHandlerInvoked).toBe(false);
    });
  });

  // 2. Invalid JWT Tests
  describe('2. Invalid JWT Authentication', () => {
    it('should reject billing POST /pay with malformed or tampered token', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', 'Bearer invalid.tampered.token')
        .send({ amount: 100, transactionId: 'tx_bad_token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should reject analytics GET /:tenantId with invalid token format', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_a')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      expect(analyticsHandlerInvoked).toBe(false);
    });
  });

  // 3. Expired JWT Tests
  describe('3. Expired JWT Authentication', () => {
    it('should reject billing POST /pay with expired token', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ amount: 100, transactionId: 'tx_expired' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should reject analytics GET /:tenantId with expired token', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_a')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
      expect(analyticsHandlerInvoked).toBe(false);
    });
  });

  // 4. Missing Tenant Identity
  describe('4. Missing Tenant Identity in Token', () => {
    it('should reject requests when token lacks organizationId claim', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${missingOrgToken}`)
        .send({ amount: 100, transactionId: 'tx_missing_org' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should reject requests when token has empty or whitespace organizationId', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_a')
        .set('Authorization', `Bearer ${blankOrgToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(analyticsHandlerInvoked).toBe(false);
    });
  });

  // 5. Cross-Tenant Analytics Parameter Tampering
  describe('5. Cross-Tenant Analytics Parameter Tampering', () => {
    it('should BLOCK Tenant A from accessing Tenant B analytics via route parameter', async () => {
      // Alice from Tenant A attempts to inspect Tenant B's analytics
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_b')
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
      expect(res.body.message).toMatch(/cross-tenant access prohibited/i);
      expect(analyticsHandlerInvoked).toBe(false);
    });

    it('should BLOCK cross-tenant analytics even with spoofed x-tenant-id header', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_a')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .set('x-tenant-id', 'org_tenant_b');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
      expect(analyticsHandlerInvoked).toBe(false);
    });
  });

  // 6. Cross-Tenant Billing Body Tampering
  describe('6. Cross-Tenant Billing Body Tampering', () => {
    it('should BLOCK Tenant A from executing billing operations on Tenant B via body injection', async () => {
      // Alice attempts to charge against Tenant B in the payload
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${tenantABillingManagerToken}`)
        .send({
          tenantId: 'org_tenant_b',
          amount: 500,
          transactionId: 'tx_attack_123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
      expect(res.body.message).toMatch(/request body \(org_tenant_b\)/i);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should BLOCK Tenant A from using snake_case tenant_id to target Tenant B', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${tenantABillingManagerToken}`)
        .send({
          tenant_id: 'org_tenant_b',
          amount: 500,
          transactionId: 'tx_attack_snake'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
      expect(billingHandlerInvoked).toBe(false);
    });

    it('should BLOCK SUPER_ADMIN from executing cross-tenant billing operations', async () => {
      // Super Admin cross-tenant read permission does NOT extend to financial mutations
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: 'org_tenant_b',
          amount: 500,
          transactionId: 'tx_super_cross_tenant_forbidden'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
      expect(res.body.message).toMatch(/cross-tenant access prohibited/i);
      expect(billingHandlerInvoked).toBe(false);
    });
  });

  // 7. Authorized Tenant Access
  describe('7. Authorized Tenant Access & RBAC Boundary', () => {
    it('should ALLOW Tenant A BILLING_MANAGER to process payment with matching body tenantId', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${tenantABillingManagerToken}`)
        .send({
          tenantId: 'org_tenant_a',
          amount: 300,
          transactionId: 'tx_valid_001'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(billingHandlerInvoked).toBe(true);
      expect(lastCapturedTenantId).toBe('org_tenant_a');
      expect(lastCapturedBodyTenantId).toBe('org_tenant_a');
    });

    it('should ALLOW Tenant A to process payment and safely backfill trusted tenantId when omitted in body', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${tenantABillingManagerToken}`)
        .send({
          amount: 300,
          transactionId: 'tx_valid_no_body_tenant'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(billingHandlerInvoked).toBe(true);
      expect(lastCapturedTenantId).toBe('org_tenant_a');
      // Proves trusted tenantId was injected into body for downstream handler compatibility
      expect(lastCapturedBodyTenantId).toBe('org_tenant_a');
    });

    it('should ALLOW Tenant A ORG_ADMIN to read own analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_a')
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(analyticsHandlerInvoked).toBe(true);
      expect(res.body.data.trustedTenantId).toBe('org_tenant_a');
    });

    it('should ALLOW SUPER_ADMIN cross-tenant access to inspect Tenant B analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/org_tenant_b')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(analyticsHandlerInvoked).toBe(true);
      expect(res.body.data.trustedTenantId).toBe('org_tenant_b');
    });

    it('should ALLOW SUPER_ADMIN to execute billing for their own organization', async () => {
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: 'org_system',
          amount: 500,
          transactionId: 'tx_super_own_org'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(billingHandlerInvoked).toBe(true);
      expect(lastCapturedTenantId).toBe('org_system');
      expect(lastCapturedBodyTenantId).toBe('org_system');
    });

    it('should ALLOW Tenant A to read own analytics via parameterless route GET /api/v1/analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics')
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(analyticsHandlerInvoked).toBe(true);
      expect(res.body.data.trustedTenantId).toBe('org_tenant_a');
    });

    it('should REJECT MEMBER role from billing operations (RBAC privilege escalation check)', async () => {
      // Alice is a standard MEMBER of Tenant A - not authorized for billing mutations
      const res = await request(app)
        .post('/api/v1/billing/pay')
        .set('Authorization', `Bearer ${tenantAMemberToken}`)
        .send({
          tenantId: 'org_tenant_a',
          amount: 100,
          transactionId: 'tx_member_forbidden'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
      expect(billingHandlerInvoked).toBe(false);
    });
  });

  // 8. Helper Functions
  describe('8. Trusted Context Helpers', () => {
    it('should throw an error if getTrustedTenant is called without tenantAccess middleware', () => {
      const mockReq = {} as Request;
      expect(() => getTrustedTenant(mockReq)).toThrow(/Tenant context missing/i);
    });

    it('should return valid tenant context when tenant context is present', () => {
      const mockReq = {
        tenant: {
          tenantId: 'org_test_123',
          status: 'active' as const
        }
      } as Request;

      expect(getTrustedTenantId(mockReq)).toBe('org_test_123');
    });
  });
});
