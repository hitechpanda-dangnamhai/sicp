/**
 * apps/web/stories/icp/molecules/StockReplacementCard.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { StockReplacementCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/StockReplacementCard',
  component: StockReplacementCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    replacement: {
      productId: 'b3f6f87b-stub',
      title: 'Tương ớt Chin-su 500g (chai lớn)',
      brand: 'Chin-su',
      unitPrice: 29000,
      availableStock: 47,
    },
    onReplace: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StockReplacementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HappyNoReason: Story = {
  name: 'Default (no reason chip — mockup state-E line 271-293 verbatim)',
};

export const WithLLMReason: Story = {
  name: 'With LLM reason chip (≤120 chars)',
  args: {
    reason: 'Chin-su cùng thương hiệu, dung tích lớn tiết kiệm hơn',
  },
};

export const LowStock: Story = {
  name: 'Edge — low stock (3 chai)',
  args: {
    replacement: {
      productId: 'b3f6f87b-stub',
      title: 'Tương ớt Chin-su 500g (chai lớn)',
      brand: 'Chin-su',
      unitPrice: 29000,
      availableStock: 3,
    },
  },
};
