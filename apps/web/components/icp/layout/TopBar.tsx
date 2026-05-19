/**
 * apps/web/components/icp/layout/TopBar.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives
 *
 * Status:   NEW.
 *
 * Purpose:  Top header for Family A I01/I02 chat-thread intents. Renders 36×36
 *           round back button (optional) + title + optional right-side action
 *           slot.
 *
 *           Per mockup intent-01-state-B-prefilled.html lines 64-90:
 *           - .top-bar: padding 4px 18px 12px, flex-shrink: 0
 *           - .top-row: flex items-center gap 12px mb 10px
 *           - .back-btn: 36×36, white bg, pink border, round, soft shadow
 *           - .top-title: 16px bold deep-maroon, flex: 1
 *
 * CSS strategy (per C-18 Tier 4):
 *   Tailwind utility classes inline. NO `.top-bar` class added to globals.css
 *   (lock per C-18 — components dùng Tailwind utility + CVA, NOT @layer
 *   components). Token consumption via Tailwind extend (text-icp-pink-800,
 *   border-icp-pink-200, etc.).
 *
 * Decisions applied:
 *   - C-07         — navigation-agnostic: onBack callback prop, no useRouter
 *   - C-08 / D-05  — VN strings: aria-label "Quay lại" hardcoded VN
 *   - C-15         — Client Component (has onClick event handler on back button)
 *   - C-18 Tier 4   — Tailwind utility inline, no globals.css extend
 *
 * Public API:
 *   <TopBar title="Phân tích sản phẩm" onBack={() => router.back()} action={<button>Lưu</button>}>
 */
'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface TopBarProps {
  /** Title text (VN per D-05). */
  title?: string;

  /** Back button callback. If omitted, back button not rendered. */
  onBack?: () => void;

  /** Optional right-side action slot (e.g., "Lưu" link or dropdown trigger). */
  action?: ReactNode;

  /** Optional consumer override for additional Tailwind classes. */
  className?: string;
}

export function TopBar({ title, onBack, action, className }: TopBarProps) {
  return (
    <div
      className={cn(
        // Per mockup .top-bar — padding 4px 18px 12px, flex-shrink: 0
        'px-[18px] pt-1 pb-3 flex-shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-3 mb-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className={cn(
              // Per mockup .back-btn — 36×36, white bg, pink border, round, soft shadow
              'w-9 h-9 rounded-full flex items-center justify-center',
              'bg-white border-[0.5px] border-icp-pink-200',
              'shadow-[0_2px_8px_rgba(233,30,99,0.1)]',
              'transition-transform active:scale-95',
            )}
          >
            <Icon name="chevron-left" className="w-3.5 h-3.5 text-icp-pink-800" />
          </button>
        )}
        {title && (
          <h1 className="flex-1 text-base font-bold text-icp-pink-800 tracking-tight truncate">
            {title}
          </h1>
        )}
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
