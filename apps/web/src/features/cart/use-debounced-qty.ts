'use client';

/**
 * apps/web/src/features/cart/use-debounced-qty.ts
 *
 * useDebouncedQty — debounce qty patch queue for state-C qty stepper flow.
 *
 * Slice:    S-05 First Cart/Order Flow
 * Task:     T03 FE Page Wire (Phiên Sx05-3)
 *
 * Decisions applied:
 * - **D-S05-07 LAW**: Local optimistic state + debounced sync (300ms idle window).
 *   Rapid taps on +/- coalesce to single PATCH per product_id (last-wins).
 * - **S-03 D-29 LAW**: StrictMode-safe useEffect cleanup — clearTimeout on
 *   unmount AND on dep change to avoid stale timers firing PATCH after unmount.
 * - **Inline pattern** (NO use-debounce npm dep): handoff §B17 dòng 644-682
 *   explicitly requires inline ~50 LOC implementation. `use-debounce` package
 *   NOT in apps/web/package.json deps (verified Sx05-3-DISCOVER).
 *
 * **Last-wins semantics:** if user taps +/- multiple times on same product
 * within debounceMs window, only the FINAL qty value is sent to BE. Previous
 * pending patches for same product_id are replaced (per `queueQtyPatch` filter).
 *
 * **Multi-product support:** different products' patches accumulate in array
 * and all fire together when debounce timer elapses. Per-product debounce
 * would require Map<productId, timer> — overkill for current state-C UX
 * (user typically updates one product at a time).
 *
 * Caller wiring example:
 * ```tsx
 * const patchMut = usePatchCartItem();
 * const { queueQtyPatch, cancelPending } = useDebouncedQty({
 *   debounceMs: 300,
 *   onFire: (patches) => {
 *     for (const p of patches) {
 *       patchMut.mutate(
 *         { productId: p.productId, qty: p.newQty },
 *         { onSettled: () => dispatch({ type: 'qty_patch_settled', productId: p.productId }) },
 *       );
 *     }
 *   },
 * });
 *
 * // On +/- tap:
 * dispatch({ type: 'qty_tap', productId, newQty, oldQty, itemBrief });
 * queueQtyPatch(productId, newQty);
 * ```
 *
 * S-05 T03 emit (Phiên Sx05-3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PendingQtyPatch {
  productId: string;
  newQty: number;
}

export interface UseDebouncedQtyConfig {
  /** Debounce window in ms. Default 300. */
  debounceMs?: number;
  /** Fires once per debounce window with all pending patches. */
  onFire: (patches: PendingQtyPatch[]) => void;
}

export interface UseDebouncedQtyReturn {
  /** Current pending patches (read-only view for UI debugging). */
  pendingPatches: PendingQtyPatch[];
  /** Queue (or replace) a patch for a product_id. Last-write-wins per product. */
  queueQtyPatch: (productId: string, newQty: number) => void;
  /** Cancel pending debounce timer + clear all pending patches (e.g. user taps "Huỷ"). */
  cancelPending: () => void;
}

export function useDebouncedQty(config: UseDebouncedQtyConfig): UseDebouncedQtyReturn {
  const { debounceMs = 300, onFire } = config;
  const [pendingPatches, setPendingPatches] = useState<PendingQtyPatch[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep onFire reference fresh without re-running the debounce effect on every render.
  const onFireRef = useRef(onFire);
  useEffect(() => {
    onFireRef.current = onFire;
  }, [onFire]);

  const queueQtyPatch = useCallback((productId: string, newQty: number) => {
    setPendingPatches((prev) => [
      // Filter out any existing patch for this product (last-wins per product).
      ...prev.filter((p) => p.productId !== productId),
      { productId, newQty },
    ]);
  }, []);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPendingPatches([]);
  }, []);

  useEffect(() => {
    if (pendingPatches.length === 0) {
      return;
    }
    // Clear any previous timer — debounce resets on each new tap.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      // Capture current patches at fire-time (snapshot — setState won't mutate this).
      const toFire = pendingPatches;
      onFireRef.current(toFire);
      setPendingPatches([]);
      timerRef.current = null;
    }, debounceMs);

    // Cleanup — StrictMode-safe per S-03 D-29.
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pendingPatches, debounceMs]);

  return { pendingPatches, queueQtyPatch, cancelPending };
}
