/**
 * apps/web/stories/icp/molecules/DrillChipRow.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <DrillChipRow> (T04, Family A)
 *
 * Source verified: components/icp/molecules/DrillChipRow.tsx
 *   Props: chips: DrillChip[] (REQUIRED — {id, label, active?, prefix?}),
 *          onSelect?: (id: string) => void  (custom signature, Omit-ed from HTMLAttributes)
 *
 * Decisions applied:
 * - C-22 verify: chip shape from DrillChip interface
 * - C-13 Omit: onSelect omitted from HTMLAttributes (custom (id) => void signature)
 * - C-15 Client (onClick handler on each chip button)
 * - C-07 navigation-agnostic — onSelect callback only, no routing
 * - role="tablist" + role="tab" + aria-selected baked
 * - Q4 Registry: SINGLE-INTENT (used I07 drill-down chips below charts)
 *
 * Story coverage: Default + various chip counts + with prefix + all-active mode (rare)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DrillChipRow, type DrillChip } from '@/components/icp/molecules';
import { Icon } from '@/components/icp/atoms';

const CHIPS_BASIC: DrillChip[] = [
  { id: 'all', label: 'Tất cả', active: true },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: '90d', label: '90 ngày' },
];

const CHIPS_WITH_PREFIX: DrillChip[] = [
  { id: 'top', label: 'Hot', active: true, prefix: <Icon name="trending-up" size={12} /> },
  { id: 'new', label: 'Mới', prefix: <Icon name="sparkles" size={12} /> },
  { id: 'sale', label: 'Giảm giá', prefix: <Icon name="tag" size={12} /> },
];

const meta = {
  title: 'Molecules/DrillChipRow',
  component: DrillChipRow,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Horizontal scrollable chip row for drill-down filtering. role="tablist" with each ' +
          'chip role="tab" + aria-selected. onSelect callback receives chip.id (C-07 navigation-' +
          'agnostic). Active chip renders gradient bg, inactive renders white + pink border.',
      },
    },
  },
  args: {
    chips: CHIPS_BASIC,
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DrillChipRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoneActive: Story = {
  name: 'No active chip',
  args: {
    chips: CHIPS_BASIC.map((c) => ({ ...c, active: false })),
  },
};

export const WithPrefixIcons: Story = {
  name: 'Chips with prefix icons',
  args: { chips: CHIPS_WITH_PREFIX },
};

export const ManyChips: Story = {
  name: 'Many chips — horizontal scroll',
  args: {
    chips: [
      { id: '1', label: 'Tất cả', active: true },
      { id: '2', label: 'Sữa' },
      { id: '3', label: 'Bánh' },
      { id: '4', label: 'Đồ uống' },
      { id: '5', label: 'Đồ ăn nhanh' },
      { id: '6', label: 'Mỹ phẩm' },
      { id: '7', label: 'Gia dụng' },
      { id: '8', label: 'Khác' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Overflow chips trigger horizontal scroll via flex + overflow-x-auto. Scrollbar hidden.',
      },
    },
  },
};
