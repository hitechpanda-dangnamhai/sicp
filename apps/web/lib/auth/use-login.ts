'use client';

/**
 * apps/web/lib/auth/use-login.ts
 *
 * useLogin — TanStack Query mutation hook for `POST /api/v1/auth/login`.
 *
 * Slice:    S-03 T04 — Auth Pages
 *           S-03 T05 PATCH (Phiên N+2) — REMOVED `router.push('/home')` from
 *                                        onSuccess per C-34 RESOLVED-INLINE
 *
 * **Consumes codegen typed client** (single-source-of-truth):
 *   - `AuthService.authControllerLogin(body: LoginDto)` from
 *     `@icp/shared-types/api/services/AuthService`
 *   - Cookie set automatically by BE via `Set-Cookie` header + browser respects
 *     `OpenAPI.WITH_CREDENTIALS=true` (T03b QueryProvider configured globally)
 *
 * **Returns LoginResponseDto** `{user: {id, email, role, display_name, avatar_initials}}`.
 * Note: `last_login_at` NOT included in login response (only in `/auth/me`).
 *
 * Decisions applied:
 * - **D-17** — Login destination is `/home` (always; ignore `?next`). UNCHANGED.
 *   T05 only moves implementation LOCUS (which component pushes), NOT destination.
 * - **D-19** — TanStack mutation only, NO Server Action wrapper. Mirror T03b
 *   `useMe()` + `useStats()` pattern (TanStack hooks throughout S-03).
 * - **D-25** — State machine page locus (S-03 T05 Phiên N+2): pages with
 *   multi-state UI (form → loading → success → error) own state machine +
 *   transition timing; hooks own data fetching + cache only. Navigation moved
 *   to LoginSuccessTransition organism `useEffect(setTimeout(2000))` so state-E
 *   transition (Brain 180×180 + check-pop + greeting + 2s loadProgress) is
 *   visible before redirect.
 * - **C-34 RESOLVED-INLINE** — Removed `router.push('/home')` from onSuccess
 *   so state-E can render. Locus moved to LoginSuccessTransition setTimeout.
 *
 * **onSuccess cookie/cache flow** (post-T05 patch):
 *   1. BE `POST /auth/login` 200 → Set-Cookie `icp_session` + `icp_refresh`
 *   2. Browser stores cookies (synchronous from response headers)
 *   3. `invalidateQueries({queryKey: ['auth', 'me']})` → useMe refetch on mount
 *   4. **Navigation owned by login page state machine** — when
 *      `loginMutation.isSuccess` → render `<LoginSuccessTransition>` → 2s
 *      `setTimeout(() => router.push('/home'))` cleanup-aware via useEffect.
 *
 * **onError** (401 wrong password OR network): error propagates to consumer
 * (`app/auth/login/page.tsx`) which calls `classifyLoginError(error)` per D-26
 * and branches state machine to state-C (inline banner + shake) OR state-D
 * (ErrorState replace form).
 *
 * S-03 T04 emit. T05 patch (Phiên N+2 Batch 3) — `router.push` removed.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { AuthService, type LoginDto, type LoginResponseDto } from '@icp/shared-types/api';
import { ME_QUERY_KEY } from '@/lib/dashboard/use-me';

export function useLogin(): UseMutationResult<LoginResponseDto, Error, LoginDto> {
  const queryClient = useQueryClient();

  return useMutation<LoginResponseDto, Error, LoginDto>({
    mutationFn: (body: LoginDto) => AuthService.authControllerLogin(body),
    onSuccess: async () => {
      // Invalidate /auth/me cache so consumer pages fetch fresh user identity.
      // Pattern: server has set cookies via Set-Cookie header (synchronous from
      // response), so subsequent fetch will include cookie. State-E transition
      // organism reads `mutation.data.user.display_name` directly (avoids useMe
      // race per STOP-T05-5).
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      // NO `router.push('/home')` here — navigation moved to LoginSuccessTransition
      // organism per C-34 RESOLVED-INLINE Phiên N+2 (D-25 state machine page locus
      // pattern). Destination /home UNCHANGED per D-17.
    },
    // No onError handler here — caller component reads `mutation.error` and
    // branches state machine via `classifyLoginError(error)` per D-26.
  });
}
