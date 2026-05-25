/**
 * apps/web/stories/icp/molecules/StockIssueAlert.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StockIssueAlert } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/StockIssueAlert',
  component: StockIssueAlert,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    outOfStockCount: 1,
    message:
      'Em vừa kiểm tra kho, Chin-su 250g đã hết. Anh bỏ qua hoặc chọn món thay thế nhé.',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StockIssueAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleItem: Story = {
  name: 'Single item out of stock (state-E mockup verbatim)',
};

export const MultipleItems: Story = {
  name: '3 items out of stock',
  args: {
    outOfStockCount: 3,
    message:
      'Em vừa kiểm tra kho, có 3 món đã hết. Anh có thể bỏ từng món hoặc chọn món thay thế.',
  },
};
