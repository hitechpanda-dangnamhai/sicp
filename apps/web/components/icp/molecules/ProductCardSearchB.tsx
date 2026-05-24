'use client';

/**
 * apps/web/components/icp/molecules/ProductCardSearchB.tsx
 *
 * Molecule: <ProductCardSearchB> — Variant B 172px product card with match badge + reason chip
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule (Phiên Sx04-9a per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source:   docs/mockups/intent-03/intent-03B-state-0-happy.html lines 181-289 (4 cards: 98%/91%/87%/79%)
 *           cross-checked state-E-cart lines 156-208 + state-D-filter lines 168-244 + state-F-typo lines 226-247
 *
 * Reach:    S-04 Variant B carousel (mode='ai_augmented'). Variant A reuses S-01 ProductCard 138px.
 *
 * Decisions applied:
 * - D-S04-03 LAW: Variant B default tier needs match badge + reason chip
 * - D-S04-09 LAW: stub onAdd emit + toast confirm
 * - D-S04-14 LAW: per-index pre-allocated slot render driven by product_ready SSE event (T05 wires)
 * - Sx04-9a-discover Q-T04-1 Option A: icon-map registry extension (target/cube/bottle/flame/trending/discount)
 * - Sx04-9a-discover Q-T04-2 Option B3: matchTier(score) + matchColorClasses(score) pure FE logic
 *   ≥92 → target/exact; 85-91 → sparkles/ai_suggest; <85 → cube/similar
 *   ≥90 → green (#10B981); <90 → amber (#F59E0B)
 *   Cross-mockup verified 10 data points: 98 target/green, 95 target/green, 92 target/green,
 *                                          91 sparkles/green, 87 sparkles/amber, 82 cube/amber, 79 cube/amber
 * - W3 (Sx04-9a-discover): NO Product type exists — inline literal flat props per S-01 ProductCard precedent
 * - C-15 'use client' for onAdd event handler
 * - C-23 atom bypass for 28-30px micro UI (add button + badge spans) — per S-01 ProductCard precedent
 *
 * Structure: 1 main component + 2 PRIVATE pure functions:
 *   - matchTier(score)        — derives icon + tier from matchScore
 *   - matchColorClasses(score) — derives text color class from matchScore
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProductCardSearchBBadge {
  type: 'hot' | 'sale' | 'new' | 'discount' | 'trend';
  label: string;
}

export interface ProductCardSearchBProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'color'> {
  /** Brand name shown uppercase 9px at top of body (e.g. "MAGGI") */
  brand: string;
  /** Product display name, line-clamp-2 at 13px (e.g. "Nước tương Maggi đậm đặc 700ml") */
  name: string;
  /** Raw VND price (e.g. 25500). Formatted via formatVND util. */
  price: number;
  /** Strikethrough original price (e.g. 30000). Optional. */
  originalPrice?: number;
  /** CSS linear-gradient string for image background (mockup uses per-category amber/red/blue/green) */
  imageGradient?: string;
  /** Icon name for product placeholder. Default 'bottle' (Variant B nuoc_tuong showcase). */
  imageIcon?: IconName;
  /**
   * Match score 0-100. Internal pure functions derive:
   *   - icon: target (≥92) / sparkles (85-91) / cube (<85)
   *   - color: green (≥90) / amber (<90)
   * Cross-mockup verified 10 data points per Sx04-9a-discover Q-T04-2 Option B3 LOCK.
   */
  matchScore: number;
  /**
   * AI-generated reason text, pink-gradient chip with sparkles icon. REQUIRED for Variant B.
   * Max 60 chars VN per CR §8.1. line-clamp-2. (e.g. "Độ đậm cao, khách phở hay chọn nhất")
   */
  reason: string;
  /** 0-2 corner badges top-left of image. Mockup shows HOT/discount/trend combinations. */
  badges?: ProductCardSearchBBadge[];
  /** Star rating 0-5 (e.g. 4.8). Optional. */
  rating?: number;
  /** Sold count display text (e.g. "Đã bán 1.2k"). Optional. */
  soldCount?: string;
  /** Pink "+" add button callback. Optional render only if provided. */
  onAdd?: () => void;
  /** Opacity-85 for deprioritized cards (per S-01 ProductCard precedent) */
  muted?: boolean;
}

// ─── PRIVATE: pure functions per Sx04-9a-discover Q-T04-2 Option B3 LOCK ─────

type MatchTier = 'exact' | 'ai_suggest' | 'similar';
type MatchIcon = 'target' | 'sparkles' | 'cube';

function matchTier(score: number): { icon: MatchIcon; tier: MatchTier } {
  if (score >= 92) return { icon: 'target', tier: 'exact' };
  if (score >= 85) return { icon: 'sparkles', tier: 'ai_suggest' };
  return { icon: 'cube', tier: 'similar' };
}

function matchColorClasses(score: number): { textClass: string } {
  if (score >= 90) return { textClass: 'text-icp-green-500' };  // #10B981
  return { textClass: 'text-icp-amber-500' };                   // #F59E0B
}

// ─── PRIVATE: badge inline render (mirror S-01 ProductCard line 91-110) ──────

const BADGE_BG: Record<ProductCardSearchBBadge['type'], string> = {
  hot: 'bg-gradient-to-br from-icp-orange-500 to-icp-orange-600 text-white shadow-[0_2px_6px_rgba(234,88,12,0.4)]',
  sale: 'bg-gradient-to-br from-icp-amber-500 to-icp-amber-600 text-white',
  new: 'bg-gradient-to-br from-icp-green-500 to-icp-green-600 text-white',
  discount: 'bg-gradient-to-br from-icp-amber-500 to-icp-amber-600 text-white',
  trend: 'bg-gradient-to-br from-icp-pink-500 to-icp-orange-500 text-white',
};

