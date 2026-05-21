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
 */

import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
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
      'Dependencies probed: postgres, redis, kafka, otel-collector.',
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'One or more deps unavailable' })
  async readiness(@Res({ passthrough: true }) res: Response): Promise<unknown> {
    const report = await this.health.readiness();
    if (report.status === 'degraded') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
