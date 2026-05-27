/**
 * apps/web/stories/icp/molecules/ImageDropZone.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <ImageDropZone> — Camera + gallery dual upload entry point.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-0-capture.html (440 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Stories (4):
 *   1. Idle           — Default state-0 ready to receive image
 *   2. Loading        — External POST /intent in flight (spinner + buttons disabled)
 *   3. ErrorNotImage  — Internal error state after non-image file selected
 *   4. ErrorTooLarge  — Internal error state after >8MB file selected
 *
 * Note: Error stories use a simulated onUpload that throws — Storybook controls let
 *       you trigger via file input directly to see real error rendering.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ImageDropZone } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/ImageDropZone',
  component: ImageDropZone,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Dual upload entry point for S-07 Vision Buy state-0: camera capture (mobile) + gallery pick. ' +
          'Emits naked base64 string (no data URL prefix) to caller — matches BE vision.py line 218-221 ' +
          'expectation. File validation client-side: image MIME wildcard + 8MB max per C-S07-G. ' +
          'External loading state disables both buttons + shows "Đang tải ảnh..." spinner.',
      },
    },
  },
  argTypes: {
    loading: { control: 'boolean' },
  },
  args: {
    loading: false,
    onUpload: fn(),
  },
} satisfies Meta<typeof ImageDropZone>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Primary states ──────────────────────────────────────────────────────────

export const Idle: Story = {
  name: 'Idle (default state-0-capture)',
  parameters: {
    docs: {
      description: {
        story:
          'Default ready-to-receive state per mockup intent-01-state-0-capture.html. ' +
          'Two CTAs: camera (primary pink-grad) + gallery (secondary). Helper text "Tối đa 8MB · JPG, PNG, HEIC".',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading (POST /intent in flight)',
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'External loading state — both buttons disabled, "Đang tải ảnh..." spinner appears below CTAs. ' +
          'Caller sets `loading=true` during POST `/api/v1/intent` with `{content: <b64>, modality: "image"}` ' +
          'and `loading=false` on first SSE event (state-A transition).',
      },
    },
  },
};

// ─── Error states (internal — visible after file selection) ──────────────────

export const ErrorNotImage: Story = {
  name: 'Error: file is not an image',
  parameters: {
    docs: {
      description: {
        story:
          'Internal error banner shown if user selects non-image file via gallery picker. ' +
          'Validation: `file.type.startsWith("image/")` returns false → message "Tệp phải là ảnh (jpg/png/heic)." ' +
          'Trigger in Storybook by clicking "Chọn từ thư viện" and selecting a .pdf/.txt file.',
      },
    },
  },
};

export const ErrorTooLarge: Story = {
  name: 'Error: file > 8MB',
  parameters: {
    docs: {
      description: {
        story:
          'Internal error banner shown if user selects image > 8MB (C-S07-G MAX_IMAGE_BYTES). ' +
          'Message format: "Ảnh quá lớn (12.4MB). Tối đa 8MB." Trigger in Storybook with a large .jpg from device.',
      },
    },
  },
};
