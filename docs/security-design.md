# LedgerGuard — Security Design and API Gateway Specification

**Author:** Srabani (API Gateway and Security)
**Project:** LedgerGuard: Dynamic Multi-Tenant Zero-Knowledge Billing Engine
**Milestone:** 26 November Mid-Evaluation Deliverables & Stage 3 Roadmap
**Mid-Evaluation Status:** Core Security Foundation Complete & Verified (35/35 Automated Tests Passing)

---

## Milestone Breakdown

| Component | Stage | Status for 26 Nov Mid-Evaluation |
|---|---|---|
| **JWT Authentication Engine** | Stage 1 | **Included (Active Deliverable)** |
| **Password Security & Complexity** | Stage 1 | **Included (Active Deliverable)** |
| **Role-Based Access Control (RBAC)** | Stage 2 | **Included (Active Deliverable)** |
| **Tenant Isolation & Anti-Spoofing** | Stage 2 | **Included (Active Deliverable)** |
| **Rate Limiting & Hardening** | Stage 4 | **Included (Active Deliverable)** |
| **Security Unit & Integration Tests** | Stage 5 | **Included (35 Tests Active)** |
| **RSA Request Signature Verification** | Stage 3 | **Deferred (Stage 3 Roadmap Specification)** |

---

## 1. Executive Summary & Architecture Overview

LedgerGuard operates as a multi-tenant billing engine where multiple organizations execute sensitive financial and ledger operations. The security module implements defense-in-depth across five complementary layers:

```
[ Client Request ]
       │
       ▼
1. Rate Limiting (`rateLimiter.ts`) ───> Rejects volumetric abuse & brute force (HTTP 429)
       │
       ▼
2. Input Validation (`authValidator.ts`) ───> Enforces strict Zod schema constraints (HTTP 400)
       │
       ▼
3. Digital Signature Verification (`verifySignature.ts`) ───> Enforces RSA-PSS integrity & anti-replay (HTTP 401)
       │
       ▼
4. Identity Authentication (`authenticate.ts`) ───> Verifies cryptographically signed JWT Bearer token (HTTP 401)
       │
       ▼
5. Authorization & Isolation (`authorize.ts` & `tenantAccess.ts`) ───> Validates RBAC & enforces tenant boundary (HTTP 403)
       │
       ▼
[ Protected Billing Engine (Bhaskar) / Database Router (Aniket) ]
```

---

## 2. Authentication Protocol (Stage 1)

### 2.1 JSON Web Token (JWT) Specifications
- **Algorithm:** HMAC SHA-256 (`HS256`)
- **Key Separation:** Separate secrets for access tokens (`JWT_SECRET`) and refresh tokens (`JWT_REFRESH_SECRET`) to prevent token type confusion.
- **Audience & Issuer:** Explicitly validated on every request (`iss: 'ledgerguard-auth'`, `aud: 'ledgerguard-api'`).
- **Access Token Expiration:** Default 1 hour (`1h`).
- **Refresh Token Expiration:** Default 7 days (`7d`).
- **Required Claims:**
  - `sub`: User ID
  - `email`: User email address
  - `role`: Role (`super_admin`, `org_admin`, `billing_manager`, `member`)
  - `organizationId`: Authenticated Tenant/Organization identifier

### 2.2 Password Security
- **Algorithm:** `bcrypt` with minimum 12 salt rounds (`BCRYPT_SALT_ROUNDS=12`).
- **Timing Attack Resistance:** Constant-time comparison ensures identical execution times even when user lookup fails.
- **Complexity Enforcement:** Minimum 8 characters, requiring uppercase, lowercase, numbers, and special characters.

---

## 3. Authorization & Tenant Isolation (Stage 2)

### 3.1 Role-Based Access Control (RBAC)
Role hierarchy and permissions:
- `super_admin`: Platform-wide administrative authority, cross-tenant auditing.
- `org_admin`: Full administrative control over the organization, billing, and member management.
- `billing_manager`: Specialized role authorized to create charges, view invoices, and manage payment methods.
- `member`: Read-only access to basic organization resources.

