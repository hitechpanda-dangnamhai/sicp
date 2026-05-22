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
 * **Scope T06 (Phase 2, BRIEF §4 Non-Goals):** First 3 event types only —
 * `session.started`, `product.viewed`, `cart.item_added` — sufficient để
 * smoke test pipeline. Full catalog (~25 types per `07_BEHAVIOR §3`)
 * populated incrementally per V-SLICE first-need.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3 (event catalog) + §8 (type safety)
 * @see LOG_CATALOG.md Section B (behavior event types — append-only registry)
 *
 * S-02 T06 emit.
 */

import { z } from 'zod';

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
 */
export const PROPERTIES_SCHEMA_MAP = {
  'session.started': SessionStartedPropertiesSchema,
  'product.viewed': ProductViewedPropertiesSchema,
  'cart.item_added': CartItemAddedPropertiesSchema,
} as const;

/**
 * Union of all registered behavior event types — keys of
 * `PROPERTIES_SCHEMA_MAP`. T06 = 3 types; expands per V-SLICE.
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
