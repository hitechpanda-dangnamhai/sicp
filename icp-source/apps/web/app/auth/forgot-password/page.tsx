'use client';

/**
 * apps/web/app/auth/forgot-password/page.tsx
 *
 * Forgot Password — MINIMAL STUB per S03-D-22 LOCKED Option A.
 *
 * Slice:    S-03 T04 — Auth Pages (forgot-password stub scope)
 *
 * **NO mockup ground-truth** — intent-08 7 states không bao gồm forgot-password.
 * UI design reuses phone-frame + brain mini + brand pattern từ login state-A
 * for V-SLICE consistency (intent-08 design language).
 *
 * **Functional spec**:
 *   - Single email input (react-hook-form + RFC pattern validation)
 *   - Submit calls `AuthService.authControllerForgotPassword({email})`
 *   - Response `{sent: boolean}` → render success card with OWASP no-enumeration
 *     message regardless of actual `sent` value (BE always returns 200 to
 *     prevent email enumeration attacks per `.strict()` policy)
 *   - Back link `<Link href="/auth/login">← Quay lại đăng nhập</Link>`
 *   - 2 UI states: form (default) + success (after successful POST)
 *
 * **OWASP no-enumeration phrasing** ("Nếu email tồn tại..."):
 *   - Standard security practice — never confirm/deny account existence
 *   - BE returns 200 always (not 404 if email not found)
 *   - FE displays same success message regardless of `sent` value
 *
 * **TanStack mutation pattern** (mirrors useLogin per D-19 LOCKED):
 *   - Inline mutation (no separate hook) — single use, no caching needed
 *   - `useMutation<ForgotPasswordResponseDto, Error, ForgotPasswordDto>`
 *   - onSuccess → setSubmitted(true) reveals success card
 *
 * S-03 T04 emit per S03-D-22 LOCKED (no mockup, A=MINIMAL design).
 */

