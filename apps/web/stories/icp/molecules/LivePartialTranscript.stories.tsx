/**
 * apps/web/stories/icp/molecules/LivePartialTranscript.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <LivePartialTranscript> (T04, Family A)
 *
 * Source verified: components/icp/molecules/LivePartialTranscript.tsx
 *   Props: text: string (REQUIRED),
 *          label?: string (default 'Tạm hiểu'),
 *          showCursor?: boolean (default true),
 *          icon?: IconName (default 'mic')
 *
 * Decisions applied:
 * - C-22 verify: 4 props, all primitive types
 * - C-15 Server (no event handlers)
 * - C-08 VN: label default 'Tạm hiểu'
 * - Q4 Registry: SINGLE-INTENT (used I02-A partial STT display)
 *
 * Story coverage: Default + text variations + cursor toggle + custom icon
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LivePartialTranscript } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/LivePartialTranscript',
  component: LivePartialTranscript,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Partial speech-to-text display widget. Shows label header + italic text body + ' +
          'optional blinking cursor. Used I02-A "Tạm hiểu" panel during voice recording.',
      },
    },
  },
  argTypes: {
    text: { control: 'text' },
    label: { control: 'text' },
    showCursor: { control: 'boolean' },
    icon: {
      control: 'select',
      options: ['mic', 'mic-off', 'sparkles', 'zap'],
    },
  },
  args: {
    text: 'Sữa chua Vinamilk 100g, giá khoảng tám nghìn đồng',
    label: 'Tạm hiểu',
    showCursor: true,
    icon: 'mic',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LivePartialTranscript>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ShortText: Story = {
  args: { text: 'Sữa chua...' },
};

export const LongText: Story = {
  name: 'Long text — auto wrap',
  args: {
    text: 'Sữa chua Vinamilk 100g có men sống, giá khoảng tám nghìn đồng một hộp, nhập từ cửa hàng nhỏ ở quận một',
  },
};

export const NoCursor: Story = {
  name: 'showCursor=false (final result)',
  args: {
    text: 'Sữa chua Vinamilk 100g, giá 8.000₫',
    showCursor: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'showCursor=false used when STT stream complete (final transcript).',
      },
    },
  },
};

export const CustomLabel: Story = {
  args: {
    text: 'Đang xử lý audio...',
    label: 'AI đang nghe',
    icon: 'sparkles',
  },
};
