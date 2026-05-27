/**
 * apps/web/src/features/recommend/recommend-state-machine.ts
 *
 * Pure state types + reducer for Intent 04 (Image Recommendation) flow.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F)
 *
 * Source:   docs/mockups/intent-04/intent-04-state-{0,A,B,C,D,E,F}-*.html (7 states)
 *           CLONED + MODIFIED from `apps/web/src/features/search/search-state-machine.ts`
 *           (S-04 ship 413 LOC, ~30% diff per Phiên Sx09-E reuse-max audit Section 6.B)
 *
 * Decisions applied:
 * - D-S09-NN-A LAW: Filter chips state-D = client-side instant re-rank (Option α).
 *   Reducer dispatches `set_signal_filter`; selector `composeBySignal` imported
 *   from `@icp/shared-types/recommendations` (DO NOT re-implement; T01 ship).
 * - D-S09-NN-B LAW: Re-upload state-F = FE-only thread persistence + new
 *   request_id per upload (Option α). Reducer action `append_new_turn` collapses
 *   `currentTurn` → `previousTurns[]` and starts fresh turn.
 * - D-S04-13 LAW (cross-slice): Pattern A Adaptive Interrupt+Resume EventSource
 *   lifecycle reused via `use-recommend-stream.ts` (close on `final`).
 * - D-S04-14 LAW (cross-slice): per-index `products` array slot driven by
 *   `product_ready` SSE event; `totalExpected` from `product_ready.total`.
 * - C-S09-F: SSE event drift → 7-event pattern reuse (skip typo/variant_degraded
 *   which are text-search only).
 * - C-S09-AP NEW (Phiên Sx09-F): Dynamic turn counter `N = previousTurns.length + 1`
 *   computed page-level (NOT reducer field) — pure derived state.
 *
 * Pure module — NO React imports. Tests exercise reducer in isolation.
 *
 * Typed against `@icp/shared-types/sse` event payload shapes + `RecommendedProduct`
 * from `@icp/shared-types/recommendations` (T01 ship Phiên Sx09-C).
 */

import type { IntentStreamEventMap } from '@icp/shared-types/sse';
import type {
  RecommendedProduct,
  RecommendationResponse,
  RecommendationEmptyReason,
  RecommendationErrorCode,
  DetectedContext,
  CoPurchaseHint,
  SignalKey,
} from '@icp/shared-types/recommendations';

// Re-export for convenience (page wire imports `SignalKey` as `activeSignalFilter`)
export type { RecommendedProduct, SignalKey };

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * 7 logical state kinds tracking 7 mockup states.
 *
 * Mapping (mockup → kind):
 * - intent-04 page mount (no upload)              → 'idle'
 * - intent-04-state-A-loading.html                → 'streaming'
 * - intent-04-state-0-happy.html                  → 'result'
 * - intent-04-state-D-filter.html                 → 'result' (activeSignalFilter !== 'visual')
 * - intent-04-state-E-cart.html                   → 'result' + addToCartConfirm set
 * - intent-04-state-F-reupload.html               → 'streaming' (currentTurn rebuilt;
 *                                                    previousTurns.length >= 1)
 * - intent-04-state-B-empty.html                  → 'empty'
 * - intent-04-state-C-error.html / SSE error      → 'error'
 */
export type RecommendStateKind =
  | 'idle'
  | 'streaming'
  | 'result'
  | 'empty'
  | 'error';

/**
 * D-S09-NN-B LAW: ConversationTurn = frozen snapshot of one upload+result cycle.
 * On re-upload (state-F), `currentTurn` collapses into `previousTurns[]` and a
 * fresh turn begins.
 */
export interface ConversationTurn {
  /** Stable id for React keys + telemetry (uuid v4 or timestamp). */
  turnId: string;
  /** request_id from POST /api/v1/intent 202 response. */
  requestId: string;
  /** Naked base64 image (no data URL prefix). */
  imageB64: string;
  /** Detected context from `final.detected` (null until graph done). */
  detected: DetectedContext | null;
  /** Final 10 products from `final.products` (or top 30 from blend; FE truncates). */
  products: RecommendedProduct[];
  /** Top-3 co-bought target categories or null. */
  coPurchaseHint: CoPurchaseHint | null;
  /** Wall-clock ms at turn start (for "ẢNH MỚI · HH:MM" divider). */
  startedAtMs: number;
}

