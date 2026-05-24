/**
 * apps/web/stories/icp/molecules/CoPurchaseHintCard.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule Storybook coverage (Phiên Sx04-9a)
 * Molecule: <CoPurchaseHintCard> (T04 NEW per D-S04-09 + D-S04-12 LAW)
 *
 * Stories (2):
 *   1. Default — mockup-perfect: 68% Chin-su 250g 17000đ + "đã bán 2.1k" green
 *   2. LowRate — ratePct=42 edge case (low-confidence hint)
 *
 * AC9 coverage: header rate% + suggested product brand/name/price + "+" button onAddSuggested.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { CoPurchaseHintCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/CoPurchaseHintCard',
  component: CoPurchaseHintCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Variant B post-cart-add cross-sell hint. Renders ONLY when parent receives co_purchase_hint ' +
          'SSE event after cart.item_added (D-S04-09 LAW). Mockup-perfect default per D-S04-12 LAW: ' +
          'Chin-su 250g (tuong_ot category 11th) at 17.000₫. Forward-compat: S-09 Image Recommend ' +
          'may reuse this molecule when image-based co-purchase added.',
      },
    },
  },
  args: {
    hint: {
      ratePct: 68,
      reason: 'Khách phở thường thêm tương ớt cay',
      suggestedProduct: {
        brand: 'CHIN-SU',
        name: 'Tương ớt Chin-su 250g',
        price: 17000,
        imageGradient: 'linear-gradient(135deg, #FEE2E2, #F87171)',
        imageIcon: 'bottle',
        soldCount: 'đã bán 2.1k',
      },
      anchorCategory: 'nuoc_tuong',
      suggestedCategory: 'tuong_ot',
    },
    onAddSuggested: fn(),
  },
} satisfies Meta<typeof CoPurchaseHintCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default — mockup-perfect (68% Chin-su 250g)',
  parameters: {
    docs: {
      description: {
        story:
          'Mockup intent-03B-state-E-cart.html lines 228-251 verbatim. ' +
          '68% rate badge + Chin-su 250g 17.000₫ with "đã bán 2.1k" green + pink "+" button. ' +
          'data-anchor-category="nuoc_tuong" + data-suggested-category="tuong_ot" exposed for debug.',
      },
    },
  },
};

export const LowRate: Story = {
  name: 'Low rate — 42% (edge case)',
  args: {
    hint: {
      ratePct: 42,
      reason: 'Một số khách kèm thêm',
      suggestedProduct: {
        brand: 'NEPTUNE',
        name: 'Dầu ăn Neptune 1L',
        price: 38000,
        imageGradient: 'linear-gradient(135deg, #FEF9C3, #FCD34D)',
        imageIcon: 'bottle',
        soldCount: 'đã bán 540',
      },
      anchorCategory: 'nuoc_tuong',
      suggestedCategory: 'dau_an',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Low-confidence hint (rate < 50%). Verifies rounding works correctly + card still renders with same visual structure.',
      },
    },
  },
};
