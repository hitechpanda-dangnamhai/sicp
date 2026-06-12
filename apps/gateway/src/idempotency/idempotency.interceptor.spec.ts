/**
 * idempotency.interceptor.spec.ts — S-P0-02/T04 (#31) key derivation từ scope
 * VERIFIED (KHÔNG header client).
 */
import { describe, it, expect } from 'vitest';
import {
  buildStandardKeys,
  buildIntentActionKeys,
  parseAttemptN,
  tenantScopeFor,
} from './idempotency.interceptor';

describe('buildStandardKeys', () => {
  it('scope {tenant}:{user} đều verified', () => {
    expect(buildStandardKeys('tenantA', 'user1', 'idem-key')).toEqual({
      cacheKey: 'idem:cache:tenantA:user1:idem-key',
      lockKey: 'idem:lock:tenantA:user1:idem-key',
    });
  });
  it('tenant ∅ (cart customer 0-membership) → notenant, user vẫn cô lập', () => {
    expect(buildStandardKeys(null, 'user1', 'k').cacheKey).toBe('idem:cache:notenant:user1:k');
    expect(buildStandardKeys(undefined, 'user2', 'k').cacheKey).toBe('idem:cache:notenant:user2:k');
  });
  it('cross-tenant tách biệt: cùng user+key, tenant khác → cache key khác (acceptance 1)', () => {
    const a = buildStandardKeys('A', 'u', 'k').cacheKey;
    const b = buildStandardKeys('B', 'u', 'k').cacheKey;
    expect(a).not.toBe(b);
  });
});

describe('buildIntentActionKeys', () => {
  it('composite {tenant}:{rid}:{attempt_n} (ADR-048), tenant verified', () => {
    expect(buildIntentActionKeys('T', 'rid-1', 2)).toEqual({
      cacheKey: 'intent:action:T:rid-1:2',
      lockKey: 'intent:action:lock:T:rid-1:2',
    });
  });
  it('tenant ∅ → không prefix (rid UUID toàn cục đủ dedup)', () => {
    expect(buildIntentActionKeys(null, 'rid-1', 1).cacheKey).toBe('intent:action:rid-1:1');
  });
});

describe('tenantScopeFor (Plan KI#3)', () => {
  const TA = '11111111-1111-1111-1111-111111111111';
  const TB = '22222222-2222-2222-2222-222222222222';
  it('ƯU TIÊN req.tenant_id verified (member route)', () => {
    expect(tenantScopeFor({ tenant_id: TA, headers: { 'x-tenant-id': TB } })).toBe(TA);
  });
  it('cart (∅ verified) → X-Tenant-Id active storefront', () => {
    expect(tenantScopeFor({ headers: { 'x-tenant-id': TB } })).toBe(TB);
  });
  it('header không UUID / thiếu → null (→ notenant)', () => {
    expect(tenantScopeFor({ headers: { 'x-tenant-id': 'bad' } })).toBeNull();
    expect(tenantScopeFor({ headers: {} })).toBeNull();
  });
  it('cùng user + cùng key + 2 tenant context → 2 entry tách (correctness)', () => {
    const k1 = buildStandardKeys(tenantScopeFor({ headers: { 'x-tenant-id': TA } }), 'u', 'K').cacheKey;
    const k2 = buildStandardKeys(tenantScopeFor({ headers: { 'x-tenant-id': TB } }), 'u', 'K').cacheKey;
    expect(k1).not.toBe(k2);
    expect(k1).toBe(`idem:cache:${TA}:u:K`);
    expect(k2).toBe(`idem:cache:${TB}:u:K`);
  });
});

describe('parseAttemptN', () => {
  it('đọc _meta.attempt_n int >0', () => {
    expect(parseAttemptN({ _meta: { attempt_n: 3 } })).toBe(3);
  });
  it('default 1 khi thiếu/không hợp lệ', () => {
    expect(parseAttemptN({})).toBe(1);
    expect(parseAttemptN(null)).toBe(1);
    expect(parseAttemptN({ _meta: { attempt_n: 0 } })).toBe(1);
    expect(parseAttemptN({ _meta: { attempt_n: -2 } })).toBe(1);
    expect(parseAttemptN({ _meta: { attempt_n: 1.5 } })).toBe(1);
  });
});
