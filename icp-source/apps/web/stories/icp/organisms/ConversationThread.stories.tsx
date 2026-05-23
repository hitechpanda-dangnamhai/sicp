/**
 * apps/web/stories/icp/organisms/ConversationThread.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ConversationThread> (T06)
 *
 * Source verified: components/icp/organisms/ConversationThread.tsx
 *   Props: bubbles: Array<ConversationBubbleProps & { id? }> (REQUIRED),
 *          gap?: 'tight' | 'normal' | 'loose' (default 'normal')
 *   role="log" + aria-live="polite" + aria-label="Cuộc trò chuyện" baked
 *   Distribution: SERVER (per organism distribution summary)
 *
 * Decisions applied:
 * - C-22 verify: prop signature exact from source
 * - C-15 Server (no event handlers)
 * - C-08 VN: aria-label baked
 * - Q4 Registry: SINGLE-INTENT (1 array prop + 1 enum gap)
 *
 * Story coverage: Default + gap variations + various bubble types
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConversationThread } from '@/components/icp/organisms';

const BUBBLES_BASIC = [
  { id: '1', role: 'ai' as const, variant: 'greet' as const, text: 'Xin chào! Em là Aida.' },
  { id: '2', role: 'user' as const, text: 'Sữa chua Vinamilk 100g' },
  { id: '3', role: 'ai' as const, text: 'Em đã nhận diện sản phẩm.' },
  { id: '4', role: 'user' as const, text: 'Giá bao nhiêu?' },
  { id: '5', role: 'ai' as const, variant: 'success' as const, text: 'Giá đề xuất: 65.000₫' },
];

const BUBBLES_LONG = [
  ...BUBBLES_BASIC,
  { id: '6', role: 'ai' as const, variant: 'note' as const, text: 'Lưu ý: giá có thể thay đổi theo thị trường.' },
  { id: '7', role: 'user' as const, text: 'OK lưu lại' },
  { id: '8', role: 'ai' as const, variant: 'success' as const, text: 'Đã lưu sản phẩm.' },
];

const meta = {
  title: 'Organisms/ConversationThread',
  component: ConversationThread,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Container for ordered ConversationBubble list. role="log" + aria-live="polite" + ' +
          'aria-label="Cuộc trò chuyện" baked. gap: tight/normal/loose. Server component — ' +
          'composes Family A molecule, no client boundaries needed.',
      },
    },
  },
  argTypes: {
    gap: {
      control: 'inline-radio',
      options: ['tight', 'normal', 'loose'],
    },
  },
  args: {
    bubbles: BUBBLES_BASIC,
    gap: 'normal',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConversationThread>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const GapTight: Story = {
  name: 'Gap — tight (space-y-2)',
  args: { bubbles: BUBBLES_BASIC, gap: 'tight' },
};

export const GapNormal: Story = {
  name: 'Gap — normal (bubble owns mb-3.5)',
  args: { bubbles: BUBBLES_BASIC, gap: 'normal' },
};

export const GapLoose: Story = {
  name: 'Gap — loose (space-y-4)',
  args: { bubbles: BUBBLES_BASIC, gap: 'loose' },
};

export const LongConversation: Story = {
  name: 'Long conversation (8 bubbles mixed variants)',
  args: { bubbles: BUBBLES_LONG },
};

export const SingleBubble: Story = {
  name: 'Single bubble — minimum case',
  args: {
    bubbles: [{ id: '1', role: 'ai', variant: 'greet', text: 'Xin chào!' }],
  },
};
