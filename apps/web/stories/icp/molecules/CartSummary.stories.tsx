/**
 * apps/web/stories/icp/molecules/CartSummary.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 *
 * Coverage: state-0 happy (free-ship) + state-G promo pill + state-E disabled + below-threshold progress.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CartSummary } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/CartSummary',
  component: CartSummary,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    itemCount: 4,
    subtotal: 145000,
    discount: 0,
    shipping: 0,
    total: 145000,
    promoCode: null,
    promoLabel: null,
    checkoutEnabled: true,
    checkoutLabel: 'Thanh toán',
    onCheckout: fn(),
    onRemovePromo: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: 480, maxWidth: 380, background: '#FAF5F7' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CartSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StateZeroHappy: Story = {
  name: 'state-0 — happy (free-ship reached)',
  args: {
    itemCount: 4,
    subtotal: 145000,
    discount: 4500,
    shipping: 0,
    total: 140500,
  },
};

export const StateGPromoApplied: Story = {
  name: 'state-G — promo pill rendered',
  args: {
    itemCount: 4,
    subtotal: 145000,
    discount: 21750, // 15% off
    shipping: 0,
    total: 123250,
    promoCode: 'SALE15',
    promoLabel: 'Giảm 15% toàn giỏ',
  },
};

export const StateEDisabled: Story = {
  name: 'state-E — checkout disabled (stock issue)',
  args: {
    itemCount: 4,
    subtotal: 145000,
    discount: 0,
    shipping: 0,
    total: 145000,
    checkoutEnabled: false,
    checkoutLabel: 'Cần xử lý món hết hàng',
  },
};

export const BelowFreeShipThreshold: Story = {
  name: 'Below free-ship — progress bar visible',
  args: {
    itemCount: 1,
    subtotal: 65000,
    discount: 0,
    shipping: 15000,
    total: 80000,
  },
};
