/**
 * apps/web/stories/icp/molecules/ShopeeCompareCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <ShopeeCompareCard> (T04, Family A — compact-only per C-21)
 *
 * Source verified: components/icp/molecules/ShopeeCompareCard.tsx
 *   Props: userPrice: number (REQUIRED, VND),
 *          priceMin: number (REQUIRED),
 *          priceMax: number (REQUIRED),
 *          priceMedian: number (REQUIRED),
 *          label?: string (default 'GIÁ THỊ TRƯỜNG SHOPEE'),
 *          subtitle?: string (default 'Trung vị 5 cửa hàng'),
 *          onExpand?: () => void
 *   Computes userPct + medianPct positions on Min-Max range.
 *   Composes <Icon> + <Button>.
 *
 * Decisions applied:
 * - C-22 verify: 4 required price numbers + 3 optional props
 * - C-21 compact-only — expanded defer S-07
 * - C-15 Client (onExpand)
 * - C-07 navigation-agnostic
 * - C-08 VN labels default
 * - C-13 Omit: color omitted from HTMLAttributes (no collision in source — defensive)
 * - Q4 Registry: SINGLE-INTENT (fixed I07 dashboard widget)
 *
 * Story coverage: Default (user in range) + user under min + user over max + user at median
 *                 + custom label + with onExpand
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ShopeeCompareCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ShopeeCompareCard',
  component: ShopeeCompareCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Shopee market price compare widget (compact mode only per C-21). Shows user price ' +
          'position on Min-Max market range with median marker. formatVND utility formats prices ' +
          'as VND currency. Expanded mode defers to S-07 — onExpand callback routes there.',
      },
    },
  },
  argTypes: {
    userPrice: { control: { type: 'number', min: 0 } },
    priceMin: { control: { type: 'number', min: 0 } },
    priceMax: { control: { type: 'number', min: 0 } },
    priceMedian: { control: { type: 'number', min: 0 } },
    label: { control: 'text' },
    subtitle: { control: 'text' },
  },
  args: {
    userPrice: 62000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShopeeCompareCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UserInRange: Story = {
  name: 'User price in range (competitive)',
  args: {
    userPrice: 62000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
  },
};

export const UserUnderMin: Story = {
  name: 'User price below market min',
  args: {
    userPrice: 48000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'userPrice < priceMin → marker clamped to 0% position. Indicates user pricing too low.',
      },
    },
  },
};

export const UserOverMax: Story = {
  name: 'User price above market max',
  args: {
    userPrice: 85000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'userPrice > priceMax → marker clamped to 100% position. Indicates user pricing too high.',
      },
    },
  },
};

export const UserAtMedian: Story = {
  name: 'User price at median',
  args: {
    userPrice: 65000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
  },
};

export const WithOnExpand: Story = {
  name: 'With onExpand callback',
  args: {
    userPrice: 62000,
    priceMin: 55000,
    priceMax: 75000,
    priceMedian: 65000,
    onExpand: fn(),
  },
};

export const NarrowRange: Story = {
  name: 'Narrow market range',
  args: {
    userPrice: 60500,
    priceMin: 60000,
    priceMax: 62000,
    priceMedian: 61000,
  },
};
