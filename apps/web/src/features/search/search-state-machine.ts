/**
 * apps/web/src/features/search/search-state-machine.ts
 *
 * Pure state types + reducer for Intent 03 (Text Search) flow.
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T05 FE Page Wire (Phiên Sx04-10)
 *
 * Source:   docs/mockups/intent-03/intent-03B-state-*.html (14 mockup states tracked)
 *
 * Decisions applied:
 * - D-S04-03 LAW: Variant B default ('ai_augmented'); Variant A via `continue_basic` action
 * - D-S04-07 LAW: 'idle' kind = pre-query welcome state (Rule 6 EXCEPTION)
 * - D-S04-13 LAW: Pattern A LangGraph RedisSaver + Option Z Redis pub/sub +
 *                 Pattern P2 dynamic interrupt at 4 conditional nodes.
 *                 attemptN monotonic counter for retry_ai re-search idempotency.
 * - D-S04-14 LAW: per-index `products` array slot driven by `product_ready` SSE event;
 *                 `totalExpected` from product_ready event for shimmer skeleton count.
 * - D-S04-16 LAW (NEW Phiên Sx04-9b): Variant B match tier filter
 *                 `matchTierFilter: 'all' | 'exact' | 'similar'` — client-side carousel filter.
 * - W7 LOCK: initial mode always 'ai_augmented' (no pre-search toggle UI).
 *
 * Pure module — NO React imports. Tests can exercise reducer in isolation.
 *
 * Typed against `@icp/shared-types/sse` event payload shapes (passthrough for items[]).
 */
import type { IntentStreamEventMap } from '@icp/shared-types/sse';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * 8 logical state kinds tracking 14 mockup states.
 *
 * Mapping (mockup → kind):
 * - intent-03 page mount (no query)               → 'idle'
 * - intent-03B-state-A-loading.html               → 'streaming'
 * - intent-03B-state-0-happy.html                 → 'result' (mode='ai_augmented')
 * - intent-03A-state-0-happy.html                 → 'result' (mode='basic_fallback')
 * - intent-03B-state-D-filter.html                → 'result' (matchTierFilter !== 'all')
 * - intent-03B-state-F-typo.html                  → 'pending_typo_confirm'
 * - intent-03B-state-C-error.html                 → 'pending_degrade_choice'
 * - intent-03B-state-E-cart.html (open card)      → 'result' + addToCartConfirm OR coPurchaseHint set
 * - intent-03B-state-B-empty.html                 → 'empty'
 * - SSE `error` event                             → 'error'
 */
export type SearchStateKind =
  | 'idle'
  | 'streaming'
  | 'result'
  | 'pending_typo_confirm'
  | 'pending_degrade_choice'
  | 'empty'
  | 'error';

/** D-S04-16 LAW client-side match tier filter (Variant B only). */
export type MatchTierFilter = 'all' | 'exact' | 'similar';

/** Mode flip per D-S04-03 LAW (server-driven default, client may flip via continue_basic action). */
export type SearchMode = 'ai_augmented' | 'basic_fallback';

/**
 * Per-phase progress slot. Indexed by phase_id (0..3) for O(1) reducer update.
 *
 * Mockup state-A-loading.html lines 158-187 shows 4 rows:
 *   phase_id 0: Hiểu ngữ nghĩa câu hỏi (412ms)
 *   phase_id 1: Tìm sản phẩm khớp nghĩa + tên (158ms)
 *   phase_id 2: Viết lý do gợi ý cho từng món (active wave)
 *   phase_id 3: Xếp hạng theo độ phù hợp (pending)
 */
export type PhaseProgressSlot = {
  phase_id: 0 | 1 | 2 | 3;
  label: string;
  status: 'active' | 'done' | 'pending';
  ms?: number;
  meta?: string;
  /** Phase 2 progressive streaming (D-S04-14 LAW) — phase_id=2 enriched per product_ready. */
  success_count?: number;
  /** Phase 2 progressive streaming — total products being processed. */
  total?: number;
};

export type PhaseProgressMap = Partial<Record<0 | 1 | 2 | 3, PhaseProgressSlot>>;

/** Confirmed addToCart summary — inline literal flat per W3 LOCK (no Product type). */
export interface AddToCartConfirmSummary {
  title: string;
  price: number;
}

/** Variant B mockup product item (fields used by ProductCardSearchB; rest passthrough). */
export interface SearchProductItem {
  product_id?: string;
  brand?: string;
  name?: string;
  price?: number;
  original_price?: number;
  match_score?: number;
  reason?: string;
  image_gradient?: string;
  image_icon?: string;
  badges?: Array<{ type: 'hot' | 'sale' | 'new' | 'discount' | 'trend'; label: string }>;
  rating?: number;
  sold_count?: string;
  /** Forward-compat: any other field. */
  [key: string]: unknown;
}

