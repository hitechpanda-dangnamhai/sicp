/**
 * ListTile — Dashboard list row tile.
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 212-291 (4 list tiles in white card)
 *
 * Pixel-fidelity per Rule 6:
 *   - 46×46 icon box gradient + 22px colored icon + 13px radius
 *   - title 14px font-weight 600 + optional inline "AI" badge
 *   - chip row below title (1-2 small chips + optional plain text)
 *   - chevron-right action box top-right (32×32, matching icon-box gradient)
 *   - optional cart badge top-right of icon-box (orange gradient, white border)
 *
 * **4 accent variants** (mockup-derived):
 *   - 'pink'   (List #1 "Tìm sản phẩm"): pink/rose gradient
 *   - 'orange' (List #2 "Mua hàng"): orange/amber gradient
 *   - 'rose'   (List #3 "Gợi ý sản phẩm"): rose/red gradient + AI inline badge
 *   - 'fuchsia'(List #4 "Giỏ hàng"): fuchsia/pink gradient + cart count badge
 *
 * Click emits `nav.tile_clicked` event + navigates per R1 mapping — wiring at
 * consumer level (S-03 D-11 + C-23).
 *
 * CLIENT component per C-15 (onClick handler).
 *
 * Per S-03 DM-13 + D-11 + C-23 R1.
 */

'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

const listTileVariants = cva(
  'w-full bg-transparent border-none flex items-center gap-3 p-3 rounded-[14px] text-left',
);

export type ListTileAccent = 'pink' | 'orange' | 'rose' | 'fuchsia';

export interface ListTileChip {
  /** Chip text (e.g. "Gõ hoặc nói", "Cho khách") */
  text: string;
  /** Text color class (Tailwind, e.g. "text-pink-700") */
  textColor?: string;
  /** Background class (Tailwind, e.g. "bg-pink-100") */
  bgColor?: string;
}

export interface ListTileProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof listTileVariants> {
  /** REQUIRED — icon name (must exist in icon-map.ts) */
  iconName: IconName;
  /** REQUIRED — visual accent variant */
  accent: ListTileAccent;
  /** REQUIRED — tile title (e.g. "Tìm sản phẩm") */
  title: string;
  /** Optional inline AI badge next to title */
  badgeInline?: 'ai';
  /** Optional chips below title (max 2 chips + optional plain text via children) */
  chips?: ListTileChip[];
  /** Optional plain text after chips (e.g. "50+ mặt hàng", "→ 10 gợi ý") */
  trailingText?: string;
  /** Optional count badge top-right of icon-box (e.g. cart count "3") */
  countBadge?: number;
  /** Optional inline mono-font value (cart shows "100.000 ₫" instead of chip) */
  monoValue?: string;
  /** Optional mono-value suffix (e.g. "· 3 món") */
  monoSuffix?: string;
}

const ICON_BOX_CLASSES: Record<ListTileAccent, string> = {
  pink: 'bg-gradient-to-br from-pink-100 to-pink-200 shadow-[0_6px_14px_rgba(236,72,153,0.18)]',
  orange:
    'bg-gradient-to-br from-orange-100 to-orange-200 shadow-[0_6px_14px_rgba(251,146,60,0.22)]',
  rose: 'bg-gradient-to-br from-rose-100 to-rose-200 shadow-[0_6px_14px_rgba(244,63,94,0.22)]',
  fuchsia:
    'bg-gradient-to-br from-pink-200 to-pink-300 shadow-[0_6px_14px_rgba(236,72,153,0.28)]',
};

const ICON_COLOR: Record<ListTileAccent, string> = {
  pink: 'text-pink-700',
  orange: 'text-orange-700',
  rose: 'text-rose-700',
  fuchsia: 'text-rose-800',
};

const CHEVRON_BOX: Record<ListTileAccent, string> = {
  pink: 'bg-gradient-to-br from-pink-100 to-pink-200',
  orange: 'bg-gradient-to-br from-orange-100 to-orange-200',
  rose: 'bg-gradient-to-br from-rose-100 to-rose-200',
  fuchsia: 'bg-gradient-to-br from-pink-200 to-pink-300',
};

const CHEVRON_COLOR: Record<ListTileAccent, string> = {
  pink: 'text-pink-700',
  orange: 'text-orange-700',
  rose: 'text-rose-700',
  fuchsia: 'text-rose-800',
};

export const ListTile = forwardRef<HTMLButtonElement, ListTileProps>(function ListTile(
  {
    iconName,
    accent,
    title,
    badgeInline,
    chips,
    trailingText,
    countBadge,
    monoValue,
    monoSuffix,
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(listTileVariants(), className)}
      {...rest}
    >
      {/* Icon box (with optional count badge overlay) */}
      <span
        className={cn(
          'w-[46px] h-[46px] rounded-[13px] flex items-center justify-center flex-shrink-0 relative',
          ICON_BOX_CLASSES[accent],
        )}
      >
        <Icon name={iconName} size={22} className={ICON_COLOR[accent]} />
        {countBadge != null && countBadge > 0 && (
          <span
            className={cn(
              'absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full',
              'bg-gradient-to-br from-orange-500 to-orange-600 text-white text-[11px] font-bold',
              'flex items-center justify-center border-2 border-white',
              'shadow-[0_4px_10px_rgba(234,88,12,0.4)]',
            )}
            aria-label={`${countBadge} items`}
          >
            {countBadge}
          </span>
        )}
      </span>

      {/* Body — title + chips */}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-rose-900 font-semibold tracking-[-0.1px] mb-[3px] flex items-center gap-1.5">
          {title}
          {badgeInline === 'ai' && (
            <span className="text-[9px] bg-gradient-to-br from-pink-500 to-orange-400 text-white px-1.5 py-0.5 rounded-md font-bold tracking-[0.3px]">
              AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips?.map((chip, i) => (
            <span
              key={i}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
                chip.textColor ?? 'text-pink-700',
                chip.bgColor ?? 'bg-pink-100',
              )}
            >
              {chip.text}
            </span>
          ))}
          {monoValue && (
            <span className="text-[11px] text-rose-700 font-bold font-[var(--font-jetbrains-mono)]">
              {monoValue}
            </span>
          )}
          {(trailingText || monoSuffix) && (
            <span className="text-[10px] text-rose-800">
              {trailingText ?? monoSuffix}
            </span>
          )}
        </div>
      </div>

      {/* Chevron box */}
      <span
        className={cn(
          'w-8 h-8 rounded-[11px] flex items-center justify-center flex-shrink-0',
          CHEVRON_BOX[accent],
        )}
      >
        <Icon name="chevron-right" size={15} className={CHEVRON_COLOR[accent]} />
      </span>
    </button>
  );
});
