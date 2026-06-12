/**
 * apps/gateway/src/intent/intent.controller.ts
 *
 * S-02 T07 — Intent universal endpoint controller.
 * S-04 T03 amendment (Phiên Sx04-8b per D-S04-13 LAW Option Z Redis pub/sub).
 *
 * Routes:
 *   POST /api/v1/intent           — accept payload, dispatch to AI, return 202 {request_id}
 *   GET  /api/v1/intent/stream    — SSE event stream for given request_id
 *
 * **Cookie auth (D-05 LOCK + ADR-019)**: `icp_session` cookie httpOnly required
 * for GET stream. Presence-check only (S-02 baseline) — full JWT verify still
 * via JwtAuthGuard on /action endpoint. EventSource API cannot send custom
 * Authorization headers, so /stream relies on cookie auto-send.
 *
 * **Cookie parse pattern (C-40)**: Express native does NOT parse cookies. We
 * parse `req.headers.cookie` inline (5 lines) instead of adding `cookie-parser`
 * dependency. S-03 T02 globally registered `cookie-parser` middleware in
 * main.ts so `req.cookies` IS available — but we keep inline parser here as
 * fallback for robustness + zero-dep S-02 pattern preservation.
 *
 * **Heartbeat (15s per TASKLIST)**: separate `setInterval` loop emits
 * `event: heartbeat\ndata: {"ts": <epoch_ms>}` to keep connection alive +
 * trigger EventSource auto-reconnect on disconnect. NOT in typed map (C-36
 * LOCK — transport keepalive, no client schema).
 *
 * **S-04 T03 STREAM HANDLER REWRITE (per D-S04-13 LAW Option Z):**
 *   Phase 1 (S-02 T07) stub fan-out via `IntentService.buildStubSequence()`
 *   REPLACED with Redis pub/sub subscribe pattern:
 *     1. Cookie auth + cache existence check unchanged (S-02 baseline)
 *     2. SSE headers + heartbeat unchanged
 *     3. Open Redis subscriber via `RedisClient.raw().duplicate()` (per
 *        ioredis pattern — single subscriber per connection)
 *     4. Subscribe channel `sse:pubsub:{request_id}`
 *     5. On Redis message: forward raw message to SSE response (AI publishes
 *        pre-formatted SSE blocks per `apps/ai/src/tools/redis_publisher.py`
 *        — Gateway just writes verbatim)
 *     6. 60s idle timeout for cart_action interrupt (Pattern P2 always-end
 *        interrupt at rank_finalize) → emit implicit `Command(resume={
 *        choice:'skip'})` to AI internal /resume + close SSE
 *     7. Cleanup: unsubscribe + log `sse.pubsub.unsubscribed` with reason
 *        enum (final_event | client_close | timeout)
 *
 * **Ops logs emitted** (per `LOG_CATALOG.md §A` + Phiên Sx04-8b T03 scope):
 *   - `sse.pubsub.subscribed`   — once at /stream open
 *   - `sse.pubsub.forwarded`    — debug-level per message forwarded
 *   - `sse.pubsub.unsubscribed` — once at cleanup with reason
 *
 * @see slices/S-02_decisions-log.md D-05 + C-28 + C-36/37/38/40
 * @see slices/S-04_decisions-log.md D-S04-13 LAW Option Z (Redis pub/sub)
 * @see docs/03_API_CONTRACTS.md §1.2 + §3
 * @see docs/02_DATA_MODEL.md §5 channel `sse:pubsub:{rid}` (ephemeral, no TTL)
 * @see docs/LOG_CATALOG.md §A.Intent + §A.SSE PubSub
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger as NestLogger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { AiClient } from '../clients/ai.client';
import { RedisClient } from '../idempotency/redis.client';
import { IntentRequestDto } from './dto/intent-request.dto';
import { IntentService } from './intent.service';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard';
import { TenantMembershipGuard } from '../tenant/tenant-membership.guard';

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.controller');
}

/** Heartbeat interval per TASKLIST T07 row (S-02 baseline). */
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW Option α):
 * Idle timeout for cart_action interrupt — graph paused at `rank_finalize`
 * waits for user cart choice. If user does nothing for 60s, Gateway emits
 * implicit `Command(resume={choice:'skip'})` to AI internal /resume so graph
 * can emit terminal `final` event + clean up checkpoint.
 *
 * Reset on each Redis message forwarded — only fires after true idleness.
 */
