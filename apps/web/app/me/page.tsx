'use client';

/**
 * apps/web/app/me/page.tsx
 *
 * `/me` profile page — state-F full mockup pixel-fidelity.
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow
 *
 * Source:   `docs/mockups/intent-08/intent-08-state-F-logout.html` lines 89-212
 *           Phone-frame 414px + status bar + TopBar (back/title/settings) +
 *           profile card (avatar 60×60 orange + name + email + status pulse +
 *           2-col Phiên/Đăng nhập) + 3-row settings menu + always-visible
 *           logout confirm card + version footer.
 *
 * Decisions applied (DM-10 a-f sub-criteria + cross-task):
 * - **DM-10(a)** — Profile card avatar 60×60 orange gradient
 *   `linear-gradient(135deg, #FB923C, #EA580C)` with initials from
 *   `useMe().data.display_name` (via `computeAvatarInitials` server-side per C-05).
 * - **DM-10(b)** — "Phiên: Còn Xh" computed FE-side from `session_expires_at`:
 *   `Math.max(0, Math.ceil((Date.parse(...) - Date.now()) / 3600000))`. If
 *   `session_expires_at` null → display "—". Computed-on-render only per
 *   BRIEF non-goal (no setInterval refresh).
 * - **DM-10(c)** — "Đăng nhập: HH:mm hôm nay" derived from `last_login_at`.
 *   Format: local TZ HH:mm with VN heuristic "hôm nay" (today) vs date.
 * - **DM-10(d)** — 3 settings rows via `<MeSettingsMenu>` organism (Batch 4).
 * - **DM-10(e)** — Logout confirm card always-visible via `<LogoutConfirmCard>`
 *   per D-27. "Ở lại" → hub qua /auth/landing; "Đăng xuất" → useLogout.mutate().
 * - **DM-10(f)** — Version footer reads `process.env.NEXT_PUBLIC_APP_VERSION` +
 *   `NEXT_PUBLIC_BUILD_SHA` env (defaults "0.1.0" + "dev" if unset). Format:
 *   "Aida v{version} • build {sha}" matching mockup line 207.
 * - **D-24 + C-33** — Consumes BE additive `session_expires_at` field via useMe.
 * - **C-NN-2** — `fixed inset-0` wrapper pattern (T04 inherit) for phone-frame.
 *
 * **Status bar parity** with T04 login page — copy-paste mockup line 91-108
 * inline SVGs (signal/wifi/battery) for visual consistency across V-SLICE.
 *
 * **Auth gating** — middleware.ts T05 patch adds `/me` to matcher (Batch 1
 * step 3). Logged-out users redirected to `/auth/login` before page renders.
 * Page assumes useMe will resolve (no `loading: true` UI per mockup — mockup
 * shows hydrated state-F directly).
 *
 * **Loading + error fallbacks** (defensive, mockup-silent):
 *   - useMe loading → skeleton-ish "—" placeholders in avatar/text
 *     (mockup has no loading state for /me; minimal fallback acceptable).
 *   - useMe error → still renders structure but with "—" data; user will
 *     likely be redirected by middleware on next nav. T05 scope: no error UI.
 *
 * S-03 T05 emit (Phiên N+2 Batch 5).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/dashboard/use-me';
import { useLogout } from '@/lib/auth/use-logout';
import { pushLanding } from '@/lib/landing';
import { MeSettingsMenu, LogoutConfirmCard } from '@/components/icp/organisms';
import { Icon } from '@/components/icp/atoms';

/** Compute "Còn Xh" countdown string from ISO8601 expiry timestamp.
 *  Returns "—" if null. Rounded UP via Math.ceil so "Còn 0h" only shows
 *  when session truly expired (≤0). Per DM-10(b). */
function formatSessionRemaining(sessionExpiresAt: string | null): string {
  if (sessionExpiresAt === null) return '—';
  const expiresMs = Date.parse(sessionExpiresAt);
  if (Number.isNaN(expiresMs)) return '—';
  const hours = Math.max(0, Math.ceil((expiresMs - Date.now()) / 3_600_000));
  return `Còn ${hours}h`;
}

/** Format "HH:mm hôm nay" or date for last_login_at. Returns "—" if null.
 *  Per DM-10(c). Uses local timezone (Asia/Ho_Chi_Minh per user context). */
