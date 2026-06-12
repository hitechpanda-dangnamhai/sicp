/**
 * apps/gateway/src/cart/cart.controller.spec.ts
 *
 * S-P0-01 T03d — cart = customer-facing tenant strict NHƯNG KHÔNG membership:
 *   1. Guard wiring: JwtAuthGuard CÓ, TenantMembershipGuard KHÔNG (customer
 *      0-membership BY DESIGN — gắn membership = chặn checkout, ADR-046 amend).
 *   2. resolve() STRICT: thiếu X-Tenant-Id → 400 (TenantContextMissingError).
 *   3. Customer hợp lệ (header + tenant_ids=[] 0-membership) → PASS, gọi service
 *      với tenant resolve được (không 403).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CartController } from './cart.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';
import { TenantResolverService } from '../tenant/tenant-resolver.service';

const TENANT = '11111111-1111-1111-1111-111111111111';

function makeController() {
  const cartService = { get: vi.fn(async () => ({ items: [] })) } as any;
  const ctrl = new CartController(cartService, new TenantResolverService());
  return { ctrl, cartService };
}

describe('CartController guard wiring (T03d)', () => {
  it('class mang JwtAuthGuard NHƯNG KHÔNG TenantMembershipGuard', () => {
    const guards = Reflect.getMetadata('__guards__', CartController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(TenantMembershipGuard);
  });
});

describe('CartController tenant strict (T03d)', () => {
  it('thiếu X-Tenant-Id → 400 (resolve() strict)', async () => {
    const { ctrl } = makeController();
    const req = { user: { id: 'u-1', tenant_ids: [] }, header: () => undefined } as any;
    await expect(ctrl.getCart(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('customer 0-membership + X-Tenant-Id hợp lệ → PASS, gọi service với tenant', async () => {
    const { ctrl, cartService } = makeController();
    const req = {
      user: { id: 'u-1', tenant_ids: [] }, // 0-membership customer
      header: (n: string) => (n === 'x-tenant-id' ? TENANT : undefined),
    } as any;
    await ctrl.getCart(req);
    expect(cartService.get).toHaveBeenCalledWith('u-1', TENANT);
  });
});
