/**
 * apps/web/src/features/cart/use-cart.ts
 *
 * useCart — TanStack Query hook for `GET /api/v1/cart`.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * **Consumes raw fetch** (not codegen client) because cart API not in
 * OpenAPI schema yet — same pattern as `use-search-stream.ts`. Cookie auth
 * via `credentials: 'include'` per ADR-019 (httpOnly icp_session).
 *
 * **Returns** `Cart` per CartSchema (T01 ship `packages/shared-types/src/cart.ts`).
 *
 * Decisions applied:
 * - **S03-D-19** TanStack Query pattern (S-03 inheritance) — separate query for
 *   cart + invalidate via CART_QUERY_KEY on mutations.
 * - **D-S05-11 LAW** — server truth refetched on each SSE terminal event
 *   (cart_cleared/cart_updated/cart_view_ready). useQuery + invalidateQueries
 *   is the canonical refetch trigger.
 * - **refetchOnWindowFocus: true** — per handoff Section 2.2 known issue #2:
 *   tab switch could cause cart drift if other tabs mutate. Enabled here
 *   despite QueryProvider default `false` because cart is high-stakes mutable.
 *
 * Used by `/intent-05/page.tsx` for state-A loading + state-0 happy + state-B
 * empty rendering. Cart mutations (use-cart-mutations) invalidate CART_QUERY_KEY
 * on success → useCart refetches → page reflects server truth.
 *
 * S-05 T03 emit (Phiên Sx05-3).
 */

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Cart } from '@icp/shared-types/cart';

/** Query key constant — exported for use in mutation hooks' invalidateQueries calls. */
export const CART_QUERY_KEY = ['cart'] as const;

export function useCart(): UseQueryResult<Cart, Error> {
  return useQuery<Cart, Error>({
    queryKey: CART_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/v1/cart', {
        credentials: 'include',
      });
      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow secondary parse error */
        }
        throw new Error(
          `GET /cart failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
        );
      }
      return (await res.json()) as Cart;
    },
    // Override QueryProvider default (false) — cart is mutable, refetch on focus
    // catches cross-tab mutations + bg-refresh after long idle (per handoff known issue #2).
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
