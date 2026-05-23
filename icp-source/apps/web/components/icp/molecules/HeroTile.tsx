/**
 * HeroTile — Dashboard hero tile (large, 158px min-height).
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 163-209 (2 hero tiles)
 *
 * Pixel-fidelity per Rule 6:
 *   - rounded-[20px] + soft gradient bg + 0.5px border + colored shadow
 *   - 46×46 icon box gradient + 22px white icon
 *   - badge top-right (HOT pink/orange gradient OR AI pink gradient)
 *   - title 15px bold + subtitle 11px
 *   - footer slot (chip / sparkline) optional
 *   - 2 decorative radial glow overlays (top-right + bottom-left)
 *
 * **2 accent variants** (mockup-derived):
 *   - 'pink' (Hero #1 "Nhập hàng"): pink/rose gradient + rose icon box + HOT-style badge
 *   - 'orange' (Hero #2 "Phân tích"): orange/amber gradient + orange icon box + AI-style badge
 *
 * Click emits `nav.tile_clicked` event + navigates per R1 mapping (S-03 D-11
 * + C-23 LOCKED) — wiring done at consumer level (`app/home/page.tsx` Batch 5),
 * NOT here. This component is presentational + callback (C-07 navigation-agnostic).
 *
 * CLIENT component per C-15 (onClick handler).
 *
 * Per S-03 DM-13 + D-11 + C-23 R1.
 */

'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

const heroTileVariants = cva(
  'relative overflow-hidden rounded-[20px] p-3.5 text-left min-h-[158px] flex flex-col justify-between border-[0.5px]',
  {
    variants: {
      accent: {
        pink: 'bg-gradient-to-br from-white to-pink-50 border-pink-200 shadow-[0_8px_22px_rgba(233,30,99,0.1)]',
        orange:
          'bg-gradient-to-br from-white to-orange-50 border-orange-200 shadow-[0_8px_22px_rgba(234,88,12,0.08)]',
      },
    },
    defaultVariants: { accent: 'pink' },
  },
);

export type HeroTileAccent = NonNullable<VariantProps<typeof heroTileVariants>['accent']>;
export type HeroTileBadgeKind = 'hot' | 'ai';

export interface HeroTileProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof heroTileVariants> {
  /** REQUIRED — icon name (must exist in icon-map.ts) */
  iconName: IconName;
  /** REQUIRED — tile title (e.g. "Nhập hàng") */
  title: string;
  /** REQUIRED — tile subtitle (e.g. "Chụp ảnh là có ngay") */
  subtitle: string;
  /** Optional badge top-right — "HOT" (orange) or "AI" (pink) */
  badge?: HeroTileBadgeKind;
  /** Optional footer slot (chip row / sparkline / etc) below subtitle */
  footerSlot?: ReactNode;
}

const ICON_BOX_CLASSES: Record<HeroTileAccent, string> = {
  pink: 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-[0_8px_18px_rgba(244,63,94,0.4)]',
  orange:
    'bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_8px_18px_rgba(234,88,12,0.4)]',
};

const TITLE_COLOR: Record<HeroTileAccent, string> = {
  pink: 'text-rose-900',
  orange: 'text-orange-900',
};

const SUBTITLE_COLOR: Record<HeroTileAccent, string> = {
  pink: 'text-pink-700',
  orange: 'text-orange-700',
};

const BADGE_CLASSES: Record<HeroTileBadgeKind, string> = {
  hot: 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_4px_10px_rgba(234,88,12,0.3)]',
  ai: 'bg-gradient-to-br from-pink-500 to-pink-700 shadow-[0_4px_10px_rgba(190,24,93,0.3)]',
};

const GLOW_OVERLAY: Record<HeroTileAccent, { topRight: string; bottomLeft: string }> = {
  pink: {
    topRight: 'bg-[radial-gradient(circle,rgba(244,63,94,0.2),transparent_65%)]',
    bottomLeft: 'bg-[radial-gradient(circle,rgba(251,146,60,0.12),transparent_70%)]',
  },
  orange: {
    topRight: 'bg-[radial-gradient(circle,rgba(251,146,60,0.22),transparent_65%)]',
    bottomLeft: 'bg-[radial-gradient(circle,rgba(233,30,99,0.1),transparent_70%)]',
  },
};

export const HeroTile = forwardRef<HTMLButtonElement, HeroTileProps>(function HeroTile(
  { accent = 'pink', iconName, title, subtitle, badge, footerSlot, className, ...rest },
  ref,
) {
  const safeAccent: HeroTileAccent = accent ?? 'pink';
  return (
    <button
      ref={ref}
      type="button"
      className={cn(heroTileVariants({ accent: safeAccent }), className)}
      {...rest}
    >
      {/* Decorative radial glow overlays per mockup */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute -top-7 -right-7 w-[120px] h-[120px] rounded-full pointer-events-none',
          GLOW_OVERLAY[safeAccent].topRight,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-6 -left-5 w-[80px] h-[80px] rounded-full pointer-events-none',
          GLOW_OVERLAY[safeAccent].bottomLeft,
        )}
      />

      {/* Top row — icon box + optional badge */}
      <div className="relative flex items-start justify-between">
        <span
          className={cn(
            'w-[46px] h-[46px] rounded-[14px] flex items-center justify-center',
            ICON_BOX_CLASSES[safeAccent],
          )}
        >
          <Icon name={iconName} size={22} className="text-white" />
        </span>
        {badge && (
          <span
            className={cn(
              'text-[9px] text-white px-2.5 py-[3px] rounded-lg font-bold tracking-[0.3px]',
              BADGE_CLASSES[badge],
            )}
          >
            {badge.toUpperCase()}
          </span>
        )}
      </div>

      {/* Bottom — title + subtitle + footerSlot */}
      <div className="relative">
        <div
          className={cn(
            'text-[15px] font-bold tracking-[-0.2px] mb-[3px]',
            TITLE_COLOR[safeAccent],
          )}
        >
          {title}
        </div>
        <div className={cn('text-[11px] leading-[1.4]', SUBTITLE_COLOR[safeAccent])}>
          {subtitle}
        </div>
        {footerSlot && <div className="mt-2.5">{footerSlot}</div>}
      </div>
    </button>
  );
});
