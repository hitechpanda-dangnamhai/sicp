/**
 * apps/web/stories/icp/molecules/ProductCardSearchB.stories.tsx
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule Storybook coverage (Phiên Sx04-9a)
 * Molecule: <ProductCardSearchB> (T04 NEW per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-03/intent-03B-state-0-happy.html lines 181-289 (4 cards: 98%/91%/87%/79%)
 *
 * Stories (6):
 *   1. ExactMatch     — matchScore=98 (Maggi đậm đặc) — target icon + green
 *   2. AiSuggestGreen — matchScore=91 (CHIN-SU Tam Thái Tử) — sparkles icon + green
 *   3. AiSuggestAmber — matchScore=87 (NAM DƯƠNG Nàng Dâu) — sparkles icon + amber
 *   4. SimilarTier    — matchScore=79 (Maggi tỏi ớt) — cube icon + amber
 *   5. WithBadges     — HOT + discount corner badges
 *   6. Muted          — opacity-85 deprioritized card
 *
 * AC1-AC5 coverage: data-match-tier attribute + match badge color + icon + percent display.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ProductCardSearchB } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ProductCardSearchB',
  component: ProductCardSearchB,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Variant B 172px product card with match badge (color/icon by score) + REQUIRED reason chip. ' +
          'Per Sx04-9a-discover Q-T04-2 Option B3 LOCK: ≥92 target/exact, 85-91 sparkles/ai_suggest, ' +
          '<85 cube/similar. Color: ≥90 green (#10B981), <90 amber (#F59E0B). Cross-mockup verified ' +
          '10 data points. data-match-tier attribute exposed for E2E selectors.',
      },
    },
  },
  argTypes: {
    matchScore: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    rating: { control: { type: 'number', min: 0, max: 5, step: 0.1 } },
    muted: { control: 'boolean' },
  },
  args: {
    brand: 'MAGGI',
    name: 'Nước tương Maggi đậm đặc 700ml',
    price: 25500,
    originalPrice: 30000,
    imageGradient: 'linear-gradient(135deg, #FEF3C7, #FCD34D)',
    imageIcon: 'bottle',
    reason: 'Độ đậm cao, khách phở hay chọn nhất',
    rating: 4.8,
    soldCount: 'Đã bán 1.2k',
    matchScore: 98,
    onAdd: fn(),
  },
} satisfies Meta<typeof ProductCardSearchB>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Mockup-matched tiers (AC1-AC4) ──────────────────────────────────────────

export const ExactMatch: Story = {
  name: 'Exact match (98% — target/green)',
  args: { matchScore: 98 },
  parameters: {
    docs: {
      description: {
        story: 'Card #1 of mockup intent-03B-state-0-happy.html line 181-207. data-match-tier="exact".',
      },
    },
  },
};

export const AiSuggestGreen: Story = {
  name: 'AI suggest — green (91% — sparkles/green)',
  args: {
    matchScore: 91,
    brand: 'CHIN-SU',
    name: 'Nước tương Tam Thái Tử nâu 500ml',
    price: 32000,
    originalPrice: undefined,
    imageGradient: 'linear-gradient(135deg, #E0E7FF, #A5B4FC)',
    imageIcon: 'bottle',
    reason: 'Vị mặn đậm đà, phù hợp phở bò',
    rating: 4.7,
    soldCount: 'Đã bán 987',
  },
  parameters: {
    docs: {
      description: {
        story: 'Card #2 of mockup. 91 < 92 → ai_suggest tier (sparkles); 91 ≥ 90 → green. data-match-tier="ai_suggest".',
      },
    },
  },
};

export const AiSuggestAmber: Story = {
  name: 'AI suggest — amber (87% — sparkles/amber)',
  args: {
    matchScore: 87,
    brand: 'NAM DƯƠNG',
    name: 'Nước tương Nàng Dâu 450ml',
    price: 21000,
    originalPrice: 25000,
    imageGradient: 'linear-gradient(135deg, #FED7AA, #FB923C)',
    imageIcon: 'bottle',
    reason: 'Độ đạm 18°, giá tốt',
    rating: 4.5,
    soldCount: 'Đã bán 654',
  },
  parameters: {
    docs: {
      description: {
        story: 'Card #3 of mockup. 85 ≤ 87 < 92 → ai_suggest (sparkles); 87 < 90 → amber. data-match-tier="ai_suggest".',
      },
    },
  },
};

export const SimilarTier: Story = {
  name: 'Similar tier (79% — cube/amber)',
  args: {
    matchScore: 79,
    brand: 'MAGGI',
    name: 'Nước tương Maggi tỏi ớt 300ml',
    price: 18000,
    originalPrice: 22500,
    imageGradient: 'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
    imageIcon: 'bottle',
    reason: 'Có tỏi ớt sẵn, tiện chấm',
    rating: 4.6,
    soldCount: 'Đã bán 856',
  },
  parameters: {
    docs: {
      description: {
        story: 'Card #4 of mockup. 79 < 85 → similar (cube); 79 < 90 → amber. data-match-tier="similar".',
      },
    },
  },
};

// ─── Edge cases ──────────────────────────────────────────────────────────────

export const WithBadges: Story = {
  name: 'With HOT + discount corner badges',
  args: {
    matchScore: 98,
    badges: [
      { type: 'hot', label: 'HOT' },
      { type: 'discount', label: '-15%' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Mockup card #1 with full badge set (line 184). HOT uses flame icon; discount is plain.',
      },
    },
  },
};

export const Muted: Story = {
  name: 'Muted state (deprioritized — opacity 0.85)',
  args: {
    matchScore: 95,
    muted: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Used for lazy-loaded cards or pre-fetched cards waiting for index slot (per D-S04-14 LAW).',
      },
    },
  },
};
