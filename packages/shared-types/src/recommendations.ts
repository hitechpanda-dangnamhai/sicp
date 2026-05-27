/**
 * `@icp/shared-types/recommendations.ts`
 *
 * S-09 V-SLICE Phiên Sx09-C per D-S09-NN-A LAW + D-S09-NN-C LAW + C-S09-G
 * (4 Zod schemas defined-not-shipped) + C-S09-H (4 error codes).
 *
 * Intent 04 image-based product recommendation contracts — emitted as canonical
 * Single Source of Truth per `docs/08_FE_BE_CONTRACT.md` §4.2 LAW.
 *
 * **Consumed by:**
 * - `apps/web` Intent 04 result screen — ProductCard carousel rendering
 *   `RecommendedProduct[]` with sub_scores + reason + match_type chips
 *   (T02 territory — emit ships schemas here, FE imports next slice)
 * - `apps/web` filter chips (state-D mockup intent-04-state-D-filter.html) —
 *   client-side `composeBySignal(items, signal)` re-rank consumer per
 *   D-S09-NN-A LAW SIGNAL_WEIGHTS constants
 * - `apps/gateway` future ZodValidationPipe (forward-compat — currently
 *   pass-through SSE proxy; BE Zod validation deferred per S-07 C-S07-P)
 * - `apps/ai/src/graphs/intents/recommend_by_images.py` — produces matching
 *   shapes in product_ready.item + products.items + final.detected payloads
 *
 * **Mirror invariants** (sync-required if backend shape changes):
 * - `RecommendedProductSchema.sub_scores` mirrors `recommend_by_images.py`
 *   _node_blend_and_rank output (visual_sim/collab_count/trending_score)
 * - `RecommendedProductSchema.match_type` enum mirrors `_SIGNAL_WEIGHTS` keys
 *   ('visual', 'collab', 'trending') in recommend_by_images.py
 * - `RecommendationResponseSchema.detected` mirrors `vision.analyze` return
 *   shape from MCP `apps/mcp/src/tools/vision.py:_normalize_result`
 *
 * **Dual access pattern** (S-02 T06 C-32 + C-34 LOCKED — same as cart/products):
 * - FE subpath: `import { RecommendedProductSchema } from '@icp/shared-types/recommendations'`
 * - BE root:    `import { RecommendedProductSchema } from '@icp/shared-types'`
 *
 * **Backward-compat additive** (per C-S09-F):
 * - SSE `product_ready.item` uses `z.record(z.unknown())` passthrough at
 *   intent-stream.ts:344 → adding `sub_scores` / `match_type` / `reason`
 *   fields is FULLY additive. NO breaking change to existing schemas.
 *
 * @see docs/handoff/00/PHASE_00_INTENT_04_MOCKUP_HANDOFF.md "Public interfaces exposed"
 * @see slices/S-09_decisions-log.md D-S09-NN-A LAW + C-S09-G + C-S09-H
 * @see slices/S-09_BRIEF.md Section 5
 * @see apps/ai/src/graphs/intents/recommend_by_images.py (Python producer)
 */

import { z } from 'zod';

// ============================================================================
// SubScores — D-S09-NN-A LAW (3 sub-scores per recommended item)
// ============================================================================
//
// Per D-S09-NN-A LAW: BE returns 3 sub-scores per item so FE filter chips
// can client-side re-rank without round-trip (state-D mockup instant <50ms).
//
//   visual_sim:    closeness(field, image_embedding) from Vespa
//                  image_recommendation profile summary-features — float [0,1]
//   collab_count:  freq from analytics.co_purchased SQL (raw COUNT) — int ≥0
//   trending_score: attribute(trend_score) from Vespa — float (raw, not normalized)
//
// FE composeBySignal(items, signal) helper uses SIGNAL_WEIGHTS constants
// mirroring _SIGNAL_WEIGHTS in recommend_by_images.py to re-compute
// composite client-side.

