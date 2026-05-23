/**
 * DashboardHeader — Home Dashboard header row.
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 63-80
 *
 * Structure (left → right):
 *   - 36×36 ICP brand logo (gradient pink→fuchsia + sparkles icon)
 *   - 2-line text block: "ICP" 14px + "Trợ lý kinh doanh thông minh" 10px
 *   - 36×36 bell button (decorative, with orange notify dot per D-07)
 *   - 36×36 avatar circle (dynamic initials from `/auth/me` `avatar_initials` field per D-06)
 *
 * Per S-03 D-06 (MAR-1 Q1 RESOLVED Phiên 34) — avatar dynamic per user.display_name:
 *   - Consumer passes `initials` prop (computed by `useMe()` hook Batch 5)
 *   - This component is presentational + props-driven (NO direct fetch call)
 *
 * Per S-03 D-07 (MAR-1 Q2 RESOLVED Phiên 34) — bell decorative-only:
 *   - No `onBellClick` handler exposed
 *   - Notify dot hardcoded visible (defer to future notification slice)
 *
 * CLIENT component per C-15 — `'use client'` for consistent React tree when
 * consumer page wires interactive children (no event handlers in this component,
 * but parent page.tsx will be client-y for `useMe()` hook).
 *
 * Per S-03 D-06 + D-07 + DM-13.
 */

'use client';

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface DashboardHeaderProps {
  /** REQUIRED — user initials (1-2 chars, e.g. "AN") from `/auth/me` response */
  initials: string;
  /** Optional consumer override for additional Tailwind classes. */
  className?: string;
}

export function DashboardHeader({ initials, className }: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        'px-[18px] pt-3.5 flex items-center justify-between',
        className,
      )}
    >
      {/* Left — brand block */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-9 h-9 rounded-[11px] flex items-center justify-center',
            'bg-gradient-to-br from-pink-600 to-pink-500',
            'shadow-[0_6px_14px_rgba(233,30,99,0.35)]',
          )}
        >
          <Icon name="sparkles" size={19} className="text-white" />
        </span>
        <div>
          <div className="text-[14px] text-rose-900 font-bold tracking-[-0.2px]">
            ICP
          </div>
          <div className="text-[10px] text-pink-700 font-medium">
            Trợ lý kinh doanh thông minh
          </div>
        </div>
      </div>

      {/* Right — bell decorative + avatar */}
      <div className="flex gap-2 items-center">
        <span
          aria-label="Thông báo"
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center relative',
            'bg-white border-[0.5px] border-pink-200',
            'shadow-[0_2px_8px_rgba(233,30,99,0.1)]',
          )}
        >
          <Icon name="bell" size={17} className="text-pink-700" />
          {/* Notify dot decorative per D-07 */}
          <span
            aria-hidden="true"
            className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-orange-500 border-[1.5px] border-white"
          />
        </span>
        <span
          aria-label="Tài khoản"
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-orange-400 to-orange-600',
            'text-[12px] text-white font-medium',
            'shadow-[0_4px_10px_rgba(234,88,12,0.25)]',
          )}
        >
          {initials}
        </span>
      </div>
    </div>
  );
}
