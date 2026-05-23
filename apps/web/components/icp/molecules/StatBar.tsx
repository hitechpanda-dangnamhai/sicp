/**
 * StatBar — Dashboard 3-cell KPI bar.
 *
 * Slice:  S-03 T03b — Home Dashboard hub
 * Mockup: `golden-reference-mockup.html` lines 122-153 (#stat-bar block)
 *
 * 3 stat cells horizontal, vertical dividers between:
 *   cell[0]: receipt icon (pink ramp) + value "8" + label "đơn hôm nay"
 *   cell[1]: trending-up icon (orange ramp) + value "2.4M" + label "doanh thu"
 *   cell[2]: package icon (amber ramp) + value "142" + label "tồn kho"
 *
 * Consumes BE stub `GET /api/v1/dashboard/stats` (via `useStats()` hook Batch 5):
 *   { orders_today: 8, revenue_today: 2400000, inventory_count: 142, currency: 'VND' }
 *
 * Display logic per mockup:
 *   - orders_today + inventory_count: raw integer
 *   - revenue_today: VND-formatted compact ("2.4M", "850K") — formatted inline here
 *
 * NOT reusing S-01 `StatPill` atom: different visual structure (3-cell row with
 * dividers vs StatPill standalone card). C-22 atom interface discipline preserved
 * via composition with `<Icon>` atom + Tailwind utility inline per C-18 Tier 4.
 *
 * SERVER component per C-15 (pure render, no event handlers).
 *
 * Per S-03 DM-14 + D-10 (MAR-1 Q5 RESOLVED Phiên 34).
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface StatBarProps extends HTMLAttributes<HTMLDivElement> {
  /** REQUIRED — orders count today (non-negative integer) */
  ordersToday: number;
  /** REQUIRED — revenue today in VND (non-negative integer, formatted compact) */
  revenueToday: number;
  /** REQUIRED — total inventory SKU count (non-negative integer) */
  inventoryCount: number;
}

/**
 * Format revenue VND compact per mockup display "2.4M":
 *   - ≥1_000_000: "{N.N}M" (1 decimal, e.g. 2_400_000 → "2.4M")
 *   - ≥1_000:     "{N}K" (no decimal, e.g. 850_000 → "850K")
 *   - else:       raw integer string
 */
function formatRevenueCompact(value: number): { main: string; suffix: string } {
  if (value >= 1_000_000) {
    return { main: (value / 1_000_000).toFixed(1), suffix: 'M' };
  }
  if (value >= 1_000) {
    return { main: String(Math.round(value / 1_000)), suffix: 'K' };
  }
  return { main: String(value), suffix: '' };
}

export const StatBar = forwardRef<HTMLDivElement, StatBarProps>(function StatBar(
  { ordersToday, revenueToday, inventoryCount, className, ...rest },
  ref,
) {
  const revenue = formatRevenueCompact(revenueToday);

  return (
    <div
      ref={ref}
      className={cn(
        'bg-white border-[0.5px] border-pink-200 rounded-[18px] px-3.5 py-3',
        'shadow-[0_6px_18px_rgba(233,30,99,0.08)] flex items-center gap-2.5',
        className,
      )}
      {...rest}
    >
      {/* Cell 1 — orders today */}
      <div className="flex items-center gap-1.5 pr-3 border-r-[0.5px] border-pink-100 flex-1">
        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center flex-shrink-0">
          <Icon name="receipt" size={16} className="text-pink-700" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold tracking-[-0.3px] text-rose-900 font-[var(--font-jetbrains-mono)]">
            {ordersToday}
          </div>
          <div className="text-[9px] text-rose-700 font-medium">đơn hôm nay</div>
        </div>
      </div>

      {/* Cell 2 — revenue today */}
      <div className="flex items-center gap-1.5 pr-3 border-r-[0.5px] border-pink-100 flex-1">
        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
          <Icon name="trending-up" size={16} className="text-orange-700" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold tracking-[-0.3px] text-orange-900 font-[var(--font-jetbrains-mono)]">
            {revenue.main}
            {revenue.suffix && <span className="text-[10px] text-orange-700">{revenue.suffix}</span>}
          </div>
          <div className="text-[9px] text-orange-700 font-medium">doanh thu</div>
        </div>
      </div>

      {/* Cell 3 — inventory count */}
      <div className="flex items-center gap-1.5 flex-1">
        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-amber-100 to-amber-300 flex items-center justify-center flex-shrink-0">
          <Icon name="package" size={16} className="text-amber-800" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold tracking-[-0.3px] text-amber-900 font-[var(--font-jetbrains-mono)]">
            {inventoryCount}
          </div>
          <div className="text-[9px] text-amber-800 font-medium">tồn kho</div>
        </div>
      </div>
    </div>
  );
});
