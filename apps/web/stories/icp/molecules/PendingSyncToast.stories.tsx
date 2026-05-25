/**
 * apps/web/stories/icp/molecules/PendingSyncToast.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PendingSyncToast } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/PendingSyncToast',
  component: PendingSyncToast,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    oldQty: 2,
    newQty: 3,
    itemBrief: 'Maggi 700ml',
    onCancel: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PendingSyncToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QtyIncrement: Story = {
  name: 'Qty 2 → 3 (state-C mockup verbatim)',
};

export const QtyDecrement: Story = {
  name: 'Qty 5 → 3 (decrement)',
  args: {
    oldQty: 5,
    newQty: 3,
  },
};

export const QtyToZero: Story = {
  name: 'Qty 1 → 0 (auto-remove edge)',
  args: {
    oldQty: 1,
    newQty: 0,
    itemBrief: 'Chin-su 250g',
  },
};
