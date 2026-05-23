/**
 * useStats — TanStack Query hook for `GET /api/v1/dashboard/stats`.
 *
 * Slice:    S-03 T03b — Home Dashboard hub
 *
 * **Consumes codegen typed client** (single-source-of-truth):
 *   - `DashboardService.dashboardControllerGetStats()` from
 *     `@icp/shared-types/api/services/DashboardService`
 *   - Auto-regenerated via `pnpm openapi:sync` (verified Phiên 36 +63 LOC)
 *   - Cookie auth via `OpenAPI.WITH_CREDENTIALS=true` set in QueryProvider
 *
 * **Returns** `DashboardStatsDto`:
 *   { orders_today: number; revenue_today: number; inventory_count: number; currency: 'VND' }
 *
 * Per S-03 DM-14 + D-10 (MAR-1 Q5 RESOLVED Phiên 34) — BE stub, hardcoded values
 * matching mockup StatBar "8/2.4M/142 VND".
 *
 * **Error handling**:
 *   - 401 (missing/invalid cookie) → middleware should redirect to /auth/login
 *     BEFORE this hook fires; query.isError true if reaches here = race condition
 *     (cookie expired during session). Consumer page shows fallback or refresh prompt.
 *   - Network error → query.isError true; consumer shows error state.
 *
 * S-03 T03b emit (Phiên 36 Batch 5).
 */

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { DashboardService, type DashboardStatsDto } from '@icp/shared-types/api';

export const DASHBOARD_STATS_QUERY_KEY = ['dashboard', 'stats'] as const;

export function useStats(): UseQueryResult<DashboardStatsDto, Error> {
  return useQuery({
    queryKey: DASHBOARD_STATS_QUERY_KEY,
    queryFn: () => DashboardService.dashboardControllerGetStats(),
  });
}
