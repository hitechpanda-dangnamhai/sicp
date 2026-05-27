/**
 * `@icp/shared-types/behavior/recommend-events.ts`
 *
 * **Behavior Event Properties Schemas — Recommend subset (07_BEHAVIOR §3.X).**
 *
 * S-09 T02 NEW 4 behavior events emitted client-side by `/intent-04` page UI
 * interactions per PHASE_05_RECO_ANALYTICS §I observability requirements +
 * Phiên Sx09-F mid-task hotfix (Defect 3 — gateway tracker 500 validateProperties fail).
 *
 * **Append rule:** New event → append schema here → append entry to
 * `PROPERTIES_SCHEMA_MAP` in `./catalog.ts` → emit via FE
 * `apps/web/src/features/recommend/tracking-hooks.ts`.
 *
 * S-09 T02 emit (Phiên Sx09-F mid-task per Defect 3 resolution).
 */

import { z } from 'zod';

/** `recommendation.shown` — emitted on first ProductCard paint (state-0). */
export const RecommendationShownPropertiesSchema = z
  .object({
    source: z.enum(['image', 'product', 'cart']),
    seed_product_id: z.string().nullable().optional(),
    products: z.array(
      z.object({
        position: z.number().int().nonnegative(),
        product_id: z.string(),
        reason: z.string(),
        match_type: z.enum(['visual', 'collab', 'trending']),
      }),
    ),
    request_id: z.string(),
  })
  .strict();

/** `recommendation.clicked` — emitted on +button card tap (state-E). */
export const RecommendationClickedPropertiesSchema = z
  .object({
    position: z.number().int().nonnegative(),
    product_id: z.string(),
    match_type: z.enum(['visual', 'collab', 'trending']),
    active_signal_filter: z.enum(['visual', 'collab', 'trending']),
    request_id: z.string(),
  })
  .strict();

/** `recommendation.dismissed` — emitted on signal filter chip change (state-D). */
export const RecommendationDismissedPropertiesSchema = z
  .object({
    from_signal: z.enum(['visual', 'collab', 'trending']),
    to_signal: z.enum(['visual', 'collab', 'trending']),
    request_id: z.string(),
  })
  .strict();

/** `intent.first_card_emitted` — FE counterpart per D-S04-14 LAW paired telemetry. */
export const IntentFirstCardEmittedPropertiesSchema = z
  .object({
    request_id: z.string(),
    time_to_first_card_ms: z.number().int().nonnegative(),
    total_cards_expected: z.number().int().nonnegative(),
    source: z.enum(['image']),
  })
  .strict();
