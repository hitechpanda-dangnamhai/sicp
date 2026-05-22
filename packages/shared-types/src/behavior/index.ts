/**
 * `@icp/shared-types/behavior` — barrel re-export.
 *
 * **Import via subpath ONLY** (mirror `./api` precedent, per C-32 resolution
 * Phiên 27): `@icp/shared-types/behavior`. NOT re-exported from root
 * `@icp/shared-types` index — keeps tree-shaking clean + consumer intent
 * explicit.
 *
 * @example
 * ```ts
 * import {
 *   BehaviorEventSchema,
 *   TrackBatchSchema,
 *   type BehaviorEvent,
 *   type BehaviorEventType,
 *   type PropertiesFor,
 *   validateProperties,
 * } from '@icp/shared-types/behavior';
 * ```
 *
 * S-02 T06 emit.
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
  SessionStartedPropertiesSchema,
  ProductViewedPropertiesSchema,
  CartItemAddedPropertiesSchema,
  PROPERTIES_SCHEMA_MAP,
  validateProperties,
  type BehaviorEventType,
  type PropertiesMap,
  type PropertiesFor,
} from './catalog.js';
