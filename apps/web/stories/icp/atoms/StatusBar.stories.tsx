/**
 * apps/web/stories/icp/atoms/StatusBar.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <StatusBar> (T02, AC-1)
 *
 * Source verified: components/icp/atoms/StatusBar.tsx
 *   Props: time?: string ('9:41' default), batteryPct?: number (75 default, clampPct 0-100)
 *   Extends React.HTMLAttributes<HTMLDivElement>.
 *
 * Decisions:
 * - C-22 atom interface verify: prop signature read from source ./StatusBar.tsx
 * - C-08 VN strings: time string semantic only — N/A VN. Battery pct numeric.
 * - C-15 distribution: Server (pure presentational, no event handlers)
 * - Q4 Registry: SINGLE-INTENT (used I01/I02/I07 PhoneFrame header — not C-24 multi)
 *
 * Story coverage: Default + Low battery + Custom time + Edge clamping
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBar } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/StatusBar',
  component: StatusBar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'iPhone-style status bar mock (time + signal/wifi/battery icons). ' +
          'Pure presentational. Renders inside `<PhoneFrame>` header slot for I01/I02/I07.',
      },
    },
  },
  argTypes: {
    time: {
      control: 'text',
      description: 'Displayed time string. Default "9:41" (iPhone marketing time).',
    },
    batteryPct: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Battery percentage 0-100. Auto-clamped via clampPct().',
    },
  },
  args: {
    time: '9:41',
    batteryPct: 75,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 414, background: '#FFF8F0' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LowBattery: Story = {
  args: {
    batteryPct: 12,
  },
};

export const FullBattery: Story = {
  args: {
    batteryPct: 100,
  },
};

export const CustomTime: Story = {
  args: {
    time: '14:30',
    batteryPct: 85,
  },
};

export const EdgeClampOver: Story = {
  name: 'Edge — clamp > 100',
  args: {
    batteryPct: 150, // clampPct → 100
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests defensive clamping — input 150 should display as 100 (clampPct utility).',
      },
    },
  },
};

export const EdgeClampUnder: Story = {
  name: 'Edge — clamp < 0',
  args: {
    batteryPct: -20, // clampPct → 0
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests defensive clamping — input -20 should display as 0.',
      },
    },
  },
};
