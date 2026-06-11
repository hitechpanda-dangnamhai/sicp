/**
 * apps/gateway/src/tenant/tenant-membership.guard.spec.ts
 *
 * S-P0-01 T02 (ADR-046 amend c) — unit test TenantMembershipGuard.
 * Authorize active tenant (URL/header) ∈ jwt.tenant_ids. KHÔNG cần DB.
 */

import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { TenantMembershipGuard } from './tenant-membership.guard';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantContextMissingError } from './tenant.errors';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

function fakeReq(opts: { tenantIds?: string[]; header?: string }): Request {
  return {
    user: opts.tenantIds ? { id: 'u1', tenant_ids: opts.tenantIds } : undefined,
    path: '/api/v1/dashboard/stats',
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'x-tenant-id' ? opts.header : undefined,
  } as unknown as Request;
}

function ctxOf(req: Request): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('TenantMembershipGuard (S-P0-01 T02 — ADR-046 amend c)', () => {
  const guard = new TenantMembershipGuard(new TenantResolverService());

  it('URL tenant ∈ jwt.tenant_ids → pass + set req.tenant_id', () => {
    const req = fakeReq({ tenantIds: [A, B], header: A });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.tenant_id).toBe(A);
  });

  it('URL tenant ∉ jwt.tenant_ids → 403 ForbiddenException', () => {
    const req = fakeReq({ tenantIds: [A], header: B });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(ForbiddenException);
  });

  it('no URL/header → resolver throws 400 TenantContextMissingError', () => {
    const req = fakeReq({ tenantIds: [A] });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(TenantContextMissingError);
  });

  it('no JWT (req.user absent) → denied (chain: JwtAuthGuard 401s trước; guard fail-closed 403)', () => {
    const req = fakeReq({ header: A });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(ForbiddenException);
  });
});
