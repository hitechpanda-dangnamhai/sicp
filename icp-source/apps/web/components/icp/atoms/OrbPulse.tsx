/**
 * apps/web/components/icp/atoms/OrbPulse.tsx
 *
 * Atom: <OrbPulse> — voice/mic/AI orb with pulse rings + aura
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-10 (resolves SEMANTIC_COMPONENTS §0.3 orb fragmentation —
 *           23 source classes merged: orb-*, mic-*, brain-aura, err-orb-*, error-orb-*)
 *
 * Source:   Visual contracts:
 *           - intent-02-state-0-mic-idle.html L154-190 (.mic-wrapper + rings + btn) — idle state
 *           - intent-02-state-A-listening.html L150-185 (.orb-wrap + orb-glow + orb-core) — listening state
 *           - intent-04 recommend orb (analyzing pattern)
 *           - intent-01 brain-wrapper.aura (sm/md inline embed)
 *
 * Reach:    I01 hero orb, I02 mic record button, I04 recommend cycle, I07 voice analyze
 *
 * Decisions applied:
 * - C-06 N/A (BrainIcon is separate, OrbPulse may consume via icon prop)
 * - C-07 navigation-agnostic — pure visual; consumer attaches onClick at parent
 * - D-04 hybrid animation — CSS animate-pulse-ring (T01) + animate-glow + animate-shake
 *
 * States explained:
 *   idle:      pink gradient core + 2 pulseRings (T01 animate-pulse-ring) — intent-02 state-0
 *   listening: rose-red gradient core + 3 rings, faster animation, brighter aura — intent-02 state-A
 *   analyzing: orange-pink rotating shimmer + 2 rings — intent-01 analyzing phase
 *   error:     flat gray-maroon + shake animation, no rings — error recovery state
 *
 * Implementation: layered absolute positioning:
 *   - outer aura div (radial gradient bg with animate-glow)
 *   - N pulse ring divs (animate-pulse-ring, staggered delay)
 *   - core circle div (gradient bg + box-shadow + optional icon slot)
 *
 * No `<button>` wrapping — consumer wraps if interactive.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type SizeTier = 'sm' | 'md' | 'lg';
type OrbState = 'idle' | 'listening' | 'analyzing' | 'error';

const SIZE_PIXEL_MAP: Record<SizeTier, number> = {
  sm: 60,
  md: 120,
  lg: 180,
};

const CORE_SIZE_RATIO = 0.72;  // core circle is 72% of outer size

interface StateConfig {
  coreGradient: string;
  auraGradient: string;
  ringColor: string;
  shadow: string;
  animationClass: string;
  ringCount: number;
}

const STATE_CONFIG: Record<OrbState, StateConfig> = {
  idle: {
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #FFE4E6 25%, #F9A8D4 55%, #E91E63 100%)',
    auraGradient: 'radial-gradient(circle, rgba(233,30,99,0.30) 0%, rgba(251,146,60,0.15) 50%, transparent 75%)',
    ringColor: 'rgba(233,30,99,0.4)',
    shadow: '0 16px 36px rgba(233,30,99,0.45), inset 0 4px 12px rgba(255,255,255,0.3)',
    animationClass: '',
    ringCount: 2,
  },
  listening: {
    coreGradient: 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #FFE4E6 20%, #F9A8D4 50%, #E91E63 75%, #BE185D 100%)',
    auraGradient: 'radial-gradient(circle, rgba(233,30,99,0.4) 0%, rgba(251,146,60,0.2) 40%, transparent 70%)',
    ringColor: 'rgba(244,63,94,0.5)',
    shadow: '0 20px 50px rgba(233,30,99,0.55), inset 0 -10px 30px rgba(190,24,93,0.4), inset 0 10px 30px rgba(255,255,255,0.3)',
    animationClass: 'animate-glow',
    ringCount: 3,
  },
  analyzing: {
    coreGradient: 'linear-gradient(135deg, #E91E63 0%, #F43F5E 50%, #FB923C 100%)',
    auraGradient: 'radial-gradient(circle, rgba(251,146,60,0.35) 0%, rgba(233,30,99,0.20) 50%, transparent 75%)',
    ringColor: 'rgba(251,146,60,0.45)',
    shadow: '0 14px 32px rgba(251,146,60,0.4), inset 0 4px 12px rgba(255,255,255,0.25)',
    animationClass: 'animate-drift',
    ringCount: 2,
  },
  error: {
    coreGradient: 'radial-gradient(circle at 35% 35%, #CBD5E1 0%, #94A3B8 50%, #831447 100%)',
    auraGradient: 'radial-gradient(circle, rgba(131,20,71,0.25) 0%, transparent 60%)',
    ringColor: 'rgba(131,20,71,0.3)',
    shadow: '0 8px 20px rgba(131,20,71,0.3)',
    animationClass: 'animate-shake',
    ringCount: 0,
  },
};

export interface OrbPulseProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Size tier; default 'md' */
  size?: SizeTier;
  /** Orb state — controls core gradient + ring count + animation */
  state?: OrbState;
  /** Optional icon shown inside core (e.g., <Icon name="mic"> for mic button mode) */
  icon?: React.ReactNode;
  /** Override pulse ring count (defaults per state config) */
  pulseRings?: 0 | 1 | 2 | 3;
}

export const OrbPulse = React.forwardRef<HTMLDivElement, OrbPulseProps>(
  ({ size = 'md', state = 'idle', icon, pulseRings, className, ...props }, ref) => {
    const config = STATE_CONFIG[state];
    const outerPx = SIZE_PIXEL_MAP[size];
    const corePx = Math.round(outerPx * CORE_SIZE_RATIO);
    const rings = pulseRings ?? config.ringCount;

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center flex-shrink-0',
          className
        )}
        style={{ width: outerPx, height: outerPx }}
        role="img"
        aria-label={`AI orb ${state}`}
        {...props}
      >
        {/* Aura layer (radial bg) */}
        <div
          className={cn('absolute inset-0 rounded-full', config.animationClass)}
          style={{ background: config.auraGradient }}
          aria-hidden
        />

        {/* Pulse rings (staggered by delay) */}
        {Array.from({ length: rings }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-[10%] rounded-full border-[2px] animate-pulse-ring"
            style={{
              borderColor: config.ringColor,
              animationDelay: `${i * 0.8}s`,
            }}
            aria-hidden
          />
        ))}

        {/* Core circle */}
        <div
          className="relative z-[1] rounded-full inline-flex items-center justify-center"
          style={{
            width: corePx,
            height: corePx,
            background: config.coreGradient,
            boxShadow: config.shadow,
          }}
        >
          {icon ? <div className="text-white">{icon}</div> : null}
        </div>
      </div>
    );
  }
);
OrbPulse.displayName = 'OrbPulse';
