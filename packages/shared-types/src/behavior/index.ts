/**
 * `@icp/shared-types/behavior` — barrel re-export.
 *
 * **Dual access pattern (S-02 T06 C-32 + C-34 LOCKED):**
 * - **Frontend** (`apps/web`, Next.js bundler): import via subpath
 *   `@icp/shared-types/behavior` for tree-shake + clear consumer intent.
 * - **Backend** (`apps/gateway`, NestJS CommonJS): import via root
 *   `@icp/shared-types` (root barrel re-exports `./behavior` for CJS compat).
 *
 * @example
 * ```ts
 * // Frontend (Next.js):
 * import {
 *   BehaviorEventSchema,
 *   TrackBatchSchema,
 *   AuthSignedInPropertiesSchema,
 *   NavSettingsSectionOpenedPropertiesSchema,
 *   NavTileClickedPropertiesSchema,
 *   CartViewedPropertiesSchema,
 *   type BehaviorEvent,
 *   type BehaviorEventType,
 *   type PropertiesFor,
 *   validateProperties,
 * } from '@icp/shared-types/behavior';
 *
 * // Backend (NestJS CJS):
 * import { BehaviorEventSchema, AuthSignedInPropertiesSchema } from '@icp/shared-types';
 * ```
 *
 * S-02 T06 emit. Extended S-03 T03 Phiên 33 (+5 schema re-exports from
 * 3 new files: auth-events / nav-events / error-events). Extended S-03 T03b
 * Phiên 36 (+1 re-export NavTileClickedPropertiesSchema per D-11 + C-23 R1).
 * Extended S-04 T06 Phiên Sx04-12 (+5 re-exports Search* per D-S04-07/08/13/14 LAW).
 * Extended S-05 T03 Phiên Sx05-3 (+6 re-exports Cart* per C-S05-H Path A FE-emit).
 */

// Tracker contracts (canonical BehaviorEvent + batch request/response)
export {
  BehaviorEventSchema,
  TrackBatchSchema,
  TrackBatchResponseSchema,
  type BehaviorEvent,
  type TrackBatch,
  type TrackBatchResponse,
} from './tracker.js';

// Event catalog (PropertiesMap + per-type Zod schemas + validateProperties helper)
export {
  // S-02 T06 baseline 3 schemas
  SessionStartedPropertiesSchema,
  ProductViewedPropertiesSchema,
  CartItemAddedPropertiesSchema,
  // Catalog infrastructure
  PROPERTIES_SCHEMA_MAP,
  validateProperties,
  type BehaviorEventType,
  type PropertiesMap,
  type PropertiesFor,
} from './catalog.js';

// S-03 T03 — Auth & Session subset (3 schemas per 07_BEHAVIOR §3.1)
export {
  AuthSignedInPropertiesSchema,
  AuthSignedOutPropertiesSchema,
  AuthPasswordResetRequestedPropertiesSchema,
} from './auth-events.js';

// S-03 T03 — Navigation subset (1 schema per 07_BEHAVIOR §3.7 — added Phiên 30 C-07)
// S-03 T03b extension (1 schema per D-11 + C-23 R1 mapping — Phiên 36 Batch 2)
export {
  NavSettingsSectionOpenedPropertiesSchema,
  NavTileClickedPropertiesSchema,
} from './nav-events.js';

// S-03 T03 — Error subset (1 schema per 07_BEHAVIOR §3.8 — added Phiên 30 C-09)
export { ErrorReportRequestedPropertiesSchema } from './error-events.js';

// S-04 T06 (Phiên Sx04-12) — Discovery subset (5 schemas per 07_BEHAVIOR §3.2 LOCKED Phiên Sx04-4)
export {
  SearchSuggestedChipTappedPropertiesSchema,
  SearchFollowupFilterTappedPropertiesSchema,
  SearchTypoCorrectedPropertiesSchema,
  SearchVariantDegradedPropertiesSchema,
  SearchFirstCardRenderedPropertiesSchema,
} from './search-events.js';

// S-05 T03 (Phiên Sx05-3) — Cart subset (6 schemas per 07_BEHAVIOR §3.4; C-S05-H Path A)
// NOT included: cart.stock_resolved (Conflict #1 SKIP — Layer 1 no schema; sub-actions
// tracked via cart.item_removed + cart.item_added post-refetch).
export {
  CartViewedPropertiesSchema,
  CartItemRemovedPropertiesSchema,
  CartQtyChangedPropertiesSchema,
  CartClearedPropertiesSchema,
  CartPromoAppliedPropertiesSchema,
  CartPromoRemovedPropertiesSchema,
} from './cart-events.js';
