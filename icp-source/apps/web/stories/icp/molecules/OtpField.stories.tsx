/**
 * apps/web/stories/icp/molecules/OtpField.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Molecule: <OtpField> (T05, Family B)
 *
 * Source verified: components/icp/molecules/OtpField.tsx
 *   Props: length?: 4 | 6 (default 6 per mockup state-G),
 *          value?: string (controlled — string of digits),
 *          onChange?: (value: string) => void,
 *          disabled?: boolean (default false),
 *          autoFocus?: boolean (default true — first cell autofocus on mount)
 *   Internal state when uncontrolled; controlled when value provided.
 *
 * Decisions applied:
 * - C-22 verify: 5 props, 2 length values, controlled/uncontrolled pattern
 * - C-15 Client (onChange handler + focus management via refs + useEffect)
 * - C-07 navigation-agnostic — onChange callback only
 * - C-08 VN: aria-label baked Vietnamese
 * - C-13 Omit 'children'|'onChange' from HTMLAttributes (custom (value: string) signature)
 * - C-23 atom bypass — raw inline OTP cells (input elements, no Button atom)
 * - Q4 Registry: SINGLE-INTENT (focused use case: I06 OTP confirmation state-G)
 *
 * Story coverage: Default 6-digit + 4-digit + value variations (empty/partial/full) + disabled
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { OtpField } from '@/components/icp/molecules';

const meta = {
  title: 'Molecules/OtpField',
  component: OtpField,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'OTP digit entry field for I06 confirmation state-G. length 4 or 6 (default 6). ' +
          'Auto-focus first cell on mount. Supports controlled (value prop) + uncontrolled ' +
          'modes. onChange fires with concatenated digit string on every input. Backspace ' +
          'navigates to previous cell. C-23 atom bypass — raw <input> cells (no Button atom).',
      },
    },
  },
  argTypes: {
    length: {
      control: 'inline-radio',
      options: [4, 6],
    },
    value: { control: 'text' },
    disabled: { control: 'boolean' },
    autoFocus: { control: 'boolean' },
  },
  args: {
    length: 6,
    autoFocus: false, // Disable autoFocus in stories to prevent stealing focus
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OtpField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === Length variations ===

export const Length6: Story = {
  name: 'Length 6 (default state-G)',
  args: { length: 6 },
};

export const Length4: Story = {
  name: 'Length 4',
  args: { length: 4 },
};

// === Value states ===

export const EmptyValue: Story = {
  name: 'Empty (controlled value="")',
  args: { length: 6, value: '' },
};

export const PartialFilled: Story = {
  name: 'Partial — 3/6 digits filled',
  args: { length: 6, value: '123' },
};

export const FullyFilled: Story = {
  name: 'Fully filled — 6/6',
  args: { length: 6, value: '123456' },
};

export const Length4Filled: Story = {
  name: 'Length 4 — fully filled',
  args: { length: 4, value: '1234' },
};

// === State variations ===

export const Disabled: Story = {
  name: 'Disabled (during submission)',
  args: { length: 6, value: '12345', disabled: true },
};

// === AutoFocus ===

export const WithAutoFocus: Story = {
  name: 'autoFocus=true (first cell focused on mount)',
  args: { length: 6, autoFocus: true, value: '' },
  parameters: {
    docs: {
      description: {
        story: 'autoFocus=true uses useEffect to focus first input cell on mount.',
      },
    },
  },
};
