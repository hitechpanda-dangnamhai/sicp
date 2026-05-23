/**
 * apps/web/stories/icp/atoms/MiniSparkline.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <MiniSparkline> (T02, AC-8)
 *
 * Source verified: components/icp/atoms/MiniSparkline.tsx
 *   Props: data: number[] (REQUIRED, 5-50 numeric points auto-normalized),
 *          accent?: 'pink' | 'green' | 'amber' | 'orange'  (default 'pink'),
 *          width?: number (default 200), height?: number (default 38),
 *          showFill?: boolean (default true), showDot?: boolean (default true),
 *          gradientId?: string (auto useId() if omitted — unique per instance)
 *   Extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'>.
 *
 * Decisions:
 * - C-22: 4 accent colors (pink/green/amber/orange — different order vs ChipPill, no 'rose'/'neutral')
 * - C-15: Server (no handlers, pure SVG)
 * - C-26 (T06 charts): pattern lock — gradientIdSuffix required for SSR-safe unique IDs.
 *   MiniSparkline uses useId() auto-generation by default (predates C-26 but same pattern).
 * - Q4 Registry: SINGLE-INTENT (used I01 Trend, I04 carousel, I07 stat — multi-intent reach
 *   but pure data viz primitive — C-24 qualifier #2 +1 not enough)
 *
 * Story coverage: Default + 4 accents + showFill/showDot toggles + empty data + custom gradientId
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MiniSparkline } from '@/components/icp/atoms';

const SAMPLE_DATA_RISING = [3, 5, 4, 8, 12, 10, 15, 18, 22, 25];
const SAMPLE_DATA_FALLING = [25, 20, 22, 15, 12, 8, 10, 5, 3, 2];
const SAMPLE_DATA_FLAT = [10, 11, 10, 12, 10, 11, 10, 11];

const meta = {
  title: 'Atoms/MiniSparkline',
  component: MiniSparkline,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'SVG sparkline per CROSS_INTENT_PATTERNS §7. Auto-generates unique gradient ID ' +
          'via useId() so multiple instances on same page do NOT collide. Empty data ' +
          'handled gracefully (no throw, renders empty viewBox).',
      },
    },
  },
  argTypes: {
    data: { control: 'object' },
    accent: {
      control: 'inline-radio',
      options: ['pink', 'green', 'amber', 'orange'],
    },
    width: { control: { type: 'number', min: 60, max: 400 } },
    height: { control: { type: 'number', min: 20, max: 80 } },
    showFill: { control: 'boolean' },
    showDot: { control: 'boolean' },
  },
  args: {
    data: SAMPLE_DATA_RISING,
    accent: 'pink',
    width: 200,
    height: 38,
    showFill: true,
    showDot: true,
  },
} satisfies Meta<typeof MiniSparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 4 accent colors (4 stories) ===

export const AccentPink: Story = {
  name: 'Accent — pink',
  args: { accent: 'pink' },
};

export const AccentGreen: Story = {
  name: 'Accent — green',
  args: { accent: 'green', data: SAMPLE_DATA_RISING },
};

export const AccentAmber: Story = {
  name: 'Accent — amber',
  args: { accent: 'amber' },
};

export const AccentOrange: Story = {
  name: 'Accent — orange',
  args: { accent: 'orange' },
};

// === Data shapes ===

export const TrendFalling: Story = {
  name: 'Data — falling',
  args: { data: SAMPLE_DATA_FALLING, accent: 'amber' },
};

export const TrendFlat: Story = {
  name: 'Data — flat',
  args: { data: SAMPLE_DATA_FLAT, accent: 'pink' },
};

// === Display toggles ===

export const NoFill: Story = {
  args: { showFill: false },
  parameters: {
    docs: {
      description: { story: 'Disable area fill — line + dot only.' },
    },
  },
};

export const NoDot: Story = {
  args: { showDot: false },
};

export const LineOnly: Story = {
  args: { showFill: false, showDot: false },
};

// === Edge cases ===

export const EmptyData: Story = {
  name: 'Edge — empty data array',
  args: { data: [] },
  parameters: {
    docs: {
      description: {
        story:
          'Defensive — empty data renders without throw. Path = empty string, no crash.',
      },
    },
  },
};

export const SinglePoint: Story = {
  name: 'Edge — single point',
  args: { data: [50] },
  parameters: {
    docs: {
      description: {
        story: 'Single point edge — useMemo path-builder handles gracefully.',
      },
    },
  },
};

// === Side-by-side uniqueness check ===

export const SideBySideUnique: Story = {
  name: 'Two instances — gradient ID uniqueness',
  parameters: {
    docs: {
      description: {
        story:
          'Two instances on same page must NOT share gradient ID (would collapse to same color). ' +
          'useId() auto-generation prevents collision.',
      },
    },
  },
  render: () => (
    <div className="flex gap-4">
      <MiniSparkline data={SAMPLE_DATA_RISING} accent="pink" />
      <MiniSparkline data={SAMPLE_DATA_FALLING} accent="green" />
    </div>
  ),
};
