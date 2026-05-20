/**
 * apps/web/stories/icp/organisms/OrderSummary.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <OrderSummary> (T06)
 *
 * Source verified: components/icp/organisms/OrderSummary.tsx
 *   Props: items: OrderSummaryItem[] (REQUIRED, {name, qty, price, brand?}),
 *          subtotal: number (REQUIRED),
 *          delivery: number (REQUIRED),
 *          total: number (REQUIRED),
 *          mode?: 'confirm'|'receipt' (default 'confirm'),
 *          receiptMeta?: { orderId, timestamp } (required when mode='receipt'),
 *          discount?: number (optional line between delivery and total)
 *   Distribution: SERVER (pure presentational, no handlers)
 *
 * Decisions applied:
 * - C-22 verify: 7 props (4 required numbers + 3 optional)
 * - C-15 Server (no event handlers)
 * - C-08 VN: labels VN baked, timestamp pre-formatted by consumer
 * - formatVND utility for VND currency display
 * - Q4 Registry: MULTI-INTENT (2 modes + receiptMeta variant + discount slot)
 *
 * Story coverage: Default confirm + receipt mode + with discount + various item counts
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OrderSummary, type OrderSummaryItem } from '@/components/icp/organisms';

const ITEMS_SHORT: OrderSummaryItem[] = [
  { brand: 'Vinamilk', name: 'Sữa chua men sống 100g', qty: 2, price: 8000 },
  { brand: 'TH True Milk', name: 'Sữa tươi 1L', qty: 1, price: 32000 },
];

const ITEMS_LONG: OrderSummaryItem[] = [
  { brand: 'Vinamilk', name: 'Sữa chua men sống 100g', qty: 2, price: 8000 },
  { brand: 'TH True Milk', name: 'Sữa tươi 1L', qty: 1, price: 32000 },
  { brand: 'Lavie', name: 'Nước suối 500ml', qty: 6, price: 5000 },
  { brand: 'Vinamil', name: 'Sữa hộp 100ml', qty: 4, price: 7500 },
  { brand: 'Cocoxim', name: 'Nước dừa 250ml', qty: 2, price: 12000 },
];

const meta = {
  title: 'Organisms/OrderSummary',
  component: OrderSummary,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Order line items + price breakdown summary. 2 modes: "confirm" (pre-payment) and ' +
          '"receipt" (post-payment with orderId + timestamp meta). formatVND utility renders ' +
          'all VND currency. discount line optional between delivery and total.',
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['confirm', 'receipt'] },
    subtotal: { control: 'number' },
    delivery: { control: 'number' },
    total: { control: 'number' },
    discount: { control: 'number' },
  },
  args: {
    items: ITEMS_SHORT,
    subtotal: 48000,
    delivery: 15000,
    total: 63000,
    mode: 'confirm',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Modes ===

export const ConfirmMode: Story = {
  name: 'Mode — confirm (pre-payment)',
  args: {
    items: ITEMS_SHORT,
    subtotal: 48000,
    delivery: 15000,
    total: 63000,
    mode: 'confirm',
  },
};

export const ReceiptMode: Story = {
  name: 'Mode — receipt (post-payment with meta)',
  args: {
    items: ITEMS_SHORT,
    subtotal: 48000,
    delivery: 15000,
    total: 63000,
    mode: 'receipt',
    receiptMeta: {
      orderId: '#MM-2026-05-20-A4B7',
      timestamp: '20/05/2026 14:32',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Receipt mode renders orderId + timestamp meta block. Consumer pre-formats timestamp ' +
               '(component does NOT format dates per C-08).',
      },
    },
  },
};

// === With discount ===

export const WithDiscount: Story = {
  name: 'With discount line',
  args: {
    items: ITEMS_SHORT,
    subtotal: 48000,
    delivery: 15000,
    discount: -8000, // -2% MoMo cashback
    total: 55000,
    mode: 'confirm',
  },
};

// === Item counts ===

export const SingleItem: Story = {
  name: 'Single item',
  args: {
    items: [ITEMS_SHORT[0]],
    subtotal: 16000,
    delivery: 15000,
    total: 31000,
  },
};

export const LongItemList: Story = {
  name: 'Long item list (5 items)',
  args: {
    items: ITEMS_LONG,
    subtotal: 119000,
    delivery: 15000,
    total: 134000,
  },
};

export const ItemsNoBrand: Story = {
  name: 'Items without brand',
  args: {
    items: [
      { name: 'Sản phẩm A', qty: 1, price: 50000 },
      { name: 'Sản phẩm B', qty: 2, price: 30000 },
    ],
    subtotal: 110000,
    delivery: 15000,
    total: 125000,
  },
};
