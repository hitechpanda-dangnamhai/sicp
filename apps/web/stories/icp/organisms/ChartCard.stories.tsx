/**
 * apps/web/stories/icp/organisms/ChartCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <ChartCard> (T06)
 *
 * Source verified: components/icp/organisms/ChartCard.tsx
 *   Props: title: string (REQUIRED), children: ReactNode (REQUIRED chart body),
 *          meta?, tag?: ChartCardTag ({ label, color? }),
 *          live?: boolean, phases?: PhaseItem[], phasesHeader?,
 *          defaultExpanded?, expanded? (controlled), onExpandedChange?,
 *          stats?: ReactNode
 *   Distribution: CLIENT (expand toggle state)
 *
 * Decisions applied:
 * - C-22 verify: 10 props from source
 * - C-15 Client (expand state — onExpandedChange handler)
 * - C-26 chart child must provide gradientIdSuffix (SSR-safe IDs)
 * - C-04 phases embed PhasesCard mode="card"
 * - A4 pattern: children REQUIRED ReactNode → placeholder needed
 * - Q4 Registry: MULTI-INTENT (multiple optional slots + expand state + live indicator)
 *
 * Story coverage: Default + with tag/live/phases/stats + chart body integrations
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ChartCard, ChartLine, ChartBar, ChartDonut } from '@/components/icp/organisms';
import { StatPill } from '@/components/icp/atoms';
import { type PhaseItem } from '@/components/icp/molecules';

const LINE_DATA = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: 20 + Math.sin(i * 0.3) * 8 + i * 0.4,
}));

const BAR_DATA = [
  { label: 'T2', value: 45 },
  { label: 'T3', value: 62 },
  { label: 'T4', value: 38 },
  { label: 'T5', value: 71 },
  { label: 'T6', value: 55 },
  { label: 'T7', value: 88 },
  { label: 'CN', value: 92 },
];

const DONUT_SEGMENTS = [
  { label: 'Sữa', value: 45 },
  { label: 'Bánh', value: 30 },
  { label: 'Đồ uống', value: 25 },
];

const PHASES_ANALYZING: PhaseItem[] = [
  { id: '1', label: 'Tải dữ liệu', meta: 'Shopee API · 1.2s', status: 'done' },
  { id: '2', label: 'Phân tích trend', meta: 'đang chạy...', status: 'active' },
  { id: '3', label: 'Sinh insight', status: 'pending' },
];

const meta = {
  title: 'Organisms/ChartCard',
  component: ChartCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Chart wrapper card with header (title + meta + tag + live indicator) + body slot ' +
          '(ChartLine/Bar/Donut) + optional phases (analyzing stage embedded PhasesCard) + ' +
          'optional stats footer (StatPill row) + expand/collapse toggle.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    meta: { control: 'text' },
    live: { control: 'boolean' },
    defaultExpanded: { control: 'boolean' },
  },
  args: {
    title: 'Doanh thu',
    meta: '30 ngày qua',
    children: null, // A4 — required ReactNode override per render
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <ChartCard {...args}>
      <ChartLine
        data={LINE_DATA}
        accent="pink"
        gradientIdSuffix="default-revenue"
        ariaLabel="Doanh thu 30 ngày qua"
      />
    </ChartCard>
  ),
};

export const WithChartLine: Story = {
  name: 'With ChartLine body (pink accent)',
  args: { title: 'Doanh thu', meta: '30 ngày qua' },
  render: (args) => (
    <ChartCard {...args}>
      <ChartLine
        data={LINE_DATA}
        accent="pink"
        gradientIdSuffix="story-line-pink"
        ariaLabel="Doanh thu 30 ngày qua"
      />
    </ChartCard>
  ),
};

export const WithChartBar: Story = {
  name: 'With ChartBar body (green accent)',
  args: { title: 'Đơn hàng', meta: '7 ngày' },
  render: (args) => (
    <ChartCard {...args}>
      <ChartBar
        data={BAR_DATA}
        accent="green"
        gradientIdSuffix="story-bar-green"
        ariaLabel="Đơn hàng 7 ngày qua"
        showValues
      />
    </ChartCard>
  ),
};

export const WithChartDonut: Story = {
  name: 'With ChartDonut body',
  args: { title: 'Phân bố ngành hàng', meta: 'Tháng này' },
  render: (args) => (
    <ChartCard {...args}>
      <ChartDonut
        segments={DONUT_SEGMENTS}
        ariaLabel="Phân bố ngành hàng tháng này"
      />
    </ChartCard>
  ),
};

export const WithTag: Story = {
  name: 'With header tag (DOANH THU pink)',
  args: {
    title: 'Doanh thu',
    meta: '30 ngày',
    tag: { label: 'DOANH THU', color: 'pink' },
  },
  render: (args) => (
    <ChartCard {...args}>
      <ChartLine
        data={LINE_DATA}
        accent="pink"
        gradientIdSuffix="story-tag"
      />
    </ChartCard>
  ),
};

export const WithLiveIndicator: Story = {
  name: 'With live=true (pulse dot)',
  args: {
    title: 'Đơn hàng đang đến',
    meta: 'Cập nhật real-time',
    live: true,
  },
  render: (args) => (
    <ChartCard {...args}>
      <ChartBar
        data={BAR_DATA}
        accent="green"
        gradientIdSuffix="story-live"
      />
    </ChartCard>
  ),
};

export const WithPhases: Story = {
  name: 'With phases — analyzing stage (C-04 PhasesCard embed)',
  args: {
    title: 'Phân tích đang chạy',
    phases: PHASES_ANALYZING,
    phasesHeader: { icon: 'zap', title: 'Tiến trình', subtitle: '3 bước · 1/3 hoàn thành' },
  },
  render: (args) => (
    <ChartCard {...args}>
      <ChartLine
        data={LINE_DATA}
        accent="amber"
        gradientIdSuffix="story-phases"
      />
    </ChartCard>
  ),
};

export const WithStats: Story = {
  name: 'With stats footer (StatPill row)',
  args: {
    title: 'Doanh thu',
    meta: '30 ngày',
    stats: (
      <div className="flex gap-2 mt-3">
        <StatPill value="+45%" label="Tăng trưởng" accent="green" />
        <StatPill value="12k" label="Đơn" accent="pink" />
        <StatPill value="98%" label="Chính xác" accent="amber" />
      </div>
    ),
  },
  render: (args) => (
    <ChartCard {...args}>
      <ChartLine
        data={LINE_DATA}
        accent="pink"
        gradientIdSuffix="story-stats"
      />
    </ChartCard>
  ),
};

export const ExpandToggle: Story = {
  name: 'Expand toggle (uncontrolled)',
  args: {
    title: 'Báo cáo chi tiết',
    meta: 'Bấm để mở rộng',
    defaultExpanded: false,
    onExpandedChange: fn(),
  },
  render: (args) => (
    <ChartCard {...args}>
      <ChartBar
        data={BAR_DATA}
        accent="pink"
        gradientIdSuffix="story-expand"
      />
    </ChartCard>
  ),
};
