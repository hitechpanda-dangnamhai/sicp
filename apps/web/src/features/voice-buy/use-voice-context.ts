'use client';

/**
 * apps/web/src/features/voice-buy/use-voice-context.ts
 *
 * React hook: FE-side voice conversation context (previousTurns) selector +
 * PreviousTurnChip summary composition.
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW (B5)
 *
 * Source:   NEW (small). Reuses S-09 previousTurns pattern.
 *
 * Decisions applied:
 * - §3.5: minimal selector/helper reading `voiceState.previousTurns` + composing
 *   a summary string for <PreviousTurnChip> ("Câu hỏi trước · {N} sản phẩm").
 * - BE may emit `voice_history` (last 5 turns) via initial SSE / understanding;
 *   that hydration lands in voiceState.previousTurns through the reducer. This
 *   hook only DERIVES display state — no fetching, no mutation.
 * - C-15 'use client': consumed in a client page (pure derivation, but colocated).
 */

import { useMemo } from 'react';
import type { ConversationTurn, VoiceState } from './voice-state-machine';

export interface PreviousTurnSummary {
  turnId: string;
  /** Composed chip label, e.g. "Câu hỏi trước · 2 sản phẩm". */
  summary: string;
  /** Raw turn for callers that need fields beyond the summary. */
  turn: ConversationTurn;
}

export interface UseVoiceContextReturn {
  /** Whether any prior turn exists (gate PreviousTurnChip rendering). */
  hasPreviousTurns: boolean;
  /** Most recent prior turn summary, or null. */
  latestPreviousTurn: PreviousTurnSummary | null;
  /** All prior turns (chronological), composed. */
  previousTurnSummaries: PreviousTurnSummary[];
}

/** Compose a PreviousTurnChip label from a turn (handoff §3.5). */
function composeSummary(turn: ConversationTurn): string {
  const n = turn.matchedProducts.length;
  if (n > 0) {
    return `Câu hỏi trước · ${n} sản phẩm`;
  }
  // Fallback to the utterance text when no products were matched.
  const text = turn.voiceText.trim();
  return text ? `Câu hỏi trước · "${text}"` : 'Câu hỏi trước';
}

export function useVoiceContext(state: VoiceState): UseVoiceContextReturn {
  return useMemo(() => {
    const summaries: PreviousTurnSummary[] = state.previousTurns.map((turn) => ({
      turnId: turn.turnId,
      summary: composeSummary(turn),
      turn,
    }));
    const latest = summaries.length > 0 ? summaries[summaries.length - 1] : null;
    return {
      hasPreviousTurns: summaries.length > 0,
      latestPreviousTurn: latest,
      previousTurnSummaries: summaries,
    };
  }, [state.previousTurns]);
}
