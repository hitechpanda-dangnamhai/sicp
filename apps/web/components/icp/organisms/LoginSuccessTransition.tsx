'use client';

/**
 * apps/web/components/icp/organisms/LoginSuccessTransition.tsx
 *
 * Organism: <LoginSuccessTransition> — state-E success transition after login.
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow + State-E success transition
 *
 * Source:   `docs/mockups/intent-08/intent-08-state-E-success.html` lines 111-171
 *           Brain XL 180×180 + check-pop 48×48 green bottom-right + greeting
 *           gradient pink→orange + "Em đã sẵn sàng..." subtext + 240×4 progress
 *           bar 2s scaleX 0→1 + session footer "Phiên đăng nhập đã được tạo".
 *
 * Decisions applied:
 * - **D-25** — State machine page locus pattern: page owns state machine + this
 *   organism owns the 2s setTimeout cleanup-aware → router.push('/home'). Hook
 *   `useLogin.onSuccess` MUST NOT push (locus moved per C-34 RESOLVED-INLINE).
 * - **D-17** — Destination `/home` UNCHANGED (only implementation locus changed).
 * - **STOP-T05-5 mitigation** — Props `displayName: string` from
 *   `loginMutation.data.user.display_name` directly (LoginResponseDto), avoiding
 *   useMe race (useMe might still be loading post-invalidateQueries when this
 *   organism mounts).
 *
 * **Animation orchestration** (matches mockup state-E):
 *   - Brain XL 180×180 with `animate-brain-glow` aura
 *   - `animate-pulse-ring` rgba(16,185,129,0.18) wrapper at -12px inset
 *   - Check-pop 48×48 green gradient bottom-right with `animate-check-pop` (400ms
 *     cubic-bezier overshoot — see tailwind.config keyframe `checkPop`)
 *   - Slide-up "ĐĂNG NHẬP THÀNH CÔNG" green label (delay 0.3s)
 *   - Slide-up "Xin chào, {displayName}" 30px gradient pink→orange (delay 0.3s)
 *   - Slide-up subtitle "Em đã sẵn sàng..." (delay 0.5s)
 *   - Progress bar 240×4 with `splash-loadProgress` 2s scaleX 0→1 (delay 0.7s)
 *   - Session footer absolute bottom with green pulse dot (mockup-literal)
 *
 * **Cleanup-aware redirect**:
 *   `useEffect(() => { const t = setTimeout(...); return () => clearTimeout(t); }, [router])`
 *   ensures if user navigates away mid-transition (e.g. browser back button),
 *   the redirect to /home is cancelled. Prevents stale navigation.
 *
 * Reach:    S-03 V-SLICE Auth (login state machine) — single use site.
 *
 * S-03 T05 emit (Phiên N+2 Batch 4).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface LoginSuccessTransitionProps {
  /** User's display name from `loginMutation.data.user.display_name`. Rendered
   *  in greeting "Xin chào, {displayName}" gradient text. */
  displayName: string;
  /** Optional redirect delay override (default 2000ms per D-25 mockup). Useful
   *  for tests to short-circuit timing. */
  redirectDelayMs?: number;
  /** Optional override target (default `/home` per D-17). Tests may inject. */
  redirectTo?: string;
}

const DEFAULT_REDIRECT_MS = 2000;
const DEFAULT_REDIRECT_TO = '/home';

