'use client';

/**
 * apps/web/components/icp/molecules/CartItemRow.tsx
 *
 * Molecule: <CartItemRow> — Family B I05 cart line item
 *
 * Slice:    S-01 UI Foundation (baseline 7 props + StockIssueBanner inline)
 *           S-05 T03 EXTEND (Phiên Sx05-3) — +3 props per C-S05-I + C-S05-J
 *           S-08 T02 EXTEND (Phiên Sx08-G) — +1 prop matchScorePct (state-C "% khớp" badge)
 *
 * Task:     T05 AC-2, AC-7 (S-01 dev preview)
 *           S-05 T03 (Phiên Sx05-3) — qty Spinner overlay + optimistic line_total + currency formatter override
 *           S-08 T02 (Phiên Sx08-G) — voice-buy state-C match badge (B11)
 *
 * Source:   Family B mockup HTML (per C-03 structural inference + Tailwind translation):
 *           - intent-05/intent-05-state-0-happy.html line 144-200 (base row pattern)
 *           - intent-05/intent-05-state-E-stock-issue.html line 185-212 (stockIssue='out' banner)
 *           - intent-05/intent-05-state-C-update-qty.html line 178-201 (isUpdating spinner inline)
 *           - intent-05/intent-05-state-0-happy.html line 158/171/187/199/228/256 (no-space currency)
 *           - intent-02/intent-02-state-C-cart-ready.html line 584/623/661 (.match-badge "98% khớp")
 *
 * Reach:    I05 cart line item (single-intent, NOT C-24 multi-intent qualifier).
 *           Now reused by /intent-05/page.tsx (S-05 T03) + /intent-02 state-C (S-08 T02).
 *
 * Decisions applied (S-01 baseline preserved):
 * - C-03 structural inference + C-23 atom bypass for micro-elements (26×26 qty
 *   stepper buttons, 5px badge corner, mini "Bỏ" button in stock banner)
 * - C-07 navigation-agnostic — onQtyChange/onRemove/onResolveStockIssue callbacks
 * - C-08 + D-05 VN inline — stockIssue copy "Đã hết hàng — em đề xuất bỏ khỏi giỏ"
 *   + "Bỏ" CTA owned by component
 * - C-13 Omit 'children' from HTMLAttributes
 * - C-15 'use client' for event handlers
 * - C-18 Tier 4 Tailwind utility inline
 * - C-22 atom interface verified — bypasses Button/ChipPill; only <Icon> + <Spinner> from atoms
 *
 * Decisions applied (S-05 T03):
 * - C-S05-I (Conflict #2 Path A): EXTEND existing CartItemRow +3 props (NOT new <CartItem>)
 *   because S-01 ship has 6 consumers. Backward-compat preserved.
 * - C-S05-J (Conflict #3 Option A additive): `currencyFormatter` prop defaults to
 *   `formatVND`. Cart contexts pass `formatVNDCompact` for no-space mockup parity.
 * - D-S05-07 LAW: `lineTotalOverride` enables optimistic line_total during qty debounce.
 *
 * Decisions applied (S-08 T02 NEW — backward-compat tuyệt đối):
 * - +`matchScorePct?` (handoff §3.B11): when present → green pill "{pct}% khớp"
 *   `rgba(34,197,94,0.12)` rendered IN THE META-ROW (after `name`, before `price`)
 *   per mockup state-C. NOT `cornerBadge` (cornerBadge is image-corner discount/new
 *   badge — different position + style).
 * - ⚠️ KNOWN-ISSUE (handoff §3.B11 + §4): BE `voice_matched_products[].match_score`
 *   is RAW scale 0..~30 (NOT a pct; BE does NOT wrap pct for state-C, unlike state-F
 *   C-S08-Y). Therefore /intent-02 page does NOT pass `matchScorePct` → badge hidden.
 *   Prop fully implemented + optional so it activates the moment BE adds a wrapped
 *   match_pct field. KHÔNG ×100, KHÔNG bịa số.
 * - All 10 S-05/S-01 props + 6 consumers UNCHANGED.
 *
 * Concern 3 A1 lock (S-01): ship stockIssue='out' only. NO 'low' inferred variant.
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon, Spinner } from '@/components/icp/atoms';
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

  // ─── S-05 T03 (Phiên Sx05-3 per C-S05-I + C-S05-J) ───────────────────────
  /**
   * Render <Spinner size={14} color="pink" /> in place of qty number (state-C
   * mockup line 181 inline pattern). Used during debounce-pending or in-flight
   * PATCH /cart/items/:id window per D-S05-07 LAW optimistic UI.
   */
  isUpdating?: boolean;
  /**
   * Override line_total render for optimistic UI per D-S05-07 LAW. When
   * undefined falls back to `product.price * qty` (S-01 baseline).
   */
  lineTotalOverride?: number;
  /**
   * Currency formatter override. Default `formatVND` for backward-compat.
   * Cart contexts pass `formatVNDCompact` for no-space mockup parity (C-S05-J).
   */
  currencyFormatter?: (value: number) => string;

  // ─── S-08 T02 NEW (Phiên Sx08-G per handoff §3.B11) ──────────────────────
  /**
   * Voice match percentage (0..100) → green pill "{pct}% khớp" in the meta-row
   * (after name, before price) per mockup intent-02 state-C. Optional; when
   * undefined the badge is hidden (backward-compat). NOTE: /intent-02 page does
   * NOT currently pass this — BE returns RAW match_score (0..~30), not a pct.
   * See file header KNOWN-ISSUE. KHÔNG bịa số.
   */
  matchScorePct?: number;
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

