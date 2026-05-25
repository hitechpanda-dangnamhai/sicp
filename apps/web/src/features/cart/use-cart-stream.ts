'use client';

/**
 * apps/web/src/features/cart/use-cart-stream.ts
 *
 * React hook: SSE EventSource lifecycle + 7 cart SSE event handlers for
 * Pattern A interrupt flows on /intent-05 page.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * Source contract (verified Tier 3 source code):
 *   - `apps/web/lib/sse-client.ts:60-92` — `streamIntent(url, handlers, options)`
 *     typed wrapper; returns close fn.
 *   - `packages/shared-types/src/sse/intent-stream.ts:393-516` — 7 cart SSE
 *     schemas T02 ship (clear_confirm/cart_cleared/clear_cancelled +
 *     stock_issue_ready/stock_issue_summary/cart_updated/cart_view_ready).
 *   - `apps/gateway/src/intent/intent.controller.ts:161 (POST /intent)` + `191 (GET stream)`.
 *   - `apps/gateway/src/intent/dto/intent-action.dto.ts:57-70` (10 choices T02 ship).
 *
 * Decisions applied:
 * - D-S05-01 + D-S05-03 LAW: Pattern A interrupt for clear-confirm + stock-resolve flows.
 * - D-S05-09 LAW: clear_confirm SSE excludes actions[] — FE hardcodes button labels.
 * - D-S05-10 LAW: clear_confirm user_message BE-driven Vietnamese (rendered as-is).
 * - D-S05-11 LAW: terminal SSE events (cart_cleared/cart_updated/cart_view_ready/clear_cancelled)
 *   are minimal trigger payloads → FE invalidateQueries({queryKey: CART_QUERY_KEY}) → refetch.
 * - W1 LOCK: raw UUID Idempotency-Key on POST /intent + POST /action; middleware composites.
 * - C-15 'use client': React hooks + EventSource.
 * - S-03 D-29 StrictMode-safe: useEffect cleanup closes EventSource on unmount; ref pattern
 *   survives React 18 dev double-mount; only final unmount actually closes.
 *
 * Public API:
 *   const stream = useCartStream({ dispatch, queryClient, getAttemptN });
 *   stream.openClearConfirm()                      — POST /intent {hint:'cart_clear_confirm'} + SSE
 *   stream.openStockCheck()                        — POST /intent {hint:'cart_view_with_stock_check'} + SSE
 *   stream.sendAction(choice, value?)              — POST /intent/:rid/action via postAction reuse
 *   stream.close()                                 — manual close (for cancel modal cleanup)
 *
 * Architecture note: Hook receives `dispatch` (cart reducer) + `queryClient`
 * (TanStack invalidate hook) as inputs — keeps hook pure-data-flow without
 * importing reducer-instance singleton. Caller wires together in page component.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { streamIntent, type IntentStreamHandlers } from '@/lib/sse-client';
import { postAction, type IntentActionChoice } from '@/src/features/search/action-poster';
import type { CartAction, StockReplacementData } from './cart-state-machine';
import { CART_QUERY_KEY } from './use-cart';

/** Cart-specific hint values (subset of intent.dto allowed `hint` enum). */
export type CartIntentHint = 'cart_clear_confirm' | 'cart_view_with_stock_check';

export interface UseCartStreamConfig {
  /** Reducer dispatch — for state machine updates from SSE events. */
  dispatch: (action: CartAction) => void;
  /** TanStack QueryClient — for invalidateQueries on terminal events. */
  queryClient: QueryClient;
  /** Resolver for current attemptN — passed by ref to avoid stale closure on Pattern A retries. */
  getAttemptN: () => number;
}

export interface UseCartStreamReturn {
  openClearConfirm: () => Promise<void>;
  openStockCheck: () => Promise<void>;
  sendAction: (choice: IntentActionChoice, value?: Record<string, unknown>) => Promise<void>;
  close: () => void;
}

