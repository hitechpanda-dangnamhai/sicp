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