export const SubScoresSchema = z.object({
  visual_sim: z.number().min(0).max(1),
  collab_count: z.number().int().min(0),
  trending_score: z.number().min(0),
});
export type SubScores = z.infer<typeof SubScoresSchema>;

// ============================================================================
// MatchType — D-S09-NN-A LAW dominant-signal indicator
// ============================================================================
//
// match_type ∈ {visual, collab, trending} — computed in Python blend_and_rank
// node as `argmax(weighted_contribution_per_signal)`. FE renders distinct
// badge color per match_type (mockup state-0 ProductCard badge variants).

export const MatchTypeSchema = z.enum(['visual', 'collab', 'trending']);
export type MatchType = z.infer<typeof MatchTypeSchema>;

// ============================================================================
// RecommendedProduct — augments base product shape with recommendation context
// ============================================================================
//
// Mirrors `apps/ai/src/graphs/intents/recommend_by_images.py` _node_blend_and_rank
// output shape (after attach_reasons LLM appends `reason` field).
//
// Base product fields (id/title/category/etc.) mirror Vespa hit shape from
// vespa.image_nearest_neighbor MCP tool — NOT a strict superset of
// SearchProductSchema (FE Intent 03 search) because image recommendation
// produces a slightly different shape (no `stock` from Vespa, has `sub_scores`).

export const RecommendedProductSchema = z.object({
  // Base product fields (from vespa.image_nearest_neighbor)
  id: z.string(),
  product_id: z.string().optional(), // FE alias mirror of `id`
  title: z.string(),
  brand: z.string().optional(),
  category: z.string(),
  price: z.number().int().nonnegative(),
  image_url: z.string().nullable().optional(),
  image_gradient: z.string().nullable().optional(),
  icon_hint: z.string().optional(),
  rating_avg: z.number().min(0).max(5).optional(),
  rating_count: z.number().int().nonnegative().optional(),
  sold_count: z.number().int().nonnegative().optional(),

  // S-09 recommendation augmentation (additive per C-S09-F)
  match_score: z.number().min(0).max(1),
  reason: z.string().min(1).max(120), // Vietnamese reason chip, ≤60 chars target
  match_type: MatchTypeSchema,
  sub_scores: SubScoresSchema,
});
export type RecommendedProduct = z.infer<typeof RecommendedProductSchema>;

// ============================================================================
// DetectedContext — mirror vision.analyze return shape
// ============================================================================
//
// Mirrors `apps/mcp/src/tools/vision.py:_normalize_result` output. Surfaced
// via SSE `final.detected` payload for FE to render "Phát hiện được" pill
// (mockup intent-04-state-0-happy line 145 — detected category banner).

export const DetectedContextSchema = z.object({
  category: z.string(),
  attributes: z.record(z.unknown()),
  colors: z.array(z.string()).optional(),
  style_tags: z.array(z.string()).optional(),
});
export type DetectedContext = z.infer<typeof DetectedContextSchema>;

// ============================================================================
// CoPurchaseHint — analytics.co_purchased aggregate for AI bubble
// ============================================================================
//
// Surfaced via SSE `final.co_purchase_hint` payload. FE renders AI bubble
// above product carousel (mockup state-0 AI bubble component) when not null.
// Null when co_purchased returned empty (e.g., new category, no purchase
// history yet).

export const CoPurchaseHintSchema = z.object({
  source_category: z.string(),
  target_categories: z.array(z.string()).max(3),
  confidence: z.number().min(0).max(1),
});
export type CoPurchaseHint = z.infer<typeof CoPurchaseHintSchema>;

// ============================================================================
// RecommendationResponse — final SSE event payload
// ============================================================================
//
// Surfaced via SSE `final` event when graph completes successfully. FE state
// machine reducer ingests this as the canonical conversation turn result
// (per D-S09-NN-B LAW thread persistence FE-side).

