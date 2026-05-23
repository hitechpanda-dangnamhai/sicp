'use client';

/**
 * apps/web/app/auth/login/page.tsx
 *
 * Login page — state machine 5-state per DM-18 (mockup state-A/B/C/D/E full).
 *
 * Slice:    S-03 T04 — Auth Pages (state-A baseline)
 *           S-03 T05 — State machine REPLACE: state-A idle + state-B isPending
 *                      + state-C wrong-credentials (LoginForm error + shake key)
 *                      + state-D network error (ErrorState replace form)
 *                      + state-E success (LoginSuccessTransition organism)
 *
 * **State branching logic** (D-25 + D-26 LOCKED):
 *   - `loginMutation.isSuccess` → render `<LoginSuccessTransition>` (state-E)
 *   - `errorClass === 'network'` → render `<ErrorState>` REPLACE form (state-D)
 *   - `errorClass === 'wrong_credentials'` → render LoginForm + error banner + shake (state-C)
 *   - `errorClass === 'generic'` → render LoginForm + error banner NO shake (state-C-fallback)
 *   - else → render LoginForm (state-A idle OR state-B isPending — LoginForm internally
 *     handles loading-state via `loading` prop disabling fields + spinner)
 *
 * **Composition (page-level layout, NOT in LoginForm organism)**:
 *   - Phone-frame (reuse splash style: 414px max + gradient bg + 844px min-height)
 *   - Status bar mock (9:41 + signal/wifi/battery decorative)
 *   - Conditional inner: state-E full-replace OR (brand + brain + form-or-errorstate + demo + footer)
 *
 * Decisions applied:
 * - **D-17** — Login destination /home (UNCHANGED — only LOCUS moved per C-34)
 * - **D-19** — TanStack mutation only (useLogin internal)
 * - **D-20** — LoginForm patched +rememberMe Checkbox inline (T04 ship)
 * - **D-25** — State machine page locus: page owns transition timing,
 *   `LoginSuccessTransition` owns 2s setTimeout cleanup-aware
 * - **D-26** — Strict error classification: `classifyLoginError(error)` returns
 *   4-way union. 401 → state-C (inline + shake). No-status (network) → state-D
 *   (ErrorState replace). Other 4xx/5xx → state-C-fallback (inline NO shake).
 * - **C-28** — Demo hint render BE seed `merchant1@demo.icp` / `demo1234`
 * - **C-34** — `useLogin.onSuccess` no longer pushes; navigation in
 *   LoginSuccessTransition useEffect setTimeout(2000)
 * - **C-35** — `formatLoginError` REPLACED by `classifyLoginError` (4-way)
 *
 * Mockup references:
 *   - state-A: `intent-08-state-A-login.html` lines 110-200 (form idle)
 *   - state-B: `intent-08-state-B-loading.html` lines 144-171 (form locked + spinner)
 *   - state-C: `intent-08-state-C-wrong-password.html` lines 149-183 (.pop.shake + alert banner)
 *   - state-D: `intent-08-state-D-network-error.html` lines 148-175 (ErrorState replace)
 *   - state-E: `intent-08-state-E-success.html` lines 111-171 (BrainXL + check-pop + greeting + 2s progress)
 */

import * as React from 'react';
import { useLogin } from '@/lib/auth/use-login';
import { LoginForm, type LoginFormData, ErrorState } from '@/components/icp/organisms';
import { LoginSuccessTransition } from '@/components/icp/organisms/LoginSuccessTransition';
import { Button, Icon } from '@/components/icp/atoms';
import { reportError } from '@/lib/error/use-error-report';

/**
 * Map FE LoginFormData (camelCase: `rememberMe`) → BE LoginDto (snake_case:
 * `remember_me`) at the boundary. Per STOP-T04-3 RESOLVED: codegen preserves
 * BE snake_case (`remember_me?: boolean`). FE uses idiomatic camelCase internally.
 */
function toLoginDto(data: LoginFormData) {
  return {
    email: data.email,
    password: data.password,
    remember_me: data.rememberMe ?? false,
  };
}

/**
 * 4-way error classification per D-26 + C-35 RESOLVED-INLINE (Phiên N+2).
 *
 * Branches login page state machine:
 *   - `'none'`              — no error (state-A idle OR state-B isPending)
 *   - `'wrong_credentials'` — HTTP 401 → state-C: LoginForm error + animate-shake keyed restart
 *   - `'network'`           — fetch rejected pre-response (no `status`) → state-D: ErrorState replace form
 *   - `'generic'`           — other 4xx/5xx → state-C-fallback: LoginForm error NO shake (different errorKey)
 *
 * **Structural distinction** `error.status === 401` (auth fail HTTP completed)
 * vs `!error.status` (network — fetch reject TypeError) is V-SLICE pattern LOCKED.
 *
 * Codegen `ApiError` shape (from `@icp/shared-types/api/core/ApiError`):
 *   `{status: number, statusText: string, url: string, body: any}`. Network
 *   failures throw raw `TypeError("Failed to fetch")` or similar (no status).
 */
