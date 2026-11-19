import express, { Request, Response } from 'express';
import request from 'supertest';
import { authenticate } from '../../backend/src/middleware/authenticate';
import { authorize } from '../../backend/src/middleware/authorize';
import { generateAccessToken } from '../../backend/src/security/jwt';
import { UserRole } from '../../shared/types/auth.types';
import { ErrorCode } from '../../shared/types/api.types';

describe('Security Middleware: Role-Based Authorization (authorize.ts)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Public test route
    app.get('/api/public', (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Public endpoint' });
    });

    // Protected route: Any authenticated user
    app.get('/api/profile', authenticate, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Profile data', data: { user: req.user } });
    });

    // Protected route: Billing Manager or Org Admin
    app.get(
      '/api/billing/invoices',
      authenticate,
      authorize([UserRole.ORG_ADMIN, UserRole.BILLING_MANAGER]),
      (req: Request, res: Response) => {
        res.json({ success: true, message: 'Invoice records', data: { user: req.user } });
      }
    );

    // Protected route: Org Admin only
    app.delete(
      '/api/organization/settings',
      authenticate,
      authorize([UserRole.ORG_ADMIN]),
      (_req: Request, res: Response) => {
        res.json({ success: true, message: 'Organization settings updated' });
      }
    );
  });

  const memberToken = generateAccessToken({
    userId: 'usr_member_1',
    email: 'member@acme.com',
    role: UserRole.MEMBER,
    organizationId: 'org_acme'
  });

  const billingToken = generateAccessToken({
    userId: 'usr_billing_1',
    email: 'billing@acme.com',
    role: UserRole.BILLING_MANAGER,
    organizationId: 'org_acme'
  });

  const adminToken = generateAccessToken({
    userId: 'usr_admin_1',
    email: 'admin@acme.com',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org_acme'
  });

  const superAdminToken = generateAccessToken({
    userId: 'usr_super_1',
    email: 'super@ledgerguard.io',
    role: UserRole.SUPER_ADMIN,
    organizationId: 'org_ledgerguard'
  });

  it('should allow public access without token', async () => {
    const res = await request(app).get('/api/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject access to protected route if Authorization header is missing', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_MISSING);
  });

  it('should reject access to protected route if Authorization header format is not Bearer', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Basic ${memberToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
  });

  it('should allow any authenticated role to access general profile route', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe('usr_member_1');
  });

  it('should reject MEMBER from billing endpoints (insufficient permissions)', async () => {
    const res = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
    expect(res.body.message).toMatch(/does not have sufficient permissions/i);
  });

  it('should allow BILLING_MANAGER to access billing endpoints', async () => {
    const res = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${billingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow ORG_ADMIN to access billing endpoints', async () => {
    const res = await request(app)
      .get('/api/billing/invoices')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject BILLING_MANAGER from admin-only routes', async () => {
    const res = await request(app)
      .delete('/api/organization/settings')
      .set('Authorization', `Bearer ${billingToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN_INSUFFICIENT_ROLE);
  });

  it('should allow ORG_ADMIN to access admin-only routes', async () => {
    const res = await request(app)
      .delete('/api/organization/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should allow SUPER_ADMIN access to restricted routes automatically', async () => {
    const res = await request(app)
      .delete('/api/organization/settings')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
