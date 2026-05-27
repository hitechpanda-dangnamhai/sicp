'use client';

/**
 * apps/web/components/icp/molecules/ShopeeCompareCardExpanded.tsx
 *
 * Molecule: <ShopeeCompareCardExpanded> — full-page expanded panel for state-D.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-D-shopee-expanded.html`
 *           (595 LOC, per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 * - **C-21** (S-01 T04 — original scope cut): ShopeeCompareCard compact was
 *   T04 only; expanded mode DEFERRED to S-07. This molecule fulfills that
 *   deferral.
 * - **C-S07-D**: SSE `shopee_compare` event payload `{aggregates, samples}`
 *   drives this component (shape per SseShopeeCompareEvent)
 * - **C-S07-A** (Phiên Sx07-B): 2-tier `shopee.price_range` returns
 *   `{aggregates: {min_price, avg_price, max_price, sample_count, review_count},
 *    samples: [{title, store, price, rating, sold_count}]}`
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — `onBack` callback only
 * - **C-15** 'use client' — uses useMemo for marker position computation
 *
 * **Layout** (mockup state-D):
 *   - Header: back-arrow + title + "5 cửa hàng"
 *   - Hero: large min-avg-max bar with user-price marker + median marker
 *   - Aggregates grid: 4 stat cards (min/avg/max/samples count)
 *   - Samples table: title / store / price / rating / sold_count rows
 *
 * Reach: S-07 V-SLICE state-D — single use site at /intent-01 page expanded
 *        view from compact ShopeeCompareCard "Mở rộng" CTA.
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import { cn, formatVND } from '@/lib/utils';

/** Sample item — mirrors SseShopeeCompareEvent.samples[] item shape. */
export interface ShopeeCompareSample {
  title: string;
  store: string;
  price: number;
  rating: number | null;
  sold_count: number;
}

/** Aggregates — mirrors SseShopeeCompareEvent.aggregates shape. */
export interface ShopeeCompareAggregates {
  min_price: number;
  avg_price: number;
  max_price: number;
  sample_count: number;
  review_count: number;
}

export interface ShopeeCompareCardExpandedProps {
  /** User's product price (VND) — drives the marker on the range bar. */
  userPrice: number;
  /** Market aggregates from `shopee.price_range` MCP tool. */
  aggregates: ShopeeCompareAggregates;
  /** Per-store samples (3-5 items typical). */
  samples: ShopeeCompareSample[];
  /** Optional subtitle (e.g., category name). */
  subtitle?: string;
  /** Back CTA — caller closes the expanded view. */
  onBack: () => void;
  /** Optional className passthrough. */
  className?: string;
}

/** Format a star rating; null → em dash. */
function formatRating(rating: number | null): string {
  if (rating == null) return '—';
  return rating.toFixed(1);
}

