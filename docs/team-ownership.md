# Team Ownership and Responsibility Matrix

**Project:** LedgerGuard: Dynamic Multi-Tenant Zero-Knowledge Billing Engine
**Date:** 10 November 2026
**Document Status:** Foundation Agreement

---

## 1. Primary Member Responsibilities & File Ownership

### Aniket — Frontend & Database
- **Primary Modules:**
  - React.js frontend application (`frontend/`)
  - MongoDB connection & dynamic tenant router (`backend/src/database/`)
  - Mongoose models (`backend/src/models/`)
  - Database unit & integration tests (`tests/database/`)
- **Key Responsibilities:**
  - Client-side dashboard, invoice explorer, analytics charts.
  - Organization database schemas (`User.ts`, `Organization.ts`, `Invoice.ts`, `LedgerEntry.ts`).
  - Dynamic database connection management ensuring tenant data separation.

---

### Srabani — API Gateway and Security (My Module)
- **Primary Modules:**
  - JWT utilities & password security (`backend/src/security/jwt.ts`, `password.ts`, `securityConfig.ts`)
  - Security middleware (`backend/src/middleware/authenticate.ts`, `authorize.ts`, `tenantAccess.ts`, `rateLimiter.ts`)
  - Request validation schemas (`backend/src/validators/authValidator.ts`)
  - RSA request signature verification (`backend/src/security/rsa.ts`, `backend/src/middleware/verifySignature.ts` — Stage 3)
  - Security unit & integration tests (`tests/security/`)
  - Security architecture documentation (`docs/security-design.md`)
- **Key Responsibilities:**
  - Cryptographic token issue, verification, and rotation.
  - Role-based authorization (RBAC) and strict tenant boundary isolation.
  - Volumetric rate limiting and input validation.
  - Digital signature verification on billing endpoints (Stage 3).

---

### Bhaskar — Billing Engine & Backend Business Logic
- **Primary Modules:**
  - Domain business logic & services (`backend/src/services/`)
  - Billing & ledger route controllers (`backend/src/controllers/`)
  - Billing & ledger routes (`backend/src/routes/`)
  - Billing & transaction unit/integration tests (`tests/billing/`)
- **Key Responsibilities:**
  - Subscription management, charge calculations, invoice generation.
  - Immutable double-entry ledger bookkeeping.
  - Idempotency workflow preventing duplicate transactions.
  - ACID transaction execution and automated rollback.
  - Usage and revenue analytics calculations.

---

### Purnima — Redis & Infrastructure
- **Primary Modules:**
  - Redis configuration, caching, and distributed locks (`backend/src/redis/`)
  - Containerization and orchestration (`infrastructure/`, `docker-compose.yml`)
  - Infrastructure unit/integration tests (`tests/infrastructure/`)
- **Key Responsibilities:**
  - Redis client configuration and connection resilience.
  - Distributed mutex locking for concurrent charge safety.
  - Docker multi-container environment (Node.js, React, MongoDB replica set, Redis).
  - Cloud deployment configuration (Render / AWS) and monitoring.

---

## 2. Directory Ownership Map

| Directory | Primary Owner | Module Purpose |
|---|---|---|
| `frontend/` | **Aniket** | React SPA, UI components, pages, client API service |
| `backend/src/security/` | **Srabani** | JWT, bcrypt, RSA cryptography, security config |
| `backend/src/middleware/` | **Srabani** | Auth, RBAC, tenant isolation, rate limit, RSA verify |
| `backend/src/validators/` | **Srabani** | Zod input validation schemas |
| `backend/src/database/` | **Aniket** | MongoDB master & dynamic tenant connection router |
| `backend/src/models/` | **Aniket** | Mongoose schemas (User, Organization, Invoice, Ledger) |
| `backend/src/services/` | **Bhaskar** | Billing, ledger, idempotency, transaction services |
| `backend/src/controllers/` | **Bhaskar / Srabani** | HTTP request handlers (Auth: Srabani; Billing: Bhaskar) |
| `backend/src/routes/` | **Bhaskar / Srabani** | Express routers (Auth: Srabani; Billing: Bhaskar) |
| `backend/src/redis/` | **Purnima** | Redis client, distributed locking, cache, nonce store |
| `infrastructure/` | **Purnima** | Dockerfiles, docker-compose, deployment manifests |
| `tests/security/` | **Srabani** | Security module tests |
| `tests/billing/` | **Bhaskar** | Billing and ledger tests |
| `tests/database/` | **Aniket** | Tenant database isolation tests |
| `tests/infrastructure/` | **Purnima** | Redis locking and container tests |
| `shared/types/` | **Shared (All)** | Cross-module TypeScript interfaces and contracts |
| `docs/` | **Shared (All)** | Project architecture, security, and integration docs |

---

## 3. Shared Files & Coordination Rules

The following files require explicit discussion before making changes:

### 1. `backend/src/app.ts` (Express Application Wiring)
- **Coordinating:** **Srabani + Bhaskar + Purnima**
- **Rule:** Srabani sets up base security middleware (CORS, body parser, rate limiting, auth routes). Bhaskar mounts `/api/v1/billing` and `/api/v1/ledger`. Purnima adds logging/monitoring middleware. Never overwrite another member's route registrations.

### 2. `backend/src/server.ts` (HTTP Server Listener)
- **Coordinating:** **Srabani + Purnima**
- **Rule:** Minimal server start. Purnima handles Docker port binding and graceful shutdown handlers (`SIGTERM`, `SIGINT`).

### 3. `shared/types/auth.types.ts` & `tenant.types.ts`
- **Coordinating:** **Srabani + Aniket**
- **Rule:** Shared interfaces (`IUser`, `ITenant`, `UserRole`, `JWTPayload`) must match Aniket's Mongoose models and frontend interfaces.

### 4. `shared/types/api.types.ts` (API Contract)
- **Coordinating:** **All Members**
- **Rule:** All backend responses must strictly follow the `{ success, message, data }` and `{ success, message, error }` envelopes.

### 5. `package.json` & `package-lock.json`
- **Coordinating:** **All Members**
- **Rule:** Do not install ad-hoc packages without team agreement. Check existing dependencies before adding new ones.

### 6. `.env.example`
- **Coordinating:** **All Members**
- **Rule:** Whenever a member introduces a new environment variable, it must be documented in `.env.example`. Real `.env` files must never be committed.
