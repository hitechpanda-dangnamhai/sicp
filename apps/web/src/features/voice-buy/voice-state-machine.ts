/**
 * apps/web/src/features/voice-buy/voice-state-machine.ts
 *
 * Pure state types + reducer for Intent 02 (Voice Buy) flow.
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW (B2)
 *
 * Source:   docs/mockups/intent-02/intent-02-state-{0,A,B,C,D,E,F,G}-*.html (8 states)
 *           CLONED structure from `apps/web/src/features/recommend/recommend-state-machine.ts`
 *           (S-09, 459 LOC): StateKind union → State interface → discriminated Action
 *           union → PhaseProgressMap → initialState → pure helpers (makeTurn/freezeTurn)
 *           → reduceState switch + exhaustive `never` check.
 *
 * Decisions applied:
 * - STRONGEST LAW: FE wires only what BE T01 emitted + test OK (handoff §0). FE
 *   reads BE fields verbatim; KHÔNG tự chế logic, KHÔNG sửa BE.
 * - §2.3 + §3.2: `VoiceErrorCode` is a LOCAL union (E_TRANSCRIBE_FAILED |
 *   E_INTENT_PARSE_FAILED | E_PERMISSION_DENIED | E_NO_SPEECH). NOT imported from
 *   shared-types (no Zod enum exists; error.code = z.string()). Precedent S-07
 *   E_VISION_BLUR.
 * - §2.2 W1 LOCK: clarify chip-row state read from `voice_clarify_options` SSE
 *   event (stored in `clarifyOptions`), NOT from interrupt/resume.
 * - §0.2 LAW: NO telemetry/behavior events (behavior catalog voice gap; deferred).
 * - §3.Z row 4: NO TTS — `audio_reply_b64` is backend-only + graph never emits;
 *   no audio field modeled here.
 * - previousTurns reuse S-09 ConversationTurn pattern 100%.
 *
 * Pure module — NO React imports. Tests exercise reducer in isolation.
 *
 * Typed against `@icp/shared-types/sse` event payload shapes where available
 * (voice_transcribed / voice_clarify_options / stock_issue_ready / empty_state).
 */

import type { IntentStreamEventMap } from '@icp/shared-types/sse';

// ─── Local domain types (§3.2 — NOT in shared-types) ─────────────────────────

/**
 * Voice error codes — local union per §2.3 (error.dto.ts JSDoc-only, no Zod enum).
 * E_PERMISSION_DENIED is FE-side only (BE never raises). Precedent S-07.
 */
export type VoiceErrorCode =
  | 'E_TRANSCRIBE_FAILED'
  | 'E_INTENT_PARSE_FAILED'
  | 'E_PERMISSION_DENIED'
  | 'E_NO_SPEECH';

/** Parsed item from LLM intent parse (one product reference in the utterance). */
export interface VoiceItem {
  query: string;
  qty: number;
  unit?: string;
  ordinal_ref?: string;
}

/** Matched product (Vespa hit shape) — RAW match_score 0..~30 per §4 (NOT a pct). */
export interface VoiceMatchedProduct {
  product_id: string;
  title: string;
  brand: string;
  price: number;
  original_price?: number | null;
  image_gradient?: string | null;
  image_icon?: string | null;
  /** RAW score 0..~30 (BE does NOT wrap pct for state-C — §4 KNOWN-ISSUE). */
  match_score?: number | null;
  qty: number;
}

/** One ambiguous item awaiting clarify (mirrors voice_clarify_options.ambiguous_items[n]). */
export interface AmbiguousItem {
  item_idx: number;
  query: string;
  qty: number;
  candidates: IntentStreamEventMap['voice_clarify_options']['ambiguous_items'][number]['candidates'];
}

/** D-S09-NN-B pattern reuse: frozen snapshot of one utterance+result cycle. */
export interface ConversationTurn {
  turnId: string;
  requestId: string;
  voiceText: string;
  matchedProducts: VoiceMatchedProduct[];
  startedAtMs: number;
}

// ─── Public state types ──────────────────────────────────────────────────────

/**
 * 8 logical phases tracking 8 mockup states.
 *
 * Mapping (mockup → phase):
 * - intent-02-state-0-mic-idle.html       → 'idle'
 * - intent-02-state-A-listening.html      → 'listening'
 * - intent-02-state-B-transcribing.html   → 'transcribing'
 * - intent-02-state-C-cart-ready.html     → 'cart-ready'
 * - intent-02-state-D-clarify.html        → 'clarifying'
 * - intent-02-state-E-cart-added.html     → 'cart-added'
 * - intent-02-state-F-no-match.html       → 'no-match'
 * - intent-02-state-G-error.html          → 'error'
 */
export type VoicePhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'cart-ready'
  | 'clarifying'
  | 'cart-added'
  | 'cart-removed'
  | 'no-match'
  | 'error';

