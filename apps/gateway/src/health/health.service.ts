/**
 * apps/gateway/src/health/health.service.ts
 *
 * Health check service performing dep pings for readiness probe.
 *
 * Per docs/06_OBSERVABILITY.md §12 format:
 *   GET /api/v1/health         → 200 liveness (no deps)
 *   GET /api/v1/health/ready   → 200 readiness (all deps up) | 503 (any down)
 *
 * Deps checked in T01:
 *   - postgres (placeholder — Postgres client wiring is T01-deferred, S-03+
 *     adds @nestjs/typeorm or similar. T01 ping is a TODO marker.)
 *   - redis (via RedisClient.ping())
 *   - kafka (placeholder — Kafka client wiring is T07+ scope)
 *   - otel-collector (placeholder — collector exposes /health on :13133
 *     internal port not bound to host; T01 ping omitted, span emission
 *     itself is implicit health check)
 *
 * Future hardening (S-03+):
 *   - Real Postgres pool ping (`SELECT 1`)
 *   - Real Kafka admin client `listTopics()`
 *   - Real OTel collector `wget http://otel-collector:13133/`
 */

import { Injectable } from '@nestjs/common';
import { RedisClient } from '../idempotency/redis.client';

export type DepStatus = 'up' | 'down' | 'unknown';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  deps: {
    postgres: DepStatus;
    redis: DepStatus;
    kafka: DepStatus;
    otel_collector: DepStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly redis: RedisClient) {}

  /**
   * Liveness — service process is running. Always returns ok.
   * NO dep checks (per 06_OBS §12: "liveness, cực nhanh").
   */
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness — service can serve traffic. Pings all deps.
   * Returns 'degraded' if any dep is down.
   */
  async readiness(): Promise<ReadinessReport> {
    const redisUp = await this.redis.ping();

    const report: ReadinessReport = {
      status: 'ok',
      deps: {
        // T01 scope: real Postgres pool ping requires wiring DB module —
        // deferred to S-03 First Auth Flow. Marked 'unknown' rather than
        // 'up' to be honest about T01 coverage.
        postgres: 'unknown',
        redis: redisUp ? 'up' : 'down',
        // Kafka client wiring deferred to T07+ (SSE wrapper + Kafka producer).
        kafka: 'unknown',
        // OTel collector: span emission is implicit health check. Explicit
        // ping deferred to Phase 06 (Grafana dashboards polish).
        otel_collector: 'unknown',
      },
    };

    // Degrade only on confirmed 'down', not on 'unknown'.
    if (Object.values(report.deps).some((s) => s === 'down')) {
      report.status = 'degraded';
    }

    return report;
  }
}
