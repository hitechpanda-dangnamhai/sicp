/**
 * apps/web/__tests__/S-P0-01-T02b-1-tenant-href.test.ts
 *
 * S-P0-01 T02b-1 (ADR-046 amend d) — unit cho helper tenantHref(): nguồn DUY
 * NHẤT sinh URL `/s/<slug>/*`. Cover: prefix slug tay, giữ query, chuẩn hoá
 * leading slash, global-context bare, chống double-prefix, auto-detect pathname,
 * 2 tenant không lẫn.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { tenantHref } from '@/lib/tenant-href';

describe('tenantHref', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  it('prefixes a tenant-scoped path with an explicit slug', () => {
    expect(tenantHref('/home', 'demo')).toBe('/s/demo/home');
  });

  it('preserves the query string when prefixing', () => {
    expect(tenantHref('/intent-07?preset=revenue_7d', 'acme')).toBe(
      '/s/acme/intent-07?preset=revenue_7d',
    );
  });

  it('normalizes a path missing its leading slash', () => {
    expect(tenantHref('home', 'demo')).toBe('/s/demo/home');
  });

  it('returns the bare path when no slug is available (global context)', () => {
    expect(tenantHref('/home', null)).toBe('/home');
  });

  it('does not double-prefix an already-scoped path', () => {
    expect(tenantHref('/s/demo/home', 'demo')).toBe('/s/demo/home');
  });

  it('auto-detects the slug from the current pathname', () => {
    window.history.pushState({}, '', '/s/shopx/intent-01');
    expect(tenantHref('/home')).toBe('/s/shopx/home');
  });

  it('keeps two tenants isolated — explicit slug wins over pathname', () => {
    window.history.pushState({}, '', '/s/tenant-a/home');
    expect(tenantHref('/home', 'tenant-b')).toBe('/s/tenant-b/home');
  });
});
