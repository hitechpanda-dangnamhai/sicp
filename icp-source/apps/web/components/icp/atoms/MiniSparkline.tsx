'use client';

/**
 * apps/web/components/icp/atoms/MiniSparkline.tsx
 *
 * Atom: <MiniSparkline> — inline SVG sparkline for trend visualization
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-8
 *
 * Source:   PHASE_00_CROSS_INTENT_PATTERNS.md §7 LOCKED pattern
 *           Visual contract: intent-01 State B (mini 38px) + State H (medium 64px)
 *
 * Reach:    I01 market trend card, I04 co-purchase frequency, I07 revenue mini chart
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — pure SVG render
 * - C-11 trend-green native — accent="green" uses --trend-green-500 directly
 * - D-04 hybrid animation — none, static render
 *
 * Critical constraint (§7): each sparkline MUST have unique gradient ID to avoid
 * conflict when multiple instances on same page. Uses React.useId() if gradientId
 * not provided.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type AccentColor = 'pink' | 'green' | 'amber' | 'orange';

const ACCENT_HEX: Record<AccentColor, string> = {
  pink: '#E91E63',
  green: '#10B981',
  amber: '#F59E0B',
  orange: '#F97316',
};

export interface MiniSparklineProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'> {
  /** Data series (5-50 numeric points). Auto-normalized to viewBox height. */
  data: number[];
  /** Accent color for line stroke + area gradient + end dot */
  accent?: AccentColor;
  /** SVG width; default 200 (Tailwind will scale via w-full anyway) */
  width?: number;
  /** SVG height; default 38 */
  height?: number;
  /** Show area fill under line; default true */
  showFill?: boolean;
  /** Show end-point dot; default true */
  showDot?: boolean;
  /** Override gradient ID (must be unique per instance); auto-generated if omitted */
  gradientId?: string;
}

export const MiniSparkline = React.forwardRef<SVGSVGElement, MiniSparklineProps>(
  (
    {
      data,
      accent = 'pink',
      width = 200,
      height = 38,
      showFill = true,
      showDot = true,
      gradientId,
      className,
      ...props
    },
    ref
  ) => {
    // Auto-generate unique gradient ID if not provided (CROSS_INTENT_PATTERNS §7 constraint)
    const autoId = React.useId();
    const gid = gradientId ?? `spark-${autoId.replace(/:/g, '')}`;

    const accentColor = ACCENT_HEX[accent];

    // Compute path d-attribute from data series
    // Defensive: handle empty or single-point data gracefully
    const { linePath, fillPath, endX, endY } = React.useMemo(() => {
      if (!data || data.length === 0) {
        return { linePath: '', fillPath: '', endX: 0, endY: 0 };
      }
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const stepX = data.length > 1 ? width / (data.length - 1) : 0;
      const padding = 3;
      const usableHeight = height - padding * 2;

      const points = data.map((v, i) => {
        const x = i * stepX;
        const y = padding + usableHeight - ((v - min) / range) * usableHeight;
        return [x, y] as [number, number];
      });

      const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const fillPath = `${linePath} L${width},${height} L0,${height} Z`;
      const [endX, endY] = points[points.length - 1];

      return { linePath, fillPath, endX, endY };
    }, [data, width, height]);

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        className={cn('block', className)}
        role="img"
        aria-label={`Sparkline trend chart, ${data.length} points`}
        {...props}
      >
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showFill && fillPath ? (
          <path d={fillPath} fill={`url(#${gid})`} />
        ) : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={accentColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {showDot && data.length > 0 ? (
          <circle cx={endX} cy={endY} r="2.5" fill={accentColor} />
        ) : null}
      </svg>
    );
  }
);
MiniSparkline.displayName = 'MiniSparkline';