const CART_IDLE_TIMEOUT_MS = 300_000; // 5 min — accommodates S-07 Intent 01 import form fill time (Sx07-F fix)

/** Redis pub/sub channel template per `02_DATA_MODEL.md §5`. */
const SSE_PUBSUB_CHANNEL_PREFIX = 'sse:pubsub:';

/** Format heartbeat SSE frame string per W3C spec. */
function formatHeartbeat(): string {
  return `event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
}

@ApiTags('intent')
@Controller('api/v1/intent')
export class IntentController {
  private readonly nestLogger = new NestLogger(IntentController.name);

  constructor(
    private readonly intentService: IntentService,
    private readonly aiClient: AiClient,
    private readonly redis: RedisClient,
  ) {}

  /**
   * POST /api/v1/intent — dispatch user input to AI service.
   *
   * Idempotency-Key header gated by S-02 base `IdempotencyMiddleware` (wired
   * in `idempotency.module.ts` for this route). Body validates via
   * `nestjs-zod` `IntentRequestDto` (S-04 T03 ADD `mode` field per D-S04-03
   * LAW; default `'ai_augmented'`).
   *
   * Response 202 `{request_id, status: "accepted"}` — client then opens
   * `GET /api/v1/intent/stream?id=<request_id>` via EventSource.
   *
   * AI service returns SSE stream + X-Request-Id header; `AiClient.postIntent`
   * reads header + aborts body (graph runs async at AI side, publishes events
   * to Redis channel `sse:pubsub:{rid}`).
   */
  @Post()
  @UseGuards(JwtAuthGuard, TenantMembershipGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Dispatch intent to AI service',
    description:
      'Returns request_id for SSE stream pickup via GET /intent/stream?id=<rid>. ' +
      'S-04 T03: mode field selects Variant B (ai_augmented) or Variant A ' +
      '(basic_fallback) per D-S04-03 LAW Adaptive Single Endpoint. ' +
      'Sx05-3-CODE HOTFIX (D-S05-13 LAW): @UseGuards(JwtAuthGuard) added — ' +
      'req.user.id forwarded to AI as PostIntentBody.user_id so cart_by_text ' +
      'graph operates on correct authenticated cart.',
  })
  @ApiCookieAuth('icp_session')
  @ApiBody({ type: IntentRequestDto })
  async dispatch(
    @Body() body: IntentRequestDto,
    @Req() req: Request,
  ): Promise<{ request_id: string; status: 'accepted' }> {
    // Sx05-3-CODE HOTFIX (D-S05-13 LAW Cross-service User Context Propagation):
    // Extract JWT-resolved authenticated user_id from req.user (populated by
    // JwtAuthGuard above) → forward to AI service. Pre-hotfix this field was
    // never sent → AI fell back to 'smoke-user-anon' → wrong cart cleared
    // per Bug #1+#2 Phiên Sx05-3-CODE manual test discovery.
    const userId = req.user?.id ?? 'anon';
    // S-P0-01 T02 (2-phase): GIỮ body.user_id (AI hiện đọc field này tới T03) +
    // THÊM forward context → header X-User-Id/X-Tenant-Id (ADR-047/046). tenant
    // = req.tenant_id do TenantMembershipGuard set (URL, đã validate membership).
    return this.intentService.dispatch(
      { ...body, user_id: userId },
      { userId, tenantId: req.tenant_id ?? null },
    );
  }

  /**
   * GET /api/v1/intent/stream?id=<request_id> — SSE event stream.
   *
   * Auth: `icp_session` cookie httpOnly (D-05 LOCK; presence-check Phase 1;
   * future S-XX may add JWT verify since cookie-parser global is ready).
   *
   * S-04 T03 BEHAVIOR (per D-S04-13 LAW Option Z Redis pub/sub):
   *   - Subscribe Redis channel `sse:pubsub:{request_id}`
   *   - Forward each raw Redis message verbatim to FE EventSource (AI service
   *     publishes pre-formatted SSE blocks; no Gateway transformation)
   *   - Heartbeat 15s interval (S-02 baseline)
   *   - 60s idle timeout (resets on each message) → implicit /resume skip
   *   - Cleanup unsubscribe on: final event detected / req.close / timeout
   */
  @Get('stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'SSE stream of intent events',
    description:
      'Forwards Redis pub/sub channel `sse:pubsub:{rid}` to FE EventSource. ' +
      'S-04 T03: 17 typed event types (10 S-02 + 7 S-04) per 03_API §3. ' +
      'S-P0-01 T03c: JwtAuthGuard (cookie httpOnly, EventSource auto-send) + ' +
      'rid ownership-check (user + tenant∈membership). KHÔNG TenantMembershipGuard ' +
      '— EventSource không set được X-Tenant-Id (ADR-019 constraint).',
  })
  @ApiCookieAuth('icp_session')
  async stream(
    @Query('id') requestId: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.stream');
    await context.with(trace.setSpan(context.active(), span), async () => {
      span.setAttribute('intent.request_id', requestId ?? 'missing');

      // 1. Auth (S-P0-01 T03c F1 — khôi phục ADR-019 verify thật): JwtAuthGuard
      //    đã verify JWT cookie (signature/expiry/revocation) + populate req.user
      //    TRƯỚC handler. Thay cookie-presence check yếu cũ.
      if (!requestId) {
        span.end();
        throw new NotFoundException({
          error: { code: 'INVALID_INTENT', message: 'Missing query param: id' },
        });
      }

      // 2. F2 ownership-check: rid phải thuộc đúng owner (user + tenant∈membership).
      //    Mismatch/cache-miss → 404 ĐỒNG NHẤT (không lộ tồn tại rid của tenant khác).
      const owned = await this.intentService.assertOwnership(
        requestId,
        req.user.id,
        req.user.tenant_ids,
      );
      if (!owned) {
        // (null = cache-miss / cross-owner / orphan format cũ)
        span.setAttribute('intent.ownership_denied', true);
        span.end();
        throw new NotFoundException({
          error: {
            code: 'INVALID_INTENT',
            message: `request_id not found or expired: ${requestId}`,
          },
        });
      }

      // 3. Open SSE response.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
      res.flushHeaders();

      // Initial colon-prefix comment helps some proxies flush headers.
      res.write(':connected\n\n');

      this.nestLogger.log(
        JSON.stringify({
          message: 'intent.sse_opened',
          extras: { request_id: requestId },
        }),
      );

      // 4. Heartbeat interval — S-02 baseline 15s keep-alive.
      const heartbeat = setInterval(() => {
        if (res.writableEnded) return;
        res.write(formatHeartbeat());
      }, HEARTBEAT_INTERVAL_MS);

      // 5. Open Redis subscriber via ioredis.duplicate() per D-S04-13 LAW
      //    Option Z. duplicate() creates a NEW connection from same config;
      //    required because a connection in subscriber mode cannot issue
      //    other commands.
      const subscriber = this.redis.raw().duplicate();
      // S-P0-01 T03b: kênh SSE tenant-scoped `sse:pubsub:{tenant}:{rid}` —
      // tenant = owned.tenant_id (intent:cache, ĐÃ verify ownership T03c), KHỚP
      // kênh AI publish (gỡ dual-publish). KHÔNG lấy tenant từ JWT (ADR-046).
      // assertOwnership trả null nếu tenant_id null → owned.tenant_id non-null tại đây.
      const tenantId = owned.tenant_id as string;
      const channel = `${SSE_PUBSUB_CHANNEL_PREFIX}${tenantId}:${requestId}`;
      span.setAttribute('redis.channel', channel);
      span.setAttribute('intent.tenant_id', tenantId);

      let cleanupReason: 'final_event' | 'client_close' | 'timeout' = 'client_close';
      let idleTimeoutId: NodeJS.Timeout | null = null;
      let cleanedUp = false;

      // Reset idle timeout on each forwarded message. After 60s of no activity,
      // assume graph is interrupt-paused (cart_action Pattern P2) → emit
      // implicit /resume with choice='skip' so graph emits terminal events.
      const resetIdleTimeout = (): void => {
        if (idleTimeoutId) clearTimeout(idleTimeoutId);
        idleTimeoutId = setTimeout(async () => {
          if (cleanedUp || res.writableEnded) return;
          cleanupReason = 'timeout';
          this.nestLogger.warn(
            JSON.stringify({
              message: 'intent.sse_idle_timeout',
              extras: {
                request_id: requestId,
                channel,
                timeout_ms: CART_IDLE_TIMEOUT_MS,
              },
            }),
          );
          try {
            // Best-effort implicit skip resume. If AI graph already finished
            // or no interrupt pending, AI returns 4xx/5xx — we swallow since
            // we're closing anyway.
            await this.aiClient.postIntentResume(requestId, {
              choice: 'skip',
              _meta: { attempt_n: 1 },
            });
          } catch (err) {
            this.nestLogger.warn(
              JSON.stringify({
                message: 'intent.sse_idle_timeout_resume_failed',
                error_message: err instanceof Error ? err.message : String(err),
                extras: { request_id: requestId },
              }),
            );
          }
          if (!res.writableEnded) res.end();
        }, CART_IDLE_TIMEOUT_MS);
      };

      const doCleanup = async (): Promise<void> => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        if (idleTimeoutId) clearTimeout(idleTimeoutId);
        try {
          await subscriber.unsubscribe(channel);
        } catch {
          // ignore — subscriber may already be closing
        }
        try {
          await subscriber.quit();
        } catch {
          // ignore
        }
        this.nestLogger.log(
          JSON.stringify({
            message: 'sse.pubsub.unsubscribed',
            extras: { channel, request_id: requestId, reason: cleanupReason },
          }),
        );
      };

      // Subscribe + register message handler BEFORE awaiting subscribe call
      // to avoid race where graph publishes before we're listening.
      subscriber.on('message', (chan: string, raw: string) => {
        if (chan !== channel) return;
        if (res.writableEnded) return;

        // Raw message from AI Python `redis.publish()` is pre-formatted SSE
        // block: `event: <type>\ndata: <json>\n\n`. Write verbatim — Gateway
        // is pure transport.
        const block = raw.endsWith('\n\n') ? raw : raw + '\n\n';
        res.write(block);

        // Extract event_type for telemetry (parse first line `event: <name>`).
        let eventType = 'unknown';
        const firstNewline = raw.indexOf('\n');
        if (firstNewline > 0) {
          const firstLine = raw.slice(0, firstNewline);
          if (firstLine.startsWith('event: ')) {
            eventType = firstLine.slice(7).trim();
          }
        }
        this.nestLogger.debug(
          JSON.stringify({
            message: 'sse.pubsub.forwarded',
            extras: { channel, event_type: eventType, request_id: requestId },
          }),
        );

        // Detect terminal `final` event → cleanup + close.
        if (eventType === 'final') {
          cleanupReason = 'final_event';
          // Schedule cleanup async (don't block message handler).
          setImmediate(async () => {
            await doCleanup();
            if (!res.writableEnded) res.end();
          });
          return;
        }

        // Any non-final message resets the idle timer.
        resetIdleTimeout();
      });

      try {
        await subscriber.subscribe(channel);
        this.nestLogger.log(
          JSON.stringify({
            message: 'sse.pubsub.subscribed',
            extras: { channel, request_id: requestId },
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({
            message: 'sse.pubsub.subscribe_failed',
            error_message: msg,
            extras: { channel, request_id: requestId },
          }),
        );
        clearInterval(heartbeat);
        await doCleanup();
        if (!res.writableEnded) res.end();
        span.end();
        return;
      }

      // Start idle timeout AFTER subscribe — covers entire SSE lifetime.
      resetIdleTimeout();

      // 6. Cleanup on client disconnect (browser tab close, FE EventSource.close()).
      req.on('close', async () => {
        if (cleanupReason === 'client_close') {
          // Only set reason if not already set by final_event or timeout path.
        }
        await doCleanup();
      });

      // Note: span.end() called inside cleanup paths above OR here if we
      // reach the end of the handler synchronously. Since SSE keeps the
      // response open, we end the span at subscription complete (manual
      // span scope is the SETUP work, not the entire stream lifetime —
      // streaming spans would be high-cardinality and unhelpful).
      span.end();
    });
  }
}
