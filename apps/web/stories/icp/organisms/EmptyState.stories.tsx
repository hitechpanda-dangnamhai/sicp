/**
 * apps/web/stories/icp/organisms/EmptyState.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <EmptyState> (T06)
 *
 * Source verified: components/icp/organisms/EmptyState.tsx
 *   Props: title: string (REQUIRED),
 *          icon?: ReactNode, subtitle?, quote?: string (italic friendly tone),
 *          actions?: ReactNode (1-3 Buttons recommended, no runtime cap),
 *          density?: 'compact'|'centered' (default 'centered')
 *   role="status" + aria-live="polite" baked.
 *   Distribution: SERVER (pure presentational)
 *
 * Decisions applied:
 * - C-22 verify: 6 props from source
 * - C-15 Server (no event handlers — actions are consumer-attached)
 * - C-08 VN: title VN per consumer, role="status"
 * - Amendment 2: open ReactNode actions slot (no runtime cap)
 * - Q4 Registry: SINGLE-INTENT (slot composition, single role)
 *
 * Story coverage: Default + densities + with/without icon/quote/actions + composition examples
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EmptyState } from '@/components/icp/organisms';
import { Button, Icon } from '@/components/icp/atoms';

const meta = {
  title: 'Organisms/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Empty state placeholder. Icon (or illustration) slot + title (REQUIRED) + subtitle + ' +
          'optional quote (italic friendly) + actions slot (1-3 Buttons). 2 densities: compact ' +
          '(inline empty) and centered (full-stage). role="status" aria-live="polite".',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    quote: { control: 'text' },
    density: { control: 'inline-radio', options: ['compact', 'centered'] },
  },
  args: {
    title: 'Chưa có dữ liệu',
    subtitle: 'Hãy thêm sản phẩm để bắt đầu phân tích',
    density: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <Icon name="inbox" size={48} className="text-icp-pink-400" />,
    title: 'Chưa có dữ liệu',
    subtitle: 'Hãy thêm sản phẩm để bắt đầu phân tích',
  },
};

// === Composition variations ===

export const TitleOnly: Story = {
  name: 'Title only (no icon, subtitle, actions)',
  args: {
    title: 'Trống rỗng',
    icon: undefined,
    subtitle: undefined,
  },
};

export const TitleSubtitle: Story = {
  name: 'Title + subtitle',
  args: {
    title: 'Chưa có sản phẩm',
    subtitle: 'Anh hãy thêm sản phẩm đầu tiên',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <Icon name="inbox" size={48} className="text-icp-pink-400" />,
    title: 'Hộp thư trống',
    subtitle: 'Tất cả tin nhắn đã được đọc',
  },
};

export const WithQuote: Story = {
  name: 'With italic quote (friendly tone)',
  args: {
    icon: <Icon name="sparkles" size={48} className="text-icp-pink-400" />,
    title: 'Sẵn sàng phân tích',
    subtitle: 'Bắt đầu bằng cách chụp ảnh hoặc nói tên sản phẩm',
    quote: 'Em là Aida, em ở đây để giúp anh.',
  },
};

export const WithActions: Story = {
  args: {
    icon: <Icon name="inbox" size={48} className="text-icp-pink-400" />,
    title: 'Giỏ hàng trống',
    subtitle: 'Hãy thêm sản phẩm vào giỏ',
    actions: (
      <div className="flex gap-2 mt-2">
        <Button variant="pink-grad" leftIcon="plus" onClick={fn()}>
          Thêm sản phẩm
        </Button>
        <Button variant="ghost" onClick={fn()}>
          Xem mẫu
        </Button>
      </div>
    ),
  },
};

export const FullComposition: Story = {
  name: 'Full — icon + title + subtitle + quote + actions',
  args: {
    icon: <Icon name="sparkles" size={48} className="text-icp-pink-400" />,
    title: 'Chưa có phân tích nào',
    subtitle: 'Bắt đầu phân tích sản phẩm đầu tiên của anh',
    quote: 'Em sẽ giúp anh hiểu thị trường nhanh nhất.',
    actions: (
      <div className="flex gap-2 mt-2">
        <Button variant="pink-grad" leftIcon="mic">
          Nói tên sản phẩm
        </Button>
        <Button variant="secondary">
          Tải ảnh lên
        </Button>
      </div>
    ),
  },
};

// === Densities ===

export const DensityCompact: Story = {
  name: 'Density — compact (inline)',
  args: {
    density: 'compact',
    icon: <Icon name="inbox" size={20} className="text-icp-pink-400" />,
    title: 'Trống',
    subtitle: 'Chưa có gì ở đây',
  },
};

export const DensityCentered: Story = {
  name: 'Density — centered (full-stage)',
  args: {
    density: 'centered',
    icon: <Icon name="inbox" size={48} className="text-icp-pink-400" />,
    title: 'Trang trống',
    subtitle: 'Hãy bắt đầu thêm nội dung',
  },
};
