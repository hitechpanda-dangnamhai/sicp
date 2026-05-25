/**
 * apps/web/__tests__/S-05-cart-state.test.ts — Smoke tests for S-05 T03 cart state machine + hooks.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 * AC:       AC14 (Vitest cart smoke — 20+ assertions PASS in <100ms)
 *
 * Coverage:
 *   - cart-state-machine.ts reducer (all 18 action types — exhaustive smoke)
 *   - cart-state-machine.ts pure helpers (resolveDisplayQty, hasOptimisticQty,
 *     computeFreeShipProgress)
 *   - use-debounced-qty.ts (300ms fake timer + cancelPending + last-wins per product)
 *   - lib/utils.ts formatVNDCompact parity with mockup (state-0/F/G values verbatim)
 *
 * Vitest config: see apps/web/vitest.config.ts. Fake timers via `vi.useFakeTimers()`.
 *
 * Runs via: `pnpm vitest run S-05-cart-state` (<100ms target).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  cartReducer,
  initialCartState,
  resolveDisplayQty,
  hasOptimisticQty,
  computeFreeShipProgress,
  type CartState,
  type StockReplacementData,
} from '@/src/features/cart/cart-state-machine';
import { useDebouncedQty } from '@/src/features/cart/use-debounced-qty';
import { formatVNDCompact } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────
// Cart reducer — 18 action types coverage
// ─────────────────────────────────────────────────────────────────────────

describe('cartReducer — state-C qty stepper flow', () => {
  it('qty_tap sets optimistic overlay + opens pending sync toast', () => {
    const next = cartReducer(initialCartState, {
      type: 'qty_tap',
      productId: 'p-maggi-700',
      newQty: 3,
      oldQty: 2,
      itemBrief: 'Maggi 700ml',
    });
    expect(next.optimisticItems['p-maggi-700']).toBe(3);
    expect(next.pendingSyncToast).not.toBeNull();
    expect(next.pendingSyncToast?.oldQty).toBe(2);
    expect(next.pendingSyncToast?.newQty).toBe(3);
    expect(next.pendingSyncToast?.itemBrief).toBe('Maggi 700ml');
  });

  it('qty_patch_settled clears optimistic + toast for matching product', () => {
    const seeded: CartState = {
      ...initialCartState,
      optimisticItems: { 'p-maggi-700': 3, 'p-chinsu-250': 1 },
      pendingSyncToast: { productId: 'p-maggi-700', oldQty: 2, newQty: 3, itemBrief: 'Maggi' },
    };
    const next = cartReducer(seeded, { type: 'qty_patch_settled', productId: 'p-maggi-700' });
    expect(next.optimisticItems['p-maggi-700']).toBeUndefined();
    expect(next.optimisticItems['p-chinsu-250']).toBe(1); // other product preserved
    expect(next.pendingSyncToast).toBeNull();
  });

  it('qty_cancel_pending reverts ALL optimistic + closes toast (user "Huỷ" tap)', () => {
    const seeded: CartState = {
      ...initialCartState,
      optimisticItems: { p1: 3, p2: 5 },
      pendingSyncToast: { productId: 'p1', oldQty: 2, newQty: 3, itemBrief: 'X' },
    };
    const next = cartReducer(seeded, { type: 'qty_cancel_pending' });
    expect(next.optimisticItems).toEqual({});
    expect(next.pendingSyncToast).toBeNull();
  });
});

describe('cartReducer — state-D remove flow', () => {
  it('remove_tap opens undo toast with item details', () => {
    const next = cartReducer(initialCartState, {
      type: 'remove_tap',
      productId: 'p-maggi-700',
      itemTitle: 'Nước tương Maggi 700ml',
      itemPrice: 25500,
    });
    expect(next.undoToast).not.toBeNull();
    expect(next.undoToast?.productId).toBe('p-maggi-700');
    expect(next.undoToast?.itemPrice).toBe(25500);
  });

  it('undo_tap closes toast (user cancelled removal)', () => {
    const seeded: CartState = {
      ...initialCartState,
      undoToast: { productId: 'p-1', itemTitle: 'X', itemPrice: 1000 },
    };
    const next = cartReducer(seeded, { type: 'undo_tap' });
    expect(next.undoToast).toBeNull();
  });

  it('undo_commit_timeout closes toast (3s elapsed → DELETE fires page-side)', () => {
    const seeded: CartState = {
      ...initialCartState,
      undoToast: { productId: 'p-1', itemTitle: 'X', itemPrice: 1000 },
    };
    const next = cartReducer(seeded, { type: 'undo_commit_timeout' });
    expect(next.undoToast).toBeNull();
  });
});

describe('cartReducer — state-E stock issue flow', () => {
  it('stock_check_opened sets activeIntent + activeRid + clears prior replacements', () => {
    const next = cartReducer(initialCartState, {
      type: 'stock_check_opened',
      requestId: 'rid-abc',
    });
    expect(next.activeRid).toBe('rid-abc');
    expect(next.activeIntent).toBe('cart_view_with_stock_check');
    expect(next.stockIssueActive).toBe(false); // becomes true after summary
    expect(next.stockReplacements).toEqual({});
  });

  it('stock_issue_ready_sse stores per-product replacement (progressive arrival)', () => {
    const replacement: StockReplacementData = {
      productId: 'p-chinsu-500',
      title: 'Chin-su 500g',
      brand: 'Chin-su',
      unitPrice: 29000,
      availableStock: 47,
    };
    const next = cartReducer(initialCartState, {
      type: 'stock_issue_ready_sse',
      productId: 'p-chinsu-250',
      replacement,
    });
    expect(next.stockReplacements['p-chinsu-250']).toEqual(replacement);
  });

  it('stock_issue_ready_sse with null replacement still records (LLM timeout case)', () => {
    const next = cartReducer(initialCartState, {
      type: 'stock_issue_ready_sse',
      productId: 'p-out',
      replacement: null,
    });
    expect(next.stockReplacements['p-out']).toBeNull();
  });

  it('stock_issue_summary_sse activates resolve UI', () => {
    const next = cartReducer(initialCartState, {
      type: 'stock_issue_summary_sse',
      productIds: ['p-1', 'p-2'],
    });
    expect(next.stockIssueActive).toBe(true);
  });

  it('stock_resolved clears flow state', () => {
    const seeded: CartState = {
      ...initialCartState,
      stockIssueActive: true,
      stockReplacements: { p1: null },
      activeRid: 'rid-1',
      activeIntent: 'cart_view_with_stock_check',
    };
    const next = cartReducer(seeded, { type: 'stock_resolved' });
    expect(next.stockIssueActive).toBe(false);
    expect(next.stockReplacements).toEqual({});
    expect(next.activeRid).toBeNull();
    expect(next.activeIntent).toBeNull();
  });
});

describe('cartReducer — state-F clear-confirm flow', () => {
  it('clear_tap registers activeRid + sets activeIntent (modal opens later via SSE)', () => {
    const next = cartReducer(initialCartState, { type: 'clear_tap', requestId: 'rid-clear' });
    expect(next.activeRid).toBe('rid-clear');
    expect(next.activeIntent).toBe('cart_clear_confirm');
    expect(next.clearModalOpen).toBe(false); // not yet — waits for clear_confirm SSE
  });

  it('clear_confirm_sse opens modal + stores BE-driven payload', () => {
    const seeded: CartState = {
      ...initialCartState,
      activeRid: 'rid-clear',
      activeIntent: 'cart_clear_confirm',
    };
    const next = cartReducer(seeded, {
      type: 'clear_confirm_sse',
      payload: {
        itemCount: 4,
        subtotal: 140500,
        userMessage: 'Em sẽ xoá 4 món trị giá 140.500₫ khỏi giỏ.',
        advice: 'Vuốt sang trái từng item thay vì xoá hết.',
      },
    });
    expect(next.clearModalOpen).toBe(true);
    expect(next.clearConfirmData?.itemCount).toBe(4);
    expect(next.clearConfirmData?.userMessage).toContain('140.500');
  });

  it('clear_modal_cancel closes modal + bumps attemptN for retry idempotency', () => {
    const seeded: CartState = {
      ...initialCartState,
      clearModalOpen: true,
      clearConfirmData: {
        itemCount: 4,
        subtotal: 140500,
        userMessage: 'm',
        advice: 'a',
      },
      activeRid: 'rid-1',
      activeIntent: 'cart_clear_confirm',
      attemptN: 1,
    };
    const next = cartReducer(seeded, { type: 'clear_modal_cancel' });
    expect(next.clearModalOpen).toBe(false);
    expect(next.activeRid).toBeNull();
    expect(next.attemptN).toBe(2);
  });

  it('clear_settled closes flow (called by cart_cleared OR clear_cancelled SSE)', () => {
    const seeded: CartState = {
      ...initialCartState,
      clearModalOpen: true,
      activeRid: 'rid-1',
      activeIntent: 'cart_clear_confirm',
    };
    const next = cartReducer(seeded, { type: 'clear_settled' });
    expect(next.clearModalOpen).toBe(false);
    expect(next.activeRid).toBeNull();
    expect(next.activeIntent).toBeNull();
  });
});

describe('cartReducer — state-G promo flow', () => {
  it('promo_applied stores transient banner data', () => {
    const next = cartReducer(initialCartState, {
      type: 'promo_applied',
      code: 'SALE15',
      discountAmount: 21750,
      label: 'Giảm 15% toàn giỏ',
    });
    expect(next.promoJustApplied?.code).toBe('SALE15');
    expect(next.promoJustApplied?.discountAmount).toBe(21750);
  });

  it('promo_dismiss clears banner', () => {
    const seeded: CartState = {
      ...initialCartState,
      promoJustApplied: { code: 'SALE15', discountAmount: 100, label: 'x' },
    };
    const next = cartReducer(seeded, { type: 'promo_dismiss' });
    expect(next.promoJustApplied).toBeNull();
  });
});

describe('cartReducer — lifecycle', () => {
  it('reset restores initial state from any state', () => {
    const seeded: CartState = {
      ...initialCartState,
      optimisticItems: { p1: 5 },
      clearModalOpen: true,
      activeRid: 'rid-99',
      attemptN: 7,
    };
    const next = cartReducer(seeded, { type: 'reset' });
    expect(next).toEqual(initialCartState);
  });

  it('sse_terminal clears activeRid + activeIntent', () => {
    const seeded: CartState = {
      ...initialCartState,
      activeRid: 'rid-1',
      activeIntent: 'cart_view_with_stock_check',
    };
    const next = cartReducer(seeded, { type: 'sse_terminal' });
    expect(next.activeRid).toBeNull();
    expect(next.activeIntent).toBeNull();
  });

  it('sse_error sets error message', () => {
    const next = cartReducer(initialCartState, {
      type: 'sse_error',
      message: 'Network drop',
    });
    expect(next.sseError).toBe('Network drop');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────

describe('resolveDisplayQty', () => {
  it('returns optimistic qty when present', () => {
    expect(resolveDisplayQty('p1', 2, { p1: 5 })).toBe(5);
  });

  it('falls back to server qty when no optimistic overlay', () => {
    expect(resolveDisplayQty('p1', 2, {})).toBe(2);
    expect(resolveDisplayQty('p1', 2, { p2: 5 })).toBe(2);
  });

  it('treats optimistic qty=0 as truthy override', () => {
    expect(resolveDisplayQty('p1', 2, { p1: 0 })).toBe(0);
  });
});

describe('hasOptimisticQty', () => {
  it('returns true when product has optimistic overlay', () => {
    expect(hasOptimisticQty('p1', { p1: 5 })).toBe(true);
  });

  it('returns false when no overlay', () => {
    expect(hasOptimisticQty('p1', {})).toBe(false);
    expect(hasOptimisticQty('p1', { p2: 3 })).toBe(false);
  });
});

describe('computeFreeShipProgress', () => {
  it('returns isFree=true when subtotal ≥ threshold (mockup state-0 line 278)', () => {
    const r = computeFreeShipProgress(145000, 100000);
    expect(r.isFree).toBe(true);
    expect(r.progress).toBe(1);
    expect(r.remaining).toBe(0);
  });

  it('returns proportional progress below threshold', () => {
    const r = computeFreeShipProgress(65000, 100000);
    expect(r.isFree).toBe(false);
    expect(r.remaining).toBe(35000);
    expect(r.progress).toBeCloseTo(0.65, 5);
  });

  it('defensively handles zero/negative subtotal', () => {
    const r1 = computeFreeShipProgress(0);
    expect(r1.progress).toBe(0);
    expect(r1.remaining).toBe(100000);
    const r2 = computeFreeShipProgress(-1000);
    expect(r2.progress).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// formatVNDCompact mockup parity (C-S05-J Path A)
// ─────────────────────────────────────────────────────────────────────────

describe('formatVNDCompact — mockup parity verbatim', () => {
  it('matches mockup state-0 line 158 "25.500₫"', () => {
    expect(formatVNDCompact(25500)).toBe('25.500₫');
  });

  it('matches mockup state-0 line 307 total "140.500₫"', () => {
    expect(formatVNDCompact(140500)).toBe('140.500₫');
  });

  it('matches mockup state-F line 238 "140.500₫"', () => {
    expect(formatVNDCompact(140500)).toBe('140.500₫');
  });

  it('matches mockup state-G "200.000₫" promo threshold', () => {
    expect(formatVNDCompact(200000)).toBe('200.000₫');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// useDebouncedQty — 300ms debounce + last-wins + cancelPending
// ─────────────────────────────────────────────────────────────────────────

describe('useDebouncedQty', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onFire after 300ms idle window with single patch', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useDebouncedQty({ debounceMs: 300, onFire }));

    act(() => {
      result.current.queueQtyPatch('p1', 3);
    });
    expect(onFire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onFire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith([{ productId: 'p1', newQty: 3 }]);
  });

  it('coalesces rapid taps on same product (last-wins)', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useDebouncedQty({ debounceMs: 300, onFire }));

    act(() => {
      result.current.queueQtyPatch('p1', 3);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.queueQtyPatch('p1', 5);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.queueQtyPatch('p1', 7); // final value
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith([{ productId: 'p1', newQty: 7 }]);
  });

  it('cancelPending clears queue + timer (user "Huỷ" tap)', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useDebouncedQty({ debounceMs: 300, onFire }));

    act(() => {
      result.current.queueQtyPatch('p1', 3);
    });
    act(() => {
      result.current.cancelPending();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onFire).not.toHaveBeenCalled();
  });

  it('accumulates patches for DIFFERENT products in single fire batch', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useDebouncedQty({ debounceMs: 300, onFire }));

    act(() => {
      result.current.queueQtyPatch('p1', 3);
      result.current.queueQtyPatch('p2', 5);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onFire).toHaveBeenCalledOnce();
    const patches = onFire.mock.calls[0][0] as Array<{ productId: string; newQty: number }>;
    expect(patches).toHaveLength(2);
    expect(patches).toContainEqual({ productId: 'p1', newQty: 3 });
    expect(patches).toContainEqual({ productId: 'p2', newQty: 5 });
  });
});
