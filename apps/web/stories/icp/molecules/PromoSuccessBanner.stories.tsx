/**
 * apps/web/stories/icp/molecules/PromoSuccessBanner.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 *
 * Note: canvas-confetti fires once on mount per D-S05-08 LAW. Storybook hot-reload
 * may show repeated bursts during dev iteration — production single-fire confirmed.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PromoSuccessBanner } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/PromoSuccessBanner',
  component: PromoSuccessBanner,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    promoCode: 'SALE15',
    discountAmount: 21750,
    discountLabel: 'giảm 15% toàn giỏ',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PromoSuccessBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sale15: Story = {
  name: 'SALE15 — 15% off (state-G mockup verbatim)',
};

export const FreeShip: Story = {
  name: 'FREESHIP — free shipping promo',
  args: {
    promoCode: 'FREESHIP',
    discountAmount: 15000,
    discountLabel: 'miễn phí vận chuyển',
  },
};

export const NewUser: Story = {
  name: 'NEWUSER — fixed amount discount',
  args: {
    promoCode: 'NEWUSER',
    discountAmount: 50000,
    discountLabel: 'giảm 50.000₫ cho đơn đầu tiên',
  },
};
