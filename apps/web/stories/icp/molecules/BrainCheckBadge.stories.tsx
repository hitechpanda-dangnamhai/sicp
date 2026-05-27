/**
 * apps/web/stories/icp/molecules/BrainCheckBadge.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <BrainCheckBadge> — Brain mascot XL with green check-pop badge.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-G-success.html lines 245-310
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 *   - Q2 option 2 LOCK (Phiên Sx07-F): BrainCheckBadge tách riêng làm sub-molecule
 *     (reusable: SuccessTransition consumer + future S-09 reco-confirm)
 *
 * Stories (3):
 *   1. Default       — 140×140 brain (mockup state-G compact)
 *   2. HeroLarge     — 180×180 brain (LoginSuccessTransition precedent size)
 *   3. NoCheck       — 140×140 brain without check-pop badge (e.g. loading state)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BrainCheckBadge } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/BrainCheckBadge',
  component: BrainCheckBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Brain mascot XL with green check-pop badge bottom-right and optional pulse-ring aura. ' +
          'Extracted as a sub-molecule from LoginSuccessTransition per Q2 option 2 LOCK Phiên Sx07-F ' +
          'for reuse in SuccessTransition (S-07 state-G) and future S-09 reco-confirm flow. ' +
          'Check badge is sized proportionally (27% of brain size).',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'range', min: 60, max: 240, step: 10 } },
    showCheck: { control: 'boolean' },
    showPulseRing: { control: 'boolean' },
  },
  args: {
    size: 140,
    showCheck: true,
    showPulseRing: true,
    ariaLabel: 'Phân tích thành công',
  },
} satisfies Meta<typeof BrainCheckBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default (140×140 — state-G compact)',
  parameters: {
    docs: {
      description: {
        story:
          'Default size 140×140 per mockup state-G layout (3 stat-cells row + 2 CTAs + progress bar — ' +
          'smaller brain keeps vertical compact).',
      },
    },
  },
};

export const HeroLarge: Story = {
  name: 'Hero large (180×180 — LoginSuccessTransition precedent)',
  args: { size: 180 },
  parameters: {
    docs: {
      description: {
        story: '180×180 size matches LoginSuccessTransition S-03 precedent (lines 119-216).',
      },
    },
  },
};

export const NoCheck: Story = {
  name: 'No check badge (loading state variant)',
  args: { showCheck: false },
  parameters: {
    docs: {
      description: {
        story:
          'Brain without check-pop badge — useful for in-progress states before success is confirmed.',
      },
    },
  },
};
