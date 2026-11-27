# Services Module (Business Logic)

**Module Owner:** Bhaskar
**Primary Focus:** Billing Engine, Ledger Architecture, and Idempotency

## Purpose & Scope
This directory contains the core business logic, domain services, and transaction workflows for LedgerGuard.

### Key Responsibilities:
- **Billing Engine (`billingService.ts`):**
  - Invoice calculation, charge creation, and payment state machines.
  - Subscription plan management and automated recurring charges.
- **Ledger Engine (`ledgerService.ts`):**
  - Immutable, append-only double-entry ledger bookkeeping.
  - Account balance computation and credit/debit transaction pairs.
- **Idempotency & Deduplication (`idempotencyService.ts`):**
  - Distributed idempotency key checks (coordinated with Purnima's Redis locks).
  - Preventing duplicate billing charges on network retries.
- **Transaction & Rollback Workflow (`transactionService.ts`):**
  - MongoDB multi-document ACID transaction orchestration (`session.startTransaction()`).
  - Automatic rollback on partial charge failures.
- **Usage & Analytics Engine (`analyticsService.ts`):**
  - Metred billing usage aggregation and revenue analytics.

> **Integration with Security:** Services expect verified `req.user` and `req.tenant` injected by Srabani's security middleware.
