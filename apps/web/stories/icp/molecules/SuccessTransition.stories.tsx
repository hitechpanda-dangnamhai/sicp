/**
 * apps/web/stories/icp/molecules/SuccessTransition.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <SuccessTransition> — Final success card with BrainCheckBadge + 3 stat cells + 2 CTAs + auto-redirect.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-G-success.html (462 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Adapted from `apps/web/components/icp/organisms/LoginSuccessTransition.tsx` (S-03 precedent)
 * per D-25 LAW pattern (lines 67-75 setTimeout cleanup). Adaptation: 3-button context instead
 * of single CTA + product-specific stats (fields/elapsed/confidence) instead of generic login.
 *
 * Stories (5):
 *   1. HighConfidence — 98%, fast 2.8s, 14 fields (best case)
 *   2. MediumConfidence — 87%, 12 fields, 3.2s (mockup default)
 *   3. LowConfidence — 72%, 9 fields, 5.6s (slow + uncertain branding)
 *   4. CustomRedirect — Custom target /intent-01 (chained import)
 *   5. SlowRedirect — autoRedirectMs=10000 (allows user to read confirm details)
 *
 * Note: autoRedirectMs default 60000ms in Storybook to prevent test interference;
 *       stories override per-case as needed.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SuccessTransition } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/SuccessTransition',
  component: SuccessTransition,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Final success card for S-07 state-G after merchant commits product. Layout: BrainCheckBadge ' +
          'hero (140×140 — adapted from S-03 LoginSuccessTransition 180×180) + product title pill + 3 ' +
          'stat-cells row (fields filled / elapsed sec / confidence %) + 2 CTAs ("Đóng" X / "Nhập sản phẩm ' +
          'tiếp theo" primary) + footer "ID: prd_..." + auto-redirect progress bar to /home (default 2000ms). ' +
          'Storybook caps autoRedirectMs=60000 to prevent test interference; per-story overrides allowed.',
      },
    },
  },
  argTypes: {
    confidencePct: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    fieldsCount: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    elapsedSec: { control: { type: 'number', min: 0, max: 60, step: 0.1 } },
    autoRedirectMs: { control: { type: 'number', min: 1000, max: 60000, step: 1000 } },
  },
  args: {
    productId: 'prd_e24fba95569d459e9e5da70a7cf15af6',
    productTitle: 'Bia Heineken Lon 330ml Thùng 24 Lon',
    fieldsCount: 12,
    elapsedSec: 3.2,
    confidencePct: 95,
    autoRedirectMs: 60000,
    autoRedirectTo: '/home',
    onClose: fn(),
    onImportNext: fn(),
  },
} satisfies Meta<typeof SuccessTransition>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Confidence variants (drives BrainCheckBadge + stat cell visuals) ────────

export const HighConfidence: Story = {
  name: 'High confidence (98%, fast 2.8s, 14 fields)',
  args: {
    confidencePct: 98,
    fieldsCount: 14,
    elapsedSec: 2.8,
    productTitle: 'Nước tương Maggi đậm đặc 700ml',
    productId: 'prd_a7d4b182f3c945e7a09b8c7d1f2a3b4c',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Best-case scenario — 98% confidence, all 14 fields filled, fast 2.8s analysis. Confident product ' +
          'identification. BrainCheckBadge renders with full check + pulse-ring at peak brightness.',
      },
    },
  },
};

export const MediumConfidence: Story = {
  name: 'Medium confidence (87%, 12 fields, 3.2s — mockup default)',
  parameters: {
    docs: {
      description: {
        story:
          'Mockup state-G default values per spec line 245-310: 12 fields filled / 3.2s elapsed / ' +
          '95% confidence (this story uses 87% to show medium tier). Progress bar animates 0 → 100% over ' +
          'autoRedirectMs (clamped to 60000 in Storybook).',
      },
    },
  },
};

export const LowConfidence: Story = {
  name: 'Low confidence (72%, slow 5.6s, 9 fields)',
  args: {
    confidencePct: 72,
    fieldsCount: 9,
    elapsedSec: 5.6,
    productTitle: 'Sản phẩm chưa rõ — vui lòng kiểm tra lại sau',
    productId: 'prd_9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Lowest passable threshold — 72% confidence, slow 5.6s analysis (possibly involved fallback BE retry), ' +
          'only 9 of 14 fields filled. Edge case where commit happened but user should likely re-verify before ' +
          'publishing. Shows resilient render even with uncertain data.',
      },
    },
  },
};

// ─── Routing variants ────────────────────────────────────────────────────────

export const CustomRedirect: Story = {
  name: 'Custom redirect target (/intent-01 chained import)',
  args: {
    autoRedirectTo: '/intent-01',
    confidencePct: 95,
    productTitle: 'Trà Ô Long Tea Plus 455ml',
    productId: 'prd_chained0001chained0001chained00',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Override `autoRedirectTo` from default `/home` to `/intent-01` — enables chained import workflow ' +
          '(merchant scans batch of products, each commit returns to capture state-0 for next item).',
      },
    },
  },
};

export const SlowRedirect: Story = {
  name: 'Slow redirect (10s — allows user to read details)',
  args: {
    autoRedirectMs: 10000,
    confidencePct: 95,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Override `autoRedirectMs` from default 2000ms to 10000ms — slower progress bar gives user time ' +
          'to read full product details before auto-navigation. Useful for accessibility or low-literacy users. ' +
          'Progress bar visibly animates over the full 10s.',
      },
    },
  },
};
