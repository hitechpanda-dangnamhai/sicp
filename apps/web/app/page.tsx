/**
 * apps/web/app/page.tsx — Root splash page (state-0)
 *
 * Slice:    S-03 T04 — Auth Pages (Splash + Login + Forgot)
 * Replaces: S-00b T08 placeholder + S-01 T03 PhoneFrame wrap (legacy)
 *
 * **Server Component** (no 'use client' directive) — `cookies()` only works
 * server-side. Server-side cookie check happens BEFORE any HTML renders:
 *
 *   - User authed (`icp_session` cookie present) → `redirect('/home')` (Next.js
 *     307 server-side bounce; no splash flash)
 *   - User anonymous → render <SplashContent /> client component
 *
 * Decisions applied:
 * - **D-16** (Phiên N) — Splash auth-gate via Server Component cookies() check,
 *   NOT middleware patch. Pattern preserves T03b middleware.ts shipped state
 *   (zero regression smoke-dashboard 10/10). LAYER_MATRIX M11 design.
 * - **D-17** (Phiên N) — Post-login redirect target `/home` LOCKED. No `?next`
 *   query param consumed. Single entry point UX.
 *
 * Cross-screen brand naming (D-15):
 *   - Splash `/` renders brand "Aida" (mockup IS LAW + Phase 00 handoff intent)
 *   - Dashboard `/home` (T03b shipped) renders "ICP" (repo namespace)
 *   - Intentional split: Aida = product UX brand, ICP = codebase namespace
 *
 * Mockup ref: `docs/mockups/intent-08/intent-08-state-0-splash.html` (159 LOC)
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SplashContent } from '@/components/icp/organisms/SplashContent';

const SESSION_COOKIE = 'icp_session';

/**
 * Gateway URL cho server-side fetch. Trong docker, server (Next) gọi gateway
 * qua DNS `gateway:3001`; dev host = localhost:3001. NEXT_PUBLIC_GATEWAY_URL
 * dùng chung với client config (query-provider).
 */
const GATEWAY_URL =
  process.env.GATEWAY_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_GATEWAY_URL ??
  'http://localhost:3001';

export default async function RootPage() {
  // S-P0-01 T02 (ADR-046 amend c): root URL không có /s/<slug> → hỏi BE landing.
  // Server-side fetch (forward cookie) — đây là QUYẾT ĐỊNH routing, không phải
  // REST data call trong component (generated client là client-only nên dùng
  // raw fetch ở Server Component này).
  const store = cookies();
  if (!store.has(SESSION_COOKIE)) {
    return <SplashContent />;
  }

  let redirectUrl = '/onboarding'; // fail-safe: authed nhưng không resolve được
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/auth/landing`, {
      headers: { cookie: store.toString() },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = (await res.json()) as { redirect_url?: string };
      if (typeof body.redirect_url === 'string' && body.redirect_url.length > 0) {
        redirectUrl = body.redirect_url;
      }
    }
  } catch {
    // Gateway unreachable → onboarding (an toàn; user chọn shop thủ công).
  }
  redirect(redirectUrl);
}
