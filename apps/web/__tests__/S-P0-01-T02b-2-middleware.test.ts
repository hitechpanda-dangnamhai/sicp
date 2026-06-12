/**
 * apps/web/__tests__/S-P0-01-T02b-2-middleware.test.ts
 *
 * S-P0-01 T02b-2 (ADR-046 amend d) — sau khi mv intent → /s/<slug>/intent/0X:
 *  - forward-rewrite ĐÃ bỏ (route thật, pass-through);
 *  - bare legacy flat `/intent-0X` → 308 `/s/<last_active>/intent/0X` (path
 *    flat→nested) + Cache-Control no-store;
 *  - `/intent-06` (placeholder) cũng có legacy redirect.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function req(path: string, opts: { session?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.session) headers.cookie = 'icp_session=tok';
  return new NextRequest(new URL(`http://localhost:3000${path}`), { headers });
}

function stubLanding(redirectUrl: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ redirect_url: redirectUrl }) }),
  );
}

describe('middleware intent migration (T02b-2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('legacy-redirects bare flat /intent-03 to 308 /s/<slug>/intent/03 (flat→nested)', async () => {
    stubLanding('/s/demo');
    const res = await middleware(req('/intent-03', { session: true }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toContain('/s/demo/intent/03');
    expect(res.headers.get('location')).not.toContain('/intent-03');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('legacy-redirects bare /intent-06 placeholder to 308 /s/<slug>/intent/06', async () => {
    stubLanding('/s/demo');
    const res = await middleware(req('/intent-06', { session: true }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toContain('/s/demo/intent/06');
  });

  it('passes a real nested /s/<slug>/intent/02 through (no forward-rewrite anymore)', async () => {
    const res = await middleware(req('/s/demo/intent/02', { session: true }));
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('auth-gates bare /intent-04 when the session cookie is missing', async () => {
    const res = await middleware(req('/intent-04'));
    expect(res.headers.get('location')).toContain('/auth/login');
  });

  it('keeps two tenants isolated — bare /intent-05 resolves to each user own last_active', async () => {
    stubLanding('/s/tenant-b');
    const res = await middleware(req('/intent-05', { session: true }));
    expect(res.headers.get('location')).toContain('/s/tenant-b/intent/05');
    expect(res.headers.get('location')).not.toContain('tenant-a');
  });
});
