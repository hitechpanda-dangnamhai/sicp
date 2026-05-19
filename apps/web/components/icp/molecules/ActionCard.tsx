'use client';

/**
 * ActionCard — Suggestion/insight card with 7 variants and 5 slots.
 *
 * 23 .ac-* source classes merged per SEMANTIC §3.1. Compound API:
 * - ActionCard.Header — icon + title block + optional count badge
 * - ActionCard.Body — highlight text + detail rows + optional MiniChart slot
 * - ActionCard.Tags — <ChipPill> × N row
 * - ActionCard.Actions — <Button> × 1-2 row (apply + dismiss)
 *
 * Palette per ADR-01-10:
 * - stock-up → mint/green (Market RISING I01-C-rising)
 * - wait → amber (Market FALLING I01-C-falling)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — buttons receive onClick props from caller
 * - C-13 Omit 'color' defensive (variant indirectly drives palette)
 * - C-15 'use client' (children include Button clients)
 * - C-18 Tier 4 Tailwind utility + CVA only
 * - Stop AC-4-S1: monitor LOC, propose Root + variant split if > 300
 */

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

export const actionCardVariants = cva(
  'relative overflow-hidden rounded-2xl border p-3.5',
  {
    variants: {
      variant: {
        default: 'bg-white border-pink-200 shadow-[0_4px_12px_rgba(233,30,99,0.08)]',
        price:
          'bg-gradient-to-br from-white to-amber-50 border-amber-200 shadow-[0_6px_16px_rgba(251,146,60,0.15)]',
        attrs:
          'bg-gradient-to-br from-white to-pink-50 border-pink-200 shadow-[0_6px_16px_rgba(233,30,99,0.1)]',
        'stock-up':
          'bg-gradient-to-br from-white to-emerald-50 border-emerald-200 shadow-[0_6px_16px_rgba(16,185,129,0.12)]',
        wait:
          'bg-gradient-to-br from-white to-amber-50 border-amber-300 shadow-[0_6px_16px_rgba(245,158,11,0.18)]',
        alt: 'bg-gradient-to-br from-white to-pink-50 border-pink-100 shadow-sm',
        insight:
          'bg-gradient-to-br from-white via-rose-50 to-amber-50 border-pink-200 shadow-[0_6px_16px_rgba(233,30,99,0.1)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export type ActionCardVariant = NonNullable<VariantProps<typeof actionCardVariants>['variant']>;

export interface ActionCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof actionCardVariants> {
  children: ReactNode;
}

const Root = forwardRef<HTMLDivElement, ActionCardProps>(function ActionCardRoot(
  { variant = 'default', children, className, ...rest },
  ref
) {
  return (
    <div ref={ref} className={cn(actionCardVariants({ variant }), className)} {...rest}>
      {children}
    </div>
  );
});

interface ActionCardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  title: string;
  subtitle?: string;
  count?: number;
}

function Header({ icon, title, subtitle, count, className, ...rest }: ActionCardHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 mb-3', className)} {...rest}>
      {icon && (
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 text-white flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(233,30,99,0.3)]">
          <Icon name={icon} size={18} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-rose-950 leading-tight">{title}</div>
        {subtitle && (
          <div className="text-[10.5px] text-pink-700 font-medium mt-0.5">{subtitle}</div>
        )}
      </div>
      {typeof count === 'number' && (
        <span className="text-[10px] font-bold bg-pink-100 text-pink-700 rounded-full px-2 py-0.5 flex-shrink-0">
          {count}
        </span>
      )}
    </div>
  );
}

interface ActionCardBodyProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: ReactNode;
  miniChart?: ReactNode;
  miniChartLabel?: string;
}

function Body({ highlight, miniChart, miniChartLabel, children, className, ...rest }: ActionCardBodyProps) {
  return (
    <div className={cn('text-[12.5px] text-rose-950 leading-relaxed font-medium space-y-2', className)} {...rest}>
      {highlight && (
        <div className="text-[13px] font-semibold leading-snug">{highlight}</div>
      )}
      {children}
      {miniChart && (
        <div className="mt-2">
          {miniChartLabel && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-pink-700 mb-1">
              {miniChartLabel}
            </div>
          )}
          {miniChart}
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between text-[11.5px] py-1 border-b border-pink-100/50 last:border-b-0">
      <span className="text-pink-700 font-medium">{label}</span>
      <span className="text-rose-950 font-semibold font-mono">{value}</span>
    </div>
  );
}

function Tags({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-3', className)} {...rest}>
      {children}
    </div>
  );
}

function Actions({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex gap-2 mt-3 pt-3 border-t border-pink-100/60', className)} {...rest}>
      {children}
    </div>
  );
}

type ActionCardCompound = typeof Root & {
  Header: typeof Header;
  Body: typeof Body;
  DetailRow: typeof DetailRow;
  Tags: typeof Tags;
  Actions: typeof Actions;
};

export const ActionCard = Root as ActionCardCompound;
ActionCard.Header = Header;
ActionCard.Body = Body;
ActionCard.DetailRow = DetailRow;
ActionCard.Tags = Tags;
ActionCard.Actions = Actions;
