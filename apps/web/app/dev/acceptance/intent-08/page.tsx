'use client';

/**
 * apps/web/app/dev/acceptance/intent-08/page.tsx
 *
 * Slice:    S-03 V-SLICE Auth (was S-01 T07 stale "MoMo brand + mode=chat"
 *           per C-36 (a)+(b) RESOLVED-INLINE Phiên N+2)
 * Intent:   I08 — Login Flow + Profile + Logout (full 7 mockup states)
 *
 * **REPLACE rationale** (C-36):
 *   - S-01 T07 ship was `<PhoneFrame mode="chat">` + "MoMo" brand + wrong colors.
 *     Doesn't match T04 (Aida brand per D-15) + T05 (state-B/C/D/E/F deep) reality.
 *   - TASKLIST v1.9 line 19 said "7 acceptance pages sub-dirs" → spec drift vs
 *     repo flat 1 file/intent pattern (intent-01..07 all flat). Amended v1.10.
 *   - This file replaces stale code with multi-state showcase per pattern
 *     intent-07 (1 flat file inline sections). Production states have real
 *     routes (/auth/login + /me); dev-only states (B/C/D/E) showcase
 *     component-level via props.
 *
 * **Showcase sections (one per mockup state)**:
 *   - state-0 → Link to `/` (splash route T04 ship)
 *   - state-A → Link to `/auth/login` idle (T04 + T05 state machine)
 *   - state-B → LoginForm `loading=true` showcase (form locked + spinner)
 *   - state-C → LoginForm `error="..."` + animate-shake wrapper showcase
 *   - state-D → ErrorState compose mock (custom wifi-off orb)
 *   - state-E → LoginSuccessTransition mock with `displayName="Anh Nam"`
 *               (NOTE: 2s setTimeout will redirect to /home — dev preview
 *               disabled via `redirectDelayMs={999_999}` to prevent jump)
 *   - state-F → Link to `/me` (real route, requires auth cookie)
 *
 * Reach:    Dev-only — `/dev/acceptance/intent-08` route for QA visual smoke.
 *
 * S-03 T05 emit (Phiên N+2 Batch 6 — REPLACE per C-36 RESOLVED-INLINE).
 */

import Link from 'next/link';
import {
  LoginForm,
  ErrorState,
  LoginSuccessTransition,
} from '@/components/icp/organisms';
import { Button, Icon } from '@/components/icp/atoms';

const noopSubmit = async () => {
  /* dev showcase — no real submit */
};

