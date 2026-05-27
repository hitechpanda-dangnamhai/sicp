'use client';

/**
 * apps/web/components/icp/molecules/BrainCheckBadge.tsx
 *
 * Molecule: <BrainCheckBadge> — Brain mascot XL with green check-pop badge.
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-G-success.html` lines 245-310
 *           (per D-29 LAW Mockup filename is LAW)
 *
 * Adapted from `apps/web/components/icp/organisms/LoginSuccessTransition.tsx`
 * lines 119-216 (S-03 brain XL 180×180 + check-pop precedent). T02 extracts
 * the brain+check visual as a reusable molecule because:
 *   1. SuccessTransition (B2) consumes it (S-07 state-G)
 *   2. Future S-09 reco-confirm flow will reuse (forward-compat)
 *   3. Tests can render in isolation without auth-flow setup
 *
 * Decisions applied:
 * - **Q2 option 2 LOCK** (Phiên Sx07-F): Tách `BrainCheckBadge` riêng làm
 *   sub-molecule per Q2 HYBRID + BrainCheckBadge separate resolution
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — pure presentational, no router
 * - **C-15** 'use client' — uses CSS animations + dynamic size prop
 * - **C-18** Tier 4 Tailwind utility inline
 *
 * **Why 140×140 default (NOT 180×180 like LoginSuccessTransition):**
 * State-G success card layout has 3 stat-cells row + 2 CTAs + progress bar
 * + microcopy below — smaller brain (140px) keeps vertical compact. Tests
 * may inject larger size via prop for hero placements.
 *
 * Reach: S-07 V-SLICE state-G (SuccessTransition consumer);
 *        potentially reusable for S-08/S-09 success states.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BrainCheckBadgeProps {
  /** Size in px (default 140 per mockup state-G). */
  size?: number;
  /** Show the green check-pop badge bottom-right (default true). */
  showCheck?: boolean;
  /** Show the pulse-ring aura around the brain (default true). */
  showPulseRing?: boolean;
  /** Additional className passthrough for layout positioning. */
  className?: string;
  /** Accessible label for screen readers — set explicitly when used alone. */
  ariaLabel?: string;
}

export function BrainCheckBadge({
  size = 140,
  showCheck = true,
  showPulseRing = true,
  className,
  ariaLabel,
}: BrainCheckBadgeProps) {
  // Check badge sized proportionally — at 140px brain, check is 38px
  // (mockup state-G visual; LoginSuccessTransition used 48px at 180px brain).
  const checkSize = Math.round(size * 0.27);

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      {/* Pulse-ring aura — rgba(16,185,129,0.18) green per mockup */}
      {showPulseRing && (
        <div
          className="absolute -inset-3 rounded-full bg-[rgba(16,185,129,0.18)] animate-pulse-ring"
          aria-hidden="true"
        />
      )}

      {/* Brain SVG — viewBox 0 0 240 240 (LoginSuccessTransition precedent) */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox="0 0 240 240"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`bcb-core-${size}`} cx="40%" cy="35%">
              <stop offset="0%" stopColor="#FFE4E6" />
              <stop offset="60%" stopColor="#F9A8D4" />
              <stop offset="100%" stopColor="#BE185D" />
            </radialGradient>
            <radialGradient id={`bcb-aura-${size}`} cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(233,30,99,0.35)" />
              <stop offset="60%" stopColor="rgba(251,146,60,0.15)" />
              <stop offset="100%" stopColor="rgba(251,146,60,0)" />
            </radialGradient>
          </defs>
          {/* Aura halo */}
          <circle
            cx="120"
            cy="120"
            r="100"
            fill={`url(#bcb-aura-${size})`}
            style={{ animation: 'splash-brainGlow 3s ease-in-out infinite' }}
          />
          {/* Brain core */}
          <path
            d="M 77 104 Q 69 86 86 77 Q 94 65 111 70 Q 120 58 132 66 Q 154 62 158 85 Q 172 94 162 111 Q 172 128 158 140 Q 154 158 132 158 Q 120 172 108 158 Q 86 158 82 140 Q 69 128 77 111 Z"
            fill={`url(#bcb-core-${size})`}
            filter="drop-shadow(0 6px 16px rgba(190,24,93,0.4))"
          />
          {/* Brain folds (white strokes) */}
          <path
            d="M 94 86 Q 120 95 137 86 M 86 112 Q 120 120 154 112 M 94 137 Q 120 130 137 137 M 120 72 Q 120 95 120 112 M 102 86 Q 106 120 102 146 M 137 86 Q 134 120 137 146"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* Brain dots — synapse points */}
          <circle cx="94" cy="86" r="3" fill="#fff" />
          <circle cx="137" cy="86" r="3" fill="#fff" />
          <circle cx="120" cy="112" r="3" fill="#fff" />
          <circle cx="102" cy="137" r="3" fill="#fff" />
          <circle cx="137" cy="137" r="3" fill="#fff" />
          {/* Pulsing corner nodes */}
          <circle
            cx="34"
            cy="72"
            r="4.5"
            fill="#E91E63"
            style={{ animation: 'splash-nodePulse 2s ease-in-out infinite' }}
          />
          <circle
            cx="206"
            cy="86"
            r="4.5"
            fill="#FB923C"
            style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 0.5s' }}
          />
          <circle
            cx="32"
            cy="168"
            r="4.5"
            fill="#E91E63"
            style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1s' }}
          />
          <circle
            cx="206"
            cy="180"
            r="4.5"
            fill="#FB923C"
            style={{ animation: 'splash-nodePulse 2s ease-in-out infinite 1.5s' }}
          />
        </svg>

        {/* Check-pop badge bottom-right */}
        {showCheck && (
          <div
            className={cn(
              'absolute rounded-full flex items-center justify-center animate-check-pop',
              'bg-gradient-to-br from-[#10B981] to-[#059669]',
              'shadow-[0_8px_22px_rgba(16,185,129,0.5)]',
              'border-[3px] border-[#FFF8F0]',
            )}
            style={{
              width: checkSize,
              height: checkSize,
              bottom: Math.round(size * 0.04),
              right: Math.round(size * 0.04),
            }}
            aria-hidden="true"
          >
            <svg
              width={Math.round(checkSize * 0.55)}
              height={Math.round(checkSize * 0.55)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
