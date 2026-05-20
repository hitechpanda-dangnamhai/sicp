/**
 * apps/web/stories/icp/atoms/Button.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Atom:    <Button> (T02, AC-5)
 *
 * Source verified: components/icp/atoms/Button.tsx CVA buttonVariants
 *   variants:
 *     variant: default | secondary | ghost | outline | destructive | link |
 *              pink-grad | mic-grad | success  (9 total per T05 KI-3 + T04 C-22 lessons)
 *     size: sm | md | lg | icon  (4 total)
 *   defaultVariants: { variant: 'default', size: 'md' }
 *   Additional props: asChild?: boolean, loading?: boolean,
 *                     leftIcon?: IconName, rightIcon?: IconName, children?: ReactNode
 *   Extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> + VariantProps.
 *
 * Decisions:
 * - C-22: 9 variant strings (NOT 'primary' per T04 KI lesson — actual is 'default')
 * - C-15: Client (interactive, onClick from VariantProps via HTML attrs)
 * - C-08 VN: button labels VN hardcoded
 * - C-13 CVA: variants reflected accurately per source CVA config
 * - Q4 Registry: SINGLE-INTENT (atom-level — used everywhere but pure stateless wrapper)
 *
 * Story coverage: Default + 9 variant stories + 4 size stories + loading + leftIcon/rightIcon
 *                 + asChild + onClick spy via fn()
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/icp/atoms';

const meta = {
  title: 'Atoms/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'MoMo-themed shadcn Button. 9 variants × 4 sizes + loading state + leftIcon/rightIcon. ' +
          'Bypassed by T05 Family B molecules for 28-30px micro-elements per C-23.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default', 'secondary', 'ghost', 'outline', 'destructive', 'link',
        'pink-grad', 'mic-grad', 'success',
      ],
      description: '9 variants per CVA. default = pink HSL shadcn primary.',
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg', 'icon'],
      description: 'Heights: sm h-9 / md h-11 / lg h-12 / icon h-10 (square)',
    },
    loading: {
      control: 'boolean',
      description: 'Show Spinner instead of leftIcon; disables button + sets aria-busy',
    },
    leftIcon: {
      control: 'text',
      description: 'Icon name from lib/icon-map (e.g., "mic", "check")',
    },
    rightIcon: {
      control: 'text',
      description: 'Icon name after children',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as Radix Slot — passes className+props to child',
    },
    disabled: {
      control: 'boolean',
    },
  },
  args: {
    variant: 'default',
    size: 'md',
    children: 'Bấm vào đây',
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Variants (9 stories) ===

export const VariantDefault: Story = {
  name: 'Variant — default (HSL primary)',
  args: { variant: 'default', children: 'Lưu sản phẩm' },
};

export const VariantSecondary: Story = {
  name: 'Variant — secondary',
  args: { variant: 'secondary', children: 'Quay lại' },
};

export const VariantGhost: Story = {
  name: 'Variant — ghost',
  args: { variant: 'ghost', children: 'Bỏ qua' },
};

export const VariantOutline: Story = {
  name: 'Variant — outline',
  args: { variant: 'outline', children: 'Hủy' },
};

export const VariantDestructive: Story = {
  name: 'Variant — destructive',
  args: { variant: 'destructive', children: 'Xóa' },
};

export const VariantLink: Story = {
  name: 'Variant — link',
  args: { variant: 'link', children: 'Xem chi tiết' },
};

export const VariantPinkGrad: Story = {
  name: 'Variant — pink-grad (MoMo gradient)',
  args: { variant: 'pink-grad', children: 'Thanh toán' },
};

export const VariantMicGrad: Story = {
  name: 'Variant — mic-grad (voice CTA)',
  args: { variant: 'mic-grad', children: 'Bắt đầu nói' },
};

export const VariantSuccess: Story = {
  name: 'Variant — success (green)',
  args: { variant: 'success', children: 'Xác nhận thành công' },
};

// === Sizes (4 stories) ===

export const SizeSm: Story = {
  name: 'Size — sm (h-9)',
  args: { size: 'sm', children: 'Nhỏ' },
};

export const SizeMd: Story = {
  name: 'Size — md (h-11 default)',
  args: { size: 'md', children: 'Vừa' },
};

export const SizeLg: Story = {
  name: 'Size — lg (h-12)',
  args: { size: 'lg', children: 'Lớn' },
};

export const SizeIcon: Story = {
  name: 'Size — icon (h-10 w-10 square)',
  args: { size: 'icon', leftIcon: 'more-vertical', children: undefined },
};

// === State + Icons ===

export const Loading: Story = {
  args: { loading: true, children: 'Đang tải...' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Vô hiệu' },
};

export const WithLeftIcon: Story = {
  args: { leftIcon: 'check', children: 'Lưu' },
};

export const WithRightIcon: Story = {
  args: { rightIcon: 'chevron-right', children: 'Tiếp tục' },
};

export const WithBothIcons: Story = {
  args: { leftIcon: 'mic', rightIcon: 'chevron-right', children: 'Nói tiếp' },
};
