/**
 * apps/web/stories/icp/organisms/ChartLine.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ChartLine> (T06)
 *
 * Source verified: components/icp/organisms/charts/ChartLine.tsx
 *   Props: data: ChartLinePoint[] (REQUIRED, min 2 points sorted by x),
 *          gradientIdSuffix: string (REQUIRED — SSR-safe unique ID per C-26),
 *          ariaLabel?, width?: number (default 374), height?: number (default 200),
 *          accent?: 'pink'|'rose'|'green'|'amber'|'orange' (default 'pink'),
 *          padding?: number, showEndDot?: boolean (default true)
 *   Distribution: SERVER (per C-26 — Tailwind declarative + no hooks)
 *
 * Decisions applied:
 * - C-22 verify: 8 props from source
 * - C-15 Server (no hooks, no event handlers)
 * - C-26 SSR-safe IDs: caller MUST provide gradientIdSuffix (no useId)
 * - C-08 VN: ariaLabel default 'Biểu đồ đường'
 * - Q4 Registry: SINGLE-INTENT (data shape primitive)
 *
 * Story coverage: 5 accents + rising/falling/volatile data + dimensions + showEndDot toggle
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChartLine, type ChartLinePoint } from '@/components/icp/organisms';

const DATA_RISING: ChartLinePoint[] = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: 20 + i * 1.5,
}));

const DATA_FALLING: ChartLinePoint[] = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: 70 - i * 1.2,
}));

const DATA_VOLATILE: ChartLinePoint[] = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: 40 + Math.sin(i * 0.4) * 15 + Math.cos(i * 0.6) * 8,
}));

const meta = {
  title: 'Organisms/ChartLine',
  component: ChartLine,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'SVG line chart (Server-rendered per C-26). 5 accent colors with linearGradient fill ' +
          'under line. CALLER MUST provide unique `gradientIdSuffix` per instance — no useId() ' +
          'because Server component. Multiple instances same suffix → DOM ID collision (first ' +
          'gradient applies to all). ariaLabel descriptive recommended.',
      },
    },
  },
  argTypes: {
    accent: {
      control: 'inline-radio',
      options: ['pink', 'rose', 'green', 'amber', 'orange'],
    },
    width: { control: { type: 'number', min: 200, max: 600 } },
    height: { control: { type: 'number', min: 100, max: 400 } },
    showEndDot: { control: 'boolean' },
  },
  args: {
    data: DATA_RISING,
    gradientIdSuffix: 'meta-default',
    accent: 'pink',
    width: 374,
    height: 200,
    showEndDot: true,
  },
} satisfies Meta<typeof ChartLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 5 accents ===

export const AccentPink: Story = {
  name: 'Accent — pink',
  args: { accent: 'pink', gradientIdSuffix: 'story-pink', data: DATA_RISING },
};

export const AccentRose: Story = {
  name: 'Accent — rose',
  args: { accent: 'rose', gradientIdSuffix: 'story-rose', data: DATA_RISING },
};

export const AccentGreen: Story = {
  name: 'Accent — green',
  args: { accent: 'green', gradientIdSuffix: 'story-green', data: DATA_RISING },
};

export const AccentAmber: Story = {
  name: 'Accent — amber',
  args: { accent: 'amber', gradientIdSuffix: 'story-amber', data: DATA_RISING },
};

export const AccentOrange: Story = {
  name: 'Accent — orange',
  args: { accent: 'orange', gradientIdSuffix: 'story-orange', data: DATA_RISING },
};

// === Data shapes ===

export const RisingTrend: Story = {
  args: {
    data: DATA_RISING,
    gradientIdSuffix: 'story-rising',
    accent: 'green',
    ariaLabel: 'Doanh thu tăng trưởng 30 ngày',
  },
};

export const FallingTrend: Story = {
  args: {
    data: DATA_FALLING,
    gradientIdSuffix: 'story-falling',
    accent: 'amber',
    ariaLabel: 'Doanh thu giảm 30 ngày',
  },
};

export const Volatile: Story = {
  args: {
    data: DATA_VOLATILE,
    gradientIdSuffix: 'story-volatile',
    accent: 'pink',
  },
};

// === Options ===

export const NoEndDot: Story = {
  args: {
    data: DATA_RISING,
    gradientIdSuffix: 'story-no-dot',
    showEndDot: false,
  },
};

export const SmallSize: Story = {
  name: 'Small dimensions (200×100)',
  args: {
    data: DATA_RISING,
    gradientIdSuffix: 'story-small',
    width: 200,
    height: 100,
  },
};
