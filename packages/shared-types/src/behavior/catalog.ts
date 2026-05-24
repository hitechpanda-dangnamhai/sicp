/**
 * `@icp/shared-types/behavior/catalog.ts`
 *
 * **Behavior Event Catalog — PropertiesMap (LOCKED, append-only).**
 *
 * Type-safe registry of event_type → properties shape. Adding new event types
 * = append entry to BOTH this file (PropertiesMap + Zod variant) AND
 * `LOG_CATALOG.md` Section B. **Never rename existing entries** — bump version
 * suffix instead (e.g. `search.performed.v2`).
 *
 * **Why TypeScript discriminated union via PropertiesMap:**
 * `tracker.track('search.result_clicked', { query, ... })` → if `product_id`
 * missing → compile error at consumer site, not runtime failure. Per
 * `07_BEHAVIOR_LOGS.md` §8 type safety contract.
 *
 * **Scope evolution:**
 * - **T06 (S-02 Phiên 27):** First 3 types — `session.started`, `product.viewed`,
 *   `cart.item_added` — sufficient để smoke test pipeline per BRIEF §4.
 * - **T03 (S-03 Phiên 33):** +5 types — `auth.signed_in`, `auth.signed_out`,
 *   `auth.password_reset_requested`, `nav.settings_section_opened`,
 *   `error.report_requested` — per V-SLICE S-03 First Auth Flow scope
 *   (DM-7 + DM-8 + C-07 + C-09).
 * - **T03b (S-03 Phiên 36):** +1 type — `nav.tile_clicked` — per V-SLICE S-03
 *   Home Dashboard hub scope (DM-16 + D-11 + C-23 R1 mapping LOCKED).
 * - **T06 (S-04 Phiên Sx04-12):** +5 types — `search.suggested_chip_tapped`,
 *   `search.followup_filter_tapped`, `search.typo_corrected`, `search.variant_degraded`,
 *   `search.first_card_rendered` — per D-S04-07/08/13/14 LAW. Total: 14 types.
 * - **Total T06 end:** 14 types. Full catalog (~25 per `07_BEHAVIOR §3`) populated
 *   incrementally per V-SLICE first-need.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3 (event catalog) + §8 (type safety)
 * @see LOG_CATALOG.md Section B (behavior event types — append-only registry)
 *
 * S-02 T06 emit. Extended S-03 T03 Phiên 33 (+5 schemas per C-07 + C-09 + DM-7).
 * Extended S-03 T03b Phiên 36 (+1 schema `nav.tile_clicked` per D-11 + C-23).
 * Extended S-04 T06 Phiên Sx04-12 (+5 schemas Search* per D-S04-07/08/13/14 LAW).
 */

import { z } from 'zod';
import {
  AuthSignedInPropertiesSchema,
  AuthSignedOutPropertiesSchema,
  AuthPasswordResetRequestedPropertiesSchema,
} from './auth-events.js';
import {
  NavSettingsSectionOpenedPropertiesSchema,
  NavTileClickedPropertiesSchema,
} from './nav-events.js';
import { ErrorReportRequestedPropertiesSchema } from './error-events.js';
import {
  SearchSuggestedChipTappedPropertiesSchema,
  SearchFollowupFilterTappedPropertiesSchema,
  SearchTypoCorrectedPropertiesSchema,
  SearchVariantDegradedPropertiesSchema,
  SearchFirstCardRenderedPropertiesSchema,
} from './search-events.js';

// ─────────────────────────────────────────────────────────────────────
// Properties schemas (Zod runtime validation per event type)
// ─────────────────────────────────────────────────────────────────────

/** `session.started` — emitted when client SDK initializes (07_BEHAVIOR §3.1). */
export const SessionStartedPropertiesSchema = z
  .object({
    source: z.enum(['web', 'mobile']),
  })
  .strict();

/** `product.viewed` — user opens product detail view (07_BEHAVIOR §3.3). */
export const ProductViewedPropertiesSchema = z
  .object({
    product_id: z.string().min(1).max(64),
    source: z.enum(['search', 'reco', 'cart', 'direct']),
    dwell_ms: z.number().int().nonnegative().optional(),
  })
  .strict();

