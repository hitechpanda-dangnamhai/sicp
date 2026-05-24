/**
 * apps/web/stories/icp/molecules/AddToCartConfirmCard.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule Storybook coverage (Phiên Sx04-9a)
 * Molecule: <AddToCartConfirmCard> (T04 NEW per D-S04-09 LAW)
 *
 * Stories (3):
 *   1. Default   — auto-dismiss 3s default + Hoàn tác button visible
 *   2. NoUndo    — onUndo undefined → Hoàn tác button hidden
 *   3. LongTitle — title 70 chars → line-clamp behavior verified
 *
 * AC8 coverage: green gradient card + check icon avatar + title text + body price + auto-dismiss.
 *
 * Note: Storybook stories run useEffect timer when mounted. Set autoDismissMs higher (e.g. 99999)
 * in stories for visual inspection; default 3000ms is correct for real flow.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AddToCartConfirmCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/AddToCartConfirmCard',
  component: AddToCartConfirmCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Green "Đã thêm vào giỏ" confirm card with internal auto-dismiss timer (S-03 D-29 LAW ' +
          'StrictMode-safe pattern — clearTimeout in useEffect cleanup essential for React 18 dev ' +
          'double-mount). NO toast library wrapping (W2 LOCK Sx04-9a-discover — no sonner / ' +
          'react-hot-toast / @radix-ui/react-toast installed). Standalone presentational; parent ' +
          'controls render via state machine.',
      },
    },
  },
  args: {
    product: {
      title: 'Nước tương Maggi 700ml',
      price: 25500,
    },
    onUndo: fn(),
    onDismiss: fn(),
    autoDismissMs: 99999, // long timeout for Storybook visual inspection
  },
} satisfies Meta<typeof AddToCartConfirmCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — 3s auto-dismiss + Hoàn tác button',
  args: {
    autoDismissMs: 3000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Real flow values. After 3s the onDismiss callback fires (T05 parent sets state.addToCartConfirm=null ' +
          'to unmount this component). StrictMode-safe via useEffect cleanup.',
      },
    },
  },
};

export const NoUndo: Story = {
  name: 'No undo — Hoàn tác button hidden',
  args: {
    onUndo: undefined,
    autoDismissMs: 99999,
  },
  parameters: {
    docs: {
      description: {
        story: 'When onUndo is undefined, the button is not rendered. Text block takes full width.',
      },
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title — line wrap behavior',
  args: {
    product: {
      title: 'Nước tương Maggi đậm đặc cao cấp loại đặc biệt 700ml dùng cho phở',
      price: 99500,
    },
    autoDismissMs: 99999,
  },
  parameters: {
    docs: {
      description: {
        story: 'Verifies long title wraps within card without overflow. Title block does NOT line-clamp by default; body text wraps.',
      },
    },
  },
};
