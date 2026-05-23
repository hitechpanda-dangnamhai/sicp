/**
 * apps/web/components/icp/atoms/BrainIcon.tsx
 *
 * Atom: <BrainIcon> — AI brand signature icon (resolves C-06)
 *
 * Slice:    S-01 UI Foundation
 * Task:     T02 AC-2
 *
 * Source:   .brain-aura + .brain-wrapper + inline brain SVG patterns
 *           Visual contract:
 *           - intent-01-state-0-capture.html L196-228 (lg with aura + pulse-rings)
 *           - intent-08-state-0-splash.html L78-130 (xl 240px hero with neural mesh)
 *           - ai-bubble avatar usage (md 32-40px) in I01/I02/I07
 *
 * Reach:    All Family A intents (I01/I02/I07/I08) + I04 recommend AI badge
 *
 * Decisions applied:
 * - C-06 (RESOLVED): 3 size tiers
 *     sm (16-24px): single-color outline using currentColor, no internal lobes
 *     md (32-40px): two-tone (pink gradient simplified, basic lobes), no animation
 *     lg (56-80px): full gradient + neural mesh + nodes + animate-glow halo
 *   Numeric size interpolates: <32→sm, 32-40→md, >40→lg
 * - D-04 hybrid animation — animate-glow (T01 keyframe) for lg default
 * - C-07 navigation-agnostic
 *
 * Implementation: 3 distinct SVG paths per tier — NOT scaled single SVG (per C-06
 * design rationale that small sizes need visual simplification, not just shrink).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

type SizeTier = 'sm' | 'md' | 'lg';

const SIZE_PIXEL_MAP: Record<SizeTier, number> = {
  sm: 20,
  md: 36,
  lg: 64,
};

/**
 * Resolve numeric size to tier per C-06 interpolation rules.
 */
function resolveTier(size: SizeTier | number): SizeTier {
  if (typeof size === 'string') return size;
  if (size < 32) return 'sm';
  if (size <= 40) return 'md';
  return 'lg';
}

export interface BrainIconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'> {
  /** Size tier or numeric pixel value (32-40 → md, <32 → sm, >40 → lg) */
  size?: SizeTier | number;
  /** Enable glow animation halo (default true for lg only, false otherwise) */
  animated?: boolean;
  /** Override pixel dimensions (rarely needed; size prop is preferred) */
  pixelSize?: number;
}

export const BrainIcon = React.forwardRef<SVGSVGElement, BrainIconProps>(
  ({ size = 'md', animated, pixelSize, className, ...props }, ref) => {
    const tier = resolveTier(size);
    const px = pixelSize ?? (typeof size === 'number' ? size : SIZE_PIXEL_MAP[tier]);
    const shouldAnimate = animated ?? tier === 'lg';

    // ===== sm tier: single-color outline using currentColor =====
    if (tier === 'sm') {
      return (
        <svg
          ref={ref}
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('inline-block flex-shrink-0', className)}
          role="img"
          aria-label="AI brain"
          {...props}
        >
          {/* Simplified brain silhouette — no internal lobes per C-06 */}
          <path d="M12 4c-2 0-3.5 1.2-4 3-1.5.2-2.5 1.5-2 3-.8.8-.8 2 0 3 .5 1.5 2 2 3 1.5.5 1.5 2 2.2 3 1.8.8 0 1.5-.5 2-1.2.5 0 1.2-.2 1.8-.5.5-.5 1-1.5.7-2.5.8-.5 1.2-1.5 1-2.5.8-.8.8-2 0-2.8C18 5.5 16.5 4 14 4c-.5-.8-1.2-1.2-2-1z" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    }

    // ===== md tier: two-tone gradient (pink), basic lobes visible =====
    if (tier === 'md') {
      return (
        <svg
          ref={ref}
          width={px}
          height={px}
          viewBox="0 0 40 40"
          fill="none"
          className={cn('inline-block flex-shrink-0', className)}
          role="img"
          aria-label="AI brain"
          {...props}
        >
          <defs>
            <linearGradient id={`brain-md-grad-${px}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--pink-400)" />
              <stop offset="100%" stopColor="var(--pink-700)" />
            </linearGradient>
          </defs>
          {/* Brain organic shape */}
          <path
            d="M20 6c-5 0-9 3-9.5 8-2 .8-3 3-2 5-1 1.5 0 4 2 5 .5 3 3.5 5 7 4.5C19 30 21 30 22.5 28.5c3.5.5 6.5-1.5 7-4.5 2-1 3-3.5 2-5 1-2 0-4.2-2-5C29 9 25 6 20 6z"
            fill={`url(#brain-md-grad-${px})`}
          />
          {/* Simplified mesh lines */}
          <path
            d="M14 14c4 1 8 1 12 0M14 22c4 1 8 1 12 0M20 8v22"
            stroke="#FFFFFF"
            strokeWidth="1"
            opacity="0.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    }

    // ===== lg tier: full gradient + neural mesh + nodes + animated halo =====
    return (
      <div className={cn('relative inline-block flex-shrink-0', shouldAnimate && 'animate-glow')} style={{ width: px, height: px }}>
        {/* Aura halo behind brain */}
        <div
          className="absolute inset-[-15%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(233,30,99,0.35) 0%, rgba(251,146,60,0.18) 50%, transparent 75%)',
          }}
          aria-hidden
        />
        <svg
          ref={ref}
          width={px}
          height={px}
          viewBox="0 0 120 120"
          fill="none"
          className={cn('relative z-[1]')}
          role="img"
          aria-label="AI brain"
          {...props}
        >
          <defs>
            <radialGradient id={`brain-lg-core-${px}`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFE4E6" />
              <stop offset="55%" stopColor="#F9A8D4" />
              <stop offset="100%" stopColor="#BE185D" />
            </radialGradient>
          </defs>
          {/* Brain organic shape */}
          <path
            d="M60 18 C42 18, 28 30, 26 46 C20 50, 18 58, 22 66 C20 74, 26 82, 36 84 C40 92, 50 96, 60 94 C70 96, 80 92, 84 84 C94 82, 100 74, 98 66 C102 58, 100 50, 94 46 C92 30, 78 18, 60 18 Z"
            fill={`url(#brain-lg-core-${px})`}
            stroke="#BE185D"
            strokeWidth="0.5"
            strokeOpacity="0.4"
            filter="drop-shadow(0 6px 14px rgba(190,24,93,0.35))"
          />
          {/* Neural mesh */}
          <path
            d="M60 28 Q55 45, 60 60 Q65 75, 60 88 M38 50 Q60 45, 82 50 M40 70 Q60 65, 80 70"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1"
            opacity="0.65"
            strokeLinecap="round"
          />
          {/* Synapse nodes */}
          <circle cx="60" cy="40" r="2.5" fill="#FFFFFF" />
          <circle cx="48" cy="58" r="2" fill="#FFFFFF" />
          <circle cx="72" cy="58" r="2" fill="#FFFFFF" />
          <circle cx="55" cy="76" r="2" fill="#FFFFFF" />
          <circle cx="68" cy="76" r="2" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }
);
BrainIcon.displayName = 'BrainIcon';
