'use client';

/**
 * apps/web/src/features/cart/tracking-hooks.ts
 *
 * **Behavior tracker helper functions** for S-05 Intent 05 Cart flow.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * **6 NEW behavior events** per 07_BEHAVIOR_LOGS.md §3.4 (Cart subset):
 *   1. `cart.viewed` (page mount per W1 LOCK FE-emit)
 *   2. `cart.item_removed` (state-D undo timeout commit OR state-E resolve_remove)
 *   3. `cart.qty_changed` (state-C debounce commit)
 *   4. `cart.cleared` (state-F cart_cleared SSE)
 *   5. `cart.promo_applied` (state-G fast-path success)
 *   6. `cart.promo_removed` (state-G "Bỏ" button)
 *
 * **NOT emitted** (per C-S05-H Conflict #1 SKIP Path A):
 *   - `cart.stock_resolved` — Layer 1 docs no schema. State-E sub-actions
 *     covered by `cart.item_removed` (resolve_remove path) + optionally
 *     `cart.item_added` (resolve_replace path — emit via existing baseline).
 *
 * **Baseline emit (NOT in this file — already wired elsewhere):**
 *   - `cart.item_added` — emitted by `apps/web/app/intent-03/page.tsx:134-144`
 *     handleAdd (S-02 T06 baseline + S-04 T05 inheritance). Cart page state-E
 *     resolve_replace path piggy-backs via direct getTracker().track() call
 *     after cart_updated SSE refetch confirms item present.
 *
 * Decisions applied:
 * - W1 LOCK FE-emit architecture: verified Sx05-3-DISCOVER Postgres audit
 *   shows ZERO server-side cart.* emits — all 6 events MUST be wired here.
 * - C-S05-H Path A: 6 events declared (NOT 7 — no stock_resolved).
 * - safeTrack pattern: try/catch swallow — analytics non-blocking per S-02 T06 precedent.
 * - C-15 'use client': uses tracker singleton with browser-only sessionStorage.
 *
 * **Pattern:** Pure helper functions (NOT React hooks despite filename) — wrap
 * `getTracker().track(event_type, properties)` with typed shapes per
 * `PropertiesFor<event_type>`. Filename ends `-hooks.ts` per repo convention
 * (consistent with search-features/tracking-hooks.ts).
 *
 * @see docs/07_BEHAVIOR_LOGS.md §3.4 (Cart event property schemas)
 * @see packages/shared-types/src/behavior/cart-events.ts (Zod schemas)
 */

import { getTracker } from '@/lib/tracker';
import type { BehaviorEventType, PropertiesFor } from '@icp/shared-types/behavior';

/**
 * Defensive wrapper around `getTracker().track(...)` — analytics MUST NOT
 * block UI. If tracker not yet initialized OR network fails, swallow + continue.
 *
 * Clones pattern from `apps/web/src/features/search/tracking-hooks.ts:47-57`.
 */
function safeTrack<T extends BehaviorEventType>(type: T, properties: PropertiesFor<T>): void {
  try {
    getTracker().track(type, properties);
  } catch {
    // analytics non-blocking — tracker may not be init'd in tests or before
    // TrackerProvider mounts. Production correct via lazy init pattern.
  }
}

/**
 * Emit `cart.viewed` — fires on /intent-05 page mount.
 *
 * Call site: `app/intent-05/page.tsx` inside `useEffect(() => trackCartViewed({...}), [])`
 * with cart data resolved from useCart query. StrictMode dev double-mount handled
 * by tracker singleton dedup at batch flush layer.
 */
export function trackCartViewed(properties: PropertiesFor<'cart.viewed'>): void {
  safeTrack('cart.viewed', properties);
}

/**
 * Emit `cart.item_removed` per W1 LOCK FE-emit.
 *
 * Two call sites:
 *   1. State-D: page handler `handleUndoCommitTimeout` after 3s elapsed → DELETE fires.
 *      Emit BEFORE DELETE so analytics fires regardless of network outcome.
 *   2. State-E: after `cart_updated` SSE on resolve_remove path; emit with
 *      captured product_id + qty from pre-mutation state.
 */
export function trackCartItemRemoved(properties: PropertiesFor<'cart.item_removed'>): void {
  safeTrack('cart.item_removed', properties);
}

/**
 * Emit `cart.qty_changed` per W1 LOCK FE-emit.
 *
 * Call site: state-C usePatchCartItem onSuccess callback (after BE acknowledges
 * the debounced PATCH). Emit AFTER success to avoid noise from network failures.
 *
 * Note: qty=0 → backend auto-removes; FE emits `cart.item_removed` instead in
 * that path (handled by caller branch logic).
 */
export function trackCartQtyChanged(properties: PropertiesFor<'cart.qty_changed'>): void {
  safeTrack('cart.qty_changed', properties);
}

/**
 * Emit `cart.cleared` per W1 LOCK FE-emit.
 *
 * Call site: `useCartStream` `cart_cleared` SSE handler — emit BEFORE
 * invalidateQueries (which triggers refetch + state-B render).
 *
 * NOT emitted on `clear_cancelled` path (no mutation → no signal).
 */
export function trackCartCleared(properties: PropertiesFor<'cart.cleared'>): void {
  safeTrack('cart.cleared', properties);
}

/**
 * Emit `cart.promo_applied` per W1 LOCK FE-emit.
 *
 * Call site: state-G usePostPromo onSuccess callback. Captures subtotal
 * snapshots from prior Cart (subtotal_before) + new Cart (subtotal_after)
 * for discount-stack analytics.
 *
 * NOT emitted on INVALID_CODE error path (caller branches via mutation.error).
 */
export function trackCartPromoApplied(properties: PropertiesFor<'cart.promo_applied'>): void {
  safeTrack('cart.promo_applied', properties);
}

/**
 * Emit `cart.promo_removed` per W1 LOCK FE-emit.
 *
 * Call site: state-G useDeletePromo onSuccess callback. Captured code from
 * pre-mutation Cart.promo.code (pre-DELETE response — promo field nulled in response).
 */
export function trackCartPromoRemoved(properties: PropertiesFor<'cart.promo_removed'>): void {
  safeTrack('cart.promo_removed', properties);
}
