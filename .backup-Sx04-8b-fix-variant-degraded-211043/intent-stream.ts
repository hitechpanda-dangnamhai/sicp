/**
 * `@icp/shared-types/sse` — Intent stream SSE event schemas.
 *
 * **S-02 T07 emit** — typed catalog for `POST /api/v1/intent` → `GET /api/v1/intent/stream`
 * Server-Sent Events (per ADR-019 cookie httpOnly auth + D-05 LOCK).
 *
 * **Locked decisions (S-02 T07):**
 * - **C-36**: 10 typed payload schemas + `heartbeat` = transport keepalive
 *   (server-only emit every 15s, no client schema needed; FE EventSource
 *   ignores via no `addEventListener('heartbeat', ...)`).
 * - **C-37**: Status phase enum = 7 values (superset of 03_API §3 + 08_FE_BE §6).
 * - **C-38**: Endpoint pattern = `POST /api/v1/intent → 202 {request_id}` then
 *   `GET /api/v1/intent/stream?id=<rid>` (native EventSource flow).
 *
 * **S-04 T03 amendment (Phiên Sx04-8b per D-S04-03/13/14 LAW + C-S04-F):**
 * 7 NEW event types added per `03_API_CONTRACTS.md §3`:
 *   - `phase_progress` — Variant B PhasesCard realtime (mockup state-A-loading)
 *   - `understanding` — Variant B semantic interpretation card
 *   - `typo_suggestion` — Pattern P2 interrupt at detect_typo node
 *   - `variant_degraded` — Graceful degrade Variant B → A with retry choice
 *   - `co_purchase_hint` — Post-cart-add cross-sell hint
 *   - `empty_state` — Both Variants 0-result with fallback actions
 *   - `product_ready` — Per-product progressive streaming (D-S04-14 LAW)
 * + augmented `products` payload (mode field + per-item match_score/reason).
 *
 * **Dual access pattern (C-32 LOCKED post-T06):**
 * - **FE** subpath: `import { SseStatusEvent } from '@icp/shared-types/sse'`
 *   (tree-shaking via bundler).
 * - **BE** root: `import { SseStatusEvent } from '@icp/shared-types'`
 *   (CommonJS resolution via root barrel re-export).
 *
 * @see docs/03_API_CONTRACTS.md §1.2 + §3 (endpoint + 17 event catalog post-S-04)
 * @see docs/08_FE_BE_CONTRACT.md §6 + §12 (typed schemas + cookie auth)
 * @see docs/DECISIONS.md ADR-019 (cookie httpOnly SSE auth)
 * @see slices/S-02_decisions-log.md Section 1 D-05 + Section 5 C-32/C-34/C-36/C-37/C-38
 * @see slices/S-04_decisions-log.md D-S04-03 LAW (Adaptive Single Endpoint),
 *      D-S04-13 LAW (Pattern A + Option Z + Option α), D-S04-14 LAW (Progressive Streaming)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// S-02 T07 existing 10 events (C-36 LOCKED) — UNCHANGED
// ---------------------------------------------------------------------------

/**
 * `status` event — pipeline phase progression.
 *
 * **C-37 LOCKED**: 7 values (union of 03_API §3 minimal + 08_FE_BE §6 superset).
 * Phase 1 wrapper only emits `classifying`/`analyzing`/`done`; rest reserved
 * V-SLICE (`searching` S-04 search intent, `synthesizing` S-08 chart intent,
 * `committing` S-06 checkout, `awaiting_user_input` S-04 card confirm).
 */
export const SseStatusEvent = z.object({
  phase: z.enum([
    'classifying',
    'analyzing',
    'searching',
    'synthesizing',
    'committing',
    'awaiting_user_input',
    'done',
  ]),
});

/** `partial_text` event — incremental LLM token stream (V-SLICE S-08 first need). */
export const SsePartialTextEvent = z.object({
  delta: z.string(),
});

/** `tool_call` event — AI invoking MCP tool (V-SLICE S-04+ first need). */
export const SseToolCallEvent = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
});

