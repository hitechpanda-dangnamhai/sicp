/**
 * apps/web/stories/icp/molecules/TrendCardExpanded.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <TrendCardExpanded> — Expanded Google Trends VN view with sparkline + rising chips + AI insight.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-H-trend-expanded.html (497 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 *   - C-21 deferral fulfilled: TrendCard (compact) + TrendCardExpanded shipped as separate molecules.
 *   - C-S07-D SSE market_trend event payload mirror.
 *   - C-11 trend-green native palette (#10B981) for rising trajectory.
 *
 * Stories (5):
 *   1. Rising         — +24% trajectory rising with 5 chips + insight + chip tap callback
 *   2. Falling        — -12% trajectory falling with substitute-query chips (no chip tap)
 *   3. Stable         — Flat trajectory ~ ±2% (low signal — caution merchant)
 *   4. NoInsight      — Rising trend but no AI insight text (insight field omitted)
 *   5. MinimalSeries  — Short series (5 points only) — newly tracked product
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TrendCardExpanded } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/TrendCardExpanded',
  component: TrendCardExpanded,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Expanded Google Trends VN view per mockup state-H-trend-expanded.html (497 LOC). Layout: ' +
          'header with sticky back CTA + trajectory pill (rising/falling/stable) + big delta ↑/↓ N% + ' +
          'headline + 320×64 hero sparkline SVG path (NOT compact MiniSparkline 38px — too small for hero). ' +
          '"Từ khoá đang lên" section with related_rising chips (4-6 typical, descending +pct order). ' +
          'Optional onChipTap callback enables "add term to description" merchant action. AI reasoning card ' +
          '"🤖 Aida nhận định" shows optional `insight` text 1-3 sentences. C-11 trend-green native palette.',
      },
    },
  },
  args: {
    productContext: 'Maggi nước tương 200ml',
    onBack: fn(),
  },
} satisfies Meta<typeof TrendCardExpanded>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Trajectory variants ─────────────────────────────────────────────────────

export const Rising: Story = {
  name: 'Rising trend (+24%, 5 chips, AI insight, tap callback)',
  args: {
    trend: {
      trajectory: 'rising',
      current_score: 78,
      delta_pct: 24,
      series: [42, 45, 48, 52, 50, 55, 58, 62, 60, 66, 70, 74, 76, 78],
      related_rising: [
        'maggi đậm đặc',
        'nước tương cho bé',
        'maggi 700ml',
        'maggi vs chinsu',
        'maggi giảm muối',
      ],
      insight:
        'Nhu cầu nước tương Maggi tăng đều suốt 90 ngày qua, đặc biệt biến thể đậm đặc 700ml. ' +
        'Khuyến nghị tăng tồn kho 15-20% cho tháng tới.',
    },
    onChipTap: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Healthy rising trend +24% over 90 days. Hero sparkline shows clear upward gradient ending at 78. ' +
          '5 related search terms (descending +pct order). AI insight 2-sentence Vietnamese tagline. Chips ' +
          'tap-callable (cursor pointer + hover-bg) — fires onChipTap(term) on click.',
      },
    },
  },
};

export const Falling: Story = {
  name: 'Falling trend (-12% cool-down, substitute chips, no tap)',
  args: {
    trend: {
      trajectory: 'falling',
      current_score: 38,
      delta_pct: -12,
      series: [55, 52, 50, 48, 45, 46, 44, 42, 40, 38, 36, 38, 37, 38],
      related_rising: ['nước tương thay thế', 'nước mắm ăn cơm', 'soy sauce vs fish sauce'],
      insight: 'Tâm lý khách hàng đang chuyển sang nước mắm — cân nhắc combo cross-sell.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Falling trend -12% indicating cool-down phase. Hero sparkline shows downward gradient ending at 38. ' +
          '3 chip suggestions show substitute query patterns. No onChipTap callback → chips render decorative ' +
          '(no cursor-pointer, no hover effect).',
      },
    },
  },
};

export const Stable: Story = {
  name: 'Stable trend (~ ±2% — low signal, caution merchant)',
  args: {
    trend: {
      trajectory: 'stable',
      current_score: 52,
      delta_pct: 1.4,
      series: [50, 51, 53, 52, 50, 51, 53, 54, 52, 51, 53, 52, 51, 52],
      related_rising: ['mua đâu rẻ nhất', 'có khuyến mãi không'],
    },
    onChipTap: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Stable trend ~ ±2% — neither rising nor falling, low signal. Trajectory pill shows amber/neutral ' +
          'instead of emerald/red. Insight omitted (BE chose not to emit since no actionable advice). ' +
          'Common scenario for established commodity products without market shifts.',
      },
    },
  },
};

// ─── Optional field variants ─────────────────────────────────────────────────

export const NoInsight: Story = {
  name: 'Rising trend but no AI insight text',
  args: {
    trend: {
      trajectory: 'rising',
      current_score: 71,
      delta_pct: 18,
      series: [45, 47, 50, 52, 54, 56, 59, 62, 65, 68, 70, 71, 70, 71],
      related_rising: ['hot trend', 'mua giúp tôi', 'best price'],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Rising trend +18% but `insight` field omitted (BE may skip LLM call to save latency in degraded mode). ' +
          'AI reasoning card not rendered. All other layout intact (sparkline + chips + headline).',
      },
    },
  },
};

export const MinimalSeries: Story = {
  name: 'Minimal series (5 points — newly tracked product)',
  args: {
    trend: {
      trajectory: 'rising',
      current_score: 24,
      delta_pct: 8,
      series: [18, 19, 21, 22, 24],
      related_rising: ['sản phẩm mới', 'đánh giá ai dùng chưa'],
      insight: 'Sản phẩm mới được tracking — dữ liệu còn hạn chế, theo dõi thêm 2-3 tuần để có insight chính xác.',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Short series (5 points only) — newly tracked product where BE has limited history. Sparkline still ' +
          'renders but path computation uses fewer points (less smooth). Insight acknowledges data limitation. ' +
          'Edge case for new product imports where Trends API has < 90 days history.',
      },
    },
  },
};
