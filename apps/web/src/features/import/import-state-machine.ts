/**
 * apps/web/src/features/import/import-state-machine.ts
 *
 * Pure state types + reducer for Intent 01 (Image AI Import) flow.
 *
 * Slice:    S-07 First Image AI Import
 * Task:     T02.C FE Page Wire (Phiên Sx07-F)
 *
 * Source:   10 mockup states `docs/mockups/intent-01/intent-01-state-*.html`
 *           (state-0/A/B/C-rising/C-falling/D/E/F/G/H) + `cancelled` synthetic.
 *
 * Decisions applied:
 * - **D-S04-13 LAW**: Pattern A LangGraph RedisSaver + Option Z Redis pub/sub +
 *   Pattern P2 dynamic interrupt (at submit_draft + commit waits). attemptN
 *   monotonic counter for resume idempotency.
 * - **D-S04-14 LAW**: Adaptive Progressive Streaming — phases render sequentially
 *   from `phase_progress` SSE events (4 phases per Intent 01) even though BE
 *   `asyncio.gather` parallelizes enrichment.
 * - **C-S07-D**: SSE consumes 3 NEW events `form_prefill`, `market_trend`,
 *   `shopee_compare` (shipped Phiên Sx07-D) + 5 baseline (status / phase_progress
 *   / card / final / error).
 * - **C-S07-F** (Phiên Sx07-D option ⓐ): `E_VISION_BLUR` surfaces via SSE
 *   `error` event with `code: 'E_VISION_BLUR'` — drives transition to 'state-E'.
 * - **C-S07-L LOCK**: `confidence_per_field` has ONLY 4 keys
 *   (title/brand/category/size). If any value < 0.7 → switch kind to 'state-F'
 *   (low-confidence warning banner overlay on PrefillForm).
 * - **Q2 HYBRID LOCK** (Phiên Sx07-F): 'cancelled' kind for state-G timer
 *   cancel path (programmatic cancel via 3 buttons).
 *
 * Pure module — NO React imports. Tests can exercise reducer in isolation.
 *
 * Typed against `@icp/shared-types/sse` event payload shapes (passthrough for
 * fields not strictly typed at FE consumer layer).
 */
import type { IntentStreamEventMap } from '@icp/shared-types/sse';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * 11 logical state kinds tracking 10 mockup states + 1 synthetic 'cancelled'.
 *
 * Mapping (mockup file → kind):
 *   intent-01-state-0-capture.html               → 'state-0'
 *   intent-01-state-A-analyzing.html             → 'state-A'
 *   intent-01-state-B-prefilled.html             → 'state-B'
 *   intent-01-state-C-suggestions-rising.html    → 'state-C-rising'
 *   intent-01-state-C-suggestions-falling.html   → 'state-C-falling'
 *   intent-01-state-D-shopee-expanded.html       → 'state-D' (expanded panel toggle)
 *   intent-01-state-E-blur-error.html            → 'state-E' (E_VISION_BLUR error)
 *   intent-01-state-F-low-confidence.html        → 'state-F' (alt-chip overlay on B)
 *   intent-01-state-G-success.html               → 'state-G' (final commit success)
 *   intent-01-state-H-trend-expanded.html        → 'state-H' (expanded panel toggle)
 *   programmatic SuccessTransition cancel        → 'cancelled' (timer cancel)
 *
 * **Why 'state-F' is a distinct kind (not just B + flag):**
 * Mockup state-F shows a yellow warning banner + 4 yellow per-field badges
 * + alt-chips below title/size. Visual distinction warrants reducer-level
 * discrimination — page render conditions on `kind === 'state-F'` to enable
 * the banner + alt-chip suggestions.
 *
 * **Why 'state-D' / 'state-H' (NOT a single 'expanded' kind):**
 * The two expanded panels share NO components — D is ShopeeCompareCardExpanded,
 * H is TrendCardExpanded. Per-kind tracking lets the page render the correct
 * full-page molecule with a back button to state-B/state-C.
 */
export type ImportStateKind =
  | 'state-0'
  | 'state-A'
  | 'state-B'
  | 'state-C-rising'
  | 'state-C-falling'
  | 'state-D'
  | 'state-E'
  | 'state-F'
  | 'state-G'
  | 'state-H'
  | 'cancelled';

