/**
 * apps/gateway/src/intent/intent.service.spec.ts
 *
 * S-P0-01 T03c — F2 ownership binding: dispatch lưu owner {user_id, tenant_id}
 * vào VALUE intent:cache; assertOwnership gate rid↔owner.
 * S-P0-01 T03e (ADR-050) — dispatch += membership_required; assertOwnership TÁCH
 * membership (chỉ user + tenant non-null); isMembershipSatisfied = membership gate.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  IntentService,
  INTENT_CACHE_PREFIX,
  type IntentCacheEntry,
} from './intent.service';

const RID = 'rid-1';
const USER = 'u-1';
const TENANT = 't-1';

/** VALUE intent:cache mặc định (owner đầy đủ); override field để mô phỏng mismatch. */
function entry(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    request_id: RID,
    user_id: USER,
    tenant_id: TENANT,
    membership_required: false,
    ...overrides,
  });
}

function makeService(getImpl: () => Promise<string | null>) {
  const redis = {
    get: vi.fn(getImpl),
    setWithTtl: vi.fn(async () => undefined),
  } as any;
  const ai = { postIntent: vi.fn() } as any;
  return { svc: new IntentService(ai, redis), redis };
}

describe('IntentService.assertOwnership (T03c F2 + T03e tách membership)', () => {
  it('trả entry khi cache hit + user khớp + tenant non-null (T03e: membership tách ra)', async () => {
    const { svc } = makeService(async () => entry());
    expect(await svc.assertOwnership(RID, USER)).toMatchObject({
      user_id: USER,
      tenant_id: TENANT,
    });
  });

  it('trả entry kể cả khi owner là customer 0-membership (membership_required=false)', async () => {
    const { svc } = makeService(async () => entry({ tenant_id: 't-store', membership_required: false }));
    // T03c cũ sẽ null ở đây (tenant ∉ membership); T03e ownership KHÔNG xét membership.
    expect(await svc.assertOwnership(RID, USER)).toMatchObject({ tenant_id: 't-store' });
  });

  it('null khi cache-miss (rid không tồn tại / hết hạn)', async () => {
    const { svc } = makeService(async () => null);
    expect(await svc.assertOwnership(RID, USER)).toBeNull();
  });

  it('null khi user khác (cùng tenant) — rid của người khác', async () => {
    const { svc } = makeService(async () => entry({ user_id: 'u-other' }));
    expect(await svc.assertOwnership(RID, USER)).toBeNull();
  });

  it('null khi VALUE format cũ thiếu owner (orphan window 60s)', async () => {
    const { svc } = makeService(async () => JSON.stringify({ request_id: RID }));
    expect(await svc.assertOwnership(RID, USER)).toBeNull();
  });

  it('null khi tenant_id null (orphan / không dựng được kênh SSE)', async () => {
    const { svc } = makeService(async () => entry({ tenant_id: null }));
    expect(await svc.assertOwnership(RID, USER)).toBeNull();
  });

  it('null khi VALUE corrupt JSON', async () => {
    const { svc } = makeService(async () => '{not-json');
    expect(await svc.assertOwnership(RID, USER)).toBeNull();
  });
});

describe('IntentService.isMembershipSatisfied (T03e ADR-050 §4)', () => {
  const { svc } = makeService(async () => null);
  const base = (o: Partial<IntentCacheEntry>): IntentCacheEntry => ({
    request_id: RID,
    user_id: USER,
    tenant_id: TENANT,
    ...o,
  });

  it('customer-allowed (membership_required=false) → PASS dù tenant ∉ membership', () => {
    expect(svc.isMembershipSatisfied(base({ membership_required: false }), [])).toBe(true);
  });

  it('membership-required + owner ∈ tenant_ids → PASS', () => {
    expect(svc.isMembershipSatisfied(base({ membership_required: true }), [TENANT, 't-9'])).toBe(true);
  });

  it('membership-required + owner ∉ tenant_ids → FAIL', () => {
    expect(svc.isMembershipSatisfied(base({ membership_required: true }), ['t-9'])).toBe(false);
  });

  it('entry format cũ thiếu field (undefined) → FAIL-CLOSED đòi membership', () => {
    expect(svc.isMembershipSatisfied(base({}), [])).toBe(false);
    expect(svc.isMembershipSatisfied(base({}), [TENANT])).toBe(true);
  });
});

describe('IntentService.dispatch lưu owner + membership_required (T03c F2 + T03e)', () => {
  it('lưu {user_id, tenant_id, membership_required} từ ctx vào VALUE intent:cache:{rid}', async () => {
    const redis = {
      get: vi.fn(),
      setWithTtl: vi.fn(async () => undefined),
    } as any;
    const ai = { postIntent: vi.fn(async () => ({ request_id: RID })) } as any;
    const svc = new IntentService(ai, redis);

    await svc.dispatch({ modality: 'text' } as any, { userId: USER, tenantId: TENANT }, false);

    const [key, val] = redis.setWithTtl.mock.calls[0];
    expect(key).toBe(`${INTENT_CACHE_PREFIX}${RID}`);
    const parsed = JSON.parse(val as string);
    expect(parsed).toMatchObject({
      request_id: RID,
      user_id: USER,
      tenant_id: TENANT,
      membership_required: false,
    });
  });

  it('default membership_required=true (fail-closed) khi caller bỏ tham số', async () => {
    const redis = { get: vi.fn(), setWithTtl: vi.fn(async () => undefined) } as any;
    const ai = { postIntent: vi.fn(async () => ({ request_id: RID })) } as any;
    const svc = new IntentService(ai, redis);

    await svc.dispatch({ modality: 'image' } as any, { userId: USER, tenantId: TENANT });

    const parsed = JSON.parse(redis.setWithTtl.mock.calls[0][1] as string);
    expect(parsed.membership_required).toBe(true);
  });
});
