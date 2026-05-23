/**
 * apps/gateway/src/database/pg-pool.provider.ts
 *
 * NestJS `@Injectable() PgPool` wrapping `pg.Pool` singleton.
 *
 * **Pattern parity với T01 `RedisClient`:** Mirror lazy-init + onModuleDestroy
 * + service-name log emission. Pool config tuned cho Hackathon Phase 2 scope:
 * - max=10 connections (T06 INSERT throughput sufficient)
 * - idleTimeoutMillis=30000 (recycle idle pool)
 * - connectionTimeoutMillis=2000 (fail-fast on Postgres down)
 *
 * OTel auto-instrumentation via `@opentelemetry/instrumentation-pg` loaded
 * by T01 `getNodeAutoInstrumentations()` — every `pool.query()` becomes a
 * child span of the current trace context automatically (no manual span
 * needed; T06 controller is on standard Express auto-instrument path per
 * T01 `ignoreIncomingRequestHook` excluding only `/api/v1/health*`).
 *
 * @see docs/DECISIONS.md ADR-011 (OTel-first; pg auto-instrument)
 * @see apps/gateway/src/idempotency/redis.client.ts (T01 pattern mirror)
 *
 * S-02 T06 emit.
 */

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';
import { createLogger, type IcpLogPayload } from '../observability';

@Injectable()
export class PgPool implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  });

  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      // env.schema.ts validates this at boot; defense-in-depth.
      throw new Error('DATABASE_URL missing — validation should have caught this at boot');
    }

    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
      // application_name surfaces in pg_stat_activity for ops debugging
      application_name: 'icp-gateway',
    };

    this.pool = new Pool(poolConfig);

    // Pool-level error handler (per pg docs — must subscribe to prevent
    // unhandled errors from crashing Node process on idle-client disconnect).
    this.pool.on('error', (err) => {
      this.log.error(
        { message: 'db.pool_idle_client_error', extras: { error: err.message } } as IcpLogPayload,
        'pg.Pool idle client error',
      );
    });
  }

  /**
   * Type-safe wrapper around `pool.query`. Caller passes generic for
   * `QueryResultRow` shape — TS infers `result.rows` accordingly.
   *
   * OTel `pg.query` span auto-emitted; trace_id carried via active context.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params as unknown[]);
  }

  /**
   * Single-row connection ping. Used by HealthService readiness check
   * (future S-03 wires when DB module fully consumed). T06 alone doesn't
   * call this — tracking.repository.ts uses `query()` directly.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ ok: number }>('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.log.info({ message: 'db.pool_closed' } as IcpLogPayload, 'pg.Pool closed gracefully');
  }
}
