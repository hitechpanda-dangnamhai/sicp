'use client';

/**
 * apps/web/components/icp/organisms/LoginForm.tsx
 *
 * Organism: <LoginForm> — I08 login form composing shadcn Form + Input + Button
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-11
 *
 * Source:   intent-08-state-A-login.html visual contract
 *           SEMANTIC_COMPONENTS Section 5.7 — I08 minimal CSS (1 bespoke class),
 *           rebuild as shadcn `<Form>` + `<Input>` + `<Button>` per ADR-033 stack
 *
 * Reach:    I08 only (S-03 V-SLICE Auth primary consumer)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onSubmit callback returning Promise<void> | void;
 *   V-SLICE S-03 wraps in Server Action or fetch at page level per C-29 resolution
 *   (NO Server Action at organism layer — keeps component portable)
 * - C-08 + D-05 VN inline — field labels + placeholders + error messages hardcoded VN
 * - C-13 N/A — uses shadcn Input native, no CVA collision
 * - C-15 CLIENT — useForm() hook + useState for show/hide password toggle
 * - C-18 Tier 4 Tailwind utility inline
 * - C-22 atom interface verified — composes shadcn Form/FormField/FormItem/
 *   FormLabel/FormControl/FormMessage + shadcn Input + T02 Button (extended) + T02 Icon
 * - C-29 RESOLVED — `onSubmit` callback prop only per C-07; V-SLICE S-03 attaches
 *   Server Action at page level (compose pattern not redesign)
 * - C-30 — uses NEW icons `mail` + `lock` + `eye` + `eye-off` (registered in
 *   icon-map.ts T06 patch AC-16)
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC (I08 only single V-SLICE)
 *
 * Validation:
 * - Email: required + RFC pattern match (react-hook-form built-in regex rule)
 * - Password: required + min 6 chars (basic; production should be stricter)
 * - No zod dependency added at T06 — uses react-hook-form built-in rules
 *
 * Public API:
 *   <LoginForm
 *     onSubmit={async ({ email, password }) => {
 *       await signIn(email, password);
 *     }}
 *     loading={isPending}
 *     error="Email hoặc mật khẩu không đúng"
 *   />
 */

import * as React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/icp/atoms';
import { Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginFormProps {
  /** Fires when form submits with valid data. Return Promise to keep `loading`
   *  state in sync at consumer level (T06 stays CLIENT-only via prop; V-SLICE
   *  S-03 attaches Server Action wrapper per C-29). */
  onSubmit: SubmitHandler<LoginFormData>;
  /** External loading state — when true, submit button shows spinner + disabled */
  loading?: boolean;
  /** External error message (e.g., from server "Email hoặc mật khẩu không đúng").
   *  Rendered as alert banner above fields. Field-level validation errors are
   *  rendered inline via react-hook-form FormMessage. */
  error?: string;
  /** Optional default values (e.g., pre-fill email from previous attempt) */
  defaultValues?: Partial<LoginFormData>;
  /** Optional className passthrough to outer <form> wrapper */
  className?: string;
}

export function LoginForm({ onSubmit, loading = false, error, defaultValues, className }: LoginFormProps) {
  const [showPassword, setShowPassword] = React.useState<boolean>(false);

  const form = useForm<LoginFormData>({
    defaultValues: {
      email: defaultValues?.email ?? '',
      password: defaultValues?.password ?? '',
    },
    mode: 'onBlur',
  });

  const handleTogglePassword = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('w-full flex flex-col gap-4', className)}
        noValidate
      >
        {/* External error banner (server-side rejection) */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl px-3 py-2.5 bg-icp-rose-50 border-[0.5px] border-icp-rose-200"
          >
            <p className="text-[12px] font-semibold text-icp-rose-700">{error}</p>
          </div>
        )}

        {/* Email field */}
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: 'Vui lòng nhập email',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Email không đúng định dạng',
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-semibold text-icp-pink-900">Email</FormLabel>
              <div className="relative">
                <Icon
                  name="mail"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-icp-pink-700 pointer-events-none z-10"
                />
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="ban@vidu.com"
                    disabled={loading}
                    className="pl-10 h-11 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                  />
                </FormControl>
              </div>
              <FormMessage className="text-[11px]" />
            </FormItem>
          )}
        />

        {/* Password field with eye-toggle */}
        <FormField
          control={form.control}
          name="password"
          rules={{
            required: 'Vui lòng nhập mật khẩu',
            minLength: {
              value: 6,
              message: 'Mật khẩu cần ít nhất 6 ký tự',
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-semibold text-icp-pink-900">Mật khẩu</FormLabel>
              <div className="relative">
                <Icon
                  name="lock"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-icp-pink-700 pointer-events-none z-10"
                />
                <FormControl>
                  <Input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••"
                    disabled={loading}
                    className="pl-10 pr-10 h-11 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={handleTogglePassword}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 z-10',
                    'flex items-center justify-center text-icp-pink-700',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                  )}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
              <FormMessage className="text-[11px]" />
            </FormItem>
          )}
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="pink-grad"
          size="lg"
          loading={loading || form.formState.isSubmitting}
          disabled={loading || form.formState.isSubmitting}
          className="w-full mt-2"
        >
          Đăng nhập
        </Button>
      </form>
    </Form>
  );
}
