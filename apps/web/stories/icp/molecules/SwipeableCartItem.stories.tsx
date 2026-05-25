/**
 * apps/web/stories/icp/molecules/SwipeableCartItem.stories.tsx
 *
 * Slice: S-05 First Cart/Order Flow
 * Task:  T03 FE Page Wire (Phiên Sx05-3)
 *
 * Touch gesture testing is best done in real device / mobile emulation; Storybook
 * stories cover the controlled visual states (closed/swiped) via `swiped` prop.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  SwipeableCartItem,
  CartItemRow,
  type CartItemProduct,
} from '@/components/icp/molecules';
import { formatVNDCompact } from '@/lib/utils';

const PRODUCT_MAGGI: CartItemProduct = {
  brand: 'Maggi',
  name: 'Nước tương Maggi đậm đặc 700ml',
  price: 25500,
  originalPrice: 30000,
};

const meta = {
  title: 'Molecules/SwipeableCartItem',
  component: SwipeableCartItem,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
  },
  args: {
    swiped: false,
    onSwipeToggle: fn(),
    onDelete: fn(),
  },
  argTypes: {
    swiped: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SwipeableCartItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClosedDefault: Story = {
  name: 'Closed (default — content fills width)',
  args: {
    children: (
      <CartItemRow product={PRODUCT_MAGGI} qty={2} currencyFormatter={formatVNDCompact} />
    ),
  },
};

export const SwipedRevealed: Story = {
  name: 'Swiped (red delete bar revealed 72px)',
  args: {
    swiped: true,
    children: (
      <CartItemRow product={PRODUCT_MAGGI} qty={2} currencyFormatter={formatVNDCompact} />
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'swiped=true reveals red gradient action bar (72px wide) on right side. Tap red bar fires onDelete; ' +
          'tap CartItemRow body fires onSwipeToggle(false) to close. Mockup state-D line 186-223.',
      },
    },
  },
};
