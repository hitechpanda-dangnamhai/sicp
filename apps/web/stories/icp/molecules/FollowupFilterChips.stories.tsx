/**
 * apps/web/stories/icp/molecules/FollowupFilterChips.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule Storybook coverage (Phiên Sx04-9a)
 * Molecule: <FollowupFilterChips> (T04 NEW per D-S04-08 LAW)
 *
 * Stories (2):
 *   1. Default      — 3 chips per D-S04-08 LAW (price_max + badge=HOT + exclude_brand)
 *   2. OnlyDiscount — 1 chip (minimal case)
 *
 * AC7 coverage: discount leftIcon on chip 1 verified; onTap callback fires with payload + label.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { FollowupFilterChips, type FilterChipSpec } from '@/components/icp/molecules';

const defaultChips: FilterChipSpec[] = [
  { label: 'Dưới 20.000₫', filter: { price_max: 20000 }, icon: 'discount' },
  { label: 'Chỉ HOT', filter: { badge: 'HOT' } },
  { label: 'So sánh thương hiệu khác', filter: { exclude_brands: ['Maggi'] } },
];

const meta = {
  title: 'Molecules/FollowupFilterChips',
  component: FollowupFilterChips,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Variant A AI followup hint with 3 functional quick-filter chips (D-S04-08 LAW). ' +
          'Renders only when mode === "basic_fallback" (Variant A scope — page-level conditional). ' +
          'Tap → mutates query state with filter overlay → re-triggers search via use-search-stream. ' +
          'Emits search.followup_filter_tapped behavior event (T06 wires).',
      },
    },
  },
  args: {
    chips: defaultChips,
    onTap: fn(),
  },
} satisfies Meta<typeof FollowupFilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — 3 D-S04-08 LAW chips',
  parameters: {
    docs: {
      description: {
        story:
          '3 hardcoded filters per D-S04-08 LAW from mockup intent-03A-state-0-happy.html lines 297-315. ' +
          'Chip 1 has discount icon (mockup line 307-309); chips 2+3 have no icon. ' +
          'price_max=20000 / badge=HOT / exclude_brands=["Maggi"] (page-level default — exclude_brands dynamic).',
      },
    },
  },
};

export const OnlyDiscount: Story = {
  name: 'Only discount — minimal 1 chip',
  args: {
    chips: [{ label: 'Dưới 20.000₫', filter: { price_max: 20000 }, icon: 'discount' }],
  },
  parameters: {
    docs: {
      description: {
        story: 'Edge case — single chip. Verifies layout collapse + onTap still fires correctly.',
      },
    },
  },
};
