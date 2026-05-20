/**
 * apps/web/stories/icp/atoms/OrbPulse.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <OrbPulse> (T02, AC-10 — resolves SEMANTIC §0.3 fragmentation)
 *
 * Source verified: components/icp/atoms/OrbPulse.tsx STATE_CONFIG
 *   Props: size?: 'sm' | 'md' | 'lg'  (default 'md', pixels 60/120/180),
 *          state?: 'idle' | 'listening' | 'analyzing' | 'error'  (default 'idle'),
 *          icon?: React.ReactNode (slot for <Icon /> inside core, e.g., mic button),
 *          pulseRings?: 0 | 1 | 2 | 3 (override default ring count from state config)
 *   STATE_CONFIG: { idle:2, listening:3, analyzing:2, error:0 } ring counts
 *   Animations: idle (none), listening (animate-glow), analyzing (animate-drift), error (animate-shake)
 *
 * Decisions:
 * - C-22: 4 states + 3 sizes verified from STATE_CONFIG source
 * - C-15: Server (pure presentational, no handlers — handlers come from MicButton wrapper T04)
 * - Q4 Registry: SINGLE-INTENT (4 states + 3 sizes but no slot props beyond icon — fail qualifier #2)
 *
 * Note: 23 source classes (orb/mic/brain/error variants) consolidated into single component per
 * SEMANTIC §0.3 — single source of truth for orb visual.
 *
 * Story coverage: Default + 4 state stories + 3 size stories + with mic icon + custom rings
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OrbPulse, Icon } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/OrbPulse',
  component: OrbPulse,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '4-state × 3-size orb atom — consolidates 23 source classes (orb/mic/brain/error). ' +
          'idle (2 rings, no animation), listening (3 rings, animate-glow), ' +
          'analyzing (2 rings, animate-drift), error (0 rings, animate-shake). ' +
          'Wrapped by <MicButton> (T04) — voice CTA + cart-add micro.',
      },
    },
  },
  argTypes: {
    state: {
      control: 'inline-radio',
      options: ['idle', 'listening', 'analyzing', 'error'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
    pulseRings: {
      control: 'inline-radio',
      options: [0, 1, 2, 3],
    },
  },
  args: {
    state: 'idle',
    size: 'md',
  },
} satisfies Meta<typeof OrbPulse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 4 states (4 stories) ===

export const StateIdle: Story = {
  name: 'State — idle (2 rings, static)',
  args: { state: 'idle' },
};

export const StateListening: Story = {
  name: 'State — listening (3 rings, glow)',
  args: { state: 'listening' },
};

export const StateAnalyzing: Story = {
  name: 'State — analyzing (2 rings, drift)',
  args: { state: 'analyzing' },
};

export const StateError: Story = {
  name: 'State — error (0 rings, shake)',
  args: { state: 'error' },
};

// === 3 sizes (3 stories) ===

export const SizeSm: Story = {
  name: 'Size — sm (60px)',
  args: { size: 'sm', state: 'listening' },
};

export const SizeMd: Story = {
  name: 'Size — md (120px)',
  args: { size: 'md', state: 'listening' },
};

export const SizeLg: Story = {
  name: 'Size — lg (180px voice-stage)',
  args: { size: 'lg', state: 'listening' },
  parameters: {
    docs: {
      description: {
        story: 'lg = 180px — voice-stage size for I02 full-screen voice recording UI.',
      },
    },
  },
};

// === Icon slot ===

export const WithMicIcon: Story = {
  name: 'Icon slot — mic (CTA preview)',
  args: {
    state: 'listening',
    size: 'md',
    icon: <Icon name="mic" size={32} className="text-white" />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'icon slot accepts ReactNode rendered inside core. T04 <MicButton> uses this pattern ' +
          'to compose voice CTA. White Icon for contrast against pink gradient core.',
      },
    },
  },
};

// === Custom pulseRings override ===

export const CustomPulseRings: Story = {
  name: 'pulseRings override — 1 ring',
  args: { state: 'listening', pulseRings: 1 },
  parameters: {
    docs: {
      description: {
        story: 'pulseRings prop overrides state config default (listening default = 3 rings).',
      },
    },
  },
};
