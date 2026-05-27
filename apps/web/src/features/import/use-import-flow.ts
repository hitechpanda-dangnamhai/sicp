'use client';

/**
 * apps/web/src/features/import/use-import-flow.ts
 *
 * React hook: state machine + EventSource lifecycle for /intent-01 page
 * (Image AI Import flow).
 *
 * Slice:    S-07 First Image AI Import
 * Task:     T02.C FE Page Wire (Phiên Sx07-F)
 *
 * **Cloned from** `apps/web/src/features/search/use-search-stream.ts` (271 LOC,
 * Sx04-10 emit) — same Option Z Redis pub/sub pattern; same EventSource-stays-
 * open-through-interrupt-resume contract; adapted for Image modality + 11-state
 * import state machine.
 *
 * Source contract (verified Tier 3 source code):
 *   - `apps/web/lib/sse-client.ts:60-92` — `streamIntent(url, handlers, options)`
 *     typed wrapper; returns close fn.
 *   - `packages/shared-types/src/sse/intent-stream.ts:519-582` — 3 NEW S-07
 *     events form_prefill / market_trend / shopee_compare (shipped Phiên Sx07-D).
 *   - `apps/gateway/src/intent/dto/intent-request.dto.ts` — accepts modality
 *     'text' | 'image' (C-S07-G base64 limit bump).
 *
 * Decisions applied:
 * - **D-S04-13 LAW**: Option Z Redis pub/sub — EventSource STAYS OPEN through
 *   interrupt+resume cycles. Close only on `final` event, `error` event, or unmount.
 * - **D-S04-14 LAW**: phase_progress events route to state-machine action;
 *   sequential render even when BE asyncio.gather parallelizes.
 * - **C-S07-D**: 3 NEW SSE events consumed (form_prefill / market_trend /
 *   shopee_compare) in addition to baseline 5 (status / phase_progress / card /
 *   final / error).
 * - **C-S07-F**: SSE `error` event with `code: 'E_VISION_BLUR'` → state-E
 *   (reducer handles via action.code check).
 * - **C-S07-G**: 8MB image guard at FE; modality='image'; content=base64 inline.
 * - **C-15** 'use client': React hooks + EventSource + crypto.randomUUID.
 * - **D-29 S-03 LAW**: StrictMode-safe — useEffect cleanup closes EventSource
 *   on unmount; setState callback pattern (s => reduceState(s, ...)) avoids
 *   stale closures from React 18 double-mount.
 * - **W1 LOCK**: raw UUID v4 Idempotency-Key (Gateway composites server-side
 *   per intent-action-idempotency.middleware namespace).
 *
 * Public API:
 *   const flow = useImportFlow();
 *   flow.state                       — ImportState (read-only)
 *   flow.uploadImage(b64, fileMeta?) — POST /intent + open EventSource
 *   flow.dispatch(action)            — escape hatch for retake / reset / etc.
 *
 * @see apps/web/src/features/search/use-search-stream.ts (S-04 precedent)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { streamIntent, type IntentStreamHandlers } from '@/lib/sse-client';
import {
  initialState,
  reduceState,
  type ImportAction,
  type ImportState,
} from './import-state-machine';

/** Optional metadata for telemetry — passed through but NOT sent to BE. */
export interface ImageMeta {
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface UseImportFlowReturn {
  state: ImportState;
  /**
   * POST /api/v1/intent with `{content: base64, modality: 'image'}` + open
   * EventSource. Closes prior stream first if open.
   *
   * @param imageBase64  naked base64 (NO `data:image/...;base64,` prefix);
   *                     ImageDropZone strips this for caller via FileReader
   * @param meta         optional file metadata (telemetry passthrough)
   */
  uploadImage: (imageBase64: string, meta?: ImageMeta) => Promise<void>;
  /** Escape hatch for state machine actions (retake / reset / open_shopee_expanded / etc.). */
  dispatch: (action: ImportAction) => void;
}

export function useImportFlow(): UseImportFlowReturn {
  const [state, setState] = useState<ImportState>(initialState);

  // Refs survive React 18 StrictMode double-mount; cleanup only on real unmount.
  const esCloseRef = useRef<(() => void) | null>(null);

  const dispatch = useCallback((action: ImportAction) => {
    setState((s) => reduceState(s, action));
  }, []);

  /**
   * Build typed handler map for streamIntent wrapper.
   *
   * Captures submittedRequestId for handlers (used for telemetry correlation +
   * idempotent state transitions when multiple events arrive for same rid).
   */
  const buildHandlers = useCallback(
    (_submittedRequestId: string): IntentStreamHandlers => ({
      status: (e) => {
        dispatch({ type: 'status', phase: e.phase });
      },
      phase_progress: (e) => {
        dispatch({ type: 'phase_progress', payload: e });
      },
      // S-07 NEW: form_prefill drives state-B / state-F transition
      form_prefill: (e) => {
        dispatch({
          type: 'form_prefill',
          payload: {
            category: e.category,
            attributes: e.attributes,
            ocr_text: e.ocr_text,
            confidence: e.confidence,
            confidence_per_field: e.confidence_per_field as {
              title?: number;
              brand?: number;
              category?: number;
              size?: number;
            },
            alternatives: e.alternatives as { title?: string[]; size?: string[] } | undefined,
            suggested_price: e.suggested_price,
            // Helper extras (passthrough per C-S07-D) — TS Zod schema doesn't
            // strictly type these but BE emits them
            title: (e as unknown as { title?: string }).title,
            description: (e as unknown as { description?: string }).description,
          },
        });
      },
      // S-07 NEW: market_trend drives TrendCard compact + TrendCardExpanded
      market_trend: (e) => {
        dispatch({ type: 'market_trend', payload: e });
      },
      // S-07 NEW: shopee_compare drives ShopeeCompareCard compact + Expanded
      shopee_compare: (e) => {
        dispatch({
          type: 'shopee_compare',
          payload: {
            aggregates: e.aggregates,
            samples: e.samples,
            matched_via: e.matched_via,
          },
        });
      },
      // Action cards from policies (Pattern P2 interrupt #1 resume output)
      card: (e) => {
        // SSE 'card' event is loosely typed at sse-client level (passthrough).
        // Extract well-known fields + spread rest as passthrough.
        const cardData = e as unknown as Record<string, unknown>;
        dispatch({
          type: 'card',
          payload: {
            card_id: String(cardData.card_id ?? cardData.id ?? ''),
            variant: String(cardData.variant ?? cardData.action_type ?? 'UNKNOWN'),
            policy_code: String(cardData.policy_code ?? ''),
            suggestion: cardData.suggestion as Record<string, unknown> | undefined,
            rationale: typeof cardData.rationale === 'string' ? cardData.rationale : undefined,
            ...cardData,
          },
        });
      },
      final: (e) => {
        // Final SSE event = commit success → state-G.
        // BE emits `{status: 'completed', product_id, product_title}` per
        // C-S07-D + importing_by_images.py emit_final.
        const finalData = e as unknown as {
          status?: string;
          product_id?: string;
          product_title?: string;
          text?: string;
        };
        if (finalData.product_id) {
          dispatch({
            type: 'final',
            product_id: finalData.product_id,
            product_title: finalData.product_title ?? 'Sản phẩm',
          });
        }
        // D-S04-13 LAW: close EventSource on terminal `final` event.
        esCloseRef.current?.();
        esCloseRef.current = null;
      },
      error: (e) => {
        // Server-emitted error event — may include `code` (E_VISION_BLUR etc).
        const errData = e as unknown as {
          message?: string;
          code?: string;
          trace_id?: string;
        };
        dispatch({
          type: 'error',
          message: errData.message ?? 'Lỗi không xác định',
          code: errData.code,
          trace_id: errData.trace_id,
        });
      },
    }),
    [dispatch],
  );

  const uploadImage = useCallback(
    async (imageBase64: string, _meta?: ImageMeta) => {
      // 1. Close any prior EventSource (new upload supersedes).
      esCloseRef.current?.();
      esCloseRef.current = null;

      // 2. POST /api/v1/intent — raw UUID Idempotency-Key (W1 LOCK).
      //    modality='image' + content=<base64> per C-S07-G base64 limit.
      const idempotencyKey = crypto.randomUUID();
      const startedAt = performance.now();
      const res = await fetch('/api/v1/intent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          modality: 'image',
          content: imageBase64,
        }),
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

      // 3. Reconstruct image data URL for state-E retake illustration (optional)
      //    Caller-provided meta hints MIME; default to image/jpeg.
      const mimeType = _meta?.mimeType ?? 'image/jpeg';
      const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

      // 4. Dispatch upload transition — state-0 → state-A.
      dispatch({
        type: 'upload',
        requestId: request_id,
        imageDataUrl,
        startedAt,
      });

      // 5. Open SSE EventSource. Wrapper auto-parses JSON; we dispatch to reducer.
      const close = streamIntent(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001'}/api/v1/intent/stream?id=${encodeURIComponent(request_id)}`,
        buildHandlers(request_id),
        {
          onError: () => {
            // Network drop or server close (non-graceful). EventSource
            // auto-reconnects via heartbeat (C-36); we don't dispatch on
            // transient drop to avoid flickering state-E.
          },
        },
      );

      esCloseRef.current = close;
    },
    [buildHandlers, dispatch],
  );

  // Cleanup on unmount — D-29 StrictMode-safe.
  // Pattern (b) — submit-triggered open: uploadImage opens on demand. StrictMode
  // unmount cleanup is correct (server idempotent on subscribe).
  useEffect(() => {
    return () => {
      esCloseRef.current?.();
      esCloseRef.current = null;
    };
  }, []);

  return {
    state,
    uploadImage,
    dispatch,
  };
}
