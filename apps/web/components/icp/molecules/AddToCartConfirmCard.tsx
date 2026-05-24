'use client';

/**
 * apps/web/components/icp/molecules/AddToCartConfirmCard.tsx
 *
 * Molecule: <AddToCartConfirmCard> — green "Đã thêm vào giỏ" confirm card with auto-dismiss timer
 *
 * Slice:    S-04 First Product Discovery
 * Task:     T04 NEW V-SLICE feature molecule (Phiên Sx04-9a per C-S04-I PHASE_02 §E EXCEPTION)
 *
 * Source:   docs/mockups/intent-03/intent-03B-state-E-cart.html lines 209-220 verbatim
 *           (gradient white→mint + border-l 3px green + 36×36 check icon avatar + "Hoàn tác" button)
 *
 * Reach:    S-04 stub mode (D-S04-09 emit toast). S-05 future may reuse with REAL undo logic.
 *
 * Decisions applied:
 * - D-S04-09 LAW: stub mode — emits cart.item_added event + shows toast (auto-dismiss 3s default);
 *   onUndo is no-op decorative button at S-04 (S-05 wires real cart removal).
 * - Sx04-9a-discover W2 LOCK: NO toast library installed (verified grep apps/web/package.json for
 *   sonner/react-hot-toast/@radix-ui/react-toast → 0 matches). This molecule is STANDALONE
 *   presentational with internal auto-dismiss timer; parent (T05 page wire) controls render via
 *   state machine `addToCartConfirm: ProductSummary | null` — sets to null on onDismiss callback.
 *   DO NOT wrap in toast.success() — no library exists. CR §8.4 line 955 "toast slot" reference is STALE.
 * - S-03 D-29 LAW StrictMode-safe pattern: useEffect cleanup function essential for dev double-emit.
 * - W3 (Sx04-9a-discover): NO Product type exists — inline literal flat props per S-01 ProductCard precedent.
 * - C-15 'use client' for useEffect timer.
 *
 * StrictMode behavior:
 *   - React 18 dev mode mounts → unmounts → remounts every effect to surface unsafe code
 *   - Without cleanup, setTimeout fires 2x → onDismiss called 2x → potentially double cart-remove
 *   - clearTimeout in cleanup ensures only the LAST mount's timer fires onDismiss
 */

import * as React from 'react';
import { cn, formatVND } from '@/lib/utils';
import { Icon } from '@/components/icp/atoms';

export interface AddToCartConfirmCardProps {
  /** Product summary (inline literal — NO Product type). */
  product: {
    /** Product display title (e.g. "Nước tương Maggi 700ml") */
    title: string;
    /** Raw VND price (e.g. 25500). Formatted via formatVND util. */
    price: number;
    /** Optional decorative image URL (unused S-04 stub). */
    imageUrl?: string;
  };
  /** "Hoàn tác" button callback. No-op at S-04 stub. S-05 wires real undo. Hidden when undefined. */
  onUndo?: () => void;
  /** Auto-dismiss callback fired after autoDismissMs. Parent removes from state machine. */
  onDismiss?: () => void;
  /** Auto-dismiss duration in ms. Default 3000 (3s per CR §8.4 spec). */
  autoDismissMs?: number;
  /** Optional className override. */
  className?: string;
}

export const AddToCartConfirmCard: React.FC<AddToCartConfirmCardProps> = ({
  product,
  onUndo,
  onDismiss,
  autoDismissMs = 3000,
  className,
}) => {
  // StrictMode-safe auto-dismiss timer (S-03 D-29 LAW precedent).
  // Cleanup essential — React 18 dev StrictMode mounts effects twice; without clearTimeout,
  // onDismiss would fire 2x potentially causing double-state-mutation in parent.
  React.useEffect(() => {
    if (!onDismiss || !autoDismissMs) return;
    const id = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(id);
  }, [onDismiss, autoDismissMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'bg-gradient-to-br from-white to-icp-green-50 border-[0.5px] border-icp-green-200 border-l-[3px] border-l-icp-green-500 rounded-[14px] shadow-[0_6px_16px_rgba(16,185,129,0.12)] flex items-center gap-2.5 px-3.5 py-3',
        className
      )}
    >
      {/* Check icon avatar — 36×36 gradient green (mockup line 211-213) */}
      <div className="w-9 h-9 bg-gradient-to-br from-icp-green-500 to-icp-green-600 rounded-[11px] flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(16,185,129,0.4)]">
        <Icon name="check" size={20} strokeWidth={2.5} className="text-white" />
      </div>

      {/* Text block — title 13px green-900 + body 11px green-700 (mockup line 214-217) */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-icp-green-900 font-bold tracking-[-0.1px] mb-[2px]">
          Đã thêm vào giỏ
        </div>
        <div className="text-[11px] text-icp-green-700 leading-[1.4]">
          {product.title} ·{' '}
          <span className="font-mono font-bold">{formatVND(product.price)}</span>
        </div>
      </div>

      {/* "Hoàn tác" button — optional render (mockup line 218) */}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="bg-white border-[0.5px] border-icp-green-200 text-icp-green-700 px-2.5 py-1.5 rounded-[10px] text-[11px] font-semibold flex-shrink-0"
        >
          Hoàn tác
        </button>
      )}
    </div>
  );
};
AddToCartConfirmCard.displayName = 'AddToCartConfirmCard';
