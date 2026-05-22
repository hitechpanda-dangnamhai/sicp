/**
 * apps/gateway/src/database/database.module.ts
 *
 * NestJS `@Module` wrapping `PgPool` provider for DI consumption.
 *
 * **Pattern parity with T01 `IdempotencyModule` + T05 `ClientsModule`:**
 * shared module exporting infrastructure provider. T06 consumes via
 * `TrackingModule` import. S-03+ V-SLICEs will import same `DatabaseModule`
 * for repos (users, products, orders).
 *
 * `ConfigModule` already global (T01 `isGlobal: true`); `ConfigService`
 * injectable into `PgPool` constructor without local import here.
 *
 * S-02 T06 emit.
 */

import { Module } from '@nestjs/common';
import { PgPool } from './pg-pool.provider';

@Module({
  providers: [PgPool],
  exports: [PgPool],
})
export class DatabaseModule {}
