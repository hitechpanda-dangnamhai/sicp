/**
 * apps/web/stories/icp/molecules/ProductCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <ProductCard> (T05, Family B)
 *
 * Source verified: components/icp/molecules/ProductCard.tsx
 *   Props: brand, name, price (REQUIRED 3 fields),
 *          originalPrice?, imageGradient?, imageIcon?: IconName,
 *          badge?: ProductCardBadge | [ProductCardBadge, ProductCardBadge] (1 or 2 badges),
 *          confidence?: number, cornerBadge?, aiReason?, rating?, soldCount?,
 *          addButton?: { variant: 'pink'|'green', position: 'image-overlay'|'price-row' },
 *          onAdd?: () => void, muted?: boolean
 *          width?: 138 | 172 (CVA variant, default 172)
 *   2 presets exported: I03A_138 (carousel) + I04_172 (grid).
 *
 * Decisions applied:
 * - C-22 verify: 12 props from source — 3 required + 9 optional
 * - C-15 Client (onAdd handler)
 * - C-07 navigation-agnostic — onAdd callback only
 * - C-08 VN labels in mock data
 * - C-13 Omit 'color' from HTMLAttributes (CVA collision per source)
 * - C-21 width preset pattern (per T05 Concern 2 resolution)
 * - C-23 atom bypass (Button/ChipPill bypass for 28-30px micro UI — verified in source line 24-25)
 * - Q4 Registry: MULTI-INTENT (2 width presets × badges × addButton states × muted)
 *
 * Story coverage: 2 presets demo + badge variants + addButton positions + muted state
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ProductCard, I03A_138, I04_172 } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ProductCard',
  component: ProductCard,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          '2 width preset card (138px carousel I03A / 172px grid I04). Composes brand/name/price ' +
          '+ optional badges (1-2 array) + confidence ring + aiReason + rating/soldCount + ' +
          'addButton overlay or inline. Imports I03A_138 + I04_172 presets to spread spread typical ' +
          'config per V-SLICE (C-23 atom bypass for 28-30px micro UI per T05).',
      },
    },
  },
  argTypes: {
    brand: { control: 'text' },
    name: { control: 'text' },
    price: { control: { type: 'number', min: 0 } },
    originalPrice: { control: { type: 'number', min: 0 } },
    width: { control: 'inline-radio', options: [138, 172] },
    confidence: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    rating: { control: { type: 'number', min: 0, max: 5, step: 0.1 } },
    muted: { control: 'boolean' },
  },
  args: {
    brand: 'Vinamilk',
    name: 'Sữa chua men sống 100g',
    price: 8000,
    onAdd: fn(),
  },
} satisfies Meta<typeof ProductCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 2 width presets ===

export const PresetI03A138: Story = {
  name: 'Preset I03A_138 (carousel)',
  args: {
    ...I03A_138,
    brand: 'Vinamilk',
    name: 'Sữa chua men sống 100g',
    price: 8000,
    rating: 4.5,
    soldCount: '12k',
  },
  parameters: {
    docs: {
      description: {
        story: 'I03A_138 preset = width 138 + addButton{variant:"pink", position:"image-overlay"}. ' +
               'Used I03 carousel rows. Spread `{...I03A_138}` then add brand/name/price.',
      },
    },
  },
};

export const PresetI04172: Story = {
  name: 'Preset I04_172 (grid)',
  args: {
    ...I04_172,
    brand: 'TH True Milk',
    name: 'Sữa tươi 1L',
    price: 32000,
    aiReason: 'Em đề xuất vì doanh số tăng 45%',
  },
  parameters: {
    docs: {
      description: {
        story: 'I04_172 preset = width 172 + addButton{variant:"green", position:"price-row"}. ' +
               'Used I04 grid layout. Wider card với aiReason text inline.',
      },
    },
  },
};

// === Badges ===

export const SingleBadge: Story = {
  name: 'Single badge — HOT',
  args: {
    ...I03A_138,
    brand: 'Vinamilk',
    name: 'Sữa chua men sống',
    price: 8000,
    badge: { type: 'hot', label: 'HOT' },
  },
};

export const DoubleBadges: Story = {
  name: 'Double badges — HOT + SALE',
  args: {
    ...I03A_138,
    brand: 'Vinamilk',
    name: 'Sữa chua men sống',
    price: 8000,
    originalPrice: 10000,
    badge: [
      { type: 'hot', label: 'HOT' },
      { type: 'sale', label: '-20%' },
    ],
  },
};

export const NewBadge: Story = {
  args: {
    ...I04_172,
    brand: 'Vinamilk',
    name: 'Sữa chua men sống Mới',
    price: 9000,
    badge: { type: 'new', label: 'MỚI' },
  },
};

// === Add button variants ===

export const AddButtonImageOverlay: Story = {
  name: 'AddButton — image-overlay (pink)',
  args: {
    width: 138,
    brand: 'Vinamilk',
    name: 'Sữa chua',
    price: 8000,
    addButton: { variant: 'pink', position: 'image-overlay' },
  },
};

export const AddButtonPriceRow: Story = {
  name: 'AddButton — price-row (green)',
  args: {
    width: 172,
    brand: 'Vinamilk',
    name: 'Sữa chua',
    price: 8000,
    addButton: { variant: 'green', position: 'price-row' },
  },
};

// === Confidence + aiReason (I04 pattern) ===

export const WithConfidenceAndReason: Story = {
  name: 'With confidence + aiReason',
  args: {
    ...I04_172,
    brand: 'Vinamilk',
    name: 'Sữa chua men sống probiotic 100g',
    price: 8500,
    originalPrice: 10000,
    confidence: 94,
    aiReason: 'Em đề xuất vì men sống tốt cho tiêu hóa',
  },
};

// === Edge state ===

export const MutedState: Story = {
  name: 'Muted state (deprioritized)',
  args: {
    ...I04_172,
    brand: 'Vinamilk',
    name: 'Sữa chua hết hàng',
    price: 8000,
    muted: true,
  },
};

export const WithOriginalPrice: Story = {
  name: 'With strikethrough originalPrice',
  args: {
    ...I04_172,
    brand: 'Vinamilk',
    name: 'Sữa chua',
    price: 7000,
    originalPrice: 10000,
    badge: { type: 'discount', label: '-30%' },
  },
};
