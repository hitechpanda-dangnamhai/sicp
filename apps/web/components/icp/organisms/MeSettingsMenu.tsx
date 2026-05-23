'use client';

/**
 * apps/web/components/icp/organisms/MeSettingsMenu.tsx
 *
 * Organism: <MeSettingsMenu> — Settings card with 3 rows (Bell/Shield/Help) on
 * `/me` profile page state-F.
 *
 * Slice:    S-03 T05 — /me Profile + Logout Flow + 3 stub settings routes
 *
 * Source:   `docs/mockups/intent-08/intent-08-state-F-logout.html` lines 152-183
 *           Card white + radius 16 + 3 rows separated by 0.5px #FCE7F3 dividers.
 *           Each row: 36×36 gradient pink icon box + label/subtext + chevron-right.
 *
 * Decisions applied:
 * - **D-18** — "Quên mật khẩu?" + 3 settings rows use Next.js `<Link>` SPA
 *   navigation (prefetch enabled). NOT button + onClick handlers (idiom: Link
 *   for known-target navigation, onClick for behavior). Mockup line 161/171/181:
 *   each row is a button visually but semantically navigates → use Link.
 * - **AC-37** — Event emit `nav.settings_section_opened{section}` happens at
 *   destination route page onMount (NOT here). This component is navigation-only.
 *   See `apps/web/app/me/{notifications,security,help}/page.tsx`.
 *
 * **Why event emit on destination, not click here?**
 *   - Mockup intent: "section opened" — fires when section actually loads,
 *     not when user taps (mid-navigation might be aborted).
 *   - Next.js Link prefetch loads destination route on hover — wiring onClick
 *     here would double-emit (hover prefetch + click + onMount).
 *   - Destination onMount = single source of truth, matches BE semantics.
 *
 * **Atom reuse** (C-22 atom interface discipline):
 *   - <Icon name="bell" | "shield-check" | "help" /> for row icons
 *   - <Icon name="chevron-right" /> for row trailing chevron
 *   - icon-map.ts T05 patch added `help: HelpCircle` (Batch 1 step 1)
 *
 * Reach:    S-03 V-SLICE Auth (state-F profile page) — single use site.
 *
 * Props: zero (data is mockup-literal hardcoded VN per C-08 + D-05).
 *
 * S-03 T05 emit (Phiên N+2 Batch 4).
 */

import Link from 'next/link';
import { Icon } from '@/components/icp/atoms';

interface SettingsRow {
  /** Icon name from registered ICON_MAP (Batch 1 includes `help` lucide HelpCircle). */
  iconName: 'bell' | 'shield-check' | 'help';
  label: string;
  subtitle: string;
  href: string;
}

const SETTINGS_ROWS: SettingsRow[] = [
  {
    iconName: 'bell',
    label: 'Thông báo',
    subtitle: 'Đơn hàng, khuyến mãi',
    href: '/me/notifications',
  },
  {
    iconName: 'shield-check',
    label: 'Bảo mật',
    subtitle: 'Mật khẩu, 2FA',
    href: '/me/security',
  },
  {
    iconName: 'help',
    label: 'Trợ giúp',
    subtitle: 'Hướng dẫn, liên hệ',
    href: '/me/help',
  },
];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MeSettingsMenuProps {
  /** Reserved for future props (currently zero — mockup-literal hardcoded VN). */
}

export function MeSettingsMenu(_props: MeSettingsMenuProps = {}) {
  return (
    <div
      className="bg-white border-[0.5px] border-[#FBCFE8] rounded-2xl overflow-hidden mb-3.5"
      style={{
        boxShadow: '0 6px 16px rgba(233,30,99,0.08)',
        animation: 'splash-slideUp 0.5s ease-out 0.1s backwards',
      }}
    >
      {SETTINGS_ROWS.map((row, idx) => (
        <Link
          key={row.iconName}
          href={row.href}
          className={
            'w-full bg-transparent px-4 py-3.5 flex items-center gap-3 text-left ' +
            'hover:bg-[#FEF7F9] transition-colors focus-visible:outline-none ' +
            'focus-visible:bg-[#FEF7F9] ' +
            (idx < SETTINGS_ROWS.length - 1 ? 'border-b-[0.5px] border-b-[#FCE7F3]' : '')
          }
        >
          {/* 36×36 gradient pink icon box (mockup line 154/164/174) */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0
                       bg-gradient-to-br from-[#FCE7F3] to-[#FBCFE8] text-[#BE185D]"
          >
            <Icon name={row.iconName} size={18} />
          </div>
          {/* Label + subtitle */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[#831447] font-semibold leading-tight">
              {row.label}
            </div>
            <div className="text-[11px] text-[#9F1239] leading-tight mt-0.5">
              {row.subtitle}
            </div>
          </div>
          {/* Chevron right */}
          <Icon name="chevron-right" size={16} className="text-[#BE185D] flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
