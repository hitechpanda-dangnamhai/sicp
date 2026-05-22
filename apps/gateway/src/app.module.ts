/**
 * apps/gateway/src/app.module.ts
 *
 * Root NestJS module. Wires:
 *   - ConfigModule (env validation, global)
 *   - HealthModule (liveness + readiness)
 *   - IdempotencyModule (middleware + Redis client, S-02 T01)
 *   - DatabaseModule (PgPool, S-02 T06)
 *   - TrackingModule (POST /api/v1/track ingest, S-02 T06)
 *   - IntentModule (POST /api/v1/intent + GET /api/v1/intent/stream, S-02 T07)
 *   - AuthModule (S-03 T02 — 4 endpoints + JwtAuthGuard exported for V-SLICE consumers)
 *
 * NOT in scope (defer to S-04+):
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
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    IdempotencyModule,
    HealthModule,
    DatabaseModule,
    TrackingModule,
    IntentModule,
    AuthModule,
  ],
})
export class AppModule {}