/** `tool_result` event — MCP tool result summary (V-SLICE S-04+ first need). */
export const SseToolResultEvent = z.object({
  tool: z.string(),
  result_summary: z.string(),
});

/**
 * `products` event — product list payload.
 *
 * **S-04 T03 amendment (Phiên Sx04-8b per D-S04-03 LAW):** `items[]` augmented
 * per Variant B mode with optional `match_score` + `reason` fields. `mode`
 * field NEW for FE to distinguish Variant A vs B rendering.
 *
 * Items typed `unknown[]` (passthrough) Phase 1; full `Product` schema lands
 * V-SLICE per `08_FE_BE_CONTRACT.md §3` folder layout C-10.
 */
export const SseProductsEvent = z.object({
  items: z.array(z.unknown()),
  /** S-04 NEW per D-S04-03 LAW. Optional for backward-compat with S-02 stub. */
  mode: z.enum(['ai_augmented', 'basic_fallback']).optional(),
});

/**
 * `card` event — action card payload (V-SLICE S-04+ first need).
 * Typed `unknown` Phase 1; V-SLICE will replace with `ActionCardSchema` from
 * `domain/action-card.ts`.
 */
export const SseCardEvent = z.unknown();

/** `chart` event — chart spec payload (V-SLICE S-08 first need). */
export const SseChartEvent = z.object({
  type: z.enum(['line', 'bar', 'pie']),
  title: z.string(),
  x_axis: z.string(),
  y_axis: z.string(),
  series: z.array(
    z.object({
      name: z.string(),
      data: z.array(z.number()),
    }),
  ),
});

/** `order_update` event — order status change (V-SLICE S-06 checkout). */
export const SseOrderUpdateEvent = z.object({
  order_id: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
});

/**
 * `final` event — end of stream payload.
 * Phase 1 wrapper emits: `{text: "Intent classified as <intent>", summary:
 * {request_id, intent, confidence}}`. V-SLICE narrows `summary` shape per
 * intent (currently `Record<string, unknown>` for forward-compat).
 */
export const SseFinalEvent = z.object({
  text: z.string(),
  summary: z.record(z.unknown()).optional(),
});

/** `error` event — error payload (retriable hint per 03_API §4). */
export const SseErrorEvent = z.object({
  code: z.string(),
  message: z.string(),
  retriable: z.boolean(),
});

// ---------------------------------------------------------------------------
// S-04 T03 NEW 7 events (Phiên Sx04-8b per D-S04-03/13/14 LAW)
// ---------------------------------------------------------------------------

/**
 * `phase_progress` event — Variant B PhasesCard realtime tracking.
 *
 * Emitted by `searching_by_text` graph per node lifecycle:
 * - `phase_id=0` understanding (generate_understanding node)
 * - `phase_id=1` search (hybrid_search node)
 * - `phase_id=2` reasons (generate_reasons node)
 * - `phase_id=3` rank (rank_finalize node)
 *
 * Mockup `intent-03B-state-A-loading.html` lines 155-189 (timing meta).
 *
 * @see slices/S-04_decisions-log.md D-S04-03 LAW + D-S04-14 LAW (phase_id=2
 *      enriched with success_count/total per progressive streaming)
 */
export const SsePhaseProgressEvent = z.object({
  phase_id: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** Optional label (e.g. "Hiểu ngữ nghĩa câu hỏi") — FE may use static enum or trust server. */
  label: z.string().optional(),
  status: z.enum(['active', 'done', 'pending']),
  /** Timing or meta annotation (e.g. "412ms" / "wave"). */
  meta: z.string().optional(),
  /** Timing in ms (S-04 T02 emits this field). */
  ms: z.number().optional(),
  /** Phase 2 progressive streaming: number of products with successful LLM reason. */
  success_count: z.number().optional(),
  /** Phase 2 progressive streaming: total products being processed. */
  total: z.number().optional(),
});

/**
 * `understanding` event — Variant B semantic interpretation card.
 *
 * Emitted ONCE per query, BEFORE products. Mockup-locked text VERBATIM per
 * Rule 6 (MOCKUP IS LAW): `intent-03B-state-0-happy.html` lines 152-164
 * ("Đã hiểu ý anh" card).
 */
