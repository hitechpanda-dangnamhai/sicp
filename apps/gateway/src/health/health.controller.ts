/**
 * apps/gateway/src/health/health.controller.ts
 *
 * Exposes liveness + readiness HTTP endpoints per docs/06_OBSERVABILITY.md §12.
 *
 * Routes:
 *   GET /api/v1/health        → 200 { status: 'ok' }
 *   GET /api/v1/health/ready  → 200 { status, deps } | 503 if degraded
 *
 * Both endpoints are excluded from OTel HTTP auto-instrumentation (see
 * observability/otel.ts `ignoreIncomingRequestHook`) to keep Tempo signal-
 * to-noise high — health probes run every 30s × N replicas.
 *
 * S-02 T05 Phiên 26 — `readiness()` manually wraps its body in a span named
 * `gateway.handler.ready` so the cross-service trace Gateway → AI is visible
 * in Tempo (auto-instrument is suppressed for this path; if we didn't wrap
 * manually, the downstream AiClient span would be a root span with no
 * Gateway-side parent, breaking E2E correlation). Per 06_OBS §9.2 naming.
 * `liveness()` is intentionally NOT wrapped — k8s pings every 30s × infinity,
 * not worth the Tempo storage; outgoing calls (none in liveness) wouldn't
 * benefit from a parent span anyway.
 */

import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { trace, context, type Tracer } from '@opentelemetry/api';
import { HealthService } from './health.service';

/**
 * Lazy tracer resolution (S-02 T05 Phiên 26 mid-fix per C-28).
 *
 * Module-level `const _tracer = trace.getTracer(...)` cached at require-time
 * may return NoopTracer if controller loaded before NodeSDK.start() settles
 * its global TracerProvider. Lazy lookup resolves on first request when SDK
 * has registered → returns real ProxyTracer. See ai.client.ts for full
 * rationale + Phiên 26 manual smoke evidence.
 */
function getTracer(): Tracer {
  return trace.getTracer('gateway.handler.health');
}

@ApiTags('health')
@SkipThrottle() // W-60: health probe (k8s/compose) — KHÔNG throttle
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 if process is up. No dependency checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: { example: { status: 'ok' } },
  })
  liveness(): { status: 'ok' } {
    return this.health.liveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 if all dependencies are reachable. Returns 503 if any dep is down. ' +
      'Dependencies probed: postgres, redis, kafka, otel-collector, ai.',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'One or more deps unavailable' })
  async readiness(@Res({ passthrough: true }) res: Response): Promise<unknown> {
    // S-02 T05 — manual span wrap via explicit `tracer.startSpan` +
    // `context.with` (NOT `startActiveSpan` callback form) per Phiên 26
    // mid-fix C-28: lazy tracer + explicit context binding guarantees:
    //   1. Tracer resolved post-SDK-init (NoopTracer fix)
    //   2. Span context bound across async/await Promise chain
    //   3. AiClient.getHealth() inside this.health.readiness() inherits parent
    //      context → its manual span becomes proper child (visible in Tempo).
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.handler.ready');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const report = await this.health.readiness();
        span.setAttribute('readiness.status', report.status);
        span.setAttribute('readiness.deps.ai', report.deps.ai);
        span.setAttribute('readiness.deps.redis', report.deps.redis);
        if (report.status === 'degraded') {
          res.status(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return report;
      } finally {
        span.end();
      }
    });
  }
}
