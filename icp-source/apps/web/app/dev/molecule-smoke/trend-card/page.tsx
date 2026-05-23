'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { TrendCard } from '@/components/icp/molecules';

const sampleSparkline = [12, 14, 13, 18, 22, 24, 28, 32, 38, 42, 45, 48];

export default function TrendCardSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="TrendCard (compact)" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-3">
            <h2 className="text-xs font-bold uppercase text-pink-700">Compact + chips + expand</h2>
            <TrendCard
              delta={45}
              sparklineData={sampleSparkline}
              subtitle="+45% nhu cầu 90 ngày qua"
              chips={[
                { label: 'nước mắm Phú Quốc', delta: 28 },
                { label: 'hữu cơ', delta: 15 },
                { label: 'túi tiện lợi', delta: 8 },
              ]}
              onExpand={() => console.log('Expand TrendCard')}
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Compact only (no chips)</h2>
            <TrendCard
              delta={12}
              sparklineData={[8, 10, 9, 11, 12, 11, 13, 12]}
              subtitle="+12% nhu cầu 30 ngày"
              onExpand={() => console.log('Expand smaller')}
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Negative delta (falling)</h2>
            <TrendCard
              delta={-23}
              sparklineData={[42, 38, 32, 28, 22, 18, 14, 10]}
              subtitle="-23% nhu cầu 60 ngày"
              chips={[
                { label: 'túi vải', delta: -8 },
                { label: 'không nhãn hiệu', delta: -12 },
              ]}
            />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
