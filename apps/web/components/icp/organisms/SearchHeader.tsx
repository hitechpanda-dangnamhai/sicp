'use client';

/**
 * apps/web/components/icp/organisms/SearchHeader.tsx
 *
 * Organism: <SearchHeader> — Intent 03 page header (back btn + title block + bell + avatar)
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T05 FE Page Wire (Phiên Sx04-10) — NEW organism
 *
 * Source:   docs/mockups/intent-03/intent-03B-state-0-happy.html lines 115-136 verbatim
 *           Verified 5/5 mockup states (03B-state-0/A/B/C/D/E/F all share identical header).
 *
 * Decisions applied:
 * - D-S04-01 LAW: Back button → router.push('/home') per S-03 D-28 precedent (parent owns nav).
 * - D-S04-04 LAW: Avatar dynamic initials from useMe() — parent passes initials prop.
 * - C-S04-I scope extension (Phiên Sx04-9b MAR-1 #2 LOCKED): PHASE_02 §E EXCEPTION
 *   amendment "feature-specific molecules + organisms" — SearchHeader legal as V-SLICE
 *   feature-specific organism (mockup directly evidences this composition; Rule 6 priority 1).
 * - C-15 'use client' for onBack/onProfileClick event handlers.
 * - C-23 atom bypass: 36×36 back button + bell are inline mockup-verbatim micro UI per
 *                     S-01 DashboardHeader precedent (no wrapper atom needed).
 *
 * Pattern inheritance: DashboardHeader (S-03 T03b) — props-driven presentational.
 * Distribution: CLIENT per C-15 (has onBack + onProfileClick handlers).
 */

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface SearchHeaderProps {
  /** REQUIRED — user initials (1-2 chars) from useMe() `avatar_initials` field. */
  initials: string;
  /** Back button callback. Typically `() => router.push('/home')` per D-S04-01.
   *  When undefined, back button is hidden (backward-compat). */
  onBack?: () => void;
  /** Avatar click callback. Typically `() => router.push('/me')` per D-S04-04.
   *  When undefined, avatar renders non-interactive. */
  onProfileClick?: () => void;
  /** Optional Tailwind className override. */
  className?: string;
}

export function SearchHeader({
  initials,
  onBack,
  onProfileClick,
  className,
}: SearchHeaderProps) {
  return (
    <div
      className={cn(
        // mockup line 116: padding:14px 18px 0; flex; justify-between; flex-shrink-0
        'px-[18px] pt-3.5 flex items-center justify-between flex-shrink-0',
        className,
      )}
    >
      {/* ─── Left: back btn + title block ────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center',
              'bg-white border-[0.5px] border-pink-200 text-pink-700',
              'shadow-[0_2px_8px_rgba(233,30,99,0.1)]',
              'transition-all active:scale-[0.95]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {/* mockup line 119: arrow-right rotated 180deg → looks like left arrow */}
            <Icon name="arrow-right" size={16} className="rotate-180" />
          </button>
        )}
        <div>
          <div className="text-[14px] text-rose-900 font-bold tracking-[-0.2px]">
            Tìm sản phẩm
          </div>
          <div className="text-[10px] text-pink-700 font-medium flex items-center gap-1">
            {/* mockup line 124: pulse-dot 5×5 green */}
            <span
              aria-hidden="true"
              className="w-[5px] h-[5px] bg-emerald-500 rounded-full"
            />
            AI hiểu ý anh
          </div>
        </div>
      </div>

      {/* ─── Right: bell decorative + avatar ─────────────────────────────── */}
      <div className="flex gap-2 items-center">
        {/* Bell decorative per D-07 (S-03 inheritance — no onBellClick handler) */}
        <span
          aria-label="Thông báo"
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center relative',
            'bg-white border-[0.5px] border-pink-200',
            'shadow-[0_2px_8px_rgba(233,30,99,0.1)]',
          )}
        >
          <Icon name="bell" size={17} className="text-pink-700" />
          {/* mockup line 132: notify dot orange */}
          <span
            aria-hidden="true"
            className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-orange-500 border-[1.5px] border-white"
          />
        </span>

        {/* Avatar — clickable when onProfileClick provided (D-S04-04 LAW) */}
        {onProfileClick ? (
          <button
            type="button"
            onClick={onProfileClick}
            aria-label="Mở hồ sơ tài khoản"
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center',
              'bg-gradient-to-br from-orange-400 to-orange-600',
              'text-[12px] text-white font-medium',
              'shadow-[0_4px_10px_rgba(234,88,12,0.25)]',
              'cursor-pointer transition-all active:scale-[0.95]',
              'hover:shadow-[0_6px_14px_rgba(234,88,12,0.32)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {initials}
          </button>
        ) : (
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
        )}
      </div>
    </div>
  );
}