export interface VoiceState {
  phase: VoicePhase;
  audioBlob: Blob | null;
  voiceText: string;
  parsedItems: VoiceItem[];
  matchedProducts: VoiceMatchedProduct[];
  /** Pattern A interrupt awaiting a resume action. */
  pendingInterrupt: { awaiting: 'clarify_pick' | 'stock_action'; rid: string } | null;
  /** From voice_clarify_options SSE (W1 LOCK — NOT from interrupt/resume). */
  clarifyOptions: {
    request_id: string;
    resolved: number;
    total: number;
    ambiguous_items: AmbiguousItem[];
  } | null;
  /** Per-item stock replacement from stock_issue_ready (state-F). */
  stockReplacements: Record<
    string,
    IntentStreamEventMap['stock_issue_ready']['replacement']
  >;
  /** SSE empty_state payload (no_match / 0-result, state-F). */
  emptyState: IntentStreamEventMap['empty_state'] | null;
  /** Phase progress for state-B PhasesCard (4 phases). */
  phases: PhaseProgressMap;
  /** Cart summary echo from cart_updated (state-E). */
  cartUpdated: IntentStreamEventMap['cart_updated'] | null;
  /** Co-purchase suggestion (null-safe render — C-S08-T). */
  coPurchaseHint: IntentStreamEventMap['co_purchase_hint'] | null;
  previousTurns: ConversationTurn[];
  activeUtteranceRid: string | null;
  errorCode: VoiceErrorCode | null;
  /** Free-text error message from SSE `error` event (rendered with errorCode). */
  errorMessage: string | null;
}

// ─── Phase progress map (state-B 4 phases) ───────────────────────────────────

export type VoicePhaseSlot = {
  phase_id: number;
  label: string;
  status: 'active' | 'done' | 'pending';
  ms?: number;
  meta?: string;
};

export type PhaseProgressMap = Record<number, VoicePhaseSlot>;

/**
 * Mockup state-B phase labels (intent-02-state-B-transcribing.html). BE emits
 * `phase_progress`; FE uses these as fallback. Narrative kept generic ("STT")
 * per handoff §5 — STT is OpenAI (D-12), label is cosmetic.
 */
const PHASE_LABEL_FALLBACK: Record<number, string> = {
  0: 'Chuyển âm thanh thành chữ',
  1: 'Tách sản phẩm từ câu nói',
  2: 'Tìm sản phẩm trong shop',
  3: 'Chuẩn bị giỏ tạm',
};

// ─── Action union (discriminated — each has a reducer case) ───────────────────

export type VoiceAction =
  | { type: 'submit_utterance'; audioBlob: Blob | null; requestId: string; turnId: string }
  | { type: 'voice_transcribed'; payload: IntentStreamEventMap['voice_transcribed'] }
  | { type: 'phase_progress'; payload: IntentStreamEventMap['phase_progress'] }
  | { type: 'understanding'; items: VoiceItem[] }
  | { type: 'products'; matched: VoiceMatchedProduct[] }
  | { type: 'clarify_options'; payload: IntentStreamEventMap['voice_clarify_options'] }
  | { type: 'empty_state'; payload: IntentStreamEventMap['empty_state'] }
  | { type: 'stock_issue_ready'; payload: IntentStreamEventMap['stock_issue_ready'] }
  | { type: 'cart_updated'; payload: IntentStreamEventMap['cart_updated'] }
  | { type: 'co_purchase_hint'; payload: IntentStreamEventMap['co_purchase_hint'] }
  | { type: 'error'; message: string }
  | { type: 'set_error_code'; code: VoiceErrorCode }
  | { type: 'start_listening' }
  | { type: 'cancel_listening' }
  | { type: 'append_turn' }
  | { type: 'reset' };

// ─── Initial state ───────────────────────────────────────────────────────────

