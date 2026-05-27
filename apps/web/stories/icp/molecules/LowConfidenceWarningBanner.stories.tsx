/**
 * apps/web/stories/icp/molecules/LowConfidenceWarningBanner.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <LowConfidenceWarningBanner> — Yellow banner listing low-confidence fields.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-F-low-confidence.html (498 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Threshold per LOW_CONFIDENCE_THRESHOLD constant: 0.7 (in import-state-machine.ts).
 * Only 4 fields tracked per C-S07-L LOCK: title, brand, category, size.
 *
 * Stories (5):
 *   1. SingleField     — One field below threshold (title)
 *   2. TwoFields       — Two fields (title + brand) — typical state-F
 *   3. AllFields       — All 4 fields below threshold (severe degrade)
 *   4. WithDismiss     — Two fields + X dismiss button
 *   5. EmptyArray      — Empty array → component returns null (no render)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { LowConfidenceWarningBanner } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/LowConfidenceWarningBanner',
  component: LowConfidenceWarningBanner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Amber-themed warning banner shown above PrefillForm when 1+ fields have confidence < 0.7 ' +
          '(LOW_CONFIDENCE_THRESHOLD per C-S07-L LOCK). Lists field labels in Vietnamese ' +
          '(Tên sản phẩm / Nhãn hiệu / Danh mục / Dung tích — fallback to raw key if not in map). ' +
          'Format: "Em nhận diện chưa chắc chắn N trường (label1, label2, ...). Anh kiểm tra lại nhé." ' +
          'Empty array → returns null (component conditional render guard). Optional onDismiss adds X button.',
      },
    },
  },
} satisfies Meta<typeof LowConfidenceWarningBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleField: Story = {
  name: 'Single low-confidence field (title only)',
  args: {
    lowConfidenceFields: ['title'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Banner shows "1 trường (Tên sản phẩm)". Typical when AI Vision confident about brand/category/size ' +
          'but title OCR was ambiguous (e.g. partial label, glare on barcode area).',
      },
    },
  },
};

export const TwoFields: Story = {
  name: 'Two fields (typical state-F: title + brand)',
  args: {
    lowConfidenceFields: ['title', 'brand'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Banner shows "2 trường (Tên sản phẩm, Nhãn hiệu)". Most common state-F render — title OCR + brand ' +
          'attribution both below 0.7 threshold. Caller passes to PrefillForm which renders alt-chip suggestions ' +
          'per affected field.',
      },
    },
  },
};

export const AllFields: Story = {
  name: 'All 4 fields below threshold (severe degrade)',
  args: {
    lowConfidenceFields: ['title', 'brand', 'category', 'size'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'All 4 tracked fields below 0.7 confidence — severe degrade scenario (extremely poor image quality but ' +
          'still passed Ω₂ 3-threshold check enough to render PrefillForm). User likely better off using "Nhập tay" ' +
          'manual entry path.',
      },
    },
  },
};

export const WithDismiss: Story = {
  name: 'With dismiss X button',
  args: {
    lowConfidenceFields: ['title', 'brand'],
    onDismiss: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Banner shows X dismiss button per mockup state-F line 218-230. Caller decides whether dismissal ' +
          'resets state machine (LOW_CONFIDENCE_BANNER_DISMISSED → hide all alt-chips downstream) or just ' +
          'hides the banner (alt-chips remain in PrefillForm).',
      },
    },
  },
};

export const EmptyArray: Story = {
  name: 'Empty array → null render (no banner)',
  args: {
    lowConfidenceFields: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `lowConfidenceFields` is empty array (all 4 fields ≥ 0.7 confidence), component returns ' +
          '`null` — no DOM render. Allows caller to unconditionally render `<LowConfidenceWarningBanner>` ' +
          'with computed array without conditional wrapper.',
      },
    },
  },
};
