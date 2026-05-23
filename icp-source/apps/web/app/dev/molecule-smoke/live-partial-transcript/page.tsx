'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { LivePartialTranscript } from '@/components/icp/molecules';

export default function LivePartialTranscriptSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="LivePartialTranscript" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-3">
            <h2 className="text-xs font-bold uppercase text-pink-700">Default — with cursor</h2>
            <LivePartialTranscript text="Cho tôi 2 chai nước tương Maggi và 1 thùng mì Hảo Hảo" />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Without cursor</h2>
            <LivePartialTranscript
              text="Cho tôi 2 chai nước tương Maggi"
              showCursor={false}
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Custom label + icon</h2>
            <LivePartialTranscript
              text="Doanh thu 30 ngày qua tăng bao nhiêu?"
              label="Đang nghe"
              icon="mic"
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">Short streaming partial</h2>
            <LivePartialTranscript text="Aida ơi, cho anh xem..." />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
