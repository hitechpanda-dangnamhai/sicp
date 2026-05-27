/**
 * apps/web/stories/icp/molecules/BlurErrorCard.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <BlurErrorCard> — Blurry image error card with tips + 2 CTAs + optional preview.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-E-blur-error.html (400 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * Stories (4):
 *   1. IconOnly         — Default lightbulb icon hero (no image preview)
 *   2. WithImagePreview — Blurry image hero (CSS filter: blur(8px))
 *   3. WithTraceId      — Image hero + trace_id footer for ops correlation
 *   4. CustomErrorCode  — Override default E_VISION_BLUR with custom code
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { BlurErrorCard } from '@/components/icp/molecules';

// Tiny blurry transparent placeholder (1×1 amber pixel as data URL) — Storybook-safe
const SAMPLE_BLURRY_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGf4DwACvgGOdLLKMQAAAABJRU5ErkJggg==';

const meta = {
  title: 'Molecules/BlurErrorCard',
  component: BlurErrorCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Error card shown when AI Vision detects image blur (E_VISION_BLUR per Ω₂ 3-threshold check ' +
          'C-S07-J empirically validated). Amber-themed alert with: header strip "Ảnh chưa đủ rõ" + hero ' +
          '(blurry image with CSS filter:blur(8px) OR lightbulb icon fallback) + 3 numbered tips ' +
          '(distance/lighting/focus) + 2 CTAs ("Chụp lại" reset / "Nhập tay" manual entry) + optional ' +
          'error code + trace_id footer (mono font, amber-700, break-all wrap).',
      },
    },
  },
  args: {
    errorCode: 'E_VISION_BLUR',
    onRetake: fn(),
    onManualEntry: fn(),
  },
} satisfies Meta<typeof BlurErrorCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconOnly: Story = {
  name: 'Icon hero (no image preview)',
  parameters: {
    docs: {
      description: {
        story:
          'Default rendering without image preview — 24×24 amber-100 circle with lightbulb icon hero. ' +
          'Used when image data not available in client (e.g. FileReader fired but data discarded post-upload).',
      },
    },
  },
};

export const WithImagePreview: Story = {
  name: 'With blurry image preview (CSS filter blur(8px))',
  args: {
    imageDataUrl: SAMPLE_BLURRY_IMAGE,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hero shows the captured image with CSS `filter: blur(8px)` overlay + amber-500/20 gradient to ' +
          'amplify visual feedback "this is what got rejected". 28×28 rounded-2xl card with amber-200 border. ' +
          'Caller passes the original data URL (with data: prefix) from FileReader before stripDataUrlPrefix.',
      },
    },
  },
};

export const WithTraceId: Story = {
  name: 'With OTel trace_id footer',
  args: {
    imageDataUrl: SAMPLE_BLURRY_IMAGE,
    traceId: 'e6ce4df7856bd67cd606936b260dfcea',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Image hero + footer block showing `Code: E_VISION_BLUR` + `Trace: e6ce4df7...260dfcea` ' +
          '(mono font, amber-700, break-all wrap for long ids). Trace_id enables ops/judges to query Tempo ' +
          'directly per OTel discipline. Mockup state-E line 166 reference.',
      },
    },
  },
};

export const CustomErrorCode: Story = {
  name: 'Custom error code (e.g. future E_VISION_GLARE)',
  args: {
    errorCode: 'E_VISION_GLARE',
    traceId: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Allows override of default `E_VISION_BLUR` for future error codes (e.g. E_VISION_GLARE for ' +
          'reflection issues, E_VISION_PARTIAL for cut-off labels). Display string is hardcoded in T02 ' +
          'but code field is i18n-future-ready.',
      },
    },
  },
};
