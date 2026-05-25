/**
 * `@icp/shared-types/behavior/cart-events.ts`
 *
 * **Behavior Event Properties Schemas — Cart subset (07_BEHAVIOR §3.4).**
 *
 * S-05 T03 NEW 6 behavior events emitted client-side by `/intent-05` page UI
 * interactions per Layer 1 docs §3.4 + W1 LOCK (FE-emit only architecture
 * verified Sx05-3-DISCOVER via Postgres `behavior_events` audit).
 *
 * **Source of authority:**
 * @see docs/07_BEHAVIOR_LOGS.md §3.4 (Cart event catalog)
 * @see docs/LOG_CATALOG.md Section B (registry alignment)
 * @see slices/S-05_decisions-log.md (D-S05-NN LAW)
 *
 * **Append rule (per ADR-014 catalog-first):** New event → append schema here
 * → append entry to `PROPERTIES_SCHEMA_MAP` in `./catalog.ts` → append Section B
 * row to `LOG_CATALOG.md` → emit via tracker hook in
 * `apps/web/src/features/cart/tracking-hooks.ts`.
 *
 * **NOT included** (per C-S05-H Conflict #1 resolution Option A SKIP):
 * - `cart.stock_resolved` — Layer 1 docs đồng thuận no schema declared. State-E
 *   sub-actions tracked via `cart.item_removed` (resolve_remove path) or
 *   `cart.item_removed` + `cart.item_added` (resolve_replace path) after
 *   `cart_updated` SSE → FE refetch resolves cart truth from server.
 *
 * **NOT included** (already shipped S-02 T06 baseline):
 * - `cart.item_added` — `behavior/catalog.ts` baseline (S-02 T06). Used by
 *   intent-03 page handleAdd + intent-05 state-E resolve_replace path.
 *
 * S-05 T03 emit (Phiên Sx05-3 per C-S05-H Path A; Postgres FE-emit verified).
 */

import { z } from 'zod';

/**
 * `cart.viewed` — emitted on `/intent-05` page mount per W1 LOCK FE-emit pattern.
 *
 * Used for: cart visit funnel analytics + drop-off measurement (page view →
 * checkout intent).
 *
 * Timing: fires inside `useEffect(() => { trackCartViewed(...) }, [])` once per
 * mount. StrictMode dev double-mount handled by tracker singleton dedup at
 * batch flush layer (not at emit call site).
 */
export const CartViewedPropertiesSchema = z
  .object({
    /** Number of distinct line items in the cart at view time (0 = empty state-B). */
    item_count: z.number().int().nonnegative(),
    /** Total VND amount payable at view time (after discount + shipping). */
    total: z.number().int().nonnegative(),
  })
  .strict();

/**
 * `cart.item_removed` — emitted on state-D undo-toast auto-commit OR state-E
 * stock-resolve `resolve_remove` path completion.
 *
 * Two distinct call sites:
 *   1. State-D: `<UndoRemoveToast>` onCommit fires after 3s → DELETE /cart/items/:id
 *      → trackCartItemRemoved (FE-only — user already saw toast 3s).
 *   2. State-E: After `cart_updated` SSE from `resolve_remove` action → emit
 *      with same product_id + qty captured pre-mutation.
 *
 * NOT emitted at undo button tap within 3s window (mutation reverted optimistically).
 */
export const CartItemRemovedPropertiesSchema = z
  .object({
    /** UUID of removed product (matches CartItem.product_id from snapshot). */
    product_id: z.string(),
    /** Quantity that was in cart before removal (preserved from optimistic state). */
    qty_removed: z.number().int().positive(),
  })
  .strict();

/**
 * `cart.qty_changed` — emitted after state-C debounce-commit completes (PATCH
 * /cart/items/:id success → CART_QUERY_KEY invalidate → refetch).
 *
 * Timing: PATCH success callback, NOT user-tap (multiple rapid taps debounce
 * to single emit per 300ms window). Pairs with state-C `<PendingSyncToast>`
 * UX — toast hides at same time as emit.
 *
 * If qty=0 → backend auto-removes; FE also emits `cart.item_removed` instead
 * (not `qty_changed` to 0). Cart contexts use these as distinct events for
 * funnel queryability.
 */
export const CartQtyChangedPropertiesSchema = z
  .object({
    /** UUID of product whose qty changed. */
    product_id: z.string(),
    /** Qty BEFORE user tap (server truth from prior cart.get). */
    old_qty: z.number().int().min(0),
    /** Qty AFTER debounce-commit (server-acknowledged via PATCH response). */
    new_qty: z.number().int().min(0),
  })
  .strict();

/**
 * `cart.cleared` — emitted on state-F clear-confirm flow completion
 * (`cart_cleared` SSE event received → modal closes → refetch shows empty).
 *
 * Timing: SSE event reception in `useCartStream` cart_cleared handler →
 * trackCartCleared invoked before queryClient.invalidateQueries call.
 *
 * NOT emitted on `cancel_clear` path (no mutation occurred → no behavior signal).
 */
export const CartClearedPropertiesSchema = z.object({}).strict();

/**
 * `cart.promo_applied` — emitted on state-G promo success path
 * (POST /cart/promo 200 → discount in response totals → `<PromoSuccessBanner>` render).
 *
 * Timing: usePostPromo onSuccess callback. NOT emitted on invalid promo (INVALID_CODE
 * error response). Captured snapshot of subtotal pre+post promo for discount-stack
 * analytics (e.g. "did SALE15 actually save user 15%? or did free-ship override?").
 */
export const CartPromoAppliedPropertiesSchema = z
  .object({
    /** Promo code applied (e.g. 'SALE15', 'FREESHIP', 'NEWUSER'). */
    code: z.string(),
    /** VND discount amount granted (from Cart.promo.discount_amount). */
    discount_amount: z.number().int(),
    /** Subtotal BEFORE promo applied (from prior Cart.totals.subtotal). */
    subtotal_before: z.number().int(),
    /** Subtotal AFTER promo applied (from new Cart.totals.subtotal). */
    subtotal_after: z.number().int(),
  })
  .strict();

/**
 * `cart.promo_removed` — emitted on state-G "Bỏ" button tap on promo pill
 * (DELETE /cart/promo 200 → promo field nulled → pill hides).
 *
 * Used for: promo abandon analytics (did user remove because total didn't
 * change? or because they applied wrong code?).
 */
export const CartPromoRemovedPropertiesSchema = z
  .object({
    /** Promo code that was removed (captured pre-mutation from Cart.promo.code). */
    code: z.string(),
  })
  .strict();
