'use client';

/**
 * apps/web/components/icp/molecules/StockIssueAlert.tsx
 *
 * Molecule: <StockIssueAlert> — state-E top red banner notification
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-E-stock-issue.html line 137-146 verbatim
 *           (gradient white→rose + border-l 3px rose-600 + 36×36 alert icon + bold title + body)
 *
 * Reach:    I05 cart page state-E (single-intent feature molecule).
 *
 * Decisions applied:
 * - Pure presentational — no event handlers (top banner is informational only;
 *   actionable resolution is per-item via StockReplacementCard sibling).
 * - C-23 atom bypass: gradient bg + border-l unique inline (mockup line 137).
 * - C-15 NOT required: no client interactivity, but kept as 'use client' for
 *   barrel re-export consistency with other cart molecules.
 *
 * Sibling components in state-E:
 *   - <StockReplacementCard> — dashed-border AI replacement card per item
 *   - <CartItemRow stockIssue='out'> — red border-l on the out-of-stock row
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface StockIssueAlertProps {
  /**
   * Number of out-of-stock items detected by stock_issue_summary SSE. Used in
   * the bold header copy (e.g. "Có 1 món vừa hết hàng" / "Có 3 món vừa hết hàng").
   */
  outOfStockCount: number;
  /**
   * Body copy — BE-templated Vietnamese string from stock_issue_ready aggregated
   * names (e.g. "Em vừa kiểm tra kho, Chin-su 250g đã hết. Anh bỏ qua hoặc chọn
   * món thay thế nhé.") OR FE-generated when names need composition. Rendered as
   * plain string per Rule 6 mockup line 143.
   */
  message: string;
  className?: string;
}

export const StockIssueAlert = React.forwardRef<HTMLDivElement, StockIssueAlertProps>(
  ({ outOfStockCount, message, className }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex gap-2.5 items-start',
          'bg-gradient-to-br from-white to-icp-rose-50',
          'border-[0.5px] border-icp-rose-200',
          'border-l-[3px] border-l-icp-rose-600',
          'rounded-2xl px-3 py-2.5',
          'shadow-[0_4px_12px_rgba(220,38,38,0.1)]',
          className
        )}
      >
        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-icp-rose-100 to-icp-rose-200 rounded-[11px] flex items-center justify-center">
          <Icon name="alert-triangle" size={18} className="text-icp-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-icp-pink-900 font-bold mb-0.5">
            Có {outOfStockCount} món vừa hết hàng
          </div>
          <div className="text-[11px] text-icp-pink-700 leading-[1.45]">{message}</div>
        </div>
      </div>
    );
  }
);
StockIssueAlert.displayName = 'StockIssueAlert';
