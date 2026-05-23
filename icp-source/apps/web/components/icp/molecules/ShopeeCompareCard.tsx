'use client';

/**
 * ShopeeCompareCard — Shopee market price comparison compact card.
 *
 * Per I01-state-B `.shopee-card` (mockup lines 390-510, orange/amber palette
 * with `.price-range` bar + `.range-marker` user + `.range-avg` median).
 *
 * Compact mode only at T04 per C-21 scope cut. Expanded mode (I01-D, 596 lines
 * full-page `.market-hero` + `.market-range` + `.similar-grid`) deferred S-07.
 *
 * Uses T01 helper `formatVND()` for currency display.
 * Wraps T02 atoms: <Icon>, <Button variant='ghost' size='sm'>.
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onExpand emits, caller routes to S-07
 * - C-13 Omit 'color' defensive
 * - C-15 'use client' (onExpand + useMemo for marker positions)
 * - C-18 Tier 4 Tailwind utility inline
 * - C-21 compact only
 */

import { forwardRef, useMemo, type HTMLAttributes } from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon, Button } from '@/components/icp/atoms';

export interface ShopeeCompareCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'> {
  /** REQUIRED — user's product price (VND) */
  userPrice: number;
  /** REQUIRED — market min price */
  priceMin: number;
  /** REQUIRED — market max price */
  priceMax: number;
  /** REQUIRED — market median price */
  priceMedian: number;
  /** Top label, default Vietnamese */
  label?: string;
  /** Subtitle below label */
  subtitle?: string;
  /** Expand CTA callback */
  onExpand?: () => void;
}

export const ShopeeCompareCard = forwardRef<HTMLDivElement, ShopeeCompareCardProps>(
  function ShopeeCompareCard(
    {
      userPrice,
      priceMin,
      priceMax,
      priceMedian,
      label = 'GIÁ THỊ TRƯỜNG SHOPEE',
      subtitle = 'Trung vị 5 cửa hàng',
      onExpand,
      className,
      ...rest
    },
    ref
  ) {
    // Compute marker positions as percent within [priceMin, priceMax] range
    const { userPct, medianPct } = useMemo(() => {
      const range = priceMax - priceMin || 1;
      const clamp = (v: number) => Math.max(0, Math.min(100, v));
      return {
        userPct: clamp(((userPrice - priceMin) / range) * 100),
        medianPct: clamp(((priceMedian - priceMin) / range) * 100),
      };
    }, [userPrice, priceMin, priceMax, priceMedian]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-amber-200 p-3.5 mb-4',
          'bg-gradient-to-br from-white to-amber-50',
          'shadow-[0_6px_16px_rgba(251,146,60,0.15)]',
          className
        )}
        {...rest}
      >
        {/* Radial bg accent */}
        <div
          aria-hidden="true"
          className="absolute -top-5 -right-5 w-[90px] h-[90px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(251,146,60,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(234,88,12,0.3)]">
              <Icon name="trending-down" size={14} className="text-white" />
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-900">
                {label}
              </div>
              <div className="text-[10px] text-orange-700 font-medium mt-0.5">
                {subtitle}
              </div>
            </div>
          </div>
          {onExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpand}
              className="bg-white/70 border-[0.5px] border-amber-200 text-orange-700 hover:bg-white text-[10px] font-bold px-2.5 py-1 h-auto rounded-lg"
            >
              Mở rộng
            </Button>
          )}
        </div>

        {/* Price range bar */}
        <div className="relative z-10 mt-2.5">
          {/* Min/max labels */}
          <div className="flex justify-between font-mono text-[10px] text-orange-900 font-bold mb-1.5">
            <span>{formatVND(priceMin)}</span>
            <span>{formatVND(priceMax)}</span>
          </div>
          {/* Track */}
          <div
            className="relative h-2.5 rounded-md overflow-visible"
            style={{
              background:
                'linear-gradient(90deg, #FED7AA 0%, #FB923C 50%, #FED7AA 100%)',
            }}
            role="progressbar"
            aria-valuemin={priceMin}
            aria-valuemax={priceMax}
            aria-valuenow={userPrice}
            aria-label="Vị trí giá của bạn trên thị trường"
          >
            {/* Median tick (avg) */}
            <div
              className="absolute top-0.5 w-0.5 h-1.5 bg-orange-900 rounded-sm"
              style={{ left: `${medianPct}%` }}
              aria-hidden="true"
            />
            {/* User marker (your price) */}
            <div
              className="absolute -top-[3px] w-4 h-4 rounded-full bg-white border-[2.5px] border-rose-500 shadow-[0_4px_10px_rgba(233,30,99,0.5)]"
              style={{
                left: `${userPct}%`,
                transform: 'translateX(-50%)',
              }}
              aria-hidden="true"
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                Bạn
              </span>
            </div>
          </div>
          {/* Your price readout */}
          <div className="mt-2 text-center">
            <span className="font-mono text-[13px] font-bold text-rose-600">
              {formatVND(userPrice)}
            </span>
            <span className="text-[10px] text-orange-700 font-medium ml-2">
              (Trung vị {formatVND(priceMedian)})
            </span>
          </div>
        </div>
      </div>
    );
  }
);
