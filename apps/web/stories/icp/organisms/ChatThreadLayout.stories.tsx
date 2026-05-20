/**
 * apps/web/stories/icp/organisms/ChatThreadLayout.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ChatThreadLayout> (T06)
 *
 * Source verified: components/icp/organisms/ChatThreadLayout.tsx
 *   Props: title?, onBack?, topAction?: ReactNode,
 *          bubbles: ConversationThreadProps['bubbles'] (REQUIRED),
 *          gap?: 'tight'|'normal'|'loose',
 *          bottomCta?: ReactNode (BottomBar shows only if provided),
 *          className?, beforeThread?: ReactNode, afterThread?: ReactNode
 *   Composes: PhoneFrame + TopBar + MainScroll + ConversationThread + BottomBar
 *
 * Decisions applied:
 * - C-22 verify: 8 props from source
 * - C-15 Server (delegates to children — TopBar Client, PhoneFrame Client)
 * - C-07 navigation-agnostic — onBack callback only
 * - C-16 MainScroll noBottomPadding=!hasBottomBar (auto)
 * - Q4 Registry: MULTI-INTENT (5 conditional slots + composition primitive)
 *
 * Story coverage: Default I01 + with topAction + before/after thread slots +
 *                 without bottomCta (no BottomBar)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ChatThreadLayout } from '@/components/icp/organisms';
import { Button } from '@/components/icp/atoms';
import { LivePartialTranscript } from '@/components/icp/molecules';

const BUBBLES_DEFAULT = [
  { id: '1', role: 'ai' as const, variant: 'greet' as const, text: 'Em là Aida — trợ lý phân tích sản phẩm.' },
  { id: '2', role: 'user' as const, text: 'Sữa chua Vinamilk 100g' },
  { id: '3', role: 'ai' as const, text: 'Em đã nhận diện sản phẩm.' },
  { id: '4', role: 'ai' as const, variant: 'note' as const, text: 'Giá tham khảo: 60.000-65.000₫' },
];

const meta = {
  title: 'Organisms/ChatThreadLayout',
  component: ChatThreadLayout,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'transparent' },
    docs: {
      description: {
        component:
          'Full I01/I02 chat layout composition primitive. Wraps PhoneFrame mode="chat" + ' +
          'TopBar + MainScroll + ConversationThread + optional BottomBar (only if bottomCta). ' +
          'beforeThread / afterThread slots allow custom widgets above/below thread (banners, ' +
          'live transcripts, etc.). MainScroll noBottomPadding auto-resolves per hasBottomBar.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
  },
  args: {
    title: 'Phân tích sản phẩm',
    bubbles: BUBBLES_DEFAULT,
    onBack: fn(),
  },
} satisfies Meta<typeof ChatThreadLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — I01 full chat layout',
};

export const WithBottomCta: Story = {
  name: 'With bottom CTA',
  args: {
    bubbles: BUBBLES_DEFAULT,
    bottomCta: (
      <Button variant="pink-grad" className="flex-1">
        Lưu sản phẩm
      </Button>
    ),
  },
};

export const WithoutHeader: Story = {
  name: 'No header (no title, no back)',
  args: {
    title: undefined,
    onBack: undefined,
    bubbles: BUBBLES_DEFAULT,
  },
};

export const WithTopAction: Story = {
  name: 'With topAction slot',
  args: {
    bubbles: BUBBLES_DEFAULT,
    topAction: (
      <Button variant="link" size="sm">
        Xong
      </Button>
    ),
  },
};

export const WithAfterThread: Story = {
  name: 'With afterThread — live transcript I02-A pattern',
  args: {
    bubbles: BUBBLES_DEFAULT,
    afterThread: (
      <div className="mt-3">
        <LivePartialTranscript
          text="Anh đang nói... sữa chua Vinamilk"
          label="Tạm hiểu"
        />
      </div>
    ),
    bottomCta: (
      <Button variant="mic-grad" className="flex-1">
        Đang nghe...
      </Button>
    ),
  },
};

export const NoBottomCtaNoPadding: Story = {
  name: 'No bottomCta — MainScroll noBottomPadding auto (C-16)',
  args: {
    bubbles: BUBBLES_DEFAULT,
    bottomCta: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: 'bottomCta undefined → BottomBar not rendered → MainScroll noBottomPadding=true ' +
               'override T01 LAW padding-bottom 130px (per C-16 resolution).',
      },
    },
  },
};
