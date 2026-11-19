import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/types/auth.types';
import { ApiResponseError, ErrorCode, HttpStatus } from '@shared/types/api.types';
import { TenantContext } from '@shared/types/tenant.types';

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
 * 3. Inspects path parameters (orgId, organizationId, tenantId), query strings,
 *    and headers (x-tenant-id). If any client-supplied identifier conflicts with the
 *    authenticated organization ID, the request is immediately rejected with HTTP 403.
 * 4. Injects a trusted `req.tenant` context for downstream database connection selection
 *    (Aniket) and billing operations (Bhaskar).
 */
export function tenantAccess(options: TenantAccessOptions = { allowSuperAdminCrossTenant: true, enforceBodyMatch: true }) {
  return (req: Request, res: Response<ApiResponseError>, next: NextFunction): void => {
    if (!req.user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required for tenant access verification',
        error: {
          code: ErrorCode.AUTH_TOKEN_MISSING
        }
      });
      return;
    }

    const authenticatedOrgId = req.user.organizationId;
    const isSuperAdmin = req.user.role === UserRole.SUPER_ADMIN;

    // Check potential client-supplied tenant identifiers
    const requestedOrgInParams = req.params.organizationId || req.params.orgId || req.params.tenantId;
    const requestedOrgInQuery = (req.query.organizationId || req.query.tenantId) as string | undefined;
    const requestedOrgInHeader = req.headers['x-tenant-id'] as string | undefined;

    // Identify candidate target tenant from request
    const requestedTarget = requestedOrgInParams || requestedOrgInQuery || requestedOrgInHeader;

    // Super Admin cross-tenant access exception if configured
    if (isSuperAdmin && options.allowSuperAdminCrossTenant) {
      const activeTenantId = requestedTarget || authenticatedOrgId;
      req.tenant = {
        tenantId: activeTenantId,
        status: 'active'
      };
      next();
      return;
    }

    // For standard users, verify that any client-supplied identifier strictly matches the token
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

    // Also check body if enabled and body is a JSON object
    if (options.enforceBodyMatch && req.body && typeof req.body === 'object') {
      const bodyOrg = req.body.organizationId || req.body.tenantId;
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
    next();
  };
}
