'use client';

import { useState } from 'react';
import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { DrillChipRow, type DrillChip } from '@/components/icp/molecules';

const initialChips: DrillChip[] = [
  { id: 'all', label: 'Tất cả', active: true },
  { id: 'rev', label: 'Doanh thu' },
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'aov', label: 'Giá trị TB' },
  { id: 'cus', label: 'Khách hàng' },
  { id: 'cat', label: 'Danh mục' },
  { id: 'time', label: 'Thời gian' },
];

export default function DrillChipRowSmokePage() {
  const [chips, setChips] = useState(initialChips);

  const handleSelect = (id: string) => {
    setChips((prev) => prev.map((c) => ({ ...c, active: c.id === id })));
    console.log('Selected:', id);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="DrillChipRow" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-4">
            <h2 className="text-xs font-bold uppercase text-pink-700">Interactive — click chips</h2>
            <DrillChipRow chips={chips} onSelect={handleSelect} />

            <div className="bg-white/60 border border-pink-200 rounded-xl p-3 text-[12px] text-rose-950">
              <strong className="text-pink-700">Selected:</strong>{' '}
              {chips.find((c) => c.active)?.label ?? '(none)'}
            </div>

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Static — first active</h2>
            <DrillChipRow
              chips={[
                { id: '1', label: 'Tuần này', active: true },
                { id: '2', label: 'Tháng này' },
                { id: '3', label: 'Quý này' },
                { id: '4', label: 'Năm nay' },
              ]}
            />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