/** `cart.item_added` — user adds item to cart (07_BEHAVIOR §3.4). */
export const CartItemAddedPropertiesSchema = z
  .object({
    product_id: z.string().min(1).max(64),
    qty: z.number().int().positive(),
    unit_price: z.number().int().nonnegative(),
    source: z.enum(['search', 'reco', 'voice', 'direct']),
    from_query: z.string().max(500).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// PropertiesMap — type-only registry mapping event_type → Zod schema
// ─────────────────────────────────────────────────────────────────────

/**
 * Lookup table mapping `BehaviorEventType` → its Zod properties schema.
 * Used internally by `validateProperties()` ingest helper + downstream
 * TypeScript `PropertiesFor<T>` inference.
 *
 * **Append rule:** Add new event type here ONLY after entry in
 * `LOG_CATALOG.md` Section B (per ADR-014 catalog-first governance).
 *
 * **Discriminated union note:** `BehaviorEventSchema` in `./tracker.ts`
 * auto-extends as this map grows — Zod 3.x `discriminatedUnion` requires
 * ≥2 variants; 14 variants for T06 fully supported.
 */
export const PROPERTIES_SCHEMA_MAP = {
  // S-02 T06 — baseline 3 types
  'session.started': SessionStartedPropertiesSchema,
  'product.viewed': ProductViewedPropertiesSchema,
  'cart.item_added': CartItemAddedPropertiesSchema,
  // S-03 T03 — +5 types (Auth + Navigation + Error subsets)
  'auth.signed_in': AuthSignedInPropertiesSchema,
  'auth.signed_out': AuthSignedOutPropertiesSchema,
  'auth.password_reset_requested': AuthPasswordResetRequestedPropertiesSchema,
  'nav.settings_section_opened': NavSettingsSectionOpenedPropertiesSchema,
  'error.report_requested': ErrorReportRequestedPropertiesSchema,
  // S-03 T03b — +1 type (Dashboard tile click — Navigation subset per D-11 + C-23 R1)
  'nav.tile_clicked': NavTileClickedPropertiesSchema,
  // S-04 T06 — +5 types (Discovery subset per D-S04-07/08/13/14 LAW; Phiên Sx04-12)
  'search.suggested_chip_tapped': SearchSuggestedChipTappedPropertiesSchema,
  'search.followup_filter_tapped': SearchFollowupFilterTappedPropertiesSchema,
  'search.typo_corrected': SearchTypoCorrectedPropertiesSchema,
  'search.variant_degraded': SearchVariantDegradedPropertiesSchema,
  'search.first_card_rendered': SearchFirstCardRenderedPropertiesSchema,
} as const;

/**
 * Union of all registered behavior event types — keys of
 * `PROPERTIES_SCHEMA_MAP`. T06 = 3 types; T03 = 8 types; T03b = 9 types;
 * S-04 T06 = 14 types; expands per V-SLICE.
 */
export type BehaviorEventType = keyof typeof PROPERTIES_SCHEMA_MAP;

/**
 * TypeScript `PropertiesMap` — compile-time view of per-event-type
 * properties shape. Used by `PropertiesFor<T>` to give tracker.track()
 * end-to-end type safety.
 */
export type PropertiesMap = {
  [K in BehaviorEventType]: z.infer<(typeof PROPERTIES_SCHEMA_MAP)[K]>;
};

/**
 * Generic helper — given an event_type, infers its properties shape.
 *
 * @example
 * ```ts
 * type CartProps = PropertiesFor<'cart.item_added'>;
 * // { product_id: string; qty: number; unit_price: number; source: ...; from_query?: string }
 *
 * type AuthInProps = PropertiesFor<'auth.signed_in'>;
 * // { method: 'password' }
 *
 * type NavProps = PropertiesFor<'nav.settings_section_opened'>;
 * // { section: 'notifications' | 'security' | 'help' }
 * ```
 */
export type PropertiesFor<T extends BehaviorEventType> = PropertiesMap[T];

/**
 * Runtime validate properties against the event_type's Zod schema.
 *
 * @returns `{ success: true, data }` if schema matches, else `{ success: false, error }`.
 *
 * Used server-side `tracking.service.ts` per-event validation (07_BEHAVIOR §9.3
 * schema drift detection — invalid events DROP, not 400).
 */
export function validateProperties<T extends BehaviorEventType>(
  eventType: T,
  properties: unknown,
): z.SafeParseReturnType<unknown, PropertiesFor<T>> {
  const schema = PROPERTIES_SCHEMA_MAP[eventType];
  return schema.safeParse(properties) as z.SafeParseReturnType<unknown, PropertiesFor<T>>;
}
