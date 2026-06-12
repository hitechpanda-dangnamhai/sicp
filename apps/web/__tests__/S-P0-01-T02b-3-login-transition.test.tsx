/**
 * apps/web/__tests__/S-P0-01-T02b-3-login-transition.test.tsx
 *
 * S-P0-01 T02b-3 (ADR-046 amend c) — LoginSuccessTransition redirect post-login:
 * không có slug → sau delay resolve qua /auth/landing (KHÔNG /home); prop
 * `redirectTo` (test inject) bypass fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const landingMock = vi.fn();
vi.mock('@icp/shared-types/api', () => ({
  AuthService: { landingControllerLanding: () => landingMock() },
}));

import { LoginSuccessTransition } from '@/components/icp/organisms/LoginSuccessTransition';

describe('LoginSuccessTransition redirect (T02b-3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pushMock.mockReset();
    landingMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('resolves the hub via /auth/landing after the delay (no hardcoded /home)', async () => {
    landingMock.mockResolvedValue({ redirect_url: '/s/demo', source: 'last_active' });
    render(<LoginSuccessTransition displayName="Nam" redirectDelayMs={10} />);
    await vi.advanceTimersByTimeAsync(15);
    expect(landingMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/s/demo');
    expect(pushMock).not.toHaveBeenCalledWith('/home');
  });

  it('uses the injected redirectTo prop without calling landing (test seam)', async () => {
    render(<LoginSuccessTransition displayName="Nam" redirectDelayMs={10} redirectTo="/s/x/home" />);
    await vi.advanceTimersByTimeAsync(15);
    expect(landingMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/s/x/home');
  });
});