import * as React from 'react';
import Link from 'next/link';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  AuthService,
  type ForgotPasswordDto,
  type ForgotPasswordResponseDto,
} from '@icp/shared-types/api';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button, Icon } from '@/components/icp/atoms';

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = React.useState<boolean>(false);

  const form = useForm<ForgotPasswordFormData>({
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const mutation = useMutation<ForgotPasswordResponseDto, Error, ForgotPasswordDto>({
    mutationFn: (body) => AuthService.authControllerForgotPassword(body),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit: SubmitHandler<ForgotPasswordFormData> = (data) => {
    mutation.mutate({ email: data.email });
  };

  const errorMessage = mutation.error
    ? 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
    : undefined;

  return (
    <div className="fixed inset-0 overflow-y-auto flex items-start justify-center bg-[#FDF2F4] px-[14px] py-6 lg:p-8 text-[#831447]">
      <div
        className="w-full max-w-[414px] rounded-3xl overflow-hidden flex flex-col relative
                   border-[0.5px] border-[#F9D8E4]
                   shadow-[0_20px_60px_rgba(233,30,99,0.18)] lg:shadow-[0_32px_80px_rgba(233,30,99,0.24)]"
        style={{
          background: 'linear-gradient(180deg, #FCE7F0 0%, #FEEEE0 40%, #FFF8F0 100%)',
          minHeight: 844,
        }}
      >
        {/* STATUS BAR (consistent with login state-A) */}
        <div className="flex justify-between items-center px-[22px] pt-[14px] flex-shrink-0 font-mono text-[13px] font-bold text-[#831447]">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
              <rect x="0" y="6" width="2" height="4" rx="0.5" fill="#831447" />
              <rect x="4" y="4" width="2" height="6" rx="0.5" fill="#831447" />
              <rect x="8" y="2" width="2" height="8" rx="0.5" fill="#831447" />
              <rect x="12" y="0" width="2" height="10" rx="0.5" fill="#831447" />
            </svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M7 9.5 L1 4 a8 8 0 0 1 12 0z" stroke="#831447" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
            </svg>
            <div className="relative w-[22px] h-[11px] border border-[#831447] rounded-[3px] p-px">
              <div className="w-[80%] h-full bg-[#831447] rounded-[1px]" />
              <div className="absolute -right-[3px] top-[3px] w-[2px] h-[5px] bg-[#831447] rounded-r-[1px]" />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col px-6 pt-5 pb-8 overflow-y-auto">
          {/* Brain mini 64px + brand */}
          <div className="text-center mb-6" style={{ animation: 'splash-pop 0.6s ease-out backwards' }}>
            <div className="inline-block mb-3.5 animate-[drift_4s_ease-in-out_infinite]">
              <svg width="64" height="64" viewBox="0 0 240 240" aria-hidden="true">
                <defs>
                  <radialGradient id="fpw-core-64" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#FFE4E6" />
                    <stop offset="60%" stopColor="#F9A8D4" />
                    <stop offset="100%" stopColor="#BE185D" />
                  </radialGradient>
                  <radialGradient id="fpw-aura-64" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(233,30,99,0.35)" />
                    <stop offset="60%" stopColor="rgba(251,146,60,0.15)" />
                    <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                  </radialGradient>
                </defs>
                <circle cx="120" cy="120" r="100" fill="url(#fpw-aura-64)" style={{ animation: 'splash-brainGlow 3s ease-in-out infinite' }} />
                <path
                  d="M 77 104 Q 69 86 86 77 Q 94 65 111 70 Q 120 58 132 66 Q 154 62 158 85 Q 172 94 162 111 Q 172 128 158 140 Q 154 158 132 158 Q 120 172 108 158 Q 86 158 82 140 Q 69 128 77 111 Z"
                  fill="url(#fpw-core-64)"
                  filter="drop-shadow(0 6px 16px rgba(190,24,93,0.4))"
                />
              </svg>
            </div>
            <div
              className="text-[24px] font-bold mb-1 tracking-[-0.5px] leading-[1.1] bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #E91E63, #FB923C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {submitted ? 'Kiểm tra email' : 'Quên mật khẩu?'}
            </div>
            <div className="text-[12px] text-[#9F1239] font-medium leading-[1.45] max-w-[280px] mx-auto">
              {submitted
                ? 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.'
                : 'Nhập email tài khoản để nhận hướng dẫn đặt lại mật khẩu.'}
            </div>
          </div>

          {/* FORM CARD or SUCCESS CARD */}
          <div
            className="bg-white border-[0.5px] border-[#FBCFE8] rounded-[20px] px-5 py-[22px] mb-4"
            style={{
              boxShadow: '0 12px 32px rgba(233,30,99,0.1)',
              animation: 'splash-pop 0.6s ease-out backwards',
            }}
          >
            {submitted ? (
              // SUCCESS state — OWASP no-enumeration confirmation
              <div className="flex flex-col items-center text-center py-2">
                {/* Check icon green */}
                <div className="w-12 h-12 rounded-full bg-emerald-50 border-[0.5px] border-emerald-200 flex items-center justify-center mb-3">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-[13px] font-semibold text-[#831447] mb-1">Yêu cầu đã được tiếp nhận</p>
                <p className="text-[11px] text-[#9F1239] leading-[1.5]">
                  Vui lòng kiểm tra hộp thư <span className="font-mono font-semibold text-[#831447]">{form.getValues('email')}</span> trong vài phút tới.
                </p>
              </div>
            ) : (
              // FORM state — email input + submit
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4" noValidate>
                  {/* External error banner */}
                  {errorMessage && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl px-3 py-2.5 bg-icp-rose-50 border-[0.5px] border-icp-rose-200"
                    >
                      <p className="text-[12px] font-semibold text-icp-rose-700">{errorMessage}</p>
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
                              disabled={mutation.isPending}
                              className="pl-10 h-11 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                            />
                          </FormControl>
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
                    loading={mutation.isPending}
                    disabled={mutation.isPending || form.formState.isSubmitting}
                    className="w-full mt-2"
                  >
                    Gửi yêu cầu
                  </Button>
                </form>
              </Form>
            )}
          </div>

          {/* BACK LINK (always visible — both states) */}
          <div className="text-center mt-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#BE185D] font-semibold hover:text-[#9F1239] transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Quay lại đăng nhập
            </Link>
          </div>

          {/* JWT SECURITY FOOTER (consistent with login state-A) */}
          <div className="mt-auto pt-6 text-center">
            <div className="text-[11px] text-[#9F1239] flex items-center justify-center gap-[5px]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2 4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Bảo mật chuẩn JWT • Mã hoá đầu cuối
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
