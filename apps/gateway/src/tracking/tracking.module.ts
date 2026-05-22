/**
 * apps/gateway/src/tracking/tracking.module.ts
 *
 * NestJS module for behavior tracking ingest pipeline.
 *
 * **Imports:** `DatabaseModule` (provides `PgPool`).
 * **Controllers:** `TrackingController` (exposes `POST /api/v1/track`).
 * **Providers:** `TrackingService` + `TrackingRepository`.
 *
 * **Pattern parity with T01 `HealthModule` + T05 implicit:** module-per-feature
 * boundary; imports infrastructure modules (DatabaseModule), no exports
 * needed (controller routes registered by NestJS framework, internal service
 * not consumed externally).
 *
 * S-02 T06 emit.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingRepository } from './tracking.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingRepository],
})
export class TrackingModule {}
