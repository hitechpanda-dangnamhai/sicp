'use client';

/**
 * apps/web/src/features/voice-analyze/analyze-state-machine.ts
 *
 * State machine for Intent 07 (Voice Analytics). Pure reducer + types.
 *
 * Slice:    S-10 First Voice Analytics Flow (Intent 07) — V-SLICE, Phần H (T01).
 * Source:   Structure CLONED from `voice-buy/voice-state-machine.ts` (S-08) but
 *           analytics-specific (chart + reasoning cards instead of cart/clarify).
 *
 * D-S10-NN-G: every number the UI shows comes from engine `analytics_cards` /
 * `chart` payloads (math-first). This reducer NEVER fabricates numbers.
 *
 * Types are derived from `@icp/shared-types/sse` (verified subpath) so they stay
 * 1:1 with the deployed graph; `chart.x_axis` / `phase_progress.phase` carry a
 * documented drift vs the base S-02/S-04 schemas → narrowed at the hook layer.
 */

import type { IntentStreamEventMap } from '@icp/shared-types/sse';

// --- Engine-derived types (single source of truth = SSE event map) ----------
export type AnalyticsCardsPayload = IntentStreamEventMap['analytics_cards'];
export type AnalyticsCard = AnalyticsCardsPayload['cards'][number];
export type AnalyticsReasoning = AnalyticsCardsPayload['reasoning'];
export type AnalyticsClarifyOption =
  IntentStreamEventMap['analytics_clarify']['options'][number];

export type AnalyzeStatus =
  | 'idle'
  | 'listening'
  | 'analyzing'
  | 'result'
  | 'empty'
  | 'clarify'
  | 'error';

/** phase_progress string phase → AnalyzingPhasesCard numeric phase_id. */
export type AnalyzePhaseKey = 'transcribe' | 'classify' | 'query' | 'narrate';
export const PHASE_ID: Record<AnalyzePhaseKey, 0 | 1 | 2 | 3> = {
  transcribe: 0,
  classify: 1,
  query: 2,
  narrate: 3,
};
export type PhaseSlotStatus = 'active' | 'done' | 'pending';

export interface AnalyzeChartData {
  type: 'line' | 'bar' | 'pie';
  title: string;
  yAxis: string;
  labels: string[];
  values: number[];
}

export interface AnalyzeState {
  status: AnalyzeStatus;
  requestId: string | null;
  transcript: string | null;
  confidence: number | null;
  phases: Record<0 | 1 | 2 | 3, PhaseSlotStatus>;
  understanding: string | null;
  chart: AnalyzeChartData | null;
  narrative: string | null;
  cards: AnalyticsCard[];
  reasoning: AnalyticsReasoning;
  clarifyQuestion: string | null;
  clarifyOptions: AnalyticsClarifyOption[];
  errorMessage: string | null;
  errorCode: string | null;
}

export const initialState: AnalyzeState = {
  status: 'idle',
  requestId: null,
  transcript: null,
  confidence: null,
  phases: { 0: 'pending', 1: 'pending', 2: 'pending', 3: 'pending' },
  understanding: null,
  chart: null,
  narrative: null,
  cards: [],
  reasoning: null,
  clarifyQuestion: null,
  clarifyOptions: [],
  errorMessage: null,
  errorCode: null,
};

export type AnalyzeAction =
  | { type: 'start_listening' }
  | { type: 'submit'; requestId: string }
  | { type: 'voice_transcribed'; text: string; confidence: number }
  | { type: 'phase'; key: AnalyzePhaseKey }
  | { type: 'understanding'; text: string }
  | { type: 'chart'; chart: AnalyzeChartData }
  | { type: 'narrative'; text: string }
  | { type: 'cards'; cards: AnalyticsCard[]; reasoning: AnalyticsReasoning }
  | { type: 'clarify'; question: string; options: AnalyticsClarifyOption[] }
  | { type: 'dismiss_card'; index: number }
  | { type: 'final'; voiceAction: string | null }
  | { type: 'error'; message: string; code?: string }
  | { type: 'reset' };

/** Mark phase `id` active; every lower phase becomes done; higher stay pending. */
function markPhase(
  phases: AnalyzeState['phases'],
  id: 0 | 1 | 2 | 3,
): AnalyzeState['phases'] {
  const next = { ...phases };
  ([0, 1, 2, 3] as const).forEach((k) => {
    if (k < id) next[k] = 'done';
    else if (k === id) next[k] = 'active';
  });
  return next;
}

export function reduceState(state: AnalyzeState, action: AnalyzeAction): AnalyzeState {
  switch (action.type) {
    case 'start_listening':
      return { ...initialState, status: 'listening' };

    case 'submit':
      return { ...state, status: 'analyzing', requestId: action.requestId };

    case 'voice_transcribed':
      return {
        ...state,
        status: 'analyzing',
        transcript: action.text,
        confidence: action.confidence,
        phases: markPhase(state.phases, PHASE_ID.transcribe),
      };

    case 'phase':
      return {
        ...state,
        status: state.status === 'idle' || state.status === 'listening'
          ? 'analyzing'
          : state.status,
        phases: markPhase(state.phases, PHASE_ID[action.key]),
      };

    case 'understanding':
      return { ...state, status: 'analyzing', understanding: action.text };

    case 'chart':
      return { ...state, chart: action.chart };

    case 'narrative':
      return { ...state, narrative: action.text };

    case 'cards':
      return { ...state, cards: action.cards, reasoning: action.reasoning };

    case 'clarify':
      return {
        ...state,
        status: 'clarify',
        clarifyQuestion: action.question,
        clarifyOptions: action.options,
      };

    case 'dismiss_card':
      return {
        ...state,
        cards: state.cards.filter((_, i) => i !== action.index),
      };

    case 'final': {
      // Terminal: empty if engine reported no data; else show result.
      if (state.status === 'error' || state.status === 'clarify') return state;
      if (action.voiceAction === '__nodata__') {
        return { ...state, status: 'empty' };
      }
      const hasOutput =
        !!state.chart || state.cards.length > 0 || !!state.narrative;
      return {
        ...state,
        status: hasOutput ? 'result' : 'empty',
        phases: { 0: 'done', 1: 'done', 2: 'done', 3: 'done' },
      };
    }

    case 'error':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message,
        errorCode: action.code ?? null,
      };

    case 'reset':
      return initialState;

    default:
      return state;
  }
}