/**
 * Per-phase progress slot. Indexed by phase_id (0..3) for O(1) reducer update.
 *
 * Mockup state-A-analyzing.html lines 158-340 shows 4 rows per
 * `docs/02_INTENT_SPECS.md` Intent 01 + D-S04-10 LAW (512 chiều):
 *   phase_id 0: Tải ảnh
 *   phase_id 1: Đọc nhãn sản phẩm                (Gemini Vision)
 *   phase_id 2: Sinh dấu vân tay 512 chiều        (CLIP embed)
 *   phase_id 3: Phân tích thị trường              (gtrends + shopee)
 */
export type PhaseProgressSlot = {
  phase_id: 0 | 1 | 2 | 3;
  label: string;
  status: 'active' | 'done' | 'pending';
  ms?: number;
  meta?: string;
};

export type PhaseProgressMap = Partial<Record<0 | 1 | 2 | 3, PhaseProgressSlot>>;

/** SSE `form_prefill` event payload (mirrors SseFormPrefillEvent). */
export interface FormPrefillData {
  category: string;
  attributes: Record<string, unknown>;
  ocr_text?: string;
  confidence?: number;
  confidence_per_field?: {
    title?: number;
    brand?: number;
    category?: number;
    size?: number;
  };
  alternatives?: {
    title?: string[];
    size?: string[];
  };
  suggested_price?: number;
  /** Helper extras (passthrough acceptable per C-S07-D). */
  title?: string;
  description?: string;
}

/** SSE `market_trend` event payload (mirrors SseMarketTrendEvent). */
export interface MarketTrendData {
  trajectory: 'rising' | 'falling' | 'stable';
  current_score: number;
  delta_pct: number;
  series: number[];
  related_rising: string[];
  insight?: string;
}

/** SSE `shopee_compare` event payload (mirrors SseShopeeCompareEvent). */
export interface ShopeeCompareData {
  aggregates: {
    min_price: number;
    avg_price: number;
    max_price: number;
    sample_count: number;
    review_count: number;
  };
  samples: Array<{
    title: string;
    store: string;
    price: number;
    rating: number | null;
    sold_count: number;
  }>;
  matched_via?: 'specific' | 'category_fallback' | 'no_match';
}

/** Card SSE payload (action card from policies.find_matching). */
export interface ImportActionCard {
  card_id: string;
  variant: string;
  policy_code: string;
  suggestion?: Record<string, unknown>;
  rationale?: string;
  [key: string]: unknown;
}

/**
 * Confidence threshold per C-S07-L LOCK — below 0.7 = state-F low-confidence.
 *
 * Public export so consumer page + LowConfidenceWarningBanner can re-use the
 * same constant for "which fields are flagged" filtering.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Import state — single source of truth for /intent-01 page render.
 *
 * Snake_case SSE event payloads flattened/camelCased here for ergonomic
 * React consumer access. Reducer maps payload → state field per kind.
 */
export interface ImportState {
  kind: ImportStateKind;
  /** request_id from POST /intent 202 response. Empty in state-0. */
  requestId: string;
  /** D-S04-13 LAW monotonic counter — bumped on submit_draft + commit. Initial 1. */
  attemptN: number;
  /** 4-phase progress map (D-S04-14 LAW). */
  phases: PhaseProgressMap;
  /** SSE form_prefill payload (drives PrefillForm defaults in state-B/F). */
  formPrefill: FormPrefillData | null;
  /** SSE market_trend payload (drives TrendCard compact + TrendCardExpanded). */
  marketTrend: MarketTrendData | null;
  /** SSE shopee_compare payload (drives ShopeeCompareCard compact + Expanded). */
  shopeeCompare: ShopeeCompareData | null;
  /** Accumulated action cards from SSE 'card' events. */
  cards: ImportActionCard[];
  /** Committed product (set on SSE 'final' event payload `product_id`/`product_title`). */
  finalProduct: { product_id: string; product_title: string } | null;
  /** Error info (E_VISION_BLUR drives state-E; other codes surface but stay in current kind). */
  error: {
    code: string;
    message: string;
    trace_id?: string;
  } | null;
  /** Image preview (base64 data URL) — for state-E blur error retake illustration. */
  imageDataUrl: string | null;
  /** Telemetry: ms when 'state-0' transitioned via submit (`upload` action). */
  startedAt: number | null;
}

/**
 * Action union — every event/handler that mutates state.
 * Adding new actions REQUIRES corresponding reducer case (TS compile gate via
 * exhaustive `_exhaustive: never` check at switch tail).
 */