/**
 * Search state — single source of truth for /intent-03 page render.
 *
 * Snake_case event payloads are flattened/camelCased here for ergonomic
 * React consumer access. Reducer maps payload → state field per kind.
 */
export interface SearchState {
  kind: SearchStateKind;
  query: string;
  requestId: string;
  mode: SearchMode;
  /** D-S04-13 LAW monotonic counter — bumped on retry_ai action. Initial 1. */
  attemptN: number;
  phases: PhaseProgressMap;
  understanding: { text: string; highlighted: string[] } | null;
  /** Accumulated products from product_ready + canonical products event (last-write-wins per index). */
  products: SearchProductItem[];
  /** Total expected from product_ready.total (Variant B); 0 until first product_ready. */
  totalExpected: number;
  /** D-S04-16 LAW client-side filter (Variant B only). */
  matchTierFilter: MatchTierFilter;
  /** Pattern P2 interrupt: typo_suggestion payload (mockup state-F-typo). */
  typoSuggestion: IntentStreamEventMap['typo_suggestion'] | null;
  /** Pattern P2 interrupt: variant_degraded payload (mockup state-C-error). */
  variantDegraded: IntentStreamEventMap['variant_degraded'] | null;
  /** Option α D-S04-13 LAW: co_purchase_hint after cart.item_added (Variant B only). */
  coPurchaseHint: IntentStreamEventMap['co_purchase_hint'] | null;
  /** SSE empty_state event payload (mockup state-B-empty). */
  emptyState: IntentStreamEventMap['empty_state'] | null;
  /** AddToCartConfirmCard render slot — set on "+", cleared on auto-dismiss / undo. */
  addToCartConfirm: AddToCartConfirmSummary | null;
  /** SSE `error` event display. */
  errorMessage: string | null;
}

/**
 * Action union — every event/handler that mutates state.
 * Adding new actions REQUIRES corresponding reducer case (TS compile gate via exhaustive check).
 */
export type SearchAction =
  | { type: 'submit'; query: string; requestId: string; mode: SearchMode }
  | { type: 'status'; phase: IntentStreamEventMap['status']['phase'] }
  | { type: 'phase_progress'; payload: IntentStreamEventMap['phase_progress'] }
  | { type: 'understanding'; text: string; highlighted: string[] }
  | { type: 'product_ready'; item: IntentStreamEventMap['product_ready']['item']; index: number; total: number }
  | { type: 'products'; items: IntentStreamEventMap['products']['items']; mode: SearchMode }
  | { type: 'typo_suggestion'; payload: IntentStreamEventMap['typo_suggestion'] }
  | { type: 'variant_degraded'; payload: IntentStreamEventMap['variant_degraded'] }
  | { type: 'co_purchase_hint'; payload: IntentStreamEventMap['co_purchase_hint'] }
  | { type: 'empty_state'; payload: IntentStreamEventMap['empty_state'] }
  | { type: 'final'; text: string }
  | { type: 'error'; message: string }
  | { type: 'set_cart_confirm'; item: AddToCartConfirmSummary | null }
  | { type: 'dismiss_cart_confirm' }
  | { type: 'dismiss_co_purchase_hint' }
  | { type: 'set_match_tier'; tier: MatchTierFilter }
  | { type: 'retry_ai' }
  | { type: 'continue_basic' }
  | { type: 'reset' };

