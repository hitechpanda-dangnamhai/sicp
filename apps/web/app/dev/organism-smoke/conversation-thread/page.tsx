/**
 * apps/web/app/dev/organism-smoke/conversation-thread/page.tsx
 *
 * Dev preview — visual smoke for <ConversationThread> organism.
 * Slice: S-01 T06 AC-19.
 *
 * Per C-14 (Next.js _ private folder routing precedent): /dev/ folder is dev-only,
 * not _underscore-prefixed since dev pages are exposed for /dev/* visual smoke.
 */

import { PhoneFrame, MainScroll, TopBar } from '@/components/icp/layout';
import { ConversationThread } from '@/components/icp/organisms';

export default function ConversationThreadSmokePage() {
  return (
    <main className="min-h-screen bg-icp-bg-page p-6 flex justify-center">
      <PhoneFrame mode="chat">
        <TopBar title="ConversationThread smoke" />
        <MainScroll>
          <ConversationThread
            bubbles={[
              { role: 'ai', text: 'Chào anh, em là Aida 👋', variant: 'greet' },
              { role: 'user', text: 'Em cần mua sữa tươi 1L cho cả tuần' },
              {
                role: 'ai',
                text: 'Em đã tìm được 3 lựa chọn phù hợp cho anh.',
                variant: 'default',
                label: 'Phân tích',
              },
              {
                role: 'user',
                text: 'Cảm ơn em',
                voiceMeta: {
                  duration: '0:03',
                  confidence: 0.96,
                  showVoiceWave: true,
                },
              },
              {
                role: 'ai',
                text: 'Anh muốn em thêm vào giỏ luôn không?',
                variant: 'suggest',
              },
            ]}
          />
        </MainScroll>
      </PhoneFrame>
    </main>
  );
}