export const RecommendationResponseSchema = z.object({
  detected: DetectedContextSchema,
  products: z.array(RecommendedProductSchema).max(10),
  co_purchase_hint: CoPurchaseHintSchema.nullable(),
});
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

// ============================================================================
// Empty state reasons (per mockup state-B "Không tìm thấy" empty card)
// ============================================================================
//
// FE renders distinct empty-state copy per reason — keeps the empty UI
// informative rather than generic "no results".

export const RecommendationEmptyReasonSchema = z.enum([
  'category_not_in_inventory',  // Vision detected category not in our products table
  'low_confidence',              // vision.confidence < 0.3 (caught by blur check Ω₂)
  'no_visual_match',             // image_nearest_neighbor returned 0 hits
]);
export type RecommendationEmptyReason = z.infer<typeof RecommendationEmptyReasonSchema>;

// ============================================================================
// Error codes (per C-S09-H — 3 NEW + 1 reuse from S-07)
// ============================================================================
//
// Per C-S09-H Câu hỏi resolution: 4 error codes total cho Intent 04:
//   - E_VISION_TIMEOUT   (NEW S-09)  → Gemini Vision call exceeded 15s
//   - E_VISION_BLUR      (REUSE S-07) → 3-threshold blur check Ω₂ fires
//   - E_EMBEDDING_FAILED (NEW S-09)  → Vespa image_embedding indexing error
//   - E_NETWORK          (NEW S-09)  → MCP/Vespa HTTP error (graceful degrade)
//
// FE error card renders distinct icon + retry CTA per code (mockup
// intent-04-state-E-error.html).

export const RecommendationErrorCodeSchema = z.enum([
  'E_VISION_TIMEOUT',
  'E_VISION_BLUR',
  'E_EMBEDDING_FAILED',
  'E_NETWORK',
]);
export type RecommendationErrorCode = z.infer<typeof RecommendationErrorCodeSchema>;

// ============================================================================
// SIGNAL_WEIGHTS — D-S09-NN-A LAW client-side re-rank constants
// ============================================================================
//
// EXPORTED as runtime const (NOT just type) so FE composeBySignal helper
// can import the EXACT same weights used by BE Python blend_and_rank node.
// Mirror invariant per docstring above.

export const SIGNAL_WEIGHTS = {
  visual:   { v: 0.5, c: 0.3, t: 0.2 },
  collab:   { v: 0.2, c: 0.7, t: 0.1 },
  trending: { v: 0.2, c: 0.1, t: 0.7 },
} as const;

export type SignalKey = keyof typeof SIGNAL_WEIGHTS;

/**
 * Client-side re-rank helper — per D-S09-NN-A LAW <50ms instant filter chips.
 *
 * Computes composite score per item using the selected signal's weights and
 * returns a new sorted array (does NOT mutate input). FE filter chip click
 * handler calls this with the 30 BE candidates + chosen signal.
 *
 * @param items  Array of RecommendedProduct from SSE products event
 * @param signal Which signal to bias by ('visual' | 'collab' | 'trending')
 * @returns      New array sorted by composite score descending, top 10
 */
export function composeBySignal(
  items: RecommendedProduct[],
  signal: SignalKey,
): RecommendedProduct[] {
  const w = SIGNAL_WEIGHTS[signal];

  // Normalize collab_count by max in batch (Python BE does same per
  // recommend_by_images.py:_node_blend_and_rank lines max_collab calc).
  const maxCollab = items.reduce(
    (m, it) => Math.max(m, it.sub_scores.collab_count),
    1,
  );

  const rescored = items.map((it) => {
    const collabNorm = maxCollab > 0 ? it.sub_scores.collab_count / maxCollab : 0;
    const composite =
      w.v * it.sub_scores.visual_sim +
      w.c * collabNorm +
      w.t * it.sub_scores.trending_score;
    return { ...it, match_score: composite };
  });

  rescored.sort((a, b) => b.match_score - a.match_score);
  return rescored.slice(0, 10);
}
