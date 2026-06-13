'use client';

/**
 * apps/web/src/features/voice-buy/use-voice-stream.ts
 *
 * React hook: voice state machine + EventSource lifecycle + SSE handlers for
 * /intent-02 page.
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW (B4)
 *
 * Source:   CLONED from `apps/web/src/features/search/use-search-stream.ts`
 *           (S-04, 281 LOC, ~20% diff). Uses `streamIntent(url, handlers, options)`
 *           + `IntentStreamHandlers` mapped type from `@/lib/sse-client`.
 *
 * Decisions applied:
 * - §0.2 LAW: NO telemetry — search's tracking-hooks (trackSearchFirstCardRendered
 *   + perceived-latency refs) are REMOVED. Behavior catalog voice events deferred.
 * - D-S04-13 LAW: EventSource STAYS OPEN through interrupt+resume; closes ONLY on
 *   `final` event (esCloseRef.current?.() in `final` handler), error, or unmount.
 * - §3.2 IntentStreamHandlers is a mapped type {[K in IntentStreamEventType]?: ...}
 *   → adding voice_transcribed / voice_clarify_options / empty_state /
 *   stock_issue_ready / stock_issue_summary / partial_text handler keys typechecks
 *   WITHOUT touching sse-client.ts or BE (keys already in IntentStreamEventMap).
 * - §1: POST /api/v1/intent body {modality:'voice', content:<base64-audio>, mode?}
 *   (verified main.py L348 `elif modality_dispatch=='voice'`) + raw UUID
 *   Idempotency-Key (W1 LOCK) + credentials:'include'. SSE at GATEWAY_URL.
 * - partial_text handler optional/no-op (cosmetic; must not crash — §2.1).
 * - D-29 StrictMode-safe: refs + setState(s => reduceState(s, action)).
 *
 * Public API:
 *   const stream = useVoiceStream();
 *   stream.state                  — VoiceState (read-only)
 *   stream.submitUtterance(b64)   — POST /intent + open EventSource
 *   stream.dispatch(action)       — escape hatch (start_listening / reset / etc.)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamIntent, type IntentStreamHandlers } from '@/lib/sse-client';
import { tenantHeaders } from '@/lib/api-client';
import { CART_QUERY_KEY } from '@/src/features/cart/use-cart';
import {
  initialState,
  reduceState,
  type VoiceAction,
  type VoiceState,
  type VoiceItem,
  type VoiceMatchedProduct,
} from './voice-state-machine';

export interface UseVoiceStreamReturn {
  state: VoiceState;
  /** POST /intent (voice) + open EventSource. Closes prior stream first if open. */
  submitUtterance: (audioBase64: string, mode?: string) => Promise<void>;
  /** Escape hatch for state machine actions. */
  dispatch: (action: VoiceAction) => void;
}

