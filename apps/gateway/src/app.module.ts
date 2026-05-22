/**
 * apps/gateway/src/app.module.ts
 *
 * Root NestJS module. Wires:
 *   - ConfigModule (env validation, global)
 *   - HealthModule (liveness + readiness)
 *   - IdempotencyModule (middleware + Redis client, T01)
 *   - DatabaseModule (PgPool, T06 — used by TrackingModule + future S-03+)
 *   - TrackingModule (POST /api/v1/track ingest, T06)
 *   - IntentModule (POST /api/v1/intent + GET /api/v1/intent/stream, T07)
 *
 * NOT in scope (defer to S-03+):
 *   - AuthModule (JWT guard)
 *   - ProductsModule, OrdersModule, CartModule (V-SLICEs)
 *   - KafkaModule (producer for events)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database';
import { TrackingModule } from './tracking';
import { IntentModule } from './intent';

@Module({
  imports: [
    ConfigModule,
    IdempotencyModule,
    HealthModule,
    DatabaseModule,
    TrackingModule,
    IntentModule,
  ],
})
export class AppModule {}
