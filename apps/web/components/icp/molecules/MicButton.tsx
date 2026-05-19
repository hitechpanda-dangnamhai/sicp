'use client';

/**
 * MicButton — Microphone trigger button. Wraps <OrbPulse> atom T02
 * (per audit Q4) — composes, does NOT re-implement 23 orb classes.
 *
 * 2 sizes per mockup evidence:
 * - 'compact' (I02-state-0): 130×130 mic-btn within wrapper, sm OrbPulse
 * - 'voice-stage' (I02-state-A): 180×180 orb-core within wrapper, lg OrbPulse
 *
 * 4 states map to OrbPulse atom states:
 * - idle/listening/error → identical names
 * - processing → 'analyzing' (OrbPulse nomenclature per T02)
 *
 * VoiceWave is NOT a sub-element of MicButton (per audit Q4) — it lives
 * inline inside ConversationBubble user-bubble-meta when voiceMeta.showVoiceWave.
 *
 * Decisions applied:
 * - C-07 navigation-agnostic — onTap callback only
 * - C-13 Omit 'size' defensive (ButtonHTMLAttributes 'size' is for input
 *   but defensive pattern locked T02 precedent)
 * - C-15 'use client' (onClick handler)
 * - D-04 Hybrid animation — OrbPulse atom contains CSS-only loops (pulseRing,
 *   orbBreathe, glow); Framer Motion not needed at this layer (atom handles it)
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { OrbPulse, Icon } from '@/components/icp/atoms';

export type MicButtonState = 'idle' | 'listening' | 'processing' | 'error';
export type MicButtonSize = 'compact' | 'voice-stage';

export interface MicButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  /** REQUIRED — mic recording state */
  state: MicButtonState;
  /** Display size — 'compact' for inline mic (I02-state-0 130×130 wrapper),
   * 'voice-stage' for full voice modal (I02-state-A 280×280 wrapper) */
  size?: MicButtonSize;
  /** Click callback (C-07 — caller decides routing/SSE start) */
  onTap?: () => void;
  /** ARIA label override (default Vietnamese per D-05) */
  ariaLabel?: string;
}

// Map MicButton states → OrbPulse atom states (T02 nomenclature)
const stateMap: Record<MicButtonState, 'idle' | 'listening' | 'analyzing' | 'error'> = {
  idle: 'idle',
  listening: 'listening',
  processing: 'analyzing',
  error: 'error',
};

const stateMicIcon: Record<MicButtonState, 'mic' | 'mic-off'> = {
  idle: 'mic',
  listening: 'mic',
  processing: 'mic',
  error: 'mic-off',
};

export const MicButton = forwardRef<HTMLButtonElement, MicButtonProps>(
  function MicButton(
    { state, size = 'compact', onTap, ariaLabel = 'Bấm để nói', className, ...rest },
    ref
  ) {
    const orbSize = size === 'voice-stage' ? 'lg' : 'sm';
    const iconSize = size === 'voice-stage' ? 56 : 28;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onTap}
        aria-label={ariaLabel}
        aria-pressed={state === 'listening'}
        disabled={state === 'processing'}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full',
          'bg-transparent border-0 p-0',
          'disabled:cursor-not-allowed',
          'transition-transform active:scale-95',
          className
        )}
        {...rest}
      >
        <OrbPulse
          state={stateMap[state]}
          size={orbSize}
          icon={
            <Icon
              name={stateMicIcon[state]}
              size={iconSize}
              className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
            />
          }
        />
      </button>
    );
  }
);
