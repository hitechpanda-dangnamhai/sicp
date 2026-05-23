/**
 * apps/web/middleware.ts — Next.js middleware.
 *
 * Slice: S-03 T03b — Home Dashboard hub
 *        S-03 T04 — `?next` query param cleanup per D-17 LOCKED
 *
 * **Auth gate** per S-03 DM-13: protect `/home` route + 6 placeholder
 * `/intent-{01,02,03,04,05,07}` routes. If user lacks `icp_session` cookie,
 * redirect to `/auth/login` (T04 owner — shipped Phiên N).
 *
 * **Why middleware (not page-level useEffect redirect)**:
 *   - Server-side check BEFORE page renders → no flash of authenticated UI
 *     for logged-out users
 *   - Cookie inspection at Edge runtime (fast)
 *   - Per `01_TECH_STACK §FE Authentication` middleware-first pattern
 *
 * **Matched routes** (per `config.matcher` below):
 *   - `/home` (Dashboard hub)
 *   - `/intent-01..05,07` (6 placeholder routes per R1 mapping LOCKED C-23)
 *   - SKIPPED: `/`, `/auth/*`, `/_next/*`, `/api/*` (public + framework + proxy)
 *
 * **Cookie check** — just presence, NOT validity:
 *   - Validity check happens at BE per request (`JwtAuthGuard` verifies JWT
 *     signature + Redis session lookup)
 *   - Middleware presence-check sufficient for UI gate; expired cookie →
 *     BE returns 401 → useStats/useMe queries fail → consumer handles
 *
 * **Redirect target** (T04 D-17 LOCKED):
 *   - Always redirects to bare `/auth/login` — NO `?next` query param
 *   - Post-login redirect is ALWAYS `/home` (single entry point per D-17)
 *   - Removed T03b `?next` preservation logic (was placeholder for unimplemented
 *     T04 bounce-back); T04 useLogin onSuccess hardcodes `/home` push
 *
 * S-03 T03b emit (Phiên 36 Batch 5) → S-03 T04 patch (Phiên N D-17 cleanup).
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'icp_session';
const LOGIN_PATH = '/auth/login';

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (hasSession) {
    return NextResponse.next();
  }

  // Redirect to /auth/login (no ?next — D-17 LOCKED: always bounce to /home post-login)
  const loginUrl = new URL(LOGIN_PATH, req.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * Matcher config — runs middleware on `/home` + 6 placeholder intent routes
 * + 4 `/me*` profile routes (T05).
 * Excludes public routes (/, /auth/*) + framework (/_next/*) + same-origin API
 * proxy (/api/*).
 *
 * Per S-03 D-11 + C-23 R1: 6 placeholder routes mapping mockup tile semantic →
 * 04_INTENT_SPECS Intent IDs. NO `/intent-06` (Payment via Cart sub-flow) +
 * NO `/intent-08` (Auth via /auth/*).
 *
 * S-03 T05 (Phiên N+2) — `/me` profile + 3 stub settings routes per AC-37.
 * Plain-string matchers chosen over glob `'/me/:path*'` to satisfy STOP-T05-4
 * fallback (zero risk of Next.js matcher syntax regression on existing
 * /home + /intent-* routes).
 */
export const config = {
  matcher: [
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
