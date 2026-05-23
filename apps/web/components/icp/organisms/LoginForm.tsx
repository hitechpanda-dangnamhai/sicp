'use client';

/**
 * apps/web/components/icp/organisms/LoginForm.tsx
 *
 * Organism: <LoginForm> — I08 login form composing shadcn Form + Input + Button
 *                        + Checkbox (T04 patch) + Next.js Link (T04 patch)
 *
 * Slice:    S-01 UI Foundation T06 (initial)
 *           S-03 T04 PATCH — +rememberMe Checkbox inline + "Quên mật khẩu?" Link
 *
 * Source:   intent-08-state-A-login.html visual contract lines 149-178
 *           SEMANTIC_COMPONENTS Section 5.7 — I08 minimal CSS (1 bespoke class),
 *           rebuild as shadcn `<Form>` + `<Input>` + `<Button>` per ADR-033 stack
 *
 * Reach:    I08 only (S-03 V-SLICE Auth primary consumer)
 *
 * Decisions applied (S-01 T06 inherited):
 * - C-07 navigation-agnostic — onSubmit callback returning Promise<void> | void;
 *   V-SLICE S-03 wraps in TanStack mutation at page level per D-19 RESOLVED
 *   (NO Server Action at organism layer — keeps component portable)
 * - C-08 + S01-D-05 VN inline — field labels + placeholders + error messages hardcoded VN
 * - C-13 N/A — uses shadcn Input native, no CVA collision
 * - C-15 CLIENT — useForm() hook + useState for show/hide password toggle
 * - C-18 Tier 4 Tailwind utility inline
 * - C-22 atom interface verified — composes shadcn Form/FormField/FormItem/
 *   FormLabel/FormControl/FormMessage + shadcn Input + T02 Button (extended) + T02 Icon
 *   + shadcn Checkbox (T04 NEW via `pnpm dlx shadcn@latest add checkbox`)
 * - C-29 RESOLVED — `onSubmit` callback prop only per C-07; V-SLICE S-03 attaches
 *   TanStack mutation at page level (compose pattern not redesign) per D-19
 * - C-30 — uses NEW icons `mail` + `lock` + `eye` + `eye-off` (registered in
 *   icon-map.ts T06 patch AC-16)
 *
 * S-03 T04 PATCH decisions:
 * - **D-18** — "Quên mật khẩu?" link uses Next.js `<Link href="/auth/forgot-password">`
 *   for SPA client-side navigation (prefetch enabled, no full reload)
 * - **D-20** — rememberMe Checkbox inline row layout: flex justify-between with
 *   "Ghi nhớ tôi" left + "Quên mật khẩu?" right, below password field, above
 *   submit button. State management: react-hook-form `rememberMe: boolean`
 *   field via Controller (Checkbox is non-native, NOT register). Default `false`.
 *   Mockup ref: lines 172-178.
 *
 * S-03 T05 PATCH decisions (Phiên N+2):
 * - **D-26 + AC-33.shake** — Internal shake key: when `error` prop transitions
 *   undefined → string (new wrong-credentials surface), `<form>` wrapper applies
 *   `animate-shake` for one-shot CSS animation (400ms ease-in-out per T01
 *   tailwind.config keyframe). Restart pattern: bump `shakeKey` state on error
 *   transition → `key={shakeKey}` on `<form>` forces React inner-tree remount of
 *   the form element ONLY (NOT the outer Form provider) so animation runs again
 *   for each new error. **react-hook-form state preserved** — `useForm()` hook
 *   lives on parent Form context; remounting the inner <form> DOM element
 *   doesn't reset hook state. Email/password fields keep user-typed values.
 *
 * **Why NOT page-level shake key remount?**
 *   Earlier draft applied `key={errorClass}` to login page's outer card DIV
 *   containing LoginForm. Problem: that remounts LoginForm itself → useForm
 *   re-initializes from defaultValues → user-typed fields lost. Moving key
 *   onto the `<form>` element WITHIN LoginForm (after useForm hook) keeps
 *   form state intact across shake animations.
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC (I08 only single V-SLICE)
 *
 * Validation:
 * - Email: required + RFC pattern match (react-hook-form built-in regex rule)
 * - Password: required + min 6 chars (basic; production should be stricter)
 * - rememberMe: boolean, no validation (always valid)
 * - No zod dependency added — uses react-hook-form built-in rules
 *
 * Public API:
 *   <LoginForm
 *     onSubmit={async ({ email, password, rememberMe }) => {
 *       await mutateAsync({ email, password, remember_me: rememberMe });
 *     }}
 *     loading={isPending}
 *     error="Email hoặc mật khẩu không đúng"
 *   />
 *
 * **Boundary mapping** (T04 page.tsx responsibility):
 *   FE camelCase `rememberMe` ↔ BE snake_case `remember_me` (codegen LoginDto).
 *   See `app/auth/login/page.tsx` `toLoginDto()` helper.
 */

