'use client';

/**
 * apps/web/src/features/recommend/tracking-hooks.ts
 *
 * **Behavior tracker helper functions** for S-09 Intent 04 Image Recommendation flow.
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F) — paired tracker integration AC42
 *
 * **4 behavior events** per Phase 05 §I observability requirements +
 * 07_BEHAVIOR_LOGS.md §3.X (S-09 V-SLICE additions):
 *   1. `recommendation.shown` — emit when first ProductCard paints (first product_ready)
 *   2. `recommendation.clicked` — emit on +button card tap (per match_type + position)
 *   3. `recommendation.dismissed` — OPTIONAL emit on signal filter chip change
 *   4. `intent.first_card_emitted` — FE counterpart of AI ops log (D-S04-14 LAW reuse)
 *
 * Decisions applied:
 * - D-S04-14 LAW cross-slice: paired first-card telemetry pattern reused from S-04
 *   `trackSearchFirstCardRendered`. FE emits `intent.first_card_emitted` at first
 *   ProductCard paint with `time_to_first_card_ms` measured from submitImage.
 * - C-15: 'use client' (uses tracker singleton with browser-only sessionStorage).
 * - StrictMode awareness: tracker singleton handles dev double-mount safely;
 *   wrapper functions defensively try/catch to avoid blocking UI.
 *
 * **Pattern:** Pure helper functions (NOT React hooks despite filename) — wrap
 * `getTracker().track(event_type, properties)`. Call sites import + invoke directly.
 * Filename ends `-hooks.ts` per S-04 T06 LAW naming convention consistency.
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.X (S-09 event schemas)
 * @see PHASE_05_RECO_ANALYTICS.md §I "Observability Phase 05"
 */

import { getTracker } from '@/lib/tracker';

/**
 * Defensive wrapper around `getTracker().track(...)`. Analytics MUST NOT
 * block UI. Tracker may not be init'd in tests or before TrackerProvider
 * mounts; swallow + continue.
 *
 * Generic typing: behavior event types for S-09 are NOT yet registered in
 * `@icp/shared-types/behavior` (S-09 T01 ship focused BE-side); page-level
 * shapes are local per Phase 05 §I. Strongly-typed registration is a future
 * cross-slice consolidation (deferred to S-10 analytics close).
 */
function safeTrack(type: string, properties: Record<string, unknown>): void {
  try {
    // Tracker.track is typed against registered BehaviorEventType union;
    // for S-09 we pass `as never` because schemas are local (see JSDoc above).
    (getTracker().track as (t: string, p: Record<string, unknown>) => void)(
      type,
      properties,
    );
  } catch {
    // analytics non-blocking
  }
}

/**
 * Emit `recommendation.shown` per Phase 05 §I.
 *
 * Call site: `app/intent-04/page.tsx` useEffect first ProductCard paint
 * (state.products[0] non-undefined transition).
 *
 * Properties:
 * - source: 'image' (S-09 default) | 'product' | 'cart' (future slices)
 * - seed_product_id?: string — null for image-source
 * - products: Array<{position, product_id, reason, match_type}>
 * - request_id: string
 */
export function trackRecommendationShown(properties: {
  source: 'image' | 'product' | 'cart';
  seed_product_id?: string | null;
  products: Array<{
    position: number;
    product_id: string;
    reason: string;
    match_type: 'visual' | 'collab' | 'trending';
  }>;
  request_id: string;
}): void {
  safeTrack('recommendation.shown', properties);
}

/**
 * Emit `recommendation.clicked` on +button card tap.
 *
 * Call site: `app/intent-04/page.tsx` ProductCard onAdd handler.
 *
 * Properties:
 * - position: 0-based index in carousel
 * - product_id: string
 * - match_type: 'visual' | 'collab' | 'trending'
 * - active_signal_filter: SignalKey (current chip when click happened)
 * - request_id: string
 */
export function trackRecommendationClicked(properties: {
  position: number;
  product_id: string;
  match_type: 'visual' | 'collab' | 'trending';
  active_signal_filter: 'visual' | 'collab' | 'trending';
  request_id: string;
}): void {
  safeTrack('recommendation.clicked', properties);
}

/**
 * Emit `recommendation.dismissed` (OPTIONAL NICE_TO_HAVE per Phase 05 §I) on
 * signal filter chip change. Useful for CTR feedback loop in re-rank tuning.
 *
 * Call site: `app/intent-04/page.tsx` SignalFilterChips onChipTap handler.
 */
export function trackRecommendationDismissed(properties: {
  from_signal: 'visual' | 'collab' | 'trending';
  to_signal: 'visual' | 'collab' | 'trending';
  request_id: string;
}): void {
  safeTrack('recommendation.dismissed', properties);
}

/**
 * Emit `intent.first_card_emitted` (FE counterpart per D-S04-14 LAW paired
 * telemetry). Measures perceived-latency from user submitImage → first
 * ProductCard paint.
 *
 * Call site: `app/intent-04/page.tsx` useEffect when state.products[0] first
 * becomes non-undefined (D-S04-14 progressive streaming entry).
 */
export function trackFirstCardEmitted(properties: {
  request_id: string;
  time_to_first_card_ms: number;
  total_cards_expected: number;
  source: 'image';
}): void {
  safeTrack('intent.first_card_emitted', properties);
}
