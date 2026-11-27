# Cross-Module Integration Plan

**Project:** LedgerGuard: Dynamic Multi-Tenant Zero-Knowledge Billing Engine
**Date:** 10 November 2026
**Document Status:** Foundation Integration Specification

---

## 1. Identity & Tenant Context Flow

A fundamental design goal of LedgerGuard is **Zero Client Trust** regarding organization identity. A client can never declare which tenant they represent via unauthenticated headers or query strings.

### The Token Lifecycle & Context Injection Flow:
1. **Frontend Authentication:** The React frontend collects email and password and posts to `/api/v1/auth/login`.
2. **Token Issuance:** The Auth Controller verifies credentials and returns a signed JWT containing:
   - `sub`: User ID
   - `organizationId`: The tenant/organization ID bound to the user
   - `role`: Assigned role (`org_admin`, `billing_manager`, `member`, `super_admin`)
3. **Frontend Storage:** The frontend stores the token in memory (or secure HTTP-only cookie) and attaches it as `Authorization: Bearer <token>` on all subsequent requests.
4. **Gateway Verification:** The `authenticate` middleware verifies the cryptographic signature (`jwt.verify`) and populates `req.user`.
5. **Tenant Isolation:** The `tenantAccess` middleware confirms that any URL parameters (`:orgId`) or query params match `req.user.organizationId`, and injects `req.tenant = { tenantId, status }`.
6. **Downstream Consumption:**
   - **Aniket's Database Router:** Consumes `req.tenant.tenantId` to bind queries to the tenant's isolated MongoDB database.
   - **Bhaskar's Billing Engine:** Uses `req.tenant.tenantId` to tag all invoice and ledger records without trusting any client input.

---

## 2. Protected Billing Route Integration

When Bhaskar implements billing routes, the security middleware is chained in sequence:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { tenantAccess } from '../middleware/tenantAccess';
import { UserRole } from '@shared/types/auth.types';
import * as billingController from '../controllers/billingController';

const router = Router();

// Endpoint protected by Auth -> RBAC -> Tenant Isolation
router.post(
  '/charges',
  authenticate,
  authorize([UserRole.ORG_ADMIN, UserRole.BILLING_MANAGER]),
  tenantAccess(),
  billingController.createCharge
);
```

Within `billingController.createCharge(req, res)`:
- `req.user.id`: User initiating charge.
- `req.tenant.tenantId`: Verified organization boundary.

---

## 3. Database Connection & Tenant Isolation Integration

Aniket's database module integrates directly with the tenant context:

```typescript
// Proposed dynamic connection helper (Aniket)
export async function getTenantConnection(tenantId: string) {
  // Returns dedicated Mongoose connection or isolated database handle
}

// In service logic (Bhaskar)
const tenantDb = await getTenantConnection(req.tenant.tenantId);
const InvoiceModel = tenantDb.model('Invoice', InvoiceSchema);
```

---

## 4. Redis Idempotency & Distributed Locking Integration

Purnima's Redis module guarantees duplicate-free billing operations under high concurrency:

1. **Distributed Mutex Lock:**
   - Key: `lock:tenant:${tenantId}:billing`
   - Prevents concurrent billing mutations for the same tenant from running simultaneously.
2. **Idempotency Cache:**
   - Key: `idempotency:${tenantId}:${idempotencyKey}`
   - TTL: 86400 seconds (24 hours)
   - If key exists: returns cached response immediately without touching the database.
   - If key is new: acquires lock, runs MongoDB transaction, caches response, releases lock.

---

## 5. Prerequisite Agreements Before Integration

Before merging modules into main, the team must sign off on:
1. **User Role Definitions:** Confirm enum values in `shared/types/auth.types.ts` (`super_admin`, `org_admin`, `billing_manager`, `member`).
2. **Tenant ID Property Name:** Confirm whether database schemas use `organizationId` or `tenantId` (standardized to `organizationId` in current types).
3. **Standard Response Envelope:** Confirm `{ success: true, message, data }` and `{ success: false, message, error }`.
4. **Environment Variables:** Verify all required variables in `.env.example`.
