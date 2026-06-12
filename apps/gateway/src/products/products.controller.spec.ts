/**
 * apps/gateway/src/products/products.controller.spec.ts
 *
 * S-P0-01 T03d — merchant route tenant strict: ProductsController (PATCH :id +
 * vespa.index) mang CẢ JwtAuthGuard + TenantMembershipGuard (class-level).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { ProductsController } from './products.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

describe('ProductsController guard wiring (T03d)', () => {
  it('class mang JwtAuthGuard + TenantMembershipGuard', () => {
    const guards = Reflect.getMetadata('__guards__', ProductsController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantMembershipGuard);
  });
});
