'use client';

/**
 * apps/web/components/icp/molecules/CartAIHintBubble.tsx
 *
 * Molecule: <CartAIHintBubble> — brain icon + dynamic AI hint message + status dot
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-0-happy.html line 115-141 (green/ready)
 *           docs/mockups/intent-05/intent-05-state-A-loading.html line 132-156 (amber/loading)
 *           docs/mockups/intent-05/intent-05-state-C-update-qty.html line 136-160 (amber/syncing)
 *           docs/mockups/intent-05/intent-05-state-E-stock-issue.html line 136-145 (red/issue —
 *           replaced by <StockIssueAlert> in state-E; this bubble hidden in that state)
 *
 * Reach:    I05 cart page top-of-list (single-intent).
 *
 * Decisions applied:
 * - C-22 atom reuse: <BrainIcon size={36}> direct (numeric → md tier per BrainIcon.tsx:44-49).
 *   `animated` defaults to tier-based (md tier = no halo by default; explicit prop overrides).
 * - C-15 'use client': no interactivity but parent may pass ReactNode children.
 * - C-23 atom bypass: inline gradient bg + border styles (mockup line 117 unique
 *   `linear-gradient(135deg, #FFFFFF, #FEF3F8)` not in design tokens).
 *
 * Status dot variants per handoff §B4:
 *   - 'green'  (default) — cart loaded happy state-0 mockup line 139
 *   - 'amber'  — sync in progress / loading state-A/C
 *   - 'red'    — error overlay (rarely used; state-E uses dedicated StockIssueAlert)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { BrainIcon } from '@/components/icp/atoms';

export interface CartAIHintBubbleProps {
  /** Hint copy — accepts plain string or ReactNode for inline emphasis. */
  message: React.ReactNode;
  /** Status indicator color — defaults to 'green' for ready state. */
  dotVariant?: 'green' | 'amber' | 'red';
  className?: string;
}

export const CartAIHintBubble = React.forwardRef<HTMLDivElement, CartAIHintBubbleProps>(
  ({ message, dotVariant = 'green', className }, ref) => {
    const dotColor =
      dotVariant === 'green'
        ? 'bg-icp-green-500'
        : dotVariant === 'amber'
          ? 'bg-icp-amber-500'
          : 'bg-icp-rose-600';

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-2.5 items-start',
          'bg-gradient-to-br from-white to-icp-pink-50',
          'border-[0.5px] border-icp-pink-200 rounded-2xl',
          'px-3 py-2.5',
          'shadow-[0_4px_12px_rgba(233,30,99,0.08)]',
          className
        )}
        role="status"
      >
        <div className="flex-shrink-0 relative">
          <BrainIcon size={36} animated />
          {/* Status dot - bottom-right corner of brain */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
              dotColor
            )}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 text-[12px] text-icp-pink-900 leading-[1.5] font-medium">
          {message}
        </div>
      </div>
    );
  }
);
CartAIHintBubble.displayName = 'CartAIHintBubble';
