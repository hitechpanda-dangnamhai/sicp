/**
 * PhasesCard — Process indicator with 4 phase rows (done/active/pending).
 * Resolves C-04 phase naming convention divergence:
 * - mode='list' for I01-A `.phases-list` (white card 18px radius, 36×36 icon, 12px gap)
 * - mode='card' for I07 (with .phases-header slot icon+title+subtitle, 28×28 compact icon)
 *
 * SEMANTIC §2 merge group 3: 15 source classes (.phase-*, .phases-*) merged
 * via mode prop. Internal class names normalized to singular `.phase-*`.
 *
 * Decisions applied:
 * - C-04 phase naming normalize internally
 * - C-15 SERVER — pure render, no event handlers
 * - C-18 Tier 4 Tailwind utility inline + CVA — NO @layer components
 */

import type { HTMLAttributes } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon, Spinner } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

export interface PhaseItem {
  id: string;
  label: string;
  /** e.g. "Gemini Vision · 1.4s" (mono) */
  meta?: string;
  status: 'done' | 'active' | 'pending';
}

export interface PhasesCardProps extends HTMLAttributes<HTMLDivElement> {
  /** REQUIRED — 'list' (I01-A) or 'card' (I07) */
  mode: 'list' | 'card';
  /** REQUIRED — phase items array */
  phases: PhaseItem[];
  /** mode='card' only — header with icon + title + subtitle */
  header?: { icon?: IconName; title: string; subtitle?: string };
}

const phaseRowVariants = cva(
  'flex items-center gap-3 rounded-xl transition-all',
  {
    variants: {
      mode: {
        list: 'p-3',
        card: 'p-2',
      },
      status: {
        done: '',
        active:
          'bg-gradient-to-br from-pink-50 to-amber-50 shadow-[0_4px_12px_rgba(233,30,99,0.12)]',
        pending: '',
      },
    },
    defaultVariants: { mode: 'list', status: 'done' },
  }
);

const phaseIconVariants = cva(
  'flex items-center justify-center flex-shrink-0 rounded-xl',
  {
    variants: {
      mode: { list: 'w-9 h-9', card: 'w-7 h-7' },
      status: {
        done: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_3px_8px_rgba(16,185,129,0.3)]',
        active:
          'bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-[0_3px_10px_rgba(233,30,99,0.4)]',
        pending: 'bg-pink-100 text-pink-300',
      },
    },
    defaultVariants: { mode: 'list', status: 'done' },
  }
);

const phaseStatusBadgeVariants = cva(
  'text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 flex-shrink-0',
  {
    variants: {
      status: {
        done: 'bg-emerald-500/12 text-emerald-700',
        active:
          'bg-gradient-to-br from-rose-500 to-orange-400 text-white',
        pending: 'bg-pink-100 text-pink-300',
      },
    },
    defaultVariants: { status: 'done' },
  }
);

const statusLabel: Record<PhaseItem['status'], string> = {
  done: 'XONG',
  active: 'ĐANG',
  pending: 'CHỜ',
};

export function PhasesCard({ mode, phases, header, className, ...rest }: PhasesCardProps) {
  const wrapperClass =
    mode === 'list'
      ? 'w-full bg-white border border-pink-200 rounded-[18px] p-1.5 shadow-[0_8px_22px_rgba(233,30,99,0.1)]'
      : 'w-full bg-white border border-pink-200 rounded-2xl p-3.5 shadow-[0_4px_12px_rgba(233,30,99,0.08)]';

  return (
    <div className={cn(wrapperClass, className)} {...rest}>
      {mode === 'card' && header && (
        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-pink-100">
          {header.icon && (
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center flex-shrink-0">
              <Icon name={header.icon} className="text-pink-700" size={14} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-rose-950 leading-tight">
              {header.title}
            </div>
            {header.subtitle && (
              <div className="text-[10px] text-pink-700 font-medium mt-0.5">
                {header.subtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {phases.map((phase) => (
        <div
          key={phase.id}
          className={phaseRowVariants({ mode, status: phase.status })}
        >
          <div className={phaseIconVariants({ mode, status: phase.status })}>
            {phase.status === 'done' && (
              <Icon name="check" size={mode === 'list' ? 18 : 14} className="text-white" />
            )}
            {phase.status === 'active' && (
              <Spinner size={mode === 'list' ? 'md' : 'sm'} color="white" />
            )}
            {phase.status === 'pending' && (
              <Icon name="clock" size={mode === 'list' ? 18 : 14} className="text-pink-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'text-[13px] font-semibold text-rose-950 mb-0.5',
                phase.status === 'pending' && 'text-pink-700 opacity-50'
              )}
            >
              {phase.label}
            </div>
            {phase.meta && (
              <div className="text-[10px] text-pink-700 font-mono font-semibold">
                {phase.meta}
              </div>
            )}
          </div>
          <span className={phaseStatusBadgeVariants({ status: phase.status })}>
            {statusLabel[phase.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
