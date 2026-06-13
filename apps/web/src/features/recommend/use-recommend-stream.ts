'use client';

/**
 * apps/web/src/features/recommend/use-recommend-stream.ts
 *
 * React hook: state machine + EventSource lifecycle + SSE event handlers
 * for /intent-04 page (Image Recommendation).
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F)
 *
 * Source:   CLONED + MODIFIED from `apps/web/src/features/search/use-search-stream.ts`
 *           (S-04 ship 281 LOC, ~20% diff per Phiên Sx09-E reuse-max audit Section 6.B).
 *           REUSE: EventSource lifecycle (D-S04-13 Pattern A); 7 SSE handlers
 *                  (status, phase_progress, understanding, product_ready, products,
 *                   empty_state, final, error).
 *           SKIP:  typo_suggestion + variant_degraded (image flow — no typo/no degrade).
 *           REPLACE: submitQuery(q, mode) → submitImage(image_b64).
 *
 * Decisions applied:
 * - D-S04-13 LAW (cross-slice): Option Z Redis pub/sub — EventSource closes on
 *   `final` event (no Pattern P2 interrupt in image flow — atomic graph run).
 * - D-S04-14 LAW (cross-slice): per-product `product_ready` handler with
 *   first-card telemetry refs (idempotent emit `intent.first_card_emitted`
 *   counterpart via behavior tracker).
 * - D-S09-NN-B LAW: each upload = new graph run + new request_id. Hook exposes
 *   `submitImage(b64)` (initial entry) + `appendNewTurn(b64)` (re-upload state-F).
 * - C-15 'use client': React hooks + EventSource.
 * - D-29 S-03 LAW: StrictMode-safe — useEffect cleanup closes EventSource on
 *   unmount; setState callback pattern avoids stale closures.
 * - W1 LOCK: raw UUID v4 Idempotency-Key (Gateway middleware builds composite).
 *
 * Public API:
 *   const stream = useRecommendStream();
 *   stream.state                    — RecommendState (read-only)
 *   stream.submitImage(b64)         — POST /intent (initial upload) + open EventSource
 *   stream.appendNewTurn(b64)       — collapse current → previousTurns + new POST
 *   stream.dispatch(action)         — escape hatch (reset / set_signal_filter etc.)
 *   stream.setSignalFilter(signal)  — convenience for D-S09-NN-A LAW chip taps
 *   stream.setCartConfirm(item)
 *   stream.dismissCartConfirm()
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { streamIntent, type IntentStreamHandlers } from '@/lib/sse-client';
import { tenantHeaders } from '@/lib/api-client';
import {
  initialState,
  reduceState,
  type RecommendAction,
  type RecommendState,
  type RecommendedProduct,
  type SignalKey,
  type AddToCartConfirmSummary,
} from './recommend-state-machine';
import type {
  RecommendationEmptyReason,
  RecommendationErrorCode,
  DetectedContext,
  CoPurchaseHint,
} from '@icp/shared-types/recommendations';

export interface UseRecommendStreamReturn {
  state: RecommendState;
  /** POST /intent (modality='image') + open EventSource. Closes prior stream first. */
  submitImage: (imageB64: string) => Promise<void>;
  /** D-S09-NN-B LAW: collapse currentTurn → previousTurns[] + POST new request. */
  appendNewTurn: (imageB64: string) => Promise<void>;
  /** Escape hatch for actions (reset / set_signal_filter / set_cart_confirm / etc.). */
  dispatch: (action: RecommendAction) => void;
  /** Convenience for D-S09-NN-A LAW chip taps. */
  setSignalFilter: (signal: SignalKey) => void;
  setCartConfirm: (item: AddToCartConfirmSummary | null) => void;
  dismissCartConfirm: () => void;
}

