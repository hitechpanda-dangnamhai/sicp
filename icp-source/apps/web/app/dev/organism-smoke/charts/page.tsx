/**
 * apps/web/app/dev/organism-smoke/charts/page.tsx
 *
 * Dev preview — standalone chart SVG visual smoke (no ChartCard wrap).
 * Slice: S-01 T06 AC-22.
 *
 * Tests: 3 chart organisms render correctly as raw SVG with various accents.
 */

import { ChartLine, ChartBar, ChartDonut } from '@/components/icp/organisms';

export default function ChartsStandaloneSmokePage() {
  return (
    <main className="min-h-screen bg-icp-bg-page p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <header>
          <h1 className="text-xl font-bold text-icp-pink-900">Charts Standalone Smoke</h1>
          <p className="text-sm text-icp-pink-700 mt-1">Raw SVG renders for 3 chart organisms</p>
        </header>

        <section className="bg-white rounded-2xl p-4 border-[0.5px] border-icp-pink-200">
          <h2 className="text-sm font-bold text-icp-pink-900 mb-2">ChartLine — rose accent</h2>
          <ChartLine
            data={[
              { x: 0, y: 10 },
              { x: 1, y: 22 },
              { x: 2, y: 15 },
              { x: 3, y: 28 },
              { x: 4, y: 32 },
              { x: 5, y: 27 },
            ]}
            accent="rose"
            gradientIdSuffix="standalone-rose"
            ariaLabel="Doanh thu mẫu, xu hướng tăng"
          />
        </section>

        <section className="bg-white rounded-2xl p-4 border-[0.5px] border-icp-pink-200">
          <h2 className="text-sm font-bold text-icp-pink-900 mb-2">ChartLine — green accent (trend)</h2>
          <ChartLine
            data={[
              { x: 0, y: 5 },
              { x: 1, y: 8 },
              { x: 2, y: 12 },
              { x: 3, y: 18 },
              { x: 4, y: 25 },
              { x: 5, y: 35 },
            ]}
            accent="green"
            gradientIdSuffix="standalone-green"
            ariaLabel="Xu hướng tăng trưởng dương"
          />
        </section>

        <section className="bg-white rounded-2xl p-4 border-[0.5px] border-icp-pink-200">
          <h2 className="text-sm font-bold text-icp-pink-900 mb-2">ChartBar — orange accent + values</h2>
          <ChartBar
            data={[
              { label: 'Sữa', value: 45 },
              { label: 'Bánh', value: 32 },
              { label: 'Nước', value: 28 },
              { label: 'Trái cây', value: 18 },
              { label: 'Đồ ăn', value: 12 },
            ]}
            accent="orange"
            gradientIdSuffix="standalone-orange"
            showValues
            ariaLabel="Doanh thu theo loại sản phẩm"
          />
        </section>

        <section className="bg-white rounded-2xl p-4 border-[0.5px] border-icp-pink-200 flex items-center justify-center">
          <ChartDonut
            segments={[
              { label: 'Sữa', value: 40 },
              { label: 'Bánh', value: 25 },
              { label: 'Đồ uống', value: 20 },
              { label: 'Khác', value: 15 },
            ]}
            width={220}
            height={220}
            innerRadius={60}
            ariaLabel="Phân bổ doanh thu theo nhóm sản phẩm"
            centerLabel={
              <>
                <span className="text-[24px] font-bold text-icp-pink-900 font-mono">4</span>
                <span className="text-[11px] text-icp-pink-700">Nhóm hàng</span>
              </>
            }
          />
        </section>
      </div>
    </main>
  );
}
