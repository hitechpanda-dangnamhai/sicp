/**
 * apps/gateway/src/app.module.ts
 *
 * Root NestJS module. Wires:
 *   - ConfigModule (env validation, global)
 *   - HealthModule (liveness + readiness)
 *   - IdempotencyModule (middleware + Redis client)
 *
 * NOT in T01 scope (defer to S-03+):
 *   - AuthModule (JWT guard)
 *   - ProductsModule, OrdersModule, CartModule (V-SLICEs)
 *   - DatabaseModule (Postgres TypeORM/Prisma)
 *   - KafkaModule (producer for events)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, IdempotencyModule, HealthModule],
})
export class AppModule {}
