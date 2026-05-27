/**
 * apps/web/stories/icp/molecules/CoPurchaseCategoryHintCard.stories.tsx
 *
 * Storybook stories cho <CoPurchaseCategoryHintCard> — category-level
 * co-purchase AI bubble (mockup intent-04 state-0 lines 326-344).
 *
 * Slice: S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:  T02 FE + wire (Phiên Sx09-F) — AC25 build-storybook EXIT 0
 *
 * Coverage:
 * - Default: 2 targets per mockup ground truth ("nước ngọt", "trứng gà")
 * - SingleTarget: 1 CTA edge case
 * - ThreeTargets: max-3 per CoPurchaseHintSchema.max(3)
 * - WithIconMap: contextual icon hints per category (decorative)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CoPurchaseCategoryHintCard } from '@/components/icp/molecules/CoPurchaseCategoryHintCard';

const meta: Meta<typeof CoPurchaseCategoryHintCard> = {
  title: 'ICP/Molecules/CoPurchaseCategoryHintCard',
  component: CoPurchaseCategoryHintCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Category-level co-purchase AI bubble for /intent-04. Renders 1-3 CTAs from BE `final.co_purchase_hint` payload (analytics.co_purchased aggregation). DIFFERENT from S-04 `CoPurchaseHintCard` (product-level) — separate molecule per Phiên Sx09-E Section 6.E "CANNOT direct reuse" audit.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CoPurchaseCategoryHintCard>;

/** Mockup ground truth: state-0 line 336 — "mì ăn liền cay" + 2 targets. */
export const Default: Story = {
  args: {
    sourceCategory: 'mì ăn liền cay',
    targetCategories: ['nước ngọt', 'trứng gà'],
    confidence: 0.85,
    onCategoryTap: (cat, pos) => alert(`Tapped ${cat} @ ${pos}`),
  },
};

/** Single target — minimal edge case. */
export const SingleTarget: Story = {
  args: {
    sourceCategory: 'cà phê',
    targetCategories: ['sữa đặc'],
    confidence: 0.72,
  },
};

/** Three targets — max per CoPurchaseHintSchema.max(3). */
export const ThreeTargets: Story = {
  args: {
    sourceCategory: 'bia',
    targetCategories: ['đậu phộng', 'bánh tráng', 'khô bò'],
    confidence: 0.91,
  },
};

/** Contextual icon hints per category (decorative). */
export const WithIconMap: Story = {
  args: {
    sourceCategory: 'mì ăn liền cay',
    targetCategories: ['nước ngọt', 'trứng gà'],
    confidence: 0.85,
    iconMap: {
      'nước ngọt': 'tag',
      'trứng gà': 'package',
    },
  },
};

/** Empty targets — defensive render null check. */
export const EmptyTargets: Story = {
  args: {
    sourceCategory: 'unknown',
    targetCategories: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `targetCategories` is empty, component returns `null` (defensive). Caller should also gate render via `state.coPurchaseHint != null`.',
      },
    },
  },
};