/** Format sold count: 12345 → "12k", 234 → "234". */
function formatSoldCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function ShopeeCompareCardExpanded({
  userPrice,
  aggregates,
  samples,
  subtitle,
  onBack,
  className,
}: ShopeeCompareCardExpandedProps) {
  const { min_price, avg_price, max_price, sample_count, review_count } = aggregates;

  // Compute marker positions as percent within [min, max] range
  const { userPct, avgPct } = React.useMemo(() => {
    const range = Math.max(1, max_price - min_price);
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    return {
      userPct: clamp(((userPrice - min_price) / range) * 100),
      avgPct: clamp(((avg_price - min_price) / range) * 100),
    };
  }, [userPrice, min_price, max_price, avg_price]);

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b-[0.5px] border-icp-pink-100 bg-white sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          className="w-9 h-9 rounded-full flex items-center justify-center text-icp-pink-700 hover:bg-icp-pink-50"
        >
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-[16px] font-bold text-icp-pink-900">Giá thị trường Shopee</h1>
          {subtitle && (
            <div className="text-[11px] text-icp-pink-700 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="text-[11px] font-semibold text-icp-pink-700 bg-icp-pink-50 px-2 py-1 rounded-full">
          {sample_count} cửa hàng
        </div>
      </div>

      {/* Hero — big range bar */}
      <div className="px-4 py-5 bg-gradient-to-br from-white to-orange-50">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
          Phổ giá thị trường
        </div>

        {/* Price marker row */}
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-[10px] text-amber-700 font-semibold mb-0.5">Của bạn</div>
            <div className="font-mono text-[22px] font-bold text-icp-pink-900">
              {formatVND(userPrice)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-amber-700 font-semibold mb-0.5">Trung vị</div>
            <div className="font-mono text-[16px] font-bold text-amber-800">
              {formatVND(avg_price)}
            </div>
          </div>
        </div>

        {/* Range bar */}
        <div className="relative h-3 bg-white rounded-full border-[0.5px] border-amber-200 overflow-visible">
          {/* Filled track from min to max (decorative gradient) */}
          <div
            className="absolute top-0 bottom-0 left-0 right-0 rounded-full"
            style={{
              backgroundImage: 'linear-gradient(90deg, #FED7AA, #FB923C, #DC2626)',
              opacity: 0.6,
            }}
          />
          {/* Avg median marker — dotted vertical line */}
          <div
            className="absolute top-[-6px] bottom-[-6px] w-0.5 bg-amber-700"
            style={{ left: `${avgPct}%` }}
            aria-hidden="true"
          />
          {/* User marker — pink filled circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-icp-pink-600 border-2 border-white shadow-md"
            style={{ left: `${userPct}%` }}
            aria-label={`Giá của bạn: ${formatVND(userPrice)}`}
            role="img"
          />
        </div>

        {/* Min/Max labels */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono text-amber-700">{formatVND(min_price)}</span>
          <span className="text-[10px] font-mono text-amber-700">{formatVND(max_price)}</span>
        </div>
      </div>

      {/* Aggregates grid */}
      <div className="px-4 py-4 grid grid-cols-2 gap-2 bg-white">
        <div className="rounded-xl border-[0.5px] border-emerald-100 bg-emerald-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
            Giá thấp nhất
          </div>
          <div className="font-mono text-[15px] font-bold text-emerald-800">
            {formatVND(min_price)}
          </div>
        </div>
        <div className="rounded-xl border-[0.5px] border-rose-100 bg-rose-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">
            Giá cao nhất
          </div>
          <div className="font-mono text-[15px] font-bold text-rose-800">
            {formatVND(max_price)}
          </div>
        </div>
        <div className="rounded-xl border-[0.5px] border-amber-100 bg-amber-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
            Số cửa hàng
          </div>
          <div className="font-mono text-[15px] font-bold text-amber-800 tabular-nums">
            {sample_count}
          </div>
        </div>
        <div className="rounded-xl border-[0.5px] border-icp-pink-100 bg-icp-pink-50/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-icp-pink-700 mb-1">
            Tổng đánh giá
          </div>
          <div className="font-mono text-[15px] font-bold text-icp-pink-900 tabular-nums">
            {review_count.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>

      {/* Samples table */}
      <div className="px-4 pb-6 bg-white">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-icp-pink-900 mb-2">
          Top cửa hàng cùng loại
        </h2>
        <ul className="flex flex-col gap-2" role="list">
          {samples.map((s, i) => (
            <li
              key={`${s.store}-${i}`}
              className="rounded-xl border-[0.5px] border-icp-pink-100 bg-white p-3 flex items-center gap-3"
            >
              {/* Store badge */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-[10px] font-bold uppercase">
                  {s.store.slice(0, 2)}
                </span>
              </div>

              {/* Title + store + meta */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-icp-pink-900 leading-tight truncate">
                  {s.title}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-icp-pink-700">
                  <span className="font-medium">{s.store}</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-0.5">
                    <span aria-hidden="true">★</span>
                    {formatRating(s.rating)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Đã bán {formatSoldCount(s.sold_count)}</span>
                </div>
              </div>

              {/* Price */}
              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-[14px] font-bold text-icp-pink-900 tabular-nums">
                  {formatVND(s.price)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer note */}
        <p className="mt-4 text-center text-[10px] text-icp-pink-700/60">
          Dữ liệu mẫu Shopee · Cập nhật mỗi ngày
        </p>
      </div>
    </div>
  );
}
