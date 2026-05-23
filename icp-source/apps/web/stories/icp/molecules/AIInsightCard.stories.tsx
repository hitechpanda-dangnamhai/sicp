/**
 * apps/web/stories/icp/molecules/AIInsightCard.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <AIInsightCard> (T04, Family A)
 *
 * Source verified: components/icp/molecules/AIInsightCard.tsx
 *   Props: text: string | ReactNode (REQUIRED),
 *          variant?: 'default' | 'reasoning' (default 'default'),
 *          tag?: string (default '🤖 Aida nhận định' — reasoning variant only),
 *          avatar?: ReactNode (override default per variant)
 *
 * Decisions applied:
 * - C-22 verify: 2 variants from CVA aiInsightCardVariants
 * - C-15 Server (no event handlers)
 * - C-08 VN labels
 * - default variant: rose-amber gradient, inline avatar + text
 * - reasoning variant: white-emerald gradient with emerald left border, stacked avatar+tag+text
 * - Q4 Registry: SINGLE-INTENT (2 variants but minimal slots beyond text)
 *
 * Story coverage: Default + 2 variants + tag override + inline strong text
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AIInsightCard } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/AIInsightCard',
  component: AIInsightCard,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          '2 variants: "default" (rose-amber gradient, inline avatar+text for I01 quick ' +
          'insights) and "reasoning" (white-emerald gradient with emerald left border for I02 ' +
          'AI reasoning trace). Supports <strong> highlights in text via inline CSS selectors.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['default', 'reasoning'],
    },
    text: { control: 'text' },
    tag: { control: 'text' },
  },
  args: {
    variant: 'default',
    text: 'Sản phẩm phù hợp với phân khúc tầm trung.',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AIInsightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VariantDefault: Story = {
  name: 'Variant — default (rose-amber inline)',
  args: { variant: 'default', text: 'Sản phẩm phù hợp với phân khúc tầm trung.' },
};

export const VariantReasoning: Story = {
  name: 'Variant — reasoning (emerald left border)',
  args: {
    variant: 'reasoning',
    text: 'Dựa vào dữ liệu 30 ngày qua, em thấy nhu cầu sản phẩm tăng mạnh vào cuối tuần.',
  },
};

export const ReasoningCustomTag: Story = {
  name: 'Reasoning — custom tag',
  args: {
    variant: 'reasoning',
    tag: '✨ Phân tích chuyên sâu',
    text: 'Đây là phân tích từ dữ liệu thị trường trong 90 ngày.',
  },
};

export const WithStrongHighlight: Story = {
  name: 'Default — with <strong> highlight',
  args: {
    variant: 'default',
    text: (
      <>
        Giá đề xuất <strong>65.000₫</strong> cao hơn trung vị thị trường 5%.
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default variant CSS targets [&_strong] → applies text-pink-700 + font-bold to inline ' +
          '<strong> elements within text.',
      },
    },
  },
};

export const ReasoningWithStrong: Story = {
  name: 'Reasoning — with <strong> highlight (emerald)',
  args: {
    variant: 'reasoning',
    text: (
      <>
        Doanh số tăng <strong>+45%</strong> so với tuần trước. Khuyến nghị stock-up.
      </>
    ),
  },
};