/** Confirmed addToCart summary — inline literal flat per W3 LOCK (no Product type). */
export interface AddToCartConfirmSummary {
  title: string;
  price: number;
}

/**
 * Recommend state — single source of truth for /intent-04 page render.
 *
 * Snake_case event payloads are flattened/camelCased here for ergonomic
 * React consumer access. Reducer maps payload → state field per kind.
 */
export interface RecommendState {
  kind: RecommendStateKind;
  /** Current request_id (also mirrored in `currentTurn?.requestId` once turn exists). */
  requestId: string;
  /** Phase progress per phase_id 0..3 (D-S04-14 LAW reuse). */
  phases: PhaseProgressMap;
  /**
   * Detected context bubble (state-0 line 246 "Đã phân tích xong! Tôi nhận diện được:")
   * — surfaced via `understanding` SSE event from BE `_node_vision_analyze`
   * (recommend_by_images.py:282-288 emits `{detected: {category, attributes, ocr_text}}`).
   */
  understanding: { detected: Record<string, unknown> } | null;
  /**
   * Accumulated products from `product_ready` (sparse per-index growth) +
   * canonical `products` event overwrite. May contain `undefined` skeleton slots
   * during progressive streaming per D-S04-14 LAW.
   */
  products: RecommendedProduct[];
  /** Total expected from `product_ready.total` (0 until first event). */
  totalExpected: number;
  /**
   * D-S09-NN-A LAW client-side signal filter.
   * Default `'visual'` (BE blend_and_rank applied visual weights initial).
   * On chip tap: dispatch `set_signal_filter` → page-level applies
   * `composeBySignal(products, activeSignalFilter)` selector for top-10.
   */
  activeSignalFilter: SignalKey;
  /** Detected category + attributes from `final.detected`. */
  detected: DetectedContext | null;
  /** Top-3 co-bought target categories or null (rendered in CoPurchaseCategoryHintCard). */
  coPurchaseHint: CoPurchaseHint | null;
  /** SSE empty_state event payload (state-B reasons enum). */
  emptyState: {
    reason: RecommendationEmptyReason;
    message: string;
    fallback_actions: Array<{ type: string; label: string; value?: string }>;
  } | null;
  /** AddToCartConfirmCard render slot — set on "+", cleared on auto-dismiss. */
  addToCartConfirm: AddToCartConfirmSummary | null;
  /** SSE `error` event payload. */
  error: { code: RecommendationErrorCode | string; message: string; traceId?: string } | null;
  /** D-S09-NN-B LAW: current conversation turn (null pre-first-upload). */
  currentTurn: ConversationTurn | null;
  /** D-S09-NN-B LAW: chronological history of completed/superseded turns. */
  previousTurns: ConversationTurn[];
}

/**
 * Action union — every event/handler that mutates state.
 * Adding new actions REQUIRES corresponding reducer case (TS compile gate via
 * exhaustive `never` check).
 */
export type RecommendAction =
  | { type: 'submit_image'; imageB64: string; requestId: string; turnId: string }
  | { type: 'status'; phase: IntentStreamEventMap['status']['phase'] }
  | { type: 'phase_progress'; payload: IntentStreamEventMap['phase_progress'] }
  | { type: 'understanding'; payload: { detected: Record<string, unknown> } }
  | { type: 'product_ready'; item: RecommendedProduct; index: number; total: number }
  | { type: 'products'; items: RecommendedProduct[] }
  | { type: 'final'; payload: RecommendationResponse }
  | { type: 'empty_state'; payload: {
      reason: RecommendationEmptyReason;
      message: string;
      fallback_actions: Array<{ type: string; label: string; value?: string }>;
    } }
  | { type: 'error'; code: RecommendationErrorCode | string; message: string; traceId?: string }
  | { type: 'set_signal_filter'; signal: SignalKey }
  | { type: 'set_cart_confirm'; item: AddToCartConfirmSummary | null }
  | { type: 'dismiss_cart_confirm' }
  | { type: 'dismiss_co_purchase_hint' }
  | { type: 'append_new_turn'; imageB64: string; requestId: string; turnId: string }
  | { type: 'reset' };

