'use client';

/**
 * apps/web/app/dev/organism-smoke/chart-card/page.tsx
 *
 * Dev preview — visual smoke for <ChartCard> organism with 3 chart children.
 * Slice: S-01 T06 AC-21.
 *
 * Demonstrates:
 * - Pure slot API (Amendment 1) — children = ChartLine | ChartBar | ChartDonut
 * - live=true indicator (Tailwind animate-pulse per Q-Final-A)
 * - phases prop C-04 cross-render with PhasesCard mode='card'
 * - onExpandedChange callback C-28 uncontrolled state
 */

import { useState } from 'react';
import { PhoneFrame, AppHeader, MainScroll } from '@/components/icp/layout';
import { ChartCard, ChartLine, ChartBar, ChartDonut } from '@/components/icp/organisms';

export default function ChartCardSmokePage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleExpand = (id: string) => (open: boolean) => {
    setExpanded((prev) => ({ ...prev, [id]: open }));
  };

  return (
    <main className="min-h-screen bg-icp-bg-page p-6 flex justify-center">
      <PhoneFrame mode="chat">
        <AppHeader title="ChartCard smoke" subtitle="3 chart embed examples" live />
        <MainScroll>
          <div className="flex flex-col gap-3">
            {/* Line chart embed + live indicator */}
            <ChartCard
              title="Doanh thu 30 ngày"
              meta="Cập nhật mỗi giờ"
              tag={{ label: 'DOANH THU', color: 'pink' }}
              live
              defaultExpanded={expanded['line']}
              onExpandedChange={handleExpand('line')}
            >
              <ChartLine
                data={[
                  { x: 0, y: 12 },
                  { x: 1, y: 18 },
                  { x: 2, y: 15 },
                  { x: 3, y: 22 },
                  { x: 4, y: 19 },
                  { x: 5, y: 28 },
                  { x: 6, y: 32 },
                ]}
                accent="rose"
                gradientIdSuffix="revenue-30d"
                ariaLabel="Doanh thu 30 ngày qua, xu hướng tăng"
              />
            </ChartCard>

            {/* Bar chart embed + phases cross-render (C-04) */}
            <ChartCard
              title="Đơn hàng theo ngày"
              meta="7 ngày qua"
              tag={{ label: 'ĐƠN HÀNG', color: 'amber' }}
              phases={[
                { id: 'fetch', label: 'Tải dữ liệu', status: 'done' },
                { id: 'compute', label: 'Tính toán', status: 'done' },
                { id: 'render', label: 'Hiển thị', status: 'active' },
              ]}
              phasesHeader={{ icon: 'sparkles', title: 'Đang phân tích' }}
            >
              <ChartBar
                data={[
                  { label: 'T2', value: 12 },
                  { label: 'T3', value: 18 },
                  { label: 'T4', value: 8 },
                  { label: 'T5', value: 22 },
                  { label: 'T6', value: 28 },
                  { label: 'T7', value: 35 },
                  { label: 'CN', value: 14 },
                ]}
                accent="pink"
                gradientIdSuffix="orders-7d"
                showValues
              />
            </ChartCard>

            {/* Donut chart embed + centerLabel */}
            <ChartCard title="Phân loại sản phẩm" meta="Tỷ trọng theo doanh thu">
              <ChartDonut
                segments={[
                  { label: 'Sữa', value: 45 },
                  { label: 'Bánh', value: 28 },
                  { label: 'Đồ uống', value: 18 },
                  { label: 'Khác', value: 9 },
                ]}
                width={180}
                height={180}
                innerRadius={48}
                centerLabel={
                  <>
                    <span className="text-[20px] font-bold text-icp-pink-900 font-mono">100%</span>
                    <span className="text-[10px] text-icp-pink-700">Tổng</span>
                  </>
                }
              />
            </ChartCard>
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
