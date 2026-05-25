'use client';

/**
 * apps/web/components/icp/molecules/SwipeableCartItem.tsx
 *
 * Molecule: <SwipeableCartItem> — wrapper adding state-D swipe-left gesture
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-D-remove.html line 186-223
 *           (relative wrapper + absolute red action bar 72px wide right side + slide-left
 *            CartItemRow with translateX(-72px) when swiped state)
 *
 * Reach:    I05 cart page state-D — wraps each <CartItemRow> in the cart list.
 *
 * Decisions applied:
 * - **Wrapper pattern, NOT extending CartItemRow** per C-S05-I Path A: separation
 *   of concerns — CartItemRow stays presentation-only; swipe gesture is page-level
 *   UX concern, wrapped externally. Backward-compat: 6 existing CartItemRow consumers
 *   continue working without swipe (other contexts don't need it).
 * - **Controlled component** per handoff §B11: `swiped` + `onSwipeToggle` props.
 *   Parent owns swipe state per product (e.g. only ONE item swiped at a time UX
 *   per mockup state-D — tapping different item closes prior swipe).
 * - **Touch handlers**: onTouchStart + onTouchMove + onTouchEnd track gesture.
 *   Threshold 50px → toggle `swiped` true. Tap on red bar → onDelete fires +
 *   reset swipe state.
 * - **C-15 'use client'**: touch event handlers + state.
 * - **No mouse handlers**: mockup is mobile-only per home flow; desktop touch
 *   events emulated by browser dev tools. Adding mouse drag would risk conflict
 *   with click events on qty stepper buttons inside CartItemRow. Defer to T04
 *   if desktop dev experience needed.
 *
 * Caller usage:
 *   <SwipeableCartItem
 *     swiped={swipedProductId === item.product_id}
 *     onSwipeToggle={(s) => setSwipedProductId(s ? item.product_id : null)}
 *     onDelete={() => dispatch({type: 'remove_tap', productId: item.product_id, ...})}
 *   >
 *     <CartItemRow ... />
 *   </SwipeableCartItem>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface SwipeableCartItemProps {
  children: React.ReactNode;
  /** Controlled swipe state — true = revealed delete bar. */
  swiped: boolean;
  /** Called when gesture crosses threshold (50px) OR user taps elsewhere to close. */
  onSwipeToggle: (swiped: boolean) => void;
  /** Fires when red action bar is tapped (only available while swiped). */
  onDelete: () => void;
  className?: string;
}

const SWIPE_REVEAL_PX = 72;
const SWIPE_THRESHOLD_PX = 50;

export function SwipeableCartItem({
  children,
  swiped,
  onSwipeToggle,
  onDelete,
  className,
}: SwipeableCartItemProps) {
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartTimeRef = React.useRef<number | null>(null);

  const handleTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartTimeRef.current = performance.now();
  }, []);

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current;
      const startedAt = touchStartTimeRef.current;
      touchStartXRef.current = null;
      touchStartTimeRef.current = null;
      if (startX === null || startedAt === null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const duration = performance.now() - startedAt;
      // Quick tap (< 150ms + small delta) → ignore as gesture; allow click bubbling.
      if (duration < 150 && Math.abs(deltaX) < 10) return;
      // Left swipe past threshold → reveal delete; right swipe past threshold → hide.
      if (!swiped && deltaX < -SWIPE_THRESHOLD_PX) {
        onSwipeToggle(true);
      } else if (swiped && deltaX > SWIPE_THRESHOLD_PX) {
        onSwipeToggle(false);
      }
    },
    [swiped, onSwipeToggle],
  );

  const handleDeleteTap = React.useCallback(() => {
    onDelete();
    // Reset swipe state — parent typically opens UndoRemoveToast after this.
    onSwipeToggle(false);
  }, [onDelete, onSwipeToggle]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Red action bar — absolutely positioned right side */}
      <div
        aria-hidden={!swiped}
        className={cn(
          'absolute top-0 bottom-0 right-0 flex items-center justify-center',
          'bg-gradient-to-br from-icp-rose-600 to-icp-rose-700',
          'rounded-r-2xl'
        )}
        style={{ width: SWIPE_REVEAL_PX }}
      >
        <button
          type="button"
          onClick={handleDeleteTap}
          disabled={!swiped}
          className="flex flex-col items-center justify-center gap-1 text-white px-2 py-1 disabled:opacity-0"
          aria-label="Xoá khỏi giỏ"
        >
          <Icon name="trash" size={18} />
          <span className="text-[10px] font-bold">Xoá</span>
        </button>
      </div>

      {/* Sliding content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: swiped ? `translateX(-${SWIPE_REVEAL_PX}px)` : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  );
}
SwipeableCartItem.displayName = 'SwipeableCartItem';
