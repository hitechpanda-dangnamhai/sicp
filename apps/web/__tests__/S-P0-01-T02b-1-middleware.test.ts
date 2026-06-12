/**
 * apps/web/__tests__/S-P0-01-T02b-1-middleware.test.ts
 *
 * S-P0-01 T02b-1 (ADR-046 amend d) — integration cho dual-shim middleware:
 *  (i)  forward-rewrite `/s/<slug>/intent-01` → `/intent-01` (chưa migrate);
 *  (ii) legacy redirect 308 bare `/home` → `/s/<last_active>/home` (+no-store);
 *  + auth-gate presence; 2 tenant không lẫn (last_active mỗi user).
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

describe('middleware dual-shim (ADR-046 amend d)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('redirects to /auth/login when a /s/* route lacks the session cookie', async () => {
    const res = await middleware(req('/s/demo/home'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/login');
  });

  // T02b-2: forward-rewrite ĐÃ BỎ — intent giờ là route thật /s/<slug>/intent/0X.
  it('passes /s/<slug>/intent/01 through without rewrite (T02b-2 real route)', async () => {
    const res = await middleware(req('/s/demo/intent/01', { session: true }));
    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('passes /s/<slug>/home through without rewrite (already migrated)', async () => {
    const res = await middleware(req('/s/demo/home', { session: true }));
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('legacy-redirects bare /home to 308 /s/<last_active>/home with Cache-Control no-store', async () => {
    stubLanding('/s/demo');
    const res = await middleware(req('/home', { session: true }));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toContain('/s/demo/home');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps two tenants isolated — bare /home resolves to each user own last_active', async () => {
    stubLanding('/s/tenant-b');
    const res = await middleware(req('/home', { session: true }));
    expect(res.headers.get('location')).toContain('/s/tenant-b/home');
    expect(res.headers.get('location')).not.toContain('tenant-a');
  });

  it('sends bare /home to /onboarding when there is no last_active hint', async () => {
    stubLanding('/onboarding');
    const res = await middleware(req('/home', { session: true }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/onboarding');
  });

  it('auth-gates a bare /me route when the session cookie is missing', async () => {
    const res = await middleware(req('/me'));
    expect(res.headers.get('location')).toContain('/auth/login');
  });
});