export const initialState: SearchState = {
  kind: 'idle',
  query: '',
  requestId: '',
  mode: 'ai_augmented',
  attemptN: 1,
  phases: {},
  understanding: null,
  products: [],
  totalExpected: 0,
  matchTierFilter: 'all',
  typoSuggestion: null,
  variantDegraded: null,
  coPurchaseHint: null,
  emptyState: null,
  addToCartConfirm: null,
  errorMessage: null,
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

const PHASE_LABEL_FALLBACK: Record<0 | 1 | 2 | 3, string> = {
  0: 'Hiểu ngữ nghĩa câu hỏi',
  1: 'Tìm sản phẩm khớp nghĩa + tên',
  2: 'Viết lý do gợi ý cho từng món',
  3: 'Xếp hạng theo độ phù hợp',
};

/**
 * Map per-index product into accumulated array (sparse → dense growth).
 * Last-write-wins per index. Pure — returns new array.
 */
function upsertProductAtIndex(
  current: SearchProductItem[],
  item: SearchProductItem,
  index: number,
  total: number,
): SearchProductItem[] {
  const next = current.slice();
  // Grow array if needed (sparse pre-fill with undefined → caller treats as skeleton slot).
  if (next.length < total) {
    next.length = total;
  }
  next[index] = item;
  return next;
}

/**
 * Apply client-side match tier filter to products (D-S04-16 LAW).
 *
 * @param products full carousel products
 * @param filter   active tier ('all' | 'exact' | 'similar')
 * @returns        filtered products (returns same ref if filter==='all' for render optimization)
 */
export function filterProductsByTier(
  products: SearchProductItem[],
  filter: MatchTierFilter,
): SearchProductItem[] {
  if (filter === 'all') return products;
  // Defensive: products may contain undefined (skeleton slots).
  return products.filter((p) => {
    if (!p || typeof p.match_score !== 'number') return false;
    // Q-T04-2 Option B3 LOCK: ≥0.92 → exact tier; <0.92 → similar tier.
    // Note: match_score is 0-1 ratio per BE; ProductCardSearchB displays 0-100 scaled.
    // D-S04-16 LAW threshold uses raw 0-1 ratio per AI service emit contract.
    const score = p.match_score > 1 ? p.match_score / 100 : p.match_score;
    return filter === 'exact' ? score >= 0.92 : score < 0.92;
  });
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Pure reducer — state + action → new state.
 *
 * NEVER mutates input state. Returns new object reference on every call (React diffing).
 * Each case is independent of order; multiple SSE events fire concurrently → React state
 * batches via setState callback pattern in useSearchStream.
 */
export function reduceState(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'submit':
      // Idle → streaming. Reset all SSE-derived fields. Preserve attemptN (caller mutates if retry).
      return {
        ...initialState,
        kind: 'streaming',
        query: action.query,
        requestId: action.requestId,
        mode: action.mode,
        attemptN: state.attemptN,
      };

    case 'status': {
      // 'awaiting_user_input' phase = Pattern P2 interrupt active — state already set by
      // typo_suggestion/variant_degraded handler. Other phases: keep current kind unless terminal.
      // 'done' phase: do NOT auto-transition (let `final` event drive). 'searching'/'analyzing' etc:
      // ensure we're in 'streaming' if currently idle (defensive — shouldn't happen post-submit).
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
      return {
        ...state,
        understanding: { text: action.text, highlighted: action.highlighted },
      };

    case 'product_ready': {
      const item = action.item as SearchProductItem;
      return {
        ...state,
        products: upsertProductAtIndex(state.products, item, action.index, action.total),
        totalExpected: action.total,
      };
    }

    case 'products': {
      // Canonical reconcile — overwrite products array with server's final list.
      // Mode field updates here (server may have flipped to basic_fallback mid-stream).
      const items = action.items as SearchProductItem[];
      return {
        ...state,
        kind: items.length === 0 ? state.kind : 'result',
        // Don't overwrite if items.length === 0 (empty_state event drives separately).
        products: items.length > 0 ? items : state.products,
        totalExpected: items.length > 0 ? items.length : state.totalExpected,
        mode: action.mode,
        // Reset match tier filter to 'all' on fresh products arrival (D-S04-16 default).
        matchTierFilter: 'all',
      };
    }

    case 'typo_suggestion':
      return {
        ...state,
        kind: 'pending_typo_confirm',
        typoSuggestion: action.payload,
      };

    case 'variant_degraded':
      return {
        ...state,
        kind: 'pending_degrade_choice',
        variantDegraded: action.payload,
      };

    case 'co_purchase_hint':
      // Stays in 'result' kind; hint renders as additional element.
      return {
        ...state,
        coPurchaseHint: action.payload,
      };

    case 'empty_state':
      return {
        ...state,
        kind: 'empty',
        emptyState: action.payload,
        products: [],
        totalExpected: 0,
      };

    case 'final':
      // Final event = stream complete. If still in 'streaming', flip to 'result' if products
      // exist; else preserve current pending/empty/error kind.
      if (state.kind === 'streaming' && state.products.length > 0) {
        return { ...state, kind: 'result' };
      }
      return state;

    case 'error':
      return {
        ...state,
        kind: 'error',
        errorMessage: action.message,
      };

    case 'set_cart_confirm':
      return { ...state, addToCartConfirm: action.item };

    case 'dismiss_cart_confirm':
      return { ...state, addToCartConfirm: null };

    case 'dismiss_co_purchase_hint':
      return { ...state, coPurchaseHint: null };

    case 'set_match_tier':
      return { ...state, matchTierFilter: action.tier };

    case 'retry_ai':
      // D-S04-13 LAW: increment attemptN; clear pending state; back to streaming.
      // Mode stays 'ai_augmented' (retry on same Variant B).
      return {
        ...initialState,
        kind: 'streaming',
        query: state.query,
        requestId: state.requestId,
        mode: 'ai_augmented',
        attemptN: state.attemptN + 1,
      };

    case 'continue_basic':
      // D-S04-03 LAW degrade choice: mode flip to basic_fallback; keep streaming for re-results.
      return {
        ...initialState,
        kind: 'streaming',
        query: state.query,
        requestId: state.requestId,
        mode: 'basic_fallback',
        attemptN: state.attemptN + 1,
      };

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