function formatLastLogin(lastLoginAt: string | null): string {
  if (lastLoginAt === null) return '—';
  const loginDate = new Date(lastLoginAt);
  if (Number.isNaN(loginDate.getTime())) return '—';
  const now = new Date();
  const isToday =
    loginDate.getFullYear() === now.getFullYear() &&
    loginDate.getMonth() === now.getMonth() &&
    loginDate.getDate() === now.getDate();
  const hh = String(loginDate.getHours()).padStart(2, '0');
  const mm = String(loginDate.getMinutes()).padStart(2, '0');
  if (isToday) return `${hh}:${mm} hôm nay`;
  // Fallback: dd/MM HH:mm — Phase 6 may polish to relative-time formatter.
  const dd = String(loginDate.getDate()).padStart(2, '0');
  const mo = String(loginDate.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev';

export default function MePage() {
  const router = useRouter();
  const meQuery = useMe();
  const logoutMutation = useLogout();

  const me = meQuery.data;
  const avatarInitials = me?.avatar_initials ?? '—';
  const displayName = me?.display_name ?? '—';
  const email = me?.email ?? '—';
  const sessionRemaining = formatSessionRemaining(me?.session_expires_at ?? null);
  const lastLoginText = formatLastLogin(me?.last_login_at ?? null);

  const handleBack = React.useCallback(() => {
    // T05 D-28 deterministic Hub return. /me là GLOBAL (không slug ở URL) →
    // resolve hub qua /auth/landing (ADR-046 amend c, S-P0-01 T02b-3), KHÔNG
    // hardcode /home. router.back() brittle khi /me mở qua direct URL.
    void pushLanding((href) => router.push(href));
  }, [router]);

  const handleStay = React.useCallback(() => {
    // D-27 "Ở lại" → return to Hub qua /auth/landing (global, không slug).
    void pushLanding((href) => router.push(href));
  }, [router]);

  const handleLogout = React.useCallback(() => {
    // D-19 + D-27 — useLogout.mutate triggers POST /auth/logout + onSuccess
    // removes ME cache + router.push('/auth/login').
    logoutMutation.mutate();
  }, [logoutMutation]);

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
        {/* STATUS BAR (mock per mockup lines 91-108 — same as login page) */}
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

        {/* TOP BAR (mockup lines 111-124) — back button + title + settings cog */}
        <div className="px-[18px] pt-3.5 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Quay lại"
              className="bg-white border-[0.5px] border-[#FBCFE8] w-9 h-9 rounded-full
                         flex items-center justify-center text-[#BE185D]
                         shadow-[0_2px_8px_rgba(233,30,99,0.1)]
                         active:scale-[0.95] transition-all
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <div>
              <div className="text-[14px] text-[#831447] font-bold tracking-[-0.2px]">
                Tài khoản của tôi
              </div>
              <div className="text-[10px] text-[#BE185D] font-medium">
                Quản lý thông tin
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cài đặt"
            className="bg-white border-[0.5px] border-[#FBCFE8] w-9 h-9 rounded-full
                       flex items-center justify-center text-[#BE185D]
                       active:scale-[0.95] transition-all
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Icon name="settings" size={17} />
          </button>
        </div>

        {/* MAIN SCROLLABLE CONTENT (mockup line 126: padding 18px 16px) */}
        <div className="flex-1 px-4 py-[18px] overflow-y-auto">

          {/* PROFILE CARD (mockup lines 128-150) */}
          <div
            className="border-[0.5px] border-[#FBCFE8] rounded-[20px] px-[18px] py-[18px] mb-3.5"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF, #FEF3F8)',
              boxShadow: '0 10px 28px rgba(233,30,99,0.1)',
              animation: 'splash-pop 0.6s ease-out backwards',
            }}
          >
            {/* Avatar + identity row (mockup lines 129-139) */}
            <div className="flex items-center gap-3.5 mb-3.5">
              {/* Avatar 60×60 orange gradient (DM-10(a)) */}
              <div
                className="w-[60px] h-[60px] rounded-full flex items-center justify-center
                           text-white font-bold text-[20px] flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FB923C, #EA580C)',
                  boxShadow: '0 6px 16px rgba(234,88,12,0.32)',
                }}
                aria-hidden="true"
              >
                {avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] text-[#831447] font-bold tracking-[-0.2px] mb-0.5">
                  {displayName}
                </div>
                <div className="text-[11px] text-[#9F1239] font-mono truncate">
                  {email}
                </div>
                {/* Status pulse green (mockup lines 134-137) */}
                <div className="flex items-center gap-1 mt-1.5">
                  <div
                    className="w-1.5 h-1.5 bg-[#10B981] rounded-full"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] text-[#047857] font-semibold">
                    Đang hoạt động
                  </span>
                </div>
              </div>
            </div>
            {/* 2-col grid Phiên / Đăng nhập (mockup lines 140-149) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#FEF7F9] border-[0.5px] border-[#FBCFE8] rounded-[10px] px-2.5 py-2">
                <div
                  className="text-[9px] text-[#9F1239] font-semibold uppercase mb-0.5"
                  style={{ letterSpacing: '0.3px' }}
                >
                  Phiên
                </div>
                <div className="text-[13px] text-[#831447] font-bold font-mono">
                  {sessionRemaining}
                </div>
              </div>
              <div className="bg-[#FEF7F9] border-[0.5px] border-[#FBCFE8] rounded-[10px] px-2.5 py-2">
                <div
                  className="text-[9px] text-[#9F1239] font-semibold uppercase mb-0.5"
                  style={{ letterSpacing: '0.3px' }}
                >
                  Đăng nhập
                </div>
                <div className="text-[13px] text-[#831447] font-bold">
                  {lastLoginText}
                </div>
              </div>
            </div>
          </div>

          {/* SETTINGS MENU — 3 rows Bell/Shield/Help (Batch 4 organism) */}
          <MeSettingsMenu />

          {/* LOGOUT CONFIRM CARD — always-visible per D-27 (Batch 4 organism) */}
          <LogoutConfirmCard
            onStay={handleStay}
            onLogout={handleLogout}
            logoutPending={logoutMutation.isPending}
          />

          {/* VERSION FOOTER (mockup lines 206-208) — DM-10(f) reads env */}
          <div className="mt-[18px] text-center">
            <div
              className="text-[10px] text-[#9F1239] font-mono"
              style={{ opacity: 0.7 }}
            >
              Aida v{APP_VERSION} • build {BUILD_SHA}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
