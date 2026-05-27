'use client';

/**
 * apps/web/components/icp/molecules/PreviousTurnChip.tsx
 *
 * Molecule: <PreviousTurnChip> — collapsed previous-turn chip pill for re-upload
 * state-F (mockup intent-04-state-F-reupload.html lines 207-215).
 *
 * Slice:    S-09 First Image-Based Product Recommendation (Intent 04)
 * Task:     T02 FE + wire (Phiên Sx09-F) — AC32
 *
 * Source:   docs/mockups/intent-04/intent-04-state-F-reupload.html lines 207-215
 *           ("Câu hỏi trước · 10 gợi ý mì cay" pill chip with leading gradient
 *           icon square + trailing arrow)
 *
 * Decisions applied:
 * - **D-S09-NN-B LAW**: ConversationTurn previousTurns[] consumer — each frozen
 *   turn renders one chip with summary "{count} gợi ý {category}".
 * - C-07 navigation-agnostic — onClick callback (parent scrolls to turn or
 *   re-displays its products).
 * - C-08 + D-05 VN inline — caller composes summary string.
 * - C-15 'use client' for onClick event handler.
 * - C-18 Tier 4 Tailwind utility inline.
 *
 * Public API:
 *   <PreviousTurnChip
 *     summary="10 gợi ý mì cay"
 *     onClick={() => scrollToTurn(turnId)}
 *     iconHint="soup"        // optional icon hint per category (decorative)
 *     gradient="linear-gradient(135deg, #DC2626, #F59E0B)"   // optional gradient
 *   />
 *
 * Reach: S-09 V-SLICE state-F re-upload only. Rendered once per item in
 *        previousTurns[] (typically 1-3 items demo session).
 */

import * as React from 'react';
import { Icon } from '@/components/icp/atoms';
import type { IconName } from '@/lib/icon-map';
import { cn } from '@/lib/utils';

export interface PreviousTurnChipProps {
  /**
   * Summary text after "Câu hỏi trước · " prefix (e.g., "10 gợi ý mì cay").
   * Caller composes from `turn.products.length` + `turn.detected.category`.
   */
  summary: string;
  /** Optional icon name for the leading gradient square. Defaults to 'image'. */
  iconHint?: IconName;
  /**
   * Optional CSS gradient string for the leading square background. Defaults
   * to the pink-orange brand gradient. Mockup line 209 uses
   * `linear-gradient(135deg, #DC2626, #F59E0B)` (red-amber for spicy mì).
   */
  gradient?: string;
  /** Click handler — typically scroll-to-turn or re-display previous products. */
  onClick?: () => void;
  className?: string;
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #E91E63, #FB923C)';

export function PreviousTurnChip({
  summary,
  iconHint = 'image',
  gradient = DEFAULT_GRADIENT,
  onClick,
  className,
}: PreviousTurnChipProps): React.ReactElement {
  return (
    <div className={cn('flex justify-center py-1', className)}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 bg-white border-[0.5px] border-icp-pink-200 rounded-2xl pl-2 pr-3 py-1.5 shadow-[0_4px_10px_rgba(233,30,99,0.08)] hover:bg-icp-pink-50 transition-colors"
      >
        <span
          className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center"
          style={{ background: gradient }}
        >
          <Icon name={iconHint} size={11} className="text-white" />
        </span>
        <span className="text-[10px] text-icp-rose-700 font-semibold">
          Câu hỏi trước · {summary}
        </span>
        <Icon name="arrow-right" size={13} className="text-icp-pink-700" />
      </button>
    </div>
  );
}
