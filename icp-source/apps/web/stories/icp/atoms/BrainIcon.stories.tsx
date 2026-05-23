/**
 * apps/web/stories/icp/atoms/BrainIcon.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <BrainIcon> (T02, AC-2, resolves C-06)
 *
 * Source verified: components/icp/atoms/BrainIcon.tsx
 *   Props: size?: 'sm'|'md'|'lg'|number (default 'md'),
 *          animated?: boolean (default true for lg, false otherwise),
 *          pixelSize?: number (override)
 *   Extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'>.
 *   Tier resolution: <32 → sm, 32-40 → md, >40 → lg
 *
 * Decisions:
 * - C-22: 3-tier implementation per C-06 verified — sm/md/lg distinct SVG paths
 * - C-06 (resolved T02): sm outline single-color; md two-tone linearGradient; lg full
 *   gradient + animated aura div + neural mesh + 5 nodes
 * - C-15: Server (no handlers, pure SVG)
 * - Q4 Registry: SINGLE-INTENT (multi-intent reach All Family A but pure presentational —
 *   no states/slots; C-24 qualifier #2 +1 multi-intent reach not enough alone)
 *
 * Story coverage: Default + 3 size tiers + animation toggle + numeric interpolation + pixelSize override
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BrainIcon } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/BrainIcon',
  component: BrainIcon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'AI brain icon with 3 size tiers per C-06. sm (<32px): outline using currentColor. ' +
          'md (32-40px): two-tone linearGradient. lg (>40px): full gradient + animated aura halo ' +
          '+ neural mesh + 5 pulse nodes. Tier auto-resolved from numeric `size`.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size tier sm/md/lg, or numeric pixel value (auto-resolves tier)',
    },
    animated: {
      control: 'boolean',
      description: 'Enable glow animation halo (default true for lg only, false otherwise)',
    },
    pixelSize: {
      control: { type: 'number', min: 16, max: 128 },
      description: 'Override pixel dimensions (rarely needed; prefer `size` prop)',
    },
  },
  args: {
    size: 'md',
  },
} satisfies Meta<typeof BrainIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SmallTier: Story = {
  name: 'Tier — sm (<32px outline)',
  args: { size: 'sm' },
  parameters: {
    docs: {
      description: {
        story: 'sm tier renders single-color outline using currentColor. Simplified silhouette.',
      },
    },
  },
};

export const MediumTier: Story = {
  name: 'Tier — md (32-40px two-tone)',
  args: { size: 'md' },
  parameters: {
    docs: {
      description: {
        story: 'md tier renders linearGradient SVG (pink → orange).',
      },
    },
  },
};

export const LargeTier: Story = {
  name: 'Tier — lg (>40px full + animated)',
  args: { size: 'lg' },
  parameters: {
    docs: {
      description: {
        story:
          'lg tier wraps SVG in animated aura div with radialGradient + neural mesh + 5 nodes. ' +
          'Auto-animated by default.',
      },
    },
  },
};

export const NumericInterpolation: Story = {
  name: 'Numeric size — 28px (resolves sm)',
  args: { size: 28 as unknown as 'sm' },
  parameters: {
    docs: {
      description: {
        story: 'Numeric size 28 < 32 → resolves to sm tier (outline). C-06 interpolation rule.',
      },
    },
  },
};

export const LargeAnimationOff: Story = {
  name: 'lg tier — animation off',
  args: { size: 'lg', animated: false },
  parameters: {
    docs: {
      description: {
        story: 'Explicitly disable animation on lg tier (override default true).',
      },
    },
  },
};

export const PixelSizeOverride: Story = {
  name: 'pixelSize override',
  args: { size: 'md', pixelSize: 56 },
  parameters: {
    docs: {
      description: {
        story:
          'pixelSize prop overrides tier-derived dimensions. Tier still resolves from `size` ' +
          '(md → two-tone gradient SVG), only px dimensions change.',
      },
    },
  },
};
