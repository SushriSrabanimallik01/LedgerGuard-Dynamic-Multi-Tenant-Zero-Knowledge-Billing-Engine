# API Contracts (Draft Proposal)

**Status:** PROPOSED DRAFT — Subject to Team Review and Approval
**Date:** 10 November 2026
**Coordinating Members:** Srabani (Auth), Aniket (Users/Tenants), Bhaskar (Billing/Ledger)

> **Notice:** This document contains preliminary API endpoint specifications. Names, schemas, and routes are open for team review and should not be considered finalized until approved by all module owners.

---

## 1. Global Response Standards

All responses conform to the shared envelopes defined in `shared/types/api.types.ts`:

### Standard Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "message": "Human readable error description",
  "error": {
    "code": "ERROR_CODE_IDENTIFIER",
    "details": {}
  }
}
```

---

## 2. Authentication & Identity Endpoints (Srabani)

### 2.1 User Login
- **Method:** `POST`
- **Route:** `/api/v1/auth/login`
- **Auth:** Public (Rate-limited: 10 req/15min)
- **Purpose:** Authenticates user credentials and returns JWT access and refresh tokens.
- **Request Body:**
  ```json
  {
    "email": "admin@acme.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response Data (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": "1h",
    "user": {
      "id": "usr_101",
      "email": "admin@acme.com",
      "role": "org_admin",
      "organizationId": "org_acme"
    }
  }
  ```

### 2.2 Token Refresh
- **Method:** `POST`
- **Route:** `/api/v1/auth/refresh`
- **Auth:** Public
- **Purpose:** Exchanges a valid refresh token for a newly issued access token.
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response Data (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "expiresIn": "1h"
  }
  ```

### 2.3 Current Authenticated User (`/me`)
- **Method:** `GET`
- **Route:** `/api/v1/auth/me`
- **Auth:** Required (`Bearer <access_token>`)
- **Purpose:** Retrieves identity, assigned role, and tenant boundary of caller.
- **Response Data (`200 OK`):**
  ```json
  {
    "user": {
      "id": "usr_101",
      "email": "admin@acme.com",
      "role": "org_admin",
      "organizationId": "org_acme"
    }
  }
  ```

---

## 3. Organization & User Management Endpoints (Aniket)

### 3.1 List Organization Members
- **Method:** `GET`
- **Route:** `/api/v1/organizations/:orgId/members`
- **Auth:** Required (Roles: `org_admin`, `super_admin`) + `tenantAccess`
- **Purpose:** Lists all members within the authenticated organization.
- **Response Data (`200 OK`):**
  ```json
  {
    "members": [
      {
        "id": "usr_101",
        "email": "admin@acme.com",
        "role": "org_admin",
        "isActive": true
      }
    ]
  }
  ```

---

## 4. Billing Engine Endpoints (Bhaskar)

### 4.1 Create Financial Charge
- **Method:** `POST`
- **Route:** `/api/v1/billing/charges`
- **Auth:** Required (Roles: `org_admin`, `billing_manager`) + `tenantAccess` + RSA Signature (Stage 3)
- **Headers:** `x-idempotency-key: <uuid>`
- **Purpose:** Processes a financial charge against an organization account.
- **Request Body:**
  ```json
  {
    "amount": 4999,
    "currency": "USD",
    "description": "Monthly Enterprise Subscription",
    "customerId": "cust_acme_1"
  }
  ```
- **Response Data (`201 Created`):**
  ```json
  {
    "chargeId": "chg_99182",
    "status": "succeeded",
    "amount": 4999,
    "currency": "USD",
    "ledgerEntryId": "led_3381",
    "createdAt": "2026-11-10T12:00:00.000Z"
  }
  ```

### 4.2 List Invoices
- **Method:** `GET`
- **Route:** `/api/v1/billing/invoices`
- **Auth:** Required (Roles: `org_admin`, `billing_manager`, `member`) + `tenantAccess`
- **Purpose:** Retrieves invoice records for the authenticated tenant.
- **Query Params:** `?page=1&limit=20&status=paid`
- **Response Data (`200 OK`):**
  ```json
  {
    "invoices": [
      {
        "id": "inv_101",
        "invoiceNumber": "INV-2026-001",
        "amount": 4999,
        "status": "paid",
        "dueDate": "2026-11-30"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1 }
  }
  ```

---

## 5. Ledger Endpoints (Bhaskar)

### 5.1 Query Ledger Entries
- **Method:** `GET`
- **Route:** `/api/v1/ledger/entries`
- **Auth:** Required (Roles: `org_admin`, `billing_manager`) + `tenantAccess`
- **Purpose:** Retrieves immutable double-entry ledger entries for auditing.
- **Response Data (`200 OK`):**
  ```json
  {
    "entries": [
      {
        "id": "led_3381",
        "transactionId": "tx_551",
        "debitAccount": "accounts_receivable",
        "creditAccount": "subscription_revenue",
        "amount": 4999,
        "currency": "USD",
        "timestamp": "2026-11-10T12:00:00.000Z"
      }
    ]
  }
  ```

### 5.2 Account Balance
- **Method:** `GET`
- **Route:** `/api/v1/ledger/balance`
- **Auth:** Required (Roles: `org_admin`, `billing_manager`) + `tenantAccess`
- **Purpose:** Computes aggregate balance for organization ledger accounts.
- **Response Data (`200 OK`):**
  ```json
  {
    "organizationId": "org_acme",
    "totalCredits": 4999,
    "totalDebits": 4999,
    "netBalance": 0,
    "asOf": "2026-11-10T12:00:00.000Z"
  }
  ```

---

## 6. Usage & Analytics Endpoints (Bhaskar)

### 6.1 Usage Metrics
- **Method:** `GET`
- **Route:** `/api/v1/analytics/usage`
- **Auth:** Required (Roles: `org_admin`, `billing_manager`, `member`) + `tenantAccess`
- **Purpose:** Supplies metered usage data for Chart.js rendering on frontend.
- **Response Data (`200 OK`):**
  ```json
  {
    "period": "2026-11",
    "metrics": [
      { "date": "2026-11-01", "apiCalls": 14200, "computeUnits": 350 },
      { "date": "2026-11-02", "apiCalls": 18450, "computeUnits": 420 }
    ]
  }
  ```
