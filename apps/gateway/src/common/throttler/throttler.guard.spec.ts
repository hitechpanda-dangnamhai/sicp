/**
 * throttler.guard.spec.ts — S-P0-02/T03 W-60: tracker key resolution.
 */
import { describe, it, expect } from 'vitest';
import { resolveTracker } from './throttler.guard';

describe('resolveTracker', () => {
  it('key theo userId khi đã auth (u:<id>)', () => {
    expect(resolveTracker({ user: { id: 'user-42' }, ip: '1.2.3.4' })).toBe('u:user-42');
  });
  it('key theo IP khi chưa auth (ip:<ip>) — perimeter brute-force', () => {
    expect(resolveTracker({ ip: '203.0.113.9' })).toBe('ip:203.0.113.9');
  });
  it('fallback ip:unknown khi thiếu cả user lẫn ip', () => {
    expect(resolveTracker({})).toBe('ip:unknown');
  });
});
