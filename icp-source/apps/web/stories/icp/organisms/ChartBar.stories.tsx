/**
 * apps/web/stories/icp/organisms/ChartBar.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ChartBar> (T06)
 *
 * Source verified: components/icp/organisms/charts/ChartBar.tsx
 *   Props: data: ChartBarDatum[] (REQUIRED — {label, value, color?}),
 *          gradientIdSuffix: string (REQUIRED — SSR-safe per C-26),
 *          ariaLabel?, width?, height?, accent?: 5 values,
 *          showLabels?: boolean (default true), showValues?: boolean (default false),
 *          barGap?: number (default 0.25)
 *   Distribution: SERVER (per C-26)
 *
 * Decisions applied:
 * - C-22 verify: 9 props from source
 * - C-15 Server (Tailwind declarative + no hooks)
 * - C-26 SSR-safe — caller provides gradientIdSuffix
 * - C-08 VN: ariaLabel default 'Biểu đồ cột'
 * - Q4 Registry: SINGLE-INTENT (categorical primitive)
 *
 * Story coverage: 5 accents + various data counts + showValues toggle + barGap variations
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChartBar, type ChartBarDatum } from '@/components/icp/organisms';

const DATA_WEEK: ChartBarDatum[] = [
  { label: 'T2', value: 45 },
  { label: 'T3', value: 62 },
  { label: 'T4', value: 38 },
  { label: 'T5', value: 71 },
  { label: 'T6', value: 55 },
  { label: 'T7', value: 88 },
  { label: 'CN', value: 92 },
];

const DATA_MONTH: ChartBarDatum[] = Array.from({ length: 12 }, (_, i) => ({
  label: `T${i + 1}`,
  value: 30 + Math.round(Math.random() * 70),
}));

const DATA_FEW: ChartBarDatum[] = [
  { label: 'Pink', value: 60 },
  { label: 'Green', value: 80 },
  { label: 'Amber', value: 45 },
];

const meta = {
  title: 'Organisms/ChartBar',
  component: ChartBar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'SVG bar chart (Server-rendered per C-26). 5 accent colors with vertical linearGradient ' +
          '(top→bottom). showValues toggle for value labels above bars. showLabels for label below. ' +
          'barGap controls spacing as fraction of bar width.',
      },
    },
  },
  argTypes: {
    accent: {
      control: 'inline-radio',
      options: ['pink', 'rose', 'green', 'amber', 'orange'],
    },
    showLabels: { control: 'boolean' },
    showValues: { control: 'boolean' },
    barGap: { control: { type: 'range', min: 0.05, max: 0.5, step: 0.05 } },
  },
  args: {
    data: DATA_WEEK,
    gradientIdSuffix: 'meta-default',
    accent: 'pink',
    showLabels: true,
    showValues: false,
    barGap: 0.25,
  },
} satisfies Meta<typeof ChartBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 5 accents ===

export const AccentPink: Story = {
  args: { accent: 'pink', gradientIdSuffix: 'story-pink', data: DATA_WEEK },
};

export const AccentGreen: Story = {
  args: { accent: 'green', gradientIdSuffix: 'story-green', data: DATA_WEEK },
};

export const AccentAmber: Story = {
  args: { accent: 'amber', gradientIdSuffix: 'story-amber', data: DATA_WEEK },
};

export const AccentRose: Story = {
  args: { accent: 'rose', gradientIdSuffix: 'story-rose', data: DATA_WEEK },
};

export const AccentOrange: Story = {
  args: { accent: 'orange', gradientIdSuffix: 'story-orange', data: DATA_WEEK },
};

// === Options ===

export const ShowValues: Story = {
  name: 'showValues=true (values above bars)',
  args: {
    data: DATA_WEEK,
    gradientIdSuffix: 'story-values',
    showValues: true,
  },
};

export const NoLabels: Story = {
  name: 'showLabels=false (no x-axis text)',
  args: {
    data: DATA_WEEK,
    gradientIdSuffix: 'story-no-labels',
    showLabels: false,
  },
};

export const ManyBars: Story = {
  name: '12 bars (month view)',
  args: {
    data: DATA_MONTH,
    gradientIdSuffix: 'story-month',
    accent: 'pink',
  },
};

export const FewBars: Story = {
  name: '3 bars (minimum case)',
  args: {
    data: DATA_FEW,
    gradientIdSuffix: 'story-few',
    accent: 'pink',
    showValues: true,
  },
};

export const TightGap: Story = {
  name: 'Tight barGap (0.05)',
  args: {
    data: DATA_WEEK,
    gradientIdSuffix: 'story-tight',
    barGap: 0.05,
  },
};

export const WideGap: Story = {
  name: 'Wide barGap (0.5)',
  args: {
    data: DATA_WEEK,
    gradientIdSuffix: 'story-wide',
    barGap: 0.5,
  },
};
