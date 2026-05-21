/**
 * apps/gateway/src/health/health.service.ts
 *
 * Health check service performing dep pings for readiness probe.
 *
 * Per docs/06_OBSERVABILITY.md §12 format:
 *   GET /api/v1/health         → 200 liveness (no deps)
 *   GET /api/v1/health/ready   → 200 readiness (all deps up) | 503 (any down)
 *
 * Deps checked:
 *   - postgres (placeholder — Postgres client wiring is T01-deferred, S-03+
 *     adds @nestjs/typeorm or similar. T01 ping is a TODO marker.)
 *   - redis (via RedisClient.ping())
 *   - kafka (placeholder — Kafka client wiring is T07+ scope)
 *   - otel-collector (placeholder — collector exposes /health on :13133
 *     internal port not bound to host; T01 ping omitted, span emission
 *     itself is implicit health check)
 *   - **ai** (S-02 T05 Phiên 26 — via AiClient.getHealth() ping AI Flask
 *     `GET /health`. Maps null → 'down', non-null + status=='ok' → 'up'.)
 *
 * Future hardening (S-03+):
 *   - Real Postgres pool ping (`SELECT 1`)
 *   - Real Kafka admin client `listTopics()`
 *   - Real OTel collector `wget http://otel-collector:13133/`
 *   - Real MCP ping (currently AI → MCP chain implicitly tested via T04 AC-11)
 */

import { Injectable } from '@nestjs/common';
import { RedisClient } from '../idempotency/redis.client';
import { AiClient } from '../clients/ai.client';

export type DepStatus = 'up' | 'down' | 'unknown';

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  deps: {
    postgres: DepStatus;
    redis: DepStatus;
    kafka: DepStatus;
    otel_collector: DepStatus;
    /**
     * AI service liveness (S-02 T05 — closes T01 'unknown' placeholder gap).
     * Pinged via AiClient.getHealth() → AI `GET /health`. Maps:
     *   - response 200 + status='ok' → 'up'
     *   - response non-2xx / network error / timeout → 'down'
     *   - getHealth() not yet called (shouldn't happen post-T05) → 'unknown'
     */
    ai: DepStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly redis: RedisClient,
    private readonly aiClient: AiClient,
  ) {}

  /**
   * Liveness — service process is running. Always returns ok.
   * NO dep checks (per 06_OBS §12: "liveness, cực nhanh").
   */
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Ping AI service /health. Returns 'up' on 200 + status=='ok',
   * 'down' on any other condition (network error, timeout, non-2xx,
   * unexpected payload). 'unknown' only if AiClient itself isn't
   * injected (defensive — shouldn't happen post-T05).
   *
   * Span emission: AiClient.getHealth() wraps its own
   * `gateway.client.ai.get_health` span (per 06_OBS §9.2), which becomes
   * child of the active `gateway.handler.ready` span (started by
   * HealthController.readiness — see file docstring).
   */
  private async aiCheck(): Promise<DepStatus> {
    const body = await this.aiClient.getHealth();
    if (!body) return 'down';
    return body.status === 'ok' ? 'up' : 'down';
  }

  /**
   * Readiness — service can serve traffic. Pings all deps.
   * Returns 'degraded' if any dep is down.
   */
  async readiness(): Promise<ReadinessReport> {
    // Run independent checks in parallel — keeps p99 close to slowest single
    // dep (currently AI 5s timeout) rather than sum-of-all.
    const [redisUp, aiStatus] = await Promise.all([
      this.redis.ping(),
      this.aiCheck(),
    ]);

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
        // AI service ping — S-02 T05 backfill.
        ai: aiStatus,
      },
    };

    // Degrade only on confirmed 'down', not on 'unknown'.
    if (Object.values(report.deps).some((s) => s === 'down')) {
      report.status = 'degraded';
    }

    return report;
  }
}
