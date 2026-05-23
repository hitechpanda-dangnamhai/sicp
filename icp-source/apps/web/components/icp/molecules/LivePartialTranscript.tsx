/**
 * LivePartialTranscript — Streaming STT partial-result card.
 *
 * Matches I02-state-A `.live-preview` mockup structure (lines 184-221):
 * - White 70% bg + backdrop-blur + dashed-feel border + 14px radius
 * - "Tạm hiểu" label with mic icon (10px upper)
 * - Italic 13px text with optional blinking cursor
 *
 * Single-intent per Rule 6 (I07/I02-A voice live STT signature, BACKLOG line 105).
 * SEMANTIC §4 line 249 confirms keep.
 *
 * Decisions applied:
 * - C-08/D-05 default label "Tạm hiểu" hardcoded VN
 * - C-15 SERVER — pure render (consumer updates text prop on each STT chunk)
 * - C-18 Tier 4 Tailwind utility inline — uses built-in animate-pulse for cursor
 *   (no new keyframe added to globals.css)
 */

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

export interface LivePartialTranscriptProps extends HTMLAttributes<HTMLDivElement> {
  /** REQUIRED — partial transcript text (updated on each STT chunk) */
  text: string;
  /** Label above transcript (default VN per D-05) */
  label?: string;
  /** Show blinking cursor after text (default true) */
  showCursor?: boolean;
  /** Icon name for label row (default 'mic') */
  icon?: IconName;
}

export function LivePartialTranscript({
  text,
  label = 'Tạm hiểu',
  showCursor = true,
  icon = 'mic',
  className,
  ...rest
}: LivePartialTranscriptProps) {
  return (
    <div
      className={cn(
        'w-full bg-white/70 backdrop-blur-sm border border-pink-200 rounded-2xl px-3.5 py-3 min-h-[60px]',
        className
      )}
      {...rest}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-pink-700 mb-1.5">
        <Icon name={icon} size={10} />
        {label}
      </div>
      <div className="text-[13px] text-rose-950 font-medium leading-[1.5] italic">
        {text}
        {showCursor && (
          <span
            className="inline-block w-0.5 h-3.5 bg-rose-500 align-middle ml-0.5 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
