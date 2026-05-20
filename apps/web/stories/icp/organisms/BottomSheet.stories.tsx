/**
 * apps/web/stories/icp/organisms/BottomSheet.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <BottomSheet> (T06)
 *
 * Source verified: components/icp/organisms/BottomSheet.tsx
 *   Props: open: boolean (REQUIRED, controlled),
 *          onOpenChange: (open: boolean) => void (REQUIRED),
 *          title?, description?, children?: ReactNode (body slot),
 *          footer?: ReactNode (CTA slot), className?, height?
 *   Wraps shadcn/ui <Sheet side="bottom"> — MoMo-themed override.
 *   Distribution: CLIENT (Radix Dialog from shadcn sheet — has 'use client').
 *
 * Decisions applied:
 * - C-22 verify: 8 props from source
 * - C-15 Client (Radix Dialog requires)
 * - C-07 navigation-agnostic — onOpenChange callback
 * - C-08 VN: title VN per consumer
 * - C-24 multi-intent qualifier: max-h-[90vh] generous default
 * - Q4 Registry: MULTI-INTENT (open state + multiple slots + height override)
 *
 * Story coverage: Default open + closed + title/description variations +
 *                 body slot (cart items) + footer CTA + height override
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { useState } from 'react';
import { BottomSheet } from '@/components/icp/organisms';
import { Button } from '@/components/icp/atoms';
import { CartItemRow, PaymentMethodPicker } from '@/components/icp/molecules';

// Wrapper to manage open state via useState for stories (component itself is controlled)
const InteractiveBottomSheet = ({ children, footer, title, description, height, defaultOpen = true }: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  description?: string;
  height?: string;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <Button variant="pink-grad" onClick={() => setOpen(true)}>
        Mở Sheet
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        height={height}
        footer={footer}
      >
        {children}
      </BottomSheet>
    </div>
  );
};

const meta = {
  title: 'Organisms/BottomSheet',
  component: BottomSheet,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Bottom sheet modal wrapping shadcn/ui Sheet (side="bottom"). MoMo-themed override ' +
          '(rounded-top-24px + soft shadow + pink-tinted handle indicator). Controlled by parent ' +
          'via open + onOpenChange. children body slot + optional footer slot. max-h-[90vh] default ' +
          'per C-24 multi-intent qualifier. Used I04 cart sheet + I05 confirm + I06 OTP sheet.',
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Tiêu đề sheet',
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    title: 'Tiêu đề sheet',
    description: 'Mô tả ngắn dưới tiêu đề',
    children: (
      <div className="px-4 py-4 text-sm text-icp-pink-900">
        Nội dung body — pass via children prop. Sheet auto-handles overlay + ESC + X button.
      </div>
    ),
  },
};

export const WithCartItems: Story = {
  name: 'I04 cart sheet — CartItemRow list',
  render: () => (
    <InteractiveBottomSheet
      title="Giỏ hàng"
      description="3 sản phẩm đang chọn"
      footer={
        <Button variant="pink-grad" className="flex-1">
          Thanh toán
        </Button>
      }
    >
      <div className="px-4 py-2 space-y-3">
        <CartItemRow
          product={{ brand: 'Vinamilk', name: 'Sữa chua men sống 100g', price: 8000 }}
          qty={2}
        />
        <CartItemRow
          product={{ brand: 'TH True Milk', name: 'Sữa tươi 1L', price: 32000 }}
          qty={1}
        />
        <CartItemRow
          product={{ brand: 'Vinamilk', name: 'Sữa chua', price: 8000 }}
          qty={1}
          stockIssue="out"
        />
      </div>
    </InteractiveBottomSheet>
  ),
};

export const WithPaymentPicker: Story = {
  name: 'I05 payment sheet — PaymentMethodPicker',
  render: () => (
    <InteractiveBottomSheet
      title="Phương thức thanh toán"
      footer={
        <div className="flex gap-2 flex-1">
          <Button variant="ghost" className="flex-1">Hủy</Button>
          <Button variant="pink-grad" className="flex-1">Xác nhận</Button>
        </div>
      }
    >
      <div className="px-4 py-2">
        <PaymentMethodPicker
          methods={[
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
          ]}
          selected="momo"
        />
      </div>
    </InteractiveBottomSheet>
  ),
};

export const TitleOnly: Story = {
  name: 'Title only (no description)',
  args: {
    open: true,
    title: 'Chỉ có tiêu đề',
    children: <div className="px-4 py-4 text-sm">Body content...</div>,
  },
};

export const NoTitle: Story = {
  name: 'No title (body-only sheet)',
  args: {
    open: true,
    title: undefined,
    description: undefined,
    children: <div className="px-4 py-4 text-sm">Body content full-width...</div>,
  },
};

export const FixedHeight: Story = {
  name: 'Fixed height — h-[60vh]',
  args: {
    open: true,
    title: 'Sheet chiều cao cố định',
    height: 'h-[60vh]',
    children: (
      <div className="px-4 py-4 text-sm">
        Sheet height fixed to 60% viewport. Use khi cần scroll nội bộ.
      </div>
    ),
  },
};
