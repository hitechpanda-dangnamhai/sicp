/**
 * apps/web/stories/icp/molecules/CartAIHintBubble.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CartAIHintBubble } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/CartAIHintBubble',
  component: CartAIHintBubble,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    message: 'Anh có 4 món trong giỏ. Em đã kiểm tra tồn kho, mọi thứ sẵn sàng',
    dotVariant: 'green',
  },
  argTypes: {
    dotVariant: { control: 'inline-radio', options: ['green', 'amber', 'red'] },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CartAIHintBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StateZeroReady: Story = {
  name: 'state-0 — green ready dot',
  args: {
    dotVariant: 'green',
    message: (
      <>
        Anh có <b className="text-icp-pink-700">4 món</b> trong giỏ. Em đã kiểm tra tồn kho, mọi thứ sẵn sàng
      </>
    ),
  },
};

export const StateAmberSync: Story = {
  name: 'state-A/C — amber syncing dot',
  args: {
    dotVariant: 'amber',
    message: 'Đợi em chút, đang đồng bộ giỏ hàng...',
  },
};

export const StateError: Story = {
  name: 'state-error — red dot (rare)',
  args: {
    dotVariant: 'red',
    message: 'Em chưa kết nối được — sẽ thử lại trong vài giây',
  },
};