### 3.2 Tenant Isolation Principles
1. **Zero Client Trust:** The client can never dictate their tenant context. The active tenant is extracted directly from the validated JWT payload (`req.user.organizationId`).
2. **Multi-Vector Conflict Detection:** The `tenantAccess` middleware inspects:
   - Route path parameters (`:orgId`, `:organizationId`, `:tenantId`)
   - Query string parameters (`?organizationId=...`)
   - HTTP headers (`x-tenant-id`)
   - Request body (`req.body.organizationId`)
   If any client input conflicts with the JWT tenant identifier, the request is blocked with HTTP 403 `FORBIDDEN_TENANT_ACCESS`.
3. **Injected Context:** Populates `req.tenant = { tenantId, status }` for safe consumption by Aniket's database routing and Bhaskar's billing queries.

---

## 4. RSA Request Verification Protocol (Stage 3 Roadmap — Deferred Post Mid-Evaluation)

> **Note on Project Timeline:** This section details the complete protocol specification for RSA-PSS request verification. Per the project milestone plan, implementation and billing-route integration for this stage are scheduled for Stage 3 (post mid-evaluation), following coordination with Bhaskar on protected billing mutation endpoints.

To ensure cryptographic non-repudiation, payload integrity, and replay prevention, sensitive billing endpoints will require RSA digital signatures in Stage 3.

