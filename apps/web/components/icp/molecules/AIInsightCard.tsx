/**
 * AIInsightCard — AI insight banner / reasoning block.
 *
 * 2 variants per Q5 Option C (mockup evidence I01-B + I01-H):
 * - 'default' (I01-B .ai-insight lines 689-720): rose+amber gradient banner,
 *   32×32 brain icon left + text right (inline use case)
 * - 'reasoning' (I01-H .ai-reasoning* lines 252-289): white→mint gradient block
 *   with mint-500 left-border 3px + 26×26 mint avatar + "🤖 Aida nhận định"
 *   upper tag (structured reasoning use case)
 *
 * BACKLOG alias <HeroInsightCard> = this component (SEMANTIC §6 line 365).
 *
 * Decisions applied:
 * - C-08/D-05 default reasoning tag "🤖 Aida nhận định" hardcoded VN
 * - C-13 Omit 'color' defensive (variant indirectly drives palette)
 * - C-15 SERVER — pure render, no event handlers
 * - C-18 Tier 4 Tailwind utility inline
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { BrainIcon } from '@/components/icp/atoms';

const aiInsightCardVariants = cva('rounded-2xl px-3 py-2.5', {
  variants: {
    variant: {
      default:
        'bg-gradient-to-br from-rose-100 to-amber-100 border-[0.5px] border-pink-700/20',
      reasoning:
        'bg-gradient-to-br from-white to-emerald-50 border-[0.5px] border-emerald-200 border-l-[3px] border-l-emerald-500 px-3.5 py-3.5 shadow-[0_4px_12px_rgba(16,185,129,0.1)]',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type AIInsightCardVariant = NonNullable<VariantProps<typeof aiInsightCardVariants>['variant']>;

export interface AIInsightCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof aiInsightCardVariants> {
  /** REQUIRED — insight text (supports inline <strong>) */
  text: string | ReactNode;
  /** variant='reasoning' only — upper tag label, default "🤖 Aida nhận định" */
  tag?: string;
  /** Avatar override — defaults vary by variant */
  avatar?: ReactNode;
}

export const AIInsightCard = forwardRef<HTMLDivElement, AIInsightCardProps>(
  function AIInsightCard(
    { variant = 'default', text, tag = '🤖 Aida nhận định', avatar, className, ...rest },
    ref
  ) {
    if (variant === 'reasoning') {
      const defaultAvatar = (
        <span className="w-[26px] h-[26px] rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
          <BrainIcon size="sm" className="text-white" />
        </span>
      );

      return (
        <div
          ref={ref}
          className={cn(aiInsightCardVariants({ variant }), className)}
          {...rest}
        >
          <div className="flex items-center gap-2 mb-2">
            {avatar ?? defaultAvatar}
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-900">
              {tag}
            </span>
          </div>
          <div className="text-[12px] text-emerald-900 leading-[1.55] font-medium [&_strong]:text-emerald-700 [&_strong]:font-bold">
            {text}
          </div>
        </div>
      );
    }

    // variant === 'default'
    const defaultAvatar = (
      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(233,30,99,0.3)]">
        <BrainIcon size="sm" className="text-white" />
      </span>
    );

    return (
      <div
        ref={ref}
        className={cn(
          aiInsightCardVariants({ variant }),
          'flex items-center gap-2.5',
          className
        )}
        {...rest}
      >
        {avatar ?? defaultAvatar}
        <div className="text-[12px] text-rose-950 font-medium leading-[1.4] flex-1 [&_strong]:text-pink-700 [&_strong]:font-bold">
          {text}
        </div>
      </div>
    );
  }
);
