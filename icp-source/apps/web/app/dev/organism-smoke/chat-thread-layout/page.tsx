'use client';

/**
 * apps/web/app/dev/organism-smoke/chat-thread-layout/page.tsx
 *
 * Dev preview — visual smoke for <ChatThreadLayout> organism (one-import composition).
 * Slice: S-01 T06 AC-20.
 */

import { ChatThreadLayout } from '@/components/icp/organisms';
import { Button } from '@/components/icp/atoms';

export default function ChatThreadLayoutSmokePage() {
  return (
    <main className="min-h-screen bg-icp-bg-page p-6 flex justify-center">
      <ChatThreadLayout
        title="Chat với Aida"
        onBack={() => alert('Back tapped')}
        bubbles={[
          { role: 'ai', text: 'Chào anh, em có thể giúp gì?', variant: 'greet' },
          { role: 'user', text: 'Em cần lời khuyên về sữa cho con' },
          {
            role: 'ai',
            text: 'Em đã chuẩn bị 3 gợi ý phù hợp với bé.',
            variant: 'default',
            label: 'Phân tích',
          },
        ]}
        bottomCta={
          <Button variant="pink-grad" size="lg" className="w-full">
            Xem sản phẩm
          </Button>
        }
      />
    </main>
  );
}
