/**
 * HomeBottomNav — Dashboard 4-tab bottom navigation.
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 307-330
 *
 * Structure: 4 tab buttons horizontal, each with optional active indicator bar,
 * icon, label. Per mockup state at `/home`:
 *   - Tab 0 "Trang chính" ACTIVE — gradient pink→orange bar top + pink icon + pink label bold
 *   - Tab 1 "Trò chuyện" inactive — gray icon + gray label
 *   - Tab 2 "Đề xuất" inactive + count badge "2" (orange gradient circle, white border)
 *   - Tab 3 "Cửa hàng" inactive
 *
 * Per S-03 D-13 (MAR-1 Q8+Q9 RESOLVED Phiên 34) — decorative-only:
 *   - "Trang chính" hardcoded active (no router pathname check)
 *   - Tab clicks NO-OP (no handlers, no router.push)
 *   - Defer dynamic active state + Inbox/Chat/Profile routes to future slices
 *   - Per C-22 RESOLVED Phiên 34 — preserved Decision: NO active state semantics
 *     for non-/home routes (no NavigationContext)
 *
 * **NOT REUSING `BottomBar` layout** (C-24 verified Phiên 35 NO MATCH):
 *   - BottomBar = generic CTA shell `<div className="bottom-bar">{children}</div>`
 *     hosting primary CTA buttons ("Lưu sản phẩm", "Thanh toán")
 *   - HomeBottomNav = 4-tab navigation (specific structure: tab+indicator+icon+label+badge)
 *
 * SERVER component per C-15 — pure render, no event handlers. Belongs to
 * `layout/` (NOT `organisms/`) per FE conventions: layout = persistent shell
 * chrome, organisms = content-specific compositions.
 *
 * Per S-03 D-13 + DM-13 + C-22 + C-24.
 */

import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';

interface NavTab {
  iconName: IconName;
  label: string;
  active?: boolean;
  badge?: number;
}

const TABS: ReadonlyArray<NavTab> = [
  { iconName: 'home', label: 'Trang chính', active: true },
  { iconName: 'message-circle', label: 'Trò chuyện' },
  { iconName: 'inbox', label: 'Đề xuất', badge: 2 },
  { iconName: 'user', label: 'Cửa hàng' },
];

export interface HomeBottomNavProps {
  /** Optional consumer override for additional Tailwind classes. */
  className?: string;
}

export function HomeBottomNav({ className }: HomeBottomNavProps) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className={cn(
        'flex px-1 pt-2 pb-3 bg-white border-t-[0.5px] border-pink-100',
        className,
      )}
    >
      {TABS.map((tab, i) => (
        <button
          key={i}
          type="button"
          aria-label={tab.label}
          aria-current={tab.active ? 'page' : undefined}
          tabIndex={-1}
          className={cn(
            'flex-1 bg-transparent border-none flex flex-col items-center gap-[3px] p-1 relative',
          )}
        >
          {/* Active indicator bar */}
          {tab.active ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 w-[22px] h-[3px] rounded-sm bg-gradient-to-r from-pink-600 to-orange-400"
            />
          ) : (
            <span aria-hidden="true" className="h-[3px]" />
          )}
          <Icon
            name={tab.iconName}
            size={22}
            className={tab.active ? 'text-pink-600' : 'text-gray-300'}
          />
          <span
            className={cn(
              'text-[10px]',
              tab.active ? 'text-pink-700 font-bold' : 'text-gray-400',
            )}
          >
            {tab.label}
          </span>
          {tab.badge != null && tab.badge > 0 && (
            <span
              aria-label={`${tab.badge} đề xuất mới`}
              className={cn(
                'absolute top-0 right-3.5 min-w-[18px] h-[18px] px-1.5 rounded-full',
                'bg-gradient-to-br from-orange-500 to-orange-600 text-white text-[10px] font-bold',
                'flex items-center justify-center border-2 border-white',
              )}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