export function useVoiceStream(): UseVoiceStreamReturn {
  const [state, setState] = useState<VoiceState>(initialState);
  // TanStack QueryClient — invalidate cart cache on cart_updated so the cart
  // page reflects server truth without a hard refresh (D-S05-11 parity with
  // use-cart-stream; voice-buy previously only updated its local reducer).
  const queryClient = useQueryClient();

  // Refs survive React 18 StrictMode double-mount; cleanup only on real unmount.
  const esCloseRef = useRef<(() => void) | null>(null);

  const dispatch = useCallback((action: VoiceAction) => {
    setState((s) => reduceState(s, action));
  }, []);

  /** Build typed handler map for streamIntent wrapper. */
  const buildHandlers = useCallback((): IntentStreamHandlers => ({
    status: () => {
      // No-op: phase transitions driven by products/clarify/empty/error events.
    },
    phase_progress: (e) => {
      dispatch({ type: 'phase_progress', payload: e });
    },
    voice_transcribed: (e) => {
      dispatch({ type: 'voice_transcribed', payload: e });
    },
    understanding: (e) => {
      // ⚠️ KNOWN-ISSUE (verified Sx08-G): typed SseUnderstandingEvent is
      // {text, highlighted_terms} — it does NOT carry parsed `items` for the
      // voice graph. We read defensively; if BE later adds an items field to the
      // voice understanding payload, state-B peek-card lights up automatically.
      // Until then parsedItems stays [] and the peek-card is hidden. KHÔNG bịa.
      const raw = e as unknown as { items?: VoiceItem[] };
      dispatch({ type: 'understanding', items: raw.items ?? [] });
    },
    products: (e) => {
      // Map BE products payload → VoiceMatchedProduct[] (read fields verbatim).
      const items = (e.items ?? []) as unknown as VoiceMatchedProduct[];
      dispatch({ type: 'products', matched: items });
    },
    voice_clarify_options: (e) => {
      dispatch({ type: 'clarify_options', payload: e });
    },
    empty_state: (e) => {
      dispatch({ type: 'empty_state', payload: e });
    },
    stock_issue_ready: (e) => {
      dispatch({ type: 'stock_issue_ready', payload: e });
    },
    stock_issue_summary: () => {
      // Terminal "all replacements ready" signal — state already 'no-match';
      // FE waits for user resolve action. No extra state mutation needed.
    },
    co_purchase_hint: (e) => {
      dispatch({ type: 'co_purchase_hint', payload: e });
    },
    cart_updated: (e) => {
      dispatch({ type: 'cart_updated', payload: e });
      // Terminal cart mutation (add / remove e.g. "bỏ dầu ăn khỏi giỏ") — refetch
      // server truth so the cart page is fresh on next view (no hard refresh).
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
    partial_text: () => {
      // Cosmetic incremental token stream (§2.1). Optional — no-op, must not crash.
    },
    final: () => {
      // D-S04-13 LAW: close EventSource on terminal `final` (graph done).
      esCloseRef.current?.();
      esCloseRef.current = null;
    },
    error: (e) => {
      dispatch({ type: 'error', message: e.message });
    },
  }), [dispatch, queryClient]);

  const submitUtterance = useCallback(
    async (audioBase64: string, mode?: string) => {
      // 1. Close any prior EventSource (new utterance supersedes).
      esCloseRef.current?.();
      esCloseRef.current = null;

      // 2. POST /api/v1/intent — raw UUID Idempotency-Key (W1 LOCK).
      const idempotencyKey = crypto.randomUUID();
      const body: Record<string, unknown> = {
        modality: 'voice',
        content: audioBase64,
      };
      if (mode) body.mode = mode;

      const res = await fetch('/api/v1/intent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...tenantHeaders(), // T02b-hotfix: resolver header-only (ADR-046 amend c)
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow secondary parse error */
        }
        dispatch({
          type: 'error',
          message: `POST /intent failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
        });
        return;
      }

      const { request_id } = (await res.json()) as { request_id: string };

      // 3. Dispatch submit transition — listening(stopped) → transcribing.
      dispatch({
        type: 'submit_utterance',
        audioBlob: null,
        requestId: request_id,
        turnId: request_id,
      });

      // 4. Open SSE EventSource. Wrapper auto-parses JSON; we dispatch to reducer.
      const close = streamIntent(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001'}/api/v1/intent/stream?id=${encodeURIComponent(request_id)}`,
        buildHandlers(),
        {
          onError: () => {
            // Transient network drop — EventSource auto-reconnects via heartbeat.
            // Do not dispatch on transient drop (mirror S-04 use-search-stream).
          },
        },
      );

      esCloseRef.current = close;
    },
    [buildHandlers, dispatch],
  );

  // Cleanup on unmount — D-29 StrictMode-safe (open-on-demand pattern, mirror S-04).
  useEffect(() => {
    return () => {
      esCloseRef.current?.();
      esCloseRef.current = null;
    };
  }, []);

  return {
    state,
    submitUtterance,
    dispatch,
  };
}
