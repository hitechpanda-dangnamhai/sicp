/**
 * apps/web/stories/icp/molecules/ShopeeCompareCardExpanded.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <ShopeeCompareCardExpanded> — Expanded Shopee price compare view with samples + range bar.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-D-shopee-expanded.html (595 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 *   - C-21 deferral fulfilled: ShopeeCompareCard (compact) + ShopeeCompareCardExpanded shipped as
 *     separate molecules per Phiên Sx07-F task split.
 *   - C-S07-D SSE shopee_compare event payload mirror.
 *
 * Stories (4):
 *   1. UserBelowMedian — User price 18.5k (below avg 24.5k) — competitive pricing position
 *   2. UserAtMedian    — User price 25k (at avg 24.5k) — typical mockup state-D
 *   3. UserAboveMedian — User price 31k (above avg 24.5k) — premium pricing
 *   4. NullRatingSamples — Some samples have null rating (em-dash fallback display)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ShopeeCompareCardExpanded } from '@/components/icp/molecules';

const SAMPLE_AGGREGATES = {
  min_price: 18000,
  avg_price: 24500,
  max_price: 32000,
  sample_count: 47,
  review_count: 1830,
};

const SAMPLE_SAMPLES = [
  {
    title: 'Nước tương Maggi 700ml đậm đặc',
    store: 'Maggi Official Store',
    price: 23000,
    rating: 4.8,
    sold_count: 12_400,
  },
  {
    title: 'Maggi xì dầu chai 700ml',
    store: 'Nhà phân phối VinaFood',
    price: 25000,
    rating: 4.7,
    sold_count: 8_650,
  },
  {
    title: 'Nước tương Maggi đậm đặc — 700ml combo 3 chai',
    store: 'Bách Hóa Trực Tuyến',
    price: 31500,
    rating: 4.5,
    sold_count: 4_234,
  },
];

const meta = {
  title: 'Molecules/ShopeeCompareCardExpanded',
  component: ShopeeCompareCardExpanded,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Expanded Shopee market comparison view per mockup state-D-shopee-expanded.html (595 LOC). ' +
          'Header with sticky back CTA + "N cửa hàng" pill. Hero: big range bar gradient (#FED7AA → #FB923C ' +
          '→ #DC2626) with user price marker (pink filled circle) + avg median marker (dotted vertical line). ' +
          'Below: per-store sample list (3-5 items typical) with rating + sold_count formatted k-suffix. ' +
          'Aggregates from MCP `shopee.price_range` tool — mirrors SseShopeeCompareEvent payload shape ' +
          'per C-S07-D. Back CTA closes back to compact ShopeeCompareCard.',
      },
    },
  },
  args: {
    userPrice: 25000,
    subtitle: 'Nước tương Maggi đậm đặc 700ml',
    aggregates: SAMPLE_AGGREGATES,
    samples: SAMPLE_SAMPLES,
    onBack: fn(),
  },
} satisfies Meta<typeof ShopeeCompareCardExpanded>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── User price position variants (drives marker location on range bar) ─────

export const UserBelowMedian: Story = {
  name: 'User price below median (18.5k vs 24.5k — competitive)',
  args: {
    userPrice: 18500,
  },
  parameters: {
    docs: {
      description: {
        story:
          'User price 18.5k VND positioned near min — competitive pricing strategy. Pink user marker ' +
          'sits ~3% from left edge of range bar; avg dotted line at ~46%. Insight for merchant: price ' +
          'undercuts most competitors; consider raising for margin OR keep for volume.',
      },
    },
  },
};

export const UserAtMedian: Story = {
  name: 'User price at median (25k vs avg 24.5k — typical)',
  parameters: {
    docs: {
      description: {
        story:
          'Default mockup state-D — user price 25k positioned at market median (avg 24.5k VND). Pink user ' +
          'marker overlaps avg dotted line. Most common pricing strategy for first-time importers.',
      },
    },
  },
};

export const UserAboveMedian: Story = {
  name: 'User price above median (31k vs 24.5k — premium)',
  args: {
    userPrice: 31000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'User price 31k positioned near max — premium pricing position (e.g. branded packaging, fresh stock). ' +
          'Pink user marker sits ~93% from left. Insight: price commands premium; ensure marketing reflects ' +
          'differentiation OR consider matching competitors for sales velocity.',
      },
    },
  },
};

// ─── Edge cases ──────────────────────────────────────────────────────────────

export const NullRatingSamples: Story = {
  name: 'Some samples have null rating (em-dash fallback)',
  args: {
    samples: [
      {
        title: 'Nước tương Maggi 700ml — Shop mới mở',
        store: 'Tiệm Tạp Hóa Số 7',
        price: 22000,
        rating: null, // No ratings yet (new store)
        sold_count: 12,
      },
      {
        title: 'Maggi đậm đặc 700ml',
        store: 'Trung tâm Phân phối ABC',
        price: 24500,
        rating: 4.6,
        sold_count: 5_678,
      },
      {
        title: 'Nước tương combo Maggi 3×700ml',
        store: 'Cửa hàng Khuyến mãi 24h',
        price: 28000,
        rating: null,
        sold_count: 234,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edge case — Shopee samples with `rating: null` (new stores without ratings yet). Component renders ' +
          'em-dash "—" instead of star rating per `formatRating()` helper. sold_count displays raw number when ' +
          'below 1000 (formatSoldCount k-suffix only ≥ 1000).',
      },
    },
  },
};
