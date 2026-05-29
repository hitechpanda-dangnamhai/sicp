/**
 * `@icp/shared-types/dto/analytics.dto.ts`
 *
 * S-10 T01.G NEW (Phiên Sx10-P2D per D-S10-NN-G LAW — math-first reasoning):
 * Type contract for Intent 07 (Voice Analytics) reasoning output + action cards.
 *
 * **Provenance — these shapes mirror the DEPLOYED engine 1:1** (do NOT invent):
 *  - 5 pure-Python solver in `apps/mcp/src/tools/analytics.py` (791 LOC).
 *  - Card dicts assembled in `apps/ai/.../analyzing_by_voices.py` `_node_build_insights`.
 *  - SSE `analytics_cards` / `analytics_clarify` payloads (see `intent-stream.ts`).
 *
 * **D-S10-NN-G:** every number is solver-derived + traceable via `_trace`; the LLM
 * only narrates. FE renders cards from these typed fields (math), never from prose.
 *
 * **Runtime note (verified Sx10-P2D):** gateway = pure SSE relay; FE `sse-client.ts`
 * does `JSON.parse(...) as <type>` (no zod runtime parse). So these schemas are a
 * COMPILE-TIME TYPE contract for FE handlers — kept faithful to the engine for
 * correct narrowing, not as a runtime validator.
 *
 * @see reasoning_engine_spec.md v2.0 — solver formulas + I/O
 * @see slices/S-10_decisions-log.md D-S10-NN-G LAW
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Solver `_trace` — input + intermediate values for explainability.
// Shape varies per solver; FE displays opportunistically. Passthrough record.
// ---------------------------------------------------------------------------
export const ReasoningTraceSchema = z.record(z.unknown());

// ---------------------------------------------------------------------------
// Per-solver reasoning schemas (public return fields; `_trace` opportunistic).
// ---------------------------------------------------------------------------

/** `analytics.suggest_price` — Linear Scoring Model fixed-weight (Intent 01). */
export const PriceReasoningSchema = z.object({
  suggested_price: z.number(),
  confidence: z.number(),
  emitted: z.boolean(),
  _trace: ReasoningTraceSchema.optional(),
});

/** `analytics.suggest_promo` — elasticity + clamp. */
export const PromoReasoningSchema = z.object({
  promo_pct: z.number(),
  projected_recovery_pct: z.number(),
  emitted: z.boolean(),
  _trace: ReasoningTraceSchema.optional(),
});

/** `analytics.suggest_restock` — velocity × (cover + lead) × safety − stock. */
export const RestockReasoningSchema = z.object({
  reorder_qty: z.number(),
  days_left: z.number().nullable(),
  velocity_per_day: z.number(),
  emitted: z.boolean(),
  _trace: ReasoningTraceSchema.optional(),
});

/** `analytics.suggest_loan` — rule-gated capital recommendation (NEW v2.0). */
export const LoanReasoningSchema = z.object({
  suggested_amount: z.number(),
  term_months: z.number(),
  reputation: z.number(),
  confidence: z.number(),
  emitted: z.boolean(),
  _trace: ReasoningTraceSchema.optional(),
});

/** One Price-Volume-Mix driver row inside `explain_trend.breakdown`. */
export const TrendDriverSchema = z.object({
  name: z.string(),
  pct: z.number(),
  sign: z.string(),
  detail: z.string(),
});

/**
 * `analytics.explain_trend` — Price-Volume-Mix Variance Analysis (PURE).
 * `category_contribution_pct` (G.1) nullable; `period` enum incl. `rolling_7d` (G.2).
 */
export const TrendBreakdownSchema = z.object({
  direction: z.enum(['up', 'down']),
  delta_revenue_pct: z.number(),
  top_driver: z.enum(['volume', 'price']),
  period: z.enum(['rolling_7d', 'week', 'month']),
  category_contribution_pct: z.number().nullable(),
  breakdown: z.array(TrendDriverSchema),
  _trace: ReasoningTraceSchema.optional(),
});

// ---------------------------------------------------------------------------
// Aggregate reasoning block — 5 nullable solver slots (additive, backward-compat).
// ---------------------------------------------------------------------------
export const AnalyticsReasoningSchema = z.object({
  price: PriceReasoningSchema.nullable(),
  promo: PromoReasoningSchema.nullable(),
  restock: RestockReasoningSchema.nullable(),
  trend: TrendBreakdownSchema.nullable(),
  loan: LoanReasoningSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Action cards — discriminated union on `type` (mirrors `_node_build_insights`).
//   caution     → trend + promo  (a declining category)
//   opportunity → restock        (a rising product running low on stock)
//   loan        → loan           (eligible for capital to fund the restock)
// All share `rationale` (Python-templated from _trace, valid per D-S10-NN-G).
// ---------------------------------------------------------------------------
export const CautionCardSchema = z.object({
  type: z.literal('caution'),
  category: z.string(),
  delta_pct: z.number(),
  rationale: z.string(),
  reasoning: z.object({
    trend: TrendBreakdownSchema.nullable(),
    promo: PromoReasoningSchema.nullable(),
  }),
});

export const OpportunityCardSchema = z.object({
  type: z.literal('opportunity'),
  category: z.string().nullable(),
  product_id: z.string().nullable(),
  title: z.string().nullable(),
  rationale: z.string(),
  reasoning: z.object({
    restock: RestockReasoningSchema,
  }),
});

export const LoanCardSchema = z.object({
  type: z.literal('loan'),
  rationale: z.string(),
  reasoning: z.object({
    loan: LoanReasoningSchema,
  }),
});

export const AnalyticsCardSchema = z.discriminatedUnion('type', [
  CautionCardSchema,
  OpportunityCardSchema,
  LoanCardSchema,
]);

// ---------------------------------------------------------------------------
// Clarify option (DORMANT Pattern-A interrupt) — {label, value:{metric|category|product_id}}.
// ---------------------------------------------------------------------------
export const AnalyticsClarifyOptionSchema = z.object({
  label: z.string(),
  value: z.record(z.string()),
});

// ---------------------------------------------------------------------------
// AnalyticsResponseSchema — additive `reasoning` block (nullable, backward-compat).
// Merge target for the broader Intent 07 analytics response (04_INTENT_SPECS).
// ---------------------------------------------------------------------------
export const AnalyticsResponseSchema = z.object({
  reasoning: AnalyticsReasoningSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Inferred TS types (FE/BE import these for handler signatures).
// ---------------------------------------------------------------------------
export type PriceReasoning = z.infer<typeof PriceReasoningSchema>;
export type PromoReasoning = z.infer<typeof PromoReasoningSchema>;
export type RestockReasoning = z.infer<typeof RestockReasoningSchema>;
export type LoanReasoning = z.infer<typeof LoanReasoningSchema>;
export type TrendBreakdown = z.infer<typeof TrendBreakdownSchema>;
export type AnalyticsReasoning = z.infer<typeof AnalyticsReasoningSchema>;
export type AnalyticsCard = z.infer<typeof AnalyticsCardSchema>;
export type AnalyticsClarifyOption = z.infer<typeof AnalyticsClarifyOptionSchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
