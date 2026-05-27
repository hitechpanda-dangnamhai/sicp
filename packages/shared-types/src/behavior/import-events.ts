/**
 * `@icp/shared-types/behavior/import-events.ts`
 *
 * **Behavior Event Properties Schemas — Import subset (07_BEHAVIOR_LOGS.md §3.5).**
 *
 * S-07 T02 NEW 6 behavior events emitted client-side by `/intent-01` page UI
 * interactions per the V-SLICE Import flow. Tracks merchant funnel from
 * image upload → form prefill → card review → product commit.
 *
 * **Source of authority:**
 * @see docs/07_BEHAVIOR_LOGS.md §3.5 (Import event catalog — Phiên Sx07-B)
 * @see docs/LOG_CATALOG.md Section B (registry alignment)
 * @see slices/S-07_decisions-log.md C-S07-A (event-sourcing pattern)
 *
 * **Append rule (per ADR-014 catalog-first):** New event → append schema here
 * → append entry to `PROPERTIES_SCHEMA_MAP` in `./catalog.ts` → append Section B
 * row to `LOG_CATALOG.md` → emit via tracker hook in
 * `apps/web/src/features/import/tracking-hooks.ts`.
 *
 * **6 events** (NOT 7 — `card.expired` deferred per Sx07-F handoff B20):
 * 1. `product.import_started` — merchant clicks "Nhập hàng bằng ảnh"
 * 2. `product.import_completed` — commit succeeds (product visible in store)
 * 3. `product.import_abandoned` — user navigates away mid-flow
 * 4. `card.shown` — Action Card mounted in state-C suggestions
 * 5. `card.accepted` — user clicks Apply on a card
 * 6. `card.rejected` — user dismisses a card
 *
 * S-07 T02 emit (Phiên Sx07-F).
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Common enums (reused across schemas below)
// ─────────────────────────────────────────────────────────────────────

/**
 * State machine state where event was emitted.
 * Mirrors `apps/web/src/features/import/import-state-machine.ts` 11 states.
 *
 * Phase 3+: may extend with `voice_buy_*` states when S-08 reuses the
 * pattern; current S-07 scope locks 11 import states.
 */
const ImportStateSchema = z.enum([
  'state-0',
  'state-A',
  'state-B',
  'state-C-rising',
  'state-C-falling',
  'state-D',
  'state-E',
  'state-F',
  'state-G',
  'state-H',
  'cancelled',
]);

/**
 * Card variant enum — matches `apps/mcp/src/tools/policies.py` policy
 * `action_type` field (5 variants per S-07 BRIEF §2 Card UI table).
 */
const CardVariantSchema = z.enum([
  'SUGGEST_PRICE',
  'SUGGEST_ATTRS',
  'SUGGEST_ALTERNATIVES',
  'SUGGEST_CREDIT_LOAN',
  'SUGGEST_PROMOTION',
]);

// ─────────────────────────────────────────────────────────────────────
// 1. product.import_started
// ─────────────────────────────────────────────────────────────────────

/**
 * `product.import_started` — emitted when merchant first opens the Import
 * flow by clicking the "Nhập hàng bằng ảnh" CTA on home screen or
 * `/intent-01` direct route entry.
 *
 * **Timing:** USER CLICK on entry CTA — BEFORE image upload + POST /intent.
 * Fires once per session entry; subsequent retry/redo do NOT re-fire.
 *
 * Used for: funnel start count — denominator for `import_completed` ratio.
 */
