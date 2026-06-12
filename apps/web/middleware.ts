/**
 * apps/web/middleware.ts — Next.js middleware.
 *
 * Slice: S-03 T03b/T04 — auth-gate (presence `icp_session` → /home + intent + /me).
 *        S-P0-01 T02b-1 (ADR-046 amend d) — multi-tenant route scheme + dual-shim.
 *
 * **Auth gate** (S-03 DM-13): route được bảo vệ mà thiếu cookie `icp_session`
 * → redirect `/auth/login`. Chỉ check PRESENCE (validity do BE JwtAuthGuard lo
 * mỗi request) — đủ cho UI gate, không flash UI authed cho người chưa đăng nhập.
 *
 * **Dual-shim migration** (ADR-046 amend d — tránh big-bang ~4600 dòng, nav
 * không vỡ giữa các task T02b-1/2/3):
 *  (i)  forward-rewrite `/s/<slug>/X` → `/X` cho nhóm CHƯA migrate (intent-*):
 *       browser URL giữ `/s/<slug>` (slug đọc được) còn page cũ `app/intent-0X`
 *       vẫn render. Mỗi task migrate xoá dần prefix khỏi NOT_MIGRATED.
 *  (ii) legacy redirect 308 bare `/X` → `/s/<last_active_slug>/X` cho nhóm ĐÃ
 *       migrate (/home): giữ bookmark/deep-link cũ sống. Slug từ
 *       `sessions.last_active_tenant_id` — Edge KHÔNG đọc DB & JWT KHÔNG chứa
 *       slug nên gọi BE `GET /api/v1/auth/landing` (same-origin proxy, forward
 *       cookie) để resolve. 308 (permanent, giữ method) đúng amend d.
 *
 * **Cache-Control: no-store trên 308** — đích redirect biến thiên theo user
 * (last_active mỗi người mỗi khác); cấm browser/CDN cache 308 này, nếu không
 * user A có thể bị ghim sang shop của user B. (ADR-046 amend d.)
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'icp_session';
const LOGIN_PATH = '/auth/login';

/**
 * Route tenant-scoped ĐÃ migrate vào `/s/<slug>/*`. Bare URL của chúng nhận
 * legacy redirect 308 (ii). T02b-2 thêm `/intent-0X`; T02b sau khi xong → đây
 * là toàn bộ nhóm tenant-scoped.
 */
const MIGRATED_ROUTES = new Set<string>(['/home']);

/**
 * Prefix tenant-scoped CHƯA migrate (vẫn ở `app/intent-0X`). Khi vào qua
 * `/s/<slug>/intent-0X` → forward-rewrite (i) về page bare. T02b-2 xoá entry này.
 */
const NOT_MIGRATED_PREFIXES = ['/intent-'];

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

  // --- Storefront tenant-scoped `/s/<slug>/*` ---
  if (pathname.startsWith('/s/')) {
    if (!hasSession) return redirectLogin(req);
    const sub = pathname.replace(/^\/s\/[^/]+/, ''); // '' | '/home' | '/intent-01' | ...
    // (i) forward-rewrite cho nhóm chưa migrate.
    if (NOT_MIGRATED_PREFIXES.some((p) => sub.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = sub;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // --- Bare route ĐÃ migrate → legacy redirect 308 (ii) ---
  if (MIGRATED_ROUTES.has(pathname)) {
    if (!hasSession) return redirectLogin(req);
    const slug = await resolveLastActiveSlug(req);
    if (!slug) {
      // Chưa có last_active (chưa từng switch / customer global / tenant đã xoá).
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    const res = NextResponse.redirect(new URL(`/s/${slug}${pathname}`, req.url), 308);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // --- Bare route chưa migrate (intent-*) + account (/me*): auth-gate presence ---
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
    '/intent-07',
    '/me',
    '/me/notifications',
    '/me/security',
    '/me/help',
  ],
};
