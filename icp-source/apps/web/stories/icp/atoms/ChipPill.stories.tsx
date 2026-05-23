/**
 * apps/web/stories/icp/atoms/ChipPill.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <ChipPill> (T02, AC-6)
 *
 * Source verified: components/icp/atoms/ChipPill.tsx CVA chipPillVariants
 *   variants:
 *     variant: filter | tag | badge | status  (4 — NOT 'chip' per T04 KI-3 lesson)
 *     color: pink | rose | orange | amber | green | neutral  (6 — green native via C-11)
 *     size: sm | md  (2)
 *     interactive: true | false  (2)
 *   defaultVariants: { variant: 'filter', color: 'pink', size: 'md', interactive: false }
 *   compoundVariants: 24 (variant × color combinations)
 *   Props: leftIcon?: IconName, selected?: boolean, onClick?: (e) => void,
 *          children: ReactNode (REQUIRED)
 *   Extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onClick' | 'color'>
 *
 * Decisions:
 * - C-22: variant 'filter' default (NOT 'chip'); color 'green' native via C-11
 * - C-13 Omit: 'color' Omit-ed from HTMLAttributes (CVA color collision per T04 lesson)
 * - C-15: interactive mode → onClick handler — Client distribution required when interactive=true
 * - C-08 VN: children labels VN
 * - Q4 Registry: SINGLE-INTENT (atom-level wrapper)
 *
 * Story coverage: Default + 4 variant stories + 6 color stories + interactive + selected + leftIcon
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ChipPill } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/ChipPill',
  component: ChipPill,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '4 variants × 6 colors compound chip atom. Used I02 example-tag (tag variant), ' +
          'I03/I04 filter chips (filter variant), I01 AI-VISION badge (badge variant), ' +
          'status indicators (status variant). interactive mode adds role="button" + ' +
          'aria-pressed + Enter/Space keyboard handler.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['filter', 'tag', 'badge', 'status'],
    },
    color: {
      control: 'select',
      options: ['pink', 'rose', 'orange', 'amber', 'green', 'neutral'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md'],
    },
    interactive: {
      control: 'boolean',
      description: 'Enable click + role="button" + aria-pressed + keyboard handlers',
    },
    selected: {
      control: 'boolean',
      description: 'data-state="active" — drives Tailwind data-active: variants',
    },
    leftIcon: {
      control: 'text',
      description: 'IconName from lib/icon-map',
    },
  },
  args: {
    variant: 'filter',
    color: 'pink',
    size: 'md',
    interactive: false,
    selected: false,
    children: 'Tất cả',
    onClick: fn(),
  },
} satisfies Meta<typeof ChipPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === 4 variants (4 stories) ===

export const VariantFilter: Story = {
  name: 'Variant — filter (default soft bg + border)',
  args: { variant: 'filter', children: 'Sữa chua' },
};

export const VariantTag: Story = {
  name: 'Variant — tag (gradient bg + white text)',
  args: { variant: 'tag', children: 'Khuyến mãi' },
};

export const VariantBadge: Story = {
  name: 'Variant — badge (uppercase mini)',
  args: { variant: 'badge', children: 'HOT' },
};

export const VariantStatus: Story = {
  name: 'Variant — status (rounded with icon prefix)',
  args: { variant: 'status', leftIcon: 'check', children: 'Đã xác nhận' },
};

// === 6 colors filter variant (6 stories) ===

export const ColorPink: Story = {
  name: 'Color — pink',
  args: { variant: 'filter', color: 'pink', children: 'Hồng' },
};

export const ColorRose: Story = {
  name: 'Color — rose',
  args: { variant: 'filter', color: 'rose', children: 'Đào' },
};

export const ColorOrange: Story = {
  name: 'Color — orange',
  args: { variant: 'filter', color: 'orange', children: 'Cam' },
};

export const ColorAmber: Story = {
  name: 'Color — amber',
  args: { variant: 'filter', color: 'amber', children: 'Hổ phách' },
};

export const ColorGreen: Story = {
  name: 'Color — green (native C-11)',
  args: { variant: 'filter', color: 'green', children: 'Xanh lá' },
};

export const ColorNeutral: Story = {
  name: 'Color — neutral',
  args: { variant: 'filter', color: 'neutral', children: 'Trung tính' },
};

// === Interactive + state ===

export const Interactive: Story = {
  args: { interactive: true, children: 'Bấm vào' },
  parameters: {
    docs: {
      description: {
        story: 'interactive=true adds role="button" + aria-pressed + Enter/Space keyboard handler.',
      },
    },
  },
};

export const SelectedActive: Story = {
  name: 'Selected — data-active variant',
  args: { interactive: true, selected: true, children: 'Đã chọn' },
  parameters: {
    docs: {
      description: {
        story: 'selected=true sets data-state="active" → drives data-active: Tailwind variant.',
      },
    },
  },
};

export const WithLeftIcon: Story = {
  args: { variant: 'status', color: 'green', leftIcon: 'check', children: 'Hoàn tất' },
};

export const SmallSize: Story = {
  args: { size: 'sm', variant: 'badge', children: 'AI VISION' },
};
