'use client';

/**
 * apps/web/app/auth/login/page.tsx
 *
 * Login page — state-A per `docs/mockups/intent-08/intent-08-state-A-login.html`.
 *
 * Slice:    S-03 T04 — Auth Pages
 *
 * **Composition (page-level layout, NOT in LoginForm organism)**:
 *   - Phone-frame (reuse splash style: 414px max + gradient bg + 844px min-height)
 *   - Status bar mock (9:41 + signal/wifi/battery decorative)
 *   - Brain mini 96×96 with drift animation
 *   - Brand "Chào mừng trở lại" gradient + tagline
 *   - <LoginForm> S-01 organism (patched +rememberMe per Batch 3) wired with useLogin
 *   - Demo hint card — BE seed canonical credentials (C-28 RESOLVED)
 *   - JWT security footer
 *
 * **Why state-A only (not B/C/D/E)**:
 *   Per S-03_LAYER_MATRIX line 100, T04 owns mockup state-A only. State B/C/D/E/F
 *   = T05 scope. T04 covers:
 *     - state-A render (this page)
 *     - state-C wrong-password (LoginForm `error` prop displays inline red banner)
 *     - happy path → redirect /home (D-17 via useLogin onSuccess)
 *   NOT T04: animated state-B spinner overlay, state-D network error card, state-E
 *   success brain check-pop redirect. Those = T05.
 *
 * Decisions applied:
 * - **D-17** — useLogin onSuccess → router.push('/home'); NO `?next` consume
 * - **D-19** — TanStack mutation only (useLogin internal)
 * - **D-20** — LoginForm patched +rememberMe Checkbox inline (Batch 3 emit)
 * - **C-28** — Demo hint render BE seed `merchant1@demo.icp` / `demo1234`
 *
 * Mockup reference: `intent-08-state-A-login.html` lines 110-200
 */

import { useLogin } from '@/lib/auth/use-login';
import { LoginForm, type LoginFormData } from '@/components/icp/organisms/LoginForm';

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
 * Map BE 401 + other errors → VN-localized error message for LoginForm display.
 */
function formatLoginError(error: Error | null): string | undefined {
  if (!error) return undefined;
  // Codegen ApiError shape: error.message contains BE response body description.
  // BE 401 returns `{error: 'INVALID_CREDENTIALS'}` per Phase 00 handoff §4.
  // Show user-friendly VN message regardless of underlying error code.
  if (error.message.toLowerCase().includes('401') || error.message.toLowerCase().includes('invalid')) {
    return 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.';
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
}

export default function LoginPage() {
  const loginMutation = useLogin();

  const handleSubmit = async (data: LoginFormData) => {
    loginMutation.mutate(toLoginDto(data));
  };

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

          {/* LOGIN FORM CARD (mockup line 149: white bg + radius 20 + shadow + mb 16) */}
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
              error={formatLoginError(loginMutation.error)}
            />
          </div>

          {/* DEMO HINT CARD (C-28 RESOLVED — BE seed credentials) */}
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
