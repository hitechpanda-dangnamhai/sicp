/**
 * apps/gateway/src/intent/intent-action.controller.ts
 *
 * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW Pattern A interrupt+resume).
 *
 * Routes:
 *   POST /api/v1/intent/:rid/action — resume interrupted graph with user choice
 *
 * **Flow** (per `03_API_CONTRACTS.md §1.2` lines 83-100 Pattern A semantics):
 *   1. JwtAuthGuard validates `icp_session` cookie (req.user populated)
 *   2. IntentActionIdempotencyMiddleware (wired in intent.module.ts) gates
 *      dedup via composite key `intent:action:{rid}:{attempt_n}` TTL 5min
 *   3. nestjs-zod pipe validates body shape per `IntentActionDto`
 *   4. Controller forwards body to AI internal `POST /intent/{rid}/resume`
 *   5. AI returns 202 JSON immediately (resume thread spawned background);
 *      new SSE events flow to same `sse:pubsub:{rid}` channel /stream is
 *      already subscribed to (Option Z architecture per D-S04-13 LAW)
 *
 * **Why JwtAuthGuard here vs cookie-presence-only:** /action endpoint
 * mutates session state (cart action, retry path) — needs authenticated user
 * for traceability. /stream endpoint uses cookie-presence-only (S-02 T07
 * decision D-05 LOCK + ADR-019) because SSE EventSource cannot send custom
 * Authorization headers; relies on cookie auto-send. /action is regular POST,
 * full JwtAuthGuard applies.
 *
 * **Op log emit:** `intent.action_received` per `LOG_CATALOG.md §A.Intent`
 * → request_id + choice + attempt_n + user_id for audit trail (paired with
 * AI-side `intent.resumed` op log for end-to-end correlation).
 *
 * @see docs/03_API_CONTRACTS.md §1.2 Pattern A
 * @see docs/02_DATA_MODEL.md §5 (composite key namespace)
 * @see slices/S-04_decisions-log.md D-S04-13 LAW
 * @see apps/ai/src/main.py line 477-530 (POST /intent/<rid>/resume handler)
 */

import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger as NestLogger,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { IntentPolicyGuard } from './intent-policy.guard';
import { AiClient } from '../clients/ai.client';
import { IntentService } from './intent.service';
import { IntentActionDto } from './dto/intent-action.dto';
import { Idempotent } from '../idempotency/idempotent.decorator';

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.action_controller');
}

@ApiTags('intent')
@Controller('api/v1/intent')
export class IntentActionController {
  private readonly nestLogger = new NestLogger(IntentActionController.name);

  constructor(
    private readonly aiClient: AiClient,
    private readonly intentService: IntentService,
  ) {}

  /**
   * POST /api/v1/intent/:rid/action — resume interrupted graph.
   *
   * Idempotency gated by `IntentActionIdempotencyMiddleware` (wired in
   * intent.module.ts) — composite key `intent:action:{rid}:{attempt_n}` TTL
   * 5min per `02_DATA_MODEL.md §5`. Different attempt_n = legitimate retry
   * path (D-S04-13 LAW + 03_API §1.2 line 95).
   *
   * Auth via JwtAuthGuard (S-03 T02). req.user populated for ops log.
   *
   * Returns 202 immediately — graph resume runs async at AI side; new SSE
   * events flow to FE via existing /stream connection (no FE reconnect).
   */
  @Post(':rid/action')
  @Idempotent({ strategy: 'intent-action' }) // #31/ADR-048/049: composite key {tenant}:{rid}:{attempt_n} 5min, tenant verified
  @UseGuards(JwtAuthGuard, IntentPolicyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Resume interrupted intent graph with user choice',
    description:
      'Forwards action body to AI service /intent/{rid}/resume endpoint. ' +
      'AI calls graph.astream(Command(resume=<choice>)) to continue from ' +
      'Pattern P2 interrupt checkpoint. SSE events flow back via existing ' +
      'GET /intent/stream connection (Option Z Redis pub/sub).',
  })
  @ApiCookieAuth('icp_session')
  @ApiParam({ name: 'rid', description: 'request_id from POST /intent response' })
  @ApiBody({ type: IntentActionDto })
  async action(
    @Param('rid') rid: string,
    @Body() body: IntentActionDto,
    @Req() req: AuthedRequest,
  ): Promise<{ request_id: string; status: 'accepted' }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.action');
    return context.with(trace.setSpan(context.active(), span), async () => {
      span.setAttribute('intent.request_id', rid);
      span.setAttribute('intent.action.choice', body.choice);
      const attemptN = body._meta?.attempt_n ?? 1;
      span.setAttribute('intent.action.attempt_n', attemptN);
      const userId = req.user.id;

      // S-P0-01 T03c F2 ownership-check: rid phải thuộc đúng owner (user +
      // tenant_id non-null) TRƯỚC resume. IntentPolicyGuard (:guard) chỉ tenant
      // strict; KHÔNG ràng buộc rid↔owner → user cùng tenant vẫn có thể resume
      // rid của người khác nếu thiếu check này.
      // Mismatch/cache-miss → 404 ĐỒNG NHẤT (không lộ tồn tại rid).
      const owned = await this.intentService.assertOwnership(rid, userId);
      if (!owned) {
        span.setAttribute('intent.ownership_denied', true);
        span.end();
        throw new NotFoundException({
          error: {
            code: 'INVALID_INTENT',
            message: `request_id not found or expired: ${rid}`,
          },
        });
      }

      // T03e (ADR-050 §4): policy enforce từ intent:cache SAU ownership, KHÔNG
      // parse lại body. Customer-allowed (02/03/04/05) PASS; membership-required
      // (01/07) đòi owner ∈ tenant_ids (ca membership đổi trong TTL 60s). → 403.
      if (!this.intentService.isMembershipSatisfied(owned, req.user.tenant_ids)) {
        span.setAttribute('intent.membership_denied', true);
        span.end();
        throw new ForbiddenException({
          error: { code: 'TENANT_FORBIDDEN', message: 'Intent requires tenant membership' },
        });
      }

      this.nestLogger.log(
        JSON.stringify({
          message: 'intent.action_received',
          extras: {
            request_id: rid,
            choice: body.choice,
            attempt_n: attemptN,
            user_id: userId,
            has_value: body.value !== undefined,
          },
        }),
      );

      try {
        const result = await this.aiClient.postIntentResume(
          rid,
          {
            choice: body.choice,
            value: body.value,
            _meta: { attempt_n: attemptN },
          },
          // S-P0-01 T02 (ADR-047/046): forward identity header X-User-Id/X-Tenant-Id.
          // tenant = req.tenant_id do TenantMembershipGuard set (URL validated).
          { userId, tenantId: req.tenant_id ?? null },
        );
        return { request_id: result.request_id, status: 'accepted' as const };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({
            message: 'intent.action_failed',
            error_message: msg,
            extras: { request_id: rid, choice: body.choice, attempt_n: attemptN },
          }),
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
