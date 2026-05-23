/**
 * apps/web/components/icp/organisms/charts/ChartDonut.tsx
 *
 * Organism: <ChartDonut> — bespoke SVG donut/pie chart for I07 analytics
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-6
 *
 * Source:   intent-07-state-E-chart-donut.html SVG donut chart visual contract
 *           PHASE_00_HANDOFF: "<DonutChart> SVG component (dynamic from data, KHÔNG hard-code path)"
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
 * - Each segment = <path> arc computed from angle proportions
 * - SVG arc command (A) used for circular segments
 * - Center hole creates donut shape (omit innerRadius for pie chart)
 * - Default 5-segment palette MoMo: rose/pink/orange/amber/green
 *
 * Public API:
 *   <ChartDonut
 *     segments={[{label: 'Sữa', value: 45}, {label: 'Bánh', value: 30}, ...]}
 *     width={200}
 *     height={200}
 *     innerRadius={50}
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartDonutSegment {
  label: string;
  value: number;
  /** Optional per-segment color override (hex). Defaults to palette rotation. */
  color?: string;
}

export interface ChartDonutProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children' | 'aria-label'> {
  segments: ChartDonutSegment[];
  /** Accessible label describing data context. Defaults to "Biểu đồ tròn". */
  ariaLabel?: string;
  /** SVG viewBox square dimension — default 200 */
  width?: number;
  height?: number;
  /** Inner radius for donut hole — set to 0 for pie chart. Default 50 */
  innerRadius?: number;
  /** Outer radius — defaults to (width / 2) - 8 padding */
  outerRadius?: number;
  /** Show center label (e.g., total) — pass as ReactNode via centerLabel slot */
  centerLabel?: React.ReactNode;
}

// Note: ChartDonut uses solid segment fills (no SVG <linearGradient>), so no
// gradientIdSuffix needed unlike ChartLine/ChartBar. If gradient fills are
// added in future, add required `gradientIdSuffix` prop matching ChartLine pattern.

// PRIVATE: MoMo palette rotation for default segment colors
const DEFAULT_PALETTE = ['#E91E63', '#F43F5E', '#FB923C', '#F59E0B', '#10B981', '#BE185D', '#FDBA74'];

// PRIVATE: convert polar (angle, radius) → cartesian (x, y) given center
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 to start at 12 o'clock
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// PRIVATE: build SVG path command for a donut segment (annulus arc)
function buildSegmentPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const [x1o, y1o] = polarToCartesian(cx, cy, outerR, startAngle);
  const [x2o, y2o] = polarToCartesian(cx, cy, outerR, endAngle);
  const [x1i, y1i] = polarToCartesian(cx, cy, innerR, endAngle);
  const [x2i, y2i] = polarToCartesian(cx, cy, innerR, startAngle);
  if (innerR === 0) {
    // Pie segment (no inner hole)
    return [
      `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
      `L ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      `Z`,
    ].join(' ');
  }
  return [
    `M ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
    `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
    `Z`,
  ].join(' ');
}

export const ChartDonut = React.forwardRef<SVGSVGElement, ChartDonutProps>(
  (
    {
      segments,
      width = 200,
      height = 200,
      innerRadius = 50,
      outerRadius,
      centerLabel,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    if (segments.length === 0) {
      return null;
    }
    const cx = width / 2;
    const cy = height / 2;
    const outerR = outerRadius ?? Math.min(width, height) / 2 - 8;
    const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;

    // Compute angle ranges
    let cursor = 0;
    const arcs = segments.map((s, i) => {
      const startAngle = (cursor / total) * 360;
      cursor += s.value;
      const endAngle = (cursor / total) * 360;
      const color = s.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      // Avoid degenerate full-circle arc (endAngle - startAngle exactly 360)
      const safeEnd = endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle;
      const d = buildSegmentPath(cx, cy, innerRadius, outerR, startAngle, safeEnd);
      return { d, color, label: s.label, value: s.value };
    });

    return (
      <div
        className={cn('relative inline-block', className)}
        style={{ width, height }}
      >
        <svg
          ref={ref}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel ?? 'Biểu đồ tròn'}
          {...props}
        >
          {arcs.map((arc, i) => (
            <path key={`${arc.label}-${i}`} d={arc.d} fill={arc.color} stroke="#FFFFFF" strokeWidth="1.5" />
          ))}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerLabel}
          </div>
        )}
      </div>
    );
  },
);
ChartDonut.displayName = 'ChartDonut';
