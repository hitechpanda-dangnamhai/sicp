/**
 * apps/web/components/icp/layout/AppHeader.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives
 *
 * Status:   NEW.
 *
 * Purpose:  App-style header for I07 analytics intent (Family A). Renders 36×36
 *           round back button + title block (title + optional subtitle with
 *           optional live-pulse dot indicator) + 36×36 right action icon button.
 *
 *           Per mockup intent-07-state-C-chart-line.html lines 78-125 + lines
 *           459-475:
 *           - .app-header: padding 4px 18px 12px, flex justify-between, flex-shrink: 0
 *           - .header-left: flex items-center gap 10px
 *           - .back-btn: 36×36, white/0.8 bg, pink border, round
 *           - .header-title: column layout, main 15px bold + sub 10.5px muted
 *           - .live-dot: 6×6 green circle with glow ring + animate-pulse (1.6s)
 *           - .header-icon-btn: 36×36, white/0.7 bg, pink border, 12px radius
 *
 * Note Family A clarification: SEMANTIC_COMPONENTS dòng 176 lists `.app-header`
 *   as "Family B I07 children" which is a TYPO — I07 is Family A (AI Chat
 *   Thread family per BRIEF Section 1). Surface this typo in T03 REPORT Rule 7
 *   "Bonus — Conflicts Surfaced" — defer maintainer Phase 3 batch (do NOT
 *   modify SEMANTIC report in execution per Rule 7).
 *
 * CSS strategy (per C-18 Tier 4):
 *   Tailwind utility classes inline. NO `.app-header` class added to globals.css.
 *   Live-dot animation: Tailwind `animate-pulse` built-in (~95% match to mockup
 *   livePulse keyframe — opacity 1→0.5 at 1.5s vs mockup 1→0.5 at 1.6s; visual
 *   equivalence). Does NOT add new keyframe per T01 "26 bespoke I07 keyframes
 *   defer T06" + C-18 Tier 3 lock.
 *
 * Decisions applied:
 *   - C-07         — navigation-agnostic: onBack + onAction callback props
 *   - C-08 / D-05  — VN strings: aria-labels + default subtitle hardcoded VN
 *   - C-15         — Client Component (has onClick event handlers on back +
 *                    action buttons)
 *   - C-18 Tier 3   — animate-pulse Tailwind built-in (NO new keyframe)
 *   - C-18 Tier 4   — Tailwind utility inline, no globals.css extend
 *
 * Public API:
 *   <AppHeader
 *     title="Phân tích kinh doanh"
 *     subtitle="Aida đang trợ giúp · cập nhật real-time"
 *     live
 *     onBack={() => router.back()}
 *     onAction={() => openMenu()}
 *     actionIcon="more-vertical"
 *   />
 */
'use client';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import { type IconName } from '@/lib/icon-map';

export interface AppHeaderProps {
  /** Main title text (VN per D-05). */
  title: string;

  /** Optional subtitle text below title. */
  subtitle?: string;

  /**
   * When true, renders live-pulse green dot before subtitle text.
   * Use for "đang trợ giúp · cập nhật real-time" type indicators.
   */
  live?: boolean;

  /** Back button callback. If omitted, back button not rendered. */
  onBack?: () => void;

  /** Right action icon callback. If omitted, action icon not rendered. */
  onAction?: () => void;

  /** Right action icon name (lucide-react via icon-map). Default: "more-vertical". */
  actionIcon?: IconName;

  /** Optional consumer override for additional Tailwind classes. */
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  live = false,
  onBack,
  onAction,
  actionIcon = 'more-vertical',
  className,
}: AppHeaderProps) {
  return (
    <div
      className={cn(
        // Per mockup .app-header — padding 4px 18px 12px, flex justify-between
        'px-[18px] pt-1 pb-3 flex items-center justify-between flex-shrink-0',
        className,
      )}
    >
      {/* Header left: back-btn + title block */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className={cn(
              // Per mockup .back-btn (I07 variant) — 36×36, white/0.8 bg
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-white/80 border-[0.5px] border-icp-border-pink',
              'transition-transform active:scale-95',
            )}
          >
            <Icon name="chevron-left" className="w-3.5 h-3.5 text-icp-pink-800" />
          </button>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-bold leading-[1.1] text-icp-text-primary truncate">
            {title}
          </span>
          {subtitle && (
            <span className="flex items-center gap-1 mt-0.5 text-[10.5px] text-icp-text-muted">
              {live && (
                <span
                  aria-hidden="true"
                  className={cn(
                    // Per mockup .live-dot — 6×6 green circle with glow ring
                    'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                    'bg-icp-green-500',
                    'shadow-[0_0_0_2px_rgba(16,185,129,0.2)]',
                    // Tailwind animate-pulse built-in (~95% match to mockup livePulse)
                    'animate-pulse',
                  )}
                />
              )}
              <span className="truncate">{subtitle}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right action icon button */}
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          aria-label="Tùy chọn"
          className={cn(
            // Per mockup .header-icon-btn — 36×36, white/0.7 bg, 12px radius
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ml-2',
            'bg-white/70 border-[0.5px] border-icp-border-pink',
            'transition-transform active:scale-95',
          )}
        >
          <Icon name={actionIcon} className="w-4 h-4 text-icp-pink-800" />
        </button>
      )}
    </div>
  );
}
