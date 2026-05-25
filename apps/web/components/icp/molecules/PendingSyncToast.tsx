'use client';

/**
 * apps/web/components/icp/molecules/PendingSyncToast.tsx
 *
 * Molecule: <PendingSyncToast> — state-C inline qty sync indicator
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-C-update-qty.html line 192-200
 *           (pink gradient bg + 30px Spinner + 2-line text + "Huỷ" button)
 *
 * Reach:    I05 cart page state-C transient toast (page-level — ONE toast max,
 *           rendered between item rows in cart list per mockup placement line 191-201).
 *
 * Decisions applied:
 * - **D-S05-07 LAW**: only visible while debounce timer ACTIVE OR PATCH in-flight.
 *   Parent reducer's `pendingSyncToast: PendingSyncToastData | null` slot drives.
 *   Cleared on qty_patch_settled action (mutation onSuccess fires invalidateQueries
 *   → refetch resolves → reducer clears optimisticItems + pendingSyncToast).
 * - **Atom reuse**: <Spinner size={30} color="pink"> per S-01 atoms barrel
 *   (numeric size override per Spinner.tsx:40).
 * - **C-15 'use client'**: interactive "Huỷ" button.
 *
 * "Huỷ" semantics: cancels pending debounce timer + reverts optimistic overlay
 * (parent dispatches `qty_cancel_pending` action → reducer clears optimisticItems
 * + pendingSyncToast). NO BE call — pure local revert.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/icp/atoms';

export interface PendingSyncToastProps {
  oldQty: number;
  newQty: number;
  /** Short label like "Maggi 700ml" (brand + size). */
  itemBrief: string;
  onCancel: () => void;
  className?: string;
}

export function PendingSyncToast({
  oldQty,
  newQty,
  itemBrief,
  onCancel,
  className,
}: PendingSyncToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-gradient-to-br from-icp-pink-50 to-white',
        'border-[0.5px] border-icp-pink-200 rounded-2xl',
        'px-3.5 py-3 mb-2.5',
        'shadow-[0_4px_12px_rgba(233,30,99,0.08)]',
        'flex items-center gap-2.5',
        className
      )}
    >
      {/* Spinner — pink 30px (matches mockup line 194 visual weight) */}
      <div className="flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center">
        <Spinner size={30} color="pink" />
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-icp-pink-900 font-bold tracking-[-0.1px] mb-0.5">
          Cập nhật số lượng
        </div>
        <div className="text-[11px] text-icp-pink-700 leading-[1.4] truncate">
          <span className="font-mono font-bold">
            {oldQty} → {newQty}
          </span>{' '}
          món · {itemBrief}
        </div>
      </div>

      {/* "Huỷ" button */}
      <button
        type="button"
        onClick={onCancel}
        className="bg-white border-[0.5px] border-icp-pink-200 text-icp-pink-700 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold flex-shrink-0"
      >
        Huỷ
      </button>
    </div>
  );
}
PendingSyncToast.displayName = 'PendingSyncToast';
