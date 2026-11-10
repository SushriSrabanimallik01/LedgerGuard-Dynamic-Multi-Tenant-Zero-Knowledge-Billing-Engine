# Database Module

**Module Owner:** Aniket
**Technology Stack:** MongoDB, Mongoose

## Purpose & Scope
This directory manages MongoDB connections, tenant connection routing, and transaction session factories.

### Key Responsibilities:
- **Master Connection (`connection.ts`):**
  - Connects to the master database containing tenant metadata, user records, and public keys.
- **Dynamic Tenant Connection Router (`tenantConnection.ts`):**
  - Resolves dynamic database connections per tenant using tenant context provided by `req.tenant.tenantId`.
  - Maintains connection caching to prevent unbounded connection pools.
- **Transaction Support:**
  - Provides session wrappers for ACID multi-document transactions consumed by Bhaskar's billing engine.

> **Integration with Security:** The database router relies strictly on `req.tenant.tenantId` produced by Srabani's `tenantAccess` middleware and never consumes raw client parameters.
