/**
 * apps/web/stories/icp/organisms/LoginForm.stories.tsx
 *
 * Slice:    S-01 UI Foundation (T07) initial. S-03 T04 PATCH — +rememberMe variants.
 * Organism: <LoginForm> (T06 + T04 patch)
 *
 * Source verified: components/icp/organisms/LoginForm.tsx (post T04 patch — 276 LOC)
 *   Props: onSubmit: SubmitHandler<LoginFormData> (REQUIRED),
 *          loading?: boolean (default false — shows spinner + disabled),
 *          error?: string (external error banner above fields),
 *          defaultValues?: Partial<LoginFormData> ({email?, password?, rememberMe?}),
 *          className?
 *   LoginFormData: { email: string, password: string, rememberMe: boolean }  ← T04 +rememberMe
 *   Distribution: CLIENT (react-hook-form + Controller + useState for showPassword)
 *   Uses react-hook-form with mode='onBlur' validation.
 *
 * Decisions applied (S-01 T06 inherited):
 * - C-22 verify: 5 props from source
 * - C-15 Client (react-hook-form + Controller + useState — has 'use client' directive)
 * - C-07 navigation-agnostic — onSubmit callback (consumer attaches TanStack mutation)
 * - C-08 VN: field labels VN
 *
 * S-03 T04 PATCH decisions:
 * - **D-18** "Quên mật khẩu?" Link to `/auth/forgot-password` (SPA navigation)
 * - **D-19** TanStack mutation only — V-SLICE T04 page.tsx attaches useLogin
 * - **D-20** rememberMe Checkbox inline below Submit button per mockup lines 172-178.
 *   Default `rememberMe: false`. camelCase internal ↔ snake_case `remember_me` at page boundary.
 *
 * Story coverage:
 *   Original: Default + Loading + ErrorBanner + DefaultEmail + LoadingWithDefaults + ErrorAfterRetry
 *   T04 NEW: WithRememberMeChecked (D-20 visualization) + ForgotPasswordLinkInteraction
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
          'Login form with email + password fields + **rememberMe Checkbox** (T04 patch D-20) ' +
          '+ **"Quên mật khẩu?" Link** to /auth/forgot-password (T04 patch D-18). ' +
          'Uses react-hook-form mode="onBlur" + Controller for non-native Checkbox primitive. ' +
          'External loading state (parent controls — submit button shows spinner + disables form). ' +
          'External error banner above fields (server validation errors). ' +
          'Field-level inline errors via react-hook-form FormMessage. show-password toggle baked. ' +
          'T06 stays CLIENT-only; V-SLICE S-03 T04 attaches TanStack mutation per D-19.',
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

// === T04 NEW variants (D-20 rememberMe + D-18 forgot password Link) ===

export const WithRememberMeChecked: Story = {
  name: 'T04 D-20: rememberMe pre-checked',
  args: {
    defaultValues: { email: 'returning.user@example.com', rememberMe: true },
  },
  parameters: {
    docs: {
      description: {
        story:
          'rememberMe defaultValue=true → Checkbox pre-checked. Maps to BE `remember_me: true` at ' +
          'T04 page.tsx boundary (`toLoginDto()` helper) → BE sets cookies with Max-Age=accessTtlSeconds. ' +
          'V-SLICE T02 smoke-auth AC-2 verifies BE Set-Cookie Max-Age behavior end-to-end.',
      },
    },
  },
};

export const ForgotPasswordLink: Story = {
  name: 'T04 D-18: "Quên mật khẩu?" Link visible (default state)',
  parameters: {
    docs: {
      description: {
        story:
          'Default view exposes Next.js <Link href="/auth/forgot-password"> at right of rememberMe ' +
          'Checkbox row (per mockup lines 172-178). SPA navigation (prefetch enabled, no full reload). ' +
          'Target page: forgot-password stub (S03-D-22 minimal design).',
      },
    },
  },
};

// === Combinations ===

export const LoadingWithDefaults: Story = {
  name: 'Loading + defaultValues + previous error cleared',
  args: {
    loading: true,
    defaultValues: { email: 'user@example.com', rememberMe: true },
  },
};

export const ErrorAfterRetry: Story = {
  name: 'Error after retry (V-SLICE S-03 pattern)',
  args: {
    error: 'Tài khoản đã bị khóa tạm thời. Thử lại sau 5 phút.',
    defaultValues: { email: 'locked@example.com', rememberMe: false },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pattern: parent V-SLICE catches TanStack mutation error → passes to LoginForm error ' +
          'prop. Form preserves defaultValues (including rememberMe state) for retry UX.',
      },
    },
  },
};
