/**
 * apps/gateway/src/health/health.module.ts
 *
 * S-02 T05 Phiên 26 — imports ClientsModule so HealthService can inject
 * AiClient for the AI readiness ping (replaces T01 'unknown' placeholder).
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    IdempotencyModule, // for RedisClient injection (T01)
    ClientsModule, // for AiClient injection (T05)
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
