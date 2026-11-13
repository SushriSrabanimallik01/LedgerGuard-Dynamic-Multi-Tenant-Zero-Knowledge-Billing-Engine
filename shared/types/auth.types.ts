/**
 * Authentication and Authorization Types for LedgerGuard
 * Coordinated with Aniket (Database/Frontend) and Bhaskar (Billing).
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  BILLING_MANAGER = 'billing_manager',
  MEMBER = 'member'
}

export interface IUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  sub: string;            // User ID
  email: string;
  role: UserRole;
  organizationId: string; // Tenant ID
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface LoginResponseData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string | number;
  user: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  };
}