export function useCartStream(config: UseCartStreamConfig): UseCartStreamReturn {
  const { dispatch, queryClient, getAttemptN } = config;

  // Refs survive React 18 StrictMode double-mount; only real unmount triggers close.
  const esCloseRef = useRef<(() => void) | null>(null);
  const activeRidRef = useRef<string | null>(null);

  /** Build typed SSE handler map. */
  const buildHandlers = useCallback((): IntentStreamHandlers => {
    return {
      clear_confirm: (e) => {
        dispatch({
          type: 'clear_confirm_sse',
          payload: {
            itemCount: e.item_count,
            subtotal: e.subtotal,
            userMessage: e.user_message,
            advice: e.advice,
          },
        });
      },
      cart_cleared: () => {
        // Terminal: invalidate cart query → refetch shows empty → state-B renders.
        dispatch({ type: 'clear_settled' });
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
      clear_cancelled: () => {
        // User cancelled clear flow — close modal, no mutation occurred.
        dispatch({ type: 'clear_settled' });
        // Defensive refetch per D-S05-07 optimistic-rollback pattern.
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
      stock_issue_ready: (e) => {
        const replacement: StockReplacementData | null = e.replacement
          ? {
              productId: e.replacement.product_id,
              title: e.replacement.title,
              brand: e.replacement.brand,
              unitPrice: e.replacement.unit_price,
              availableStock: e.replacement.available_stock,
            }
          : null;
        dispatch({
          type: 'stock_issue_ready_sse',
          productId: e.product_id,
          replacement,
        });
      },
      stock_issue_summary: (e) => {
        dispatch({
          type: 'stock_issue_summary_sse',
          productIds: e.product_ids,
        });
      },
      cart_updated: () => {
        // Terminal post-mutation — refetch shows resolved cart truth.
        dispatch({ type: 'stock_resolved' });
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
      cart_view_ready: () => {
        // Terminal happy-path stock-check (no issues) — no mutation, just clear flow.
        dispatch({ type: 'stock_resolved' });
        // Cart already accurate; no invalidate needed but defensive cheap.
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
      error: (e) => {
        dispatch({ type: 'sse_error', message: e.message ?? 'Lỗi kết nối luồng giỏ hàng' });
      },
      final: () => {
        // Stream complete (graph done) — close EventSource.
        dispatch({ type: 'sse_terminal' });
        esCloseRef.current?.();
        esCloseRef.current = null;
        activeRidRef.current = null;
      },
    };
  }, [dispatch, queryClient]);

  /**
   * Internal helper — POST /intent with cart hint + open SSE.
   * Returns request_id so caller may dispatch state machine entry action.
   */
  const openIntent = useCallback(
    async (hint: CartIntentHint): Promise<string> => {
      // Close any prior stream (one cart Pattern A flow active at a time).
      esCloseRef.current?.();
      esCloseRef.current = null;

      const idempotencyKey = crypto.randomUUID();
      const res = await fetch('/api/v1/intent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ modality: 'text', content: '', hint }),
      });

      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow */
        }
        const msg = `POST /intent (${hint}) failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`;
        dispatch({ type: 'sse_error', message: msg });
        throw new Error(msg);
      }

      const { request_id } = (await res.json()) as { request_id: string };
      activeRidRef.current = request_id;

      // Open SSE — wrapper auto-parses JSON; we dispatch to reducer.
      const close = streamIntent(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001'}/api/v1/intent/stream?id=${encodeURIComponent(request_id)}`,
        buildHandlers(),
        {
          onError: () => {
            // Network drop / non-graceful close. EventSource auto-reconnects via heartbeat;
            // don't dispatch on transient drop. Persistent failures surface via `error` SSE handler.
          },
        },
      );
      esCloseRef.current = close;
      return request_id;
    },
    [buildHandlers, dispatch],
  );

  const openClearConfirm = useCallback(async () => {
    const rid = await openIntent('cart_clear_confirm');
    dispatch({ type: 'clear_tap', requestId: rid });
  }, [openIntent, dispatch]);

  const openStockCheck = useCallback(async () => {
    const rid = await openIntent('cart_view_with_stock_check');
    dispatch({ type: 'stock_check_opened', requestId: rid });
  }, [openIntent, dispatch]);

  /**
   * sendAction — POST /intent/:rid/action via postAction reuse from features/search.
   *
   * D-S05-03 LAW: Pattern A resume choices supported via 10-value enum
   * (action-poster.ts:25 EXTEND T03 — confirm_clear/cancel_clear/resolve_remove/resolve_replace).
   */
  const sendAction = useCallback(
    async (choice: IntentActionChoice, value?: Record<string, unknown>) => {
      const rid = activeRidRef.current;
      if (!rid) {
        const msg = `sendAction(${choice}): no active rid — open intent first`;
        dispatch({ type: 'sse_error', message: msg });
        throw new Error(msg);
      }
      await postAction(rid, {
        choice,
        ...(value !== undefined && { value }),
        _meta: { attempt_n: getAttemptN() },
      });
    },
    [dispatch, getAttemptN],
  );

  const close = useCallback(() => {
    esCloseRef.current?.();
    esCloseRef.current = null;
    activeRidRef.current = null;
  }, []);

  // Cleanup on unmount — S-03 D-29 StrictMode-safe.
  useEffect(() => {
    return () => {
      esCloseRef.current?.();
      esCloseRef.current = null;
      activeRidRef.current = null;
    };
  }, []);

  return { openClearConfirm, openStockCheck, sendAction, close };
}
