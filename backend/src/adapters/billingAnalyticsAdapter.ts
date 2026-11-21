import { Router, RequestHandler } from 'express';
import {
  billingSecurityPipeline,
  analyticsSecurityPipeline,
  getTrustedTenantId,
  getTrustedTenant
} from '../middleware/tenantAccess';

/**
 * Billing & Analytics Security Integration Adapter
 *
 * Provides a clean, documented architectural bridge between LedgerGuard's
 * API Gateway security enforcement (Srabani) and the downstream domain logic
 * for billing and analytics (Bhaskar).
 *
 * Architectural Guarantees:
 * 1. Zero-Trust Identity Origin:
 *    Tenant identity is strictly established from the cryptographically verified JWT
 *    signature (`req.user.organizationId`). Any client-supplied tenant identifier
 *    (in URL route parameters, JSON request bodies, query strings, or custom headers)
 *    is cross-referenced. If any mismatch occurs, the request is halted with HTTP 403.
 *
 * 2. Downstream Compatibility & Safety:
 *    Downstream handlers do not need to implement defensive authentication checks.
 *    They can safely retrieve the authenticated tenant identifier via `getTrustedTenantId(req)`
 *    or `req.tenant.tenantId`. Furthermore, if `req.body` is present without an explicit `tenantId`,
 *    the middleware aligns `req.body.tenantId` with the trusted tenant ID to ensure full
 *    compatibility with legacy controller contracts.
 *
 * 3. Role-Based Access Enforcement (RBAC):
 *    Billing execution and analytics retrieval are restricted to ORG_ADMIN, BILLING_MANAGER,
 *    and SUPER_ADMIN roles, preventing unauthorized access by standard tenant members.
 */

/**
 * Creates a secured Express Router for Billing operations (POST /pay).
 *
 * @param paymentHandler - Controller handling payment processing (e.g., Bhaskar's handlePayment)
 * @returns Express Router ready to be mounted at /api/v1/billing or /api
 */
export function createSecureBillingRouter(paymentHandler: RequestHandler): Router {
  const router = Router();
  router.post('/pay', ...billingSecurityPipeline, paymentHandler);
  return router;
}

/**
 * Creates a secured Express Router for Analytics operations.
 * Supports both path-parameter queries (GET /:tenantId) and parameterless
 * queries (GET /), resolving tenant identity from the verified tenant context.
 *
 * @param analyticsHandler - Controller handling analytics retrieval (e.g., Bhaskar's getUsageAnalytics)
 * @returns Express Router ready to be mounted at /api/v1/analytics or /api/analytics
 */
export function createSecureAnalyticsRouter(analyticsHandler: RequestHandler): Router {
  const router = Router();
  // Primary route matching Bhaskar's GET /:tenantId with cross-tenant check
  router.get('/:tenantId', ...analyticsSecurityPipeline, analyticsHandler);
  // Parameterless route resolving directly from verified tenant context
  router.get('/', ...analyticsSecurityPipeline, (req, res, next) => {
    if (!req.params.tenantId && req.tenant?.tenantId) {
      req.params.tenantId = req.tenant.tenantId;
    }
    analyticsHandler(req, res, next);
  });
  return router;
}

export {
  billingSecurityPipeline,
  analyticsSecurityPipeline,
  getTrustedTenantId,
  getTrustedTenant
};
