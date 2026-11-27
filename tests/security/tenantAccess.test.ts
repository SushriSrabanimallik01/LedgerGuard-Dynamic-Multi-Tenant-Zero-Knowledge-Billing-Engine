import express, { Request, Response } from 'express';
import request from 'supertest';
import { authenticate } from '../../backend/src/middleware/authenticate';
import { tenantAccess } from '../../backend/src/middleware/tenantAccess';
import { generateAccessToken } from '../../backend/src/security/jwt';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';

describe('Security Middleware: Tenant Isolation (tenantAccess.ts)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Route with URL parameter for tenant
    app.get(
      '/api/organizations/:orgId/invoices',
      authenticate,
      tenantAccess(),
      (req: Request, res: Response) => {
        res.json({
          success: true,
          message: 'Tenant invoices retrieved',
          data: {
            authenticatedTenant: req.tenant?.tenantId,
            userOrg: req.user?.organizationId
          }
        });
      }
    );

    // Route with body mutation
    app.post(
      '/api/billing/charges',
      authenticate,
      tenantAccess({ enforceBodyMatch: true, allowSuperAdminCrossTenant: true }),
      (req: Request, res: Response) => {
        res.json({
          success: true,
          message: 'Charge created',
          data: {
            tenantId: req.tenant?.tenantId
          }
        });
      }
    );
  });

  const orgAToken = generateAccessToken({
    userId: 'usr_alice',
    email: 'alice@tenant-a.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_tenant_a'
  });

  const superAdminToken = generateAccessToken({
    userId: 'usr_super',
    email: 'super@ledgerguard.io',
    role: UserRole.SUPER_ADMIN,
    organizationId: 'org_system'
  });

  it('should allow user to access their own tenant resources via route param', async () => {
    const res = await request(app)
      .get('/api/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${orgAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.authenticatedTenant).toBe('org_tenant_a');
  });

  it('should strictly BLOCK cross-tenant access attempt via route parameter', async () => {
    // Alice (from org_tenant_a) attempts to read invoices of victim org_tenant_b
    const res = await request(app)
      .get('/api/organizations/org_tenant_b/invoices')
      .set('Authorization', `Bearer ${orgAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/cross-tenant access prohibited/i);
  });

  it('should strictly BLOCK cross-tenant access attempt via header spoofing', async () => {
    // Alice sends request for org_tenant_a route, but injects x-tenant-id: org_tenant_b
    const res = await request(app)
      .get('/api/organizations/org_tenant_a/invoices')
      .set('Authorization', `Bearer ${orgAToken}`)
      .set('x-tenant-id', 'org_tenant_b');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
  });

  it('should strictly BLOCK cross-tenant access attempt via query parameter spoofing', async () => {
    // Alice appends ?organizationId=org_victim
    const res = await request(app)
      .get('/api/organizations/org_tenant_a/invoices?organizationId=org_victim')
      .set('Authorization', `Bearer ${orgAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
  });

  it('should strictly BLOCK cross-tenant access attempt via request body injection', async () => {
    // Alice attempts to charge against org_victim in the request body
    const res = await request(app)
      .post('/api/billing/charges')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        amount: 500,
        currency: 'USD',
        organizationId: 'org_victim'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_TENANT_ACCESS);
    expect(res.body.message).toMatch(/request body \(org_victim\)/i);
  });

  it('should succeed when body matches authenticated organization ID', async () => {
    const res = await request(app)
      .post('/api/billing/charges')
      .set('Authorization', `Bearer ${orgAToken}`)
      .send({
        amount: 500,
        currency: 'USD',
        organizationId: 'org_tenant_a'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tenantId).toBe('org_tenant_a');
  });

  it('should allow SUPER_ADMIN to inspect another tenant with cross-tenant privilege', async () => {
    const res = await request(app)
      .get('/api/organizations/org_tenant_b/invoices')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.authenticatedTenant).toBe('org_tenant_b');
  });
});
