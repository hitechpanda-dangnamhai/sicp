'use client';

/**
 * apps/web/components/icp/molecules/ClearConfirmModal.tsx
 *
 * Molecule: <ClearConfirmModal> — state-F clear-cart confirmation modal
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-F-clear-confirm.html line 223-262 verbatim
 *           (backdrop blur + drag handle + 64×64 red trash circle + pulse-ring + headline
 *            + BE-driven user_message + advice card + 2-button footer)
 *
 * Reach:    I05 cart page state-F (single-intent).
 *
 * Decisions applied:
 * - **D-S05-09 LAW**: NO `actions[]` field from server — FE hardcodes button labels
 *   "Ở lại giỏ" / "Xoá hết" (clone of SseVariantDegradedEvent reject-retry-actions
 *   precedent line 219-225 from S-04). Server doesn't govern label strings.
 * - **D-S05-10 LAW**: `userMessage` BE-driven Rule 6 mockup-locked Vietnamese with
 *   embedded item_count + subtotal substitution (rendered as plain string per
 *   mockup line 238). FE does NOT template — BE pre-rendered the full sentence.
 * - **R-S05-3 mitigation**: `isPending` prop disables both buttons during in-flight
 *   POST /action to prevent double-submit (also visually dims the "Xoá hết" button).
 * - **C-22 organism compose**: wraps <BottomSheet> from organisms/ — but uses
 *   custom overlay+positioning to match mockup pulse-ring + drag-handle precisely
 *   (BottomSheet shadcn Sheet primitive doesn't expose drag-handle styling per
 *   organism docstring line 38-40). C-S05-I Path A "thin wrapper" honored via
 *   composing <BottomSheet> only for backdrop + open/close lifecycle.
 * - **C-15 'use client'**: interactive modal + 2 callbacks.
 *
 * Note on BottomSheet composition: shadcn Sheet primitive renders title via
 * <SheetTitle> + description via <SheetDescription>. Our mockup needs custom
 * 64×64 trash circle with pulse-ring as title icon — passed through `title`
 * slot as ReactNode workaround. Body slot holds the advice card. Footer slot
 * holds the 2-button row.
 */

import * as React from 'react';
import { cn, formatVNDCompact } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';
import { BottomSheet } from '@/components/icp/organisms';

export interface ClearConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  subtotal: number;
  /**
   * BE-driven full Vietnamese string with embedded item_count + subtotal substitution
   * per D-S05-10 LAW. Mockup state-F line 238: "Em sẽ xoá <N> món trị giá <X>₫ khỏi
   * giỏ. Hành động này không thể hoàn tác."
   *
   * If empty/null, FE falls back to templating from itemCount + subtotal (defensive
   * — covers case where SSE handler ran but BE templating returned empty per
   * D-S05-15 runtime correctness pattern).
   */
  userMessage: string;
  /**
   * BE-driven advice string per D-S05-10 LAW. Mockup line 248: "Nếu chỉ muốn bỏ
   * vài món, anh hãy vuốt sang trái từng item thay vì xoá hết."
   */
  advice: string;
  /** R-S05-3 mitigation — disable buttons during in-flight POST /action. */
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function ClearConfirmModal({
  open,
  onOpenChange,
  itemCount,
  subtotal,
  userMessage,
  advice,
  isPending = false,
  onConfirm,
  onCancel,
  className,
}: ClearConfirmModalProps) {
  // Defensive fallback per D-S05-15 — if BE-rendered userMessage empty, build inline.
  const renderedMessage =
    userMessage && userMessage.length > 0
      ? userMessage
      : `Em sẽ xoá ${itemCount} món trị giá ${formatVNDCompact(subtotal)} khỏi giỏ. Hành động này không thể hoàn tác.`;

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        // Backdrop click / ESC closes via this path — treat as cancel.
        if (!next) onCancel();
        onOpenChange(next);
      }}
      className={cn('!p-0', className)}
    >
      <div className="px-[22px] pt-6 pb-[22px] relative">
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 -translate-x-1/2 w-9 h-1 bg-icp-pink-200 rounded-[2px]"
        />

        {/* Hero icon block: 64×64 red gradient circle + pulse-ring + trash icon */}
        <div className="flex flex-col items-center text-center mb-[18px]">
          <div className="relative w-16 h-16 mb-3.5">
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-icp-rose-600/20 rounded-full animate-ping"
            />
            <div className="relative w-16 h-16 bg-gradient-to-br from-icp-rose-100 to-icp-rose-300 rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(220,38,38,0.25)]">
              <Icon name="trash" size={30} className="text-icp-rose-600" />
            </div>
          </div>
          <div className="text-[18px] font-bold text-icp-pink-900 mb-1.5 tracking-[-0.3px]">
            Xoá toàn bộ giỏ hàng?
          </div>
          <div className="text-[13px] text-icp-pink-700 leading-[1.5] max-w-[280px]">
            {renderedMessage}
          </div>
        </div>

        {/* AI advice card */}
        <div className="bg-icp-pink-50 border-[0.5px] border-icp-pink-200 rounded-xl px-3 py-2.5 mb-[18px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="sparkles" size={13} className="text-icp-pink-700" />
            <span className="text-[10px] text-icp-pink-700 font-bold uppercase tracking-[0.5px]">
              Lời khuyên từ em
            </span>
          </div>
          <div className="text-[11px] text-icp-pink-900 leading-[1.45]">{advice}</div>
        </div>

        {/* 2-button footer */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 py-3.5 rounded-2xl text-[13px] font-bold disabled:opacity-50"
          >
            Ở lại giỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'flex-1 text-white py-3.5 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-1.5',
              'bg-gradient-to-br from-icp-rose-600 to-icp-rose-700',
              'shadow-[0_8px_20px_rgba(220,38,38,0.35)]',
              isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon name="trash" size={15} />
            Xoá hết
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
ClearConfirmModal.displayName = 'ClearConfirmModal';
