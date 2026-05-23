'use client';

/**
 * apps/web/components/icp/organisms/LogoutConfirmCard.tsx
 *
 * Organism: <LogoutConfirmCard> — always-visible logout confirmation card on
 * `/me` profile page state-F (per D-27 mockup literal compliance).
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow
 *
 * Source:   `docs/mockups/intent-08/intent-08-state-F-logout.html` lines 185-204
 *           Red gradient card + logout icon 44×44 + heading + subtitle +
 *           2-button row ("Ở lại" outline-pink + "Đăng xuất" red-grad inline).
 *
 * Decisions applied:
 * - **D-27** — Always-visible (no useState toggle, no modal, no dismiss). Card
 *   renders unconditionally on state-F per mockup literal compliance (Rule 6).
 *   Both buttons meaningful:
 *     - "Ở lại" → `onStay()` typically `router.push('/home')` (return to Hub)
 *     - "Đăng xuất" → `onLogout()` typically `useLogout.mutate()`
 *   Page wires both handlers; this organism is pure presentation + slot.
 * - **C-22** — Atom reuse: Icon (logout shape). NO Button atom reuse for "Đăng
 *   xuất" red-grad — inline className override per BRIEF non-goal:
 *   "❌ `red-grad` Button variant addition to S-01 atom library (T05 inline
 *   className override sufficient — single-appearance state-F; Phase 6 promote
 *   if S-04+ requires)". "Ở lại" CAN reuse `outline` variant from existing.
 *
 * **Why no Button atom for "Đăng xuất"?**
 *   The S-01 Button CVA atom has `pink-grad` and `mic-grad` variants but NOT
 *   `red-grad`. Adding a new variant to S-01 for a single-appearance state-F
 *   use violates S-01 LOCKED post-consolidation rule (Phiên 19). Inline
 *   className override using same shadcn primitive shape is the right escape
 *   hatch — pattern locked V-SLICE forward.
 *
 * **Props design**:
 *   - `onStay: () => void` — fired on "Ở lại" click. Parent decides destination.
 *   - `onLogout: () => void` — fired on "Đăng xuất" click. Parent owns mutation.
 *   - `logoutPending: boolean` — when true, "Đăng xuất" disabled + spinner OR
 *     just disabled. Mockup state-F has no loading variant of this card; we
 *     gracefully add a disabled visual when mutation in-flight (prevents
 *     double-tap).
 *
 * Reach:    S-03 V-SLICE Auth (state-F profile page) — single use site.
 *
 * S-03 T05 emit (Phiên N+2 Batch 4).
 */

import { Icon } from '@/components/icp/atoms';

export interface LogoutConfirmCardProps {
  /** Fired on "Ở lại" button click. Parent decides destination (typically
   *  `router.push('/home')` per D-27). */
  onStay: () => void;
  /** Fired on "Đăng xuất" button click. Parent owns mutation (typically
   *  `useLogout.mutate()` from `@/lib/auth/use-logout`). */
  onLogout: () => void;
  /** When true, "Đăng xuất" button is disabled + pointer-events-none (prevents
   *  double-tap during logout mutation). Defaults to false. */
  logoutPending?: boolean;
}

export function LogoutConfirmCard({
  onStay,
  onLogout,
  logoutPending = false,
}: LogoutConfirmCardProps) {
  return (
    <div
      className="relative z-10"
      style={{ animation: 'splash-slideUp 0.5s ease-out 0.2s backwards' }}
    >
      <div
        className="border-[0.5px] border-[#FECACA] rounded-[18px] px-[18px] py-[18px]"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF, #FEF2F2)',
          boxShadow: '0 14px 32px rgba(220,38,38,0.14)',
        }}
      >
        {/* Header row: 44×44 red-grad icon box + text block (mockup lines 187-195) */}
        <div className="flex items-center gap-3 mb-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FEE2E2, #FCA5A5)',
            }}
          >
            <Icon name="log-out" size={22} className="text-[#DC2626]" />
          </div>
          <div className="flex-1">
            <div className="text-[14px] text-[#831447] font-bold mb-0.5">
              Đăng xuất khỏi tài khoản?
            </div>
            <div className="text-[11px] text-[#9F1239] leading-[1.4]">
              Em sẽ huỷ phiên hiện tại. Anh có thể đăng nhập lại bất cứ lúc nào.
            </div>
          </div>
        </div>

        {/* 2-button row (mockup lines 196-203) */}
        <div className="flex gap-2">
          {/* "Ở lại" — outline-pink (mockup line 197 #FBCFE8 border + #BE185D text) */}
          <button
            type="button"
            onClick={onStay}
            className="flex-1 bg-white border-[0.5px] border-[#FBCFE8] text-[#BE185D]
                       py-2.5 rounded-xl text-[13px] font-semibold
                       hover:bg-[#FEF7F9] active:scale-[0.98] transition-all
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ở lại
          </button>
          {/* "Đăng xuất" — inline red-grad override (BRIEF non-goal: no S-01
              red-grad variant addition; inline className per T05 scope) */}
          <button
            type="button"
            onClick={onLogout}
            disabled={logoutPending}
            aria-busy={logoutPending || undefined}
            className="flex-1 text-white py-2.5 rounded-xl text-[13px] font-bold
                       flex items-center justify-center gap-1.5 transition-all
                       active:scale-[0.98] hover:opacity-90
                       disabled:opacity-50 disabled:pointer-events-none
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{
              background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
              boxShadow: '0 6px 16px rgba(220,38,38,0.32)',
            }}
          >
            <Icon name="log-out" size={15} />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
