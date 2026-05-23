/**
 * apps/web/components/icp/organisms/charts/ChartBar.tsx
 *
 * Organism: <ChartBar> — bespoke SVG bar chart for I07 analytics
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-5
 *
 * Source:   intent-07-state-D-chart-bar.html SVG bar chart visual contract
 *           PHASE_00_HANDOFF: "<BarChart> SVG component (dynamic from data, KHÔNG hard-code path)"
 *
 * Reach:    I07 only (S-10 V-SLICE Analytics)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — pure presentational
 * - C-15 SERVER per C-26 (Tailwind declarative)
 * - C-18 Tier 4 — no inline @keyframes
 * - C-26 RESOLVED — Tailwind declarative + SERVER
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC
 *
 * Implementation:
 * - Each bar = <rect> with gradient fill (vertical gradient bottom-to-top)
 * - Auto-scales bar width based on data length + viewBox
 * - Bar label rendered below via <text>
 *
 * Public API:
 *   <ChartBar
 *     data={[{label: 'T1', value: 12}, ...]}
 *     width={374}
 *     height={200}
 *     accent="pink"
 *     gradientIdSuffix="orders-7d"
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartBarDatum {
  label: string;
  value: number;
  /** Optional per-bar color override (hex). Defaults to chart accent. */
  color?: string;
}

export interface ChartBarProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children' | 'aria-label'> {
  data: ChartBarDatum[];
  /** Accessible label describing the chart's data context. Defaults to "Biểu đồ cột". */
  ariaLabel?: string;
  width?: number;
  height?: number;
  accent?: 'pink' | 'rose' | 'green' | 'amber' | 'orange';
  /** Gradient ID suffix — REQUIRED for SSR-safe unique IDs. Caller must
   *  provide a stable unique identifier per chart instance on the same page
   *  to avoid SVG gradient ID collision. See ChartLine docstring for details. */
  gradientIdSuffix: string;
  /** Show label text below each bar (default true) */
  showLabels?: boolean;
  /** Show value text on top of each bar (default false) */
  showValues?: boolean;
  /** Bar gap as fraction of bar width (default 0.25 = 25% gap) */
  barGap?: number;
}

const ACCENT_HEX: Record<NonNullable<ChartBarProps['accent']>, [string, string]> = {
  // [topColor, bottomColor] vertical gradient
  pink: ['#F472B6', '#E91E63'],
  rose: ['#FB7185', '#E11D48'],
  green: ['#34D399', '#10B981'],
  amber: ['#FBBF24', '#F59E0B'],
  orange: ['#FDBA74', '#FB923C'],
};

export const ChartBar = React.forwardRef<SVGSVGElement, ChartBarProps>(
  (
    {
      data,
      width = 374,
      height = 200,
      accent = 'pink',
      gradientIdSuffix,
      showLabels = true,
      showValues = false,
      barGap = 0.25,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const [topHex, bottomHex] = ACCENT_HEX[accent];
    const gradId = `chart-bar-grad-${accent}-${gradientIdSuffix}`;

    if (data.length === 0) {
      return null;
    }

    const labelHeight = showLabels ? 18 : 4;
    const valueHeight = showValues ? 14 : 4;
    const chartArea = height - labelHeight - valueHeight;
    const maxValue = Math.max(...data.map((d) => d.value), 1);
    const barCount = data.length;
    const totalGapRatio = barCount * (1 + barGap) - barGap;
    const barWidth = width / totalGapRatio;
    const gapWidth = barWidth * barGap;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn('w-full h-auto', className)}
        role="img"
        aria-label={ariaLabel ?? 'Biểu đồ cột'}
        {...props}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={topHex} />
            <stop offset="100%" stopColor={bottomHex} />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const barH = (d.value / maxValue) * chartArea;
          const barX = i * (barWidth + gapWidth);
          const barY = valueHeight + (chartArea - barH);
          const fill = d.color ?? `url(#${gradId})`;
          return (
            <g key={`${d.label}-${i}`}>
              {showValues && (
                <text
                  x={barX + barWidth / 2}
                  y={barY - 3}
                  textAnchor="middle"
                  className="fill-icp-pink-900 text-[10px] font-mono font-semibold"
                >
                  {d.value}
                </text>
              )}
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barH}
                rx="3"
                fill={fill}
              />
              {showLabels && (
                <text
                  x={barX + barWidth / 2}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-icp-pink-700 text-[10px] font-medium"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  },
);
ChartBar.displayName = 'ChartBar';
