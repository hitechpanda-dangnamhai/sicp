/**
 * useMe — TanStack Query hook for `GET /api/v1/auth/me`.
 *
 * Slice:    S-03 T03b — Home Dashboard hub
 *
 * **Consumes codegen typed client** (single-source-of-truth):
 *   - `AuthService.authControllerGetMe()` from
 *     `@icp/shared-types/api/services/AuthService`
 *   - Cookie auth via `OpenAPI.WITH_CREDENTIALS=true` set in QueryProvider
 *
 * **Returns** `MeResponseDto`:
 *   { id, email, role, display_name, avatar_initials, last_login_at }
 *
 * Per S-03 D-06 (MAR-1 Q1 RESOLVED Phiên 34) — `avatar_initials` field provided
 * by T02 (verified Phiên 35 — auth-response.dto.ts line 86 + get-me.use-case.ts
 * line 50 `computeAvatarInitials(user.display_name)`).
 *
 * Used by `<DashboardHeader initials={meQuery.data?.avatar_initials ?? '?'} />`
 * in Dashboard page (Batch 5 step 6).
 *
 * **Why separate from useStats**: independent caching + retry; user identity
 * doesn't refetch when stats refetch. Both share QueryClient singleton.
 *
 * S-03 T03b emit (Phiên 36 Batch 5).
 */

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { AuthService, type MeResponseDto } from '@icp/shared-types/api';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function useMe(): UseQueryResult<MeResponseDto, Error> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => AuthService.authControllerGetMe(),
  });
}
