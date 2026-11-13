/**
 * Shared API Response Types for LedgerGuard
 * Following common team contract specified in Section 8.
 */

export interface ApiResponseSuccess<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message?: string;
  details?: unknown;
}

export interface ApiResponseError {
  success: false;
  message: string;
  error: ApiErrorDetail;
}

export type ApiResponse<T = unknown> = ApiResponseSuccess<T> | ApiResponseError;

/**
 * Standard HTTP Status Codes
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500
}

/**
 * Common Security and Application Error Codes
 */
export enum ErrorCode {
  // Authentication errors (401)
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_CREDENTIALS_INVALID = 'AUTH_CREDENTIALS_INVALID',

  // Authorization errors (403)
  FORBIDDEN_INSUFFICIENT_ROLE = 'FORBIDDEN_INSUFFICIENT_ROLE',
  FORBIDDEN_TENANT_ACCESS = 'FORBIDDEN_TENANT_ACCESS',

  // Signature verification errors (401 / 403)
  SIGNATURE_HEADER_MISSING = 'SIGNATURE_HEADER_MISSING',
  SIGNATURE_TIMESTAMP_EXPIRED = 'SIGNATURE_TIMESTAMP_EXPIRED',
  SIGNATURE_NONCE_REPLAYED = 'SIGNATURE_NONCE_REPLAYED',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  SIGNATURE_KEY_NOT_FOUND = 'SIGNATURE_KEY_NOT_FOUND',

  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}