export type ImportAction =
  | { type: 'upload'; requestId: string; imageDataUrl: string; startedAt: number }
  | { type: 'status'; phase: IntentStreamEventMap['status']['phase'] }
  | { type: 'phase_progress'; payload: IntentStreamEventMap['phase_progress'] }
  | { type: 'form_prefill'; payload: FormPrefillData }
  | { type: 'market_trend'; payload: MarketTrendData }
  | { type: 'shopee_compare'; payload: ShopeeCompareData }
  | { type: 'card'; payload: ImportActionCard }
  | {
      type: 'final';
      product_id: string;
      product_title: string;
    }
  | {
      type: 'error';
      message: string;
      code?: string;
      trace_id?: string;
    }
  | { type: 'submit_draft' }
  | { type: 'commit' }
  | { type: 'open_shopee_expanded' }
  | { type: 'open_trend_expanded' }
  | { type: 'close_expanded' } // closes state-D / state-H → back to state-B (or C if cards present)
  | { type: 'cancel_redirect' } // user clicks any state-G button → stop auto-redirect
  | { type: 'retake' } // state-E → state-0 (clear all)
  | { type: 'reset' };

export const initialState: ImportState = {
  kind: 'state-0',
  requestId: '',
  attemptN: 1,
  phases: {},
  formPrefill: null,
  marketTrend: null,
  shopeeCompare: null,
  cards: [],
  finalProduct: null,
  error: null,
  imageDataUrl: null,
  startedAt: null,
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

const PHASE_LABEL_FALLBACK: Record<0 | 1 | 2 | 3, string> = {
  0: 'Tải ảnh',
  1: 'Đọc nhãn sản phẩm',
  2: 'Sinh dấu vân tay 512 chiều',
  3: 'Phân tích thị trường',
};

/**
 * Determine if a form_prefill payload triggers state-F (low confidence).
 * Per C-S07-L LOCK: ANY of 4 keys (title/brand/category/size) < 0.7 → state-F.
 *
 * Public export so consumers (page-level kind dispatch + LowConfidenceWarningBanner
 * field-list rendering) can re-use the same filter logic.
 */
export function getLowConfidenceFields(
  formPrefill: FormPrefillData | null,
): string[] {
  if (!formPrefill?.confidence_per_field) return [];
  const cpf = formPrefill.confidence_per_field;
  const flagged: string[] = [];
  if (typeof cpf.title === 'number' && cpf.title < LOW_CONFIDENCE_THRESHOLD) flagged.push('title');
  if (typeof cpf.brand === 'number' && cpf.brand < LOW_CONFIDENCE_THRESHOLD) flagged.push('brand');
  if (typeof cpf.category === 'number' && cpf.category < LOW_CONFIDENCE_THRESHOLD) flagged.push('category');
  if (typeof cpf.size === 'number' && cpf.size < LOW_CONFIDENCE_THRESHOLD) flagged.push('size');
  return flagged;
}

/**
 * Determine kind after form_prefill arrives:
 *   - any field < 0.7 → 'state-F'
 *   - else            → 'state-B'
 */
function kindAfterPrefill(formPrefill: FormPrefillData): ImportStateKind {
  return getLowConfidenceFields(formPrefill).length > 0 ? 'state-F' : 'state-B';
}

/**
 * Determine kind after card arrives:
 *   - if shopeeCompare.aggregates.avg_price > userPrice (or trend.delta_pct > 0)
 *     → 'state-C-rising' (mint palette)
 *   - else → 'state-C-falling' (amber palette)
 *
 * For T02 hackathon scope: defer this disambiguation; default to 'state-C-rising'.
 * Phase 3+ may add explicit trajectory-driven dispatch.
 */
function kindAfterCard(state: ImportState): ImportStateKind {
  // Stay in current B/F kind UNTIL we have cards — then switch to C.
  if (state.cards.length === 0) {
    // Won't be called with empty cards but defensive
    return state.kind;
  }
  // Default rising; future: read state.marketTrend?.delta_pct sign.
  if (state.marketTrend?.delta_pct != null && state.marketTrend.delta_pct < 0) {
    return 'state-C-falling';
  }
  return 'state-C-rising';
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Pure reducer — state + action → new state.
 *
 * NEVER mutates input state. Returns new object reference on every call.
 * Each case is independent of order; multiple SSE events fire concurrently →
 * React batches via setState callback in useImportFlow.
 */
export function reduceState(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'upload':
      // State-0 → state-A. Reset all SSE-derived fields. Preserve nothing
      // from previous request (each upload is a fresh flow).
      return {
        ...initialState,
        kind: 'state-A',
        requestId: action.requestId,
        imageDataUrl: action.imageDataUrl,
        startedAt: action.startedAt,
      };

    case 'status': {
      // 'awaiting_user_input' = Pattern P2 interrupt active (BE waits for
      // submit_draft or commit). State-B/C/F driven by `form_prefill`/`card`
      // events; status alone doesn't auto-advance.
      // 'done' phase = enrichment complete → state should already be 'state-B'
      //   (form_prefill arrived); defensive no-op.
      if (state.kind === 'state-0' && action.phase !== 'done') {
        return { ...state, kind: 'state-A' };
      }
      return state;
    }

    case 'phase_progress': {
      const { phase_id, status, ms, meta, label } = action.payload;
      // Defensive: phase_id may be outside 0..3 (BE bug) — clamp to 0..3.
      const id = (phase_id >= 0 && phase_id <= 3 ? phase_id : 0) as 0 | 1 | 2 | 3;
      const slot: PhaseProgressSlot = {
        phase_id: id,
        label: label ?? PHASE_LABEL_FALLBACK[id],
        status,
        ms,
        meta,
      };
      return {
        ...state,
        phases: { ...state.phases, [id]: slot },
      };
    }

    case 'form_prefill': {
      // Form prefill arrives → state-B or state-F (low-confidence overlay).
      // Cards may arrive after — those flip kind to C-rising/C-falling.
      return {
        ...state,
        kind: kindAfterPrefill(action.payload),
        formPrefill: action.payload,
      };
    }

    case 'market_trend':
      // Market trend stays in same kind (renders alongside form in B/F/C).
      return { ...state, marketTrend: action.payload };

    case 'shopee_compare':
      // Shopee compare stays in same kind (renders alongside form).
      return { ...state, shopeeCompare: action.payload };

    case 'card': {
      const nextCards = [...state.cards, action.payload];
      const nextState = { ...state, cards: nextCards };
      // First card arrival → transition state-B/F → state-C (suggestions).
      // Stay in state-D/H expanded panels if user is there (don't yank away).
      if (state.kind === 'state-B' || state.kind === 'state-F') {
        return { ...nextState, kind: kindAfterCard(nextState) };
      }
      return nextState;
    }

    case 'final':
      // Final commit success → state-G (SuccessTransition).
      return {
        ...state,
        kind: 'state-G',
        finalProduct: {
          product_id: action.product_id,
          product_title: action.product_title,
        },
      };

    case 'error': {
      // Any SSE error event terminates flow → state-E (BlurErrorCard renders generic error with retake CTA)
      return {
        ...state,
        kind: state.kind === 'state-G' ? state.kind : 'state-E',
        error: {
          code: action.code ?? 'UNKNOWN',
          message: action.message,
          trace_id: action.trace_id,
        },
      };
    }

    case 'submit_draft':
      // Pattern P2 interrupt #1 resume — BE will emit cards then INTERRUPT #2.
      // FE: bump attemptN; stay in current kind until cards arrive.
      return { ...state, attemptN: state.attemptN + 1 };

    case 'commit':
      // Pattern P2 interrupt #2 resume — BE will emit 'final' event.
      // FE: bump attemptN; stay in current kind until final arrives.
      return { ...state, attemptN: state.attemptN + 1 };

    case 'open_shopee_expanded':
      // Toggle to state-D expanded panel — requires shopeeCompare data.
      if (!state.shopeeCompare) return state;
      return { ...state, kind: 'state-D' };

    case 'open_trend_expanded':
      // Toggle to state-H expanded panel — requires marketTrend data.
      if (!state.marketTrend) return state;
      return { ...state, kind: 'state-H' };

    case 'close_expanded':
      // Back from state-D / state-H → revert to most recent non-expanded kind.
      // Heuristic: if we have cards → state-C-rising (or falling); else B/F.
      if (state.cards.length > 0) {
        return { ...state, kind: kindAfterCard(state) };
      }
      if (state.formPrefill) {
        return { ...state, kind: kindAfterPrefill(state.formPrefill) };
      }
      return { ...state, kind: 'state-A' };

    case 'cancel_redirect':
      // Q2 HYBRID — user clicked any state-G button to cancel 2s auto-redirect.
      // Reducer-level kind flip (SuccessTransition uses internal `cancelled`
      // local flag for UI rendering; this kind is for telemetry + page-level
      // unmount detection if needed).
      return { ...state, kind: 'cancelled' };

    case 'retake':
      // State-E "Chụp lại" CTA — reset entirely to state-0.
      return { ...initialState };

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
