/**
 * apps/gateway/src/tracking/tracking.controller.ts
 *
 * Exposes `POST /api/v1/track` — batch ingest endpoint for client behavior
 * events. Per `07_BEHAVIOR_LOGS.md` §4 pipeline diagram.
 *
 * **NO Idempotency middleware:** `/track` is NOT in the 4 routes registered
 * by `IdempotencyModule` (per ADR-004 + `03_API_CONTRACTS.md §1`). Dedup
 * happens at DB layer via composite PK `(event_id, occurred_at)` with
 * `ON CONFLICT DO NOTHING` — retry-safe without Redis lock.
 *
 * **Swagger:** Decorated with `@ApiTags('tracker')` + `@ApiOperation` +
 * `@ApiResponse` so `pnpm openapi:sync` regenerates `TrackingService` in
 * `packages/shared-types/src/api/services/` for FE typed client consumption.
 *
 * **C-31 (Phiên 27):** Since `03_API_CONTRACTS.md §1` doesn't list `/track`,
 * Swagger annotations here serve as authoritative contract. Phase 3
 * maintainer batch reconciles §1.
 *
 * **OTel:** Route is on standard Express auto-instrument path (NOT excluded
 * by T01 `ignoreIncomingRequestHook` — that excludes only `/api/v1/health*`).
 * No manual span needed; auto-instrument captures HTTP + child pg.query
 * spans naturally.
 *
 * S-02 T06 emit.
 */

import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TrackingService } from './tracking.service';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { TrackBatchDto } from './dto/track-batch.dto';
import type { TrackBatchResponse } from '@icp/shared-types';

@ApiTags('tracker')
@Controller('api/v1/track')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingest behavior events batch',
    description:
      'Accepts a batch of user behavior events from client tracker SDK. ' +
      'Validates each event against its event_type-specific properties schema; ' +
      'drops invalid or out-of-window events server-side (per 07_BEHAVIOR §9). ' +
      'Persists remaining via INSERT ... ON CONFLICT DO NOTHING (dedup by event_id+occurred_at PK).',
  })
  @ApiBody({
    type: TrackBatchDto,
    description: 'Batch of behavior events (1-500 per request).',
  })
  @ApiResponse({
    status: 202,
    description:
      'Batch accepted. Body reports accepted/dropped counts + request_id for log correlation.',
    schema: {
      type: 'object',
      required: ['accepted', 'dropped', 'request_id'],
      properties: {
        accepted: { type: 'integer', minimum: 0, example: 3 },
        dropped: { type: 'integer', minimum: 0, example: 0 },
        request_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Envelope validation failed (e.g. events array empty or >500 items).',
  })
  async ingest(
    @Body() body: TrackBatchDto,
    @Req() req: Request,
  ): Promise<TrackBatchResponse> {
    // request_id from upstream header if present (e.g. nginx X-Request-Id);
    // else generate fresh UUID v4.
    const upstreamRequestId = req.header('x-request-id');
    const requestId = upstreamRequestId && upstreamRequestId.length > 0
      ? upstreamRequestId
      : randomUUID();

    // S-P0-01 T02 (ADR-046 amend b): resolve tenant theo chain JWT→X-Tenant-Id→400.
    // KHÔNG silent drop — thiếu tenant context = 400 TenantContextMissing.
    const { tenantId } = this.tenantResolver.resolve(req);
    return this.trackingService.ingest(body, requestId, tenantId);
  }
}
