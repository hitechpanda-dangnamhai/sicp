/**
 * apps/workers/src/housekeeper.ts
 *
 * ICP housekeeper worker — viên gạch worker THẬT đầu tiên (S-P0-02/T02,
 * BACKLOG #12 lộ trình 8 worker). Cron job:
 *   (a) tạo partition `behavior_events` rolling +N tháng (idempotent
 *       CREATE TABLE IF NOT EXISTS ... PARTITION OF) — gỡ bom W-66
 *       (V001:289 partition cuối hết hạn 2026-08-01 → INSERT FAIL).
 *   (b) REFRESH MATERIALIZED VIEW CONCURRENTLY mọi matview (discover qua
 *       pg_matviews — DB catalog = Single Home danh sách, chống drift khi
 *       thêm matview) — gỡ W-67 (fn refresh_analytics_aggregations có,
 *       KHÔNG caller → analytics stale mãi).
 *   (c) leader-lock Redis SETNX (NX PX) per-job → 1 instance chạy mỗi tick.
 *       SPOF Redis chấp nhận tới C3-RT Redis HA (map BACKLOG §3).
 *
 * Quyết định KHÔNG hiển nhiên:
 *  - KHÔNG pg_partman extension: prod managed-PG chưa chọn (ADR/slice T02).
 *    Swap sang pg_partman sau nếu prod có — DDL idempotent đã tương thích.
 *  - Refresh từng matview RIÊNG (KHÔNG gọi fn refresh_analytics_aggregations):
 *    per-matview span + duration + error-isolation (1 matview lỗi không chặn
 *    matview khác). CONCURRENTLY = không khoá đọc (cần UNIQUE index, đã có V006).
 *  - Mọi op IDEMPOTENT + atomic-per-statement → kill giữa chừng an toàn:
 *    CREATE IF NOT EXISTS no-op khi đã có; REFRESH CONCURRENTLY atomic swap
 *    (rollback nếu gián đoạn); lock auto-expire qua TTL. Restart re-run sạch.
 */

import './observability/otel'; // ⚠️ PHẢI Ở DÒNG ĐẦU — auto-instrument pg/ioredis.

import cron, { ScheduledTask } from 'node-cron';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger, sdk } from './observability';
import {
  computeRollingPartitions,
  buildPartitionDDL,
  acquireLeaderLock,
  releaseLeaderLock,
} from './housekeeper-core';

const tracer = trace.getTracer('workers.housekeeper');
const logger = createLogger({
  service: process.env.OTEL_SERVICE_NAME ?? 'workers',
  version: process.env.APP_VERSION ?? '0.0.1',
});

// ── Config (env-tunable) ────────────────────────────────────────────────────
const MATVIEW_CRON = process.env.HOUSEKEEPER_MATVIEW_CRON ?? '*/15 * * * *'; // 15min
const PARTITION_CRON = process.env.HOUSEKEEPER_PARTITION_CRON ?? '0 3 * * *'; // 03:00 hằng ngày
const MONTHS_AHEAD = Number(process.env.HOUSEKEEPER_PARTITION_MONTHS_AHEAD ?? '3');
const LOCK_TTL_MS = Number(process.env.HOUSEKEEPER_LOCK_TTL_MS ?? '240000'); // 4min
const STATEMENT_TIMEOUT_MS = Number(process.env.HOUSEKEEPER_STATEMENT_TIMEOUT_MS ?? '120000'); // 2min
const INSTANCE_ID =
  process.env.HOUSEKEEPER_INSTANCE_ID ?? `${process.env.HOSTNAME ?? 'local'}-${process.pid}`;

// ── DB operations ────────────────────────────────────────────────────────────

