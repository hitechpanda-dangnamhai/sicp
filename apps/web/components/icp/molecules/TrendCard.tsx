'use client';

/**
 * TrendCard — Google Trends market demand signal compact card.
 *
 * Per ADR-031 (Google Trends mandate) + I01-state-B `.trend-card`
 * (mockup lines 515-653, mint/green palette).
 *
 * Compact mode only at T04 per C-21 scope cut. Expanded mode (I01-H, 498 lines
 * full-page) deferred S-07 Image AI V-SLICE which composes expanded view
 * using: TrendCard compact + AIInsightCard reasoning + StatPill grid +
 * ChipPill grid + MiniSparkline large variant + page router.
 *
 * Wraps T02 atoms: <MiniSparkline accent='green'>, <Icon>, <ChipPill color='mint'>,
 * <Button variant='ghost' size='sm'>.
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onExpand emits, caller routes to S-07 expanded page
 * - C-13 Omit 'color' defensive (mode prop is layout, not color, but defensive)
 * - C-15 'use client' (onExpand onClick)
 * - C-18 Tier 4 Tailwind utility inline
 * - C-21 compact only (no expanded mode)
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { MiniSparkline, Icon, ChipPill, Button } from '@/components/icp/atoms';

export interface TrendChipData {
  label: string;
  /** Signed percent delta for chip; positive = up arrow */
  delta?: number;
}

export interface TrendCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'color'> {
  /** REQUIRED — signed percent delta, e.g. 45 → "+45%" */
  delta: number;
  /** REQUIRED — sparkline data points (30-90 days typical) */
  sparklineData: number[];
  /** Top label, default Vietnamese */
  label?: string;
  /** Subtitle below label */
  subtitle?: string;
  /** Optional rising-keywords chips */
  chips?: TrendChipData[];
  /** Expand CTA callback (caller routes to S-07 expanded page) */
  onExpand?: () => void;
}

export const TrendCard = forwardRef<HTMLDivElement, TrendCardProps>(function TrendCard(
  {
    delta,
    sparklineData,
    label = 'GOOGLE TRENDS',
    subtitle,
    chips,
    onExpand,
    className,
    ...rest
  },
  ref
) {
  const isUp = delta >= 0;
  const deltaStr = `${isUp ? '+' : ''}${delta}%`;

  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-emerald-200 p-3.5 mb-4',
        'bg-gradient-to-br from-white to-emerald-50',
        'shadow-[0_6px_16px_rgba(16,185,129,0.12)]',
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
            'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(16,185,129,0.3)]">
            <Icon name="trending-up" size={14} className="text-white" />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              {label}
            </div>
            {subtitle && (
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {onExpand && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="bg-white/70 border-[0.5px] border-emerald-200 text-emerald-700 hover:bg-white text-[10px] font-bold px-2.5 py-1 h-auto rounded-lg"
          >
            Mở rộng
          </Button>
        )}
      </div>

      {/* Body — delta + sparkline */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex-shrink-0 min-w-[78px] text-center py-2 px-1 bg-white/90 rounded-xl">
          <div
            className="font-mono text-[22px] font-bold leading-none tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {deltaStr}
          </div>
          <div className="text-[9px] text-emerald-900 font-bold uppercase tracking-wider mt-1">
            90 ngày
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <MiniSparkline data={sparklineData} accent="green" />
        </div>
      </div>

      {/* Footer chips */}
      {chips && chips.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-1.5 mt-3">
          {chips.map((chip, i) => (
            <ChipPill
              key={`${chip.label}-${i}`}
              variant="tag"
              color="green"
              size="sm"
            >
              {chip.delta !== undefined && (
                <span className="text-emerald-700 font-bold mr-1">
                  {chip.delta >= 0 ? '↑' : '↓'}
                </span>
              )}
              {chip.label}
              {chip.delta !== undefined && (
                <span className="ml-1 font-bold">
                  {chip.delta >= 0 ? '+' : ''}
                  {chip.delta}%
                </span>
              )}
            </ChipPill>
          ))}
        </div>
      )}
    </div>
  );
});
