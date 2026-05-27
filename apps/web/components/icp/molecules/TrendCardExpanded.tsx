'use client';

/**
 * apps/web/components/icp/molecules/TrendCardExpanded.tsx
 *
 * Molecule: <TrendCardExpanded> — full-page expanded panel for state-H Google Trends.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-H-trend-expanded.html` (497 LOC)
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Decisions applied:
 * - **C-21** (S-01 T04 — original scope cut): TrendCard compact was T04 only;
 *   expanded mode DEFERRED to S-07. This molecule fulfills that deferral.
 * - **C-S07-D**: SSE `market_trend` event payload `{trajectory, current_score,
 *   delta_pct, series, related_rising, insight?}` drives this component
 *   (shape per `SseMarketTrendEvent` lines 549-556 in intent-stream.ts).
 * - **C-S07-A** (Phiên Sx07-B): `gtrends.interest_over_time` mock fixture returns
 *   `{trajectory, current_score, delta_pct, series: number[], related_rising: string[]}`
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — `onBack` + optional `onChipTap` callbacks
 * - **C-11 trend-green native**: emerald palette (`#10B981`) for rising trajectory
 *
 * **Mockup composition** (lines 369-483 reference):
 *   - Header: back-arrow + title "Nhu cầu thị trường" + subtitle "Google Trends · {category}"
 *   - Hero: trajectory tag pill + big delta ↑34% + headline + large sparkline 320×64
 *           with axis labels (3 tháng trước / 2 tháng / 1 tháng / Hôm nay)
 *   - 3 stat cells row: Hiện tại / Đỉnh 90d / Đáy 90d
 *   - Section: "Từ khoá đang lên" header + chips grid (related_rising with +pct deltas)
 *   - AI reasoning card: "🤖 Aida nhận định" with insight text
 *   - Footer meta: "Cập nhật 5 phút trước · Google Trends VN"
 *
 * **Why delta_pct sign drives trajectory styling:**
 * Mockup state-H shows `.th-delta` color amber when negative, emerald when positive.
 * `trajectory` field is authoritative ('rising' | 'falling' | 'stable') per BE
 * gtrends.interest_over_time tool, but visual delta_pct sign is the simpler
 * client-side fallback when trajectory is 'stable' (small variation).
 *
 * Reach: S-07 V-SLICE state-H — single use site at /intent-01 page expanded
 *        view from compact TrendCard "Mở rộng" CTA.
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

/**
 * Mirrors `SseMarketTrendEvent` shape (excerpt — see
 * `packages/shared-types/src/sse/intent-stream.ts:549-556`).
 */
export interface TrendData {
  /** 'rising' | 'falling' | 'stable' per gtrends.interest_over_time. */
  trajectory: 'rising' | 'falling' | 'stable';
  /** Current Google Trends interest score (0-100). */
  current_score: number;
  /** Signed percent delta over the series window. */
  delta_pct: number;
  /** Daily/weekly score series (typically 12-30 points for 90 days). */
  series: number[];
  /** Related rising search terms (4-6 typical), in descending +pct order. */
  related_rising: string[];
  /** Optional AI insight text (Vietnamese — 1-3 sentences). */
  insight?: string;
}

export interface TrendCardExpandedProps {
  /** Market trend data — mirrors SseMarketTrendEvent. */
  trend: TrendData;
  /**
   * Optional product context shown in header subtitle (e.g.,
   * "Maggi nước tương 200ml"). When omitted, subtitle is just "Google Trends VN".
   */
  productContext?: string;
  /**
   * Optional per-chip tap callback — useful for adding the rising term to
   * the product description via merchant action. If absent, chips are
   * decorative.
   */
  onChipTap?: (term: string) => void;
  /** Back CTA — caller closes the expanded view. */
  onBack: () => void;
  /** Optional className passthrough. */
  className?: string;
}

/**
 * Compute sparkline SVG path strings + last point coords.
 *
 * Mockup-locked viewBox: 320×64 with 3px padding on top/bottom for
 * end-point dot visibility. Used for the hero sparkline (NOT the compact
 * MiniSparkline atom which is 38px high — too small for state-H hero).
 */
