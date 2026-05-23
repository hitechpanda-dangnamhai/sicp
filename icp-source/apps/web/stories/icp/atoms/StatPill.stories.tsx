/**
 * apps/web/stories/icp/atoms/StatPill.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <StatPill> (T02, AC-7)
 *
 * Source verified: components/icp/atoms/StatPill.tsx
 *   Props: value: string | number (REQUIRED),
 *          label: string (REQUIRED, uppercase auto-applied),
 *          accent?: 'pink' | 'orange' | 'amber' | 'green'  (default 'pink'),
 *          sparkline?: React.ReactNode (slot for <MiniSparkline />)
 *   Extends React.HTMLAttributes<HTMLDivElement>.
 *
 * Decisions:
 * - C-22: 4 accent colors verified (NOT 6 — atom is simpler than ChipPill); 'green' native
 * - C-15: Server (no handlers, slot composition)
 * - C-08 VN: label hardcoded VN by consumer
 * - Q4 Registry: SINGLE-INTENT (used I01/I07 stat cells)
 *
 * Story coverage: Default + 4 accent stories + sparkline slot example + numeric value
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatPill, MiniSparkline } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/StatPill',
  component: StatPill,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Stat cell with value (JetBrains Mono bold) + label (uppercase tracking) + ' +
          'optional sparkline slot. 4 accent colors tinted on value text + border. ' +
          'Used I01 BrainCard stats + I07 analytics dashboard.',
      },
    },
  },
  argTypes: {
    value: { control: 'text' },
    label: { control: 'text' },
    accent: {
      control: 'inline-radio',
      options: ['pink', 'orange', 'amber', 'green'],
    },
  },
  args: {
    value: '~3s',
    label: 'Thời gian',
    accent: 'pink',
  },
} satisfies Meta<typeof StatPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 4 accent colors ===

export const AccentPink: Story = {
  name: 'Accent — pink',
  args: { accent: 'pink', value: '98%', label: 'Chính xác' },
};

export const AccentOrange: Story = {
  name: 'Accent — orange',
  args: { accent: 'orange', value: '12', label: 'Đơn hàng' },
};

export const AccentAmber: Story = {
  name: 'Accent — amber',
  args: { accent: 'amber', value: '5', label: 'Cảnh báo' },
};

export const AccentGreen: Story = {
  name: 'Accent — green',
  args: { accent: 'green', value: '+18%', label: 'Tăng trưởng' },
};

// === Slot composition ===

export const WithSparkline: Story = {
  name: 'With sparkline slot',
  args: {
    value: '8.5K',
    label: 'Doanh thu',
    accent: 'pink',
    sparkline: (
      <MiniSparkline
        data={[10, 14, 12, 18, 22, 19, 25, 28]}
        accent="pink"
        width={80}
        height={20}
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'sparkline slot accepts <MiniSparkline /> element. Auto-stacks under label.',
      },
    },
  },
};

export const NumericValue: Story = {
  args: { value: 1234, label: 'Tổng số' },
  parameters: {
    docs: {
      description: {
        story: 'value accepts string | number. Number passed as-is to JSX (renders correctly).',
      },
    },
  },
};
