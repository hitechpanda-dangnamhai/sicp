/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ForgotPasswordDto } from '../models/ForgotPasswordDto';
import type { ForgotPasswordResponseDto } from '../models/ForgotPasswordResponseDto';
import type { LandingResponseDto } from '../models/LandingResponseDto';
import type { LoginDto } from '../models/LoginDto';
import type { LoginResponseDto } from '../models/LoginResponseDto';
import type { MeResponseDto } from '../models/MeResponseDto';
import type { MyTenantsResponseDto } from '../models/MyTenantsResponseDto';
import type { SwitchTenantRequestDto } from '../models/SwitchTenantRequestDto';
import type { SwitchTenantResponseDto } from '../models/SwitchTenantResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
  /**
   * Authenticate user (email + password) — issue session cookies
   * Returns 200 with 2 Set-Cookie headers (icp_session SameSite=Lax + icp_refresh SameSite=Strict) and body {user: PublicUser}. NO tokens in body per ADR-019 + S-03 C-01.
   * @param requestBody
   * @returns LoginResponseDto
   * @throws ApiError
   */
  public static authControllerLogin(
    requestBody: LoginDto,
  ): CancelablePromise<LoginResponseDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/auth/login',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        401: `Invalid credentials`,
      },
    });
  }
  /**
   * Invalidate current session
   * Requires icp_session cookie. Clears both auth cookies (Max-Age=0) + DEL Redis session:{jti} + UPDATE PG sessions.revoked_at=NOW(). Idempotent.
   * @returns void
   * @throws ApiError
   */
  public static authControllerLogout(): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/auth/logout',
    });
  }
  /**
   * Get current user profile
   * Returns 200 with user shape including avatar_initials (server-computed) and last_login_at (MAX issued_at from sessions). Requires icp_session cookie.
   * @returns MeResponseDto
   * @throws ApiError
   */
  public static authControllerGetMe(): CancelablePromise<MeResponseDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/auth/me',
    });
  }
  /**
   * Đổi shop — cập nhật landing hint, trả redirect_url (KHÔNG re-issue token)
   * ADR-046 amend (c): active tenant = URL, KHÔNG phải claim. Verify membership → UPDATE sessions.last_active_tenant_id → trả { tenant_id, slug, redirect_url } để FE router.push(redirect_url). JWT/cookie KHÔNG đổi. 403 nếu không phải member.
   * @param requestBody
   * @returns SwitchTenantResponseDto
   * @throws ApiError
   */
  public static authControllerSwitchTenant(
    requestBody: SwitchTenantRequestDto,
  ): CancelablePromise<SwitchTenantResponseDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/auth/switch-tenant',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Not a member of target tenant`,
      },
    });
  }
  /**
   * Rotating refresh — exchange refresh cookie for new pair
   * Reads icp_refresh cookie (NOT icp_session — separate path). Atomically revokes old refresh + issues new pair. Replay → 401. Per S-03 C-06.
   * @returns any
   * @throws ApiError
   */
  public static authControllerRefresh(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/auth/refresh',
      errors: {
        401: `Refresh token missing/expired/revoked`,
      },
    });
  }
  /**
   * Request password reset — stub (no real SMTP)
   * Per S-03 C-03 stub Phase 02. Always returns {sent: true} regardless of email existence (no user enumeration per OWASP). Emits auth.password_reset_requested behavior event for analytics tracking. NO database query, NO SMTP integration. Phase 6 productionization adds real email service + reset token table.
   * @param requestBody
   * @returns ForgotPasswordResponseDto
   * @throws ApiError
   */
  public static authControllerForgotPassword(
    requestBody: ForgotPasswordDto,
  ): CancelablePromise<ForgotPasswordResponseDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Resolve landing redirect (last shop hoặc onboarding)
   * ADR-046 amend (c): đọc sessions.last_active_tenant_id → redirect_url `/s/<slug>` (last_active) hoặc `/onboarding` (chưa có hint). Dùng cho root URL.
   * @returns LandingResponseDto
   * @throws ApiError
   */
  public static landingControllerLanding(): CancelablePromise<LandingResponseDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/auth/landing',
    });
  }
  /**
   * Danh sách shop user là member (onboarding/switcher)
   * ADR-046 amend (c): FE không đọc được tenant_ids (httpOnly JWT) → endpoint join slug/name. Dùng cho /onboarding (chọn shop) + tenant-switcher.
   * @returns MyTenantsResponseDto
   * @throws ApiError
   */
  public static landingControllerMyTenants(): CancelablePromise<MyTenantsResponseDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/auth/tenants',
    });
  }
}