async function ensurePartitions(pool: Pool): Promise<number> {
  return tracer.startActiveSpan('housekeeper.ensure_partitions', async (span) => {
    const t0 = Date.now();
    try {
      const specs = computeRollingPartitions(new Date(), MONTHS_AHEAD);
      for (const spec of specs) {
        await pool.query(buildPartitionDDL(spec));
      }
      span.setAttribute('housekeeper.partitions', specs.length);
      logger.info({
        message: 'housekeeper.partition_ensured',
        ok: true,
        duration_ms: Date.now() - t0,
        extras: { count: specs.length, names: specs.map((s) => s.name) },
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return specs.length;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      logger.error({
        message: 'housekeeper.partition_ensure_failed',
        ok: false,
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function refreshMatviews(pool: Pool): Promise<{ refreshed: number; failed: number }> {
  return tracer.startActiveSpan('housekeeper.refresh_matviews', async (span) => {
    let refreshed = 0;
    let failed = 0;
    // Discover qua pg_matviews — DB catalog = Single Home danh sách matview.
    const { rows } = await pool.query<{ matviewname: string }>(
      "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname",
    );
    for (const { matviewname } of rows) {
      const t0 = Date.now();
      try {
        // CONCURRENTLY = không khoá đọc. Statement riêng (autocommit) — KHÔNG bọc
        // BEGIN (CONCURRENTLY cấm trong transaction block tường minh).
        await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${matviewname}`);
        refreshed++;
        logger.info({
          message: 'housekeeper.matview_refreshed',
          ok: true,
          duration_ms: Date.now() - t0,
          extras: { matview: matviewname },
        });
      } catch (err) {
        failed++;
        // Error-isolation: 1 matview lỗi (vd thiếu UNIQUE index) không chặn cái khác.
        logger.error({
          message: 'housekeeper.matview_refresh_failed',
          ok: false,
          duration_ms: Date.now() - t0,
          error_message: err instanceof Error ? err.message : String(err),
          extras: { matview: matviewname },
        });
      }
    }
    span.setAttribute('housekeeper.matviews_refreshed', refreshed);
    span.setAttribute('housekeeper.matviews_failed', failed);
    span.end();
    return { refreshed, failed };
  });
}

// ── Tick orchestration (leader-gated) ────────────────────────────────────────

async function runLeaderGated(
  redis: Redis,
  jobName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const lockKey = `housekeeper:lock:${jobName}`;
  const acquired = await acquireLeaderLock(redis, lockKey, INSTANCE_ID, LOCK_TTL_MS);
  if (!acquired) {
    logger.debug({
      message: 'housekeeper.tick_skipped_not_leader',
      extras: { job: jobName, instance: INSTANCE_ID },
    });
    return;
  }
  logger.debug({
    message: 'housekeeper.leader_acquired',
    extras: { job: jobName, instance: INSTANCE_ID },
  });
  try {
    await fn();
  } finally {
    await releaseLeaderLock(redis, lockKey, INSTANCE_ID);
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

let pool: Pool;
let redis: Redis;
const tasks: ScheduledTask[] = [];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL env var not set');
  if (!redisUrl) throw new Error('REDIS_URL env var not set');

  pool = new Pool({
    connectionString: databaseUrl,
    max: 4, // worker nhẹ, ít kết nối (pool gateway max 10 — đây thấp hơn)
    statement_timeout: STATEMENT_TIMEOUT_MS, // timeout I/O DB (DoD §5)
    connectionTimeoutMillis: 10_000,
  });
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, connectTimeout: 10_000 });

  logger.info({
    message: 'housekeeper.started',
    extras: {
      instance: INSTANCE_ID,
      // git_sha: S-P0-03/T01 deploy-drift gate. Workers have no HTTP surface, so
      // the baked GIT_SHA surfaces in the startup log for deploy verification.
      git_sha: process.env.GIT_SHA ?? 'dev',
      matview_cron: MATVIEW_CRON,
      partition_cron: PARTITION_CRON,
      months_ahead: MONTHS_AHEAD,
    },
  });

  // Chạy NGAY lúc start (đừng đợi cron tick đầu) — gỡ bom + refresh tức thì.
  await runLeaderGated(redis, 'partition', async () => void (await ensurePartitions(pool)));
  await runLeaderGated(redis, 'matview', async () => void (await refreshMatviews(pool)));

  tasks.push(
    cron.schedule(PARTITION_CRON, () => {
      void runLeaderGated(redis, 'partition', async () => void (await ensurePartitions(pool)));
    }),
  );
  tasks.push(
    cron.schedule(MATVIEW_CRON, () => {
      void runLeaderGated(redis, 'matview', async () => void (await refreshMatviews(pool)));
    }),
  );
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ message: 'housekeeper.shutting_down', extras: { signal } });
  for (const t of tasks) t.stop();
  try {
    if (redis) {
      await releaseLeaderLock(redis, 'housekeeper:lock:partition', INSTANCE_ID);
      await releaseLeaderLock(redis, 'housekeeper:lock:matview', INSTANCE_ID);
      redis.disconnect();
    }
    if (pool) await pool.end();
    await sdk.shutdown(); // flush spans
  } catch {
    // đang shutdown — không nơi log đáng tin.
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Chỉ chạy khi là entrypoint (KHÔNG khi import từ spec).
if (process.env.HOUSEKEEPER_TEST !== '1') {
  main().catch((err) => {
    logger.error({
      message: 'housekeeper.bootstrap_failed',
      ok: false,
      error_message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}
