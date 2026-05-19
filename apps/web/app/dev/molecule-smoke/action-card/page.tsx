'use client';

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { ActionCard } from '@/components/icp/molecules';
import { ChipPill, Button, MiniSparkline } from '@/components/icp/atoms';
import { formatVND } from '@/lib/utils';

export default function ActionCardSmokePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-50 via-orange-50 to-rose-50">
      <PhoneFrame mode="chat">
        <TopBar title="ActionCard" />
        <MainScroll noBottomPadding>
          <div className="px-4 py-3 space-y-3">
            <h2 className="text-xs font-bold uppercase text-pink-700">7 variants</h2>

            <ActionCard variant="default">
              <ActionCard.Header icon="zap" title="Gợi ý mặc định" subtitle="Variant base" />
              <ActionCard.Body highlight="Đây là card mặc định của Aida với gợi ý đơn giản.">
                <ActionCard.DetailRow label="Trạng thái" value="Sẵn sàng" />
              </ActionCard.Body>
              <ActionCard.Actions>
                <Button variant="default" size="sm">Áp dụng</Button>
                <Button variant="ghost" size="sm">Bỏ qua</Button>
              </ActionCard.Actions>
            </ActionCard>

            <ActionCard variant="price">
              <ActionCard.Header icon="tag" title="Gợi ý giá" subtitle="Theo Shopee 5 cửa hàng" count={5} />
              <ActionCard.Body>
                <ActionCard.DetailRow label="Giá bạn" value={formatVND(45000)} />
                <ActionCard.DetailRow label="Trung vị" value={formatVND(38000)} />
                <ActionCard.DetailRow label="Đề xuất" value={formatVND(40000)} />
              </ActionCard.Body>
              <ActionCard.Actions>
                <Button variant="default" size="sm">Đổi giá</Button>
              </ActionCard.Actions>
            </ActionCard>

            <ActionCard variant="attrs">
              <ActionCard.Header icon="tag" title="Thuộc tính nhận diện" />
              <ActionCard.Body highlight="Aida đọc được 4 thuộc tính từ ảnh." />
              <ActionCard.Tags>
                <ChipPill variant="tag" color="rose" size="sm">500ml</ChipPill>
                <ChipPill variant="tag" color="rose" size="sm">Vị truyền thống</ChipPill>
                <ChipPill variant="tag" color="rose" size="sm">Thủy tinh</ChipPill>
                <ChipPill variant="tag" color="rose" size="sm">Maggi</ChipPill>
              </ActionCard.Tags>
            </ActionCard>

            <ActionCard variant="stock-up">
              <ActionCard.Header icon="trending-up" title="Nhập thêm hàng" subtitle="Nhu cầu tăng 90 ngày" />
              <ActionCard.Body
                highlight="Sản phẩm này đang RISING — nên nhập 30% nhiều hơn."
                miniChart={<MiniSparkline data={[10, 12, 14, 18, 22, 28, 35, 42]} accent="green" />}
                miniChartLabel="Xu hướng 90 ngày"
              />
              <ActionCard.Actions>
                <Button variant="default" size="sm">Tạo đơn nhập</Button>
              </ActionCard.Actions>
            </ActionCard>

            <ActionCard variant="wait">
              <ActionCard.Header icon="clock" title="Chờ đợt sau" subtitle="Nhu cầu giảm 45 ngày" />
              <ActionCard.Body
                highlight="Sản phẩm này đang FALLING — chưa cần nhập thêm."
                miniChart={<MiniSparkline data={[42, 38, 32, 28, 22, 18, 14, 10]} accent="amber" />}
                miniChartLabel="Xu hướng giảm"
              />
            </ActionCard>

            <ActionCard variant="alt">
              <ActionCard.Header icon="package" title="Sản phẩm thay thế" />
              <ActionCard.Body highlight="Bạn có thể cân nhắc thay bằng phiên bản túi 1.5L (rẻ hơn 20%)." />
            </ActionCard>

            <ActionCard variant="insight">
              <ActionCard.Header icon="sparkles" title="Insight đặc biệt" subtitle="Aida nhận định" />
              <ActionCard.Body highlight="Combo nước tương + dầu hào tăng 35% giỏ trung bình." />
            </ActionCard>
          </div>
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
