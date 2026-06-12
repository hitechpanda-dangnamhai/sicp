/**
 * apps/gateway/src/cards/cards.controller.spec.ts
 *
 * S-P0-01 T03d — merchant route tenant strict: CardsController phải mang CẢ
 * JwtAuthGuard + TenantMembershipGuard (class-level) → thiếu X-Tenant-Id 400,
 * ∉ tenant_ids 403 (hành vi 400/403 verify ở tenant-resolver/membership guard
 * spec; ở đây chứng minh guard ĐÃ wired).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { CardsController } from './cards.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

describe('CardsController guard wiring (T03d)', () => {
  it('class mang JwtAuthGuard + TenantMembershipGuard', () => {
    const guards = Reflect.getMetadata('__guards__', CardsController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantMembershipGuard);
  });
});
