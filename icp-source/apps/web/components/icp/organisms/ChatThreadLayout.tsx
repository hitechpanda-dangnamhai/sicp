/**
 * apps/web/components/icp/organisms/ChatThreadLayout.tsx
 *
 * Organism: <ChatThreadLayout> — full chat scaffold one-import composition
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-2
 *
 * Source:   intent-02-state-0-mic-idle.html full layout reference (PhoneFrame +
 *           TopBar + MainScroll + Thread + BottomBar)
 *           SEMANTIC_COMPONENTS Section 6.3 organism row 2
 *           PHASE_00_HANDOFF Section "Component extraction priorities" Organism row 1:
 *           "<ChatThreadLayout> (header + chat-area + bottom-bar) — Intent 02/03/04/07 reuse"
 *
 * Reach:    I01/I02/I07 chat-style intents — SERVER-friendly composition wrapper
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onBack callback only
 * - C-08 + D-05 VN inline — title prop hardcoded by consumer
 * - C-15 SERVER — pure compose, no event handlers in self; children atoms are CLIENT
 *   per T02/T03 distribution (handlers bubble up via prop drilling)
 * - C-18 Tier 1 LAW — wraps PhoneFrame/MainScroll/BottomBar T01 base classes via T03 layout primitives
 * - C-22 atom interface verified — composes T03 PhoneFrame/TopBar/MainScroll/BottomBar
 *   + this-task ConversationThread
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC standard
 * (1/3 qualifier: states <3; slots 4; reuse 3 V-SLICE = ≥2 but FAIL on states+slots)
 *
 * Public API:
 *   <ChatThreadLayout
 *     title="Chat với Aida"
 *     onBack={() => router.back()}
 *     bubbles={[{role: 'ai', text: '...'}, ...]}
 *     bottomCta={<Button variant="pink-grad">Gửi</Button>}
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PhoneFrame, TopBar, MainScroll, BottomBar } from '@/components/icp/layout';
import { ConversationThread, type ConversationThreadProps } from './ConversationThread';

export interface ChatThreadLayoutProps {
  /** Header title (VN per D-05) */
  title?: string;
  /** Back button callback per C-07 */
  onBack?: () => void;
  /** Optional right-side action slot in TopBar */
  topAction?: React.ReactNode;
  /** Bubbles passed through to ConversationThread */
  bubbles: ConversationThreadProps['bubbles'];
  /** Optional gap setting forwarded to ConversationThread */
  gap?: ConversationThreadProps['gap'];
  /** Bottom CTA slot — typically <Button> or stack of buttons */
  bottomCta?: React.ReactNode;
  /** Optional className passthrough to PhoneFrame */
  className?: string;
  /** Optional content rendered above the thread (e.g., a banner or notice) */
  beforeThread?: React.ReactNode;
  /** Optional content rendered below the thread (e.g., live transcript) */
  afterThread?: React.ReactNode;
}

export function ChatThreadLayout({
  title,
  onBack,
  topAction,
  bubbles,
  gap = 'normal',
  bottomCta,
  className,
  beforeThread,
  afterThread,
}: ChatThreadLayoutProps) {
  const hasBottomBar = bottomCta != null;
  return (
    <PhoneFrame mode="chat" className={cn(className)}>
      {(title || onBack || topAction) && <TopBar title={title} onBack={onBack} action={topAction} />}
      <MainScroll noBottomPadding={!hasBottomBar}>
        {beforeThread}
        <ConversationThread bubbles={bubbles} gap={gap} />
        {afterThread}
      </MainScroll>
      {hasBottomBar && <BottomBar>{bottomCta}</BottomBar>}
    </PhoneFrame>
  );
}
