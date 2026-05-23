/**
 * apps/web/components/icp/organisms/OrderSummary.tsx
 *
 * Organism: <OrderSummary> — order line items + totals + delivery for I06 checkout
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-8
 *
 * Source:   intent-06-state-0-confirm.html (confirm mode — pre-payment summary)
 *           intent-06-state-H-receipt.html (receipt mode — post-payment with timestamp)
 *           SEMANTIC_COMPONENTS Section 5.4 Family B reuse pattern
 *
 * Reach:    I06 only (S-06 V-SLICE Payment)
 *
 * Decisions applied:
 * - C-03 Family B structural inference (no CSS classes — Tailwind utility translation)
 * - C-07 navigation-agnostic — pure data render
 * - C-08 + D-05 VN inline — VN labels "Tạm tính", "Phí giao hàng", "Tổng cộng", "Mã đơn",
 *   "Thanh toán lúc" hardcoded
 * - C-13 N/A — no CVA variants
 * - C-15 SERVER — pure render, no event handlers
 * - C-18 Tier 4 Tailwind utility inline
 * - C-22 atom interface verified — uses T01 formatVND helper
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC
 * (1/3 qualifier: 2 modes <3; slots <5; I06 single V-SLICE)
 *
 * Public API:
 *   <OrderSummary
 *     items={[{name: 'Sữa tươi 1L', qty: 2, price: 32000}, ...]}
 *     subtotal={64000}
 *     delivery={15000}
 *     total={79000}
 *     mode="confirm"
 *   />
 *   <OrderSummary
 *     items={[...]}
 *     subtotal={64000}
 *     delivery={15000}
 *     total={79000}
 *     mode="receipt"
 *     receiptMeta={{ orderId: 'ICP-20260519-0042', timestamp: '19/05/2026 14:32' }}
 *   />
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';

export interface OrderSummaryItem {
  name: string;
  qty: number;
  price: number;
  /** Optional brand/category line above name */
  brand?: string;
}

export interface OrderSummaryReceiptMeta {
  orderId: string;
  /** Pre-formatted timestamp string (component does not format dates per C-08) */
  timestamp: string;
}

export interface OrderSummaryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: OrderSummaryItem[];
  subtotal: number;
  delivery: number;
  total: number;
  /** 'confirm' = pre-payment summary (default); 'receipt' = post-payment with order meta */
  mode?: 'confirm' | 'receipt';
  /** Required when mode='receipt' — order ID + payment timestamp */
  receiptMeta?: OrderSummaryReceiptMeta;
  /** Optional discount line (rendered between delivery and total) */
  discount?: number;
}

// PRIVATE: line row helper
function OrderLine({ label, value, emphasis }: { label: string; value: string; emphasis?: 'total' | 'discount' }) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span
        className={cn(
          'text-[12px] text-icp-pink-700 font-medium',
          emphasis === 'total' && 'text-[14px] text-icp-pink-900 font-bold',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] text-icp-pink-900 font-semibold font-mono tracking-[-0.2px]',
          emphasis === 'total' && 'text-[16px] text-icp-rose-700 font-bold',
          emphasis === 'discount' && 'text-icp-green-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// PRIVATE: item row
function ItemRow({ item }: { item: OrderSummaryItem }) {
  const lineTotal = item.price * item.qty;
  return (
    <div className="flex justify-between items-start py-2 border-b border-icp-pink-100 last:border-b-0">
      <div className="flex-1 min-w-0 pr-2">
        {item.brand && (
          <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px] mb-[2px]">
            {item.brand}
          </div>
        )}
        <div className="text-[12.5px] text-icp-pink-900 font-semibold leading-tight">
          {item.name}
        </div>
        <div className="text-[10px] text-icp-text-muted font-mono mt-0.5">
          {formatVND(item.price)} × {item.qty}
        </div>
      </div>
      <div className="text-[13px] text-icp-rose-700 font-bold font-mono tracking-[-0.2px] flex-shrink-0">
        {formatVND(lineTotal)}
      </div>
    </div>
  );
}

export const OrderSummary = React.forwardRef<HTMLDivElement, OrderSummaryProps>(
  ({ items, subtotal, delivery, total, mode = 'confirm', receiptMeta, discount, className, ...props }, ref) => {
    const isReceipt = mode === 'receipt';

    return (
      <div
        ref={ref}
        className={cn(
          'w-full bg-white border-[0.5px] border-icp-pink-200 rounded-2xl p-4',
          'shadow-[0_4px_14px_rgba(233,30,99,0.08)]',
          className,
        )}
        data-mode={mode}
        {...props}
      >
        {/* Receipt mode — header with orderId + timestamp */}
        {isReceipt && receiptMeta && (
          <div className="pb-3 mb-3 border-b border-icp-pink-100">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] text-icp-pink-700 font-semibold uppercase tracking-wider">
                Mã đơn
              </span>
              <span className="text-[11px] text-icp-pink-900 font-mono font-bold">
                {receiptMeta.orderId}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-icp-pink-700 font-semibold uppercase tracking-wider">
                Thanh toán lúc
              </span>
              <span className="text-[11px] text-icp-pink-900 font-mono">
                {receiptMeta.timestamp}
              </span>
            </div>
          </div>
        )}

        {/* Confirm mode — section header */}
        {!isReceipt && (
          <div className="text-[11px] text-icp-pink-700 font-bold uppercase tracking-wider mb-2">
            Đơn hàng của em
          </div>
        )}

        {/* Item list */}
        <div className="mb-3">
          {items.map((item, i) => (
            <ItemRow key={`${item.name}-${i}`} item={item} />
          ))}
        </div>

        {/* Totals section */}
        <div className="pt-2 border-t border-icp-pink-100">
          <OrderLine label="Tạm tính" value={formatVND(subtotal)} />
          <OrderLine label="Phí giao hàng" value={formatVND(delivery)} />
          {discount !== undefined && discount > 0 && (
            <OrderLine label="Giảm giá" value={`−${formatVND(discount)}`} emphasis="discount" />
          )}
          <div className="mt-1 pt-2 border-t border-icp-pink-100">
            <OrderLine label="Tổng cộng" value={formatVND(total)} emphasis="total" />
          </div>
        </div>
      </div>
    );
  },
);
OrderSummary.displayName = 'OrderSummary';
