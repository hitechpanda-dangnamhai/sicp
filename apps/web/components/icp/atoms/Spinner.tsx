/**
 * apps/web/components/icp/atoms/Spinner.tsx
 *
 * Atom: <Spinner> — loading spinner
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-11
 *
 * Source:   .spinner + .phase-spinner classes (intent-01/02/07)
 *           T01 globals.css .spin utility + Tailwind animate-spin
 *
 * Reach:    I01 phases card spinner (T04), I02 mic processing state,
 *           consumed by <Button loading> + <PhasesCard.Indicator>
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — pure presentational, no router
 * - D-04 hybrid animation — CSS animate-spin only, no Framer Motion
 *
 * Implementation: SVG circle with stroke-dasharray gap → rotates infinite.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: 14,
  md: 20,
  lg: 32,
} as const;

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** Size token or numeric pixel value */
  size?: keyof typeof SIZE_MAP | number;
  /** Stroke color: 'pink' (default MoMo), 'white' (on dark bg), 'currentColor' (inherit) */
  color?: 'pink' | 'white' | 'currentColor';
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size = 'md', color = 'pink', className, ...props }, ref) => {
    const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];
    const strokeColor =
      color === 'pink' ? 'var(--pink-600)' :
      color === 'white' ? '#FFFFFF' :
      'currentColor';

    return (
      <svg
        ref={ref}
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
        className={cn('animate-spin', className)}
        role="status"
        aria-label="loading"
        {...props}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="40 60"
          opacity="0.9"
        />
      </svg>
    );
  }
);
Spinner.displayName = 'Spinner';
