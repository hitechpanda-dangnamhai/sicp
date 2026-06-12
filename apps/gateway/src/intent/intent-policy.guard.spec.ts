/**
 * apps/gateway/src/intent/intent-policy.guard.spec.ts
 *
 * S-P0-01 T03e (ADR-050) — IntentPolicyGuard: tenant strict mọi intent;
 * POST /intent classify (modality, hint) → membership enforce + set
 * req.membership_required; POST /:rid/action defer (chỉ tenant strict).
 */

import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { IntentPolicyGuard } from './intent-policy.guard';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { TenantContextMissingError } from '../tenant/tenant.errors';

const STORE = '11111111-1111-1111-1111-111111111111'; // tenant storefront (header)
const MEMBER = '11111111-1111-1111-1111-111111111111';

function fakeReq(opts: {
  tenantIds?: string[];
  header?: string;
  body?: Record<string, unknown>;
  ridParam?: string;
}): Request {
  return {
    user: opts.tenantIds ? { id: 'u1', tenant_ids: opts.tenantIds } : undefined,
    body: opts.body,
    params: opts.ridParam ? { rid: opts.ridParam } : {},
    path: '/api/v1/intent',
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'x-tenant-id' ? opts.header : undefined,
  } as unknown as Request;
}

function ctxOf(req: Request): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('IntentPolicyGuard (T03e ADR-050)', () => {
  const guard = new IntentPolicyGuard(new TenantResolverService());

  it('thiếu X-Tenant-Id → 400 (tenant strict mọi intent)', () => {
    const req = fakeReq({ tenantIds: [], body: { modality: 'text' } });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(TenantContextMissingError);
  });

  it('customer-allowed (text search) + 0-membership → PASS + set req.tenant_id + membership_required=false', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'text' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.tenant_id).toBe(STORE);
    expect(req.membership_required).toBe(false);
  });

  it('membership-required (image import) + 0-membership → 403', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'image' } });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(ForbiddenException);
  });

  it('membership-required (image import) + owner ∈ membership → PASS + membership_required=true', () => {
    const req = fakeReq({ tenantIds: [MEMBER], header: STORE, body: { modality: 'image' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.membership_required).toBe(true);
  });

  // SCOPE 3 matrix enforcement — mỗi ô 1 case.
  it('07 analyzing (voice, analyze) + 0-membership → 403', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'voice', hint: 'analyze' } });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(ForbiddenException);
  });

  it('07 analyzing (voice, analyze) + member → PASS', () => {
    const req = fakeReq({ tenantIds: [MEMBER], header: STORE, body: { modality: 'voice', hint: 'analyze' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
  });

  it('02 buy (voice) + header + 0-membership → PASS', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'voice' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.membership_required).toBe(false);
  });

  it('04 recommend (image, recommend) + header + 0-membership → PASS', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'image', hint: 'recommend' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.membership_required).toBe(false);
  });

  it('05 cart (text, cart_clear_confirm) + header + 0-membership → PASS', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'text', hint: 'cart_clear_confirm' } });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.membership_required).toBe(false);
  });

  it('default-deny (text, analyze) + 0-membership → 403', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, body: { modality: 'text', hint: 'analyze' } });
    expect(() => guard.canActivate(ctxOf(req))).toThrow(ForbiddenException);
  });

  it('POST /:rid/action — defer policy (chỉ tenant strict), KHÔNG đụng body', () => {
    const req = fakeReq({ tenantIds: [], header: STORE, ridParam: 'rid-1' });
    expect(guard.canActivate(ctxOf(req))).toBe(true);
    expect(req.tenant_id).toBe(STORE);
    // action không set membership_required (đọc từ cache ở controller).
    expect(req.membership_required).toBeUndefined();
  });
});
