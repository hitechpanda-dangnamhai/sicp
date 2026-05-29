'use client';

/**
 * apps/web/src/features/voice-analyze/use-analyze-stream.ts
 *
 * React hook: analytics state machine + EventSource lifecycle + SSE handlers for
 * /intent-07 page (Voice Analytics, Intent 07).
 *
 * Slice:    S-10 First Voice Analytics Flow — V-SLICE, Phần H (T01).
 * Source:   CLONED from `voice-buy/use-voice-stream.ts` (S-08). Same EventSource
 *           lifecycle (D-S04-13: stays open through stream, closes on `final`),
 *           same streamIntent wrapper + IntentStreamHandlers mapped type.
 *
 * Key deltas vs voice-buy:
 * - POST body adds `hint: 'analyze'` — the dispatch discriminator the AI
 *   service reads as `entry_intent` (main.py: `entry_intent=='analyze'` →
 *   analyzing graph; else → buying). Sent as `hint` (NOT `entry_intent`)
 *   because the gateway IntentRequestSchema strips unknown body keys.
 * - Handlers consume analytics events: phase_progress(string phase),
 *   voice_transcribed, understanding, chart, analytics_cards, analytics_clarify,
 *   partial_text(narrative), final(voice_action), error.
 * - Local narrowing for documented schema drift (governance C-S10-NN-*):
 *     · chart.x_axis is array (base schema typed string) → cast.
 *     · phase_progress.phase is string (base schema has phase_id) → cast.
 *   These are runtime-safe (nothing validates SSE at runtime; intent-07 is the
 *   sole consumer page) and only require a TS cast here.
 *
 * Public API mirrors useVoiceStream: { state, submitUtterance, dispatch }.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { streamIntent, type IntentStreamHandlers } from '@/lib/sse-client';
import {
  initialState,
  reduceState,
  type AnalyzeAction,
  type AnalyzeState,
  type AnalyzePhaseKey,
  type AnalyzeChartData,
} from './analyze-state-machine';

export interface UseAnalyzeStreamReturn {
  state: AnalyzeState;
  /** POST /intent (voice + hint=analyze) + open EventSource. */
  submitUtterance: (audioBase64: string) => Promise<void>;
  dispatch: (action: AnalyzeAction) => void;
}

const VALID_PHASES: ReadonlySet<string> = new Set([
  'transcribe',
  'classify',
  'query',
  'narrate',
]);

export function useAnalyzeStream(): UseAnalyzeStreamReturn {
  const [state, setState] = useState<AnalyzeState>(initialState);
  const esCloseRef = useRef<(() => void) | null>(null);

  const dispatch = useCallback((action: AnalyzeAction) => {
    setState((s) => reduceState(s, action));
  }, []);

  const buildHandlers = useCallback((): IntentStreamHandlers => ({
    status: () => {
      // load_context / awaiting_user_input — phase transitions driven by the
      // dedicated events below; no-op here.
    },
    phase_progress: (e) => {
      // Drift: analytics graph emits {phase:<string>} (base schema has phase_id).
      const phase = (e as unknown as { phase?: string }).phase;
      if (phase && VALID_PHASES.has(phase)) {
        dispatch({ type: 'phase', key: phase as AnalyzePhaseKey });
      }
    },
    voice_transcribed: (e) => {
      const p = e as unknown as { text?: string; confidence?: number };
      dispatch({
        type: 'voice_transcribed',
        text: p.text ?? '',
        confidence: typeof p.confidence === 'number' ? p.confidence : 0,
      });
    },
    understanding: (e) => {
      dispatch({ type: 'understanding', text: e.text ?? '' });
    },
    chart: (e) => {
      // Drift: analytics chart overloads x_axis as a category[] (base = string).
      const raw = e as unknown as {
        type?: 'line' | 'bar' | 'pie';
        title?: string;
        y_axis?: string;
        x_axis?: string[];
        series?: { name: string; data: number[] }[];
      };
      const chart: AnalyzeChartData = {
        type: raw.type ?? 'line',
        title: raw.title ?? '',
        yAxis: raw.y_axis ?? '',
        labels: Array.isArray(raw.x_axis) ? raw.x_axis : [],
        values: raw.series?.[0]?.data ?? [],
      };
      dispatch({ type: 'chart', chart });
    },
    tool_result: () => {
      // Light usage summary (analytics.detect_anomaly) — no UI state needed.
    },
    partial_text: (e) => {
      // Graph emits partial_text twice (transcript echo, then narrative). The
      // last one is the narrative; we keep latest. Transcript is shown from
      // voice_transcribed, so an early overwrite is harmless (result-only view).
      const txt = (e as unknown as { text?: string }).text;
      if (txt) dispatch({ type: 'narrative', text: txt });
    },
    analytics_cards: (e) => {
      const p = e as unknown as {
        cards?: AnalyzeState['cards'];
        reasoning?: AnalyzeState['reasoning'];
      };
      dispatch({
        type: 'cards',
        cards: p.cards ?? [],
        reasoning: p.reasoning ?? null,
      });
    },
    analytics_clarify: (e) => {
      const p = e as unknown as {
        question?: string;
        options?: AnalyzeState['clarifyOptions'];
      };
      dispatch({
        type: 'clarify',
        question: p.question ?? '',
        options: p.options ?? [],
      });
    },
    final: (e) => {
      esCloseRef.current?.();
      esCloseRef.current = null;
      const voiceAction = (e as unknown as { voice_action?: string }).voice_action ?? null;
      dispatch({ type: 'final', voiceAction });
    },
    error: (e) => {
      esCloseRef.current?.();
      esCloseRef.current = null;
      const p = e as unknown as { message?: string; code?: string };
      dispatch({ type: 'error', message: p.message ?? 'Đã xảy ra lỗi', code: p.code });
    },
  }), [dispatch]);

  const submitUtterance = useCallback(
    async (audioBase64: string) => {
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
        body: JSON.stringify({
          modality: 'voice',
          // Dispatch discriminator → analyzing graph. The AI service reads the
          // body field `hint` (main.py: `entry_intent = payload.get("hint")`)
          // and routes voice→analytics only when it equals 'analyze'
          // (main.py: `modality=='voice' and entry_intent=='analyze'`). The
          // gateway DTO (IntentRequestSchema) strips unknown keys, so sending
          // `entry_intent` here would be dropped before reaching the AI and the
          // request would mis-route to buying_by_voices. MUST be `hint`.
          hint: 'analyze',
          content: audioBase64,
        }),
      });

      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow */
        }
        dispatch({
          type: 'error',
          message: `POST /intent failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
          code: 'E_POST_FAILED',
        });
        return;
      }

      const { request_id } = (await res.json()) as { request_id: string };
      dispatch({ type: 'submit', requestId: request_id });

      const close = streamIntent(
        `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001'}/api/v1/intent/stream?id=${encodeURIComponent(request_id)}`,
        buildHandlers(),
        {
          onError: () => {
            // Transient drop — EventSource auto-reconnects (mirror S-04/S-08).
          },
        },
      );
      esCloseRef.current = close;
    },
    [buildHandlers, dispatch],
  );

  useEffect(() => {
    return () => {
      esCloseRef.current?.();
      esCloseRef.current = null;
    };
  }, []);

  return { state, submitUtterance, dispatch };
}
