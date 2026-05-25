/**
 * apps/web/stories/icp/molecules/UndoRemoveToast.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { UndoRemoveToast } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/UndoRemoveToast',
  component: UndoRemoveToast,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    itemTitle: 'Nước tương Maggi đậm đặc 700ml',
    itemPrice: 25500,
    onUndo: fn(),
    onCommit: fn(),
    autoDismissMs: 3000,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UndoRemoveToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default3sCountdown: Story = {
  name: 'Default 3s countdown (state-D mockup verbatim)',
};

export const ShortCountdown: Story = {
  name: 'Short 1.5s (visual countdown test)',
  args: {
    autoDismissMs: 1500,
  },
};

export const LongItemTitle: Story = {
  name: 'Long item title (truncate test)',
  args: {
    itemTitle:
      'Nước tương Maggi đậm đặc loại đặc biệt nhập khẩu chính hãng siêu thị 700ml',
    itemPrice: 89000,
  },
};