export const ProductImportStartedPropertiesSchema = z
  .object({
    /** Where the user entered the flow (home dashboard tile vs direct URL vs chat CTA). */
    source: z.enum(['home_tile', 'direct_url', 'chat_cta']),
    /** Optional referrer URL for `direct_url` source. */
    referrer: z.string().max(500).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// 2. product.import_completed
// ─────────────────────────────────────────────────────────────────────

/**
 * `product.import_completed` — emitted when commit succeeds: AI graph
 * receives `choice: 'commit'` → MCP products.create + vespa.index succeed
 * → SSE `final` event arrives with `status: 'completed'`.
 *
 * **Timing:** ON SSE `final` event with `status === 'completed'`, BEFORE
 * SuccessTransition mounts the auto-redirect timer. Fires once per
 * `request_id`; replayed `commit` (idempotent) does NOT re-fire.
 *
 * Used for: funnel end count — numerator for `import_completed` ratio
 * (denominator = `import_started`). Drives WOW KPI demo metric.
 */
export const ProductImportCompletedPropertiesSchema = z
  .object({
    /** Correlation with AI ops log + product creation timestamp. */
    request_id: z.string().uuid(),
    /** Product UUID returned by products.create. */
    product_id: z.string().uuid(),
    /** Vision-derived category at submit time (post-merchant edit). */
    category: z.string().min(1).max(100),
    /** Final committed price VND. */
    final_price: z.number().int().nonnegative(),
    /** Total elapsed ms from `product.import_started` → final SSE event. */
    elapsed_ms: z.number().int().nonnegative(),
    /** Count of Action Cards shown during the flow (for completion-rate
     *  analysis split: 0 cards = happy path; ≥1 = friction surfaced). */
    cards_shown_count: z.number().int().nonnegative(),
    /** Count of cards accepted (subset of shown). */
    cards_accepted_count: z.number().int().nonnegative(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// 3. product.import_abandoned
// ─────────────────────────────────────────────────────────────────────

/**
 * `product.import_abandoned` — emitted when user navigates away mid-flow
 * (browser tab close, route change to non-Import path, explicit Cancel CTA).
 *
 * **Timing:** ON beforeunload / route transition OUTSIDE state-G. Fires once
 * per session; debounced via tracker singleton (no flood on rapid clicks).
 *
 * Used for: drop-off analysis per state — identifies which state has
 * highest abandonment (e.g., state-B prefill review = friction signal,
 * state-C card overload = UX issue).
 */
export const ProductImportAbandonedPropertiesSchema = z
  .object({
    /** Request_id if available (may be absent if abandoned before POST /intent). */
    request_id: z.string().uuid().optional(),
    /** State machine state at abandon time — for drop-off heatmap. */
    abandoned_at_state: ImportStateSchema,
    /** Elapsed ms from `product.import_started` → abandon. */
    elapsed_ms: z.number().int().nonnegative(),
    /** How user left (browser close, in-app nav, explicit cancel button). */
    reason: z.enum(['browser_close', 'in_app_navigation', 'explicit_cancel']),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// 4. card.shown
// ─────────────────────────────────────────────────────────────────────

/**
 * `card.shown` — emitted when an Action Card mounts in the DOM during
 * state-C (suggestions phase). One event per card; multiple per flow
 * possible (3 cards shown = 3 events).
 *
 * **Timing:** ON CARD MOUNT (React useEffect first render). Idempotent
 * via tracker ref guard — same `card_id` not re-fired on remount from
 * filter chip toggle.
 *
 * Used for: card surface impression count — denominator for accept/reject
 * ratio per `action_type` policy. Drives policy effectiveness analysis.
 */
export const CardShownPropertiesSchema = z
  .object({
    /** Correlation with the import flow. */
    request_id: z.string().uuid(),
    /** Card UUID from cards.create. */
    card_id: z.string().uuid(),
    /** Which policy generated this card (e.g., "P_PRICE_TOO_HIGH"). */
    policy_code: z.string().min(1).max(100),
    /** Card variant (drives UI rendering + analytics segmentation). */
    variant: CardVariantSchema,
    /** 0-based position in the card list at time of mount. */
    position: z.number().int().nonnegative(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// 5. card.accepted
// ─────────────────────────────────────────────────────────────────────

/**
 * `card.accepted` — emitted when user clicks the Apply CTA on a card
 * (e.g., "Áp dụng giá đề xuất" on SUGGEST_PRICE).
 *
 * **Timing:** USER CLICK on Apply button BEFORE POST /cards/:id/accept
 * fires. Analytics non-blocking — fire regardless of server outcome.
 *
 * Used for: card effectiveness — numerator for accept rate per policy.
 * Cards with low accept rate flagged for policy DSL tuning.
 */
export const CardAcceptedPropertiesSchema = z
  .object({
    /** Correlation. */
    request_id: z.string().uuid(),
    /** Card UUID. */
    card_id: z.string().uuid(),
    /** Policy code (for accept-rate-per-policy aggregation). */
    policy_code: z.string().min(1).max(100),
    /** Card variant. */
    variant: CardVariantSchema,
    /** Optional structured `applied_value` per variant:
     *  - SUGGEST_PRICE: `{ price: 65000 }`
     *  - SUGGEST_ATTRS: `{ added_attrs: { taste_profile: 'mặn dịu' } }`
     *  - SUGGEST_ALTERNATIVES: `{ replacement_product_id: 'p_abc' }`
     *  - etc. */
    applied_value: z.record(z.string(), z.unknown()).optional(),
    /** Elapsed ms from `card.shown` → accept (engagement latency). */
    decision_ms: z.number().int().nonnegative().optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// 6. card.rejected
// ─────────────────────────────────────────────────────────────────────

/**
 * `card.rejected` — emitted when user clicks the Dismiss CTA on a card.
 *
 * **Timing:** USER CLICK on Dismiss button BEFORE POST /cards/:id/reject.
 *
 * Used for: card pruning signal — high-rejection-rate cards flagged for
 * removal from policy DSL or template re-tuning.
 */
export const CardRejectedPropertiesSchema = z
  .object({
    /** Correlation. */
    request_id: z.string().uuid(),
    /** Card UUID. */
    card_id: z.string().uuid(),
    /** Policy code. */
    policy_code: z.string().min(1).max(100),
    /** Card variant. */
    variant: CardVariantSchema,
    /** Optional reason — may be empty if user clicks raw X without modal. */
    reason: z
      .enum([
        'not_relevant',
        'already_optimal',
        'too_aggressive',
        'unclear',
        'other',
      ])
      .optional(),
    /** Elapsed ms from `card.shown` → reject. */
    decision_ms: z.number().int().nonnegative().optional(),
  })
  .strict();
