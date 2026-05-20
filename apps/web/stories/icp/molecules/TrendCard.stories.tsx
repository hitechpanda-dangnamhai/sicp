/**
 * apps/web/stories/icp/molecules/TrendCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <TrendCard> (T04, Family A — compact-only per C-21)
 *
 * Source verified: components/icp/molecules/TrendCard.tsx
 *   Props: delta: number (REQUIRED — signed pct, e.g., 45 → "+45%"),
 *          sparklineData: number[] (REQUIRED — 30-90 typical data points),
 *          label?: string (default 'GOOGLE TRENDS'),
 *          subtitle?: string,
 *          chips?: TrendChipData[] ({ label, delta? }),
 *          onExpand?: () => void  (caller routes to S-07 expanded page)
 *   Composes <MiniSparkline> atom (accent 'green' baked) + ChipPill + Button.
 *
 * Decisions applied:
 * - C-22 verify: 5 props, all primitives + composed atoms
 * - C-21 compact-only — expanded modes defer to S-07 V-SLICE per Task Pack §3
 * - C-15 Client (onExpand callback)
 * - C-07 navigation-agnostic — onExpand callback only
 * - C-08 VN labels
 * - Q4 Registry: SINGLE-INTENT (compact-only, fixed I07 dashboard widget)
 *
 * Story coverage: Default rising + falling + custom label + with chips + with onExpand
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TrendCard, type TrendChipData } from '@/components/icp/molecules';

const SPARKLINE_RISING = [10, 14, 12, 18, 22, 19, 25, 28, 24, 30, 35, 32, 40, 45, 50];
const SPARKLINE_FALLING = [50, 45, 48, 40, 35, 38, 30, 25, 28, 22, 18, 15, 12, 10, 8];
const SPARKLINE_FLAT = Array.from({ length: 15 }, (_, i) => 20 + Math.sin(i * 0.5) * 3);

const CHIPS_RISING: TrendChipData[] = [
  { label: 'sữa chua', delta: 45 },
  { label: 'men sống', delta: 32 },
  { label: 'probiotic', delta: 18 },
];

const meta = {
  title: 'Molecules/TrendCard',
  component: TrendCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Google Trends widget (compact mode only per C-21). Header label + signed delta + ' +
          'MiniSparkline (emerald accent) + optional rising-keywords chips. Expanded mode ' +
          'defers to S-07 V-SLICE — onExpand callback routes there. Used I07 dashboard.',
      },
    },
  },
  argTypes: {
    delta: { control: { type: 'number', min: -100, max: 100 } },
    sparklineData: { control: 'object' },
    label: { control: 'text' },
    subtitle: { control: 'text' },
  },
  args: {
    delta: 45,
    sparklineData: SPARKLINE_RISING,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RisingTrend: Story = {
  name: 'Rising trend +45%',
  args: { delta: 45, sparklineData: SPARKLINE_RISING },
};

export const FallingTrend: Story = {
  name: 'Falling trend -38%',
  args: { delta: -38, sparklineData: SPARKLINE_FALLING },
};

export const FlatTrend: Story = {
  name: 'Flat trend (low movement)',
  args: { delta: 2, sparklineData: SPARKLINE_FLAT },
};

export const WithChips: Story = {
  name: 'With rising-keywords chips',
  args: {
    delta: 45,
    sparklineData: SPARKLINE_RISING,
    subtitle: 'Tăng vọt 7 ngày qua',
    chips: CHIPS_RISING,
  },
};

export const CustomLabel: Story = {
  args: {
    delta: 28,
    sparklineData: SPARKLINE_RISING,
    label: 'TRENDING - SHOPEE',
    subtitle: 'Top tìm kiếm 24h',
  },
};

export const WithOnExpand: Story = {
  name: 'With onExpand callback',
  args: {
    delta: 45,
    sparklineData: SPARKLINE_RISING,
    chips: CHIPS_RISING,
    onExpand: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'onExpand callback fires when CTA tapped. Caller routes to S-07 expanded view.',
      },
    },
  },
};
