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
 *   - DashboardModule (S-03 T03b — GET /api/v1/dashboard/stats stub per D-10)
 *   - CartModule (S-05 T02 — 7 cart endpoints per D-S05-01/02 LAW)
 *   - CardsModule (S-07 T01.E — 3 cards endpoints per C-S07-A)
 *   - **ProductsModule (S-07 T01.E.G — 1 PATCH endpoint per C-S07-N Option B)**
 *
 * NOT in scope (defer to V-SLICE+):
 *   - ProductsModule POST/DELETE (V-SLICE — currently only PATCH for update)
 *   - OrdersModule (V-SLICE)
 *   - KafkaModule (producer for events)
 */

import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { ZodValidationPipe } from './common/zod-validation.pipe';
import { ThrottlerAppModule } from './common/throttler/throttler-app.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database';
import { TrackingModule } from './tracking';
import { IntentModule } from './intent';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CartModule } from './cart';
import { CardsModule } from './cards/cards.module';
import { ProductsModule } from './products/products.module';
import { TenantModule } from './tenant/tenant.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerAppModule, // ← S-P0-02/T03 W-60: throttler + Redis storage + APP_GUARD
    IdempotencyModule,
    HealthModule,
    DatabaseModule,
    TenantModule, // ← S-P0-01 T02: TenantResolverService (ADR-046 amend b)
    PublicModule, // ← S-P0-01 T02: public tenant-by-slug bootstrap
    TrackingModule,
    IntentModule,
    CartModule, // ← S-05 T02 per D-S05-01 LAW
    CardsModule, // ← S-07 T01.E per C-S07-A
    ProductsModule, // ← S-07 T01.E.G per C-S07-N Option B (Phiên Sx07-D)
    AuthModule,
    DashboardModule,
  ],
  // S-P0-02/T03 W-58: global ZodValidationPipe (APP-level) — mọi createZodDto
  // body sai schema → 400 envelope { error: { code, message } }.
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
