/**
 * apps/web/stories/icp/organisms/LoginForm.stories.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Storybook + COMPONENT_REGISTRY + Visual Smoke
 * Organism: <LoginForm> (T06)
 *
 * Source verified: components/icp/organisms/LoginForm.tsx
 *   Props: onSubmit: SubmitHandler<LoginFormData> (REQUIRED),
 *          loading?: boolean (default false — shows spinner + disabled),
 *          error?: string (external error banner above fields),
 *          defaultValues?: Partial<LoginFormData> ({email?, password?}),
 *          className?
 *   LoginFormData: { email: string, password: string }
 *   Distribution: CLIENT (react-hook-form + useState for showPassword toggle)
 *   Uses react-hook-form with mode='onBlur' validation.
 *
 * Decisions applied:
 * - C-22 verify: 5 props from source
 * - C-15 Client (react-hook-form + useState — has 'use client' directive)
 * - C-07 navigation-agnostic — onSubmit callback (consumer attaches Server Action)
 * - C-08 VN: field labels VN
 * - C-29 V-SLICE S-03 attaches Server Action wrapper later
 * - Q4 Registry: MULTI-INTENT (form state + loading + error + show-password toggle)
 *
 * Story coverage: Default + loading + error banner + defaultValues + V-SLICE pattern
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { LoginForm } from '@/components/icp/organisms';

const meta = {
  title: 'Organisms/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'app-bg' },
    docs: {
      description: {
        component:
          'Login form with email + password fields (react-hook-form mode="onBlur"). External ' +
          'loading state (parent controls — submit button shows spinner + disables form). ' +
          'External error banner above fields (server validation errors). ' +
          'Field-level inline errors via react-hook-form FormMessage. show-password toggle ' +
          'baked. T06 stays CLIENT-only; V-SLICE S-03 attaches Server Action per C-29.',
      },
    },
  },
  argTypes: {
    loading: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    onSubmit: fn(),
    loading: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// === States ===

export const Loading: Story = {
  name: 'Loading state (during submission)',
  args: {
    loading: true,
    defaultValues: { email: 'user@example.com' },
  },
  parameters: {
    docs: {
      description: {
        story: 'loading=true → submit button shows Spinner + disabled. Form fields still readable.',
      },
    },
  },
};

export const WithErrorBanner: Story = {
  name: 'With error banner (server validation)',
  args: {
    error: 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
    defaultValues: { email: 'wrong@example.com' },
  },
};

export const WithDefaultEmail: Story = {
  name: 'With defaultValues (pre-fill email)',
  args: {
    defaultValues: { email: 'returning.user@example.com' },
  },
};

// === Combinations ===

export const LoadingWithDefaults: Story = {
  name: 'Loading + defaultValues + previous error cleared',
  args: {
    loading: true,
    defaultValues: { email: 'user@example.com' },
  },
};

export const ErrorAfterRetry: Story = {
  name: 'Error after retry (V-SLICE S-03 pattern)',
  args: {
    error: 'Tài khoản đã bị khóa tạm thời. Thử lại sau 5 phút.',
    defaultValues: { email: 'locked@example.com' },
  },
  parameters: {
    docs: {
      description: {
        story: 'Pattern: parent V-SLICE catches Server Action error → passes to LoginForm error ' +
               'prop. Form preserves defaultValues for retry UX.',
      },
    },
  },
};
