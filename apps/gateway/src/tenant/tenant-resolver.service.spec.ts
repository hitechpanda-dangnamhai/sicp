/**
 * apps/gateway/src/tenant/tenant-resolver.service.spec.ts
 *
 * S-P0-01 T02 — unit test TenantResolverService (ADR-046 amend b + c).
 * amend (c): resolver HEADER-ONLY (active tenant = URL/X-Tenant-Id). JWT KHÔNG
 * mang active tenant → không có nhánh JWT. KHÔNG cần DB/Redis.
 */

import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantContextMissingError } from './tenant.errors';

const TENANT = '22222222-2222-2222-2222-222222222222';

/** Fake express Request với header X-Tenant-Id tuỳ ca. */
function fakeReq(header?: string): Request {
  return {
    path: '/api/v1/track',
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'x-tenant-id' ? header : undefined,
  } as unknown as Request;
}

describe('TenantResolverService (S-P0-01 T02 — ADR-046 amend c header-only)', () => {
  const svc = new TenantResolverService();

  it('header X-Tenant-Id (UUID) → { tenantId, source: header }', () => {
    expect(svc.resolve(fakeReq(TENANT))).toEqual({ tenantId: TENANT, source: 'header' });
  });

  it('no header → throws TenantContextMissingError (400)', () => {
    expect(() => svc.resolve(fakeReq())).toThrow(TenantContextMissingError);
  });

  it('invalid header (non-UUID) → throws TenantContextMissingError (400)', () => {
    expect(() => svc.resolve(fakeReq('not-a-uuid'))).toThrow(TenantContextMissingError);
  });

  it('resolveOptional with header → tenantId (no throw)', () => {
    expect(svc.resolveOptional(fakeReq(TENANT))).toBe(TENANT);
  });

  it('resolveOptional without header → null (no throw)', () => {
    expect(svc.resolveOptional(fakeReq())).toBeNull();
  });
});