export const SseUnderstandingEvent = z.object({
  text: z.string(),
  highlighted_terms: z.array(z.string()),
});

/**
 * `typo_suggestion` event — Variant B typo correction inline UX.
 *
 * Triggered by `detect_typo` node when LLM confidence > 0.85. Pairs with
 * `status: awaiting_user_input` event (graph paused via Pattern P2 dynamic
 * `interrupt()`). User POSTs `/api/v1/intent/{rid}/action` with
 * `{choice: 'accept'|'reject'}` to resume.
 *
 * Mockup `intent-03B-state-F-typo.html` lines 152-163.
 */
export const SseTypoSuggestionEvent = z.object({
  original: z.string(),
  corrected: z.string(),
  confidence: z.number(),
  actions: z.array(
    z.object({
      label: z.string(),
      value: z.enum(['accept', 'reject']),
    }),
  ),
});

/**
 * `variant_degraded` event — Variant B → A graceful degradation.
 *
 * Emitted by `generate_understanding` OR `generate_reasons` node on
 * `TimeoutError`/`LLMError`. Triggers `status: awaiting_user_input` (graph
 * paused via Pattern P2). User POSTs `/api/v1/intent/{rid}/action` with
 * `{choice: 'retry_ai'|'continue_basic'}` to resume.
 *
 * Mockup `intent-03B-state-C-error.html` lines 153-175.
 *
 * Pairs with AI ops log `intent.degraded` + FE behavior event
 * `search.variant_degraded` (correlated by `trace_id`).
 */
export const SseVariantDegradedEvent = z.object({
  from: z.literal('ai_augmented'),
  to: z.literal('basic_fallback'),
  reason: z.enum(['llm_timeout', 'llm_error', 'user_explicit']),
  /** S-04 NEW error codes per `03_API §4` + `LlmErrorCodeSchema`. */
  error_code: z.string().optional(),
  trace_id: z.string().optional(),
  user_message: z.string(),
  retry_actions: z.array(
    z.object({
      label: z.string(),
      value: z.enum(['retry_ai', 'continue_basic']),
    }),
  ),
});

/**
 * `co_purchase_hint` event — Variant B post-cart-add cross-sell hint.
 *
 * Emitted ONLY when `mode=ai_augmented` AND user adds product to cart during
 * search session (via `/action {choice: 'add_to_cart'}` resume). Triggers
 * `co_purchase_lookup` node which reads `02_DATA_MODEL.md §X.2` fixture
 * (S-04 stub; S-10 V006 real materialized view).
 *
 * Mockup `intent-03B-state-E-cart.html` lines 221-251.
 */
export const SseCoPurchaseHintEvent = z.object({
  rate_pct: z.number(),
  reason: z.string(),
  suggested_product: z.record(z.unknown()),
  anchor_category: z.string(),
  suggested_category: z.string(),
});

/**
 * `empty_state` event — Both Variants 0-result with actionable UX.
 *
 * Replaces `products: {items: []}` for empty case. Action types
 * `capture_image` + `create_product` are decorative S-04 (S-07 owner).
 *
 * Mockup `intent-03A-state-B-empty.html` + `intent-03B-state-B-empty.html`.
 */
export const SseEmptyStateEvent = z.object({
  message: z.string(),
  fallback_actions: z.array(
    z.object({
      type: z.enum(['widen_query', 'capture_image', 'create_product']),
      label: z.string(),
      value: z.string().optional(),
    }),
  ),
  suggested_queries: z.array(z.string()),
});

