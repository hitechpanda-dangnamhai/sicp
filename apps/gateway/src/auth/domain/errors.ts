/**
 * apps/gateway/src/auth/domain/errors.ts
 *
 * Domain-level error classes for auth flow.
 *
 * Pattern: domain throws semantic errors; controller catches + maps to HTTP
 * exceptions with appropriate code + log shape. Keeps use-cases / repos
 * agnostic of HTTP layer per Clean Architecture.
 *
 * Error code values match `03_API_CONTRACTS §4` standard error table.
 *
 * S-03 T02 emit.
 */

export class AuthDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly logExtras?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthDomainError';
  }
}

/**
 * User not found OR password mismatch. SAME error to caller for both cases
 * (prevent user enumeration per OWASP). Distinct `logExtras.reason` for ops.
 */
export class InvalidCredentialsError extends AuthDomainError {
  constructor(reason: 'user_not_found' | 'password_mismatch', emailHash?: string) {
    super('UNAUTHORIZED', 'Invalid credentials', { reason, email_hash: emailHash });
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * JWT verify failed — expired, malformed, or signature mismatch.
 * `reason` distinguishes for ops; HTTP response stays generic 401.
 */
export class TokenInvalidError extends AuthDomainError {
  constructor(
    reason:
      | 'missing_cookie'
      | 'jwt_malformed'
      | 'jwt_expired'
      | 'jwt_signature_invalid'
      | 'session_revoked'
      | 'session_not_found',
  ) {
    super('UNAUTHORIZED', 'Token invalid or expired', { reason });
    this.name = 'TokenInvalidError';
  }
}

/**
 * Refresh token validation failed — revoked (rotating per C-06), expired,
 * or unknown hash. HTTP 401; ops log distinguishes reason.
 */
export class RefreshRejectedError extends AuthDomainError {
  constructor(reason: 'refresh_missing' | 'refresh_revoked' | 'refresh_expired' | 'refresh_unknown') {
    super('UNAUTHORIZED', 'Refresh token rejected', { reason });
    this.name = 'RefreshRejectedError';
  }
}

/**
 * S-P0-01 T02 — switch-tenant rejected: user KHÔNG phải member của tenant đích
 * (ADR-046 amendment — verify membership trước khi re-issue token). HTTP 403
 * (authenticated nhưng không có quyền với tenant này); ops log ghi reason.
 */
export class TenantSwitchRejectedError extends AuthDomainError {
  constructor(reason: 'not_member') {
    super('FORBIDDEN', 'Not a member of target tenant', { reason });
    this.name = 'TenantSwitchRejectedError';
  }
}
