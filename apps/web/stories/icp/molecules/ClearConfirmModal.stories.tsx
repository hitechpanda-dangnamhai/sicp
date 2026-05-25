/**
 * apps/web/stories/icp/molecules/ClearConfirmModal.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ClearConfirmModal } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ClearConfirmModal',
  component: ClearConfirmModal,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    itemCount: 4,
    subtotal: 140500,
    userMessage:
      'Em sẽ xoá 4 món trị giá 140.500₫ khỏi giỏ. Hành động này không thể hoàn tác.',
    advice:
      'Nếu chỉ muốn bỏ vài món, anh hãy vuốt sang trái từng item thay vì xoá hết.',
    isPending: false,
    onConfirm: fn(),
    onCancel: fn(),
  },
  argTypes: {
    open: { control: 'boolean' },
    isPending: { control: 'boolean' },
  },
} satisfies Meta<typeof ClearConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  name: 'Open (mockup state-F verbatim)',
};

export const Pending: Story = {
  name: 'isPending=true (R-S05-3 mitigation — buttons disabled)',
  args: {
    isPending: true,
  },
};

export const EmptyMessage: Story = {
  name: 'Defensive — BE userMessage empty (FE fallback templating)',
  args: {
    userMessage: '',
    advice: 'Anh hãy cân nhắc kỹ trước khi xoá hết.',
  },
};
