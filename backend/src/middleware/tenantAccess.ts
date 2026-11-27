import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/types/auth.types';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';
import { TenantContext } from '@shared/types/tenant.types';
import { authenticate } from './authenticate';
import { authorize } from './authorize';

/**
 * Options for configuring tenant-level access verification
 */
export interface TenantAccessOptions {
  allowSuperAdminCrossTenant?: boolean;
  enforceBodyMatch?: boolean;
}

/**
 * Tenant Isolation Middleware
 *
 * Guarantees strict multi-tenant isolation:
 * 1. Derives the active tenant ID strictly from the verified JWT (req.user.organizationId).
 * 2. Never trusts unverified client-supplied tenant IDs.
 * 3. Inspects path parameters (orgId, organizationId, tenantId, tenant_id), query strings,
 *    and headers (x-tenant-id). If any client-supplied identifier conflicts with the
 *    authenticated organization ID, the request is immediately rejected with HTTP 403.
 * 4. Injects a trusted `req.tenant` context for downstream database connection selection
 *    (Aniket) and billing operations (Bhaskar).
 */
export function tenantAccess(rawOptions?: TenantAccessOptions) {
  const options: Required<TenantAccessOptions> = {
    allowSuperAdminCrossTenant: rawOptions?.allowSuperAdminCrossTenant ?? true,
    enforceBodyMatch: rawOptions?.enforceBodyMatch ?? true
  };

  return (req: Request, res: Response<ApiResponseError>, next: NextFunction): void => {
    if (!req.user || !req.user.organizationId || typeof req.user.organizationId !== 'string' || req.user.organizationId.trim() === '') {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: !req.user
          ? 'Authentication required for tenant access verification'
          : 'Valid authenticated tenant identity is required',
        error: {
          code: !req.user ? ErrorCode.AUTH_TOKEN_MISSING : ErrorCode.AUTH_TOKEN_INVALID
        }
      });
      return;
    }

    const authenticatedOrgId = req.user.organizationId.trim();
    const isSuperAdmin = req.user.role === UserRole.SUPER_ADMIN;

    // Check potential client-supplied tenant identifiers
    const requestedOrgInParams = req.params.organizationId || req.params.orgId || req.params.tenantId || (req.params as Record<string, string>)['tenant_id'];
    const requestedOrgInQuery = (req.query.organizationId || req.query.tenantId || req.query.tenant_id) as string | undefined;
    const requestedOrgInHeader = req.headers['x-tenant-id'] as string | undefined;

    // Identify candidate target tenant from request (trimmed non-empty string)
    const rawTarget = requestedOrgInParams || requestedOrgInQuery || requestedOrgInHeader;
    const requestedTarget = (rawTarget && typeof rawTarget === 'string' && rawTarget.trim() !== '') ? rawTarget.trim() : undefined;

    // Super Admin cross-tenant access exception ONLY if explicitly configured (e.g. read-only analytics).
    // Mutating operations like billing must disallow cross-tenant access even for Super Admins.
    if (isSuperAdmin && options.allowSuperAdminCrossTenant) {
      const activeTenantId = requestedTarget || authenticatedOrgId;
      req.tenant = {
        tenantId: activeTenantId,
        status: 'active'
      };
      if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && !req.body.tenantId && !req.body.organizationId) {
        req.body.tenantId = activeTenantId;
      }
      next();
      return;
    }

    // For standard users (or Super Admins when cross-tenant access is disabled),
    // verify that any client-supplied identifier strictly matches the authenticated organization ID
    const conflictingSources: string[] = [];

    if (requestedOrgInParams && requestedOrgInParams !== authenticatedOrgId) {
      conflictingSources.push(`route param (${requestedOrgInParams})`);
    }
    if (requestedOrgInQuery && requestedOrgInQuery !== authenticatedOrgId) {
      conflictingSources.push(`query parameter (${requestedOrgInQuery})`);
    }
    if (requestedOrgInHeader && requestedOrgInHeader !== authenticatedOrgId) {
      conflictingSources.push(`header x-tenant-id (${requestedOrgInHeader})`);
    }

    // Also check body if enabled and body is a JSON object (excluding arrays)
    if (options.enforceBodyMatch && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      const bodyOrg = req.body.organizationId || req.body.tenantId || req.body.tenant_id;
      if (bodyOrg && bodyOrg !== authenticatedOrgId) {
        conflictingSources.push(`request body (${bodyOrg})`);
      }
    }

    if (conflictingSources.length > 0) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: `Cross-tenant access prohibited. Target ${conflictingSources.join(', ')} does not match authenticated organization.`,
        error: {
          code: ErrorCode.FORBIDDEN_TENANT_ACCESS
        }
      });
      return;
    }

    // Attach verified, trusted tenant context for Aniket's DB router & Bhaskar's billing engine
    const tenantContext: TenantContext = {
      tenantId: authenticatedOrgId,
      status: 'active'
    };

    req.tenant = tenantContext;

    // Align body.tenantId to authenticatedOrgId if omitted in JSON body, ensuring
    // compatibility with downstream controllers expecting req.body.tenantId
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && !req.body.tenantId && !req.body.organizationId) {
      req.body.tenantId = authenticatedOrgId;
    }

    next();
  };
}

/**
 * Safely extracts the trusted tenant context from an authenticated request.
 * Throws if the request has not passed through tenantAccess middleware.
 */
export function getTrustedTenant(req: Request): TenantContext {
  if (!req.tenant || !req.tenant.tenantId) {
    throw new Error('Tenant context missing. Ensure tenantAccess middleware is executed before accessing tenant context.');
  }
  return req.tenant;
}

/**
 * Safely extracts the trusted tenant ID from an authenticated request.
 */
export function getTrustedTenantId(req: Request): string {
  return getTrustedTenant(req).tenantId;
}

/**
 * Standard security pipeline for billing operations:
 * 1. authenticate (validates JWT)
 * 2. tenantAccess (enforces body/param match, injects trusted req.tenant, strictly disallows cross-tenant access even for Super Admin)
 * 3. authorize (restricts to ORG_ADMIN, BILLING_MANAGER, SUPER_ADMIN)
 */
export const billingSecurityPipeline = [
  authenticate,
  tenantAccess({ enforceBodyMatch: true, allowSuperAdminCrossTenant: false }),
  authorize([UserRole.ORG_ADMIN, UserRole.BILLING_MANAGER, UserRole.SUPER_ADMIN])
];

/**
 * Standard security pipeline for analytics operations:
 * 1. authenticate (validates JWT)
 * 2. tenantAccess (enforces param/query match, injects trusted req.tenant, allows Super Admin cross-tenant read)
 * 3. authorize (restricts to ORG_ADMIN, BILLING_MANAGER, SUPER_ADMIN)
 */
export const analyticsSecurityPipeline = [
  authenticate,
  tenantAccess({ allowSuperAdminCrossTenant: true, enforceBodyMatch: false }),
  authorize([UserRole.ORG_ADMIN, UserRole.BILLING_MANAGER, UserRole.SUPER_ADMIN])
];
