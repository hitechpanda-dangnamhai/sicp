'use client';

/**
 * apps/web/components/icp/molecules/CartCountPill.tsx
 *
 * Molecule: <CartCountPill> — persistent floating cart pill with item count
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW molecule (B9)
 *
 * Source:   docs/mockups/intent-02/intent-02-state-E-cart-added.html .cart-pill-float
 *           (gradient pink→orange, white count badge, `bump` animation 0.6s)
 *
 * Reach:    I02 persistent cart indicator. Reads `useCart().data` for total qty.
 *
 * Decisions applied (handoff §3.B9):
 * - Cart type has NO `count` field → count = sum of item qty:
 *   `data?.items.reduce((s,i)=>s+i.qty,0) ?? 0` (tổng qty giỏ).
 * - `deltaLabel` (e.g. "+3") is a TRANSIENT page-controlled overlay for state-E
 *   (số MÓN vừa add). CartCountPill itself shows persistent total qty; page
 *   passes `deltaLabel` + `bump` only during the state-E success window.
 * - C-15 'use client': consumes useCart() hook + onClick.
 * - Null-safe: renders 0 when cart undefined/empty (no crash).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import { useCart } from '@/src/features/cart/use-cart';

export interface CartCountPillProps {
  /** Transient delta overlay for state-E (e.g. "+3" món vừa thêm). Page-controlled. */
  deltaLabel?: string;
  /** Trigger the 0.6s bump animation (state-E add confirmation). */
  bump?: boolean;
  /** Navigate to cart / checkout. */
  onClick?: () => void;
  className?: string;
}

export const CartCountPill = React.forwardRef<HTMLButtonElement, CartCountPillProps>(
  ({ deltaLabel, bump, onClick, className }, ref) => {
    const { data: cart } = useCart();
    const totalQty = cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={`Giỏ hàng, ${totalQty} sản phẩm`}
        className={cn(
          'inline-flex items-center gap-2 px-3.5 py-2 rounded-full',
          'bg-gradient-to-r from-icp-pink-500 to-icp-amber-400 text-white',
          'shadow-[0_6px_16px_rgba(233,30,99,0.32)] font-semibold text-[13px]',
          'active:scale-[0.97] transition-transform',
          bump ? 'animate-[bump_0.6s_ease-out]' : null,
          className,
        )}
      >
        <Icon name="shopping-cart" size={16} className="text-white" />
        <span>Giỏ</span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-white text-icp-rose-700 text-[11px] font-bold font-mono">
          {totalQty}
        </span>
        {deltaLabel ? (
          <span className="inline-flex items-center justify-center px-1.5 h-5 rounded-full bg-white/25 text-white text-[11px] font-bold font-mono">
            {deltaLabel}
          </span>
        ) : null}
      </button>
    );
  },
);
CartCountPill.displayName = 'CartCountPill';
