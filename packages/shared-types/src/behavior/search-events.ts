/**
 * `@icp/shared-types/behavior/search-events.ts`
 *
 * **Behavior Event Properties Schemas — Discovery subset (07_BEHAVIOR §3.2).**
 *
 * S-04 NEW 5 behavior events emitted client-side by `/intent-03` page UI
 * interactions per D-S04-07/08/13/14 LAW (4 base) + D-S04-14 LAW Phiên Sx04-4
 * (5th `search.first_card_rendered` perceived-latency telemetry).
 *
 * **Source of authority:**
 * @see docs/07_BEHAVIOR_LOGS.md §3.2 (Discovery event catalog — LOCKED Phiên Sx04-4 per C-S04-O)
 * @see docs/LOG_CATALOG.md Section B (registry alignment)
 * @see slices/S-04_decisions-log.md D-S04-07/08/13/14
 *
 * **Append rule (per ADR-014 catalog-first):** New event → append schema here
 * → append entry to `PROPERTIES_SCHEMA_MAP` in `./catalog.ts` → append Section B
 * row to `LOG_CATALOG.md` → emit via tracker hook in `apps/web/src/features/search/tracking-hooks.ts`.
 *
 * S-04 T06 emit (Phiên Sx04-12).
 */

import { z } from 'zod';

/**
 * `search.suggested_chip_tapped` — emitted on user tap of pre-query
 * SuggestedQueryChips (mockup `intent-03B-state-0-happy.html` pre-query
 * welcome state synthesized per D-S04-07 LAW Rule 6 EXCEPTION).
 *
 * Used for: chip CTR analysis + understand which seed queries demonstrate
 * best engagement (e.g. "soy sauce for pho" cross-language WOW demo per
 * D-S04-12 LAW).
 */
export const SearchSuggestedChipTappedPropertiesSchema = z
  .object({
    /** The query text that will be submitted (matches chip_label). */
    query: z.string().min(1).max(500),
    /** Display label of the tapped chip. */
    chip_label: z.string().min(1).max(200),
    /** 0-based position in the chip row. */
    chip_position: z.number().int().nonnegative(),
  })
  .strict();

/**
 * `search.followup_filter_tapped` — emitted on user tap of Variant A
 * AI followup filter chip (mockup `intent-03A-state-F-refine.html` lines 297-315;
 * D-S04-08 LAW — FUNCTIONAL not decorative; re-triggers query with filter overlay).
 *
 * Used for: which filter chips drive Variant A engagement; informs which
 * filter heuristics to promote to Variant B AI-suggested filters later.
 */
export const SearchFollowupFilterTappedPropertiesSchema = z
  .object({
    /** Current query text at tap time (preserves correlation with re-search). */
    query: z.string().min(1).max(500),
    /** Display label of the tapped filter chip (e.g. "Dưới 20.000₫"). */
    filter_label: z.string().min(1).max(200),
    /** 0-based position in the filter row. */
    filter_position: z.number().int().nonnegative(),
  })
  .strict();

/**
 * `search.typo_corrected` — emitted on user choice for typo confirmation
 * (mockup `intent-03B-state-F-typo.html` lines 152-163: "Đúng rồi" / "Không, em tìm '...'").
 *
 * **Timing:** USER CHOICE, NOT server-event reception. Pairs with ops log
 * `intent.resumed` (resume_choice=accept|reject) emitted by AI-side at
 * Pattern P2 interrupt resume.
 *
 * D-S04-13 LAW Pattern A interrupt+resume.
 */
export const SearchTypoCorrectedPropertiesSchema = z
  .object({
    /** Correlation with full intent flow + ops log `intent.resumed`. */
    request_id: z.string().uuid(),
    /** User's original (potentially mistyped) query. */
    original_query: z.string().min(1).max(500),
    /** AI-suggested correction (e.g. "mai gi" → "Maggi"). */
    corrected_query: z.string().min(1).max(500),
    /** AI typo detection confidence 0.0-1.0 (from typo_suggestion SSE payload). */
    confidence: z.number().min(0).max(1),
    /** Which button user tapped. */
    user_choice: z.enum(['accept', 'reject']),
    /** D-S04-13 monotonic counter; matches POST /action _meta.attempt_n. */
    attempt_n: z.number().int().positive(),
  })
  .strict();

