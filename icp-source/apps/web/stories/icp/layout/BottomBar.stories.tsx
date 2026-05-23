/**
 * apps/web/stories/icp/layout/BottomBar.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Layout:  <BottomBar> (T03, AC-13..AC-15)
 *
 * Source verified: components/icp/layout/BottomBar.tsx
 *   Props: className?: string, children: ReactNode
 *   Server component (no 'use client', pure wrapper). Wraps T01 .bottom-bar class
 *   baked into globals.css @layer base (Bug 1 fix LOCKED — absolute pinned bottom
 *   with white bg + safe-area-inset padding + top border).
 *
 * Decisions applied:
 * - C-15 Server distribution — no event handlers, pure presentational wrap
 * - C-18 Tier 1 — wraps T01 .bottom-bar baked CSS, does NOT redefine
 * - Bug 1 fix LOCKED — T01 .bottom-bar has white bg + z-index above MainScroll content
 *   → scroll content does NOT leak through
 * - C-22 props minimal — only className + children
 * - Q4 Registry: SINGLE-INTENT (atom-level wrapper for T01 baked CSS class)
 *
 * Story coverage: Default with CTA + Multiple buttons row + Inside PhoneFrame composition
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PhoneFrame, MainScroll, BottomBar } from '@/components/icp/layout';
import { Button } from '@/components/icp/atoms';

const meta = {
  title: 'Layout/BottomBar',
  component: BottomBar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Bottom action bar wrap. Pure Server component wrapping T01 .bottom-bar class ' +
          '(baked white bg + absolute pinned + safe-area-inset + top border). Bug 1 fix LOCKED ' +
          'in T01 globals.css @layer base — content scroll does NOT leak through. ' +
          'Used I01/I02 chat CTAs + I04 cart actions + I05 shipping confirm.',
      },
    },
  },
  decorators: [
    (Story) => (
      <PhoneFrame mode="chat">
        <MainScroll>
          <div className="py-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="mb-3 h-16 rounded-lg bg-icp-bg-tinted flex items-center px-4 text-sm"
              >
                Scroll content item {i + 1} (verify no leak through BottomBar)
              </div>
            ))}
          </div>
        </MainScroll>
        <Story />
      </PhoneFrame>
    ),
  ],
} satisfies Meta<typeof BottomBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — single CTA',
  args: {
    children: (
      <Button variant="pink-grad" className="flex-1">
        Lưu sản phẩm
      </Button>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Single full-width CTA (I01 pattern). Scroll content above should NOT leak through ' +
          'BottomBar — white bg + z-index from T01 .bottom-bar handles cascade.',
      },
    },
  },
};

export const TwoButtons: Story = {
  name: 'Two CTAs side-by-side',
  args: {
    children: (
      <>
        <Button variant="ghost" className="flex-1">
          Hủy
        </Button>
        <Button variant="pink-grad" className="flex-1">
          Xác nhận
        </Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two side-by-side CTAs (I04 cart pattern). flex-1 on each button distributes ' +
          'equally. gap baked into T01 .bottom-bar.',
      },
    },
  },
};

export const IconCta: Story = {
  name: 'CTA with icon',
  args: {
    children: (
      <Button variant="pink-grad" leftIcon="check" className="flex-1">
        Xác nhận thanh toán
      </Button>
    ),
  },
};
