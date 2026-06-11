/**
 * apps/web/lib/tenant-context.ts
 *
 * S-P0-01 T02 (ADR-046 amendment b) — FE tenant context cho deploy model
 * path-prefix `icp.vn/s/<slug>/...`.
 *
 * Trách nhiệm FE: resolve slug từ pathname → cache tenant_id (session) → để
 * `api-client.ts` attach header `X-Tenant-Id` cho MỌI request anonymous
 * (tracking/public). BE chỉ tin JWT (authed) hoặc header (anonymous) — KHÔNG
 * parse Host/Referer.
 *
 * Cache ở `sessionStorage` (per-tab) keyed theo slug: tránh gọi
 * `/public/tenant-by-slug/<slug>` mỗi request; layout `/s/[slug]` resolve 1 lần.
 */

/** Match `/s/<slug>` đầu pathname → slug (DNS-safe). null nếu không ở storefront. */
const SLUG_RE = /^\/s\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\/|$)/i;

export function getCurrentTenantSlug(pathname?: string): string | null {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const m = SLUG_RE.exec(p);
  return m ? m[1].toLowerCase() : null;
}

const cacheKey = (slug: string): string => `icp.tenant.${slug}`;

export function cacheTenantId(slug: string, tenantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(cacheKey(slug), tenantId);
  } catch {
    // sessionStorage có thể bị chặn (private mode) — bỏ qua, header sẽ vắng.
  }
}

export function getCachedTenantId(slug: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(cacheKey(slug));
  } catch {
    return null;
  }
}

/**
 * tenant_id active = cache cho slug hiện tại trên pathname. null nếu chưa
 * resolve (layout chưa fetch xong) hoặc không ở storefront. `api-client.ts`
 * + tracker đọc hàm này để quyết định có attach X-Tenant-Id hay không.
 */
export function getActiveTenantId(): string | null {
  const slug = getCurrentTenantSlug();
  return slug ? getCachedTenantId(slug) : null;
}
