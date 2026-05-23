/**
 * apps/web/__tests__/utils.test.ts — Smoke tests for lib/utils.ts
 *
 * Slice:    S-01 UI Foundation
 * Task:     T01 Tokens + Utility Foundation
 * AC:       AC-21 (≥3 smoke tests)
 *
 * Runs via vitest (see vitest.config.ts).
 */

import { describe, it, expect } from 'vitest';
import { cn, formatVND, clampPct } from '@/lib/utils';

describe('cn()', () => {
  it('merges classes deduping Tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional values from clsx', () => {
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
    expect(cn('bg-red-500', true && 'bg-icp-pink-600')).toBe('bg-icp-pink-600');
  });

  it('handles object syntax', () => {
    expect(cn('rounded', { 'bg-icp-pink-600': true, 'text-white': false })).toBe(
      'rounded bg-icp-pink-600'
    );
  });
});

describe('formatVND()', () => {
  it('formats positive integer as Vietnamese currency', () => {
    // Intl.NumberFormat('vi-VN', currency VND) uses U+00A0 (non-breaking space)
    // between number and symbol. Use regex to allow either standard or NBSP.
    const result = formatVND(1234567);
    expect(result).toMatch(/^1\.234\.567[\s\u00A0]?₫$/);
  });

  it('formats zero correctly', () => {
    expect(formatVND(0)).toMatch(/^0[\s\u00A0]?₫$/);
  });

  it('defensively handles NaN', () => {
    expect(formatVND(NaN)).toMatch(/^0[\s\u00A0]?₫$/);
  });
});

describe('clampPct()', () => {
  it('clamps values above 100 down to 100', () => {
    expect(clampPct(150)).toBe(100);
  });

  it('clamps negative values up to 0', () => {
    expect(clampPct(-20)).toBe(0);
  });

  it('passes through in-range values unchanged', () => {
    expect(clampPct(45)).toBe(45);
    expect(clampPct(0)).toBe(0);
    expect(clampPct(100)).toBe(100);
  });

  it('respects custom min/max', () => {
    expect(clampPct(72, 0, 50)).toBe(50);
    expect(clampPct(10, 20, 80)).toBe(20);
  });

  it('defensively handles NaN by returning min', () => {
    expect(clampPct(NaN)).toBe(0);
    expect(clampPct(NaN, 10, 90)).toBe(10);
  });
});