export default function IntentEightAcceptancePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#831447] px-4 py-8 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-[28px] font-bold mb-2 tracking-[-0.6px]">
            Intent 08 — Đăng nhập (Aida)
          </h1>
          <p className="text-[14px] text-[#9F1239] leading-[1.5]">
            Acceptance showcase — all 7 mockup states across T04 (state-0 + A) and T05 (state-B/C/D/E/F).
            States A/0/F link to real routes; B/C/D/E are component-level showcases.
          </p>
        </header>

        {/* state-0 + state-A + state-F — links to real routes */}
        <section className="mb-10">
          <h2 className="text-[18px] font-bold mb-3">Real routes (T04 + T05 ship)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href="/"
              className="bg-white border border-[#FBCFE8] rounded-2xl px-4 py-3 hover:bg-[#FEF7F9] transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#BE185D] font-bold mb-1">
                state-0
              </div>
              <div className="text-[14px] text-[#831447] font-semibold">Splash</div>
              <div className="text-[11px] text-[#9F1239]">Brain XL + Aida + Bắt đầu CTA</div>
            </Link>
            <Link
              href="/auth/login"
              className="bg-white border border-[#FBCFE8] rounded-2xl px-4 py-3 hover:bg-[#FEF7F9] transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#BE185D] font-bold mb-1">
                state-A
              </div>
              <div className="text-[14px] text-[#831447] font-semibold">Login (state machine)</div>
              <div className="text-[11px] text-[#9F1239]">A/B/C/D/E full flow per DM-18</div>
            </Link>
            <Link
              href="/me"
              className="bg-white border border-[#FBCFE8] rounded-2xl px-4 py-3 hover:bg-[#FEF7F9] transition-colors"
            >
              <div className="text-[11px] uppercase tracking-wider text-[#BE185D] font-bold mb-1">
                state-F
              </div>
              <div className="text-[14px] text-[#831447] font-semibold">/me Profile + Logout</div>
              <div className="text-[11px] text-[#9F1239]">Requires auth cookie</div>
            </Link>
          </div>
        </section>

        {/* state-B — LoginForm loading showcase */}
        <section className="mb-10">
          <h2 className="text-[18px] font-bold mb-3">state-B — Loading (form locked)</h2>
          <p className="text-[12px] text-[#9F1239] mb-4">
            LoginForm with <code className="font-mono bg-white px-1.5 py-0.5 rounded">loading=true</code> — fields disabled, submit shows spinner &quot;Đăng nhập&quot;.
          </p>
          <div className="bg-white border-[0.5px] border-[#FBCFE8] rounded-[20px] px-5 py-[22px] max-w-[380px]">
            <LoginForm
              onSubmit={noopSubmit}
              loading={true}
              defaultValues={{ email: 'merchant1@demo.icp', password: 'demo1234', rememberMe: true }}
            />
          </div>
        </section>

        {/* state-C — LoginForm error + shake */}
        <section className="mb-10">
          <h2 className="text-[18px] font-bold mb-3">state-C — Wrong password (inline + shake)</h2>
          <p className="text-[12px] text-[#9F1239] mb-4">
            LoginForm with <code className="font-mono bg-white px-1.5 py-0.5 rounded">error=&quot;...&quot;</code> + <code className="font-mono bg-white px-1.5 py-0.5 rounded">animate-shake</code> wrapper class — runs once on mount.
          </p>
          <div
            className="bg-white border-[0.5px] border-[#FBCFE8] rounded-[20px] px-5 py-[22px] animate-shake max-w-[380px]"
          >
            <LoginForm
              onSubmit={noopSubmit}
              error="Email hoặc mật khẩu không đúng. Vui lòng thử lại."
              defaultValues={{ email: 'merchant1@demo.icp', password: 'wrong', rememberMe: false }}
            />
          </div>
        </section>

        {/* state-D — ErrorState replace form (network) */}
        <section className="mb-10">
          <h2 className="text-[18px] font-bold mb-3">state-D — Network error (ErrorState replace)</h2>
          <p className="text-[12px] text-[#9F1239] mb-4">
            ErrorState compose: custom wifi-off orb (red gradient + pulse-ring) + E_NETWORK_TIMEOUT + 8-char FE trace + Thử lại / Báo lỗi actions.
          </p>
          <div
            className="bg-gradient-to-br from-white to-[#FEF3F8] border-[0.5px] border-[#FECACA]
                       border-l-[3px] border-l-[#DC2626] rounded-[18px] px-[18px] py-5 max-w-[380px]"
            style={{ boxShadow: '0 12px 28px rgba(220,38,38,0.12)' }}
          >
            <ErrorState
              density="centered"
              errorOrb={
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
                  <Button variant="pink-grad" size="md" leftIcon="refresh" className="flex-1">
                    Thử lại
                  </Button>
                  <Button variant="outline" size="md" className="px-4">
                    Báo lỗi
                  </Button>
                </div>
              }
            />
            <div
              className="bg-white border-[0.5px] border-[#FCE7F3] rounded-[10px]
                         px-3 py-2 mt-3 font-mono text-[10px] text-[#9F1239]
                         flex items-center justify-between"
            >
              <span>
                Mã lỗi: <b className="text-[#BE123C]">E_NETWORK_TIMEOUT</b>
              </span>
              <span className="text-[#9CA3AF]">trace: c9f241a8</span>
            </div>
          </div>
        </section>

        {/* state-E — LoginSuccessTransition mock (no redirect) */}
        <section className="mb-10">
          <h2 className="text-[18px] font-bold mb-3">state-E — Success transition (BrainXL + check-pop + 2s progress)</h2>
          <p className="text-[12px] text-[#9F1239] mb-4">
            LoginSuccessTransition organism with <code className="font-mono bg-white px-1.5 py-0.5 rounded">displayName=&quot;Anh Nam&quot;</code>.
            Redirect delay overridden to 999_999ms (~16min) so this dev preview doesn&apos;t auto-navigate to /home.
          </p>
          <div className="border border-[#FBCFE8] rounded-2xl overflow-hidden bg-white" style={{ height: 660 }}>
            <LoginSuccessTransition
              displayName="Anh Nam"
              redirectDelayMs={999_999}
              redirectTo="/dev/acceptance/intent-08"
            />
          </div>
        </section>

        {/* Footer notes */}
        <footer className="text-[11px] text-[#9F1239] mt-12 pt-6 border-t border-[#FBCFE8]">
          <div className="mb-1">
            <strong>Phiên N+2 REPLACE</strong> — per C-36 RESOLVED-INLINE (was S-01 T07 stale).
            T04 ships state-0/A + T05 ships state-B/C/D/E/F.
          </div>
          <div>
            Mockup refs: <code className="font-mono">docs/mockups/intent-08/intent-08-state-{'{0,A,B,C,D,E,F}'}.html</code>
          </div>
        </footer>
      </div>
    </main>
  );
}
