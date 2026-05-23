/**
 * apps/web/app/dev/acceptance/intent-02/page.tsx
 *
 * Slice:   S-01 UI Foundation
 * Task:    T07 — Acceptance pages
 * Intent:  I02 — Voice Continue (Nói tiếp)
 * State:   state-C-cart-ready
 *
 * Reference: docs/mockups/intent-02-voice-continue/state-C-cart-ready.html
 *
 * Components composed:
 *   - Layout: PhoneFrame (mode="chat"), StatusBar, TopBar, MainScroll, BottomBar
 *   - Atoms: Button, StatusBar
 *   - Molecules: ConversationBubble, MicButton, ActionCard, LivePartialTranscript
 *   - Organisms: ConversationThread
 *
 * Per TASKLIST: "I02 → state-C-cart-ready (ConversationThread, MicButton, ActionCard)"
 */
'use client';

import { PhoneFrame, TopBar, MainScroll, BottomBar } from '@/components/icp/layout';
import { Button, StatusBar } from '@/components/icp/atoms';
import {
  MicButton,
  ActionCard,
  ConversationBubble,
} from '@/components/icp/molecules';
import { ConversationThread } from '@/components/icp/organisms';

export default function IntentTwoPage() {
  return (
    <PhoneFrame mode="chat">
      <StatusBar />
      <TopBar
        title="Nói tiếp"
        onBack={() => alert('Back')}
      />
      <MainScroll>
        <div className="py-4 space-y-3">
          <ConversationThread
            bubbles={[
              {
                id: 'b1',
                role: 'ai',
                variant: 'greet',
                text: 'Anh đã thêm sản phẩm vào giỏ. Còn muốn thêm gì không?',
              },
              {
                id: 'b2',
                role: 'user',
                text: 'Sữa chua Vinamilk 100g',
                voiceMeta: { duration: '0:03', confidence: 0.95, showVoiceWave: true },
              },
              {
                id: 'b3',
                role: 'ai',
                text: 'Em đã nhận diện.',
              },
            ]}
          />

          <ActionCard variant="stock-up">
            <ActionCard.Header icon="check" title="Đã thêm vào giỏ" count={3} />
            <ActionCard.Body>
              3 sản phẩm trong giỏ. Tổng tạm tính 56.000₫.
            </ActionCard.Body>
            <ActionCard.Actions>
              <Button variant="success" size="sm" className="flex-1" onClick={() => alert('Xem giỏ')}>
                Xem giỏ hàng
              </Button>
            </ActionCard.Actions>
          </ActionCard>

          <ConversationBubble
            role="ai"
            variant="suggest"
            text="Anh có thể nói tiếp để thêm sản phẩm khác."
          />
        </div>
      </MainScroll>
      <BottomBar>
        <div className="flex items-center gap-3 flex-1 justify-center">
          <MicButton
            state="idle"
            size="compact"
            onTap={() => alert('Bắt đầu nói')}
          />
          <Button variant="pink-grad" onClick={() => alert('Hoàn tất')}>
            Hoàn tất
          </Button>
        </div>
      </BottomBar>
    </PhoneFrame>
  );
}
