'use client';

/**
 * apps/web/components/icp/molecules/CoPurchaseHintCard.tsx
 *
 * Molecule: <CoPurchaseHintCard> — Variant B post-cart-add cross-sell hint
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule (Phiên Sx04-9a per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source:   docs/mockups/intent-03/intent-03B-state-E-cart.html lines 228-251 verbatim
 *           Header "68% khách mua kèm" + suggested product (54×54 image + name/price/sold + "+" 36×36)
 *
 * Reach:    S-04 Variant B only (mode='ai_augmented'). Renders ONLY when parent receives
 *           `co_purchase_hint` SSE event after `cart.item_added` per D-S04-09 LAW.
 *
 * Decisions applied:
 * - D-S04-03 LAW: Variant B unique feature (mode='ai_augmented').
 * - D-S04-09 LAW: suggested product tap → same stub flow as main "+" button.
 * - D-S04-11 LAW: fixture-driven data per 02_DATA_MODEL.md §X.2; S-10 V006 mat view replaces real.
 * - D-S04-12 LAW: `tuong_ot` 11th category provides Chin-su 250g 17000đ (mockup-perfect suggested).
 * - W3 (Sx04-9a-discover): NO Product type exists — inline literal flat props per S-01 ProductCard precedent.
 * - C-15 'use client' for onAddSuggested handler.
 *
 * Visual structure (mockup line 228-251):
 *   - Outer: pink-gradient white→pink-50 + border pink-200 + rounded 14px + ml-9 (36px indent from orb-mini)
 *   - Header: users icon 14px + "68% khách mua kèm" pink-700 uppercase 10px
 *   - Body row (flex gap 10px):
 *     - 54×54 image placeholder (gradient + icon)
 *     - Mid: brand 9px uppercase + name 13px + price 13px rose + soldCount 10px green
 *     - Right: "+" 36×36 pink gradient button
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

export interface CoPurchaseSuggestedProduct {
  /** Brand name (e.g. "CHIN-SU") */
  brand: string;
  /** Product display name (e.g. "Tương ớt Chin-su 250g") */
  name: string;
  /** Raw VND price (e.g. 17000) */
  price: number;
  /** CSS linear-gradient for image placeholder background */
  imageGradient?: string;
  /** Icon name for product placeholder. Default 'bottle'. */
  imageIcon?: IconName;
  /** Sold count text (e.g. "đã bán 2.1k"). Renders green per mockup. */
  soldCount?: string;
}

export interface CoPurchaseHintCardProps {
  /** Hint payload — matches SseCoPurchaseHintEvent shape (props subset; T05 maps event to this). */
  hint: {
    /** Rate percentage 0-100 (e.g. 68 → "68% khách mua kèm") */
    ratePct: number;
    /** Reason text from AI (e.g. "Khách phở thường thêm tương ớt cay"). Currently shown via header label. */
    reason: string;
    /** Suggested product (flat literal — NO Product type) */
    suggestedProduct: CoPurchaseSuggestedProduct;
    /** Data attribute for debug — anchor category (e.g. "nuoc_tuong") */
    anchorCategory: string;
    /** Data attribute for debug — suggested category (e.g. "tuong_ot") */
    suggestedCategory: string;
  };
  /** "+" button callback. Receives flat product summary for cart-add. Optional. */
  onAddSuggested?: (suggested: { brand: string; name: string; price: number }) => void;
  /** Optional className override. */
  className?: string;
}

export const CoPurchaseHintCard: React.FC<CoPurchaseHintCardProps> = ({
  hint,
  onAddSuggested,
  className,
}) => {
  const {
    ratePct,
    suggestedProduct: {
      brand,
      name,
      price,
      imageGradient = 'linear-gradient(135deg, #FEE2E2, #F87171)',
      imageIcon = 'bottle',
      soldCount,
    },
    anchorCategory,
    suggestedCategory,
  } = hint;

  const ratePctRounded = Math.round(ratePct);

  return (
    <div
      data-anchor-category={anchorCategory}
      data-suggested-category={suggestedCategory}
      className={cn(
        'bg-gradient-to-br from-white to-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-[14px] shadow-[0_4px_12px_rgba(233,30,99,0.08)] p-3 ml-9',
        className
      )}
    >
      {/* Header — users icon + rate% label (mockup line 230-233) */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon name="users" size={14} className="text-icp-pink-700" />
        <span className="text-[10px] text-icp-pink-700 font-bold uppercase tracking-[0.3px]">
          {ratePctRounded}% khách mua kèm
        </span>
      </div>

      {/* Body row — image + mid column + "+" button (mockup line 234-249) */}
      <div className="flex items-center gap-2.5">
        {/* 54×54 image placeholder */}
        <div
          className="w-[54px] h-[54px] rounded-[11px] flex items-center justify-center flex-shrink-0 shadow-[0_4px_10px_rgba(220,38,38,0.18)]"
          style={{ background: imageGradient }}
        >
          <Icon name={imageIcon} size={26} className="text-icp-rose-700/70" />
        </div>

        {/* Mid column — brand uppercase + name + price row */}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px] mb-[1px]">
            {brand}
          </div>
          <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] mb-[2px] line-clamp-1">
            {name}
          </div>
          <div className="flex items-baseline gap-[5px]">
            <span className="text-[13px] text-icp-rose-700 font-bold font-mono">
              {formatVND(price)}
            </span>
            {soldCount && (
              <span className="text-[10px] text-icp-green-500 font-semibold">{soldCount}</span>
            )}
          </div>
        </div>

        {/* "+" button — 36×36 pink gradient (mockup line 246-248) */}
        <button
          type="button"
          aria-label="Thêm sản phẩm gợi ý vào giỏ"
          onClick={() => onAddSuggested?.({ brand, name, price })}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center border-0 bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white shadow-[0_4px_10px_rgba(233,30,99,0.32)] flex-shrink-0"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
};
CoPurchaseHintCard.displayName = 'CoPurchaseHintCard';
