/**
 * apps/web/stories/icp/layout/MainScroll.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Layout:  <MainScroll> (T03, AC-10..AC-12)
 *
 * Source verified: components/icp/layout/MainScroll.tsx
 *   Props: noBottomPadding?: boolean (default false),
 *          className?: string,
 *          children: ReactNode
 *   Client forwardRef. Wraps T01 .main-scroll class (flex: 1, overflow-y: auto,
 *   padding: 8px 18px 130px). C-16 override via inline style paddingBottom: 0.
 *
 * Decisions applied:
 * - C-16 RESOLVED — noBottomPadding override T01 LAW 130px when no BottomBar child
 * - C-15 Client — forwardRef pattern allows consumer ref access (scroll programmatic)
 * - C-22 prop signature verified from source
 * - Q4 Registry: SINGLE-INTENT (1 boolean prop, layout primitive)
 *
 * Story coverage: Default + noBottomPadding override + with content (scroll demo)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PhoneFrame, MainScroll, BottomBar } from '@/components/icp/layout';
import { Button } from '@/components/icp/atoms';

const meta = {
  title: 'Layout/MainScroll',
  component: MainScroll,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Scrollable middle layout primitive. Wraps T01 .main-scroll class baked padding-bottom ' +
          '130px to clear BottomBar. noBottomPadding prop overrides to 0 when consumer renders ' +
          'WITHOUT BottomBar child (per C-16). Client forwardRef for programmatic scroll access.',
      },
    },
  },
  argTypes: {
    noBottomPadding: {
      control: 'boolean',
      description:
        'Override T01 LAW padding-bottom 130px → 0. Use ONLY when no BottomBar child (C-16).',
    },
  },
  args: {
    noBottomPadding: false,
  },
  decorators: [
    (Story) => (
      <PhoneFrame mode="chat">
        <Story />
      </PhoneFrame>
    ),
  ],
} satisfies Meta<typeof MainScroll>;

export default meta;
type Story = StoryObj<typeof meta>;

const ScrollContent = () => (
  <div className="space-y-3 py-3">
    {Array.from({ length: 25 }).map((_, i) => (
      <div
        key={i}
        className="h-16 rounded-lg bg-icp-bg-tinted flex items-center px-4 text-sm"
      >
        Scroll item {i + 1}
      </div>
    ))}
  </div>
);

export const Default: Story = {
  name: 'Default — with BottomBar (T01 LAW 130px padding)',
  args: {
    noBottomPadding: false,
    children: <ScrollContent />,
  },
  decorators: [
    (Story) => (
      <PhoneFrame mode="chat">
        <Story />
        <BottomBar>
          <Button variant="pink-grad" className="flex-1">
            CTA cuối
          </Button>
        </BottomBar>
      </PhoneFrame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Default mode — T01 .main-scroll baked padding-bottom 130px clears the absolute-pinned ' +
          'BottomBar. Scroll content to end → last item should NOT be hidden behind BottomBar.',
      },
    },
  },
};

export const NoBottomPaddingOverride: Story = {
  name: 'noBottomPadding — override (no BottomBar)',
  args: {
    noBottomPadding: true,
    children: <ScrollContent />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'noBottomPadding=true → inline style paddingBottom: 0 overrides T01 LAW. Use when ' +
          'rendering MainScroll WITHOUT BottomBar child (e.g., I07 analytics page). C-16 resolution.',
      },
    },
  },
};

export const ShortContent: Story = {
  name: 'Short content — no scroll triggered',
  args: {
    noBottomPadding: false,
    children: (
      <div className="py-4 text-sm text-icp-text-muted">
        Short content — does not trigger scroll. flex: 1 fills available height.
      </div>
    ),
  },
};