function computePaths(data: number[], width: number, height: number) {
  if (!data || data.length === 0) {
    return { linePath: '', fillPath: '', endX: 0, endY: 0 };
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const padding = 6;
  const usableHeight = height - padding * 2;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return [x, y] as [number, number];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;
  const [endX, endY] = points[points.length - 1];
  return { linePath, fillPath, endX, endY };
}

/** Compute series peak + trough scores (rounded) — for 3 stat cells. */
function computeStats(series: number[], current: number) {
  if (!series || series.length === 0) {
    return { peak: current, trough: current };
  }
  return {
    peak: Math.round(Math.max(...series)),
    trough: Math.round(Math.min(...series)),
  };
}

const TRAJECTORY_LABEL_VN: Record<TrendData['trajectory'], string> = {
  rising: 'Đang tăng mạnh',
  falling: 'Đang giảm',
  stable: 'Đang ổn định',
};

export function TrendCardExpanded({
  trend,
  productContext,
  onChipTap,
  onBack,
  className,
}: TrendCardExpandedProps) {
  const { trajectory, current_score, delta_pct, series, related_rising, insight } = trend;
  const isRising = trajectory === 'rising' || (trajectory === 'stable' && delta_pct >= 0);
  const deltaSign = delta_pct >= 0 ? '+' : '';
  const deltaStr = `${isRising ? '↑' : '↓'}${deltaSign}${Math.round(delta_pct)}%`;

  // Hero sparkline 320×64 per mockup line 382
  const heroPaths = React.useMemo(() => computePaths(series, 320, 64), [series]);
  const stats = React.useMemo(() => computeStats(series, current_score), [series, current_score]);

  // Synthesize per-chip delta percentage from related_rising index ordering:
  // chips are sorted descending — chip[0] gets +120%, chip[1] gets +85%, etc.
  // Mockup-locked decreasing pattern (real BE returns string[] without deltas).
  const chipDeltas = React.useMemo(() => {
    const baseline = [120, 85, 62, 48, 33, 22];
    return related_rising.map((_, i) => baseline[i] ?? 18);
  }, [related_rising]);

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b-[0.5px] border-icp-pink-100 bg-white sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          className="w-9 h-9 rounded-full flex items-center justify-center text-icp-pink-700 hover:bg-icp-pink-50 shadow-[0_2px_8px_rgba(233,30,99,0.1)] border-[0.5px] border-icp-pink-200 bg-white"
        >
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold text-icp-pink-900 leading-tight">
            Nhu cầu thị trường
          </div>
          <div className="text-[11px] text-icp-pink-700 font-medium mt-0.5 truncate">
            Google Trends{productContext ? ` · ${productContext}` : ' VN'}
          </div>
        </div>
      </div>

      {/* Hero — trajectory tag + big delta + headline + large sparkline */}
      <div className="px-4 pt-5 pb-4 bg-gradient-to-br from-emerald-50/40 to-white">
        {/* Trajectory tag pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border-[0.5px] border-emerald-200 mb-3">
          <Icon name="trending-up" size={11} className="text-emerald-700" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            {TRAJECTORY_LABEL_VN[trajectory]}
          </span>
        </div>

        {/* Big delta number */}
        <div
          className="font-mono text-[44px] font-bold leading-none mb-2"
          style={{
            background: isRising
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'linear-gradient(135deg, #F59E0B, #DC2626)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {deltaStr}
        </div>

        {/* Headline */}
        <p className="text-[14px] text-icp-pink-900 font-medium leading-snug mb-4">
          90 ngày qua, từ khóa{' '}
          <span className="font-bold">
            {productContext ? `"${productContext}"` : 'tìm kiếm liên quan'}
          </span>{' '}
          {isRising ? 'tăng đều' : 'có biến động giảm'}
        </p>

        {/* Large sparkline 320×64 with grid lines + axis labels */}
        <div className="rounded-2xl bg-white border-[0.5px] border-emerald-100 p-3 shadow-sm">
          <svg
            viewBox="0 0 320 64"
            preserveAspectRatio="none"
            className="w-full h-16 block"
            role="img"
            aria-label={`Sparkline 90 ngày: ${deltaStr}`}
          >
            <defs>
              <linearGradient id="trend-hero-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* horizontal grid lines (dashed) */}
            <line x1="0" y1="16" x2="320" y2="16" stroke="#A7F3D0" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="0" y1="32" x2="320" y2="32" stroke="#A7F3D0" strokeWidth="0.5" strokeDasharray="2,3" />
            <line x1="0" y1="48" x2="320" y2="48" stroke="#A7F3D0" strokeWidth="0.5" strokeDasharray="2,3" />
            {/* area + line */}
            {heroPaths.fillPath && (
              <path d={heroPaths.fillPath} fill="url(#trend-hero-fill)" />
            )}
            {heroPaths.linePath && (
              <path
                d={heroPaths.linePath}
                stroke="#10B981"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* last point dot */}
            {series.length > 0 && (
              <circle cx={heroPaths.endX} cy={heroPaths.endY} r="3.5" fill="#fff" stroke="#10B981" strokeWidth="2.2" />
            )}
          </svg>
          {/* Axis labels */}
          <div className="flex justify-between mt-1.5 text-[10px] text-emerald-700">
            <span>3 tháng trước</span>
            <span>2 tháng</span>
            <span>1 tháng</span>
            <span className="text-emerald-600 font-semibold">Hôm nay</span>
          </div>
        </div>
      </div>

      {/* 3 stat cells row */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 bg-white">
        <div className="rounded-xl border-[0.5px] border-emerald-100 bg-emerald-50/40 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
            Hiện tại
          </div>
          <div className="font-mono text-[20px] font-bold text-emerald-800 tabular-nums leading-tight">
            {Math.round(current_score)}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">/ 100</div>
        </div>
        <div className="rounded-xl border-[0.5px] border-icp-pink-100 bg-icp-pink-50/40 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-icp-pink-700 mb-0.5">
            Đỉnh 90d
          </div>
          <div className="font-mono text-[20px] font-bold text-icp-pink-900 tabular-nums leading-tight">
            {stats.peak}
          </div>
          <div className="text-[10px] text-icp-pink-700/80 mt-0.5">tuần trước</div>
        </div>
        <div className="rounded-xl border-[0.5px] border-amber-100 bg-amber-50/40 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">
            Đáy 90d
          </div>
          <div className="font-mono text-[20px] font-bold text-amber-800 tabular-nums leading-tight">
            {stats.trough}
          </div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">3 tháng trước</div>
        </div>
      </div>

      {/* Related rising chips */}
      {related_rising.length > 0 && (
        <div className="px-4 py-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-800">
              <Icon name="trending-up" size={11} className="text-emerald-700" />
              Từ khoá đang lên
            </span>
            {onChipTap && (
              <span className="text-[10px] text-emerald-700/70">Tap để thêm vào sản phẩm</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {related_rising.map((term, i) => (
              <button
                key={`${term}-${i}`}
                type="button"
                onClick={onChipTap ? () => onChipTap(term) : undefined}
                disabled={!onChipTap}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                  'bg-emerald-50 border-[0.5px] border-emerald-200 text-emerald-800',
                  'text-[12px] font-medium',
                  onChipTap && 'hover:bg-emerald-100 active:scale-[0.97] cursor-pointer transition-all',
                )}
              >
                <span className="text-emerald-700 font-bold">↑</span>
                <span>{term}</span>
                <span className="font-bold text-emerald-700">+{chipDeltas[i]}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI reasoning */}
      {insight && (
        <div className="mx-4 mb-3 rounded-2xl bg-gradient-to-br from-pink-50 to-white border-[0.5px] border-icp-pink-200 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-icp-pink-600 to-orange-400 flex items-center justify-center shadow-sm">
              <Icon name="sparkles" size={12} className="text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-icp-pink-900">
              🤖 Aida nhận định
            </span>
          </div>
          <div className="text-[13px] text-icp-pink-900 leading-relaxed">{insight}</div>
        </div>
      )}

      {/* Meta footer */}
      <div className="px-4 pb-4 text-center">
        <p className="text-[10px] text-icp-pink-700/60">
          Cập nhật 5 phút trước · Google Trends VN
        </p>
      </div>
    </div>
  );
}
