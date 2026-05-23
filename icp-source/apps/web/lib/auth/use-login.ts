'use client';

/**
 * apps/web/lib/auth/use-login.ts
 *
 * useLogin — TanStack Query mutation hook for `POST /api/v1/auth/login`.
 *
 * Slice:    S-03 T04 — Auth Pages
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
 * - **D-17** — `onSuccess` redirects to `/home` (always, ignore `?next` query
 *   per cleanup). Single entry point post-login UX.
 * - **D-19** — TanStack mutation only, NO Server Action wrapper. Mirror T03b
 *   `useMe()` + `useStats()` pattern (TanStack hooks throughout S-03).
 *
 * **onSuccess cookie/cache flow** (STOP-T04-5 mitigation):
 *   1. BE `POST /auth/login` 200 → Set-Cookie `icp_session` + `icp_refresh`
 *   2. Browser stores cookies (synchronous from response headers)
 *   3. `invalidateQueries({queryKey: ['auth', 'me']})` → useMe refetch on mount
 *   4. `router.push('/home')` → middleware sees cookie → renders /home
 *   5. DashboardHeader reads useMe() → renders user.avatar_initials
 *
 * **onError** (401 wrong password): error propagates to consumer
 * (`app/auth/login/page.tsx`) which sets `LoginForm error="..."` prop.
 *
 * S-03 T04 emit.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AuthService, type LoginDto, type LoginResponseDto } from '@icp/shared-types/api';
import { ME_QUERY_KEY } from '@/lib/dashboard/use-me';

export function useLogin(): UseMutationResult<LoginResponseDto, Error, LoginDto> {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation<LoginResponseDto, Error, LoginDto>({
    mutationFn: (body: LoginDto) => AuthService.authControllerLogin(body),
    onSuccess: async () => {
      // Invalidate /auth/me cache so DashboardHeader fetches fresh user identity
      // after redirect. Pattern: server has set cookies via Set-Cookie header
      // (synchronous from response), so subsequent fetch will include cookie.
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });

      // Always redirect /home per D-17 LOCKED. NOT consume `?next` query param
      // (middleware no longer sets it per D-17 cleanup).
      router.push('/home');
    },
    // No onError handler here — caller component reads `mutation.error` and
    // passes to <LoginForm error={...} /> prop (per S-01 LoginForm C-29 pattern).
    // Default TanStack behavior: error retained in `mutation.error` until next call.
  });
}
