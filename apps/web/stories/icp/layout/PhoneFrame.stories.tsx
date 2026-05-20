/**
 * apps/web/stories/icp/layout/PhoneFrame.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Layout:  <PhoneFrame> (T03, AC-1..AC-9)
 *
 * Source verified: components/icp/PhoneFrame.tsx (root path per D-01 lock)
 *   Props: mode: 'chat' | 'app'  REQUIRED no default (per C-01),
 *          className?: string,
 *          children: ReactNode
 *   Wraps T01 .phone-frame class (width 414 + height 844 + max-height calc(100vh-48px)
 *   Bug 2 fix universal both modes per C-02).
 *
 * Decisions applied:
 * - C-01 mode required (no default — TS enforces)
 * - C-02 Bug 2 universal via T01 .phone-frame base CSS
 * - C-17 REWRITE replaces S-00b T08 placeholder
 * - C-18 Tier 1 wraps T01 class
 * - C-22 prop signature read from source
 * - Q4 Registry: MULTI-INTENT (qualifier ≥2/3): 2 modes + reuse 8 V-SLICEs
 *
 * Story coverage:
 *   - Default chat mode + Default app mode
 *   - Chat with TopBar + MainScroll + BottomBar composition (I01 layout pattern)
 *   - App with AppHeader + scroll content (I05/I06/I08 layout pattern)
 *   - Bug 2 viewport demo — small viewport triggers max-height clamp
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  PhoneFrame,
  MainScroll,
  BottomBar,
  TopBar,
  AppHeader,
} from '@/components/icp/layout';
import { Button, StatusBar } from '@/components/icp/atoms';

const meta = {
  title: 'Layout/PhoneFrame',
  component: PhoneFrame,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'transparent' },
    docs: {
      description: {
        component:
          'Phone frame wrapper. 2 modes: "chat" (Family A I01/I02/I07 — internal scroll ' +
          'via MainScroll child) and "app" (Family B I03/I04/I05/I06/I08 — page-level scroll ' +
          'within frame). Width 414 + height 844 + max-height calc(100vh-48px) Bug 2 fix ' +
          'baked into T01 .phone-frame class.',
      },
    },
  },
  argTypes: {
    mode: {
      control: 'inline-radio',
      options: ['chat', 'app'],
      description: 'REQUIRED — no default. Chat = internal scroll (Family A). App = page scroll (Family B).',
    },
  },
  args: {
    mode: 'chat',
  },
} satisfies Meta<typeof PhoneFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

// === Mode showcase ===

export const ModeChat: Story = {
  name: 'Mode — chat (Family A internal scroll)',
  args: {
    mode: 'chat',
    children: (
      <div className="flex items-center justify-center w-full h-full text-icp-text-muted">
        <p className="text-sm">Chat mode — overflow: hidden. Scroll via MainScroll child.</p>
      </div>
    ),
  },
};

export const ModeApp: Story = {
  name: 'Mode — app (Family B page scroll)',
  args: {
    mode: 'app',
    children: (
      <div className="p-4 text-icp-text-muted">
        <p className="text-sm">App mode — overflow-y: auto. Page scrolls directly within frame.</p>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-md bg-icp-bg-tinted flex items-center px-4 text-xs"
            >
              Block {i + 1} (scroll demo)
            </div>
          ))}
        </div>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '30 content blocks force scroll — verify page-level scroll active in app mode.',
      },
    },
  },
};

// === Composition examples ===

export const ChatWithCompoundLayout: Story = {
  name: 'Chat — full I01 composition',
  args: {
    mode: 'chat',
    children: (
      <>
        <StatusBar />
        <TopBar
          title="Phân tích sản phẩm"
          onBack={() => alert('Quay lại')}
        />
        <MainScroll>
          <div className="space-y-4 py-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-lg bg-icp-bg-tinted flex items-center px-4 text-sm"
              >
                Chat message {i + 1}
              </div>
            ))}
          </div>
        </MainScroll>
        <BottomBar>
          <Button variant="pink-grad" className="flex-1">
            Lưu sản phẩm
          </Button>
        </BottomBar>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full I01 composition pattern: StatusBar + TopBar (flex-shrink-0) + MainScroll ' +
          '(flex-1 auto) + BottomBar (absolute pinned bottom). Scroll mid-position should NOT ' +
          'leak content through BottomBar (Bug 1 fix locked into T01 .bottom-bar CSS).',
      },
    },
  },
};

export const AppWithHeader: Story = {
  name: 'App — full I07 composition',
  args: {
    mode: 'app',
    children: (
      <>
        <StatusBar />
        <AppHeader
          title="Phân tích dữ liệu"
          subtitle="đang trợ giúp · cập nhật real-time"
          live
          onBack={() => alert('Quay lại')}
          onAction={() => alert('Menu')}
        />
        <div className="p-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="mb-3 h-24 rounded-xl bg-icp-bg-tinted flex items-center px-4 text-sm"
            >
              Analytics card {i + 1}
            </div>
          ))}
        </div>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full I07 composition: AppHeader with live-pulse dot + page-scroll content. ' +
          'No <BottomBar> in I07 — analytics dashboard uses page scroll only.',
      },
    },
  },
};

// === Bug 2 viewport demo ===

export const Bug2ViewportClamp: Story = {
  name: 'Bug 2 — max-height clamp on small viewport',
  args: {
    mode: 'chat',
    children: (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <p className="text-sm text-icp-text-muted">
          Resize browser height &lt; 892px to trigger Bug 2 fix: phone-frame max-height = calc(100vh - 48px).
          Frame should shrink instead of overflowing viewport.
        </p>
      </div>
    ),
  },
  parameters: {
    viewport: { defaultViewport: 'phone-small' },
    docs: {
      description: {
        story:
          'Bug 2 fix verification: T01 .phone-frame { max-height: calc(100vh - 48px) } prevents ' +
          'overflow on laptop low-height viewports. Resize browser → frame shrinks, bottom stays attached.',
      },
    },
  },
};
