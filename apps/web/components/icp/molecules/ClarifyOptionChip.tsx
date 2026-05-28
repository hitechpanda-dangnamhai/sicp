'use client';

/**
 * apps/web/components/icp/molecules/ClarifyOptionChip.tsx
 *
 * Molecule: <ClarifyOptionChip> — state-D voice clarify candidate chip (full-width button)
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW molecule (B8)
 *
 * Source:   docs/mockups/intent-02/intent-02-state-D-clarify.html L432-486
 *           (.opt-chip / .opt-name / .opt-meta / .opt-price / .opt-other)
 *
 * Reach:    I02 state-D clarify chip-row. Top-3 candidates rendered from
 *           `voice_clarify_options.ambiguous_items[0].candidates` (W1 LOCK — chip
 *           data from SSE event, NOT interrupt/resume). Tap → postClarifyPick.
 *
 * Decisions applied:
 * - §3.Z row 2 (decisions-log LAW): candidate uses `match_score` (NOT `score`);
 *   ONE target/round; render "resolved/total món" progress at page level.
 * - W2 (handoff §3.B8 + §4): receives `matchScore` but DOES NOT render % —
 *   mockup state-D has NO percentage badge (BE emits RAW match_score, not pct).
 * - MAR-1 Q1 Option A+ Enhanced: slide-down stagger animation per chip index
 *   (delay-[0ms]/[50ms]/[100ms]).
 * - C-23 atom bypass: `.opt-chip` is a raw full-width <button> reusing design
 *   TOKENS/pattern from ChipPill — NOT a literal ChipPill wrap (ChipPill is a
 *   small inline div chip; semantics differ).
 * - C-15 'use client': onTap/onTapOverflow handlers.
 * - All candidate fields nullable (read verbatim from Vespa hit) — guard each.
 *
 * Colors (mockup verified): pink-900 #831447 name, rose-700 price, pink-700
 *   #BE185D meta + dot separators (3px).
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface ClarifyOptionChipProps {
  productId: string;
  title: string;
  brand?: string | null;
  price?: number | null;
  rating?: number | null;
  soldCount?: number | null;
  stock?: number | null;
  /** W2: voice candidate match_score — accepted but NOT rendered as % (mockup state-D has no %). */
  matchScore?: number | null;
  variant?: 'standard' | 'overflow';
  /** overflow variant only — "Xem tất cả {totalCount} loại". */
  totalCount?: number;
  isExpanded?: boolean;
  onTap: (productId: string) => void;
  onTapOverflow?: () => void;
  /** MAR-1 Q1: per-chip stagger index → delay-[0ms]/[50ms]/[100ms]. */
  staggerIndex?: number;
  className?: string;
}

// Stagger delay map (MAR-1 Q1 Option A+ Enhanced). Tailwind-safe literal classes.
const STAGGER_DELAY: Record<number, string> = {
  0: 'delay-[0ms]',
  1: 'delay-[50ms]',
  2: 'delay-[100ms]',
};

// PRIVATE: dot separator (#BE185D, 3px) between meta segments.
function MetaDot(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-[3px] h-[3px] rounded-full bg-icp-pink-700 mx-1.5 align-middle"
    />
  );
}

export const ClarifyOptionChip = React.forwardRef<HTMLButtonElement, ClarifyOptionChipProps>(
  (
    {
      productId,
      title,
      brand,
      price,
      rating,
      soldCount,
      stock,
      // matchScore intentionally destructured but NOT rendered (W2).
      matchScore: _matchScore,
      variant = 'standard',
      totalCount,
      isExpanded,
      onTap,
      onTapOverflow,
      staggerIndex = 0,
      className,
    },
    ref,
  ) => {
    const staggerCls = STAGGER_DELAY[staggerIndex] ?? 'delay-[100ms]';

    // ─── Overflow variant (.opt-other) ─────────────────────────────────────
    if (variant === 'overflow') {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onTapOverflow}
          aria-expanded={isExpanded ?? false}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2.5 mb-2',
            'bg-white/60 border-[0.5px] border-dashed border-icp-pink-300 rounded-2xl',
            'text-[12px] text-icp-pink-700 font-semibold',
            'animate-[slideDown_0.3s_ease-out_both]',
            staggerCls,
            className,
          )}
        >
          <Icon name="search" size={13} className="text-icp-pink-700" />
          Xem tất cả {totalCount ?? 0} loại
        </button>
      );
    }

    // ─── Standard candidate chip (.opt-chip) ───────────────────────────────
    // Meta row: ★rating · Bán {soldCount} · Còn {stock} — guard each nullable.
    const metaSegments: React.ReactNode[] = [];
    if (rating != null) {
      metaSegments.push(
        <span key="rating" className="inline-flex items-center gap-0.5">
          <Icon name="star" size={11} className="text-icp-amber-500" />
          {rating.toFixed(1)}
        </span>,
      );
    }
    if (soldCount != null) {
      metaSegments.push(<span key="sold">Bán {soldCount}</span>);
    }
    if (stock != null) {
      metaSegments.push(<span key="stock">Còn {stock}</span>);
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onTap(productId)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 mb-2 text-left',
          'bg-white border-[0.5px] border-icp-pink-200 rounded-2xl',
          'shadow-[0_3px_10px_rgba(233,30,99,0.07)]',
          'active:scale-[0.98] transition-transform',
          'animate-[slideDown_0.3s_ease-out_both]',
          staggerCls,
          className,
        )}
      >
        {/* Thumbnail 36px gradient + bottle icon */}
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-icp-rose-100 to-icp-rose-300"
        >
          <Icon name="bottle" size={18} className="text-icp-rose-700 opacity-70" />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] truncate">
            {title}
            {brand ? <span className="text-icp-pink-700 font-normal"> · {brand}</span> : null}
          </div>
          {metaSegments.length > 0 ? (
            <div className="mt-0.5 text-[10px] text-icp-pink-700 font-medium flex items-center flex-wrap">
              {metaSegments.map((seg, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <MetaDot /> : null}
                  {seg}
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>

        {/* Price (format VND, e.g. "25.000₫") — guarded */}
        {price != null ? (
          <div className="text-[14px] text-icp-rose-700 font-bold font-mono tracking-[-0.3px] flex-shrink-0">
            {formatVND(price)}
          </div>
        ) : null}
      </button>
    );
  },
);
ClarifyOptionChip.displayName = 'ClarifyOptionChip';