// PRIVATE (S-08 T02): voice match badge — green pill rgba(34,197,94,0.12) in meta-row.
function MatchBadge(props: { pct: number }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-bold text-icp-green-600 bg-[rgba(34,197,94,0.12)]">
      <span className="inline-block w-1 h-1 rounded-full bg-icp-green-600" aria-hidden="true" />
      {props.pct}% khớp
    </span>
  );
}

// MAIN: <CartItemRow>
export const CartItemRow = React.forwardRef<HTMLDivElement, CartItemRowProps>(
  (
    {
      product,
      qty,
      onQtyChange,
      stockIssue,
      onResolveStockIssue,
      cornerBadge,
      isUpdating,
      lineTotalOverride,
      currencyFormatter,
      matchScorePct,
      className,
      ...props
    },
    ref
  ) => {
    const imageGradient = product.imageGradient ?? 'linear-gradient(135deg, #FEF3C7, #FCD34D)';
    const imageIcon: IconName = product.imageIcon ?? 'package';
    const baseLineTotal = product.price * qty;
    const lineTotal = lineTotalOverride ?? baseLineTotal;
    const isOutOfStock = stockIssue === 'out';

    // C-S05-J: default to S-01 baseline formatVND when consumer doesn't pass override.
    const fmt = currencyFormatter ?? formatVND;

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

          {/* Body — brand + name + (match badge) + price + qty stepper row */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px] mb-[2px]">
              {product.brand}
            </div>
            <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] mb-1.5 overflow-hidden line-clamp-2">
              {product.name}
            </div>

            {/* S-08 T02 NEW: match badge in meta-row (after name, before price). Hidden when undefined. */}
            {matchScorePct !== undefined ? (
              <div className="mb-1.5">
                <MatchBadge pct={matchScorePct} />
              </div>
            ) : null}

            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-[14px] text-icp-rose-700 font-bold font-mono tracking-[-0.3px]">
                {fmt(product.price)}
              </span>
              {product.originalPrice !== undefined ? (
                <span className="text-[11px] text-icp-text-muted line-through font-mono">
                  {fmt(product.originalPrice)}
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
                  disabled={isOutOfStock || isUpdating}
                  className="w-[26px] h-[26px] bg-icp-pink-100 border-[0.5px] border-icp-pink-200 rounded-lg flex items-center justify-center text-icp-pink-700 disabled:opacity-50"
                >
                  <Icon name="minus" size={14} />
                </button>
                {/* S-05 T03: Spinner replaces qty number during in-flight PATCH */}
                {isUpdating ? (
                  <div className="min-w-[24px] flex items-center justify-center" aria-label="Đang cập nhật">
                    <Spinner size={14} color="pink" />
                  </div>
                ) : (
                  <div className="text-[14px] text-icp-pink-900 font-bold min-w-[24px] text-center font-mono">
                    {qty}
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Tăng"
                  onClick={() => onQtyChange?.(qty + 1)}
                  disabled={isOutOfStock || isUpdating}
                  className="w-[26px] h-[26px] bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 rounded-lg flex items-center justify-center text-white shadow-[0_3px_8px_rgba(233,30,99,0.32)] disabled:opacity-50"
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <div className="text-[14px] text-icp-rose-700 font-bold font-mono">
                {fmt(lineTotal)}
              </div>
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
