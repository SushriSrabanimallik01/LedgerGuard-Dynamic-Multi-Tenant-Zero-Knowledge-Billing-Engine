/**
 * Tenant and Multi-Tenancy Types for LedgerGuard
 * Coordinated with Aniket (Database/Dynamic Connections) and Bhaskar (Billing).
 */

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  publicKey?: string; // RSA 2048-bit PEM Public Key for RSA-PSS verification
  keyId?: string;     // Active Key ID for key rotation
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantContext {
  tenantId: string;
  tenantName?: string;
  status: TenantStatus;
}

/**
 * Standard Security and Multi-Tenant Request Headers
 */
export const SecurityHeaders = {
  AUTHORIZATION: 'authorization',
  TENANT_ID: 'x-tenant-id',
  KEY_ID: 'x-key-id',
  TIMESTAMP: 'x-timestamp',
  NONCE: 'x-nonce',
  SIGNATURE: 'x-signature'
} as const;