/**
 * `search.variant_degraded` — emitted on user choice for LLM degrade
 * (mockup `intent-03B-state-C-error.html` lines 169-173: "Thử lại với AI" /
 * "Dùng bản cơ bản"). Triggered when Variant B LLM call fails or times out
 * per D-S04-03 LAW Adaptive Single Endpoint + Graceful Degradation.
 *
 * **Timing:** USER CHOICE, NOT SSE event reception. Pairs with ops logs
 * `intent.degraded` (server-side mode flip detection) + `intent.resumed`
 * (Pattern A interrupt resume choice).
 *
 * D-S04-03 + D-S04-13 LAW Pattern A interrupt+resume.
 */
export const SearchVariantDegradedPropertiesSchema = z
  .object({
    /** Correlation with full intent flow + ops logs. */
    request_id: z.string().uuid(),
    /** Source mode (always ai_augmented at degrade event time). */
    from: z.literal('ai_augmented'),
    /** Target mode (always basic_fallback at degrade event time). */
    to: z.literal('basic_fallback'),
    /** Why degrade triggered (server-emitted in variant_degraded SSE event payload). */
    reason: z.enum(['llm_timeout', 'llm_error', 'user_explicit']),
    /** Optional error code from BE-AI (e.g. "E_LLM_TIMEOUT"); empty for user_explicit. */
    error_code: z.string().max(100).optional(),
    /** OTel trace_id correlation for Grafana → Tempo deep-link. */
    trace_id: z.string().max(64).optional(),
    /** Which button user tapped. */
    user_choice: z.enum(['retry_ai', 'continue_basic']),
    /** D-S04-13 monotonic counter; matches POST /action _meta.attempt_n. */
    attempt_n: z.number().int().positive(),
  })
  .strict();

/**
 * `search.first_card_rendered` — emitted at exact moment FIRST Product Card
 * paints after first `product_ready` SSE event arrives (per-product progressive
 * streaming per D-S04-14 LAW).
 *
 * **Timing:** Idempotent ONCE per request_id; first `product_ready` only.
 * **Pairs with:** AI ops log `intent.first_card_emitted` (server-side; emitted
 * at first `redis_publisher.publish_product_ready()` call inside `generate_reasons`
 * node — per Q-Sx04-4-4 LAW Metric-2).
 *
 * **Perceived-latency telemetry:** Grafana queryable for p50/p95:
 * ```sql
 * SELECT percentile_cont(0.50) WITHIN GROUP (ORDER BY time_to_first_card_ms),
 *        percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_card_ms)
 * FROM behavior_events
 * WHERE event_type='search.first_card_rendered' AND properties->>'mode'='ai_augmented'
 * ```
 *
 * **Demo target:** p50 ≤ 500ms, p95 ≤ 800ms (vs Variant B total latency 1500ms
 * p95 = 3x perceived improvement; per S-04_BRIEF.md AC14).
 *
 * Phiên Sx04-4 D-S04-14 LAW NEW.
 */
export const SearchFirstCardRenderedPropertiesSchema = z
  .object({
    /** Correlation with full intent flow + AI ops log `intent.first_card_emitted`. */
    request_id: z.string().uuid(),
    /** Elapsed ms between submitQuery POST + first product card paint (performance.now() delta). */
    time_to_first_card_ms: z.number().int().nonnegative(),
    /** From product_ready event `total` field — how many cards being processed. */
    total_cards_expected: z.number().int().positive(),
    /** Mode of the current intent flow (ai_augmented only — Variant A skips product_ready). */
    mode: z.enum(['ai_augmented', 'basic_fallback']),
  })
  .strict();
