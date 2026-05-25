'use client';

/**
 * apps/web/components/icp/molecules/UndoRemoveToast.tsx
 *
 * Molecule: <UndoRemoveToast> — state-D 3s countdown undo toast after swipe-delete
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3) — NEW V-SLICE feature molecule
 *
 * Source:   docs/mockups/intent-05/intent-05-state-D-remove.html line 137-153
 *           (red gradient bg + 36×36 trash icon + 2-line text + "Hoàn tác" button +
 *            3s progress bar 60% width start)
 *
 * Reach:    I05 cart page state-D transient toast.
 *
 * Decisions applied:
 * - **Pattern inspiration from <AddToCartConfirmCard>** S-04 T04 (auto-dismiss timer
 *   + StrictMode-safe cleanup). Differences from inspiration:
 *     - Red theme (rose-500/600/700) NOT green
 *     - REAL undo logic (NOT decorative — parent wires DELETE /cart/items + state restore)
 *     - Progress bar animates 0→100% over autoDismissMs (visual countdown)
 * - **S-03 D-29 LAW StrictMode-safe**: useEffect cleanup with clearTimeout — React 18
 *   dev double-mount fires effect twice; without cleanup, onCommit fires 2× → double
 *   DELETE → 404 on second call.
 * - **C-S05-J Path A**: formatVNDCompact for itemPrice mockup parity (mockup line 150).
 * - **C-15 'use client'**: useEffect timer + button click handlers.
 *
 * CSS progress bar animation: uses inline `style={{animationDuration: ...}}` + Tailwind
 * keyframe `animate-[shrink-to-zero_3s_linear]` requires global @keyframes definition.
 * To avoid coupling to tailwind.config global keyframes, this molecule uses inline
 * style with `transition` on width that updates via state — simpler + framework-free.
 *
 * Caller usage:
 *   {state.undoToast ? (
 *     <UndoRemoveToast
 *       itemTitle={state.undoToast.itemTitle}
 *       itemPrice={state.undoToast.itemPrice}
 *       onUndo={() => dispatch({type: 'undo_tap'})}
 *       onCommit={() => {
 *         dispatch({type: 'undo_commit_timeout'});
 *         deleteMut.mutate(state.undoToast.productId);
 *         trackCartItemRemoved({...});
 *       }}
 *     />
 *   ) : null}
 */

import * as React from 'react';
import { cn, formatVNDCompact } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface UndoRemoveToastProps {
  itemTitle: string;
  itemPrice: number;
  /** Fires on "Hoàn tác" button tap — parent reverts optimistic state, NO BE call. */
  onUndo: () => void;
  /** Fires after autoDismissMs elapsed without undo — parent fires DELETE /cart/items. */
  onCommit: () => void;
  /** Default 3000 (3s per mockup state-D progress bar duration). */
  autoDismissMs?: number;
  className?: string;
}

export function UndoRemoveToast({
  itemTitle,
  itemPrice,
  onUndo,
  onCommit,
  autoDismissMs = 3000,
  className,
}: UndoRemoveToastProps) {
  const [progress, setProgress] = React.useState(0);

  // S-03 D-29 LAW StrictMode-safe — cleanup essential.
  React.useEffect(() => {
    const startedAt = performance.now();
    let frame: number | null = null;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const pct = Math.min(100, (elapsed / autoDismissMs) * 100);
      setProgress(pct);
      if (elapsed < autoDismissMs) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    const commitTimer = setTimeout(() => {
      onCommit();
    }, autoDismissMs);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(commitTimer);
    };
  }, [autoDismissMs, onCommit]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden bg-gradient-to-br from-icp-rose-50 to-icp-rose-100',
        'border-[0.5px] border-icp-rose-200 border-l-[3px] border-l-icp-rose-600',
        'rounded-2xl px-3.5 py-3 mb-2',
        'shadow-[0_6px_16px_rgba(220,38,38,0.15)]',
        'flex items-center gap-2.5',
        className
      )}
    >
      {/* Trash icon avatar 36×36 */}
      <div className="w-9 h-9 bg-gradient-to-br from-icp-rose-100 to-icp-rose-300 rounded-[11px] flex items-center justify-center flex-shrink-0">
        <Icon name="trash" size={18} className="text-icp-rose-700" />
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-icp-rose-900 font-bold tracking-[-0.1px] mb-0.5">
          Đã xoá khỏi giỏ
        </div>
        <div className="text-[11px] text-icp-rose-700 leading-[1.4] truncate">
          {itemTitle} ·{' '}
          <span className="font-mono font-bold">{formatVNDCompact(itemPrice)}</span>
        </div>
      </div>

      {/* "Hoàn tác" button */}
      <button
        type="button"
        onClick={onUndo}
        className="bg-white border-[0.5px] border-icp-rose-300 text-icp-rose-700 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold flex-shrink-0"
      >
        Hoàn tác
      </button>

      {/* Progress bar — bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-icp-rose-100">
        <div
          className="h-full bg-gradient-to-r from-icp-rose-500 to-icp-rose-700"
          style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
        />
      </div>
    </div>
  );
}
UndoRemoveToast.displayName = 'UndoRemoveToast';
