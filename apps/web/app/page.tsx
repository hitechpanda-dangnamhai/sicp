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

export default function RootPage() {
  // Server-side cookie presence check (Edge runtime fast O(1) lookup).
  // Validity check happens at BE per protected request via JwtAuthGuard;
  // here we only gate splash render vs dashboard redirect.
  if (cookies().has(SESSION_COOKIE)) {
    redirect('/home');
  }

  return <SplashContent />;
}
