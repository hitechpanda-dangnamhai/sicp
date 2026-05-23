'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { AIInsightCard } from '@/components/icp/molecules';

export default function AIInsightCardSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="AIInsightCard" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-4">
            <h2 className="text-xs font-bold uppercase text-pink-700">variant=&quot;default&quot; (I01-B rose+amber)</h2>
            <AIInsightCard
              text={
                <>
                  Sản phẩm này có thể bán giá <strong>40.000đ - 45.000đ</strong> để cạnh tranh trên Shopee.
                </>
              }
            />

            <AIInsightCard
              text={
                <>
                  Aida đã đọc <strong>12 trường thông tin</strong> từ ảnh với độ chính xác 98%.
                </>
              }
            />

            <h2 className="text-xs font-bold uppercase text-pink-700 mt-4">variant=&quot;reasoning&quot; (I01-H mint, structured)</h2>
            <AIInsightCard
              variant="reasoning"
              text={
                <>
                  Nhu cầu tăng <strong>45% trong 90 ngày</strong> chủ yếu nhờ trend cooking-tại-nhà. Đề xuất nhập thêm hàng cho Q4 vì mùa Tết sắp tới.
                </>
              }
            />

            <AIInsightCard
              variant="reasoning"
              tag="🤖 Aida phân tích"
              text={
                <>
                  Top 3 từ khóa rising: <strong>nước mắm Phú Quốc, hữu cơ, túi tiện lợi</strong>. Khách quan tâm chất lượng cao + đóng gói thân thiện.
                </>
              }
            />
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
