'use client';

/**
 * apps/web/src/features/import/tracking-hooks.ts
 *
 * **Behavior tracker helper functions** for S-07 Intent 01 Import flow.
 *
 * Slice:    S-07 First Image AI Import
 * Task:     T02.D Behavior tracker + analytics (Phiên Sx07-F)
 *
 * **6 NEW behavior events** per 07_BEHAVIOR_LOGS.md §3.5 (LOCKED Phiên Sx07-B):
 *   1. `product.import_started`   — merchant clicks "Nhập hàng bằng ảnh" CTA
 *   2. `product.import_completed` — SSE final event success (commit done)
 *   3. `product.import_abandoned` — user leaves mid-flow (beforeunload / nav)
 *   4. `card.shown`               — Action Card mounts (state-C suggestions)
 *   5. `card.accepted`            — user taps Apply on a card
 *   6. `card.rejected`            — user taps Dismiss on a card
 *
 * **`card.expired` NOT included** (per Sx07-F handoff B20 — no T02 UI surface;
 * post-MVP TTL worker may add server-side).
 *
 * **Cloned from** `apps/web/src/features/search/tracking-hooks.ts` (135 LOC,
 * S-04 T06 Phiên Sx04-12 emit). Same `safeTrack` defensive wrapper + same
 * `PropertiesFor<T>` typed-shapes pattern.
 *
 * Decisions applied:
 * - **07_BEHAVIOR_LOGS.md §3.5 LOCKED**: event property schemas LOCKED Phiên Sx07-B
 * - **C-15** 'use client' — uses tracker singleton with browser-only sessionStorage
 * - **S-03 D-29 N+5b LAW**: tracker.setUser canonical API (this file uses .track only;
 *   identity already set by TrackerProvider at app boot — NO duplicate setUser)
 * - **StrictMode awareness**: tracker singleton handles dev double-mount safely;
 *   wrapper functions defensively try/catch to avoid blocking UI on tracker init issues
 *
 * **Pattern:** Pure helper functions (NOT React hooks despite filename) — wrap
 * `getTracker().track(event_type, properties)` with typed shapes per
 * `PropertiesFor<event_type>`. Call sites import + invoke directly (no hooks
 * order constraint). Filename ends `-hooks.ts` per TASKLIST T02.D LAW
 * naming convention (consistent with S-04 + S-05 features).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.5 (event property schemas LOCKED)
 * @see packages/shared-types/src/behavior/import-events.ts (Zod schemas)
 */

import { getTracker } from '@/lib/tracker';
import type { BehaviorEventType, PropertiesFor } from '@icp/shared-types/behavior';

/**
 * Defensive wrapper around `getTracker().track(...)` — analytics MUST NOT
 * block UI. If tracker not yet initialized OR network fails, swallow + continue.
 *
 * Per S-02 T06 baseline pattern (same as S-04 search tracking-hooks line 47-57).
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

// ─────────────────────────────────────────────────────────────────────────
// 1. product.import_started
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `product.import_started` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call site**: `apps/web/app/intent-01/page.tsx` on mount when user lands
 * on /intent-01 — fires ONCE per session entry. Subsequent retry/redo via
 * ImageDropZone "Chụp lại" do NOT re-fire (these are state-machine resets
 * within an existing session).
 *
 * Used for: funnel start count — denominator for `import_completed` ratio.
 */