export const initialState: VoiceState = {
  phase: 'idle',
  audioBlob: null,
  voiceText: '',
  parsedItems: [],
  matchedProducts: [],
  pendingInterrupt: null,
  clarifyOptions: null,
  stockReplacements: {},
  emptyState: null,
  phases: {},
  cartUpdated: null,
  coPurchaseHint: null,
  previousTurns: [],
  activeUtteranceRid: null,
  errorCode: null,
  errorMessage: null,
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Freeze current cycle into a ConversationTurn for previousTurns[] archival. */
function freezeTurn(state: VoiceState): ConversationTurn | null {
  if (!state.activeUtteranceRid) return null;
  return {
    turnId: state.activeUtteranceRid,
    requestId: state.activeUtteranceRid,
    voiceText: state.voiceText,
    matchedProducts: state.matchedProducts,
    startedAtMs: Date.now(),
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Pure reducer — state + action → new state. NEVER mutates input. SSE events
 * fire concurrently → React batches via `setState(s => reduceState(s, action))`.
 */
export function reduceState(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'start_listening':
      // idle → listening. Fresh utterance window; preserve previousTurns.
      return {
        ...initialState,
        phase: 'listening',
        previousTurns: state.previousTurns,
      };

    case 'cancel_listening':
      // listening → idle (X cancel). Discard audio; preserve previousTurns.
      return {
        ...initialState,
        phase: 'idle',
        previousTurns: state.previousTurns,
      };

    case 'submit_utterance':
      // listening (stop) → transcribing. POST done; SSE opening. Start fresh turn rid.
      return {
        ...state,
        phase: 'transcribing',
        audioBlob: action.audioBlob,
        activeUtteranceRid: action.requestId,
        // Reset SSE-derived fields for the new request.
        voiceText: '',
        parsedItems: [],
        matchedProducts: [],
        pendingInterrupt: null,
        clarifyOptions: null,
        stockReplacements: {},
        emptyState: null,
        phases: {},
        cartUpdated: null,
        coPurchaseHint: null,
        errorCode: null,
        errorMessage: null,
      };

    case 'voice_transcribed':
      // Cosmetic STT text (D-07 — no real partial). Surface in user bubble.
      return { ...state, voiceText: action.payload.text };

    case 'phase_progress': {
      const p = action.payload as IntentStreamEventMap['phase_progress'] & {
        phase_id: number;
        status: 'active' | 'done' | 'pending';
        label?: string;
        ms?: number;
        meta?: string;
      };
      const slot: VoicePhaseSlot = {
        phase_id: p.phase_id,
        label: p.label ?? PHASE_LABEL_FALLBACK[p.phase_id] ?? '',
        status: p.status === 'active' || p.status === 'done' ? p.status : 'pending',
        ms: p.ms,
        meta: p.meta,
      };
      return { ...state, phases: { ...state.phases, [p.phase_id]: slot } };
    }

    case 'understanding':
      // LLM parsed items → state-B peek-card list.
      return { ...state, parsedItems: action.items };

    case 'products':
      // Matched products ready → state-C cart-ready.
      return {
        ...state,
        phase: 'cart-ready',
        matchedProducts: action.matched,
      };

    case 'clarify_options':
      // W1 LOCK: chip-row data from this SSE event. → state-D clarifying.
      return {
        ...state,
        phase: 'clarifying',
        clarifyOptions: {
          request_id: action.payload.request_id,
          resolved: action.payload.resolved,
          total: action.payload.total,
          ambiguous_items: action.payload.ambiguous_items,
        },
        pendingInterrupt: { awaiting: 'clarify_pick', rid: action.payload.request_id },
      };

    case 'empty_state':
      // no_product_ref / 0-result → state-F no-match.
      return {
        ...state,
        phase: 'no-match',
        emptyState: action.payload,
      };

    case 'stock_issue_ready': {
      // Per-item replacement candidate (state-F). null replacement → "Bỏ" only.
      const { product_id, replacement } = action.payload;
      return {
        ...state,
        phase: 'no-match',
        stockReplacements: { ...state.stockReplacements, [product_id]: replacement },
        pendingInterrupt:
          state.pendingInterrupt ?? { awaiting: 'stock_action', rid: state.activeUtteranceRid ?? '' },
      };
    }

    case 'cart_updated': {
      // Cart mutated. BE emits two distinct cart_updated shapes (verified
      // buying_by_voices.py): add/update_qty path (bulk_cart_commit) →
      // { committed_count, action }; remove path (voice_cart_remove) →
      // { removed_count } (no committed_count, no action). FE must NOT treat
      // a remove as "Đã thêm" (bug #4 Sx08-I). Detect remove defensively by
      // the presence of removed_count → state-removed; else state-E added.
      const p = action.payload as Record<string, unknown>;
      const isRemove =
        typeof p.removed_count === 'number' && p.committed_count === undefined;
      return {
        ...state,
        phase: isRemove ? 'cart-removed' : 'cart-added',
        cartUpdated: action.payload,
        pendingInterrupt: null,
        clarifyOptions: null,
      };
    }

    case 'co_purchase_hint':
      return { ...state, coPurchaseHint: action.payload };

    case 'error':
      return { ...state, phase: 'error', errorMessage: action.message };

    case 'set_error_code':
      // FE-side error (e.g. E_PERMISSION_DENIED) → state-G error.
      return { ...state, phase: 'error', errorCode: action.code };

    case 'append_turn': {
      // Collapse current cycle → previousTurns[]; reset to idle for "Mua tiếp".
      const frozen = freezeTurn(state);
      return {
        ...initialState,
        phase: 'idle',
        previousTurns: frozen ? [...state.previousTurns, frozen] : state.previousTurns,
      };
    }

    case 'reset':
      return { ...initialState };

    default: {
      // Exhaustive check — TS compile error if a new action lacks a case.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
