/**
 * apps/web/src/features/cart/cart-state-machine.ts
 *
 * Pure state types + reducer for Intent 05 (Cart) flow.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * Source:   docs/mockups/intent-05/intent-05-state-{0,A,B,C,D,E,F,G}.html (8 states)
 *
 * Decisions applied:
 * - D-S05-01 LAW: Hybrid routing — Direct REST for stateless ops (qty/remove/promo)
 *                 + Pattern A interrupt for confirmation flows (clear / stock-resolve)
 * - D-S05-03 LAW: Pattern A interrupt resume — confirm_clear/cancel_clear (clear flow)
 *                 + resolve_remove/resolve_replace (stock flow)
 * - D-S05-07 LAW: Local optimistic state + debounced sync (NO useMutation.onMutate)
 *                 → `optimisticItems` Record provides instant feedback; debounce-commit
 *                 fires PATCH after 300ms idle window
 * - D-S05-08 LAW: PromoSuccessBanner canvas-confetti — tracked via `promoJustApplied`
 *                 transient state slot (cleared by `promo_dismiss` after banner fade)
 * - D-S05-11 LAW: 4 terminal SSE events minimal trigger → FE refetch pattern.
 *                 Reducer does NOT mutate cart truth; that's TanStack Query cache.
 *                 Reducer owns OPTIMISTIC overlays + UI flow state only.
 * - C-S05-H Path A: NO `cart.stock_resolved` event — state-E sub-actions covered
 *                   by item_removed + item_added events post-refetch.
 *
 * Pure module — NO React imports. Tests can exercise reducer in isolation.
 *
 * **Key design principle:** Reducer holds UI/flow state ONLY (modals, toasts,
 * active rid, optimistic qty overlays). Cart truth lives in TanStack Query
 * cache under CART_QUERY_KEY — invalidated by hooks on mutation success.
 * This separation enables clean optimistic-rollback per D-S05-07.
 */

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Stock replacement candidate from `stock_issue_ready` SSE event payload
 * (D-S05-04 LAW). Stored per-product in `stockReplacements` map.
 *
 * Nullable per item (LLM timeout OR Vespa no-match → null replacement;
 * UI only shows "Bỏ" CTA without "Thay" in that case).
 */
export interface StockReplacementData {
  productId: string;
  title: string;
  brand: string;
  unitPrice: number;
  availableStock: number;
}

/**
 * Pending sync toast payload for state-C qty-update flow (mockup state-C
 * line 192-200 inline toast between item 0 and updating item).
 */
export interface PendingSyncToastData {
  productId: string;
  oldQty: number;
  newQty: number;
  itemBrief: string; // "Maggi 700ml" — short label for toast
}

/**
 * Undo toast payload for state-D swipe-delete flow (mockup state-D line
 * 137-153). 3s countdown then auto-commit DELETE /cart/items/:id.
 */
export interface UndoToastData {
  productId: string;
  itemTitle: string;
  itemPrice: number;
}

/**
 * Clear-confirm modal payload from `clear_confirm` SSE event (D-S05-10 LAW
 * BE-driven Vietnamese strings; D-S05-09 LAW NO `actions[]` — FE hardcodes
 * button labels "Ở lại giỏ" / "Xoá hết").
 */
export interface ClearConfirmData {
  itemCount: number;
  subtotal: number;
  userMessage: string; // BE-templated full string with embedded numbers
  advice: string; // BE-templated advice paragraph
}

/**
 * Promo success transient state for state-G confetti banner (D-S05-08 LAW
 * canvas-confetti dynamic import). Cleared by `promo_dismiss` action after
 * banner fade animation completes.
 */
export interface PromoAppliedData {
  code: string;
  discountAmount: number;
  label: string; // "SALE15 giảm 15% toàn giỏ"
}

/**
 * Active Pattern A intent flow type.
 *
 * - `cart_clear_confirm` — state-F clear-cart modal flow
 * - `cart_view_with_stock_check` — state-E stock-issue resolution flow
 */
export type ActiveCartIntent = 'cart_clear_confirm' | 'cart_view_with_stock_check';

/**
 * Cart UI state — single source of truth for /intent-05 page reducer
 * overlays. Server cart truth lives separately in TanStack Query cache
 * (CART_QUERY_KEY).
 */
export interface CartState {
  /**
   * Optimistic qty overlay per product_id (D-S05-07 LAW).
   * Empty map = no optimistic state, render server truth as-is.
   * Populated = render overlay value + show <Spinner> + <PendingSyncToast>.
   */
  optimisticItems: Record<string, number>;

  /** State-C pending sync toast (1 max — single page-level toast per UX). */
  pendingSyncToast: PendingSyncToastData | null;

  /** State-D undo toast (3s countdown for swipe-delete optimistic remove). */
  undoToast: UndoToastData | null;

  /** State-F modal open/closed. Controlled by clear-confirm SSE arrival + user dismiss. */
  clearModalOpen: boolean;

