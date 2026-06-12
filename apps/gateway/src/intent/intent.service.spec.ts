/**
 * apps/gateway/src/intent/intent.service.spec.ts
 *
 * S-P0-01 T03c — F2 ownership binding: dispatch lưu owner {user_id, tenant_id}
 * vào VALUE intent:cache; assertOwnership gate rid↔owner (user + tenant∈membership).
 */

import { describe, it, expect, vi } from 'vitest';
import { IntentService, INTENT_CACHE_PREFIX } from './intent.service';

const RID = 'rid-1';
const USER = 'u-1';
const TENANT = 't-1';

/** VALUE intent:cache mặc định (owner đầy đủ); override field để mô phỏng mismatch. */
function entry(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    request_id: RID,
    user_id: USER,
    tenant_id: TENANT,
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

describe('IntentService.assertOwnership (T03c F2)', () => {
  it('true khi cache hit + user khớp + tenant ∈ membership', async () => {
    const { svc } = makeService(async () => entry());
    expect(await svc.assertOwnership(RID, USER, [TENANT, 't-9'])).toBe(true);
  });

  it('false khi cache-miss (rid không tồn tại / hết hạn)', async () => {
    const { svc } = makeService(async () => null);
    expect(await svc.assertOwnership(RID, USER, [TENANT])).toBe(false);
  });

  it('false khi user khác (cùng tenant) — rid của người khác', async () => {
    const { svc } = makeService(async () => entry({ user_id: 'u-other' }));
    expect(await svc.assertOwnership(RID, USER, [TENANT])).toBe(false);
  });

  it('false khi tenant ∉ membership (cross-tenant)', async () => {
    const { svc } = makeService(async () => entry({ tenant_id: 't-other' }));
    expect(await svc.assertOwnership(RID, USER, [TENANT])).toBe(false);
  });

  it('false khi VALUE format cũ thiếu owner (orphan window 60s)', async () => {
    const { svc } = makeService(async () => JSON.stringify({ request_id: RID }));
    expect(await svc.assertOwnership(RID, USER, [TENANT])).toBe(false);
  });

  it('false khi VALUE corrupt JSON', async () => {
    const { svc } = makeService(async () => '{not-json');
    expect(await svc.assertOwnership(RID, USER, [TENANT])).toBe(false);
  });
});

describe('IntentService.dispatch lưu owner (T03c F2)', () => {
  it('lưu {user_id, tenant_id} từ ctx vào VALUE intent:cache:{rid}', async () => {
    const redis = {
      get: vi.fn(),
      setWithTtl: vi.fn(async () => undefined),
    } as any;
    const ai = { postIntent: vi.fn(async () => ({ request_id: RID })) } as any;
    const svc = new IntentService(ai, redis);

    await svc.dispatch({ modality: 'text' } as any, { userId: USER, tenantId: TENANT });

    const [key, val] = redis.setWithTtl.mock.calls[0];
    expect(key).toBe(`${INTENT_CACHE_PREFIX}${RID}`);
    const parsed = JSON.parse(val as string);
    expect(parsed).toMatchObject({ request_id: RID, user_id: USER, tenant_id: TENANT });
  });
});
