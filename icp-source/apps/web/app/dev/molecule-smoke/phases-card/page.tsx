'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { PhasesCard, type PhaseItem } from '@/components/icp/molecules';

const listPhases: PhaseItem[] = [
  { id: '1', label: 'Tải ảnh lên', meta: '2.4 MB · 0.8s', status: 'done' },
  { id: '2', label: 'Đọc nhãn sản phẩm', meta: 'Gemini Vision · 1.4s', status: 'done' },
  { id: '3', label: 'Sinh dấu vân tay sản phẩm', meta: 'Embedding 1024 chiều...', status: 'active' },
  { id: '4', label: 'Phân tích thị trường', meta: 'Shopee + Google Trends · Chờ bước trước', status: 'pending' },
];

const cardPhases: PhaseItem[] = [
  { id: 'a', label: 'Phân tích dữ liệu', meta: 'SQL · 0.4s', status: 'done' },
  { id: 'b', label: 'Vẽ biểu đồ', meta: 'Recharts · ...', status: 'active' },
];

export default function PhasesCardSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="PhasesCard" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase text-pink-700 mb-2">mode=&quot;list&quot; (I01-A pattern)</h2>
              <PhasesCard mode="list" phases={listPhases} />
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase text-pink-700 mb-2">mode=&quot;card&quot; (I07 pattern)</h2>
              <PhasesCard
                mode="card"
                header={{
                  icon: 'loader',
                  title: 'Aida đang phân tích',
                  subtitle: '~2 giây nữa hoàn tất',
                }}
                phases={cardPhases}
              />
            </div>
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
