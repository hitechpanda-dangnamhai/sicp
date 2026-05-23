/**
 * apps/gateway/src/tracking/tracking.repository.ts
 *
 * Persistence layer for `behavior_events` (V001 partitioned table, monthly
 * RANGE on `occurred_at`).
 *
 * **Idempotency at DB layer:** PK composite `(event_id, occurred_at)` per V001
 * C16 amendment. Batch INSERT uses `ON CONFLICT (event_id, occurred_at) DO
 * NOTHING` — duplicate `event_id` from retry/replay = silent no-op (no
 * application-level dedup needed; consistent with ADR-004 spirit but at lower
 * layer since `/track` is NOT in 4 Idempotency-Key routes).
 *
 * **Partitioning concern:** V001 pre-creates partitions m05/m06/m07 (Phase 2
 * scope). Events with `occurred_at` outside this range → PG error
 * "no partition of relation behavior_events found for row". Server-side bot
 * filter (`tracking.service.ts`) drops events with `occurred_at` > 1h future
 * or > 7d past per 07_BEHAVIOR §9.2, which keeps inserts within m05 window
 * during T06 smoke. KI-T06-1: production needs pg_partman auto-create.
 *
 * **OTel:** `pool.query()` auto-instrumented by `@opentelemetry/instrumentation-pg`
 * (loaded by T01 NodeSDK auto-instrument suite). The SQL span becomes child
 * of the controller's HTTP span automatically.
 *
 * S-02 T06 emit.
 */

import { Injectable } from '@nestjs/common';
import { PgPool } from '../database';
import type { BehaviorEvent } from '@icp/shared-types';

/**
 * Result of a batch INSERT operation.
 *
 * - `attempted`: input batch size
 * - `inserted`: rows actually created (NEW `event_id` — `ON CONFLICT` no-ops
 *   are NOT counted here)
 */
export interface InsertResult {
  attempted: number;
  inserted: number;
}

/**
 * Column order for the INSERT statement — keep stable.
 * Server fills `received_at` via DB DEFAULT NOW() (omitted from VALUES tuple).
 */
const COLS = [
  'event_id',
  'event_type',
  'occurred_at',
  'user_id',
  'session_id',
  'device_id',
  'intent',
  'modality',
  'request_id',
  'subject_type',
  'subject_id',
  'properties',
  'app_version',
] as const;

@Injectable()
export class TrackingRepository {
  constructor(private readonly pg: PgPool) {}

  /**
   * Batch INSERT validated events. Returns `inserted` count — caller
   * (`tracking.service.ts`) uses for response `accepted` field together with
   * pre-INSERT drop count.
   *
   * **Why parameterized VALUES vs single COPY:** pg-node `query()` with
   * positional params keeps OTel pg-instrumentation span clean (each batch =
   * 1 query span). COPY would bypass instrumentation; not needed at T06 scale
   * (batch ≤500 events, well under PG's 32k param limit at 13 cols/event).
   */
  async insertBatch(events: BehaviorEvent[]): Promise<InsertResult> {
    if (events.length === 0) {
      return { attempted: 0, inserted: 0 };
    }

    // Build positional placeholders: ($1,$2,...,$13), ($14,$15,...,$26), ...
    const placeholders: string[] = [];
    const params: unknown[] = [];
    events.forEach((e, idx) => {
      const base = idx * COLS.length;
      const rowPlaceholders = COLS.map((_, ci) => `$${base + ci + 1}`).join(', ');
      placeholders.push(`(${rowPlaceholders})`);
      params.push(
        e.event_id,
        e.event_type,
        e.occurred_at,
        e.user_id ?? null,
        e.session_id,
        e.device_id ?? null,
        e.intent ?? null,
        e.modality ?? null,
        e.request_id ?? null,
        e.subject_type ?? null,
        e.subject_id ?? null,
        JSON.stringify(e.properties),
        e.app_version,
      );
    });

    const sql = `
      INSERT INTO behavior_events (${COLS.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (event_id, occurred_at) DO NOTHING
    `;

    const result = await this.pg.query(sql, params);
    return {
      attempted: events.length,
      inserted: result.rowCount ?? 0,
    };
  }
}