import * as React from 'react';
import Link from 'next/link';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/icp/atoms';
import { Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

export interface LoginFormData {
  email: string;
  password: string;
  /** S-03 T04 D-20 patch — "Ghi nhớ tôi" checkbox state.
   *  Maps to BE `remember_me: boolean` at page.tsx boundary (NOT here).
   *  When true → BE sets cookie Max-Age=accessTtlSeconds; when false → session cookie.
   */
  rememberMe: boolean;
}

export interface LoginFormProps {
  /** Fires when form submits with valid data. Return Promise to keep `loading`
   *  state in sync at consumer level (T06 stays CLIENT-only via prop; V-SLICE
   *  S-03 attaches TanStack mutation wrapper per D-19). */
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

  // S-03 T05 — Internal shake key restart. Bumped each time `error` transitions
  // from undefined → string (new error surfaces). Applied as `key={shakeKey}`
  // on inner <form> element so CSS animation `animate-shake` runs one-shot on
  // each new error WITHOUT resetting react-hook-form state (hook lives on
  // parent Form provider, untouched by inner <form> remount).
  const [shakeKey, setShakeKey] = React.useState<number>(0);
  const prevErrorRef = React.useRef<string | undefined>(error);
  React.useEffect(() => {
    const prev = prevErrorRef.current;
    if (typeof error === 'string' && error !== prev) {
      // New error surfaced (transition undefined → string OR string A → string B)
      setShakeKey((k) => k + 1);
    }
    prevErrorRef.current = error;
  }, [error]);

  const form = useForm<LoginFormData>({
    defaultValues: {
      email: defaultValues?.email ?? '',
      password: defaultValues?.password ?? '',
      rememberMe: defaultValues?.rememberMe ?? false,
    },
    mode: 'onBlur',
  });

  const handleTogglePassword = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <Form {...form}>
      <form
        key={shakeKey}
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('w-full flex flex-col gap-4', error && 'animate-shake', className)}
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

        {/* Submit button — moved BEFORE rememberMe row per mockup lines 168-178 order */}
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

        {/* rememberMe Checkbox + Forgot password link inline row (T04 D-20)
            Mockup ref: lines 172-178
              - Left: <label> with 14×14 checkbox + "Ghi nhớ tôi" 11px #9F1239
              - Right: <a> "Quên mật khẩu?" 11px #BE185D font-semibold cursor-pointer
            Layout: flex justify-between items-center mt-3 */}
        <div className="flex justify-between items-center mt-1">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <label
                htmlFor="login-remember-me"
                className="flex items-center gap-1.5 text-[11px] text-icp-rose-700 cursor-pointer select-none"
              >
                <Checkbox
                  id="login-remember-me"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={loading}
                  className="h-[14px] w-[14px] rounded-[4px] border-icp-pink-200 bg-icp-pink-50
                             data-[state=checked]:bg-icp-pink-700 data-[state=checked]:border-icp-pink-700
                             data-[state=checked]:text-white"
                />
                Ghi nhớ tôi
              </label>
            )}
          />
          <Link
            href="/auth/forgot-password"
            className="text-[11px] text-icp-pink-700 font-semibold hover:text-icp-pink-800 transition-colors"
          >
            Quên mật khẩu?
          </Link>
        </div>
      </form>
    </Form>
  );
}
