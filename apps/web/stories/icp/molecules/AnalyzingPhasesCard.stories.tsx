/**
 * apps/web/stories/icp/molecules/AnalyzingPhasesCard.stories.tsx
 *
 * Slice:    S-07 Vision Buy (Intent 01)
 * Task:     T02 — Storybook coverage for 9 NEW S-07 molecules (Phiên Sx07-F batch 4b)
 * Molecule: <AnalyzingPhasesCard> — Realtime 4-phase progress card during AI Vision analysis.
 *
 * Source mockup ground truth:
 *   docs/mockups/intent-01/intent-01-state-A-analyzing.html (377 LOC)
 *   (per D-29 LAW Mockup filename is LAW)
 *
 * 4 phases per `02_INTENT_SPECS.md` Intent 01 (amended Phiên Sx07-E per D-S04-10 LAW 512 chiều):
 *   0. Tải ảnh
 *   1. Đọc nhãn sản phẩm
 *   2. Sinh dấu vân tay 512 chiều
 *   3. Phân tích thị trường
 *
 * Stories (5):
 *   1. AllPending  — Initial state before any phase_progress event
 *   2. Phase1Active — Phase 0 done, phase 1 active (typical render mid-state-A)
 *   3. Phase3Active — Phases 0/1/2 done, phase 3 active (near completion)
 *   4. AllDone     — All 4 phases done with elapsed_ms displayed
 *   5. WithMeta    — Phase 3 done with meta sub-text "5 cửa hàng đã so sánh"
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AnalyzingPhasesCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/AnalyzingPhasesCard',
  component: AnalyzingPhasesCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Realtime 4-phase progress card per mockup intent-01-state-A-analyzing. Consumes `phases` map ' +
          'keyed by phase_id (0-3). Each slot: `{phase_id, label, status: active|done|pending, ms?, meta?}`. ' +
          'Empty/missing phase_id renders as pending. Active phase shows pink Spinner; done shows green ' +
          'check + elapsed ms (mono); pending shows empty circle outline. Optional `meta` sub-text below ' +
          'label (e.g. "5 cửa hàng đã so sánh" after enrich phase).',
      },
    },
  },
} satisfies Meta<typeof AnalyzingPhasesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Sequential progression ──────────────────────────────────────────────────

export const AllPending: Story = {
  name: 'All pending (initial — before first phase_progress)',
  args: {
    phases: {},
  },
  parameters: {
    docs: {
      description: {
        story:
          'Initial render before any SSE phase_progress event arrives. All 4 phases show empty circle outlines ' +
          'with labels in muted color. This is what FE renders right after POST /intent fires.',
      },
    },
  },
};

export const Phase1Active: Story = {
  name: 'Phase 1 active (mid-state-A — typical)',
  args: {
    phases: {
      0: { phase_id: 0, label: 'Tải ảnh', status: 'done', ms: 412 },
      1: { phase_id: 1, label: 'Đọc nhãn sản phẩm', status: 'active' },
      2: { phase_id: 2, label: 'Sinh dấu vân tay 512 chiều', status: 'pending' },
      3: { phase_id: 3, label: 'Phân tích thị trường', status: 'pending' },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mid-flight state: phase 0 "Tải ảnh" done (412ms), phase 1 "Đọc nhãn sản phẩm" actively running ' +
          '(pink Spinner + bg-pink-50/60 highlight + font-semibold), phases 2-3 pending. Most common render ' +
          'sequence ~1-2s after upload.',
      },
    },
  },
};

export const Phase3Active: Story = {
  name: 'Phase 3 active (near completion)',
  args: {
    phases: {
      0: { phase_id: 0, label: 'Tải ảnh', status: 'done', ms: 412 },
      1: { phase_id: 1, label: 'Đọc nhãn sản phẩm', status: 'done', ms: 2890 },
      2: { phase_id: 2, label: 'Sinh dấu vân tay 512 chiều', status: 'done', ms: 1430 },
      3: { phase_id: 3, label: 'Phân tích thị trường', status: 'active' },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Phases 0/1/2 done with elapsed_ms shown right-aligned in emerald mono font. Phase 3 ' +
          '"Phân tích thị trường" actively running (asyncio.gather over Shopee+Trends+Vespa similar+Vespa trend). ' +
          'Typical ~3-4s after upload.',
      },
    },
  },
};

export const AllDone: Story = {
  name: 'All 4 phases done',
  args: {
    phases: {
      0: { phase_id: 0, label: 'Tải ảnh', status: 'done', ms: 412 },
      1: { phase_id: 1, label: 'Đọc nhãn sản phẩm', status: 'done', ms: 2890 },
      2: { phase_id: 2, label: 'Sinh dấu vân tay 512 chiều', status: 'done', ms: 1430 },
      3: { phase_id: 3, label: 'Phân tích thị trường', status: 'done', ms: 1850 },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'All 4 phases complete with elapsed timings displayed (412ms / 2.9s / 1.4s / 1.9s). Card typically ' +
          'transitions out to state-B PrefillForm shortly after this terminal state (state machine FORM_PREFILL ' +
          'event triggers unmount).',
      },
    },
  },
};

export const WithMeta: Story = {
  name: 'With meta sub-text (e.g. "5 cửa hàng đã so sánh")',
  args: {
    phases: {
      0: { phase_id: 0, label: 'Tải ảnh', status: 'done', ms: 412 },
      1: { phase_id: 1, label: 'Đọc nhãn sản phẩm', status: 'done', ms: 2890 },
      2: { phase_id: 2, label: 'Sinh dấu vân tay 512 chiều', status: 'done', ms: 1430 },
      3: {
        phase_id: 3,
        label: 'Phân tích thị trường',
        status: 'done',
        ms: 1850,
        meta: '5 cửa hàng đã so sánh',
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Phase 3 done with optional `meta` sub-text showing enrich result count below label. ' +
          'BE can emit meta via SSE phase_progress event payload `{phase_id: 3, status: "done", ms, meta}` ' +
          'for richer UX feedback.',
      },
    },
  },
};
