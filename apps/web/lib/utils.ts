/**
 * apps/web/lib/utils.ts — Shared utility helpers
 *
 * Slice:    S-01 UI Foundation (baseline cn / formatVND / clampPct)
 *           S-05 T03 EXTEND (Phiên Sx05-3) — ADD formatVNDCompact per C-S05-J
 *
 * Task:     T01 Tokens + Utility Foundation
 *           S-05 T03 EXTEND (AC1-AC8 cart contexts use compact no-space format)
 *
 * AC:       AC-16, AC-17, AC-18 (S-01); AC14 (S-05 T03 Vitest formatVNDCompact parity)
 *
 * Exports:
 * - cn(...inputs): conditional className merge with Tailwind conflict resolution.
 * - formatVND(value): Vietnamese đồng currency formatter (Intl default — uses NBSP U+00A0).
 * - formatVNDCompact(value): NEW S-05 T03 — VND formatter NO space (mockup-locked per Rule 6).
 * - clampPct(value, min?, max?): clamp percentage value to [0, 100] by default.
 *
 * Dependencies (already in S-00b T08 package.json):
 * - clsx (^2.1.1) — conditional class composition
 * - tailwind-merge (^2.5.0) — Tailwind utility conflict deduplication
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with conditional logic and Tailwind merge dedup.
 *
 * @example
 *   cn('p-2', 'p-4')                 // → 'p-4' (last wins)
 *   cn('bg-red-500', isActive && 'bg-pink-600')
 *   cn('text-sm', { 'font-bold': isHeading })
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric VND amount using Vietnamese locale conventions.
 *
 * Note: Intl.NumberFormat('vi-VN', currency: VND) uses U+00A0 (non-breaking space)
 * between number and ₫ symbol. For mockup-locked no-space variant, use
 * `formatVNDCompact` instead. DO NOT modify this function — 6 production
 * consumers (OrderSummary + ProductCardSearchB + ProductCard + AddToCartConfirmCard +
 * CoPurchaseHintCard + CartItemRow baseline default) + `molecules.test.tsx:658`
 * hardcoded assertion depend on current shape per C-S05-J Path A.
 *
 * @example
 *   formatVND(1234567)   // → '1.234.567 ₫' (with NBSP)
 *   formatVND(0)         // → '0 ₫'
 *   formatVND(NaN)       // → '0 ₫' (defensive fallback)
 */
export function formatVND(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Compact VND formatter — NO space between number + ₫ symbol.
 *
 * Per Rule 6 MOCKUP IS LAW (237 mockup instances verified Phiên Sx05-3 across
 * intent-03/04/05/06 — 0 instances with space) + D-S05-10 LAW BE `_format_vnd`
 * convention. Use in cart/checkout/payment contexts.
 *
 * @example
 *   formatVNDCompact(25500)   // → '25.500₫'
 *   formatVNDCompact(140500)  // → '140.500₫'
 *   formatVNDCompact(0)       // → '0₫'
 *   formatVNDCompact(NaN)     // → '0₫' (defensive fallback)
 *
 * Existing `formatVND` (with NBSP per Intl default) preserved for backward-compat
 * across 6 production consumers + `molecules.test.tsx:658` hardcoded assertion.
 *
 * S-05 T03 emit (Phiên Sx05-3 per C-S05-J resolution Option A additive).
 */
export function formatVNDCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })
    .format(safe)
    .replace(/[\s\u00A0]/g, '');
}

/**
 * Clamp a percentage value to a [min, max] range, default [0, 100].
 *
 * @example
 *   clampPct(150)         // → 100
 *   clampPct(-20)         // → 0
 *   clampPct(45)          // → 45
 *   clampPct(72, 0, 50)   // → 50
 */
export function clampPct(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
