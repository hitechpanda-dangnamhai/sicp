/**
 * apps/web/stories/icp/molecules/ProductCard.S-09-extend.stories.tsx
 *
 * Storybook stories EXTEND cho <ProductCard> — verify C-S09-AO NEW props
 * `confidenceIcon?` + `reasonChipIcon?` work as expected (defaults preserve
 * S-04/S-05 backward-compat).
 *
 * Slice: S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:  T02 FE + wire (Phiên Sx09-F) — AC25 build-storybook EXIT 0 + AC31 amended
 *
 * Coverage:
 * - VisualMatch: state-0 default — confidenceIcon='eye' + reasonChipIcon='sparkles'
 * - CollabMatch: state-D — confidenceIcon='users' + reasonChipIcon='users'
 * - TrendingMatch: state-D trending — confidenceIcon='trending-up' + reasonChipIcon='trending-up'
 * - BackwardCompatDefault: omit both props — verify defaults match S-04 Intent 03 look
 *
 * Existing S-04 ProductCard stories (in ProductCard.stories.tsx) cover Family B
 * shape + 138/172 width variants. This file adds S-09 signal-icon swap variants.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProductCard } from '@/components/icp/molecules/ProductCard';

const meta: Meta<typeof ProductCard> = {
  title: 'ICP/Molecules/ProductCard/S-09 Signal Icon Variants',
  component: ProductCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'S-09 C-S09-AO NEW: dynamic confidenceIcon + reasonChipIcon props swap per `match_type` (eye/users/trending-up) + `activeSignalFilter` (sparkles/users/trending-up). Defaults preserve S-04 backward-compat (search + sparkles).',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

const BASE_ARGS = {
  width: 172 as const,
  brand: 'NongShim',
  name: 'Mì Samyang 2x Spicy 140g',
  price: 35000,
  imageGradient: 'linear-gradient(135deg, #FEF3C7, #FCD34D)',
  imageIcon: 'package' as const,
  aiReason: 'Cùng độ cay, cùng phong cách Hàn',
  confidence: 92,
  soldCount: 'đã bán 1.2k',
  addButton: { variant: 'green' as const, position: 'price-row' as const },
};

/** state-0 visual default — confidenceIcon=eye + reasonChipIcon=sparkles. */
export const VisualMatch: Story = {
  args: {
    ...BASE_ARGS,
    confidenceIcon: 'eye',
    reasonChipIcon: 'sparkles',
  },
  parameters: {
    docs: {
      description: {
        story: 'Mockup state-0 default (line 286 + 292): "Giống thị giác" chip active. Badge eye + reason chip sparkles.',
      },
    },
  },
};

/** state-D collab active — confidenceIcon=users + reasonChipIcon=users (DUAL swap). */
export const CollabMatch: Story = {
  args: {
    ...BASE_ARGS,
    aiReason: '85 khách mua mì cay thường mua kèm sản phẩm này',
    confidence: 85,
    confidenceIcon: 'users',
    reasonChipIcon: 'users',
  },
  parameters: {
    docs: {
      description: {
        story: 'Mockup state-D collab active (line 231 + 239): "Khách hay mua" chip active. DUAL icon swap per C-S09-AO LAW.',
      },
    },
  },
};

/** state-D trending — confidenceIcon=trending-up + reasonChipIcon=trending-up. */
export const TrendingMatch: Story = {
  args: {
    ...BASE_ARGS,
    aiReason: 'Tăng 35% trong tuần qua',
    confidence: 78,
    confidenceIcon: 'trending-up',
    reasonChipIcon: 'trending-up',
  },
};

/** Defaults omitted — verify S-04 Intent 03 backward-compat (search + sparkles). */
export const BackwardCompatDefault: Story = {
  args: {
    ...BASE_ARGS,
    // Both icons omitted → ProductCard defaults to 'search' + 'sparkles'
  },
  parameters: {
    docs: {
      description: {
        story: 'No `confidenceIcon`/`reasonChipIcon` props provided → ProductCard defaults to `search` + `sparkles` (S-04/S-05 backward-compat preserved 100%).',
      },
    },
  },
};