// ─── Phase progress map (D-S04-14 LAW reuse) ─────────────────────────────────

export type PhaseProgressSlot = {
  phase_id: 0 | 1 | 2 | 3;
  label: string;
  status: 'active' | 'done' | 'pending' | 'error';
  ms?: number;
  meta?: string;
  success_count?: number;
  total?: number;
};

export type PhaseProgressMap = Partial<Record<0 | 1 | 2 | 3, PhaseProgressSlot>>;

/**
 * Mockup phase labels per C-S09-P Rule 6 LAW
 * (intent-04-state-A-loading.html lines 241/252/264/278 designer-locked).
 * BE emits these literally; FE uses as fallback when `label` omitted.
 */
const PHASE_LABEL_FALLBACK: Record<0 | 1 | 2 | 3, string> = {
  0: 'Tải ảnh lên',
  1: 'Đọc nội dung sản phẩm',
  2: 'Tìm sản phẩm tương tự',
  3: 'Xếp hạng + sinh lý do gợi ý',
};

// ─── Initial state ───────────────────────────────────────────────────────────

export const initialState: RecommendState = {
  kind: 'idle',
  requestId: '',
  phases: {},
  understanding: null,
  products: [],
  totalExpected: 0,
  activeSignalFilter: 'visual',
  detected: null,
  coPurchaseHint: null,
  emptyState: null,
  addToCartConfirm: null,
  error: null,
  currentTurn: null,
  previousTurns: [],
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Per-index slot insert (sparse → dense growth). Last-write-wins.
 * Pure — returns new array.
 */
function upsertProductAtIndex(
  current: RecommendedProduct[],
  item: RecommendedProduct,
  index: number,
  total: number,
): RecommendedProduct[] {
  const next = current.slice();
  if (next.length < total) {
    next.length = total;
  }
  next[index] = item;
  return next;
}

/**
 * Build fresh ConversationTurn from submit_image / append_new_turn action payload.
 */
function makeTurn(
  imageB64: string,
  requestId: string,
  turnId: string,
): ConversationTurn {
  return {
    turnId,
    requestId,
    imageB64,
    detected: null,
    products: [],
    coPurchaseHint: null,
    startedAtMs: Date.now(),
  };
}

/**
 * Freeze currentTurn with final state values into ConversationTurn for
 * archival into previousTurns[]. Called inside append_new_turn reducer.
 */
function freezeTurn(state: RecommendState): ConversationTurn | null {
  if (!state.currentTurn) return null;
  return {
    ...state.currentTurn,
    detected: state.detected,
    products: state.products.filter(
      (p): p is RecommendedProduct => p !== undefined,
    ),
    coPurchaseHint: state.coPurchaseHint,
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Pure reducer — state + action → new state.
 *
 * NEVER mutates input state. Returns new object reference on every call
 * (React diffing). Each case is independent of order; multiple SSE events
 * fire concurrently → React batches via setState callback pattern in
 * useRecommendStream.
 */
export function reduceState(
  state: RecommendState,
  action: RecommendAction,
): RecommendState {
  switch (action.type) {
    case 'submit_image': {
      // idle → streaming. Reset all SSE-derived fields. Start fresh currentTurn.
      // previousTurns preserved (D-S09-NN-B LAW — re-upload uses append_new_turn).
      return {
        ...initialState,
        kind: 'streaming',
        requestId: action.requestId,
        currentTurn: makeTurn(action.imageB64, action.requestId, action.turnId),
        previousTurns: state.previousTurns,
      };
    }

    case 'status': {
      // 'done' phase: do NOT auto-transition (let `final` event drive).
      // 'analyzing'/'searching': ensure 'streaming' if currently idle.
      if (state.kind === 'idle' && action.phase !== 'done') {
        return { ...state, kind: 'streaming' };
      }
      return state;
    }

    case 'phase_progress': {
      const { phase_id, status, ms, meta, label, success_count, total } = action.payload;
      const slot: PhaseProgressSlot = {
        phase_id,
        label: label ?? PHASE_LABEL_FALLBACK[phase_id],
        status,
        ms,
        meta,
        success_count,
        total,
      };
      return {
        ...state,
        phases: { ...state.phases, [phase_id]: slot },
      };
    }

    case 'understanding':
      // BE emits `{detected: {category, attributes, ocr_text}}` per
      // recommend_by_images.py:282-288. Store raw shape — page renders attrs as pills.
      return { ...state, understanding: action.payload };

    case 'product_ready':
      return {
        ...state,
        products: upsertProductAtIndex(state.products, action.item, action.index, action.total),
        totalExpected: action.total,
      };

    case 'products': {
      // Canonical reconcile — overwrite array with server's final list.
      // Do NOT overwrite if empty (empty_state event drives separately).
      const items = action.items;
      return {
        ...state,
        kind: items.length === 0 ? state.kind : 'result',
        products: items.length > 0 ? items : state.products,
        totalExpected: items.length > 0 ? items.length : state.totalExpected,
        // Reset filter to default `visual` on fresh products arrival (mockup state-0
        // default chip = "Giống thị giác" active gradient per line 272).
        activeSignalFilter: 'visual',
      };
    }

    case 'final': {
      // Stream complete — write detected + coPurchaseHint into state. Update
      // currentTurn snapshot fields. Flip kind to 'result' if products present.
      const newKind: RecommendStateKind =
        state.kind === 'streaming' && action.payload.products.length > 0
          ? 'result'
          : state.kind;
      const nextTurn = state.currentTurn
        ? {
            ...state.currentTurn,
            detected: action.payload.detected,
            products: action.payload.products,
            coPurchaseHint: action.payload.co_purchase_hint,
          }
        : null;
      return {
        ...state,
        kind: newKind,
        detected: action.payload.detected,
        coPurchaseHint: action.payload.co_purchase_hint,
        // Sync products if canonical didn't fire (defensive — BE emits products
        // BEFORE final but order may vary).
        products:
          action.payload.products.length > 0 && state.products.length === 0
            ? action.payload.products
            : state.products,
        currentTurn: nextTurn,
      };
    }

    case 'empty_state':
      return {
        ...state,
        kind: 'empty',
        emptyState: action.payload,
        products: [],
        totalExpected: 0,
      };

    case 'error':
      return {
        ...state,
        kind: 'error',
        error: {
          code: action.code,
          message: action.message,
          traceId: action.traceId,
        },
      };

    case 'set_signal_filter':
      // D-S09-NN-A LAW client-side instant re-rank.
      // Selector applied page-level (composeBySignal from shared-types).
      return { ...state, activeSignalFilter: action.signal };

    case 'set_cart_confirm':
      return { ...state, addToCartConfirm: action.item };

    case 'dismiss_cart_confirm':
      return { ...state, addToCartConfirm: null };

    case 'dismiss_co_purchase_hint':
      return { ...state, coPurchaseHint: null };

    case 'append_new_turn': {
      // D-S09-NN-B LAW: collapse currentTurn (final state values) → previousTurns[];
      // start fresh streaming turn with new request_id + new turnId.
      const frozen = freezeTurn(state);
      return {
        ...initialState,
        kind: 'streaming',
        requestId: action.requestId,
        currentTurn: makeTurn(action.imageB64, action.requestId, action.turnId),
        previousTurns: frozen
          ? [...state.previousTurns, frozen]
          : state.previousTurns,
      };
    }

    case 'reset':
      return { ...initialState };

    default: {
      // Exhaustive check — TS compile error if new action type added without case.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ─── Re-export helpers from shared-types for convenience ────────────────────
//
// Page wire imports composeBySignal directly via:
//   import { composeBySignal } from '@icp/shared-types';
// OR via this module for ergonomic single-import:
//   import { composeBySignal } from '@/src/features/recommend/recommend-state-machine';
//
// DO NOT define local composeBySignal — Mirror invariant per D-S09-NN-A LAW
// + C-S09-G (shared-types T01 ship is canonical SSoT).
export { composeBySignal, SIGNAL_WEIGHTS } from '@icp/shared-types/recommendations';