export function trackProductImportStarted(
  properties: PropertiesFor<'product.import_started'>,
): void {
  safeTrack('product.import_started', properties);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. product.import_completed
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `product.import_completed` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call site**: `apps/web/app/intent-01/page.tsx` inside the SSE `final`
 * event handler (via `useImportFlow.dispatch({type: 'final', ...})`) — fires
 * ONCE per request_id. Replayed `commit` (idempotent) does NOT re-fire.
 *
 * Invoke INSIDE the useEffect that watches for state.kind === 'state-G'
 * transition (not on each render) — wrap with `useRef` idempotency guard
 * if state-G can re-render (it can — SuccessTransition timer counts down).
 *
 * Used for: funnel end count — numerator for `import_completed` ratio +
 * WOW KPI demo metric (elapsed_ms histogram).
 */
export function trackProductImportCompleted(
  properties: PropertiesFor<'product.import_completed'>,
): void {
  safeTrack('product.import_completed', properties);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. product.import_abandoned
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `product.import_abandoned` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call sites**:
 *   - `apps/web/app/intent-01/page.tsx` useEffect with `window.addEventListener
 *     ('beforeunload', ...)` → `reason: 'browser_close'`
 *   - `apps/web/app/intent-01/page.tsx` useEffect cleanup (route change) →
 *     `reason: 'in_app_navigation'`
 *   - Explicit cancel button → `reason: 'explicit_cancel'`
 *
 * **Idempotency**: tracker singleton debounces via sessionStorage flag; same
 * request_id won't double-fire across beforeunload + unmount cleanup race.
 *
 * Used for: drop-off analysis per state — identifies friction surface.
 */
export function trackProductImportAbandoned(
  properties: PropertiesFor<'product.import_abandoned'>,
): void {
  safeTrack('product.import_abandoned', properties);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. card.shown
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `card.shown` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call site**: `apps/web/app/intent-01/page.tsx` ActionCard render — inside
 * `useEffect(() => { trackCardShown(...) }, [card.card_id])` so each card
 * fires once on mount (NOT each render). Use `useRef<Set<string>>` if multiple
 * cards mount in same render frame.
 *
 * **Timing**: ON CARD MOUNT (React first render). Idempotent via tracker
 * singleton — same `card_id` not re-fired on remount from filter chip toggle
 * (S-09 forward-compat).
 *
 * Used for: card surface impression count — denominator for accept/reject
 * ratio per `policy_code`. Drives policy DSL effectiveness analysis.
 */
export function trackCardShown(
  properties: PropertiesFor<'card.shown'>,
): void {
  safeTrack('card.shown', properties);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. card.accepted
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `card.accepted` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call site**: `apps/web/app/intent-01/page.tsx` ActionCard onAccept handler
 * — invoke BEFORE POST /cards/:id/accept fires. Analytics non-blocking — fire
 * regardless of server outcome (server failure shouldn't lose the user-intent
 * signal).
 *
 * **`applied_value` shape per variant** (caller responsibility to populate):
 *   - SUGGEST_PRICE        → `{ price: 65000 }`
 *   - SUGGEST_ATTRS        → `{ added_attrs: { taste_profile: 'mặn dịu' } }`
 *   - SUGGEST_ALTERNATIVES → `{ replacement_product_id: 'p_abc' }`
 *   - SUGGEST_CREDIT_LOAN  → `{ loan_amount: 5000000 }`
 *   - SUGGEST_PROMOTION    → `{ promo_code: 'NEW10' }`
 *
 * Used for: card effectiveness — numerator for accept rate per policy.
 */
export function trackCardAccepted(
  properties: PropertiesFor<'card.accepted'>,
): void {
  safeTrack('card.accepted', properties);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. card.rejected
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `card.rejected` per 07_BEHAVIOR_LOGS.md §3.5.
 *
 * **Call site**: `apps/web/app/intent-01/page.tsx` ActionCard onReject handler
 * — invoke BEFORE POST /cards/:id/reject fires.
 *
 * **`reason` enum** (optional — may be empty if user clicks raw X without
 * a reason-modal):
 *   - 'not_relevant'    — card off-topic for this product
 *   - 'already_optimal' — merchant already pricing/attributing well
 *   - 'too_aggressive'  — suggestion too risky (e.g., drop price 30%)
 *   - 'unclear'         — merchant didn't understand the rationale
 *   - 'other'           — fallback bucket
 *
 * For T02 hackathon scope, FE may always send `reason: undefined` (no modal
 * UI yet). Post-MVP can add a dismiss-reason picker.
 *
 * Used for: card pruning signal — high-rejection-rate cards flagged for
 * removal from policy DSL or template re-tuning.
 */
export function trackCardRejected(
  properties: PropertiesFor<'card.rejected'>,
): void {
  safeTrack('card.rejected', properties);
}
