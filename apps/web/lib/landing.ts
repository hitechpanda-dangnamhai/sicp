/**
 * apps/web/lib/landing.ts
 *
 * S-P0-01 T02b-3 (ADR-046 amend c) — resolve landing redirect cho context
 * GLOBAL không có slug ở URL (post-login `/auth/*`, account `/me/*`): gọi
 * `GET /auth/landing` (đọc sessions.last_active_tenant_id) → redirect_url
 * (`/s/<slug>` hoặc `/onboarding`).
 *
 * Đây là CỬA CHÍNH cho landing (amend c) — KHÔNG hardcode `/home` (bare /home →
 * middleware 308 chỉ là compat cho bookmark, không phải cửa chính). Lỗi fetch
 * → `/` (root = landing path amend c); CẤM fallback về `/home`.
 *
 * Generated service (CLAUDE.md §11: FE CẤM raw fetch REST → dùng @icp/shared-types).
 */

import { AuthService } from '@icp/shared-types/api';

/**
 * Gọi landing endpoint rồi đẩy `redirect_url` qua `push` (router.push của caller).
 * `push` nhận href string. Lỗi → push('/').
 */
export async function pushLanding(push: (href: string) => void): Promise<void> {
  try {
    const res = await AuthService.landingControllerLanding();
    push(res.redirect_url);
  } catch {
    push('/');
  }
}
