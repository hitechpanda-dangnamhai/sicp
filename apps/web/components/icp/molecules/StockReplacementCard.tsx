'use client';

/**
 * apps/web/components/icp/molecules/StockReplacementCard.tsx
 *
 * Molecule: <StockReplacementCard> — state-E dashed-border AI replacement suggestion
 *
 * Slice:    S-05 First Cart/Order Flow
 *           S-08 T02 EXTEND (Phiên Sx08-G) — +2 optional props for Intent 02 state-F
 *
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *           S-08 T02 (Phiên Sx08-G) — voice-buy state-F no-match replacement reuse (B10)
 *
 * Source:   docs/mockups/intent-05/intent-05-state-E-stock-issue.html line 271-293 verbatim
 *           (dashed border pink-200 + sparkles header + 48×48 thumbnail + product info +
 *            available_stock chip + "Thay" gradient CTA + refresh icon)
 *
 * Reach:    I05 cart page state-E sibling render to <CartItemRow stockIssue='out'>.
 *           S-08 NEW consumer: /intent-02 state-F no-match (reuse, NOT mockup .alt-card).
 *
 * Decisions applied (S-05 baseline preserved):
 * - D-S05-04 LAW: replacement candidate from stock_issue_ready SSE event payload.
 *   When replacement=null (LLM timeout or Vespa no-match), this molecule NOT rendered;
 *   parent shows only "Bỏ" CTA in CartItemRow's stockIssue banner.
 * - C-S05-J Path A: formatVNDCompact for unit_price + line total mockup parity.
 * - D-S05-04 LAW step 4: reason chip (Vietnamese ≤120 chars) optionally rendered
 *   below product info — falls back to "còn N chai" availability text when reason=null.
 * - C-23 atom bypass: dashed border + bg-gradient inline (mockup line 271).
 *
 * Decisions applied (S-08 T02 NEW — backward-compat tuyệt đối):
 * - MAR-1 Q2 LOCKED: Intent 02 state-F REUSES this S-05 component (dashed + sparkles
 *   header + thumbnail + "Thay" gradient CTA), NOT the mockup `.alt-card` layout
 *   (.alt-card superseded — bài học handoff cũ §5).
 * - +`similarityPct?` (handoff §3.B10 + §4): when present → render "~ {pct}%" badge
 *   near availability text. ⚠️ KNOWN-ISSUE (handoff §4 verify): typed SSE schema
 *   `SseStockIssueReadyEvent.replacement` does NOT yet carry `similarity_pct`
 *   (only {product_id,title,brand,unit_price,available_stock}). BE alt builder
 *   (buying_by_voices.py L975) computes `similarity_pct` but it is NOT in the Zod
 *   contract → page CANNOT pass it without a BE schema change. Prop implemented +
 *   optional so badge is ready the moment BE wraps the field. KHÔNG bịa số.
 * - +`ctaLabel?` (handoff §3.B10): override "Thay" → "Thêm vào giỏ" for state-F.
 * - All S-05 props/logic UNCHANGED (replacement / reason / onReplace / className).
 *   6 existing S-05 consumers remain backward-compatible.
 *
 * Caller usage (S-05):
 *   <StockReplacementCard
 *     replacement={stockReplacements[productId]}  // null skips render at parent
 *     reason={null}
 *     onReplace={() => sendAction('resolve_replace', {product_id, replacement_id})}
 *   />
 *
 * Caller usage (S-08 state-F):
 *   <StockReplacementCard
 *     replacement={mappedReplacement}
 *     ctaLabel="Thêm vào giỏ"
 *     // similarityPct omitted until BE wraps field in typed SSE (KNOWN-ISSUE)
 *     onReplace={() => postResolveReplace(rid, productId, replacementId, attemptN)}
 *   />
 */

import * as React from 'react';
import { cn, formatVNDCompact } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface StockReplacementCardProps {
  replacement: {
    productId: string;
    title: string;
    brand: string;
    unitPrice: number;
    availableStock: number;
  };
  /** Optional LLM reason from stock_issue_ready SSE; ≤120 chars Vietnamese per D-S05-04. */
  reason?: string | null;
  onReplace: () => void;
  className?: string;

  // ─── S-08 T02 NEW (Phiên Sx08-G per handoff §3.B10) ──────────────────────
  /**
   * Similarity percentage (0..100) → renders "~ {pct}%" badge near availability.
   * Only rendered when present. Sourced from BE alt builder similarity_pct
   * (handoff §4). NOTE: not yet in typed SseStockIssueReadyEvent schema — see
   * file header KNOWN-ISSUE. Optional so backward-compat preserved.
   */
  similarityPct?: number;
  /** Override CTA label "Thay" → e.g. "Thêm vào giỏ" (state-F). Defaults to "Thay". */
  ctaLabel?: string;
}

export const StockReplacementCard = React.forwardRef<HTMLDivElement, StockReplacementCardProps>(
  ({ replacement, reason, onReplace, similarityPct, ctaLabel, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mb-3.5 bg-gradient-to-br from-white to-icp-pink-50',
          'border-[0.5px] border-dashed border-icp-pink-200 rounded-[14px] px-3 py-3',
          className
        )}
      >
        {/* Header: sparkles + "Em gợi ý thay thế" */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <Icon name="sparkles" size={14} className="text-icp-pink-700" />
          <span className="text-[10px] text-icp-pink-700 font-bold uppercase tracking-[1px]">
            Em gợi ý thay thế
          </span>
        </div>

        {/* Body: thumbnail + product info + CTA */}
        <div className="flex items-center gap-2.5">
          <div className="w-12 h-12 rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-[0_3px_8px_rgba(220,38,38,0.15)] bg-gradient-to-br from-icp-rose-100 to-icp-rose-300">
            <Icon name="bottle" size={24} className="text-icp-rose-700 opacity-70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-icp-pink-700 font-semibold uppercase tracking-[0.3px] mb-px">
              {replacement.brand}
            </div>
            <div className="text-[12px] text-icp-pink-900 font-semibold leading-[1.3] mb-0.5">
              {replacement.title}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[12px] text-icp-rose-700 font-bold font-mono">
                {formatVNDCompact(replacement.unitPrice)}
              </span>
              <span className="text-[9px] text-icp-green-600 font-semibold">
                còn {replacement.availableStock} chai
              </span>
              {/* S-08 T02 NEW: similarity badge "~N%" (rendered only when present) */}
              {similarityPct !== undefined ? (
                <span className="text-[9px] text-icp-pink-700 font-bold font-mono bg-icp-pink-50 px-1.5 py-px rounded-full">
                  ~ {similarityPct}%
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onReplace}
            className="bg-gradient-to-br from-icp-pink-500 to-icp-rose-500 text-white px-3 py-2 rounded-[11px] text-[11px] font-bold flex-shrink-0 flex items-center gap-1 shadow-[0_4px_10px_rgba(233,30,99,0.3)]"
          >
            {ctaLabel ?? 'Thay'}
            <Icon name="refresh" size={12} />
          </button>
        </div>

        {/* Optional reason chip — only when LLM-generated reason present */}
        {reason ? (
          <div className="mt-2.5 text-[10px] text-icp-pink-700 leading-[1.4] italic">
            “{reason}”
          </div>
        ) : null}
      </div>
    );
  }
);
StockReplacementCard.displayName = 'StockReplacementCard';
