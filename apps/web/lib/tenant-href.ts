/**
 * apps/web/lib/tenant-href.ts
 *
 * S-P0-01 T02b-1 (ADR-046 amendment d) — helper DUY NHẤT sinh URL tenant-scoped
 * `/s/<slug>/<path>` cho navigation FE. CẤM hardcode `/s/` ở bất kỳ chỗ nào
 * khác (grep gate T02b-3 enforce).
 *
 * Slug lấy từ pathname hiện tại (`getCurrentTenantSlug`) — mọi trang
 * tenant-scoped chạy dưới `/s/<slug>/*`, kể cả trang CHƯA migrate (T02b-2) vốn
 * render qua forward-rewrite middleware: browser URL vẫn mang `/s/<slug>` nên
 * slug đọc được.
 *
 * Context GLOBAL không có slug (post-login `/auth/*`, account `/me/*`) → trả
 * path bare; middleware legacy-redirect 308 sẽ resolve slug từ
 * `sessions.last_active_tenant_id` (ADR-046 amend d (ii)). Wrap ở đây sẽ sinh
 * URL thiếu slug nên KHÔNG gọi helper trong các context đó.
 */

import { getCurrentTenantSlug } from '@/lib/tenant-context';

/**
 * Trỏ một path tenant-scoped (vd `/home`, `/intent-07?preset=x`) thành
 * `/s/<slug>/...`. `slug` truyền tay (từ `useTenant()`) ưu tiên hơn auto-detect
 * — tránh phụ thuộc `window.location` khi render.
 *
 * @param path  Path bare bắt đầu bằng `/` (query string giữ nguyên).
 * @param slug  Slug active; bỏ trống → auto từ pathname.
 * @returns     `/s/<slug><path>` khi có slug; ngược lại trả `path` bare.
 */
export function tenantHref(path: string, slug?: string | null): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  // Đã scoped sẵn (vd ai đó truyền `/s/...`) → giữ nguyên, tránh double-prefix.
  if (clean.startsWith('/s/')) return clean;
  const s = slug ?? getCurrentTenantSlug();
  if (!s) return clean; // global context → bare; 308 shim resolve slug sau.
  return `/s/${s}${clean}`;
}