### 4.1 Cryptographic Parameters
- **Algorithm:** `RSA-PSS` with `SHA-256` digest
- **Salt Length:** `crypto.constants.RSA_PSS_SALTLEN_DIGEST` (32 bytes)
- **Key Format:** PEM format (SPKI for Public Key, PKCS#8 for Private Key)
- **Key Length:** 2048-bit RSA

### 4.2 Required HTTP Headers
| Header Name | Type | Description |
|---|---|---|
| `x-key-id` | String | Organization public key identifier registered in LedgerGuard |
| `x-timestamp` | String / Integer | Client Unix timestamp (seconds or milliseconds) |
| `x-nonce` | String | Unique random string per request (UUID or high-entropy string) |
| `x-signature` | String | Base64-encoded RSA-PSS digital signature |

### 4.3 Canonical Payload Formulation
The client and server construct the canonical string using exact newline delimiters (`\n`):

```
METHOD
PATH
TIMESTAMP
NONCE
BODY_HASH
```

Where:
- `METHOD`: Uppercase HTTP verb (e.g. `POST`, `PUT`, `DELETE`).
- `PATH`: Normalized URL path without query string (e.g. `/api/v1/billing/charges`).
- `TIMESTAMP`: The exact value sent in the `x-timestamp` header.
- `NONCE`: The exact value sent in the `x-nonce` header.
- `BODY_HASH`: Hex-encoded SHA-256 hash of the raw JSON request body (`crypto.createHash('sha256').update(body).digest('hex')`). Empty string if no body.

### 4.4 Replay Attack Mitigation
1. **Timestamp Window:** Requests older than 300 seconds (5 minutes) or drifting more than 300 seconds into the future are rejected (`SIGNATURE_TIMESTAMP_EXPIRED`).
2. **Nonce Store:** Nonces are recorded and rejected if reused within the 300-second window (`SIGNATURE_NONCE_REPLAYED`).
   - Development: Handled by `InMemoryNonceStore`.
   - Production: Backed by Redis distributed cache (Purnima).

---

## 5. API Hardening & Defensive Controls (Stage 4)

### 5.1 Request Validation
All authentication inputs are validated via strict Zod schemas before reaching business logic. Malformed inputs immediately fail with structured field-level errors (HTTP 400 `VALIDATION_ERROR`).

### 5.2 Rate Limiting
- **Global Limiter:** 100 requests per 15 minutes per IP.
- **Auth Endpoint Limiter:** 10 attempts per 15 minutes on `/api/v1/auth/login` to thwart password guessing and credential stuffing.

### 5.3 Error Sanitization
- Never leak stack traces or internal implementation details.
- Always use the uniform team error contract:
  ```json
  {
    "success": false,
    "message": "Human-readable description",
    "error": {
      "code": "MACHINE_READABLE_CODE",
      "details": {}
    }
  }
  ```

---

## 6. Team Integration Guidelines

### 6.1 For Aniket (Frontend & Database)
- **Token Handling:** The frontend should store the `accessToken` in memory and pass it in the `Authorization: Bearer <token>` header for all protected API calls.
- **User Model Connection:** Once Mongoose is initialized, inject the Mongoose model into `setUserRepository(mongooseUserRepo)`. The controller expects the simple `IUserRepository` contract (`findByEmail`, `findById`, `create`).
- **Public Key Storage:** Store the organization's public key in the `Organization` Mongoose schema (`publicKey: String`, `keyId: String`).

### 6.2 For Bhaskar (Billing Engine)
To protect billing routes, chain the security middleware in order:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { tenantAccess } from '../middleware/tenantAccess';
import { verifySignature } from '../middleware/verifySignature';
import { UserRole } from '@shared/types/auth.types';

const router = Router();

// Highly sensitive mutation: Requires Auth + Billing Role + Tenant Check + RSA Signature
router.post(
  '/charges',
  authenticate,
  authorize([UserRole.ORG_ADMIN, UserRole.BILLING_MANAGER]),
  tenantAccess(),
  verifySignature(),
  billingController.createCharge
);
```

Downstream handlers can immediately access:
- `req.user.id`: User initiating action.
- `req.tenant.tenantId`: Verified organization boundary (guaranteed to prevent cross-tenant operations).

### 6.3 For Purnima (Redis & Infrastructure)
- **Redis Nonce Store:** In production, provide a Redis-backed `INonceStore` using `SET key EX 300 NX` to guarantee distributed anti-replay protection across multiple container instances.
- **Environment Variables:** Ensure `.env` includes:
  `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BCRYPT_SALT_ROUNDS`, `RSA_TIMESTAMP_TOLERANCE_SECONDS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`.

---

## 7. Security Implementation Roadmap & Sequential Milestones

This module follows a strictly phased, incremental implementation schedule to ensure each security layer is isolated, understandable, and test-verified:

### Milestone 1 (Day 1 — 10 Nov 2026): Project Foundation & Architecture
- Monorepo folder scaffolding for all four teammates.
- Visible Git directory structure with informative READMEs.
- System architecture, team ownership, API contracts draft, and integration plan documentation.
- Base TypeScript and environment configuration templates.

### Milestone 2 (Stage 1 — Authentication Foundation):
- Password hashing with salted `bcryptjs` and constant-time comparisons.
- Password complexity validation.
- JWT access token generation and strict cryptographic verification (`HS256`).
- Refresh token issuance and type-separation safeguards.
- Authentication middleware extracting Bearer tokens and attaching `req.user`.
- Test suite: `tests/security/jwt.test.ts` (18 tests).

### Milestone 3 (Stage 2 — Authorization & Tenant Isolation):
- Role-based authorization middleware (`authorize.ts`) enforcing role privileges (`super_admin`, `org_admin`, `billing_manager`, `member`).
- Tenant isolation guard (`tenantAccess.ts`) extracting tenant context strictly from validated tokens.
- Cross-tenant spoofing detection across URL parameters, query parameters, HTTP headers, and request body.
- Test suites: `tests/security/authorization.test.ts` (10 tests) and `tests/security/tenantAccess.test.ts` (7 tests).

### Milestone 4 (Stage 4 — API Hardening & Auth Routes):
- Zod request body validation schemas (`authValidator.ts`).
- Rate limiting middleware (`rateLimiter.ts`) mitigating volumetric abuse and brute-force login attacks.
- Pluggable user repository interface (`IUserRepository`) for clean database handover.
- Full HTTP auth endpoints: `/login`, `/refresh`, `/me`.
- Test suite: `tests/security/authRoutes.test.ts`.

### Milestone 5 (26 November 2026 Mid-Evaluation Demonstration):
- Formal demonstration of the core security gateway: JWT authentication, RBAC, tenant isolation, rate limiting, and 35 passing automated tests.

### Milestone 6 (Stage 3 — Post Mid-Evaluation: RSA Request Verification):
- RSA-PSS with SHA-256 digital signature verification engine (`rsa.ts`).
- Canonical payload formulation (`METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_HASH`).
- 300-second timestamp tolerance and replay mitigation.
- Redis-backed distributed nonce store (integrated with Purnima).
- Protected billing mutation route enforcement (integrated with Bhaskar).
- Test suite: `tests/security/rsa.test.ts` (13 tests).