  /** State-F clear-confirm payload from SSE event (BE-driven Vietnamese). */
  clearConfirmData: ClearConfirmData | null;

  /** State-E: are we in stock-issue resolution flow? (true after stock_issue_summary SSE). */
  stockIssueActive: boolean;

  /** State-E per-item replacement candidates from progressive `stock_issue_ready` SSE events. */
  stockReplacements: Record<string, StockReplacementData | null>;

  /** State-G transient confetti banner data (cleared post-dismiss). */
  promoJustApplied: PromoAppliedData | null;

  /** Active Pattern A request_id (clear-confirm OR stock-check). null when no flow active. */
  activeRid: string | null;

  /** Which entry intent is active (mutually exclusive — only one Pattern A flow at a time). */
  activeIntent: ActiveCartIntent | null;

  /** D-S04-13 LAW monotonic counter for resume idempotency; bumped on each Pattern A flow start. */
  attemptN: number;

  /** SSE error overlay (transient — cleared on next user action). */
  sseError: string | null;
}

/**
 * Action union — every event/handler that mutates UI/flow state.
 * Adding new actions REQUIRES corresponding reducer case (TS compile gate via exhaustive check).
 */
export type CartAction =
  // Page lifecycle
  | { type: 'page_mounted' }
  | { type: 'reset' }

  // Qty stepper flow (state-C)
  | { type: 'qty_tap'; productId: string; newQty: number; oldQty: number; itemBrief: string }
  | { type: 'qty_debounced_patch'; productId: string }
  | { type: 'qty_patch_settled'; productId: string }
  | { type: 'qty_cancel_pending' }

  // Remove flow (state-D)
  | { type: 'remove_tap'; productId: string; itemTitle: string; itemPrice: number }
  | { type: 'undo_tap' }
  | { type: 'undo_commit_timeout' }

  // Stock issue Pattern A flow (state-E)
  | { type: 'stock_check_opened'; requestId: string }
  | { type: 'stock_issue_ready_sse'; productId: string; replacement: StockReplacementData | null }
  | { type: 'stock_issue_summary_sse'; productIds: string[] }
  | { type: 'stock_resolved' }

  // Clear-cart Pattern A flow (state-F)
  | { type: 'clear_tap'; requestId: string }
  | { type: 'clear_confirm_sse'; payload: ClearConfirmData }
  | { type: 'clear_modal_cancel' }
  | { type: 'clear_settled' }

  // Promo flow (state-G)
  | { type: 'promo_applied'; code: string; discountAmount: number; label: string }
  | { type: 'promo_dismiss' }

  // SSE lifecycle
  | { type: 'sse_error'; message: string }
  | { type: 'sse_terminal' };

