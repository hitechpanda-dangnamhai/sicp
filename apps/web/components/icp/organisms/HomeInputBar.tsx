/**
 * HomeInputBar — Dashboard hub bottom input bar.
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 293-305
 *
 * Structure:
 *   - Sparkles icon (pink 18px)
 *   - Input text field with placeholder "Hỏi tôi bất cứ điều gì..."
 *   - 36×36 camera button (pink/light bg)
 *   - 42×42 mic button (pink→orange gradient with glow shadow)
 *
 * Per S-03 D-12 (MAR-1 Q7 RESOLVED Phiên 34) — decorative-only:
 *   - `<input>` disabled (no typing)
 *   - Camera + mic buttons render visually only (no handlers)
 *   - Defer voice/text query flow to S-08 Voice Buy + S-04 Search V-SLICEs
 *
 * SERVER component per C-15 — pure render, no event handlers. No `'use client'`.
 *
 * Per S-03 D-12 + DM-13.
 */

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface HomeInputBarProps {
  /** Optional consumer override for additional Tailwind classes. */
  className?: string;
}

export function HomeInputBar({ className }: HomeInputBarProps) {
  return (
    <div className={cn('px-3.5 pt-3.5 pb-3', className)}>
      <div
        className={cn(
          'flex gap-2 items-center rounded-[30px] p-1.5 pl-[18px]',
          'bg-gradient-to-br from-white to-pink-50',
          'border-[0.5px] border-pink-200',
          'shadow-[0_10px_26px_rgba(233,30,99,0.15)]',
        )}
      >
        <Icon name="sparkles" size={18} className="text-pink-600 flex-shrink-0" />
        <input
          disabled
          placeholder="Hỏi tôi bất cứ điều gì..."
          aria-label="Hỏi tôi bất cứ điều gì"
          className={cn(
            'flex-1 bg-transparent border-none text-[13px] outline-none',
            'text-rose-900 placeholder:text-rose-900/55',
            // Defensive disable styling — preserve mockup visual
            'disabled:cursor-default disabled:opacity-100',
          )}
        />
        <button
          type="button"
          aria-label="Chụp ảnh"
          tabIndex={-1}
          className={cn(
            'w-9 h-9 rounded-full bg-pink-100 border-none',
            'flex items-center justify-center text-pink-700',
          )}
        >
          <Icon name="camera" size={18} />
        </button>
        <button
          type="button"
          aria-label="Nói"
          tabIndex={-1}
          className={cn(
            'w-[42px] h-[42px] rounded-full border-none text-white',
            'flex items-center justify-center',
            'bg-gradient-to-br from-pink-600 via-rose-500 to-orange-400',
            'shadow-[0_10px_22px_rgba(233,30,99,0.5)]',
          )}
        >
          <Icon name="mic" size={20} />
        </button>
      </div>
    </div>
  );
}