/**
 * `product_ready` event — Variant B per-product progressive streaming
 * (D-S04-14 LAW Adaptive Progressive Streaming Architecture).
 *
 * Emitted PER product as LLM `generate_reasons` parallel call completes,
 * instead of buffering all results until single `products` event. Final
 * canonical `products` event STILL emitted at `rank_finalize` end for
 * backward-compat reconciliation (FE without progressive handler still works).
 *
 * **WOW factor:** perceived latency 1500ms → 500ms time-to-first-card.
 * Mockup `intent-03B-state-A-loading.html` shimmer skeleton lines 170-181
 * already designed for progressive arrival.
 *
 * **Variant A SKIPS this event** (no LLM reasons — emits single-shot
 * `products` event only).
 *
 * Pairs with AI ops log `intent.first_card_emitted` (FIRST product_ready
 * only per request_id) for perceived-latency telemetry. FE emits behavior
 * event `search.first_card_rendered` at first Product Card paint.
 */
export const SseProductReadyEvent = z.object({
  /**
   * Augmented product payload (Product + match_score + reason).
   * Schema typed `record<unknown>` Phase 1 (matches `SseProductsEvent.items`
   * passthrough pattern); V-SLICE narrows to `Product` schema later.
   */
  item: z.record(z.unknown()),
  /** 0-based index into final products list. */
  index: z.number(),
  /** Total products being processed (from hybrid_search result count). */
  total: z.number(),
});

// ---------------------------------------------------------------------------
// Type registry — handler signature lookup for `streamIntent()` wrapper
// ---------------------------------------------------------------------------

/**
 * Typed event map — handler signature lookup for `streamIntent()` wrapper.
 *
 * **`heartbeat` NOT included** (C-36 LOCK): transport keepalive emitted by
 * gateway every 15s (`event: heartbeat\ndata: {"ts": <epoch_ms>}`); FE ignores
 * via no handler subscription. Browser EventSource still uses heartbeat to
 * detect connection liveness + auto-reconnect on idle timeout.
 *
 * **S-04 T03 extends:** 7 NEW S-04 events appended (per D-S04-03/13/14 LAW).
 */
export type IntentStreamEventMap = {
  // S-02 T07 base 10
  status: z.infer<typeof SseStatusEvent>;
  partial_text: z.infer<typeof SsePartialTextEvent>;
  tool_call: z.infer<typeof SseToolCallEvent>;
  tool_result: z.infer<typeof SseToolResultEvent>;
  products: z.infer<typeof SseProductsEvent>;
  card: z.infer<typeof SseCardEvent>;
  chart: z.infer<typeof SseChartEvent>;
  order_update: z.infer<typeof SseOrderUpdateEvent>;
  final: z.infer<typeof SseFinalEvent>;
  error: z.infer<typeof SseErrorEvent>;
  // S-04 T03 NEW 7
  phase_progress: z.infer<typeof SsePhaseProgressEvent>;
  understanding: z.infer<typeof SseUnderstandingEvent>;
  typo_suggestion: z.infer<typeof SseTypoSuggestionEvent>;
  variant_degraded: z.infer<typeof SseVariantDegradedEvent>;
  co_purchase_hint: z.infer<typeof SseCoPurchaseHintEvent>;
  empty_state: z.infer<typeof SseEmptyStateEvent>;
  product_ready: z.infer<typeof SseProductReadyEvent>;
};

/** Union of typed event names — used in `streamIntent(handlers)` key constraint. */
export type IntentStreamEventType = keyof IntentStreamEventMap;

/** Runtime validator registry — used by gateway controller pre-emit + FE wrapper post-parse. */
export const IntentStreamSchemas = {
  // S-02 T07 base 10
  status: SseStatusEvent,
  partial_text: SsePartialTextEvent,
  tool_call: SseToolCallEvent,
  tool_result: SseToolResultEvent,
  products: SseProductsEvent,
  card: SseCardEvent,
  chart: SseChartEvent,
  order_update: SseOrderUpdateEvent,
  final: SseFinalEvent,
  error: SseErrorEvent,
  // S-04 T03 NEW 7
  phase_progress: SsePhaseProgressEvent,
  understanding: SseUnderstandingEvent,
  typo_suggestion: SseTypoSuggestionEvent,
  variant_degraded: SseVariantDegradedEvent,
  co_purchase_hint: SseCoPurchaseHintEvent,
  empty_state: SseEmptyStateEvent,
  product_ready: SseProductReadyEvent,
} as const;
