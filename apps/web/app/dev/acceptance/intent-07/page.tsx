/**
 * apps/web/app/dev/acceptance/intent-07/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I07 — Analytics Dashboard (Phân tích dữ liệu)
 * State:   state-C-chart-line
 *
 * Reference: docs/mockups/intent-07-analytics/state-C-chart-line.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="app"), StatusBar, AppHeader
 *   - Atoms: StatPill, MiniSparkline
 *   - Molecules: DrillChipRow, MicButton, TrendCard, ShopeeCompareCard
 *   - Organisms: ChartCard + ChartLine (main) + ChartBar + ChartDonut (supplementary
 *                per Task Pack §2.2 — ensures all 3 chart types covered)
 *
 * Per TASKLIST: "I07 → state-C-chart-line (ChartCard + ChartLine + DrillChipRow + MicButton)"
 * Per Task Pack: ChartBar + ChartDonut added as supplementary instances for coverage.
 */
'use client';

import { useState } from 'react';
import { PhoneFrame, AppHeader } from '@/components/icp/layout';
import { StatPill, MiniSparkline, StatusBar } from '@/components/icp/atoms';
import {
  DrillChipRow,
  MicButton,
  TrendCard,
  ShopeeCompareCard,
  type DrillChip,
} from '@/components/icp/molecules';
import { ChartCard, ChartLine, ChartBar, ChartDonut } from '@/components/icp/organisms';

const DRILL_CHIPS: DrillChip[] = [
  { id: '7d', label: '7 ngày', active: true },
  { id: '30d', label: '30 ngày' },
  { id: '90d', label: '90 ngày' },
  { id: 'all', label: 'Tất cả' },
];

const LINE_DATA = Array.from({ length: 30 }, (_, i) => ({
  x: i,
  y: 20 + i * 1.5 + Math.sin(i * 0.4) * 8,
}));

const BAR_DATA = [
  { label: 'T2', value: 45 },
  { label: 'T3', value: 62 },
  { label: 'T4', value: 38 },
  { label: 'T5', value: 71 },
  { label: 'T6', value: 55 },
  { label: 'T7', value: 88 },
  { label: 'CN', value: 92 },
];

const DONUT_SEGMENTS = [
  { label: 'Sữa', value: 45 },
  { label: 'Bánh', value: 30 },
  { label: 'Đồ uống', value: 25 },
];

const SPARKLINE_RISING = Array.from({ length: 12 }, (_, i) => 10 + i * 1.5);

export default function IntentSevenPage() {
  const [activeChip, setActiveChip] = useState('7d');

  return (
    <PhoneFrame mode="app">
      {/* A9 patch: sticky header per mode="app" page scroll fix */}
      <div className="sticky top-0 z-10 bg-icp-bg-page">
        <StatusBar />
        <AppHeader
          title="Phân tích dữ liệu"
          subtitle="đang trợ giúp · cập nhật real-time"
          live
          onBack={() => alert('Back')}
          onAction={() => alert('Menu')}
        />
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill
            value="+45%"
            label="Tăng trưởng"
            accent="green"
            sparkline={<MiniSparkline data={SPARKLINE_RISING} accent="green" width={70} height={18} />}
          />
          <StatPill value="12k" label="Đơn hàng" accent="pink" />
          <StatPill value="98%" label="Chính xác" accent="amber" />
        </div>

        {/* Drill chips */}
        <DrillChipRow
          chips={DRILL_CHIPS.map((c) => ({ ...c, active: c.id === activeChip }))}
          onSelect={setActiveChip}
        />

        {/* Main chart — ChartCard wrapping ChartLine (per state-C-chart-line) */}
        <ChartCard
          title="Doanh thu"
          meta={`${activeChip === '7d' ? '7' : activeChip === '30d' ? '30' : '90'} ngày qua`}
          tag={{ label: 'DOANH THU', color: 'pink' }}
          live
        >
          <ChartLine
            data={LINE_DATA}
            accent="pink"
            gradientIdSuffix="i07-revenue-main"
            ariaLabel={`Doanh thu ${activeChip}`}
          />
        </ChartCard>

        {/* Supplementary chart 1 — ChartBar (orders by day) */}
        <ChartCard
          title="Đơn hàng theo ngày"
          meta="7 ngày qua"
          tag={{ label: 'ĐƠN HÀNG', color: 'green' }}
        >
          <ChartBar
            data={BAR_DATA}
            accent="green"
            gradientIdSuffix="i07-orders-bar"
            ariaLabel="Đơn hàng theo ngày 7 ngày qua"
            showValues
          />
        </ChartCard>

        {/* Supplementary chart 2 — ChartDonut (category distribution) */}
        <ChartCard
          title="Phân bố ngành hàng"
          meta="Tháng này"
          tag={{ label: 'NGÀNH HÀNG', color: 'amber' }}
        >
          <ChartDonut
            segments={DONUT_SEGMENTS}
            ariaLabel="Phân bố ngành hàng tháng này"
            centerLabel={
              <div className="text-center">
                <div className="text-xl font-bold text-icp-rose-700 font-mono">100%</div>
                <div className="text-[10px] text-icp-text-muted uppercase tracking-wider">Tổng</div>
              </div>
            }
          />
        </ChartCard>

        {/* Trend + market compare cards */}
        <TrendCard
          delta={45}
          sparklineData={Array.from({ length: 15 }, (_, i) => 10 + i * 2)}
          label="GOOGLE TRENDS"
          subtitle="Tăng vọt 7 ngày qua"
          chips={[{ label: 'sữa chua', delta: 45 }, { label: 'men sống', delta: 32 }]}
          onExpand={() => alert('S-07 expanded')}
        />

        <ShopeeCompareCard
          userPrice={62000}
          priceMin={55000}
          priceMax={75000}
          priceMedian={65000}
          onExpand={() => alert('S-07 expanded')}
        />

        {/* Voice CTA bottom-right floating */}
        <div className="flex justify-center pt-2 pb-6">
          <MicButton
            state="idle"
            size="compact"
            onTap={() => alert('Bắt đầu nói')}
            ariaLabel="Bắt đầu hỏi AI"
          />
        </div>
      </div>
    </PhoneFrame>
  );
}
