/**
 * apps/web/stories/icp/organisms/ChartDonut.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ChartDonut> (T06)
 *
 * Source verified: components/icp/organisms/charts/ChartDonut.tsx
 *   Props: segments: ChartDonutSegment[] (REQUIRED — {label, value, color?}),
 *          ariaLabel?, width?: number (default 200), height?,
 *          innerRadius?: number (default 50; 0 = pie chart),
 *          outerRadius?: number (default (width/2)-8),
 *          centerLabel?: ReactNode (slot for total/text in donut hole)
 *   Distribution: SERVER (per C-26 — no gradient IDs needed, solid fills)
 *
 * Decisions applied:
 * - C-22 verify: 7 props from source
 * - C-15 Server (solid segment fills, no gradient ID required)
 * - C-08 VN: ariaLabel default 'Biểu đồ tròn'
 * - Q4 Registry: SINGLE-INTENT (proportional primitive)
 *
 * Story coverage: Default + various segment counts + pie variant (innerRadius=0) + center label
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChartDonut, type ChartDonutSegment } from '@/components/icp/organisms';

const SEGMENTS_3: ChartDonutSegment[] = [
  { label: 'Sữa', value: 45 },
  { label: 'Bánh', value: 30 },
  { label: 'Đồ uống', value: 25 },
];

const SEGMENTS_5: ChartDonutSegment[] = [
  { label: 'Sữa', value: 35 },
  { label: 'Bánh', value: 25 },
  { label: 'Đồ uống', value: 20 },
  { label: 'Mỹ phẩm', value: 12 },
  { label: 'Khác', value: 8 },
];

const SEGMENTS_2_EVEN: ChartDonutSegment[] = [
  { label: 'A', value: 50 },
  { label: 'B', value: 50 },
];

const meta = {
  title: 'Organisms/ChartDonut',
  component: ChartDonut,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'SVG donut chart (Server-rendered per C-26). Solid segment fills (no gradient ID ' +
          'required — unlike ChartLine/Bar). innerRadius=0 → pie chart. centerLabel slot accepts ' +
          'ReactNode for total/label in donut hole. Default 7-color MoMo palette rotation.',
      },
    },
  },
  argTypes: {
    width: { control: { type: 'number', min: 100, max: 400 } },
    innerRadius: { control: { type: 'range', min: 0, max: 90 } },
  },
  args: {
    segments: SEGMENTS_3,
    width: 200,
    innerRadius: 50,
  },
} satisfies Meta<typeof ChartDonut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Segment counts ===

export const Segments3: Story = {
  name: '3 segments — basic ratio',
  args: { segments: SEGMENTS_3 },
};

export const Segments5: Story = {
  name: '5 segments — palette rotation',
  args: { segments: SEGMENTS_5 },
};

export const Segments2Even: Story = {
  name: '2 segments — 50/50 split',
  args: { segments: SEGMENTS_2_EVEN },
};

export const SingleSegment: Story = {
  name: 'Single segment — 100%',
  args: { segments: [{ label: 'Tất cả', value: 100 }] },
};

// === innerRadius variants ===

export const PieChart: Story = {
  name: 'Pie chart — innerRadius=0',
  args: { segments: SEGMENTS_3, innerRadius: 0 },
};

export const ThinDonut: Story = {
  name: 'Thin donut — innerRadius=75',
  args: { segments: SEGMENTS_3, innerRadius: 75 },
};

export const ThickDonut: Story = {
  name: 'Thick donut — innerRadius=20',
  args: { segments: SEGMENTS_3, innerRadius: 20 },
};

// === Center label ===

export const WithCenterLabel: Story = {
  name: 'With centerLabel — total text',
  args: {
    segments: SEGMENTS_3,
    centerLabel: (
      <div className="text-center">
        <div className="text-xl font-bold text-icp-rose-700 font-mono">100%</div>
        <div className="text-[10px] text-icp-text-muted uppercase tracking-wider">Tổng</div>
      </div>
    ),
  },
};

// === Custom colors ===

export const CustomColors: Story = {
  name: 'Custom segment colors',
  args: {
    segments: [
      { label: 'Pink', value: 40, color: '#E91E63' },
      { label: 'Green', value: 35, color: '#10B981' },
      { label: 'Amber', value: 25, color: '#F59E0B' },
    ],
  },
};
