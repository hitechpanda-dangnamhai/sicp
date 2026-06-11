/**
 * apps/gateway/src/tenant/tenant.module.ts
 *
 * S-P0-01 T02 — cung cấp `TenantResolverService` (header→400, ADR-046 amend b)
 * + `TenantMembershipGuard` (tenant ∈ jwt.tenant_ids → 403, amend c) cho mọi
 * module cần tenant context (tracking, dashboard, intent, auth).
 *
 * Resolver giờ HEADER-ONLY → KHÔNG cần JwtHelper (amend c bỏ active-tenant JWT).
 */

import { Module } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantMembershipGuard } from './tenant-membership.guard';

@Module({
  providers: [TenantResolverService, TenantMembershipGuard],
  exports: [TenantResolverService, TenantMembershipGuard],
})
export class TenantModule {}
