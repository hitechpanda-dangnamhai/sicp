/**
 * apps/web/__tests__/S-P0-01-T02b-3-landing.test.ts
 *
 * S-P0-01 T02b-3 (ADR-046 amend c) — pushLanding(): context GLOBAL không có
 * slug (post-login, /me) resolve hub qua GET /auth/landing → redirect_url;
 * lỗi → '/' (KHÔNG hardcode /home).
 *
 * Note: mock landingControllerLanding bằng plain-fn (KHÔNG vi.fn) — vi.fn
 * tracking promise reject sinh unhandled-rejection phantom làm fail test; assert
 * hành vi qua `push` (vi.fn) là đủ.
 */

import { describe, it, expect, vi } from 'vitest';

let landingImpl: () => Promise<{ redirect_url: string; source: string }>;
vi.mock('@icp/shared-types/api', () => ({
  AuthService: { landingControllerLanding: () => landingImpl() },
}));

import { pushLanding } from '@/lib/landing';

describe('pushLanding', () => {
  it('pushes the landing redirect_url (last_active → /s/<slug>)', async () => {
    landingImpl = async () => ({ redirect_url: '/s/demo', source: 'last_active' });
    const push = vi.fn();
    await pushLanding(push);
    expect(push).toHaveBeenCalledWith('/s/demo');
  });

  it('pushes the onboarding redirect_url when no last_active hint', async () => {
    landingImpl = async () => ({ redirect_url: '/onboarding', source: 'onboarding' });
    const push = vi.fn();
    await pushLanding(push);
    expect(push).toHaveBeenCalledWith('/onboarding');
  });

  it('falls back to "/" on fetch error — never hardcodes /home', async () => {
    landingImpl = () => Promise.reject(new Error('401'));
    const push = vi.fn();
    await pushLanding(push);
    expect(push).toHaveBeenCalledWith('/');
    expect(push).not.toHaveBeenCalledWith('/home');
  });
});
