/**
 * apps/web/stories/icp/molecules/PaymentMethodPicker.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <PaymentMethodPicker> (T05, Family B)
 *
 * Source verified: components/icp/molecules/PaymentMethodPicker.tsx
 *   Props: methods: PaymentMethod[] (REQUIRED — {id, name, subtitle, avatar, badge?}),
 *          selected?: string (controlled id),
 *          onSelect?: (id: string) => void
 *   PaymentMethodAvatar: { type: 'gradient-text'|'gradient-icon', bg: [from, to], content, dashed? }
 *   PaymentMethodBadge: { type: 'success'|'warning', label }
 *   role="radiogroup" + aria-label="Phương thức thanh toán" baked.
 *
 * Decisions applied:
 * - C-22 verify: methods array structure exact from PaymentMethod interface
 * - C-15 Client (onSelect handler — controlled radio behavior)
 * - C-07 navigation-agnostic — onSelect callback only
 * - C-08 VN labels (aria-label baked, methods content VN per consumer)
 * - C-13 Omit 'onSelect' from HTMLAttributes (custom (id) => void signature)
 * - C-23 atom bypass — raw inline RadioCircle 22×22 + MethodAvatar 42×42 per T05
 * - Q4 Registry: MULTI-INTENT (methods array × 2 avatar types × 2 badge types × selected state)
 *
 * Story coverage: Default + various methods + selected state + dashed avatar + badge variants
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PaymentMethodPicker, type PaymentMethod } from '@/components/icp/molecules';

const METHODS_BASIC: PaymentMethod[] = [
  {
    id: 'momo',
    name: 'MoMo',
    subtitle: 'Số dư: 1.250.000₫',
    avatar: { type: 'gradient-text', bg: ['#E91E63', '#F43F5E'], content: 'Mo' },
    badge: { type: 'success', label: '-2%' },
  },
  {
    id: 'vnpay',
    name: 'VNPay',
    subtitle: 'Liên kết ngân hàng',
    avatar: { type: 'gradient-text', bg: ['#005BAA', '#0288D1'], content: 'VN' },
  },
  {
    id: 'card',
    name: 'Thẻ tín dụng',
    subtitle: 'Visa, Mastercard',
    avatar: { type: 'gradient-icon', bg: ['#4A4A4A', '#1A1A1A'], content: 'credit-card' },
    badge: { type: 'warning', label: '+15.000₫' },
  },
  {
    id: 'cash',
    name: 'Tiền mặt',
    subtitle: 'Khi nhận hàng',
    avatar: { type: 'gradient-icon', bg: ['#10B981', '#059669'], content: 'wallet' },
  },
];

const METHODS_WITH_MOCK: PaymentMethod[] = [
  ...METHODS_BASIC,
  {
    id: 'mock',
    name: 'Mock test',
    subtitle: 'Dev only',
    avatar: { type: 'gradient-text', bg: ['#F1F1F1', '#E5E5E5'], content: 'Mock', dashed: true },
  },
];

const meta = {
  title: 'Molecules/PaymentMethodPicker',
  component: PaymentMethodPicker,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Radio group payment method picker. methods array drives render. avatar.type ' +
          '"gradient-text" shows text label, "gradient-icon" shows lucide icon — both inside ' +
          '42×42 gradient bg. badge optional: "success" green (cashback) / "warning" amber ' +
          '(surcharge). dashed flag adds dashed border (test methods). role="radiogroup".',
      },
    },
  },
  argTypes: {
    methods: { control: 'object' },
    selected: { control: 'text' },
  },
  args: {
    methods: METHODS_BASIC,
    selected: 'momo',
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaymentMethodPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Selected state variations ===

export const MomoSelected: Story = {
  name: 'MoMo selected (default)',
  args: { methods: METHODS_BASIC, selected: 'momo' },
};

export const VnPaySelected: Story = {
  args: { methods: METHODS_BASIC, selected: 'vnpay' },
};

export const CashSelected: Story = {
  args: { methods: METHODS_BASIC, selected: 'cash' },
};

export const NoneSelected: Story = {
  name: 'No method selected',
  args: { methods: METHODS_BASIC, selected: undefined },
};

// === With dashed avatar (test method) ===

export const WithDashedAvatar: Story = {
  name: 'Includes mock test method (dashed avatar)',
  args: { methods: METHODS_WITH_MOCK, selected: 'momo' },
  parameters: {
    docs: {
      description: {
        story: 'avatar.dashed=true renders dashed border (mockup state-F dev test methods).',
      },
    },
  },
};

// === Minimal ===

export const SingleMethod: Story = {
  name: 'Single method only',
  args: {
    methods: [METHODS_BASIC[0]],
    selected: 'momo',
  },
};
