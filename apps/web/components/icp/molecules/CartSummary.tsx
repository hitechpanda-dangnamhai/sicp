'use client';

/**
 * apps/web/components/icp/molecules/CartSummary.tsx
 *
 * Molecule: <CartSummary> — sticky footer summary for /intent-05 cart page
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-0-happy.html line 271-322
 *           (full footer: free-ship hint + summary lines + total + checkout CTA + trust signal)
 *           docs/mockups/intent-05/intent-05-state-G-promo-applied.html (promo pill variant)
 *
 * Reach:    I05 cart only (single-intent). NOT reused S-06 payment (different footer shape).
 *
 * Decisions applied:
 * - D-S05-08 LAW: promo pill displayed when promoCode passed (state-G variant).
 *   onRemovePromo fires DELETE /cart/promo per state-G "Bỏ" button.
 * - C-S05-J Path A: formatVNDCompact used for ALL currency renders (mockup parity
 *   per Rule 6 LAW 237 instances no-space).
 * - C-07 navigation-agnostic: onCheckout callback (parent navigates to /intent-06).
 * - C-15 'use client': interactive checkout button + promo pill remove button.
 * - C-23 atom bypass: inline checkout button gradient (mockup line 312 unique
 *   3-stop gradient pink→rose→orange) + free-ship pill inline (mockup line 275-280).
 *
 * Inline free-ship progress per A1 (handoff §B3): when subtotal < freeShipThreshold,
 * show "Mua thêm Xđ để miễn phí vận chuyển" with thin progress bar 0-100%.
 * When subtotal ≥ threshold, show "Anh đã được miễn phí vận chuyển" green pill.
 */

import * as React from 'react';
import { cn, formatVNDCompact } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface CartSummaryProps {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number; // 0 = free
  total: number;
  /** When set, render promo pill with "Bỏ" button per state-G mockup line 270-275. */
  promoCode?: string | null;
  /** Promo discount label (e.g. "SALE15 giảm 15% toàn giỏ") — shown in pill. */
  promoLabel?: string | null;
  onRemovePromo?: () => void;
  /** Default 100000 — mockup state-0 line 278 "đơn từ 100.000₫". */
  freeShipThreshold?: number;
  /** Disabled when stock issues unresolved (state-E) or empty cart (state-B never renders this). */
  checkoutEnabled: boolean;
  /** "Thanh toán" (default) | "Cần xử lý món hết hàng" (state-E disabled). */
  checkoutLabel: string;
  onCheckout?: () => void;
  className?: string;
}

export const CartSummary = React.forwardRef<HTMLDivElement, CartSummaryProps>(
  (
    {
      itemCount,
      subtotal,
      discount,
      shipping,
      total,
      promoCode,
      promoLabel,
      onRemovePromo,
      freeShipThreshold = 100_000,
      checkoutEnabled,
      checkoutLabel,
      onCheckout,
      className,
    },
    ref
  ) => {
    const isFreeShip = subtotal >= freeShipThreshold;
    const remainingForFreeShip = isFreeShip ? 0 : freeShipThreshold - subtotal;
    const progress = isFreeShip ? 1 : subtotal <= 0 ? 0 : subtotal / freeShipThreshold;

    return (
      <div
        ref={ref}
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-white border-t border-icp-pink-100 px-[18px] pt-[14px] pb-5',
          'shadow-[0_-8px_24px_rgba(233,30,99,0.08)] rounded-t-[18px]',
          className
        )}
      >
        {/* Promo pill (state-G variant when promoCode set) */}
        {promoCode ? (
          <div className="bg-gradient-to-br from-icp-pink-50 to-white border-[0.5px] border-icp-pink-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
            <Icon name="tag" size={14} className="text-icp-pink-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-icp-pink-700 uppercase tracking-[0.3px]">
                {promoCode}
              </div>
              {promoLabel ? (
                <div className="text-[10px] text-icp-pink-900 truncate">{promoLabel}</div>
              ) : null}
            </div>
            {onRemovePromo ? (
              <button
                type="button"
                onClick={onRemovePromo}
                className="text-[10px] font-bold text-icp-rose-600 px-2 py-1 rounded-md hover:bg-icp-rose-50"
              >
                Bỏ
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Free-ship hint */}
        {isFreeShip ? (
          <div className="bg-gradient-to-br from-icp-green-50 to-icp-green-100 border-[0.5px] border-icp-green-200 rounded-[11px] px-2.5 py-[7px] mb-3 flex items-center gap-2">
            <Icon name="truck" size={15} className="text-icp-green-600 flex-shrink-0" />
            <div className="flex-1 text-[11px] text-icp-green-800 font-medium">
              Anh đã được <b>miễn phí vận chuyển</b> (đơn từ {formatVNDCompact(freeShipThreshold)})
            </div>
          </div>
        ) : (
          <div className="bg-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-[11px] px-2.5 py-[7px] mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="truck" size={15} className="text-icp-pink-700 flex-shrink-0" />
              <div className="flex-1 text-[11px] text-icp-pink-900 font-medium">
                Mua thêm <b>{formatVNDCompact(remainingForFreeShip)}</b> để miễn phí vận chuyển
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-[3px] bg-icp-pink-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-icp-pink-500 to-icp-rose-500 rounded-full transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary lines */}
        <div className="mb-3 space-y-[5px]">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-icp-pink-700">
              Tạm tính ({itemCount} món)
            </span>
            <span className="text-[13px] text-icp-pink-900 font-semibold font-mono">
              {formatVNDCompact(subtotal)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-icp-pink-700">Giảm giá</span>
              <span className="text-[13px] text-icp-green-600 font-semibold font-mono">
                −{formatVNDCompact(discount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-icp-pink-700">Vận chuyển</span>
            <span
              className={cn(
                'text-[13px] font-semibold font-mono',
                shipping === 0 ? 'text-icp-green-600' : 'text-icp-pink-900'
              )}
            >
              {shipping === 0 ? 'Miễn phí' : formatVNDCompact(shipping)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[0.5px] bg-icp-pink-100 -mx-0.5 mb-3" />

        {/* Total */}
        <div className="flex justify-between items-end mb-3.5">
          <div>
            <div className="text-[11px] text-icp-pink-700 font-medium mb-0.5">
              Tổng thanh toán
            </div>
            <div className="text-[9px] text-icp-pink-700 opacity-70">Đã bao gồm VAT</div>
          </div>
          <div className="text-right">
            <div
              className="text-[22px] font-bold font-mono leading-none tracking-[-0.5px] bg-gradient-to-br from-icp-pink-600 to-icp-amber-500 bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {formatVNDCompact(total)}
            </div>
          </div>
        </div>

        {/* Checkout CTA */}
        <button
          type="button"
          onClick={checkoutEnabled ? onCheckout : undefined}
          disabled={!checkoutEnabled}
          className={cn(
            'w-full text-white py-3.5 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 tracking-[0.2px]',
            'bg-gradient-to-r from-icp-pink-600 via-icp-rose-500 to-icp-amber-500',
            'shadow-[0_12px_28px_rgba(233,30,99,0.42)]',
            !checkoutEnabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {checkoutLabel}
          {checkoutEnabled ? <Icon name="arrow-right" size={18} /> : null}
        </button>

        {/* Trust signal */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          <Icon name="shield-check" size={12} className="text-icp-green-600" />
          <span className="text-[10px] text-icp-pink-700 font-medium">
            Thanh toán bảo mật • Hoàn tiền nếu lỗi
          </span>
        </div>
      </div>
    );
  }
);
CartSummary.displayName = 'CartSummary';
