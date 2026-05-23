/**
 * apps/web/lib/utils.ts — Shared utility helpers
 *
 * Slice:    S-01 UI Foundation
 * Task:     T01 Tokens + Utility Foundation
 * AC:       AC-16, AC-17, AC-18
 *
 * Exports:
 * - cn(...inputs): conditional className merge with Tailwind conflict resolution.
 * - formatVND(value): Vietnamese đồng currency formatter.
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
 * @example
 *   formatVND(1234567)   // → '1.234.567 ₫'
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
