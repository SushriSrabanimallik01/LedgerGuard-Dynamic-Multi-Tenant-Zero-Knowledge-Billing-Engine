# Frontend Module

**Module Owner:** Aniket
**Technology Stack:** React.js, TypeScript, Tailwind CSS, Chart.js

## Purpose & Scope
This directory contains the client-side single-page application (SPA) for LedgerGuard.

### Key Responsibilities:
- **Authentication & Onboarding:** Login, registration, password management, and JWT session handling.
- **Tenant Context & Navigation:** Organization switcher, tenant dashboard, and role-aware navigation.
- **Billing & Invoices:** Invoice views, billing management, payment method registration, and usage dashboards.
- **Analytics Visualization:** Interactive charts displaying tenant billing trends, usage metrics, and ledger balances.
- **API Services:** Axios/Fetch API client configured with Bearer token authentication and standard error handling.

### Directory Structure (Planned):
```
frontend/
├── src/
│   ├── assets/         # Static assets (images, icons)
│   ├── components/     # Reusable UI components (buttons, modals, tables)
│   ├── context/        # React context (AuthContext, TenantContext)
│   ├── hooks/          # Custom hooks (useAuth, useBilling, useTenant)
│   ├── pages/          # Top-level route pages (Login, Dashboard, Invoices)
│   ├── services/       # API integration services
│   ├── types/          # Frontend-specific TypeScript interfaces
│   └── utils/          # Formatting and utility functions
├── public/
├── package.json
└── tsconfig.json
```
