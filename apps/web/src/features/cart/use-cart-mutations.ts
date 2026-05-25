/**
 * apps/web/src/features/cart/use-cart-mutations.ts
 *
 * 6 TanStack Query mutation hooks for cart REST endpoints (T02 ship 7 endpoints
 * minus GET which is useCart query). All use raw UUID v4 Idempotency-Key per
 * W1 LOCK (Gateway middleware builds composite server-side).
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * Source contract:
 *   - apps/gateway/src/cart/cart.controller.ts (7 endpoints — lines 88/124/171/209/250/288/323)
 *   - apps/gateway/src/cart/dto/cart-add-item.dto.ts
 *   - apps/gateway/src/cart/dto/cart-update-qty.dto.ts
 *   - apps/gateway/src/cart/dto/cart-promo.dto.ts
 *   - packages/shared-types/src/cart.ts (Cart entity T01 ship)
 *
 * Decisions applied:
 * - **D-S05-01 LAW**: Direct REST for stateless ops (NOT Pattern A) — qty/remove/promo
 *   all use straight POST/PATCH/DELETE returning Cart shape.
 * - **D-S05-07 LAW**: NO `onMutate` optimistic — local reducer owns optimistic
 *   overlays per cart-state-machine.ts; mutations only fire AFTER debounce settles.
 * - **S03-D-19 LAW**: TanStack mutation pattern (onSuccess invalidateQueries).
 * - **W1 LOCK**: raw UUID v4 Idempotency-Key — middleware composites server-side.
 *
 * Each hook signature:
 *   `(variables) → UseMutationResult<Cart, Error, variables>`
 *
 * Common pattern: onSuccess → invalidateQueries({queryKey: CART_QUERY_KEY})
 * → useCart refetches → page reflects server truth.
 *
 * S-05 T03 emit (Phiên Sx05-3).
 */

'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { Cart } from '@icp/shared-types/cart';
import { CART_QUERY_KEY } from './use-cart';

// ─── Variable types per endpoint ──────────────────────────────────────────

/** POST /api/v1/cart/items request body. */
export interface AddItemVars {
  productId: string;
  qty: number; // 1-99
  snapshot?: {
    title?: string;
    brand?: string | null;
    image_url?: string | null;
    image_gradient?: string | null;
    icon_hint?: string | null;
    original_price?: number | null;
  };
}

/** PATCH /api/v1/cart/items/:productId request body (qty=0 → auto-remove). */
export interface UpdateQtyVars {
  productId: string;
  qty: number; // 0-99 (0 auto-removes)
}

/** POST /api/v1/cart/promo request body. */
export interface ApplyPromoVars {
  code: string;
}

// ─── Shared fetch helper — handles idempotency header + cookie credentials ──

async function cartFetch<T = Cart>(
  url: string,
  options: {
    method: 'POST' | 'PATCH' | 'DELETE' | 'GET';
    body?: unknown;
  },
): Promise<T> {
  const idempotencyKey = crypto.randomUUID();
  const init: RequestInit = {
    method: options.method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    let errText = '';
    try {
      errText = await res.text();
    } catch {
      /* swallow secondary parse error */
    }
    throw new Error(
      `${options.method} ${url} failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

/**
 * `usePostCartItem` — POST /api/v1/cart/items (add or upsert qty).
 *
 * Used by: S-04 intent-03 add-to-cart wire-through (when full payload available)
 * + S-05 state-E `resolve_replace` path (after server processes replacement).
 *
 * Note: state-E `resolve_replace` is actually handled via POST /intent/:rid/action
 * (Pattern A), not direct REST. This hook is reserved for direct add UX (e.g.
 * "+1 quick re-add" if FE ever needs it).
 */
export function usePostCartItem(): UseMutationResult<Cart, Error, AddItemVars> {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, AddItemVars>({
    mutationFn: (vars) =>
      cartFetch<Cart>('/api/v1/cart/items', {
        method: 'POST',
        body: {
          product_id: vars.productId,
          qty: vars.qty,
          ...(vars.snapshot !== undefined && { snapshot: vars.snapshot }),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

/**
 * `usePatchCartItem` — PATCH /api/v1/cart/items/:productId (state-C qty stepper).
 *
 * D-S05-07 LAW: called AFTER 300ms debounce settles, NOT on each tap.
 * qty=0 auto-removes per D-S05-02 LAW sugar.
 */
export function usePatchCartItem(): UseMutationResult<Cart, Error, UpdateQtyVars> {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, UpdateQtyVars>({
    mutationFn: (vars) =>
      cartFetch<Cart>(`/api/v1/cart/items/${encodeURIComponent(vars.productId)}`, {
        method: 'PATCH',
        body: { qty: vars.qty },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

/**
 * `useDeleteCartItem` — DELETE /api/v1/cart/items/:productId (state-D undo timeout commit).
 *
 * Fired after `<UndoRemoveToast>` 3s countdown completes WITHOUT undo tap.
 */
export function useDeleteCartItem(): UseMutationResult<Cart, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, string>({
    mutationFn: (productId) =>
      cartFetch<Cart>(`/api/v1/cart/items/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

/**
 * `useDeleteCart` — DELETE /api/v1/cart (full cart clear).
 *
 * **NOT USED BY STATE-F UI** — state-F always goes through Pattern A interrupt
 * (cart_clear_confirm entry intent → SSE → user confirmation → resume).
 * This hook is reserved for non-Pattern-A fallback (e.g. test seeds, admin tools).
 *
 * Returns `{cleared: true, user_id}` shape per cart.controller.ts:250 — typed
 * loosely as `{cleared: boolean}` to avoid coupling FE to user_id field.
 */
export function useDeleteCart(): UseMutationResult<{ cleared: boolean }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<{ cleared: boolean }, Error, void>({
    mutationFn: () =>
      cartFetch<{ cleared: boolean }>('/api/v1/cart', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

/**
 * `usePostPromo` — POST /api/v1/cart/promo (state-G apply promo fast-path).
 *
 * Returns updated Cart on success OR throws on INVALID_CODE (caller branches
 * via mutation.error to render error toast). LLM typo correction layer is
 * OPTIONAL extension per D-S05-05 (deferred T04).
 */
export function usePostPromo(): UseMutationResult<Cart, Error, ApplyPromoVars> {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, ApplyPromoVars>({
    mutationFn: (vars) =>
      cartFetch<Cart>('/api/v1/cart/promo', {
        method: 'POST',
        body: { code: vars.code },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

/**
 * `useDeletePromo` — DELETE /api/v1/cart/promo (state-G "Bỏ" button on promo pill).
 *
 * Clears promo field → totals.discount recomputed → pill hides on refetch.
 */
export function useDeletePromo(): UseMutationResult<Cart, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, void>({
    mutationFn: () =>
      cartFetch<Cart>('/api/v1/cart/promo', {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}
