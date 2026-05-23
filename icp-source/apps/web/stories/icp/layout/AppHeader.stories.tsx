/**
 * apps/web/stories/icp/layout/AppHeader.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Layout:  <AppHeader> (T03, AC-19..AC-22)
 *
 * Source verified: components/icp/layout/AppHeader.tsx
 *   Props: title: string (REQUIRED),
 *          subtitle?: string,
 *          live?: boolean (default false — renders green pulse dot before subtitle),
 *          onBack?: () => void  (omitted → back button not rendered),
 *          onAction?: () => void  (omitted → action icon not rendered),
 *          actionIcon?: IconName (default 'more-vertical' per KI-7 T03 lesson),
 *          className?: string
 *   Client component. Used I07 analytics dashboard header (separate from chat TopBar).
 *
 * Decisions applied:
 * - C-15 Client distribution — 2 event handlers (onBack + onAction)
 * - C-08 VN — title + subtitle VN strings, aria-label="Quay lại" baked
 * - C-22 prop signature verified from source
 * - KI-7 T03 lesson: actionIcon default 'more-vertical' (NOT undefined)
 * - icon-map verify: 'more-vertical' ✅ register; 'chevron-left' ✅ register
 * - Q4 Registry: MULTI-INTENT qualifier ≥2: 6 optional props + live boolean state +
 *   conditional render (back/action) = multi-intent compose primitive
 *
 * Story coverage: Default + with live + with onBack only + with onAction + custom actionIcon + full
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PhoneFrame, AppHeader } from '@/components/icp/layout';
import { StatusBar } from '@/components/icp/atoms';

const meta = {
  title: 'Layout/AppHeader',
  component: AppHeader,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'I07 analytics dashboard header (separate from chat TopBar). title REQUIRED + ' +
          'subtitle + live pulse dot + back + action icon. live=true renders green 6×6 ' +
          'pulse dot before subtitle (per mockup .live-dot CSS). actionIcon defaults to ' +
          '"more-vertical" per KI-7 T03 lesson — explicit default in source destructure.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    live: { control: 'boolean' },
    actionIcon: {
      control: 'select',
      options: ['more-vertical', 'more-horizontal', 'settings', 'bell'],
      description: 'Right action icon name (default "more-vertical")',
    },
  },
  args: {
    title: 'Phân tích dữ liệu',
    subtitle: 'đang trợ giúp',
    live: false,
  },
  decorators: [
    (Story) => (
      <PhoneFrame mode="app">
        <StatusBar />
        <Story />
        <div className="p-4 text-sm text-icp-text-muted">
          Analytics dashboard content. AppHeader is flex-shrink-0 above scrollable page content.
        </div>
      </PhoneFrame>
    ),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Phân tích dữ liệu',
    subtitle: 'đang trợ giúp',
  },
};

export const TitleOnly: Story = {
  name: 'Title only (no subtitle, no back, no action)',
  args: {
    title: 'Tiêu đề',
    subtitle: undefined,
    onBack: undefined,
    onAction: undefined,
  },
};

export const WithLiveDot: Story = {
  name: 'live=true — green pulse dot',
  args: {
    title: 'Phân tích trực tiếp',
    subtitle: 'cập nhật real-time · 2 giây trước',
    live: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'live=true renders 6×6 green dot with glow ring before subtitle text. Used in I07 ' +
          'when analytics data streams in real-time.',
      },
    },
  },
};

export const WithBackButton: Story = {
  name: 'With onBack callback',
  args: {
    title: 'Báo cáo chi tiết',
    subtitle: 'Tháng 5/2026',
    onBack: fn(),
  },
};

export const WithAction: Story = {
  name: 'With onAction (default more-vertical icon)',
  args: {
    title: 'Phân tích dữ liệu',
    subtitle: 'đang trợ giúp',
    onAction: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'onAction defined → action icon button rendered. actionIcon defaults to "more-vertical" ' +
          'per KI-7 T03 explicit default in source destructure (NOT undefined).',
      },
    },
  },
};

export const CustomActionIcon: Story = {
  name: 'Custom actionIcon — settings',
  args: {
    title: 'Cài đặt nâng cao',
    onAction: fn(),
    actionIcon: 'settings',
  },
};

export const FullComposition: Story = {
  name: 'Full — all props active',
  args: {
    title: 'Phân tích dữ liệu',
    subtitle: 'đang trợ giúp · cập nhật real-time',
    live: true,
    onBack: fn(),
    onAction: fn(),
    actionIcon: 'more-vertical',
  },
  parameters: {
    docs: {
      description: {
        story:
          'I07 full pattern from acceptance state I07-C-chart-line: back button + title + ' +
          'subtitle with live pulse + action menu (more-vertical kebab).',
      },
    },
  },
};