function renderBadge(badge: ProductCardSearchBBadge, key: string): React.ReactElement {
  const showIcon = badge.type === 'hot' || badge.type === 'trend';
  return (
    <span
      key={key}
      className={cn(
        'inline-flex items-center gap-[3px] text-[9px] font-bold tracking-[0.2px] px-1.5 py-[2px] rounded-[5px]',
        BADGE_BG[badge.type]
      )}
    >
      {showIcon ? (
        <Icon name={badge.type === 'hot' ? 'flame' : 'trending'} size={10} />
      ) : null}
      {badge.label}
    </span>
  );
}

// ─── MAIN component ──────────────────────────────────────────────────────────

export const ProductCardSearchB = React.forwardRef<HTMLDivElement, ProductCardSearchBProps>(
  (
    {
      brand,
      name,
      price,
      originalPrice,
      imageGradient = 'linear-gradient(135deg, #FEF3C7, #FCD34D)',
      imageIcon = 'bottle',
      matchScore,
      reason,
      badges = [],
      rating,
      soldCount,
      onAdd,
      muted = false,
      className,
      ...props
    },
    ref
  ) => {
    const { icon, tier } = matchTier(matchScore);
    const { textClass } = matchColorClasses(matchScore);
    const matchPct = Math.round(matchScore);

    return (
      <div
        ref={ref}
        data-match-tier={tier}
        className={cn(
          'flex-shrink-0 w-[172px] bg-white border-[0.5px] border-icp-pink-200 rounded-2xl overflow-hidden shadow-icp-pink-md relative flex flex-col',
          muted && 'opacity-[0.85]',
          className
        )}
        {...props}
      >
        {/* Image section — aspect-square, gradient bg, badges top-left, match badge top-right, "+" bottom-right */}
        <div
          className="relative w-full aspect-square flex items-center justify-center"
          style={{ background: imageGradient }}
        >
          <Icon name={imageIcon} size={54} className="text-icp-amber-800/65" />

          {badges.length > 0 && (
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
              {badges.map((b, i) => renderBadge(b, `b-${i}`))}
            </div>
          )}

          {/* Match badge top-right — mockup line 185 verbatim */}
          <div
            className={cn(
              'absolute top-[7px] right-[7px] inline-flex items-center gap-[3px] bg-white/95 backdrop-blur-sm text-[10px] font-bold px-[7px] py-[3px] rounded-[10px] shadow-[0_3px_8px_rgba(0,0,0,0.1)] border-[0.5px] border-white/50',
              textClass
            )}
          >
            <Icon name={icon} size={11} />
            {matchPct}%
          </div>

          {/* "+" add button bottom-right — mockup line 187-189, pink gradient */}
          {onAdd && (
            <button
              type="button"
              aria-label="Thêm vào giỏ"
              onClick={onAdd}
              className="absolute bottom-1.5 right-1.5 w-[30px] h-[30px] rounded-[9px] flex items-center justify-center border-0 bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white shadow-[0_4px_10px_rgba(233,30,99,0.4)]"
            >
              <Icon name="plus" size={17} />
            </button>
          )}
        </div>

        {/* Body — brand uppercase + name line-clamp-2 + REQUIRED reason pink chip + price row */}
        <div className="px-[11px] pt-[9px] pb-2.5 flex flex-col gap-[5px]">
          <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px]">
            {brand}
          </div>
          <div className="text-[13px] text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] line-clamp-2 min-h-[34px]">
            {name}
          </div>

          {/* REQUIRED reason chip — pink-orange gradient + sparkles icon + line-clamp-2 + min-h 26px (mockup line 194-197) */}
          <div className="flex items-start gap-[5px] px-2 py-[5px] bg-gradient-to-br from-icp-pink-50 to-icp-rose-50 border-[0.5px] border-icp-pink-200 rounded-[8px] min-h-[26px]">
            <Icon
              name="sparkles"
              size={11}
              className="text-icp-pink-500 mt-[1px] flex-shrink-0"
            />
            <span className="text-[10px] text-icp-pink-900 font-medium leading-[1.3] line-clamp-2">
              {reason}
            </span>
          </div>

          {/* Price row */}
          <div className="flex items-baseline gap-[5px] mt-1">
            <span className="text-[14px] text-icp-rose-700 font-bold font-mono tracking-[-0.3px]">
              {formatVND(price)}
            </span>
            {originalPrice !== undefined && (
              <span className="text-[10px] text-icp-text-muted line-through font-mono">
                {formatVND(originalPrice)}
              </span>
            )}
          </div>

          {/* Rating + sold count row */}
          {(rating !== undefined || soldCount) && (
            <div className="flex justify-between items-center text-[10px] text-icp-pink-700">
              {rating !== undefined ? (
                <span className="inline-flex items-center gap-[2px]">
                  <Icon name="star" size={10} className="text-icp-amber-500 fill-icp-amber-500" />
                  <b>{rating}</b>
                </span>
              ) : (
                <span />
              )}
              {soldCount ? <span>{soldCount}</span> : null}
            </div>
          )}
        </div>
      </div>
    );
  }
);
ProductCardSearchB.displayName = 'ProductCardSearchB';
