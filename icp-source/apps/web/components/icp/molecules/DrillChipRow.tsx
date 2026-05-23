'use client';

/**
 * DrillChipRow — Horizontal scroll row of drill-down chips.
 *
 * I07-only per Rule 6 (analytics drill-down wow signature, BACKLOG line 105,
 * SEMANTIC §3.2 special chip extension + §4 line 248).
 *
 * Wraps T02 atom <ChipPill> × N. Sticky behavior is consumer concern
 * (wrap in sticky container if needed; T04 just provides the row).
 *
 * Mockup: I07 lines 622-629 (.drill-chips row + .drill-chip + .drill-chip.active)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onSelect emits chip id, caller routes
 * - C-15 'use client' (onClick handlers per chip)
 * - C-18 Tier 4 Tailwind utility inline — uses scrollbar-hide via arbitrary class
 *   (Tailwind has no built-in; add `[&::-webkit-scrollbar]:hidden`)
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DrillChip {
  id: string;
  label: string;
  active?: boolean;
  /** Optional icon/prefix shown before label */
  prefix?: ReactNode;
}

export interface DrillChipRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** REQUIRED — chip items */
  chips: DrillChip[];
  /** Callback fired with selected chip id (C-07 navigation-agnostic). Omit 'onSelect' from HTMLAttributes to allow (id: string) signature instead of ReactEventHandler. */
  onSelect?: (id: string) => void;
}

export function DrillChipRow({ chips, onSelect, className, ...rest }: DrillChipRowProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-hide pb-1',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        className
      )}
      role="tablist"
      {...rest}
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          role="tab"
          aria-selected={chip.active ?? false}
          onClick={() => onSelect?.(chip.id)}
          className={cn(
            'flex-shrink-0 inline-flex items-center gap-1.5',
            'rounded-lg px-3 py-1.5 text-[11px] font-semibold',
            'transition-all',
            'border-[0.5px]',
            chip.active
              ? 'bg-gradient-to-br from-rose-500 to-orange-400 text-white border-transparent shadow-[0_3px_8px_rgba(233,30,99,0.3)]'
              : 'bg-white text-pink-700 border-pink-200 hover:bg-pink-50'
          )}
        >
          {chip.prefix && <span className="flex-shrink-0">{chip.prefix}</span>}
          {chip.label}
        </button>
      ))}
    </div>
  );
}
