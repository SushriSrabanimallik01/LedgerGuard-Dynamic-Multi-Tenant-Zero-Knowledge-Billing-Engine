# LedgerGuard-Dynamic-Multi-Tenant-Zero-Knowledge-Billing-Engine
 A secure multi-tenant billing engine built with the MERN stack, featuring isolated tenant data, JWT-based authentication, Redis distributed locks, and MongoDB ACID transactions to ensure reliable, duplicate-free billing and transaction integrity.

---

## 1. Project Overview

LedgerGuard is an enterprise-grade multi-tenant SaaS billing system engineered to guarantee:
- **Strict Tenant Isolation:** Complete segregation between organization accounts.
- **JWT Authentication & RBAC:** Cryptographic identity tokens and role-based authorization.
- **RSA Request Signature Verification:** Digital signatures guaranteeing request authenticity and non-repudiation (Stage 3).
- **Double-Entry Ledger:** Immutable accounting trail ensuring debit/credit consistency.
- **Duplicate-Free Billing:** Redis-backed idempotency preventing duplicate charges on network retries.
- **ACID Transactions & Rollback:** MongoDB multi-document transactions ensuring zero orphaned records.
- **Analytics Visualization:** Interactive dashboards presenting usage and revenue trends.

---

## 2. Technology Stack

- **Frontend:** React.js, TypeScript, Tailwind CSS, Chart.js
- **Backend:** Node.js, Express.js, TypeScript, JWT (`jsonwebtoken`), `bcryptjs`, `zod`
- **Database:** MongoDB, Mongoose (Master & Dynamic Tenant routing)
- **Caching & Locking:** Redis, `ioredis`
- **Testing:** Jest, Supertest, `ts-jest`
- **Infrastructure:** Docker, Docker Compose, Render / AWS

---

## 3. Repository Architecture

```text
LedgerGuard/
├── frontend/               # React client SPA (Aniket)
├── backend/
│   └── src/
│       ├── config/         # Centralized runtime configuration
│       ├── controllers/    # API request handlers (Auth, Billing)
│       ├── database/       # MongoDB connection & dynamic tenant router (Aniket)
│       ├── middleware/     # Auth, RBAC, tenant isolation, rate limiting (Srabani)
│       ├── models/         # Mongoose schemas: User, Org, Invoice, Ledger (Aniket)
│       ├── redis/          # Redis client, distributed locks, cache (Purnima)
│       ├── routes/         # Express API routers
│       ├── security/       # JWT, bcrypt, RSA cryptography (Srabani)
│       ├── services/       # Domain business logic & ledger engine (Bhaskar)
│       ├── types/          # Express type augmentations
│       ├── validators/     # Zod input validation schemas (Srabani)
│       ├── app.ts          # Express application initialization
│       └── server.ts       # Server runtime entry point
├── shared/
│   └── types/              # Cross-module shared TypeScript interfaces
├── tests/
│   ├── billing/            # Billing engine & transaction tests (Bhaskar)
│   ├── database/           # Tenant DB isolation tests (Aniket)
│   ├── infrastructure/     # Redis locking & container tests (Purnima)
│   └── security/           # Security & authentication tests (Srabani)
├── infrastructure/         # Docker, docker-compose & deployment (Purnima)
├── docs/                   # Architectural & integration documentation
├── .env.example            # Environment configuration template
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Team Responsibilities

- **Aniket — Frontend, Database & Integration**
  - React frontend, login & dashboard views, Chart.js visualizations.
  - MongoDB connection pooling, Mongoose models, dynamic tenant database routing.
- **Srabani — API Gateway & Security (Current Branch)**
  - JWT token generation & verification, password hashing, role-based access control (RBAC).
  - Tenant-level access middleware, rate limiting, Zod validation, RSA verification (Stage 3).
- **Bhaskar — Billing Engine & Backend Business Logic**
  - Billing APIs, double-entry ledger engine, idempotency workflow, MongoDB ACID transactions.
- **Purnima — Redis & Infrastructure**
  - Redis configuration, distributed mutex locking, caching, Docker & cloud deployment.

---

## 5. Development Setup Status

- **Architecture:** Monorepo folder structure initialized and ready for all 4 team members.
- **Security Module Foundation:** Implemented, verified, and test-covered (35/35 passing tests for Mid-Evaluation scope).
- **Database & Billing Modules:** Scaffolding created; pending Day 2+ implementation by respective owners.
- **Infrastructure:** Docker and deployment templates planned in `infrastructure/`.

---

## 6. Project Documentation Links

- [System Architecture Specification](docs/architecture.md)
- [Team Ownership & Responsibility Matrix](docs/team-ownership.md)
- [Draft API Contracts Proposal](docs/api-contracts-draft.md)
- [Cross-Module Integration Plan](docs/integration-plan.md)
- [Security Module Design & Roadmap](docs/security-design.md)
