# Mongoose Models

**Module Owner:** Aniket
**Technology Stack:** Mongoose

## Purpose & Scope
This directory defines the Mongoose schemas and data models for LedgerGuard.

### Key Models (Planned):
- **User (`User.ts`):**
  - Schema: `email`, `passwordHash`, `role`, `organizationId`, `isActive`, `createdAt`, `updatedAt`.
  - Implements the shared `IUser` interface from `shared/types/auth.types.ts`.
- **Organization / Tenant (`Organization.ts`):**
  - Schema: `name`, `slug`, `status`, `publicKey`, `keyId`, `billingSettings`.
  - Implements the shared `ITenant` interface from `shared/types/tenant.types.ts`.
- **Invoice (`Invoice.ts`):**
  - Consumed by Bhaskar's billing service.
- **LedgerEntry (`LedgerEntry.ts`):**
  - Append-only schema for immutable financial transactions.

> **Integration with Security:** Srabani's auth controller consumes the User model via `IUserRepository`.