export function LoginSuccessTransition({
  displayName,
  redirectDelayMs = DEFAULT_REDIRECT_MS,
  redirectTo = DEFAULT_REDIRECT_TO,
}: LoginSuccessTransitionProps) {
  const router = useRouter();

  // Cleanup-aware redirect: setTimeout cancellable if component unmounts.
  React.useEffect(() => {
    const t = setTimeout(() => {
      router.push(redirectTo);
    }, redirectDelayMs);
    return () => clearTimeout(t);
  }, [router, redirectDelayMs, redirectTo]);

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
        {/* STATUS BAR (mock — same as login page) */}
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
              <path
                d="M7 9.5 L1 4 a8 8 0 0 1 12 0z"
                stroke="#831447"
                strokeWidth="1.2"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            <div className="relative w-[22px] h-[11px] border border-[#831447] rounded-[3px] p-px">
              <div className="w-[80%] h-full bg-[#831447] rounded-[1px]" />
              <div className="absolute -right-[3px] top-[3px] w-[2px] h-[5px] bg-[#831447] rounded-r-[1px]" />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT — center-justified vertical (mockup state-E lines 111-173) */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[30px] pb-[60px] text-center relative">

          {/* Brain XL 180×180 + check-pop badge (mockup lines 113-148) */}
          <div className="mb-6 relative" style={{ animation: 'splash-pop 0.6s ease-out backwards' }}>
            {/* Pulse-ring aura (mockup line 114 — rgba(16,185,129,0.18) green) */}
            <div
              className="absolute -inset-3 rounded-full bg-[rgba(16,185,129,0.18)] animate-pulse-ring"
              aria-hidden="true"
            />
            <div className="relative">
              <svg width="180" height="180" viewBox="0 0 240 240" aria-hidden="true">
                <defs>
                  <radialGradient id="mb-core-180" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#FFE4E6" />
                    <stop offset="60%" stopColor="#F9A8D4" />
                    <stop offset="100%" stopColor="#BE185D" />
                  </radialGradient>
                  <radialGradient id="mb-aura-180" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(233,30,99,0.35)" />
                    <stop offset="60%" stopColor="rgba(251,146,60,0.15)" />
                    <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                  </radialGradient>
                </defs>
                <circle
                  cx="120"
                  cy="120"
                  r="100"
                  fill="url(#mb-aura-180)"
                  style={{ animation: 'splash-brainGlow 3s ease-in-out infinite' }}
                />
                <path
                  d="M 77 104 Q 69 86 86 77 Q 94 65 111 70 Q 120 58 132 66 Q 154 62 158 85 Q 172 94 162 111 Q 172 128 158 140 Q 154 158 132 158 Q 120 172 108 158 Q 86 158 82 140 Q 69 128 77 111 Z"
                  fill="url(#mb-core-180)"
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
              {/* Check-pop badge bottom-right (mockup lines 145-147 — 48×48 green) */}
              <div
                className="absolute bottom-[6px] right-[6px] w-12 h-12 rounded-full
                           flex items-center justify-center animate-check-pop
                           bg-gradient-to-br from-[#10B981] to-[#059669]
                           shadow-[0_8px_22px_rgba(16,185,129,0.5)]
                           border-[3px] border-[#FFF8F0]"
                aria-hidden="true"
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* "ĐĂNG NHẬP THÀNH CÔNG" label + greeting (mockup lines 150-153) */}
          <div
            className="mb-3.5"
            style={{ animation: 'splash-slideUp 0.5s ease-out 0.3s backwards' }}
          >
            <div className="text-[11px] text-[#10B981] font-bold uppercase tracking-[2px] mb-1.5">
              Đăng nhập thành công
            </div>
            <div
              className="text-[30px] font-bold mb-2 tracking-[-0.8px] leading-[1.1]
                         bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #E91E63, #FB923C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Xin chào,
              <br />
              {displayName}
            </div>
          </div>

          {/* Subtitle (mockup lines 155-158) */}
          <div
            className="text-[13px] text-[#831447] font-medium leading-[1.55] max-w-[280px] mb-8"
            style={{ animation: 'splash-slideUp 0.5s ease-out 0.5s backwards' }}
          >
            Em đã sẵn sàng giúp anh quản lý cửa hàng hôm nay.
            <br />
            <span className="text-[#9F1239]">Đang đưa anh tới trang chính...</span>
          </div>

          {/* Progress bar 240×4 (mockup lines 160-162) — 2s scaleX 0→1 via
              splash-loadProgress keyframe added in globals.css Batch 1. */}
          <div
            className="w-full max-w-[240px] h-1 bg-[#FCE7F3] rounded-[2px] overflow-hidden"
            style={{ animation: 'splash-slideUp 0.5s ease-out 0.7s backwards' }}
          >
            <div
              className="w-full h-full rounded-[2px]"
              style={{
                backgroundImage: 'linear-gradient(90deg, #E91E63, #FB923C)',
                transformOrigin: 'left',
                animation: 'splash-loadProgress 2s ease-out forwards',
              }}
            />
          </div>

          {/* Session footer absolute bottom (mockup lines 165-171) */}
          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-[#9F1239]">
              <div
                className="w-1.5 h-1.5 bg-[#10B981] rounded-full"
                style={{ boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }}
                aria-hidden="true"
              />
              Phiên đăng nhập đã được tạo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
