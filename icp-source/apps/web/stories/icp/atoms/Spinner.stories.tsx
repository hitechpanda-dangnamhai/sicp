/**
 * apps/web/stories/icp/atoms/Spinner.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <Spinner> (T02, AC-11)
 *
 * Source verified: components/icp/atoms/Spinner.tsx
 *   Props: size?: 'sm'|'md'|'lg'|number (default 'md'), color?: 'pink'|'white'|'currentColor' (default 'pink')
 *   Extends React.SVGAttributes<SVGSVGElement>.
 *
 * Decisions:
 * - C-22: SIZE_MAP keys = sm/md/lg, color enum 3 values verified from source
 * - C-15: Server (no handlers, pure SVG)
 * - Q4 Registry: SINGLE-INTENT (loading state primitive — used by Button + I01/I02/I07)
 *
 * Story coverage: Default + 3 sizes + 3 colors + numeric size override
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Spinner } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'SVG loading spinner with rotating dashed stroke. Consumed by `<Button loading>` + ' +
          'I01/I02/I07 phase indicators. role="status" + aria-label="loading" baked.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size token sm (16px) / md (20px) / lg (32px), or numeric pixel value',
    },
    color: {
      control: 'inline-radio',
      options: ['pink', 'white', 'currentColor'],
      description: 'Stroke color: pink (MoMo default), white (on dark bg), currentColor (inherit)',
    },
  },
  args: {
    size: 'md',
    color: 'pink',
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SmallSize: Story = {
  args: { size: 'sm' },
};

export const LargeSize: Story = {
  args: { size: 'lg' },
};

export const PinkOnLight: Story = {
  name: 'Color — pink (default)',
  args: { color: 'pink', size: 'md' },
};

export const WhiteOnDark: Story = {
  name: 'Color — white (dark bg)',
  args: { color: 'white', size: 'md' },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const CurrentColor: Story = {
  name: 'Color — currentColor (inherit)',
  args: { color: 'currentColor', size: 'md' },
  decorators: [
    (Story) => (
      <div style={{ color: '#F97316' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Inherits color from parent — wrap in element with desired text color.',
      },
    },
  },
};

export const NumericSize: Story = {
  name: 'Numeric size — 48px override',
  args: { size: 48 as unknown as 'md' /* arg control type narrows; runtime accepts number */ },
  parameters: {
    docs: {
      description: {
        story: 'Spinner accepts numeric size for custom dimensions (Button leftIcon path uses this).',
      },
    },
  },
};
