/**
 * apps/web/middleware.ts — Next.js middleware.
 *
 * Slice: S-03 T03b/T04 — auth-gate (presence `icp_session` → /home + intent + /me).
 *        S-P0-01 T02b-1/2 (ADR-046 amend d) — multi-tenant route scheme + shim.
 *
 * **Auth gate** (S-03 DM-13): route được bảo vệ mà thiếu cookie `icp_session`
 * → redirect `/auth/login`. Chỉ check PRESENCE (validity do BE JwtAuthGuard lo
 * mỗi request) — đủ cho UI gate, không flash UI authed cho người chưa đăng nhập.
 *
 * **Migration shim** (ADR-046 amend d — tránh big-bang ~4600 dòng):
 *  - T02b-1 dùng forward-rewrite cho intent (chưa migrate). T02b-2 đã mv intent
 *    → `app/s/[slug]/intent/0X` (route thật) nên **forward-rewrite XOÁ** —
 *    `/s/<slug>/*` chỉ còn auth-gate + pass-through.
 *  - (ii) legacy redirect 308 bare `/X` → `/s/<last_active_slug>/<subpath>` giữ
 *    bookmark/deep-link cũ sống VĨNH VIỄN (giữ ở T02b-3). Path flat cũ đổi sang
 *    nested: `/intent-0X` → `/intent/0X` (LEGACY_REDIRECTS map). Slug từ
 *    `sessions.last_active_tenant_id` — Edge KHÔNG đọc DB & JWT KHÔNG chứa slug
 *    nên gọi BE `GET /api/v1/auth/landing` (same-origin proxy, forward cookie).
 *    308 (permanent, giữ method) đúng amend d.
 *
 * **Cache-Control: no-store trên 308** — đích redirect biến thiên theo user
 * (last_active mỗi người mỗi khác); cấm browser/CDN cache 308 này, nếu không
 * user A có thể bị ghim sang shop của user B. (ADR-046 amend d.)
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'icp_session';
const LOGIN_PATH = '/auth/login';

/**
 * Map bare-URL (flat, route cũ) → subpath tenant-scoped mới dưới `/s/<slug>`.
 * Bare URL của route ĐÃ migrate nhận legacy redirect 308 (ii). Path flat→nested:
 * `/intent-0X` → `/intent/0X` (T02b-2 mv). GIỮ vĩnh viễn cho bookmark (T02b-3).
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/home': '/home',
  '/intent-01': '/intent/01',
  '/intent-02': '/intent/02',
  '/intent-03': '/intent/03',
  '/intent-04': '/intent/04',
  '/intent-05': '/intent/05',
  '/intent-06': '/intent/06',
  '/intent-07': '/intent/07',
};

function redirectLogin(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
}

/**
 * Resolve `last_active_slug` qua BE landing endpoint (đọc
 * sessions.last_active_tenant_id). Same-origin proxy `/api/v1/*` (next.config
 * rewrites) → không cần biết gateway URL ở Edge; forward cookie để JwtAuthGuard
 * nhận diện session. Lỗi/anonymous/chưa có hint → null.
 */
async function resolveLastActiveSlug(req: NextRequest): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/auth/landing', req.nextUrl.origin), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { redirect_url?: string };
    const m = /^\/s\/([^/]+)/.exec(body.redirect_url ?? '');
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // --- Storefront tenant-scoped `/s/<slug>/*` — auth-gate, route thật (T02b-2
  // bỏ forward-rewrite: intent giờ là page thật dưới /s/<slug>/intent/0X) ---
  if (pathname.startsWith('/s/')) {
    if (!hasSession) return redirectLogin(req);
    return NextResponse.next();
  }

  // --- Bare legacy route (đã migrate) → 308 /s/<last_active_slug>/<subpath> (ii) ---
  const subpath = LEGACY_REDIRECTS[pathname];
  if (subpath) {
    if (!hasSession) return redirectLogin(req);
    const slug = await resolveLastActiveSlug(req);
    if (!slug) {
      // Chưa có last_active (chưa từng switch / customer global / tenant đã xoá).
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    const res = NextResponse.redirect(new URL(`/s/${slug}${subpath}`, req.url), 308);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // --- Account (/me*) + còn lại: auth-gate presence ---
  if (!hasSession) return redirectLogin(req);
  return NextResponse.next();
}

/**
 * Matcher: thêm `/s/:path*` (storefront) cho dual-shim; giữ bare `/home` +
 * intent + `/me*` (auth-gate + legacy redirect). Loại trừ `/`, `/auth/*`,
 * `/_next/*`, `/api/*` (public + framework + proxy) — không liệt kê = không match.
 */
export const config = {
  matcher: [
    '/s/:path*',
    '/home',
    '/intent-01',
    '/intent-02',
    '/intent-03',
    '/intent-04',
    '/intent-05',
    '/intent-06',
    '/intent-07',
    '/me',
    '/me/notifications',
    '/me/security',
    '/me/help',
  ],
};