export const initialCartState: CartState = {
  optimisticItems: {},
  pendingSyncToast: null,
  undoToast: null,
  clearModalOpen: false,
  clearConfirmData: null,
  stockIssueActive: false,
  stockReplacements: {},
  promoJustApplied: null,
  activeRid: null,
  activeIntent: null,
  attemptN: 1,
  sseError: null,
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Compute free-ship progress data from subtotal + threshold (default 100k).
 * Used by CartSummary inline progress bar (mockup state-0 line 275-280
 * shows "Anh đã được miễn phí" when ≥ threshold; state-C may show progress text).
 *
 * @returns object with progress ratio (0-1 clamped) + remaining amount
 *          ({progress: 1, remaining: 0} when already free)
 */
export function computeFreeShipProgress(
  subtotal: number,
  threshold = 100_000,
): { progress: number; remaining: number; isFree: boolean } {
  if (subtotal >= threshold) {
    return { progress: 1, remaining: 0, isFree: true };
  }
  if (subtotal <= 0 || !Number.isFinite(subtotal)) {
    return { progress: 0, remaining: threshold, isFree: false };
  }
  return {
    progress: subtotal / threshold,
    remaining: threshold - subtotal,
    isFree: false,
  };
}

/**
 * Resolve displayed qty for a product — optimistic overlay if pending, else server truth.
 *
 * @param productId       product to resolve
 * @param serverQty       qty from current Cart in TanStack cache
 * @param optimisticItems reducer's optimistic overlay map
 */
export function resolveDisplayQty(
  productId: string,
  serverQty: number,
  optimisticItems: Record<string, number>,
): number {
  const optimistic = optimisticItems[productId];
  return optimistic !== undefined ? optimistic : serverQty;
}

/**
 * Check if product has pending optimistic qty (used to render <Spinner> in stepper).
 */
export function hasOptimisticQty(
  productId: string,
  optimisticItems: Record<string, number>,
): boolean {
  return optimisticItems[productId] !== undefined;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Pure reducer — state + action → new state.
 *
 * NEVER mutates input state. Returns new object reference on every call (React diffing).
 * Each case is independent of order; multiple SSE events may fire concurrently → React state
 * batches via setState callback pattern in useCartStream.
 */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'page_mounted':
      // No-op currently — kept for symmetry + future telemetry hook.
      return state;

    case 'reset':
      return { ...initialCartState };

    // ─── State-C: qty stepper flow ─────────────────────────────────────────
    case 'qty_tap': {
      // Set optimistic qty overlay + show <PendingSyncToast>.
      // Multiple rapid taps on same product → only last wins (debounce coalesces).
      return {
        ...state,
        optimisticItems: { ...state.optimisticItems, [action.productId]: action.newQty },
        pendingSyncToast: {
          productId: action.productId,
          oldQty: action.oldQty,
          newQty: action.newQty,
          itemBrief: action.itemBrief,
        },
      };
    }

    case 'qty_debounced_patch':
      // Debounce timer fired → PATCH is now in-flight. No state change here
      // (overlay + toast stay visible until PATCH success/failure settles).
      return state;

    case 'qty_patch_settled': {
      // PATCH succeeded → CART_QUERY_KEY invalidated → refetch resolved.
      // Clear optimistic overlay + toast for this product.
      const { [action.productId]: _, ...remaining } = state.optimisticItems;
      void _;
      const stillRelatedToast =
        state.pendingSyncToast?.productId === action.productId;
      return {
        ...state,
        optimisticItems: remaining,
        pendingSyncToast: stillRelatedToast ? null : state.pendingSyncToast,
      };
    }

    case 'qty_cancel_pending':
      // User tapped "Huỷ" inside PendingSyncToast → revert all optimistic + close toast.
      return {
        ...state,
        optimisticItems: {},
        pendingSyncToast: null,
      };

    // ─── State-D: remove flow (swipe → undo toast 3s) ──────────────────────
    case 'remove_tap':
      return {
        ...state,
        undoToast: {
          productId: action.productId,
          itemTitle: action.itemTitle,
          itemPrice: action.itemPrice,
        },
      };

    case 'undo_tap':
      // User tapped "Hoàn tác" within 3s window → cancel pending DELETE.
      // Page-level handler also cancels the setTimeout in UndoRemoveToast.
      return { ...state, undoToast: null };

    case 'undo_commit_timeout':
      // 3s elapsed → toast auto-dismisses. Page-level handler fires DELETE /cart/items/:id
      // + trackCartItemRemoved. Reducer just clears the toast slot.
      return { ...state, undoToast: null };

    // ─── State-E: stock issue Pattern A flow ───────────────────────────────
    case 'stock_check_opened':
      return {
        ...state,
        activeRid: action.requestId,
        activeIntent: 'cart_view_with_stock_check',
        stockIssueActive: false, // becomes true after stock_issue_summary
        stockReplacements: {},
      };

    case 'stock_issue_ready_sse':
      // Per-item progressive arrival — record candidate per product_id.
      return {
        ...state,
        stockReplacements: {
          ...state.stockReplacements,
          [action.productId]: action.replacement,
        },
      };

    case 'stock_issue_summary_sse':
      // All replacements ready — enable resolve UI.
      return { ...state, stockIssueActive: true };

    case 'stock_resolved':
      // resolve_remove or resolve_replace action POSTed + cart_updated SSE received.
      // Clear flow state; cart truth will refresh via invalidateQueries.
      return {
        ...state,
        stockIssueActive: false,
        stockReplacements: {},
        activeRid: null,
        activeIntent: null,
      };

    // ─── State-F: clear-cart Pattern A flow ────────────────────────────────
    case 'clear_tap':
      return {
        ...state,
        activeRid: action.requestId,
        activeIntent: 'cart_clear_confirm',
        // Note: modal opens only after clear_confirm SSE arrives (D-S05-10 BE-driven copy).
      };

    case 'clear_confirm_sse':
      return {
        ...state,
        clearModalOpen: true,
        clearConfirmData: action.payload,
      };

    case 'clear_modal_cancel':
      // User dismissed via "Ở lại giỏ" button — also fires cancel_clear action POST.
      return {
        ...state,
        clearModalOpen: false,
        clearConfirmData: null,
        activeRid: null,
        activeIntent: null,
        attemptN: state.attemptN + 1,
      };

    case 'clear_settled':
      // cart_cleared OR clear_cancelled SSE received — close modal + clear flow.
      return {
        ...state,
        clearModalOpen: false,
        clearConfirmData: null,
        activeRid: null,
        activeIntent: null,
      };

    // ─── State-G: promo flow ───────────────────────────────────────────────
    case 'promo_applied':
      return {
        ...state,
        promoJustApplied: {
          code: action.code,
          discountAmount: action.discountAmount,
          label: action.label,
        },
      };

    case 'promo_dismiss':
      return { ...state, promoJustApplied: null };

    // ─── SSE lifecycle ─────────────────────────────────────────────────────
    case 'sse_error':
      return { ...state, sseError: action.message };

    case 'sse_terminal':
      // Stream completed (final event) — clear activeRid; preserve other UI state.
      return { ...state, activeRid: null, activeIntent: null };

    default: {
      // Exhaustive check — TS compile error if new action type added without case.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
