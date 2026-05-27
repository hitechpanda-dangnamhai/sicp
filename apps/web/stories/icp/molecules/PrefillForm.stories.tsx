/**
 * apps/web/stories/icp/molecules/PrefillForm.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <PrefillForm> — react-hook-form + zodResolver merchant product draft form.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-B-prefilled.html (1097 LOC) — primary reference
 *   docs/mockups/intent-01/intent-01-state-F-low-confidence.html (498 LOC) — low-confidence + alt-chip
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 *   - C-S07-D LOCK: helper extras (`title`/`description`) passthrough acceptable
 *   - C-S07-L LOCK: confidence_per_field 4 keys (title/brand/category/size); alternatives 2 keys (title/size)
 *   - D-S04-11 LAW Warning #2: brand LIFTED from attributes to top-level form field
 *   - C-S07-O option iii-a (Sx07-G hotfix): optional onRequestSuggestAttrs callback
 *   - C-S07-Q (Phiên Sx07-F): ProductDraftSchema lives in @icp/shared-types
 *
 * Stories (6):
 *   1. HighConfidence       — All 4 fields ≥0.92 (state-B happy path, no banner needed)
 *   2. LowConfidence        — title 0.55 + brand 0.62 (state-F — alt-chips render)
 *   3. NoSuggestedPrice     — suggested_price omitted (BE didn't extract → empty price input)
 *   4. NoSuggestAttrsCB     — onRequestSuggestAttrs absent → "Thêm" button decorative no-op
 *   5. LoadingSubmit        — loading=true (submit button shows spinner, inputs disabled)
 *   6. UnknownCategory      — category='unknown' fallback (uncertain enrich path)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  PrefillForm,
  type FormPrefillPayload,
  type SuggestedAttributeChip,
} from '@/components/icp/molecules';

// ─── Fixture data ────────────────────────────────────────────────────────────

const HIGH_CONFIDENCE_FIXTURE: FormPrefillPayload = {
  category: 'nuoc_tuong',
  attributes: {
    brand: 'Maggi',
    size: '200ml',
    origin: 'Việt Nam',
    type: 'Đậu nành',
    expiry: '24 tháng',
  },
  confidence_per_field: {
    title: 0.98,
    brand: 0.95,
    category: 0.92,
    size: 0.94,
  },
  alternatives: {
    title: ['Maggi nước tương đặc biệt 200ml', 'Maggi xì dầu 200ml'],
    size: ['250ml'],
  },
  suggested_price: 25000,
  title: 'Maggi nước tương đậu nành 200ml',
  description: 'Nước tương Maggi 200ml đậu nành nguyên chất, vị đậm đà, thích hợp ướp + chấm.',
};

const LOW_CONFIDENCE_FIXTURE: FormPrefillPayload = {
  category: 'nuoc_tuong',
  attributes: {
    brand: 'Maggi',
    size: '200ml',
    type: 'Đậu nành',
  },
  confidence_per_field: {
    title: 0.55,
    brand: 0.62,
    category: 0.88,
    size: 0.91,
  },
  alternatives: {
    title: ['Maggi nước tương đậu nành', 'Maggi xì dầu loại đặc biệt'],
    size: ['250ml', '180ml'],
  },
  suggested_price: 22000,
  title: 'Maggi nước tương đậu nành',
  description: 'Nước tương đậm đà.',
};

const NO_PRICE_FIXTURE: FormPrefillPayload = {
  ...HIGH_CONFIDENCE_FIXTURE,
  suggested_price: undefined,
};

const UNKNOWN_CATEGORY_FIXTURE: FormPrefillPayload = {
  category: 'unknown',
  attributes: {
    brand: 'Unknown',
    type: 'Khác',
  },
  confidence_per_field: {
    title: 0.41,
    brand: 0.38,
    category: 0.12,
    size: 0.65,
  },
  alternatives: {
    title: ['Sản phẩm chưa rõ — kiểm tra lại'],
  },
  suggested_price: undefined,
  title: 'Sản phẩm chưa rõ',
  description: '',
};

const SUGGESTED_CHIPS_FIXTURE: SuggestedAttributeChip[] = [
  { key: 'taste_profile', label_vn: 'Hương vị', example_values: ['Đậm đà', 'Mặn ngọt'] },
  { key: 'packaging', label_vn: 'Bao bì', example_values: ['Chai thủy tinh', 'Chai nhựa PET'] },
  { key: 'usage', label_vn: 'Cách dùng', example_values: ['Ướp thịt', 'Chấm trực tiếp'] },
];

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Molecules/PrefillForm',
  component: PrefillForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Merchant product draft form for S-07 Intent 01 state-B (happy) / state-F (low-confidence). Uses ' +
          'react-hook-form + zodResolver(ProductDraftSchema from @icp/shared-types per C-S07-Q LOCK). 6 fields: ' +
          'title + brand (LIFTED from attributes per D-S04-11 LAW Warning #2) + category + price + attributes ' +
          '(chip grid, 4-5 from formPrefill excl. brand) + description. Per-field confidence badge shown for ' +
          '4 tracked keys (title/brand/category/size). Alt-chip swap UI when alternatives.title/size non-empty. ' +
          '"Thêm" button triggers optional onRequestSuggestAttrs(category, existingAttrs) → 3 AI chip suggestions ' +
          '(C-S07-O option iii-a Sx07-G hotfix). Submit handler called with validated ProductDraft (brand at ' +
          'top-level).',
      },
    },
  },
  args: {
    requestId: 'fixture-rid-storybook',
    onSubmit: fn(),
    onRequestSuggestAttrs: fn(async () => SUGGESTED_CHIPS_FIXTURE),
    loading: false,
  },
} satisfies Meta<typeof PrefillForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Confidence variants ─────────────────────────────────────────────────────

export const HighConfidence: Story = {
  name: 'High confidence (state-B happy path)',
  args: {
    formPrefill: HIGH_CONFIDENCE_FIXTURE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'All 4 tracked fields ≥0.92 confidence per mockup state-B-prefilled (Maggi 700ml 98%/95%/92%/94%). ' +
          'No LowConfidenceWarningBanner needed; merchant reviews + submits directly. "Thêm" button enabled ' +
          'for optional AI chip suggestions. Submit button "Đăng sản phẩm" pink-grad.',
      },
    },
  },
};

export const LowConfidence: Story = {
  name: 'Low confidence (state-F — title + brand < 0.7 → alt-chips)',
  args: {
    formPrefill: LOW_CONFIDENCE_FIXTURE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Title 0.55 + brand 0.62 below LOW_CONFIDENCE_THRESHOLD (0.7). Caller renders ' +
          'LowConfidenceWarningBanner above this form (separate molecule). Title + size fields show ' +
          'alt-chip suggestions below per mockup state-F line 218-230 (alternatives.title 2 items + ' +
          'alternatives.size 2 items). Merchant taps chip → form value swaps + alt-chips hide.',
      },
    },
  },
};

export const UnknownCategory: Story = {
  name: 'Unknown category (severe degrade — fallback path)',
  args: {
    formPrefill: UNKNOWN_CATEGORY_FIXTURE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Edge case — category="unknown" (Ω₂ blur check passed but Gemini Vision could not classify). ' +
          'All 4 fields below 0.7 threshold. Suggested_price absent. Title shows alt-chip "Sản phẩm chưa rõ ' +
          '— kiểm tra lại" as soft hint. User likely better off using "Nhập tay" manual entry path instead.',
      },
    },
  },
};

// ─── Optional field variants ─────────────────────────────────────────────────

export const NoSuggestedPrice: Story = {
  name: 'No suggested_price (empty price input)',
  args: {
    formPrefill: NO_PRICE_FIXTURE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'High confidence on identification fields but `suggested_price` omitted (BE Shopee enrich returned ' +
          'no comparable prices OR all returned filters excluded). Price input renders empty placeholder; ' +
          'merchant must manually enter before submit (Zod requires price > 0).',
      },
    },
  },
};

export const NoSuggestAttrsCB: Story = {
  name: 'No onRequestSuggestAttrs callback (decorative "Thêm" button)',
  args: {
    formPrefill: HIGH_CONFIDENCE_FIXTURE,
    onRequestSuggestAttrs: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `onRequestSuggestAttrs` prop absent (e.g. Sx07-G feature flag off OR pre-Sx07-G page integration), ' +
          '"Thêm" button still renders (per mockup state-B-prefilled visual contract) but click is no-op. ' +
          'Backward-compat with pre-Sx07-G consumers.',
      },
    },
  },
};

// ─── Loading state ───────────────────────────────────────────────────────────

export const LoadingSubmit: Story = {
  name: 'Loading submit (POST /action submit_draft in flight)',
  args: {
    formPrefill: HIGH_CONFIDENCE_FIXTURE,
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'External `loading=true` during POST `/api/v1/intent/{rid}/action` with `{choice: "submit_draft", ' +
          'value: {...}}`. Submit button shows Spinner; inputs disabled to prevent edits mid-submit. ' +
          'Caller sets loading=false on SSE event status_changed → state-C (action cards arrived).',
      },
    },
  },
};
