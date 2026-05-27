'use client';

/**
 * apps/web/components/icp/molecules/ProductCard.tsx
 *
 * Molecule: <ProductCard> — Family B product display card, 2 width variants
 *
 * Slice:    S-01 UI Foundation
 * Task:     T05 AC-1, AC-6 (dev preview)
 *
 * Source:   Family B mockup HTML (per C-03 structural inference + Tailwind translation rebuild):
 *           - intent-03/intent-03A-state-0-happy.html line 167-300 (width=138 carousel)
 *           - intent-04/intent-04-state-0-happy.html line 283-314 (width=172 grid)
 *
 * Reach:    I03 search results, I04 recommendations, I05 cart product summary
 *
 * Decisions applied:
 * - C-03 structural inference + C-23 atom bypass for micro-elements (28-30px
 *   add-button + 9-10px badge spans) — see decisions-log Section 3
 * - C-07 navigation-agnostic — onAdd callback, no useRouter
 * - C-13 Omit 'color' from HTMLAttributes (CVA may use color in compoundVariants)
 * - C-15 'use client' for onAdd event handler
 * - C-18 Tier 4 Tailwind utility inline + CVA (no @layer components classes added)
 * - C-22 atom interface verified DISCOVER (Button.tsx + ChipPill.tsx +
 *   icon-map.ts + atoms/index.ts inspected) — T05 bypasses Button/ChipPill
 *
 * Structure: 1 main component <ProductCard> + 3 PRIVATE helpers (NOT exported):
 *   - ProductImageSection — image wrapper + badges/confidence/cornerBadge/overlay-btn
 *   - ProductBodyCarousel — I03A 138 body (brand+name+price+rating row)
 *   - ProductBodyGrid     — I04 172 body (brand+name+aiReason+price+addBtn inline)
 *
 * Presets exported alongside (per Concern 2 mitigation):
 * - I03A_138: carousel preset
 * - I04_172:  grid preset
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

// CVA size variant
const productCardVariants = cva(
  'flex-shrink-0 bg-white border-[0.5px] border-icp-pink-200 overflow-hidden shadow-icp-pink-md relative',
  {
    variants: {
      width: {
        138: 'w-[138px] rounded-2xl',
        172: 'w-[172px] rounded-[18px] flex flex-col',
      },
    },
    defaultVariants: { width: 172 },
  }
);

// Public types
export type ProductCardWidth = 138 | 172;

export interface ProductCardBadge {
  type: 'hot' | 'sale' | 'new' | 'discount';
  label: string;
}

export interface ProductCardAddButton {
  variant: 'pink' | 'green';
  position: 'image-overlay' | 'price-row';
}

export interface ProductCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'color'>,
    VariantProps<typeof productCardVariants> {
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageGradient?: string;
  imageIcon?: IconName;
  badge?: ProductCardBadge | [ProductCardBadge, ProductCardBadge];
  confidence?: number;
  cornerBadge?: ProductCardBadge;
  aiReason?: string;
  rating?: number;
  soldCount?: string;
  addButton?: ProductCardAddButton;
  onAdd?: () => void;
  muted?: boolean;
}

// PRIVATE: badge inline (raw <span> per C-23 atom bypass)
const BADGE_BG: Record<ProductCardBadge['type'], string> = {
  hot: 'bg-gradient-to-br from-icp-orange-500 to-icp-orange-600 text-white shadow-[0_2px_6px_rgba(234,88,12,0.4)]',
  sale: 'bg-gradient-to-br from-icp-amber-500 to-icp-amber-600 text-white',
  new: 'bg-gradient-to-br from-icp-green-500 to-icp-green-600 text-white',
  discount: 'bg-gradient-to-br from-icp-amber-500 to-icp-amber-600 text-white',
};

function renderBadge(badge: ProductCardBadge, key?: string): React.ReactElement {
  return (
    <span
      key={key}
      className={cn(
        'inline-flex items-center gap-[3px] text-[9px] font-bold tracking-[0.2px] px-1.5 py-[2px] rounded-[5px]',
        BADGE_BG[badge.type]
      )}
    >
      {badge.label}
    </span>
  );
}

// PRIVATE: ProductImageSection
interface ProductImageSectionProps {
  isCarousel: boolean;
  imageGradient: string;
  imageIcon: IconName;
  badges: ProductCardBadge[];
  confidence?: number;
  cornerBadge?: ProductCardBadge;
  addButton?: ProductCardAddButton;
  onAdd?: () => void;
}

function ProductImageSection(props: ProductImageSectionProps): React.ReactElement {
  const { isCarousel, imageGradient, imageIcon, badges, confidence, cornerBadge, addButton, onAdd } = props;
  const wrapperClass = isCarousel
    ? 'relative w-full aspect-square flex items-center justify-center'
    : 'relative w-full h-[148px] flex items-center justify-center';
  const overlayBtnClass = cn(
    'absolute bottom-1.5 right-1.5 w-7 h-7 rounded-[9px] flex items-center justify-center border-0',
    addButton?.variant === 'pink' &&
      'bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white shadow-[0_4px_10px_rgba(233,30,99,0.4)]',
    addButton?.variant === 'green' &&
      'bg-gradient-to-br from-icp-green-500 to-icp-green-600 text-white shadow-[0_4px_10px_rgba(16,185,129,0.35)]'
  );
  return (
    <div className={wrapperClass} style={{ background: imageGradient }}>
      <Icon name={imageIcon} size={isCarousel ? 46 : 54} className="text-icp-amber-800/65" />
      {confidence !== undefined ? (
        <div className="absolute top-[7px] left-[7px] inline-flex items-center gap-[3px] bg-white/95 backdrop-blur-sm text-icp-pink-900 text-[10px] font-bold px-[7px] py-[3px] rounded-[7px] shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
          <Icon name="search" size={11} className="text-icp-pink-700" />
          {confidence}%
        </div>
      ) : badges.length > 0 ? (
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {badges.map((b, i) => renderBadge(b, `b-${i}`))}
        </div>
      ) : null}
      {cornerBadge ? (
        <div className="absolute top-[7px] right-[7px]">{renderBadge(cornerBadge)}</div>
      ) : null}
      {addButton?.position === 'image-overlay' ? (
        <button type="button" aria-label="Thêm vào giỏ" onClick={onAdd} className={overlayBtnClass}>
          <Icon name="plus" size={16} />
        </button>
      ) : null}
    </div>
  );
}

// PRIVATE: ProductBodyCarousel (I03A 138 — line 185-199)
interface ProductBodyCarouselProps {
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  soldCount?: string;
}

function ProductBodyCarousel(props: ProductBodyCarouselProps): React.ReactElement {
  const { brand, name, price, originalPrice, rating, soldCount } = props;
  return (
    <div className="px-2.5 pt-2.5 pb-3">
      <div className="text-icp-pink-700 font-semibold tracking-[0.3px] uppercase text-[9px] mb-[3px]">{brand}</div>
      <div className="text-icp-pink-900 font-semibold leading-[1.3] tracking-[-0.1px] overflow-hidden line-clamp-2 text-[12px] mb-1.5 min-h-[31px]">
        {name}
      </div>
      <div className="flex items-baseline gap-[5px] mb-1">
        <span className="text-[13px] text-icp-rose-700 font-bold font-mono tracking-[-0.3px]">{formatVND(price)}</span>
        {originalPrice !== undefined ? (
          <span className="text-[10px] text-icp-text-muted line-through font-mono">{formatVND(originalPrice)}</span>
        ) : null}
      </div>
      {(rating !== undefined || soldCount) && (
        <div className="flex justify-between items-center text-[10px] text-icp-pink-700">
          {rating !== undefined ? (
            <span className="inline-flex items-center gap-[2px]">
              <Icon name="star" size={10} className="text-icp-amber-500 fill-icp-amber-500" />
              <b>{rating}</b>
            </span>
          ) : (
            <span />
          )}
          {soldCount ? <span>{soldCount}</span> : null}
        </div>
      )}
    </div>
  );
}

// PRIVATE: ProductBodyGrid (I04 172 — line 289-296)
interface ProductBodyGridProps {
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  aiReason?: string;
  soldCount?: string;
  addButton?: ProductCardAddButton;
  onAdd?: () => void;
}

function ProductBodyGrid(props: ProductBodyGridProps): React.ReactElement {
  const { brand, name, price, originalPrice, aiReason, soldCount, addButton, onAdd } = props;
  const inlineBtnClass = cn(
    'w-[30px] h-[30px] rounded-full flex items-center justify-center border-0',
    addButton?.variant === 'pink' &&
      'bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white shadow-[0_4px_10px_rgba(233,30,99,0.4)]',
    addButton?.variant === 'green' &&
      'bg-gradient-to-br from-icp-green-500 to-icp-green-600 text-white shadow-[0_4px_10px_rgba(16,185,129,0.35)]'
  );
  return (
    <div className="px-[11px] pt-[9px] pb-2.5 flex flex-col gap-[5px]">
      <div className="text-icp-pink-700 font-semibold uppercase text-[10px]">{brand}</div>
      <div className="text-icp-pink-900 font-semibold leading-[1.3] overflow-hidden line-clamp-2 text-[12px] min-h-[31px]">
        {name}
      </div>
      {aiReason ? (
        <div className="flex items-start gap-[5px] px-2 py-1.5 bg-gradient-to-br from-icp-pink-50 to-icp-orange-50 border-[0.5px] border-dashed border-icp-pink-200 rounded-[9px]">
          <Icon name="sparkles" size={10} className="text-icp-pink-500 mt-[1px]" />
          <div className="text-[10px] text-icp-pink-700 font-medium leading-[1.35]">{aiReason}</div>
        </div>
      ) : null}
      <div className="flex items-center justify-between pt-[7px] border-t-[0.5px] border-icp-pink-100">
        <div>
          <div className="text-[13px] text-icp-rose-700 font-bold font-mono">{formatVND(price)}</div>
          {soldCount || originalPrice !== undefined ? (
            <div className={cn('text-[9px] text-icp-pink-700', originalPrice !== undefined && 'line-through font-mono')}>
              {originalPrice !== undefined ? formatVND(originalPrice) : soldCount}
            </div>
          ) : null}
        </div>
        {addButton?.position === 'price-row' ? (
          <button type="button" aria-label="Thêm vào giỏ" onClick={onAdd} className={inlineBtnClass}>
            <Icon name="plus" size={15} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// MAIN: <ProductCard> orchestrator
export const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      width = 172,
      brand,
      name,
      price,
      originalPrice,
      imageGradient = 'linear-gradient(135deg, #FEF3C7, #FCD34D)',
      imageIcon = 'package',
      badge,
      confidence,
      cornerBadge,
      aiReason,
      rating,
      soldCount,
      addButton,
      onAdd,
      muted = false,
      className,
      ...props
    },
    ref
  ) => {
    const w = width ?? 172;
    const isCarousel = w === 138;
    const badges = Array.isArray(badge) ? badge : badge ? [badge] : [];
    return (
      <div
        ref={ref}
        className={cn(productCardVariants({ width: w, className }), muted && 'opacity-[0.85]')}
        data-width={w}
        {...props}
      >
        <ProductImageSection
          isCarousel={isCarousel}
          imageGradient={imageGradient}
          imageIcon={imageIcon}
          badges={badges}
          confidence={confidence}
          cornerBadge={cornerBadge}
          addButton={addButton}
          onAdd={onAdd}
        />
        {isCarousel ? (
          <ProductBodyCarousel
            brand={brand}
            name={name}
            price={price}
            originalPrice={originalPrice}
            rating={rating}
            soldCount={soldCount}
          />
        ) : (
          <ProductBodyGrid
            brand={brand}
            name={name}
            price={price}
            originalPrice={originalPrice}
            aiReason={aiReason}
            soldCount={soldCount}
            addButton={addButton}
            onAdd={onAdd}
          />
        )}
      </div>
    );
  }
);
ProductCard.displayName = 'ProductCard';

// Presets (per Concern 2 mitigation)
export const I03A_138 = {
  width: 138 as const,
  addButton: { variant: 'pink', position: 'image-overlay' } as const,
} satisfies Partial<ProductCardProps>;

export const I04_172 = {
  width: 172 as const,
  addButton: { variant: 'green', position: 'price-row' } as const,
} satisfies Partial<ProductCardProps>;

export { productCardVariants };
