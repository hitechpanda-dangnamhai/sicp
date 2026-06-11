/**
 * apps/gateway/src/tracking/tracking.module.ts
 *
 * NestJS module for behavior tracking ingest pipeline.
 *
 * **Imports:** `DatabaseModule` (provides `PgPool`).
 * **Controllers:** `TrackingController` (exposes `POST /api/v1/track`).
 * **Providers:** `TrackingService` + `TrackingRepository`.
 * **Exports:** `TrackingService` — per S-03 C-14 RESOLVED Phiên 33 T03 first-Bước
 *   (AuthService injects TrackingService for behavior event loopback emit at
 *   login/logout/forgot-password success per ADR-014 catalog-first + S-03 DM-7).
 *
 * **Pattern parity with T01 `HealthModule` + T05 implicit:** module-per-feature
 * boundary; imports infrastructure modules (DatabaseModule). T06 initial emit
 * had no `exports` because no cross-module consumer existed yet — S-03 T03
 * adds AuthService as first consumer, hence `exports` field added.
 *
 * S-02 T06 emit. Patched S-03 T03 Phiên 33 (C-14 RESOLVED — add exports).
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingRepository } from './tracking.repository';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  // S-P0-01 T02: TenantModule cung cấp TenantResolverService để /track resolve
  // tenant theo chain JWT→X-Tenant-Id→400 (ADR-046 amend b). KHÔNG import
  // AuthModule (tránh circular: AuthModule → TrackingModule).
  imports: [DatabaseModule, TenantModule],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingRepository],
  exports: [TrackingService],
})
export class TrackingModule {}
