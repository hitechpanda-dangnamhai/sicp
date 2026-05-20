/**
 * apps/web/stories/icp/layout/TopBar.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Layout:  <TopBar> (T03, AC-16..AC-18)
 *
 * Source verified: components/icp/layout/TopBar.tsx
 *   Props: title?: string,
 *          onBack?: () => void  (omitted → back button not rendered),
 *          action?: ReactNode (optional right-side slot),
 *          className?: string
 *   Client component (uses onClick handler on back button).
 *   Uses Icon name="chevron-left" — verified register in icon-map.
 *
 * Decisions applied:
 * - C-15 Client distribution — onClick on back button requires client boundary
 * - C-08 VN — aria-label="Quay lại" baked in source
 * - C-22 prop signature verified from source
 * - Q4 Registry: SINGLE-INTENT (used I01/I02 chat headers — 3 optional props compose
 *   conditionally, but qualifier #2 ≤2 → SINGLE-INTENT)
 *
 * Story coverage: Default + onBack only + with action + with title only + full composition
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PhoneFrame, TopBar, MainScroll } from '@/components/icp/layout';
import { Button, StatusBar } from '@/components/icp/atoms';

const meta = {
  title: 'Layout/TopBar',
  component: TopBar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Top navigation bar for chat-mode screens (I01/I02). 3 optional slots: title + ' +
          'onBack (back button rendered conditional) + action (right slot ReactNode). ' +
          'aria-label="Quay lại" baked into back button per C-08 VN.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    onBack: { action: 'onBack-clicked' },
    action: { control: false },
  },
  args: {
    title: 'Phân tích sản phẩm',
    onBack: fn(),
  },
  decorators: [
    (Story) => (
      <PhoneFrame mode="chat">
        <StatusBar />
        <Story />
        <MainScroll>
          <div className="py-4 text-sm text-icp-text-muted">
            Chat content area (scroll). TopBar sits above as flex-shrink-0 sibling.
          </div>
        </MainScroll>
      </PhoneFrame>
    ),
  ],
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Phân tích sản phẩm',
    onBack: fn(),
  },
};

export const TitleOnly: Story = {
  name: 'Title only (no back, no action)',
  args: {
    title: 'Tiêu đề thuần',
    onBack: undefined,
  },
};

export const BackOnly: Story = {
  name: 'onBack only (no title)',
  args: {
    title: undefined,
    onBack: fn(),
  },
};

export const WithAction: Story = {
  name: 'With action slot',
  args: {
    title: 'Sản phẩm',
    onBack: fn(),
    action: (
      <Button variant="link" size="sm">
        Lưu
      </Button>
    ),
  },
};

export const FullComposition: Story = {
  name: 'Full — back + title + action',
  args: {
    title: 'Chi tiết đơn hàng',
    onBack: fn(),
    action: (
      <Button variant="ghost" size="icon" leftIcon="more-vertical">
        {undefined}
      </Button>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'All 3 slots active. action slot accepts ReactNode — typically `<Button variant="link">` ' +
          'or icon-only Button. Right-aligned in flex container.',
      },
    },
  },
};
