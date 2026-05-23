'use client';

/**
 * apps/web/lib/auth/use-logout.ts
 *
 * useLogout — TanStack Query mutation hook for `POST /api/v1/auth/logout`.
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow
 *
 * **Consumes codegen typed client** (single-source-of-truth):
 *   - `AuthService.authControllerLogout()` from
 *     `@icp/shared-types/api/services/AuthService`
 *   - BE returns 204 No Content + clears both cookies via Set-Cookie
 *     Max-Age=0 (icp_session + icp_refresh)
 *
 * Decisions applied:
 * - **D-19** — TanStack mutation only, NO Server Action wrapper (mirror
 *   T03b useMe/useStats + T04 useLogin pattern). V-SLICE consistency.
 *   FIXES Layer Matrix M6 Server Action drift per C-CONFLICT-03 PROMOTED
 *   RESOLVED-INLINE Phiên N+2.
 * - **D-27** — Logout consumer = LogoutConfirmCard "Đăng xuất" button
 *   (always-visible card on `/me` page state-F). Card "Ở lại" button uses
 *   `router.push('/home')` directly (no mutation), wired in /me page.
 *
 * **onSuccess cache + redirect flow**:
 *   1. BE 204 + Set-Cookie Max-Age=0 clears both cookies (browser auto-removes)
 *   2. `queryClient.removeQueries({ queryKey: ME_QUERY_KEY })` clears /auth/me
 *      cache so next mount triggers fresh fetch (which will 401 since cookies
 *      gone → useMe returns error → consumer redirects)
 *   3. `router.push('/auth/login')` — explicit FE-side redirect after logout
 *      (no `?next` per D-17; bare /auth/login)
 *   4. Middleware sees no `icp_session` cookie on any protected route → also
 *      redirects to /auth/login (defense-in-depth)
 *
 * **onError** (network fail, server 5xx): error retained in `mutation.error`.
 * Consumer (`LogoutConfirmCard`) may render a small inline error or just leave
 * card visible. T05 scope: no special UI per BRIEF — error logged + button
 * re-enables on next render (TanStack default).
 *
 * S-03 T05 emit (Phiên N+2 Batch 2).
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AuthService } from '@icp/shared-types/api';
import { ME_QUERY_KEY } from '@/lib/dashboard/use-me';

export function useLogout(): UseMutationResult<void, Error, void> {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => AuthService.authControllerLogout(),
    onSuccess: () => {
      // Drop ME cache — next mount will refetch + 401 (cookies cleared by BE),
      // but consumer (/me page) navigates away first via router.push below.
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      // Explicit redirect to login (D-19 — FE owns navigation post-mutation).
      router.push('/auth/login');
    },
  });
}
