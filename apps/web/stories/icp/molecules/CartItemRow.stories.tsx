/**
 * apps/web/stories/icp/molecules/CartItemRow.stories.tsx
 *
 * Slice:   S-01 UI Foundation (baseline 9 stories)
 *          S-05 T03 EXTEND (Phiên Sx05-3) — +3 NEW stories per C-S05-I + C-S05-J
 *
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke (S-01)
 *          S-05 T03 (Phiên Sx05-3) — verify EXTEND props in Storybook UI
 *
 * Molecule: <CartItemRow> (T05 Family B baseline + S-05 T03 EXTEND +3 props)
 *
 * Source verified: components/icp/molecules/CartItemRow.tsx
 *   Props (S-01 baseline): product, qty, onQtyChange, onRemove, stockIssue, onResolveStockIssue, cornerBadge
 *   Props (S-05 T03 NEW): isUpdating?, lineTotalOverride?, currencyFormatter?
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CartItemRow, type CartItemProduct } from '@/components/icp/molecules';
import { formatVNDCompact } from '@/lib/utils';

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

const PRODUCT_MAGGI: CartItemProduct = {
  brand: 'Maggi',
  name: 'Nước tương Maggi đậm đặc 700ml',
  price: 25500,
  originalPrice: 30000,
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
          'or MỚI new). C-23 atom bypass for +/- stepper buttons. ' +
          'S-05 T03 EXTEND adds isUpdating (Spinner overlay), lineTotalOverride (optimistic UI), ' +
          'currencyFormatter (formatVNDCompact for mockup parity).',
      },
    },
  },
  argTypes: {
    qty: { control: { type: 'number', min: 0, max: 99 } },
    stockIssue: {
      control: 'inline-radio',
      options: [undefined, 'out'],
    },
    isUpdating: { control: 'boolean' },
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

// ─── S-05 T03 NEW stories (Phiên Sx05-3 per C-S05-I + C-S05-J) ──────────────

export const Updating: Story = {
  name: '[S-05] isUpdating=true (Spinner overlay)',
  args: {
    product: PRODUCT_MAGGI,
    qty: 2,
    isUpdating: true,
    cornerBadge: { type: 'discount', label: '-15%' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'isUpdating=true renders <Spinner size={14} color="pink"> in place of qty number. ' +
          'Used during state-C debounce-pending window OR PATCH /cart/items/:id in-flight. ' +
          'Stepper +/- buttons disabled during update. D-S05-07 LAW optimistic UI pattern.',
      },
    },
  },
};

export const OptimisticLineTotal: Story = {
  name: '[S-05] lineTotalOverride (optimistic line_total)',
  args: {
    product: PRODUCT_MAGGI,
    qty: 2, // server truth
    lineTotalOverride: 76500, // 25500 × 3 (user tapped + once, optimistic qty=3)
  },
  parameters: {
    docs: {
      description: {
        story:
          'lineTotalOverride=76500 overrides default product.price * qty (25500 × 2 = 51000) ' +
          'with optimistic computed value. Used during D-S05-07 LAW debounce window where ' +
          'qty number stays as server truth but line_total reflects optimistic intent.',
      },
    },
  },
};

export const WithCompactFormatter: Story = {
  name: '[S-05] currencyFormatter=formatVNDCompact (cart context parity)',
  args: {
    product: PRODUCT_MAGGI,
    qty: 3,
    currencyFormatter: formatVNDCompact,
    cornerBadge: { type: 'discount', label: '-15%' },
  },
  parameters: {
    docs: {
      description: {
        story:
          'currencyFormatter override → renders "25.500₫" (no space) matching mockup ' +
          'state-0 line 158 verbatim per Rule 6 LAW (237 mockup instances verified ' +
          'Sx05-3-DISCOVER). Default formatVND (NBSP) preserved for backward-compat with ' +
          '6 S-01 production consumers + molecules.test.tsx:658 assertion. C-S05-J Path A additive.',
      },
    },
  },
};
