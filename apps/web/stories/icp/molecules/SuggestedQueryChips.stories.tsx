/**
 * apps/web/stories/icp/molecules/SuggestedQueryChips.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule Storybook coverage (Phiên Sx04-9a)
 * Molecule: <SuggestedQueryChips> (T04 NEW per D-S04-07 LAW Rule 6 EXCEPTION)
 *
 * Stories (3):
 *   1. Default — 3 D-S04-12 LAW chips: "Nước tương cho phở" / "Đồ cay cay ăn phở" / "Soy sauce for pho"
 *   2. Empty   — queries=[] (a11y verify no broken aria)
 *   3. Custom  — arbitrary 4 chips override default
 *
 * AC6 coverage: text content + sparkles leftIcon verified across all 3 chips.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SuggestedQueryChips } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/SuggestedQueryChips',
  component: SuggestedQueryChips,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pre-query welcome state chip row (D-S04-07 LAW Rule 6 EXCEPTION per S-03 D-28 precedent). ' +
          'Designer 14 mockup all show post-query; this synthesizes initial empty page. Default content ' +
          'per D-S04-12 LAW Part 2: mockup-perfect anchor + semantic abstraction + cross-language WOW.',
      },
    },
  },
  args: {
    queries: [
      'Nước tương cho phở',
      'Đồ cay cay ăn phở',
      'Soy sauce for pho',
    ],
    onTap: fn(),
  },
} satisfies Meta<typeof SuggestedQueryChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — D-S04-12 LAW Part 2 chips',
  parameters: {
    docs: {
      description: {
        story:
          '3 hardcoded chips per D-S04-12 LAW Part 2 (page-level default at T05 /intent-03/page.tsx). ' +
          'Position 0 "Nước tương cho phở" = mockup-perfect 4 cards exact match. ' +
          'Position 1 "Đồ cay cay ăn phở" = semantic abstraction → tuong_ot via CLIP multilingual. ' +
          'Position 2 "Soy sauce for pho" = cross-language English → Vietnamese WOW moment.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Empty — queries=[] (no chips)',
  args: { queries: [] },
  parameters: {
    docs: {
      description: {
        story: 'Renders empty container with aria-label still set. Accessibility-safe — no broken aria.',
      },
    },
  },
};

export const Custom: Story = {
  name: 'Custom — 4 arbitrary chips override',
  args: {
    queries: [
      'Mì tôm Hảo Hảo',
      'Dầu ăn Neptune',
      'Tương ớt cay',
      'Sữa Vinamilk',
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the molecule accepts arbitrary string[]; consumer can override default ' +
          'D-S04-12 LAW content for testing or future cross-slice reuse (e.g. S-09 image-recommend empty entry).',
      },
    },
  },
};
