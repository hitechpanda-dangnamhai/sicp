/**
 * apps/web/components/icp/atoms/StatPill.tsx
 *
 * Atom: <StatPill> — small stat cell with value + label
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-7
 *
 * Source:   .stat-pill / .stat-cell classes (intent-01 state-0, intent-07)
 *           Visual contract: intent-01-state-0-capture.html L325-345 (.stats-row)
 *           "~3s / 12 / 98%" stats row layout
 *
 * Reach:    I01 capture stats row, I07 analytics stat cells
 *
 * Decisions applied:
 * - C-07 navigation-agnostic
 * - C-08 i18n hardcode VN — consumer passes label
 * - C-11 trend-green native — accent="green" uses --trend-green-500
 * - D-04 hybrid animation — no Framer Motion at atom layer
 *
 * Implementation: 3-row stack (value JetBrains Mono large, label tiny uppercase,
 * optional sparkline at bottom). Backdrop-blur for glass effect.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type AccentColor = 'pink' | 'orange' | 'amber' | 'green';

const ACCENT_TEXT_CLASS: Record<AccentColor, string> = {
  pink: 'text-icp-pink-600',
  orange: 'text-icp-orange-600',
  amber: 'text-icp-amber-700',
  green: 'text-icp-green-600',
};

const ACCENT_BORDER_CLASS: Record<AccentColor, string> = {
  pink: 'border-icp-border-pink',
  orange: 'border-icp-border-orange',
  amber: 'border-icp-amber-200',
  green: 'border-icp-green-200',
};

export interface StatPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stat value — usually short numeric/percentage string (e.g., "~3s", "98%", "12") */
  value: string | number;
  /** Label text under value (uppercase styling auto-applied; pass plain text) */
  label: string;
  /** Accent color for value text + border tint; default 'pink' */
  accent?: AccentColor;
  /** Optional sparkline slot — pass <MiniSparkline /> element */
  sparkline?: React.ReactNode;
}

export const StatPill = React.forwardRef<HTMLDivElement, StatPillProps>(
  ({ value, label, accent = 'pink', sparkline, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5',
          'bg-icp-bg-surface/60 backdrop-blur-sm border',
          ACCENT_BORDER_CLASS[accent],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'font-mono font-bold text-base leading-none',
            ACCENT_TEXT_CLASS[accent]
          )}
        >
          {value}
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-icp-pink-700">
          {label}
        </div>
        {sparkline ? <div className="mt-1 w-full">{sparkline}</div> : null}
      </div>
    );
  }
);
StatPill.displayName = 'StatPill';