export type LoginErrorClass = 'none' | 'wrong_credentials' | 'network' | 'generic';

function classifyLoginError(error: Error | null): LoginErrorClass {
  if (!error) return 'none';
  // Codegen ApiError has `status: number`; raw network errors don't.
  const apiErr = error as { status?: number };
  if (apiErr.status === 401) return 'wrong_credentials';
  if (typeof apiErr.status !== 'number') return 'network';
  return 'generic';
}

/**
 * VN-localized error message for state-C inline banner. Used for both
 * `'wrong_credentials'` (401) and `'generic'` (other HTTP errors).
 */
function getInlineErrorMessage(errorClass: LoginErrorClass): string | undefined {
  if (errorClass === 'wrong_credentials') {
    return 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
  }
  if (errorClass === 'generic') {
    return 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
  }
  return undefined;
}

export default function LoginPage() {
  const loginMutation = useLogin();

  // D-26: Trace ID stored in component state — generated FE-side at error
  // capture (8-char hex stub per C-09). Persists across re-renders so "Báo lỗi"
  // copies the SAME ID user saw on screen. Reset on `Thử lại` (mutation.reset).
  const [traceId, setTraceId] = React.useState<string | null>(null);

  // Classify error each render (D-26): branches state machine A/B/C/D/E.
  const errorClass = classifyLoginError(loginMutation.error);

  // Generate trace ID lazily when network error first surfaces (one-time per
  // error instance). Effect avoids generating during render.
  React.useEffect(() => {
    if (errorClass === 'network' && traceId === null) {
      // crypto.randomUUID() available in modern browsers + Node 19+.
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(16).slice(2, 10);
      setTraceId(id);
    }
    if (errorClass !== 'network' && traceId !== null) {
      // Clear stale trace when error class changes away from network
      // (e.g. user typed new credentials → submit again → 401 → state-C).
      setTraceId(null);
    }
  }, [errorClass, traceId]);

  const handleSubmit = async (data: LoginFormData) => {
    loginMutation.mutate(toLoginDto(data));
  };

  const handleRetry = React.useCallback(() => {
    // Reset mutation → errorClass becomes 'none' → state machine returns to A.
    // Trace cleanup handled by useEffect above on next render.
    loginMutation.reset();
  }, [loginMutation]);

  const handleReportError = React.useCallback(() => {
    if (traceId) {
      // Fire-and-forget — emits event + copies trace to clipboard.
      // Result ignored per mockup (no toast UI).
      void reportError(traceId, 'E_NETWORK_TIMEOUT');
    }
  }, [traceId]);

  // ─────────────────────────────────────────────────────────────────────
  // State-E: Success transition — full-replace phone-frame content
  // per D-25 (LoginSuccessTransition organism owns 2s setTimeout cleanup-aware).
  // Avoids useMe race per STOP-T05-5 by reading displayName directly from
  // mutation.data.user (LoginResponseDto has the field).
  // ─────────────────────────────────────────────────────────────────────
  if (loginMutation.isSuccess && loginMutation.data) {
    return (
      <LoginSuccessTransition displayName={loginMutation.data.user.display_name} />
    );
  }

  // Inline banner message for state-C / state-C-fallback (state-D uses
  // ErrorState replace, not banner).
  const inlineErrorMessage = getInlineErrorMessage(errorClass);

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
        {/* STATUS BAR (mock per mockup lines 91-108) */}
        <div className="flex justify-between items-center px-[22px] pt-[14px] flex-shrink-0 font-mono text-[13px] font-bold text-[#831447]">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            {/* Signal bars */}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
              <rect x="0" y="6" width="2" height="4" rx="0.5" fill="#831447" />
              <rect x="4" y="4" width="2" height="6" rx="0.5" fill="#831447" />
              <rect x="8" y="2" width="2" height="8" rx="0.5" fill="#831447" />
              <rect x="12" y="0" width="2" height="10" rx="0.5" fill="#831447" />
            </svg>
            {/* Wi-Fi */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path
                d="M7 9.5 L1 4 a8 8 0 0 1 12 0z"
                stroke="#831447"
                strokeWidth="1.2"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            {/* Battery */}
            <div className="relative w-[22px] h-[11px] border border-[#831447] rounded-[3px] p-px">
              <div className="w-[80%] h-full bg-[#831447] rounded-[1px]" />
              <div className="absolute -right-[3px] top-[3px] w-[2px] h-[5px] bg-[#831447] rounded-r-[1px]" />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT (mockup line 111: padding 20px 24px 32px) */}
        <div className="flex-1 flex flex-col px-6 pt-5 pb-8 overflow-y-auto">
          {/* Brain mini 96x96 with drift + brand text */}
          <div className="text-center mb-6" style={{ animation: 'splash-pop 0.6s ease-out backwards' }}>
            <div
              className="inline-block mb-3.5 animate-[drift_4s_ease-in-out_infinite]"
            >
              <svg width="96" height="96" viewBox="0 0 240 240" aria-hidden="true">
                <defs>
                  <radialGradient id="mb-core-96" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#FFE4E6" />
                    <stop offset="60%" stopColor="#F9A8D4" />
                    <stop offset="100%" stopColor="#BE185D" />
                  </radialGradient>
                  <radialGradient id="mb-aura-96" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(233,30,99,0.35)" />
                    <stop offset="60%" stopColor="rgba(251,146,60,0.15)" />
                    <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                  </radialGradient>
                </defs>
                <circle
                  cx="120"
                  cy="120"
                  r="100"
                  fill="url(#mb-aura-96)"
                  style={{ animation: 'splash-brainGlow 3s ease-in-out infinite' }}
                />
                <path
                  d="M 77 104 Q 69 86 86 77 Q 94 65 111 70 Q 120 58 132 66 Q 154 62 158 85 Q 172 94 162 111 Q 172 128 158 140 Q 154 158 132 158 Q 120 172 108 158 Q 86 158 82 140 Q 69 128 77 111 Z"
                  fill="url(#mb-core-96)"
                  filter="drop-shadow(0 6px 16px rgba(190,24,93,0.4))"
                />
                <path
                  d="M 94 86 Q 120 95 137 86 M 86 112 Q 120 120 154 112 M 94 137 Q 120 130 137 137 M 120 72 Q 120 95 120 112 M 102 86 Q 106 120 102 146 M 137 86 Q 134 120 137 146"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.7"
                />
                <circle cx="94" cy="86" r="3" fill="#fff" />
                <circle cx="137" cy="86" r="3" fill="#fff" />
                <circle cx="120" cy="112" r="3" fill="#fff" />
                <circle cx="102" cy="137" r="3" fill="#fff" />
                <circle cx="137" cy="137" r="3" fill="#fff" />
                <circle
                  cx="34"
                  cy="72"
                  r="4.5"
                  fill="#E91E63"
                  style={{ animation: 'splash-nodePulse 2s ease-in-out infinite' }}
                />
                <circle
                  cx="206"
                  cy="86"
                  r="4.5"
                  fill="#FB923C"
                  style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 0.5s' }}
                />
                <circle
                  cx="32"
                  cy="168"
                  r="4.5"
                  fill="#E91E63"
                  style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1s' }}
                />
                <circle
                  cx="206"
                  cy="180"
                  r="4.5"
                  fill="#FB923C"
                  style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1.5s' }}
                />
              </svg>
            </div>
            <div
              className="text-[26px] font-bold mb-1 tracking-[-0.6px] leading-[1.1] bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #E91E63, #FB923C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Chào mừng trở lại
            </div>
            <div className="text-[12px] text-[#9F1239] font-medium leading-[1.45] max-w-[280px] mx-auto">
              Đăng nhập để tiếp tục quản lý cửa hàng
            </div>
          </div>

          {/* CONDITIONAL: State-D ErrorState replace OR state-A/B/C LoginForm */}
          {errorClass === 'network' ? (
            // ─────────────────────────────────────────────────────────────
            // State-D — Network error: ErrorState REPLACES form per D-26.
            // Mockup ref: intent-08-state-D-network-error.html lines 148-175.
            // ─────────────────────────────────────────────────────────────
            <div
              className="bg-gradient-to-br from-white to-[#FEF3F8] border-[0.5px] border-[#FECACA]
                         border-l-[3px] border-l-[#DC2626] rounded-[18px] px-[18px] py-5 mb-4"
              style={{
                boxShadow: '0 12px 28px rgba(220,38,38,0.12)',
                animation: 'splash-slideUp 0.5s ease-out 0.15s backwards',
              }}
            >
              <ErrorState
                density="centered"
                errorOrb={
                  // Custom wifi-off circle red-gradient + pulse-ring overlay
                  // (NOT generic OrbPulse — distinct semantic per M14 LAYER_MATRIX:
                  // "lost connection" wifi-off icon vs gray-maroon shake orb).
                  <div className="relative w-[60px] h-[60px]">
                    <div className="absolute inset-0 rounded-full bg-[rgba(220,38,38,0.18)] animate-pulse-ring" />
                    <div
                      className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center
                                 bg-gradient-to-br from-[#FEE2E2] to-[#FCA5A5]
                                 shadow-[0_6px_16px_rgba(220,38,38,0.18)]"
                    >
                      <Icon name="wifi-off" size={28} className="text-[#DC2626]" />
                    </div>
                  </div>
                }
                errorCode="E_NETWORK_TIMEOUT"
                title="Mất kết nối"
                subtitle="Em chưa kết nối được tới máy chủ. Anh kiểm tra Wi-Fi hoặc 4G rồi thử lại nhé."
                actions={
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="pink-grad"
                      size="md"
                      onClick={handleRetry}
                      leftIcon="refresh"
                      className="flex-1"
                    >
                      Thử lại
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleReportError}
                      className="px-4"
                    >
                      Báo lỗi
                    </Button>
                  </div>
                }
              />
              {/* Trace stub line per mockup line 163-166 — small mono row with
                  trace_id display. Rendered inside the ErrorState card padding. */}
              {traceId && (
                <div
                  className="bg-white border-[0.5px] border-[#FCE7F3] rounded-[10px]
                             px-3 py-2 mt-3 font-mono text-[10px] text-[#9F1239]
                             flex items-center justify-between"
                >
                  <span>
                    Mã lỗi: <b className="text-[#BE123C]">E_NETWORK_TIMEOUT</b>
                  </span>
                  <span className="text-[#9CA3AF]">trace: {traceId}</span>
                </div>
              )}
            </div>
          ) : (
            // ─────────────────────────────────────────────────────────────
            // State-A idle / State-B isPending (LoginForm loading=true) /
            // State-C wrong_credentials (LoginForm error — shake handled internally) /
            // State-C-fallback generic (LoginForm error — no shake when error empty)
            //
            // Shake animation owned INSIDE LoginForm now (T05 patch — internal
            // `shakeKey` state bumps on error transition; `<form>` wrapper inside
            // gets `key={shakeKey}` + `animate-shake` class one-shot). This page
            // wrapper DIV no longer needs `key=...` remount, which would have
            // reset react-hook-form state. State preserved across shake animations.
            // ─────────────────────────────────────────────────────────────
            <div
              className="bg-white border-[0.5px] border-[#FBCFE8] rounded-[20px] px-5 py-[22px] mb-4"
              style={{
                boxShadow: '0 12px 32px rgba(233,30,99,0.1)',
                animation: 'splash-pop 0.6s ease-out backwards',
              }}
            >
              <LoginForm
                onSubmit={handleSubmit}
                loading={loginMutation.isPending}
                error={inlineErrorMessage}
              />
            </div>
          )}

          {/* DEMO HINT CARD (C-28 RESOLVED — BE seed credentials).
              Rendered in state-A only; state-D/C continue showing it too per
              mockup state-D line 178-189 (demo hint still visible below error). */}
          <div
            className="border-[0.5px] border-dashed border-[#FBCFE8] rounded-[14px] px-3.5 py-3"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF, #FEF3F8)',
              animation: 'splash-slideUp 0.6s ease-out 0.2s backwards',
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              {/* Sparkles icon inline SVG (mockup lines 78 + 184) */}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#BE185D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 18a2 2 0 0 1 2 2 2 2 0 0 1 2-2 2 2 0 0 1-2-2 2 2 0 0 1-2 2zM16 4a2 2 0 0 1 2 2 2 2 0 0 1 2-2 2 2 0 0 1-2-2 2 2 0 0 1-2 2zM9 18a4 4 0 0 1 4 4 4 4 0 0 1 4-4 4 4 0 0 1-4-4 4 4 0 0 1-4 4z" />
              </svg>
              <span className="text-[10px] text-[#BE185D] font-bold uppercase tracking-[1px]">
                Tài khoản dùng thử
              </span>
            </div>
            <div
              className="grid gap-y-1 gap-x-3 text-[11px] text-[#831447]"
              style={{ gridTemplateColumns: 'auto 1fr' }}
            >
              <span className="text-[#9F1239]">Email:</span>
              <span className="font-mono font-semibold">merchant1@demo.icp</span>
              <span className="text-[#9F1239]">Mật khẩu:</span>
              <span className="font-mono font-semibold">demo1234</span>
            </div>
          </div>

          {/* JWT SECURITY FOOTER (mockup lines 195-200) */}
          <div className="mt-auto pt-6 text-center">
            <div className="text-[11px] text-[#9F1239] flex items-center justify-center gap-[5px]">
              {/* Shield icon inline (mockup line 84 + 197) */}
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
