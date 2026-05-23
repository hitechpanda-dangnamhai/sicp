/**
 * apps/web/components/icp/organisms/ConversationThread.tsx
 *
 * Organism: <ConversationThread> — ordered list of <ConversationBubble> for chat scenes
 *
 * Slice:    S-01 UI Foundation
 * Task:     T06 AC-1
 *
 * Source:   intent-02-state-0-mic-idle.html / state-A-listening.html / state-G-error.html
 *           `.thread` container pattern + ConversationBubble children
 *           SEMANTIC_COMPONENTS Section 6.3 organism row 1
 *
 * Reach:    I02 chat thread (S-08 V-SLICE primary), I07 conversation segment (S-10),
 *           I01 chat-style state-C suggestions (S-07 secondary)
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — no useRouter; pure compose
 * - C-08 + D-05 — no UI strings owned (bubble text passed in via bubbles prop)
 * - C-13 N/A — no CVA variant collision (no CVA at all)
 * - C-15 SERVER — pure compose, no event handlers attached
 * - C-18 Tier 4 Tailwind utility inline (no @layer components)
 * - C-22 atom interface verified — composes T04 ConversationBubble (props role, variant,
 *   text, label, avatar, voiceMeta, meta) per Phiên 18 DISCOVER
 *
 * Pre-classification per C-24: SINGLE-INTENT ≤300 LOC standard
 * (1/3 qualifier: V-SLICE reuse ≥2 borderline I02+I07; states <3; slots <5)
 *
 * Public API:
 *   <ConversationThread bubbles={[{role: 'ai', text: '...', ...}, ...]}>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ConversationBubble, type ConversationBubbleProps } from '@/components/icp/molecules';

export interface ConversationThreadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Ordered list of bubbles rendered top-to-bottom in chat thread order. */
  bubbles: Array<ConversationBubbleProps & { id?: string | number }>;
  /** Optional gap override between bubbles (default Tailwind gap-0 — each bubble owns mb-3.5) */
  gap?: 'tight' | 'normal' | 'loose';
}

const GAP_CLASS: Record<NonNullable<ConversationThreadProps['gap']>, string> = {
  tight: 'space-y-2',
  normal: '', // default — each ConversationBubble owns mb-3.5
  loose: 'space-y-4',
};

export const ConversationThread = React.forwardRef<HTMLDivElement, ConversationThreadProps>(
  ({ bubbles, gap = 'normal', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-full', GAP_CLASS[gap], className)}
        role="log"
        aria-live="polite"
        aria-label="Cuộc trò chuyện"
        {...props}
      >
        {bubbles.map((bubble, index) => {
          const { id, ...bubbleProps } = bubble;
          return <ConversationBubble key={id ?? index} {...bubbleProps} />;
        })}
      </div>
    );
  },
);
ConversationThread.displayName = 'ConversationThread';
