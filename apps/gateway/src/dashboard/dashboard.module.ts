/**
 * apps/gateway/src/dashboard/dashboard.module.ts
 *
 * NestJS module wiring DashboardController + DashboardService for stub
 * dashboard stats endpoint per S-03 T03b.
 *
 * **Imports:**
 *   - `AuthModule` — provides `JwtAuthGuard` for `@UseGuards(JwtAuthGuard)` on
 *     the controller. AuthModule exports JwtAuthGuard per S-03 T02 design
 *     (see `auth/auth.module.ts` exports field). NO need to re-wire JwtHelper
 *     + RedisSessionStore + PostgresSessionRepository individually — module
 *     import handles transitive DI.
 *
 * **Controllers:** `DashboardController` (exposes `GET /api/v1/dashboard/stats`).
 * **Providers:** `DashboardService`.
 * **Exports:** none — DashboardService is internal-only; no cross-module
 *   consumer exists in S-03 scope.
 *
 * **Pattern parity with `TrackingModule`** (S-02 T06 emit) — module-per-feature
 * boundary; simple imports + controllers + providers structure. Difference:
 * TrackingModule imports `DatabaseModule` (needs PgPool); DashboardModule
 * imports `AuthModule` (needs JwtAuthGuard via re-export). No DB dep for stub
 * service.
 *
 * S-03 T03b emit (Phiên 36 Batch 1).
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { DatabaseModule } from '../database';
import { ClientsModule } from '../clients/clients.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, DatabaseModule, ClientsModule, TenantModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
