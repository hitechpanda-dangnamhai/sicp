/**
 * apps/gateway/src/health/health.module.ts
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [IdempotencyModule], // for RedisClient injection
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
