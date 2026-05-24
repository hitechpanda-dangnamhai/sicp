'use client';

/**
 * apps/web/src/features/search/tracking-hooks.ts
 *
 * **Behavior tracker helper functions** for S-04 Intent 03 Discovery flow.
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T06 Behavior tracker + acceptance fixture audit (Phiên Sx04-12)
 *
 * **5 NEW behavior events** per 07_BEHAVIOR_LOGS.md §3.2 LOCKED Phiên Sx04-4:
 *   1. `search.suggested_chip_tapped` (D-S04-07 LAW)
 *   2. `search.followup_filter_tapped` (D-S04-08 LAW)
 *   3. `search.typo_corrected` (D-S04-13 LAW Pattern A — user choice)
 *   4. `search.variant_degraded` (D-S04-03 + D-S04-13 LAW Pattern A — user choice)
 *   5. `search.first_card_rendered` (D-S04-14 LAW — paired telemetry)
 *
 * Decisions applied:
 * - D-S04-07/08/13/14 LAW: event property schemas per S-04_decisions-log.md Section 1
 * - D-S04-03 LAW: variant_degraded reason enum
 * - C-15: 'use client' (uses tracker singleton with browser-only sessionStorage)
 * - S-03 D-29 N+5b LAW: tracker.setUser canonical API (this file uses .track only;
 *   identity already set by TrackerProvider at app boot — NO duplicate setUser)
 * - StrictMode awareness: tracker singleton handles dev double-mount safely;
 *   wrapper functions defensively try/catch to avoid blocking UI on tracker init issues
 *
 * **Pattern:** Pure helper functions (NOT React hooks despite filename) — wrap
 * `getTracker().track(event_type, properties)` with typed shapes per
 * `PropertiesFor<event_type>`. Call sites import + invoke directly (no hooks
 * order constraint). Filename ends `-hooks.ts` per TASKLIST T06 line 231 LAW
 * naming convention (consistent with `use-search-stream.ts`, `use-followup-filter.ts`).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.2 (event property schemas LOCKED)
 * @see packages/shared-types/src/behavior/search-events.ts (Zod schemas)
 */

import { getTracker } from '@/lib/tracker';
import type { BehaviorEventType, PropertiesFor } from '@icp/shared-types/behavior';

/**
 * Defensive wrapper around `getTracker().track(...)` — analytics MUST NOT
 * block UI. If tracker not yet initialized OR network fails, swallow + continue.
 *
 * Per S-02 T06 baseline pattern (`apps/web/app/intent-03/page.tsx:134-144`
 * handleAdd cart.item_added emit precedent).
 */
function safeTrack<T extends BehaviorEventType>(
  type: T,
  properties: PropertiesFor<T>,
): void {
  try {
    getTracker().track(type, properties);
  } catch {
    // analytics non-blocking — tracker may not be init'd in tests or before
    // TrackerProvider mounts. Production correct via lazy init pattern.
  }
}

/**
 * Emit `search.suggested_chip_tapped` per D-S04-07 LAW.
 *
 * Call site: `app/intent-03/page.tsx` `handleSuggestedChipTap(query, position)`
 * (line ~108-117). Invoke BEFORE submitQuery to capture intent regardless of
 * subsequent search outcome.
 */
export function trackSearchSuggestedChipTapped(
  properties: PropertiesFor<'search.suggested_chip_tapped'>,
): void {
  safeTrack('search.suggested_chip_tapped', properties);
}

/**
 * Emit `search.followup_filter_tapped` per D-S04-08 LAW.
 *
 * Call site: `src/features/search/use-followup-filter.ts` `handleFilterTap(filter, label)`
 * (line ~68-79). Invoke BEFORE submitQuery re-trigger.
 */
export function trackSearchFollowupFilterTapped(
  properties: PropertiesFor<'search.followup_filter_tapped'>,
): void {
  safeTrack('search.followup_filter_tapped', properties);
}

/**
 * Emit `search.typo_corrected` per D-S04-13 LAW Pattern A.
 *
 * Call sites:
 *   - `app/intent-03/page.tsx` `handleTypoAccept` (line ~162-169) → user_choice: 'accept'
 *   - `app/intent-03/page.tsx` `handleTypoReject` (line ~171-178) → user_choice: 'reject'
 *
 * Invoke BEFORE postAction so analytics fires even if POST fails.
 */
export function trackSearchTypoCorrected(
  properties: PropertiesFor<'search.typo_corrected'>,
): void {
  safeTrack('search.typo_corrected', properties);
}

/**
 * Emit `search.variant_degraded` per D-S04-03 + D-S04-13 LAW Pattern A.
 *
 * Call sites:
 *   - `app/intent-03/page.tsx` `handleRetryAi` (line ~180-188) → user_choice: 'retry_ai'
 *   - `app/intent-03/page.tsx` `handleContinueBasic` (line ~190-197) → user_choice: 'continue_basic'
 *
 * NOTE: Emit at USER CHOICE time, NOT at variant_degraded SSE event reception.
 * 07_BEHAVIOR §3.2 line 90: "FE emits when user taps 'Thử lại với AI' / 'Dùng bản cơ bản'".
 * Stale TODO line 118 `use-search-stream.ts` (server-event site) DELETED in T06 — wrong site.
 *
 * `error_code` + `reason` + `trace_id` sourced from `state.variantDegraded`
 * payload captured at SSE variant_degraded reception (verified Phiên Sx04-12 —
 * field name is `variantDegraded` NOT `variantDegradedPayload`).
 */
export function trackSearchVariantDegraded(
  properties: PropertiesFor<'search.variant_degraded'>,
): void {
  safeTrack('search.variant_degraded', properties);
}

/**
 * Emit `search.first_card_rendered` per D-S04-14 LAW Adaptive Progressive Streaming.
 *
 * Call site: `src/features/search/use-search-stream.ts` product_ready handler
 * (line ~95-104). Invoke INSIDE handler IF first product_ready of this request_id
 * (idempotency via refs — see use-search-stream patch B5).
 *
 * `time_to_first_card_ms` measured via `performance.now()` delta from submitQuery.
 *
 * Pairs with AI ops log `intent.first_card_emitted` (T02 emit; AI-side).
 */
export function trackSearchFirstCardRendered(
  properties: PropertiesFor<'search.first_card_rendered'>,
): void {
  safeTrack('search.first_card_rendered', properties);
}
