'use client';

/**
 * apps/web/components/icp/atoms/ChipPill.tsx
 *
 * Atom: <ChipPill> — consolidated chip/tag/badge/status atom
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-6
 *
 * Source:   50+ chip/tag/badge classes consolidated across all intents
 *           Visual contracts:
 *           - intent-01-state-0 .ai-badge (status variant), .floating-tag (tag with float anim)
 *           - intent-02-state-0 .ai-label (status, pink ramp), .example-tag (badge gradient)
 *           - intent-08-state-0 hero pagination chips
 *
 * Reach:    All 8 intents — search filters, status indicators, AI labels, badges
 *
 * Decisions applied:
 * - C-06 N/A
 * - C-07 navigation-agnostic — onClick prop only, no Link
 * - C-08 i18n hardcode VN — consumer passes children
 * - C-11 trend-green native — color="green" uses bg-icp-green-50 directly
 * - D-04 hybrid animation — no Framer Motion at atom layer
 *
 * Implementation: cva variant × color combinatorial. Interactive prop adds
 * hover/focus + role="button". Selected prop (controlled) sets data-state="active"
 * for data-active: Tailwind variant from T01.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import type { IconName } from '@/lib/icon-map';

const chipPillVariants = cva(
  [
    'inline-flex items-center gap-1.5 font-semibold transition-all',
    'whitespace-nowrap select-none',
  ],
  {
    variants: {
      variant: {
        // Filter chip — pill shape, soft bg, used for filtering UI (intent-04 search)
        filter: 'rounded-pill border',
        // Tag chip — pill shape with gradient bg, decorative (intent-02 example-tag)
        tag: 'rounded-md text-white border-0',
        // Badge chip — mini chip, uppercase, used for status indicators (HOT, NEW, AI VISION)
        badge: 'rounded-md uppercase tracking-wider border-0',
        // Status chip — rounded square with icon prefix (intent-01 .ai-badge)
        status: 'rounded-pill border',
      },
      color: {
        pink: '',
        rose: '',
        orange: '',
        amber: '',
        green: '',  // C-11 native
        neutral: '',
      },
      size: {
        sm: 'h-6 px-2 text-[10px] [&_svg]:size-3',
        md: 'h-7 px-2.5 text-[11px] [&_svg]:size-3.5',
      },
      interactive: {
        true: 'cursor-pointer hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        false: '',
      },
    },
    // Color × variant compound classes
    compoundVariants: [
      // Filter — soft bg, border, text in dark variant
      { variant: 'filter', color: 'pink', class: 'bg-icp-pink-50 border-icp-pink-200 text-icp-pink-700 data-active:bg-icp-pink-600 data-active:text-white data-active:border-icp-pink-600' },
      { variant: 'filter', color: 'rose', class: 'bg-icp-rose-50 border-icp-rose-200 text-icp-rose-700 data-active:bg-icp-rose-600 data-active:text-white data-active:border-icp-rose-600' },
      { variant: 'filter', color: 'orange', class: 'bg-icp-orange-50 border-icp-orange-200 text-icp-orange-700 data-active:bg-icp-orange-500 data-active:text-white data-active:border-icp-orange-500' },
      { variant: 'filter', color: 'amber', class: 'bg-icp-amber-50 border-icp-amber-200 text-icp-amber-800 data-active:bg-icp-amber-500 data-active:text-white data-active:border-icp-amber-500' },
      { variant: 'filter', color: 'green', class: 'bg-icp-green-50 border-icp-green-200 text-icp-green-700 data-active:bg-icp-green-500 data-active:text-white data-active:border-icp-green-500' },
      { variant: 'filter', color: 'neutral', class: 'bg-icp-bg-tinted border-icp-border-divider text-icp-text-muted' },

      // Tag — gradient backgrounds, white text
      { variant: 'tag', color: 'pink', class: 'bg-[image:var(--grad-icon-pink)] text-white' },
      { variant: 'tag', color: 'rose', class: 'bg-[image:var(--grad-icon-pink)] text-white' },
      { variant: 'tag', color: 'orange', class: 'bg-[image:var(--grad-icon-orange)] text-white' },
      { variant: 'tag', color: 'amber', class: 'bg-[image:var(--grad-icon-amber-light)] text-icp-amber-800' },
      { variant: 'tag', color: 'green', class: 'bg-icp-green-500 text-white' },
      { variant: 'tag', color: 'neutral', class: 'bg-icp-bg-tinted text-icp-text-primary' },

      // Badge — gradient, uppercase, small
      { variant: 'badge', color: 'pink', class: 'bg-[image:var(--grad-badge-ai)] text-white' },
      { variant: 'badge', color: 'rose', class: 'bg-[image:var(--grad-active)] text-white' },
      { variant: 'badge', color: 'orange', class: 'bg-[image:var(--grad-badge-hot)] text-white' },
      { variant: 'badge', color: 'amber', class: 'bg-icp-amber-100 text-icp-amber-800' },
      { variant: 'badge', color: 'green', class: 'bg-icp-green-100 text-icp-green-700' },
      { variant: 'badge', color: 'neutral', class: 'bg-icp-bg-tinted text-icp-text-primary' },

      // Status — light bg, dark text, border
      { variant: 'status', color: 'pink', class: 'bg-[image:var(--grad-icon-rose-light)] border-icp-border-pink text-icp-pink-700' },
      { variant: 'status', color: 'rose', class: 'bg-[image:var(--grad-icon-rose-light)] border-icp-rose-200 text-icp-rose-700' },
      { variant: 'status', color: 'orange', class: 'bg-icp-orange-50 border-icp-border-orange text-icp-orange-700' },
      { variant: 'status', color: 'amber', class: 'bg-icp-amber-50 border-icp-amber-200 text-icp-amber-800' },
      { variant: 'status', color: 'green', class: 'bg-icp-green-50 border-icp-green-200 text-icp-green-700' },
      { variant: 'status', color: 'neutral', class: 'bg-icp-bg-tinted border-icp-border-divider text-icp-text-muted' },
    ],
    defaultVariants: {
      variant: 'filter',
      color: 'pink',
      size: 'md',
      interactive: false,
    },
  }
);

export interface ChipPillProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onClick' | 'color'>,
    VariantProps<typeof chipPillVariants> {
  /** Optional icon shown before children */
  leftIcon?: IconName;
  /** Selected state — sets data-state="active" for data-active: variant */
  selected?: boolean;
  /** Click handler (only meaningful when interactive=true) */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Label content (VN hardcode per C-08) */
  children: React.ReactNode;
}

export const ChipPill = React.forwardRef<HTMLDivElement, ChipPillProps>(
  (
    {
      variant,
      color,
      size,
      interactive,
      leftIcon,
      selected = false,
      onClick,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(chipPillVariants({ variant, color, size, interactive, className }))}
        data-state={selected ? 'active' : undefined}
        role={interactive ? 'button' : undefined}
        aria-pressed={interactive ? selected : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        {...props}
      >
        {leftIcon ? <Icon name={leftIcon} /> : null}
        <span>{children}</span>
      </div>
    );
  }
);
ChipPill.displayName = 'ChipPill';

export { chipPillVariants };
