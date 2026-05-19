'use client';

/**
 * ConversationBubble — AI/User chat bubble for I01/I02/I07 chat threads.
 *
 * 7 variants × 2 roles (ai/user). Composes T02 atoms (Avatar, BrainIcon).
 * Includes PRIVATE VoiceWave sub-element rendered inline when role='user'
 * with voiceMeta.showVoiceWave (per audit Q4 — VoiceWave belongs to
 * user-bubble-meta, NOT MicButton).
 *
 * Mockup evidence:
 * - I02-A live-cursor pattern (lines 332)
 * - I02-B user-bubble-meta + partial-badge (lines 318-323)
 * - I02-C .ai-note-bubble (line 406)
 * - I02-D .clarify-bubble (line 178) + user-bubble-meta flat
 * - I02-E .success-bubble (line 91), .suggest-bubble (line 157)
 * - I02-F .empty-bubble (line 97, composite header+icon+title+quote+alt-cards)
 * - I07 .voice-wave inside user-bubble-meta (lines 484-489)
 *
 * SEMANTIC §2 merge group 1: 15 source classes (.ai-bubble*, .user-bubble*,
 * .ai-bubble-greet, etc.) merged via role+variant props.
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — no useRouter
 * - C-08/D-05 VN strings inline
 * - C-13 Omit 'role' (HTML element role attr conflicts with our prop)
 * - C-15 'use client' (Framer Motion entrance + meta callbacks; defensive)
 * - C-18 Tier 4 Tailwind utility inline + CVA — NO @layer components
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/icp/atoms';

export type ConversationBubbleVariant =
  | 'default'
  | 'greet'
  | 'note'
  | 'clarify'
  | 'success'
  | 'suggest'
  | 'empty';

export interface VoiceMeta {
  /** Duration string, mono font, e.g. "0:04" */
  duration?: string;
  /** Confidence ratio 0..1 → renders as "94%" or "96% rõ" */
  confidence?: number;
  /** Partial badge label, I02-B "⚡ Streaming" pattern */
  partialBadge?: string;
  /** Show 7-bar voice-wave inline (I07 pattern) */
  showVoiceWave?: boolean;
  /** Append blinking cursor "│" to text (I02-A/B streaming pattern) */
  liveCursor?: boolean;
}

// Bubble shape variants (color/bg/border). Variant prop drives this.
// User role bubble does not use variant (uses single user palette).
const aiBubbleVariants = cva(
  'flex-1 rounded-tl-[4px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border px-3.5 py-3 shadow-sm',
  {
    variants: {
      variant: {
        default: 'bg-white border-pink-200',
        greet: 'bg-white border-pink-200',
        note: 'bg-white border-pink-200 border-l-[3px] border-l-amber-400',
        clarify: 'bg-gradient-to-br from-amber-50 to-white border-amber-200 border-l-[3px] border-l-amber-500',
        success: 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200 border-l-[3px] border-l-emerald-500',
        suggest: 'bg-gradient-to-br from-pink-50 to-amber-50 border-pink-200',
        empty: 'bg-gradient-to-br from-white to-pink-50 border-pink-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface ConversationBubbleProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'role'>,
    VariantProps<typeof aiBubbleVariants> {
  /** REQUIRED — ai or user perspective */
  role: 'ai' | 'user';
  /** Bubble text (supports inline JSX with <strong> highlights) */
  text?: string | ReactNode;
  /** Optional uppercase name label tag */
  label?: string;
  /** Avatar slot — role='ai' defaults to <Avatar role='ai'>; role='user' typically omitted */
  avatar?: ReactNode;
  /** role='user' only — voice metadata sub-elements */
  voiceMeta?: VoiceMeta;
  /** role='ai' only — generic footer meta slot */
  meta?: ReactNode;
}

/** PRIVATE inline VoiceWave — 7 animated bars per I07 .voice-wave (lines 163-179) */
function VoiceWave() {
  // Heights from I07 .voice-wave:nth-child(1..7) rules
  const heights = [3, 6, 9, 5, 7, 4, 8];
  return (
    <span
      className="inline-flex items-end gap-px h-4 align-middle"
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-0.5 bg-white rounded-sm animate-pulse"
          style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </span>
  );
}

export const ConversationBubble = forwardRef<HTMLDivElement, ConversationBubbleProps>(
  function ConversationBubble(
    { role, variant = 'default', text, label, avatar, voiceMeta, meta, className, ...rest },
    ref
  ) {
    if (role === 'user') {
      return (
        <div
          ref={ref}
          className={cn('flex justify-end mb-3.5', className)}
          {...rest}
        >
          <div
            className="max-w-[80%] rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl px-3.5 py-3 text-white shadow-md"
            style={{
              background:
                'linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%)',
              boxShadow: '0 6px 16px rgba(233,30,99,0.3)',
            }}
          >
            {label && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-90">
                {label}
              </div>
            )}
            <div className="text-[13.5px] leading-[1.45] font-medium italic">
              {text}
              {voiceMeta?.liveCursor && (
                <span className="inline-block w-0.5 h-3.5 bg-white align-middle ml-0.5 animate-pulse" />
              )}
            </div>
            {voiceMeta && (
              <div className="flex items-center gap-2 text-[10px] mt-2 opacity-85 font-semibold">
                {voiceMeta.duration && (
                  <span className="font-mono">⏱ {voiceMeta.duration}</span>
                )}
                {voiceMeta.showVoiceWave && <VoiceWave />}
                {typeof voiceMeta.confidence === 'number' && (
                  <span className="bg-white/25 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    ✓ {Math.round(voiceMeta.confidence * 100)}%
                  </span>
                )}
                {voiceMeta.partialBadge && (
                  <span className="bg-white/25 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    {voiceMeta.partialBadge}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // role === 'ai'
    const aiAvatar = avatar ?? <Avatar role="ai" size="sm" />;

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-2 mb-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300',
          className
        )}
        {...rest}
      >
        {aiAvatar}
        <div className={aiBubbleVariants({ variant })}>
          {label && (
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-pink-700">
              {label}
            </div>
          )}
          {variant === 'greet' ? (
            <div className="text-[12.5px] leading-[1.5] font-medium text-rose-950">
              {text}
            </div>
          ) : (
            <div className="text-[12.5px] leading-[1.5] font-medium text-rose-950">
              {text}
            </div>
          )}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
      </div>
    );
  }
);
