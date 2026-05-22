/**
 * apps/gateway/src/tracking/tracking.service.ts
 *
 * Ingest orchestrator for `POST /api/v1/track`:
 * 1. Validate each event's `properties` against per-event-type Zod schema
 *    (07_BEHAVIOR §9.3 schema drift detection — invalid DROP, not 400)
 * 2. Bot filter: drop events with `occurred_at` > 1h future OR > 7d past
 *    (07_BEHAVIOR §9.2)
 * 3. INSERT remaining events via `TrackingRepository.insertBatch()` with
 *    `ON CONFLICT DO NOTHING` (DB-level dedup via PK composite)
 * 4. Emit ops logs per LOG_CATALOG.md Section A new entries (T06 batch):
 *    `tracker.batch_received`, `tracker.event_dropped`, `tracker.batch_persisted`,
 *    `tracker.persist_failed`, `db.behavior_partition_missing`
 *
 * **NO 4xx for invalid events** — drop semantics per 07_BEHAVIOR. Endpoint
 * always returns 202 with `{ accepted, dropped, request_id }`. Drop reasons
 * surface in ops log + future Grafana metric `icp.behavior.dropped`.
 *
 * S-02 T06 emit.
 */

import { Injectable } from '@nestjs/common';
import {
  validateProperties,
  type BehaviorEvent,
  type BehaviorEventType,
  type TrackBatch,
  type TrackBatchResponse,
} from '@icp/shared-types';
import { TrackingRepository } from './tracking.repository';
import { createLogger, type IcpLogPayload } from '../observability';

/** Reasons an event can be dropped server-side (filterable label). */
type DropReason =
  | 'properties_schema_mismatch'
  | 'occurred_at_future'
  | 'occurred_at_too_old';

/** Bot filter windows per `07_BEHAVIOR_LOGS.md` §9.2. */
const MAX_FUTURE_MS = 60 * 60 * 1000; // 1 hour
const MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Postgres error code `23514` = check_violation (incl. partition routing fail
 * "no partition of relation behavior_events found for row"). Treat as
 * structural error → emit `db.behavior_partition_missing` log.
 */
const PG_CHECK_VIOLATION_CODE = '23514';
const PG_PARTITION_MISSING_MSG_FRAGMENT = 'no partition of relation';

@Injectable()
export class TrackingService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  });

  constructor(private readonly repo: TrackingRepository) {}

  /**
   * Ingest one batch. Returns response envelope. NEVER throws on
   * per-event validation failure — those become `dropped`. ONLY throws if
   * DB unreachable / partition missing (logged + re-raised so NestJS exception
   * filter returns 500/503).
   */
  async ingest(batch: TrackBatch, requestId: string): Promise<TrackBatchResponse> {
    const startedAtMs = Date.now();
    const totalReceived = batch.events.length;

    this.log.info(
      {
        message: 'tracker.batch_received',
        request_id: requestId,
        extras: { event_count: totalReceived },
      } as IcpLogPayload,
      'tracker.batch_received',
    );

    // Validate + bot filter per-event
    const accepted: BehaviorEvent[] = [];
    let droppedCount = 0;
    const nowMs = Date.now();

    for (const event of batch.events) {
      // Schema drift detection per event_type
      const validation = validateProperties(
        event.event_type as BehaviorEventType,
        event.properties,
      );
      if (!validation.success) {
        droppedCount++;
        this.logDrop(requestId, event.event_type, 'properties_schema_mismatch');
        continue;
      }

      // Bot filter on occurred_at clock skew
      const occurredMs = new Date(event.occurred_at).getTime();
      const skew = occurredMs - nowMs;
      if (skew > MAX_FUTURE_MS) {
        droppedCount++;
        this.logDrop(requestId, event.event_type, 'occurred_at_future');
        continue;
      }
      if (skew < -MAX_PAST_MS) {
        droppedCount++;
        this.logDrop(requestId, event.event_type, 'occurred_at_too_old');
        continue;
      }

      accepted.push(event);
    }

    // Persist remaining
    let insertedCount = 0;
    if (accepted.length > 0) {
      try {
        const result = await this.repo.insertBatch(accepted);
        insertedCount = result.inserted;
      } catch (err) {
        this.handlePersistError(err, requestId, accepted.length);
        throw err; // let NestJS exception filter respond 500
      }
    }

    const durationMs = Date.now() - startedAtMs;
    this.log.info(
      {
        message: 'tracker.batch_persisted',
        request_id: requestId,
        extras: {
          accepted: insertedCount,
          dropped: droppedCount,
          duration_ms: durationMs,
        },
      } as IcpLogPayload,
      'tracker.batch_persisted',
    );

    return {
      accepted: insertedCount,
      dropped: droppedCount,
      request_id: requestId,
    };
  }

  private logDrop(requestId: string, eventType: string, reason: DropReason): void {
    this.log.warn(
      {
        message: 'tracker.event_dropped',
        request_id: requestId,
        extras: { reason, event_type: eventType },
      } as IcpLogPayload,
      'tracker.event_dropped',
    );
  }

  private handlePersistError(err: unknown, requestId: string, batchSize: number): void {
    const pgErr = err as { code?: string; message?: string };
    const isPartitionMissing =
      pgErr?.code === PG_CHECK_VIOLATION_CODE &&
      typeof pgErr.message === 'string' &&
      pgErr.message.includes(PG_PARTITION_MISSING_MSG_FRAGMENT);

    if (isPartitionMissing) {
      this.log.error(
        {
          message: 'db.behavior_partition_missing',
          request_id: requestId,
          extras: { batch_size: batchSize, pg_message: pgErr.message },
        } as IcpLogPayload,
        'db.behavior_partition_missing',
      );
      return;
    }

    this.log.error(
      {
        message: 'tracker.persist_failed',
        request_id: requestId,
        extras: {
          error_code: pgErr?.code ?? 'UNKNOWN',
          batch_size: batchSize,
          error_message: pgErr?.message,
        },
      } as IcpLogPayload,
      'tracker.persist_failed',
    );
  }
}
