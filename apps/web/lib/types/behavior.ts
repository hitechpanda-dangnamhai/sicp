/**
 * apps/web/lib/types/behavior.ts
 *
 * **Client-facing barrel** re-exporting select types from
 * `@icp/shared-types/behavior` for `apps/web` consumer ergonomics.
 *
 * **Why a thin re-export layer instead of consumers importing directly:**
 * - Consistency with `apps/web/lib/icon-map.ts` style (single-source per feature).
 * - Future allows app-level type augmentation (e.g. branded `WebDeviceId`)
 *   without breaking shared-types contract.
 * - IDE autocomplete from `@/lib/types/behavior` is shorter than full path.
 *
 * **Note:** Runtime schemas + helpers (Zod, validateProperties) NOT re-exported
 * here — `apps/web/lib/tracker.ts` imports them directly from
 * `@icp/shared-types/behavior` to keep tree-shaking explicit.
 *
 * S-02 T06 emit.
 */

export type {
  BehaviorEvent,
  BehaviorEventType,
  PropertiesFor,
  PropertiesMap,
  TrackBatch,
  TrackBatchResponse,
} from '@icp/shared-types/behavior';
