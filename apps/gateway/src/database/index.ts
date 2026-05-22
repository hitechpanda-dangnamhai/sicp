/**
 * apps/gateway/src/database/index.ts
 *
 * Barrel — re-exports `DatabaseModule` + `PgPool` for consumer imports.
 * Future S-03+ V-SLICEs add per-entity repository providers wrapping PgPool.
 *
 * S-02 T06 emit.
 */

export { DatabaseModule } from './database.module';
export { PgPool } from './pg-pool.provider';
