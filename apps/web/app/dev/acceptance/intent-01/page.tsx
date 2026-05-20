/**
 * apps/web/app/dev/acceptance/intent-01/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I01 — Sell Recovery Chat (Bán Cứu)
 * State:   state-B-prefilled
 *
 * Reference mockup: docs/mockups/intent-01-sell-recovery-chat/state-B-prefilled.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="chat"), StatusBar, TopBar, MainScroll, BottomBar
 *   - Atoms: Button, Avatar, BrainIcon
 *   - Molecules: ConversationBubble, PhasesCard, ActionCard, AIInsightCard,
 *                ShopeeCompareCard, TrendCard
 *   - Organisms: ConversationThread (composes bubbles)
 *
 * Per TASKLIST line 358: "I01 → state-B-prefilled (most components: PhasesCard,
 * ShopeeCompareCard, TrendCard, BottomBar)"
 *
 * Decisions applied:
 * - C-14: `dev/` folder convention (not `__dev__/`)
 * - C-22: Atom interfaces verified — VN labels per C-08
 * - C-07: navigation-agnostic — alert() stubs cho prototype only
 *   (acceptance pages allowed useRouter per TASKLIST line 376; em dùng alert
 *   để tránh router setup overhead — KI-3 T06 lesson)
 */
'use client';

import {
  PhoneFrame,
  TopBar,
  MainScroll,
  BottomBar,
} from '@/components/icp/layout';
import { Button, StatusBar } from '@/components/icp/atoms';
import {
  ConversationBubble,
  PhasesCard,
  ActionCard,
  AIInsightCard,
  ShopeeCompareCard,
  TrendCard,
  type PhaseItem,
} from '@/components/icp/molecules';
import { ConversationThread } from '@/components/icp/organisms';

const PHASES_DONE: PhaseItem[] = [
  { id: '1', label: 'Nhận diện sản phẩm', meta: 'Gemini Vision · 1.4s', status: 'done' },
  { id: '2', label: 'Tra cứu giá thị trường', meta: 'Shopee API · 0.8s', status: 'done' },
  { id: '3', label: 'Phân tích đối thủ', meta: '5 cửa hàng · 2.1s', status: 'done' },
];

const SPARKLINE_RISING = Array.from({ length: 20 }, (_, i) => 10 + i * 1.8 + Math.sin(i * 0.5) * 3);

export default function IntentOnePage() {
  return (
    <PhoneFrame mode="chat">
      <StatusBar />
      <TopBar
        title="Phân tích sản phẩm"
        onBack={() => alert('Back to home')}
      />
      <MainScroll>
        <div className="py-4 space-y-3">
          <ConversationBubble
            role="ai"
            variant="greet"
            text="Em đã phân tích xong sản phẩm của anh."
          />

          <PhasesCard mode="list" phases={PHASES_DONE} />

          <ActionCard variant="price">
            <ActionCard.Header
              icon="tag"
              title="Giá đề xuất"
              subtitle="Cạnh tranh với 5 cửa hàng"
            />
            <ActionCard.Body highlight="65.000 ₫">
              Trung vị thị trường 62.000₫. Anh có thể tăng 3-5%.
            </ActionCard.Body>
            <ActionCard.DetailRow label="Min" value="58.000 ₫" />
            <ActionCard.DetailRow label="Max" value="72.000 ₫" />
          </ActionCard>

          <ShopeeCompareCard
            userPrice={62000}
            priceMin={55000}
            priceMax={75000}
            priceMedian={65000}
            onExpand={() => alert('Open S-07 expanded')}
          />

          <TrendCard
            delta={45}
            sparklineData={SPARKLINE_RISING}
            label="GOOGLE TRENDS"
            subtitle="Tăng vọt 7 ngày qua"
            chips={[
              { label: 'sữa chua', delta: 45 },
              { label: 'men sống', delta: 32 },
            ]}
            onExpand={() => alert('Open S-07 expanded')}
          />

          <AIInsightCard
            variant="reasoning"
            text={
              <>
                Sản phẩm có khả năng tăng trưởng cao trong 2 tuần tới. Em đề xuất{' '}
                <strong>tăng giá lên 65.000₫</strong> để tối ưu lợi nhuận.
              </>
            }
          />

          <ConversationThread
            bubbles={[
              { id: 'msg-1', role: 'user', text: 'OK, lưu lại nhé.' },
              { id: 'msg-2', role: 'ai', variant: 'success', text: 'Đã lưu sản phẩm thành công.' },
            ]}
          />
        </div>
      </MainScroll>
      <BottomBar>
        <Button variant="pink-grad" className="flex-1" onClick={() => alert('Lưu sản phẩm')}>
          Lưu sản phẩm
        </Button>
      </BottomBar>
    </PhoneFrame>
  );
}
