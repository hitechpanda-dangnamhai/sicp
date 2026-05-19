'use client';

/**
 * apps/web/components/icp/molecules/CartItemRow.tsx
 *
 * Molecule: <CartItemRow> — Family B I05 cart line item
 *
 * Slice:    S-01 UI Foundation
 * Task:     T05 AC-2, AC-7 (dev preview)
 *
 * Source:   Family B mockup HTML (per C-03 structural inference + Tailwind translation):
 *           - intent-05/intent-05-state-0-happy.html line 144-200 (base row pattern)
 *           - intent-05/intent-05-state-E-stock-issue.html line 185-212 (stockIssue='out' banner)
 *
 * Reach:    I05 cart line item (single-intent, NOT C-24 multi-intent qualifier).
 *
 * Decisions applied:
 * - C-03 structural inference + C-23 atom bypass for micro-elements (26×26 qty
 *   stepper buttons, 5px badge corner, mini "Bỏ" button in stock banner) —
 *   see decisions-log Section 3
 * - C-07 navigation-agnostic — onQtyChange/onRemove/onResolveStockIssue callbacks
 * - C-08 + D-05 VN inline — stockIssue copy "Đã hết hàng — em đề xuất bỏ khỏi giỏ"
 *   + "Bỏ" CTA owned by component
 * - C-13 Omit 'children' from HTMLAttributes (consumer doesn't pass children)
 * - C-15 'use client' for onQtyChange/onRemove/onResolveStockIssue event handlers
 * - C-18 Tier 4 Tailwind utility inline (no @layer components classes added)
 * - C-22 atom interface verified DISCOVER — bypasses Button/ChipPill atoms;
 *   only <Icon> from atoms barrel consumed (minus/plus/alert-triangle)
 *
 * Concern 3 A1 lock: ship stockIssue='out' only (mockup state-E direct).
 * NO 'low' inferred variant (Phiên 15 anti-pattern lockdown — no skeleton stub
 * for missing mockup).
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

// Public types
export interface CartItemProduct {
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageGradient?: string;
  imageIcon?: IconName;
}

export interface CartItemCornerBadge {
  /** `discount` amber-grad ("-15%"), `new` green-grad ("MỚI") per mockup state-E line 217 */
  type: 'discount' | 'new';
  label: string;
}

export interface CartItemRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  product: CartItemProduct;
  /** Quantity value (controlled by parent state) */
  qty: number;
  /** Fires on +/− stepper click with new qty. Component does NOT internally clamp. */
  onQtyChange?: (newQty: number) => void;
  /** Fires when remove action triggered (e.g., header X button if shown). Not wired by default. */
  onRemove?: () => void;
  /** Stock issue state — only 'out' shipped in T05 per Concern 3 A1 (mockup state-E direct) */
  stockIssue?: 'out';
  /** Fires when "Bỏ" CTA clicked inside stock-issue banner */
  onResolveStockIssue?: () => void;
  /** Optional top-right badge on product image (state-E shows discount/-15% or MỚI badges) */
  cornerBadge?: CartItemCornerBadge;
}

// PRIVATE: stock-issue banner (raw inline per C-23 atom bypass)
function StockIssueBanner(props: { onResolve?: () => void }): React.ReactElement {
  return (
    <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 bg-icp-rose-50 border-[0.5px] border-icp-rose-200 rounded-lg">
      <Icon name="alert-triangle" size={13} className="text-icp-rose-600 flex-shrink-0" />
      <span className="text-[10px] text-icp-rose-900 font-semibold flex-1">
        Đã hết hàng — em đề xuất bỏ khỏi giỏ
      </span>
      <button
        type="button"
        onClick={props.onResolve}
        className="bg-white border-[0.5px] border-icp-rose-200 text-icp-rose-600 px-2 py-[3px] rounded-[7px] text-[10px] font-bold"
      >
        Bỏ
      </button>
    </div>
  );
}

// PRIVATE: corner badge on product thumbnail
function CornerBadge(props: { badge: CartItemCornerBadge }): React.ReactElement {
  const bg =
    props.badge.type === 'discount'
      ? 'bg-gradient-to-br from-icp-amber-500 to-icp-amber-600'
      : 'bg-gradient-to-br from-icp-green-500 to-icp-green-600';
  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 inline-flex items-center text-[9px] font-bold px-1.5 py-[2px] rounded-[6px] text-white',
        bg
      )}
    >
      {props.badge.label}
    </span>
  );
}

// MAIN: <CartItemRow>
export const CartItemRow = React.forwardRef<HTMLDivElement, CartItemRowProps>(
  ({ product, qty, onQtyChange, stockIssue, onResolveStockIssue, cornerBadge, className, ...props }, ref) => {
    const imageGradient = product.imageGradient ?? 'linear-gradient(135deg, #FEF3C7, #FCD34D)';
    const imageIcon: IconName = product.imageIcon ?? 'package';
    const lineTotal = product.price * qty;
    const isOutOfStock = stockIssue === 'out';

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white border-[0.5px] border-icp-pink-200 rounded-2xl p-3 mb-2.5',
          'shadow-[0_4px_12px_rgba(233,30,99,0.06)]',
          className
        )}
        data-stock-issue={stockIssue}
        {...props}
      >
        <div className="flex gap-3">
          {/* Product thumbnail (64×64) */}
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 relative"
            style={{ background: imageGradient }}
          >
            <Icon name={imageIcon} size={30} className="text-icp-amber-800/70" />
            {cornerBadge ? <CornerBadge badge={cornerBadge} /> : null}
          </div>

          {/* Body — brand + name + price + qty stepper row */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px] mb-[2px]">
              {product.brand}
            </div>
            <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] mb-1.5 overflow-hidden line-clamp-2">
              {product.name}
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-[14px] text-icp-rose-700 font-bold font-mono tracking-[-0.3px]">
                {formatVND(product.price)}
              </span>
              {product.originalPrice !== undefined ? (
                <span className="text-[11px] text-icp-text-muted line-through font-mono">
                  {formatVND(product.originalPrice)}
                </span>
              ) : null}
            </div>

            {/* Qty stepper + line total */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Giảm"
                  onClick={() => onQtyChange?.(qty - 1)}
                  disabled={isOutOfStock}
                  className="w-[26px] h-[26px] bg-icp-pink-100 border-[0.5px] border-icp-pink-200 rounded-lg flex items-center justify-center text-icp-pink-700 disabled:opacity-50"
                >
                  <Icon name="minus" size={14} />
                </button>
                <div className="text-[14px] text-icp-pink-900 font-bold min-w-[24px] text-center font-mono">
                  {qty}
                </div>
                <button
                  type="button"
                  aria-label="Tăng"
                  onClick={() => onQtyChange?.(qty + 1)}
                  disabled={isOutOfStock}
                  className="w-[26px] h-[26px] bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 rounded-lg flex items-center justify-center text-white shadow-[0_3px_8px_rgba(233,30,99,0.32)] disabled:opacity-50"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <div className="text-[14px] text-icp-rose-700 font-bold font-mono">{formatVND(lineTotal)}</div>
            </div>

            {/* Stock issue banner (only when stockIssue='out') */}
            {isOutOfStock ? <StockIssueBanner onResolve={onResolveStockIssue} /> : null}
          </div>
        </div>
      </div>
    );
  }
);
CartItemRow.displayName = 'CartItemRow';
