/**
 * apps/web/components/icp/organisms/charts/ChartLine.tsx
 *
 * Organism: <ChartLine> — bespoke SVG line chart for I07 analytics
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-4
 *
 * Source:   intent-07-state-C-chart-line.html SVG line chart visual contract
 *           PHASE_00_HANDOFF Section "Component extraction priorities":
 *             "<LineChart> SVG component (dynamic from data, KHÔNG hard-code path)"
 *           PHASE_00_CROSS_INTENT_PATTERNS.md §7 sparkline pattern (scaled up)
 *
 * Reach:    I07 only (S-10 V-SLICE Analytics)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — pure presentational SVG
 * - C-15 SERVER per C-26 Phiên 18 resolution (Tailwind declarative, no useState
 *   interactive hover at organism layer; V-SLICE S-10 can add interactivity wrapper)
 * - C-18 Tier 4 — no inline @keyframes (Tier 3 exception scope = tailwind.config.ts only)
 * - C-22 atom interface N/A (no atom imports)
 * - C-26 RESOLVED — Tailwind declarative + SERVER distribution (no Framer/Recharts)
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC
 *
 * Implementation notes:
 * - Path generator PRIVATE helper computes M/L commands from data points
 * - Area fill via separate <path> below line stroke
 * - useId() NOT used here (SERVER component, no React hooks). Caller responsible
 *   for ensuring multiple ChartLine on same page have distinct gradient IDs via
 *   `gradientIdSuffix` prop (similar T02 MiniSparkline pattern but without useId).
 *
 * Public API:
 *   <ChartLine
 *     data={[{x: 0, y: 12}, {x: 1, y: 18}, ...]}
 *     width={374}
 *     height={200}
 *     accent="rose"
 *     gradientIdSuffix="revenue-30d"
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartLinePoint {
  x: number;
  y: number;
  label?: string;
}

export interface ChartLineProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children' | 'aria-label'> {
  /** Data points (must be sorted by x ascending). Min 2 points. */
  data: ChartLinePoint[];
  /** Accessible label describing the chart's data context (e.g., "Doanh thu 30 ngày qua").
   *  Defaults to generic "Biểu đồ đường" if omitted. Per a11y best practice, callers
   *  should provide a descriptive label including the data scope. */
  ariaLabel?: string;
  /** SVG viewBox width — default 374 (matches I07 chart-svg-wrap inner width) */
  width?: number;
  /** SVG viewBox height — default 200 (medium chart) */
  height?: number;
  /** Accent color */
  accent?: 'pink' | 'rose' | 'green' | 'amber' | 'orange';
  /** Gradient ID suffix — REQUIRED for SSR-safe unique IDs. Caller must provide
   *  a stable, unique identifier per chart instance on the same page (e.g.,
   *  'revenue-30d', 'orders-7d'). Multiple instances with the same suffix +
   *  same `accent` will collide and the first instance's gradient applies to
   *  all (DOM ID uniqueness violation).
   *  T02 MiniSparkline uses useId() since CLIENT atom; charts are SERVER per
   *  C-26 → no hooks → caller responsibility. */
  gradientIdSuffix: string;
  /** Padding inside SVG viewBox (avoids stroke clipping at edges) */
  padding?: number;
  /** Show end-point dot (default true) */
  showEndDot?: boolean;
}

// PRIVATE: accent color → hex map
const ACCENT_HEX: Record<NonNullable<ChartLineProps['accent']>, string> = {
  pink: '#E91E63',
  rose: '#F43F5E',
  green: '#10B981',
  amber: '#F59E0B',
  orange: '#FB923C',
};

// PRIVATE: compute SVG path commands from data points
function computePathCommands(
  data: ChartLinePoint[],
  width: number,
  height: number,
  padding: number,
): { linePath: string; areaPath: string; lastX: number; lastY: number } {
  if (data.length < 2) {
    return { linePath: '', areaPath: '', lastX: padding, lastY: height - padding };
  }
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d) => {
    const px = padding + ((d.x - xMin) / xRange) * innerW;
    const py = padding + innerH - ((d.y - yMin) / yRange) * innerH;
    return { px, py };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(2)},${p.py.toFixed(2)}`).join(' ');
  const areaPath =
    linePath +
    ` L${(padding + innerW).toFixed(2)},${(height - padding).toFixed(2)}` +
    ` L${padding.toFixed(2)},${(height - padding).toFixed(2)} Z`;
  const last = points[points.length - 1];
  return { linePath, areaPath, lastX: last.px, lastY: last.py };
}

export const ChartLine = React.forwardRef<SVGSVGElement, ChartLineProps>(
  (
    {
      data,
      width = 374,
      height = 200,
      accent = 'rose',
      gradientIdSuffix,
      padding = 12,
      showEndDot = true,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const accentHex = ACCENT_HEX[accent];
    const gradId = `chart-line-grad-${accent}-${gradientIdSuffix}`;
    const { linePath, areaPath, lastX, lastY } = computePathCommands(data, width, height, padding);

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={cn('w-full h-auto', className)}
        role="img"
        aria-label={ariaLabel ?? 'Biểu đồ đường'}
        {...props}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentHex} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {/* Line stroke */}
        {linePath && (
          <path
            d={linePath}
            stroke={accentHex}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {/* End-point dot */}
        {showEndDot && data.length >= 2 && (
          <circle cx={lastX} cy={lastY} r="4" fill={accentHex} stroke="#FFFFFF" strokeWidth="2" />
        )}
      </svg>
    );
  },
);
ChartLine.displayName = 'ChartLine';
