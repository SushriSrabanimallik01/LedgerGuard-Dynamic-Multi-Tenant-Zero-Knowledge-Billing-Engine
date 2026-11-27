# LedgerGuard: Billing & Ledger Flow Documentation

## Overview
This document outlines the backend architecture for the Billing and Ledger modules, built by Bhaskar.

## The Billing Flow
1. **API Request:** The frontend sends a `POST` request to `/api/pay` with `tenantId`, `amount`, and `transactionId`.
2. **Validation:** The `billingValidator` checks if the amount is a positive number and all fields are present.
3. **Idempotency Check:** The `idempotencyService` queries MongoDB to see if the `transactionId` already exists. If it does, it returns the existing receipt immediately to prevent double-charging.
4. **Payment Processing:** If the transaction is unique, the `billingService` creates a new `BillingRecord` in MongoDB with a status of "paid".
5. **Ledger Entry:** Immediately after a successful payment, the `ledgerService` creates an immutable `LedgerEntry` (type: CREDIT) to record the movement of money permanently.
6. **Response:** The API returns a `200 OK` with the billing data.

## Data Models
### BillingRecord
- `tenantId` (String): The company making the payment.
- `amount` (Number): The transaction amount.
- `status` (String): pending, paid, or failed.
- `transactionId` (String): A unique ID used for idempotency.

### LedgerEntry
- `tenantId` (String): The company.
- `amount` (Number): The amount moved.
- `type` (String): CREDIT or DEBIT.
- `description` (String): Details of the transaction.

## Performance & Testing
- **Automated Testing:** The `billing.test.ts` uses Jest and Mocking to ensure the idempotency and payment math work flawlessly.
- **Load Testing:** The `load-test.js` uses k6 to simulate 50 concurrent users, proving the server handles 2,500+ requests without dropping a single packet.