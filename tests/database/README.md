# Database Tests

**Module Owner:** Aniket
**Scope:** MongoDB connections, tenant database isolation, and schema validations

## Planned Test Suites:
- `connection.test.ts`: Connection pool initialization and retry handling.
- `tenantRouting.test.ts`: Confirms that queries routed for Tenant A cannot read or write to Tenant B's database collections.
- `models.test.ts`: Schema validations for User, Organization, and Invoice models.
