/**
 * `@icp/shared-types/behavior/tracker.ts`
 *
 * **Canonical `BehaviorEventSchema` + batch ingest contracts.**
 *
 * Source of truth: `docs/07_BEHAVIOR_LOGS.md` §2 (BehaviorEvent schema LOCKED).
 *
 * **Why discriminated union via PROPERTIES_SCHEMA_MAP:** Per event_type, the
 * `properties` field has a strict schema. Zod `discriminatedUnion('event_type', ...)`
 * gives runtime validation that catches schema drift (07_BEHAVIOR §9.3) —
 * invalid events DROP server-side (not 400), per BRIEF DM-10 acceptance.
 *
 * **C-31 surface (Phiên 27):** `03_API_CONTRACTS.md` §1 endpoint list does NOT
 * include `POST /track`. T06 defines the contract here via Swagger-decorated
 * controller + this schema; Phase 3 maintainer batch reconciles §1.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §2 (BehaviorEvent schema) + §4 (pipeline)
 * @see docs/08_FE_BE_CONTRACT.md §3 (folder layout) + §4 (Zod bridge)
 *
 * S-02 T06 emit.
 */

import { z } from 'zod';
import { UuidSchema, IsoDateSchema } from '../primitives.js';
import { PROPERTIES_SCHEMA_MAP, type BehaviorEventType } from './catalog.js';

// ─────────────────────────────────────────────────────────────────────
// BehaviorEvent envelope (07_BEHAVIOR §2 LOCKED schema)
// ─────────────────────────────────────────────────────────────────────

/**
 * Shared identity + context + tech fields common to every event_type.
 * The `properties` field is event-type-specific — see `BehaviorEventSchema`
 * discriminated union below.
 */
const BehaviorEventBaseSchema = z.object({
  // Identity
  event_id: UuidSchema,
  occurred_at: IsoDateSchema,
  /**
   * Server-fills `received_at = NOW()` on ingest (DB default). Client may
   * omit; if provided, server ignores. Optional in schema for FE ergonomics.
   */
  received_at: IsoDateSchema.optional(),

  // Actor
  user_id: UuidSchema.optional(),
  session_id: z.string().min(1).max(64),
  device_id: z.string().min(1).max(64).optional(),

  // Context (denormalized — never depend on JOIN at query time per 07_BEHAVIOR §2)
  intent: z.string().min(1).max(80).optional(),
  modality: z.enum(['text', 'voice', 'image']).optional(),
  request_id: z.string().min(1).max(64).optional(),

  // Subject (what was acted on)
  subject_type: z.enum(['product', 'cart', 'order', 'category', 'query', 'card']).optional(),
  subject_id: z.string().min(1).max(64).optional(),

  // Tech
  user_agent: z.string().max(500).optional(),
  ip_hash: z.string().max(64).optional(),
  app_version: z.string().min(1).max(20),
});

/**
 * Build the discriminated union: for each registered event_type, pair the
 * base schema + literal `event_type` + per-type properties schema.
 *
 * `PROPERTIES_SCHEMA_MAP` is the single source — adding new event types
 * automatically extends this union.
 */
const eventVariants = (Object.keys(PROPERTIES_SCHEMA_MAP) as BehaviorEventType[]).map((type) =>
  BehaviorEventBaseSchema.extend({
    event_type: z.literal(type),
    properties: PROPERTIES_SCHEMA_MAP[type],
  }),
);

/**
 * Canonical `BehaviorEvent` schema. Validated at server ingest before
 * Postgres INSERT. Type-safe end-to-end with FE tracker per `PropertiesMap`.
 *
 * Zod 3.x `discriminatedUnion` requires ≥2 variants — for T06's 3 types,
 * union of 3. As catalog grows per V-SLICE, union grows automatically.
 */
export const BehaviorEventSchema = z.discriminatedUnion(
  'event_type',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventVariants as unknown as readonly [
    (typeof eventVariants)[number],
    (typeof eventVariants)[number],
    ...(typeof eventVariants)[number][],
  ],
);

/** Inferred TS type — exact shape of one validated behavior event. */
export type BehaviorEvent = z.infer<typeof BehaviorEventSchema>;

// ─────────────────────────────────────────────────────────────────────
// Batch ingest contracts (POST /api/v1/track)
// ─────────────────────────────────────────────────────────────────────

/**
 * Request body shape for `POST /api/v1/track`.
 *
 * Constraints:
 * - `events.length` ≥1 and ≤500 (batch size cap to prevent payload abuse).
 *   500 matches Postgres `pg.query` parameterized limit safety + 07_BEHAVIOR
 *   §9.2 rate limit 1000 events/user/hour (allows 2 batches/min).
 */
export const TrackBatchSchema = z
  .object({
    events: z.array(BehaviorEventSchema).min(1).max(500),
  })
  .strict();

/** Inferred TS type — request body for tracker SDK + ingest endpoint. */
export type TrackBatch = z.infer<typeof TrackBatchSchema>;

/**
 * Response body shape for `POST /api/v1/track`.
 *
 * Always `202 Accepted` — semantics: "events received; persistence is
 * eventually-consistent via DB sink". Per `07_BEHAVIOR §4` pipeline (drop
 * invalid, not 400).
 *
 * Fields:
 * - `accepted`: count of events that passed Zod validation + bot filter
 *   + DB INSERT (new row added)
 * - `dropped`: count of events that failed validation or bot filter (NOT
 *   counting `ON CONFLICT DO NOTHING` no-ops — those are silent dedup
 *   per `event_id` PK at DB level)
 * - `request_id`: correlation ID for log lookup
 *   (`tracker.batch_persisted.request_id == <this>`)
 */
export const TrackBatchResponseSchema = z
  .object({
    accepted: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
    request_id: z.string(),
  })
  .strict();

/** Inferred TS type — response body shape for tracker SDK consumer. */
export type TrackBatchResponse = z.infer<typeof TrackBatchResponseSchema>;
