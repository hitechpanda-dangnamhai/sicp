/**
 * apps/web/stories/icp/molecules/PhasesCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <PhasesCard> (T04, Family A)
 *
 * Source verified: components/icp/molecules/PhasesCard.tsx
 *   Props: mode: 'list' | 'card' (REQUIRED),
 *          phases: PhaseItem[] (REQUIRED — array of {id, label, meta?, status}),
 *          header?: { icon?: IconName, title: string, subtitle?: string }  (card mode only)
 *   PhaseItem status: 'done' | 'active' | 'pending'
 *
 * Decisions applied:
 * - C-22 verify: 2 modes + 3 status values from source
 * - C-15 Server (no event handlers, pure presentational)
 * - C-08 VN labels (XONG/ĐANG/CHỜ status auto via statusLabel map)
 * - Q4 Registry: SINGLE-INTENT (used I01-A list + I07 card — pure data render)
 *
 * Story coverage: 2 modes + status mix + header variations
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PhasesCard, type PhaseItem } from '@/components/icp/molecules';

const PHASES_MIXED: PhaseItem[] = [
  { id: '1', label: 'Nhận diện sản phẩm', meta: 'Gemini Vision · 1.4s', status: 'done' },
  { id: '2', label: 'Tra cứu giá thị trường', meta: 'Shopee API · 0.8s', status: 'done' },
  { id: '3', label: 'Phân tích đối thủ', meta: 'đang chạy...', status: 'active' },
  { id: '4', label: 'Sinh insight', status: 'pending' },
  { id: '5', label: 'Gợi ý hành động', status: 'pending' },
];

const PHASES_ALL_DONE: PhaseItem[] = [
  { id: '1', label: 'Nhận diện sản phẩm', meta: '1.4s', status: 'done' },
  { id: '2', label: 'Tra cứu giá', meta: '0.8s', status: 'done' },
  { id: '3', label: 'Phân tích', meta: '2.1s', status: 'done' },
];

const meta = {
  title: 'Molecules/PhasesCard',
  component: PhasesCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Phase progress indicator for analysis pipelines. 2 modes: "list" (I01-A inline ' +
          'phases) and "card" (I07 dashboard widget with icon header). Status badges auto-render ' +
          'XONG/ĐANG/CHỜ Vietnamese labels per status enum.',
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['list', 'card'] },
    phases: { control: 'object' },
  },
  args: {
    mode: 'list',
    phases: PHASES_MIXED,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhasesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Modes ===

export const ModeList: Story = {
  name: 'Mode — list (I01-A inline)',
  args: { mode: 'list', phases: PHASES_MIXED },
};

export const ModeCard: Story = {
  name: 'Mode — card (I07 dashboard widget)',
  args: {
    mode: 'card',
    phases: PHASES_MIXED,
    header: {
      icon: 'zap',
      title: 'Quy trình phân tích',
      subtitle: '5 bước · 2/5 hoàn thành',
    },
  },
};

// === Status variations ===

export const AllDone: Story = {
  name: 'All phases done',
  args: { mode: 'list', phases: PHASES_ALL_DONE },
};

export const SinglePhase: Story = {
  name: 'Single phase active',
  args: {
    mode: 'card',
    phases: [{ id: '1', label: 'Đang xử lý...', status: 'active' }],
    header: { icon: 'zap', title: 'Tiến trình' },
  },
};

export const CardWithoutHeader: Story = {
  name: 'Card mode — no header',
  args: { mode: 'card', phases: PHASES_MIXED },
};
