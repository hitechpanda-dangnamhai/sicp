/**
 * apps/web/stories/icp/molecules/ConversationBubble.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <ConversationBubble> (T04, Family A)
 *
 * Source verified: components/icp/molecules/ConversationBubble.tsx
 *   Props: role: 'ai' | 'user' (REQUIRED),
 *          variant?: 7 values ('default'|'greet'|'note'|'clarify'|'success'|'suggest'|'empty'),
 *          text?: string | ReactNode,
 *          label?: string,
 *          avatar?: ReactNode,
 *          voiceMeta?: VoiceMeta (user role only),
 *          meta?: ReactNode (ai role only)
 *   VoiceMeta sub-props: duration, confidence, partialBadge, showVoiceWave, liveCursor
 *
 * Decisions applied:
 * - C-22 verify: 7 variants confirmed via CVA aiBubbleVariants source
 * - C-15 Client (no — pure forwardRef, no handlers; actually Server-eligible)
 * - C-08 VN labels
 * - Q4 Registry: MULTI-INTENT (2 roles × 7 variants × voice meta = compound primitive)
 *
 * Story coverage: 2 roles + 7 ai variants + voice meta variations
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConversationBubble } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ConversationBubble',
  component: ConversationBubble,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Chat bubble for AI/user conversations. 7 ai variants (default/greet/note/clarify/' +
          'success/suggest/empty) × 2 roles. User role supports voiceMeta sub-props for I07 ' +
          'voice transcript display (7-bar wave + duration mono + confidence + partialBadge).',
      },
    },
  },
  argTypes: {
    role: {
      control: 'inline-radio',
      options: ['ai', 'user'],
    },
    variant: {
      control: 'select',
      options: ['default', 'greet', 'note', 'clarify', 'success', 'suggest', 'empty'],
    },
    text: { control: 'text' },
    label: { control: 'text' },
  },
  args: {
    role: 'ai',
    variant: 'default',
    text: 'Em đã phân tích sản phẩm của anh.',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConversationBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 7 AI variants ===

export const AiGreet: Story = {
  name: 'AI — variant greet',
  args: { role: 'ai', variant: 'greet', text: 'Xin chào! Em là Aida.' },
};

export const AiNote: Story = {
  name: 'AI — variant note (amber left border)',
  args: { role: 'ai', variant: 'note', text: 'Lưu ý: giá tham khảo sẽ thay đổi theo thị trường.' },
};

export const AiClarify: Story = {
  name: 'AI — variant clarify (amber gradient)',
  args: { role: 'ai', variant: 'clarify', text: 'Anh có thể nói rõ hơn về sản phẩm không?' },
};

export const AiSuccess: Story = {
  name: 'AI — variant success (emerald)',
  args: { role: 'ai', variant: 'success', text: 'Đã lưu sản phẩm thành công!' },
};

export const AiSuggest: Story = {
  name: 'AI — variant suggest (pink-amber gradient)',
  args: { role: 'ai', variant: 'suggest', text: 'Em gợi ý anh tăng giá lên 65.000₫.' },
};

export const AiEmpty: Story = {
  name: 'AI — variant empty (light pink)',
  args: { role: 'ai', variant: 'empty', text: 'Chưa có dữ liệu phân tích cho sản phẩm này.' },
};

// === User role variations ===

export const UserText: Story = {
  name: 'User — text-only message',
  args: {
    role: 'user',
    text: 'Sữa chua Vinamilk 100g',
  },
};

export const UserVoiceWithMeta: Story = {
  name: 'User — voice transcript with meta',
  args: {
    role: 'user',
    text: 'Sữa chua Vinamilk 100g, giá khoảng 8000 đồng',
    voiceMeta: {
      duration: '0:04',
      confidence: 0.94,
      showVoiceWave: true,
    },
  },
};

export const UserPartialStreaming: Story = {
  name: 'User — partial transcript with cursor',
  args: {
    role: 'user',
    text: 'Sữa chua Vinamilk',
    voiceMeta: {
      partialBadge: '⚡ Streaming',
      liveCursor: true,
    },
  },
};

// === With label ===

export const AiWithLabel: Story = {
  name: 'AI — with name label tag',
  args: {
    role: 'ai',
    label: 'AIDA',
    variant: 'default',
    text: 'Em đã phân tích xong sản phẩm.',
  },
};
