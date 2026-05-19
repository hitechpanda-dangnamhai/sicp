'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { ConversationBubble } from '@/components/icp/molecules';

export default function ConversationBubbleSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="ConversationBubble" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-1">
            <h2 className="text-xs font-bold uppercase text-pink-700 mt-2">AI variants</h2>

            <ConversationBubble role="ai" variant="default" text="Hi, đây là bubble default cho AI." />
            <ConversationBubble
              role="ai"
              variant="greet"
              text={
                <>
                  Xin chào! Bạn cần Aida giúp <strong>điều gì hôm nay</strong>?
                </>
              }
            />
            <ConversationBubble role="ai" variant="note" text="Đây là note bubble với warm marker." />
            <ConversationBubble
              role="ai"
              variant="clarify"
              text="Bạn muốn nói chai 500ml hay 1L?"
            />
            <ConversationBubble
              role="ai"
              variant="success"
              text={
                <>
                  Đã thêm <strong>3 sản phẩm</strong> vào giỏ.
                </>
              }
            />
            <ConversationBubble
              role="ai"
              variant="suggest"
              text="Có thể bạn cũng cần thêm chai dầu ăn 2L?"
            />
            <ConversationBubble
              role="ai"
              variant="empty"
              text={
                <>
                  Shop chưa có món này. Aida đoán bạn cần: <strong>nước mắm Phan Thiết 5L</strong>?
                </>
              }
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">User variants</h2>

            <ConversationBubble
              role="user"
              label="Bạn vừa nói"
              text="Cho tôi 2 chai nước tương Maggi"
              voiceMeta={{ duration: '0:04', confidence: 0.94 }}
            />

            <ConversationBubble
              role="user"
              label="Đang chuyển thành chữ"
              text="Cho tôi 2 chai nước tương Maggi, 1 thùng mì Hảo Hảo..."
              voiceMeta={{
                duration: '0:06',
                partialBadge: '⚡ Streaming',
                liveCursor: true,
              }}
            />

            <ConversationBubble
              role="user"
              text='"Aida ơi, cho anh xem doanh thu 30 ngày qua"'
              voiceMeta={{
                duration: '0:04',
                confidence: 0.96,
                showVoiceWave: true,
              }}
            />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
