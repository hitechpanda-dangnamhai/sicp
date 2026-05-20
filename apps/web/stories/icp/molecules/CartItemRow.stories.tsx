/**
 * apps/web/stories/icp/molecules/CartItemRow.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <CartItemRow> (T05, Family B)
 *
 * Source verified: components/icp/molecules/CartItemRow.tsx
 *   Props: product: CartItemProduct (REQUIRED, {brand, name, price, originalPrice?,
 *                                              imageGradient?, imageIcon?}),
 *          qty: number (REQUIRED, parent-controlled, NOT internally clamped),
 *          onQtyChange?: (newQty: number) => void,
 *          onRemove?: () => void,
 *          stockIssue?: 'out' (only 'out' shipped in T05 per Concern 3 A1),
 *          onResolveStockIssue?: () => void,
 *          cornerBadge?: CartItemCornerBadge ({type: 'discount'|'new', label})
 *
 * Decisions applied:
 * - C-22 verify: 7 props, qty parent-controlled (parent state owns clamping)
 * - C-15 Client (onQtyChange + onRemove + onResolveStockIssue handlers)
 * - C-07 navigation-agnostic — callbacks only
 * - C-08 VN labels in mock data
 * - C-13 Omit 'children' from HTMLAttributes (composable but no children slot)
 * - C-23 atom bypass for +/- stepper buttons (28-30px micro UI per T05)
 * - Concern 3 A1: stockIssue='out' only — no 'low' skeleton state yet
 * - Q4 Registry: MULTI-INTENT (qty stepper + stock issue + corner badges + image variants)
 *
 * Story coverage: Default + various qty + stockIssue + corner badges + edge cases
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CartItemRow, type CartItemProduct } from '@/components/icp/molecules';

const PRODUCT_BASIC: CartItemProduct = {
  brand: 'Vinamilk',
  name: 'Sữa chua men sống 100g',
  price: 8000,
};

const PRODUCT_WITH_DISCOUNT: CartItemProduct = {
  brand: 'TH True Milk',
  name: 'Sữa tươi không đường 1L',
  price: 28000,
  originalPrice: 35000,
};

const meta = {
  title: 'Molecules/CartItemRow',
  component: CartItemRow,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Cart line item row: product thumbnail + brand/name + price + qty stepper +/-. ' +
          'qty parent-controlled (NOT internally clamped — parent state owns clamping logic). ' +
          'stockIssue="out" renders rose banner with "Bỏ" CTA. Corner badge optional (-15% discount ' +
          'or MỚI new). C-23 atom bypass for +/- stepper buttons.',
      },
    },
  },
  argTypes: {
    qty: { control: { type: 'number', min: 0, max: 99 } },
    stockIssue: {
      control: 'inline-radio',
      options: [undefined, 'out'],
    },
  },
  args: {
    product: PRODUCT_BASIC,
    qty: 1,
    onQtyChange: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CartItemRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Qty variations ===

export const QtyOne: Story = {
  name: 'Qty = 1',
  args: { product: PRODUCT_BASIC, qty: 1 },
};

export const QtyMultiple: Story = {
  name: 'Qty = 5',
  args: { product: PRODUCT_BASIC, qty: 5 },
};

export const QtyTen: Story = {
  name: 'Qty = 10 (high qty)',
  args: { product: PRODUCT_BASIC, qty: 10 },
};

// === Stock issue ===

export const StockOut: Story = {
  name: 'stockIssue=out (rose banner)',
  args: {
    product: PRODUCT_BASIC,
    qty: 2,
    stockIssue: 'out',
    onResolveStockIssue: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'stockIssue="out" renders rose-50 banner under item with alert-triangle icon + ' +
          '"Đã hết hàng — em đề xuất bỏ khỏi giỏ" + "Bỏ" CTA → fires onResolveStockIssue.',
      },
    },
  },
};

// === Corner badges ===

export const CornerBadgeDiscount: Story = {
  name: 'Corner badge — discount -15%',
  args: {
    product: PRODUCT_WITH_DISCOUNT,
    qty: 1,
    cornerBadge: { type: 'discount', label: '-15%' },
  },
};

export const CornerBadgeNew: Story = {
  name: 'Corner badge — MỚI (new)',
  args: {
    product: PRODUCT_BASIC,
    qty: 1,
    cornerBadge: { type: 'new', label: 'MỚI' },
  },
};

// === With strike-through ===

export const WithOriginalPrice: Story = {
  name: 'With strikethrough originalPrice',
  args: {
    product: PRODUCT_WITH_DISCOUNT,
    qty: 1,
  },
};

// === Combined ===

export const FullCombined: Story = {
  name: 'Full — discount + corner badge + qty 3',
  args: {
    product: PRODUCT_WITH_DISCOUNT,
    qty: 3,
    cornerBadge: { type: 'discount', label: '-20%' },
  },
};
