/**
 * apps/gateway/src/dashboard/dashboard.controller.spec.ts
 *
 * S-P0-01 T03d — GET /dashboard/insight (analytics.detect_anomaly = Postgres
 * tenant-scoped) nay tenant strict: handler getInsight mang CẢ JwtAuthGuard +
 * TenantMembershipGuard (method-level). getStats vốn đã có cả 2 (mẫu copy).
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { DashboardController } from './dashboard.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

describe('DashboardController guard wiring (T03d)', () => {
  it('getInsight mang JwtAuthGuard + TenantMembershipGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      DashboardController.prototype.getInsight,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantMembershipGuard);
  });

  it('getStats vẫn mang JwtAuthGuard + TenantMembershipGuard (mẫu copy)', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      DashboardController.prototype.getStats,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(TenantMembershipGuard);
  });
});
