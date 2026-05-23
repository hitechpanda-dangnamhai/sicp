/**
 * apps/web/stories/icp/molecules/ActionCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <ActionCard> (T04, Family A — compound component)
 *
 * Source verified: components/icp/molecules/ActionCard.tsx
 *   Compound: Root + Header + Body + DetailRow + Tags + Actions (5 sub-components)
 *   Root variants: 'default' | 'price' | 'attrs' | 'stock-up' | 'wait' | 'alt' | 'insight'
 *   Header props: icon?: IconName, title (REQ), subtitle?, count?
 *   Body props: highlight?, miniChart?, miniChartLabel?
 *   DetailRow props: label, value (REQ both)
 *
 * Decisions applied:
 * - C-22 verify: 7 variants from CVA actionCardVariants source
 * - C-15 Server (pure presentational compound)
 * - C-08 VN labels in stories
 * - Q4 Registry: MULTI-INTENT (7 variants × 5 sub-components compound = strong qualifier)
 *
 * Story coverage: Default + 7 variants + full compound composition examples
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ActionCard } from '@/components/icp/molecules';
import { Button, ChipPill } from '@/components/icp/atoms';

const meta = {
  title: 'Molecules/ActionCard',
  component: ActionCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Compound card with 7 variants (default/price/attrs/stock-up/wait/alt/insight) + ' +
          '5 sub-components (Header/Body/DetailRow/Tags/Actions). Used across I01/I02/I07 for ' +
          'AI analysis output cards.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'price', 'attrs', 'stock-up', 'wait', 'alt', 'insight'],
    },
  },
  args: {
    variant: 'default',
    children: null, // Required by ActionCardProps — overridden by each story's render function
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="sparkles" title="Mặc định" subtitle="Variant default" />
      <ActionCard.Body>
        Nội dung mặc định của thẻ hành động.
      </ActionCard.Body>
    </ActionCard>
  ),
};

// === 7 variants ===

export const VariantPrice: Story = {
  name: 'Variant — price (amber)',
  args: { variant: 'price' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="tag" title="Giá đề xuất" subtitle="Mức cạnh tranh" />
      <ActionCard.Body highlight="65.000 ₫">
        Dựa trên 5 cửa hàng trên Shopee, giá trung vị 62.000₫.
      </ActionCard.Body>
      <ActionCard.DetailRow label="Min" value="58.000 ₫" />
      <ActionCard.DetailRow label="Max" value="72.000 ₫" />
    </ActionCard>
  ),
};

export const VariantAttrs: Story = {
  name: 'Variant — attrs (pink)',
  args: { variant: 'attrs' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="info" title="Thuộc tính sản phẩm" />
      <ActionCard.Body>
        <ActionCard.DetailRow label="Trọng lượng" value="100g" />
        <ActionCard.DetailRow label="Hạn dùng" value="14 ngày" />
        <ActionCard.DetailRow label="Bảo quản" value="2-8°C" />
      </ActionCard.Body>
    </ActionCard>
  ),
};

export const VariantStockUp: Story = {
  name: 'Variant — stock-up (emerald)',
  args: { variant: 'stock-up' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="trending-up" title="Tăng tồn kho" count={12} />
      <ActionCard.Body highlight="Đề xuất nhập thêm 30 đơn vị">
        Doanh số 7 ngày qua tăng 45%. Cần stock-up trước cuối tuần.
      </ActionCard.Body>
      <ActionCard.Actions>
        <Button variant="success" size="sm" className="flex-1">
          Đặt hàng ngay
        </Button>
      </ActionCard.Actions>
    </ActionCard>
  ),
};

export const VariantWait: Story = {
  name: 'Variant — wait (amber strong)',
  args: { variant: 'wait' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="clock" title="Chờ phê duyệt" />
      <ActionCard.Body>
        Đơn nhập hàng đang chờ chủ shop xác nhận.
      </ActionCard.Body>
    </ActionCard>
  ),
};

export const VariantAlt: Story = {
  name: 'Variant — alt (light pink)',
  args: { variant: 'alt' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header title="Đề xuất thay thế" />
      <ActionCard.Body>
        Sản phẩm tương tự có thể thay thế nếu hết hàng.
      </ActionCard.Body>
    </ActionCard>
  ),
};

export const VariantInsight: Story = {
  name: 'Variant — insight (multi-gradient)',
  args: { variant: 'insight' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header icon="lightbulb" title="Phân tích sâu" subtitle="AI nhận định" />
      <ActionCard.Body>
        Sản phẩm có khả năng tăng trưởng cao trong 2 tuần tới.
      </ActionCard.Body>
      <ActionCard.Tags>
        <ChipPill variant="badge" color="pink" size="sm">HOT</ChipPill>
        <ChipPill variant="tag" color="orange" size="sm">Tăng trưởng</ChipPill>
      </ActionCard.Tags>
    </ActionCard>
  ),
};

// === Full composition ===

export const FullComposition: Story = {
  name: 'Full compound — Header + Body + DetailRow + Tags + Actions',
  args: { variant: 'price' },
  render: (args) => (
    <ActionCard {...args}>
      <ActionCard.Header
        icon="tag"
        title="Phân tích giá"
        subtitle="So sánh thị trường"
        count={5}
      />
      <ActionCard.Body highlight="Giá tối ưu: 65.000 ₫">
        <ActionCard.DetailRow label="Giá hiện tại" value="60.000 ₫" />
        <ActionCard.DetailRow label="Trung vị" value="62.000 ₫" />
        <ActionCard.DetailRow label="Đề xuất" value="65.000 ₫" />
      </ActionCard.Body>
      <ActionCard.Tags>
        <ChipPill variant="badge" color="orange" size="sm">CẠNH TRANH</ChipPill>
        <ChipPill variant="status" color="green" size="sm">Trong khoảng</ChipPill>
      </ActionCard.Tags>
      <ActionCard.Actions>
        <Button variant="ghost" size="sm" className="flex-1">Bỏ qua</Button>
        <Button variant="pink-grad" size="sm" className="flex-1">Áp dụng</Button>
      </ActionCard.Actions>
    </ActionCard>
  ),
};
