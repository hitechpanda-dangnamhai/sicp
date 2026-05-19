/**
 * apps/web/components/icp/layout/MainScroll.tsx
 *
 * Slice:    S-01 UI Foundation
 * Task:     T03 Layout Primitives
 *
 * Status:   NEW.
 *
 * Purpose:  Scroll container for Family A intents (I01/I02/I07). Wraps T01
 *           `.main-scroll` class which has flex: 1 + overflow-y: auto +
 *           padding: 8px 18px 130px (Bug 1 spacing rule — leave room for
 *           BottomBar 88px + buffer per CROSS_INTENT_PATTERNS §1 LOCKED).
 *
 * CSS strategy (per C-18 Tier 1 LAW):
 *   Wraps T01 `.main-scroll` class (baked @layer base in globals.css). Padding
 *   130px LAW per T01 + CROSS_INTENT_PATTERNS §1. NEVER redefine inline.
 *
 * Decisions applied:
 *   - C-15         — Client Component (forwardRef for scroll position detection
 *                    downstream T04+ molecules that may need scroll context)
 *   - C-16 RESOLVED — Default padding 130px (T01 LAW). Optional `noBottomPadding`
 *                    prop overrides via inline style for consumers without
 *                    <BottomBar> child (rare; resolves TASKLIST AC dòng 126
 *                    dynamic-padding spec vs T01 fixed-padding lock).
 *   - C-18 Tier 1   — wraps T01 class, NOT redefine
 *
 * Public API:
 *   <MainScroll noBottomPadding? className? ref?>
 *     children
 *   </MainScroll>
 */
'use client';

import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MainScrollProps {
  /**
   * When true, override T01 LAW padding-bottom (130px) to 0.
   * Use ONLY when consumer renders without <BottomBar> child.
   * Default: false (preserve T01 LAW per C-16).
   */
  noBottomPadding?: boolean;

  /** Optional consumer override for additional Tailwind classes. */
  className?: string;

  children: ReactNode;
}

export const MainScroll = forwardRef<HTMLDivElement, MainScrollProps>(
  function MainScroll({ noBottomPadding = false, className, children }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          // Tier 1 LAW base — flex: 1, overflow-y: auto, padding: 8px 18px 130px
          'main-scroll',
          className,
        )}
        // C-16 resolution — override T01 LAW padding-bottom ONLY when consumer
        // explicitly opts out (no <BottomBar> child). Use inline style to win
        // cascade vs @layer base specificity.
        style={noBottomPadding ? { paddingBottom: 0 } : undefined}
      >
        {children}
      </div>
    );
  },
);
