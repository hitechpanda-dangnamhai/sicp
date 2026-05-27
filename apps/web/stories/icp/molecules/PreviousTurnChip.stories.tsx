/**
 * apps/web/stories/icp/molecules/PreviousTurnChip.stories.tsx
 *
 * Storybook stories cho <PreviousTurnChip> — collapsed previous-turn chip
 * for state-F re-upload (mockup intent-04 state-F lines 207-215).
 *
 * Slice: S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:  T02 FE + wire (Phiên Sx09-F) — AC25 build-storybook EXIT 0
 *
 * Coverage:
 * - Default: mockup ground truth "10 gợi ý mì cay"
 * - WithCustomGradient: alt brand gradient color
 * - WithCustomIcon: alt category icon
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PreviousTurnChip } from '@/components/icp/molecules/PreviousTurnChip';

const meta: Meta<typeof PreviousTurnChip> = {
  title: 'ICP/Molecules/PreviousTurnChip',
  component: PreviousTurnChip,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Collapsed previous-turn chip for state-F re-upload thread navigation per D-S09-NN-B LAW. Consumer (intent-04 page) renders one per item in `previousTurns[]`.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PreviousTurnChip>;

/** Mockup ground truth: state-F line 212 — "10 gợi ý mì cay". */
export const Default: Story = {
  args: {
    summary: '10 gợi ý mì cay',
    iconHint: 'image',
    onClick: () => alert('Scroll to turn'),
  },
};

/** Alt category — green gradient + leaf icon. */
export const WithCustomGradient: Story = {
  args: {
    summary: '8 gợi ý rau xanh',
    iconHint: 'tag',
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
  },
};

/** Edge case — short summary with package icon. */
export const ShortSummary: Story = {
  args: {
    summary: '3 gợi ý',
    iconHint: 'package',
  },
};