/** Build a typed handler map for streamIntent wrapper.
 *
 * Type loose because BE event payloads include S-09 extensions (`detected`,
 * `co_purchase_hint`, `sub_scores` on items) not yet narrowed in
 * IntentStreamEventMap (per intent-stream.ts:344 `z.record(z.unknown())`
 * passthrough — additive per C-S09-F).
 */
type LooseHandler<T = unknown> = (data: T) => void;

export function useRecommendStream(): UseRecommendStreamReturn {
  const [state, setState] = useState<RecommendState>(initialState);

  // Refs survive React 18 StrictMode double-mount.
  const esCloseRef = useRef<(() => void) | null>(null);

  // D-S04-14 LAW perceived-latency telemetry refs (paired tracker emit goes
  // through page-level tracking-hooks; ref guards idempotency).
  const submitStartedAtRef = useRef<number | null>(null);
  const firstCardEmittedRef = useRef<boolean>(false);

  const dispatch = useCallback((action: RecommendAction) => {
    if (action.type === 'submit_image' || action.type === 'append_new_turn') {
      submitStartedAtRef.current = performance.now();
      firstCardEmittedRef.current = false;
    }
    setState((s) => reduceState(s, action));
  }, []);

  /** Build SSE handler map per BE recommend_by_images.py emit sequence. */
  const buildHandlers = useCallback(
    (): IntentStreamHandlers => {
      // Cast to LooseHandler because event payload type narrowing happens
      // here (S-09 extends S-04 base via record<unknown> passthrough).
      const handlers: Record<string, LooseHandler> = {
        status: (e: unknown) => {
          const ev = e as { phase: 'analyzing' | 'searching' | 'done' };
          dispatch({ type: 'status', phase: ev.phase });
        },

        phase_progress: (e: unknown) => {
          dispatch({
            type: 'phase_progress',
            // Cast via any-bridge — payload extends IntentStreamEventMap['phase_progress']
            payload: e as never,
          });
        },

        understanding: (e: unknown) => {
          // BE emits `{detected: {category, attributes, ocr_text}}` per
          // recommend_by_images.py:282-288. Different shape from S-04 understanding
          // (`{text, highlighted_terms}`) — store raw.
          const ev = e as { detected?: Record<string, unknown> };
          dispatch({
            type: 'understanding',
            payload: { detected: ev.detected ?? {} },
          });
        },

        product_ready: (e: unknown) => {
          const ev = e as {
            item: RecommendedProduct;
            index: number;
            total: number;
          };
          dispatch({
            type: 'product_ready',
            item: ev.item,
            index: ev.index,
            total: ev.total,
          });
          // D-S04-14 LAW: idempotent first-card telemetry — emit ONCE per request_id.
          if (!firstCardEmittedRef.current && submitStartedAtRef.current !== null) {
            firstCardEmittedRef.current = true;
            // Page-level tracking-hooks consumes this via `state.products[0]` first-paint
            // useEffect; here we just guard the ref.
          }
        },

        products: (e: unknown) => {
          const ev = e as { items: RecommendedProduct[] };
          dispatch({ type: 'products', items: ev.items });
        },

        empty_state: (e: unknown) => {
          const ev = e as {
            reason?: RecommendationEmptyReason;
            message: string;
            fallback_actions: Array<{ type: string; label: string; value?: string }>;
          };
          dispatch({
            type: 'empty_state',
            payload: {
              reason: ev.reason ?? 'no_visual_match',
              message: ev.message,
              fallback_actions: ev.fallback_actions ?? [],
            },
          });
        },

        final: (e: unknown) => {
          // BE recommend_by_images.py:651-660 emits full RecommendationResponse shape.
          const ev = e as {
            detected: DetectedContext;
            products: RecommendedProduct[];
            co_purchase_hint: CoPurchaseHint | null;
          };
          dispatch({ type: 'final', payload: ev });
          // D-S04-13 LAW: close EventSource on terminal `final` event.
          esCloseRef.current?.();
          esCloseRef.current = null;
        },

        error: (e: unknown) => {
          const ev = e as {
            code?: RecommendationErrorCode | string;
            message: string;
            trace_id?: string;
          };
          dispatch({
            type: 'error',
            code: ev.code ?? 'E_NETWORK',
            message: ev.message,
            traceId: ev.trace_id,
          });
          esCloseRef.current?.();
          esCloseRef.current = null;
        },
      };

      return handlers as IntentStreamHandlers;
    },
    [dispatch],
  );

  /**
   * Internal helper — POST /api/v1/intent (modality='image') + open EventSource.
   * Used by both submitImage (initial) and appendNewTurn (re-upload).
   *
   * Returns the request_id from 202 response so caller can wire it into the
   * appropriate dispatch (submit_image vs append_new_turn).
   */
  const doPostAndStream = useCallback(
    async (imageB64: string): Promise<{ requestId: string } | null> => {
      // Close prior EventSource (new upload supersedes).
      esCloseRef.current?.();
      esCloseRef.current = null;

      const idempotencyKey = crypto.randomUUID();
      const body = {
        modality: 'image' as const,
        content: imageB64,
        hint: 'recommend' as const,
        entry_intent: 'recommend' as const,
        mode: 'ai_augmented' as const,
      };

      let res: Response;
      try {
        res = await fetch('/api/v1/intent', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            ...tenantHeaders(), // T02b-hotfix: resolver header-only (ADR-046 amend c)
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        dispatch({
          type: 'error',
          code: 'E_NETWORK',
          message: `POST /intent network error: ${err instanceof Error ? err.message : String(err)}`,
        });
        return null;
      }

      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow */
        }
        dispatch({
          type: 'error',
          code: 'E_NETWORK',
          message: `POST /intent failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
        });
        return null;
      }

      const { request_id } = (await res.json()) as { request_id: string };

      // Open SSE EventSource — wrapper auto-parses JSON; we dispatch to reducer.
      const close = streamIntent(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001'}/api/v1/intent/stream?id=${encodeURIComponent(request_id)}`,
        buildHandlers(),
        {
          onError: () => {
            // Transient drop — EventSource auto-reconnects via heartbeat.
            // Hard fail (server close) → terminal `error` event already dispatched.
          },
        },
      );
      esCloseRef.current = close;

      return { requestId: request_id };
    },
    [buildHandlers, dispatch],
  );

  const submitImage = useCallback(
    async (imageB64: string) => {
      const r = await doPostAndStream(imageB64);
      if (r) {
        dispatch({
          type: 'submit_image',
          imageB64,
          requestId: r.requestId,
          turnId: crypto.randomUUID(),
        });
      }
    },
    [doPostAndStream, dispatch],
  );

  const appendNewTurn = useCallback(
    async (imageB64: string) => {
      const r = await doPostAndStream(imageB64);
      if (r) {
        dispatch({
          type: 'append_new_turn',
          imageB64,
          requestId: r.requestId,
          turnId: crypto.randomUUID(),
        });
      }
    },
    [doPostAndStream, dispatch],
  );

  // Cleanup on unmount — D-29 StrictMode-safe.
  useEffect(() => {
    return () => {
      esCloseRef.current?.();
      esCloseRef.current = null;
    };
  }, []);

  // ─── Public helpers (thin wrappers) ──────────────────────────────────────

  const setSignalFilter = useCallback(
    (signal: SignalKey) => {
      dispatch({ type: 'set_signal_filter', signal });
    },
    [dispatch],
  );

  const setCartConfirm = useCallback(
    (item: AddToCartConfirmSummary | null) => {
      dispatch({ type: 'set_cart_confirm', item });
    },
    [dispatch],
  );

  const dismissCartConfirm = useCallback(() => {
    dispatch({ type: 'dismiss_cart_confirm' });
  }, [dispatch]);

  return {
    state,
    submitImage,
    appendNewTurn,
    dispatch,
    setSignalFilter,
    setCartConfirm,
    dismissCartConfirm,
  };
}
