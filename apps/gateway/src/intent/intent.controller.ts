/**
 * apps/gateway/src/intent/intent.controller.ts
 *
 * S-02 T07 — Intent universal endpoint controller.
 *
 * Routes:
 *   POST /api/v1/intent           — accept payload, dispatch to AI, return 202 {request_id}
 *   GET  /api/v1/intent/stream    — SSE event stream for given request_id
 *
 * **Cookie auth (D-05 LOCK + ADR-019)**: `icp_session` cookie httpOnly required
 * for GET stream. Phase 1 stub: presence-check only (any non-empty value
 * accepted). JWT verify deferred S-03 First Auth Flow (BRIEF Non-Goals).
 *
 * **Cookie parse pattern (C-40)**: Express native does NOT parse cookies. We
 * parse `req.headers.cookie` inline (5 lines) instead of adding `cookie-parser`
 * dependency. Full middleware adoption deferred S-03 alongside JWT guard.
 *
 * **Heartbeat (15s per TASKLIST)**: separate `setInterval` loop emits
 * `event: heartbeat\ndata: {"ts": <epoch_ms>}` to keep connection alive +
 * trigger EventSource auto-reconnect on disconnect. NOT in typed map (C-36
 * LOCK — transport keepalive, no client schema).
 *
 * @see slices/S-02_decisions-log.md D-05 + C-28 + C-36/37/38/40
 * @see docs/03_API_CONTRACTS.md §1.2 + §3
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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { IntentRequestDto } from './dto/intent-request.dto';
import { IntentService, type SseFrame } from './intent.service';

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.controller');
}

/** Heartbeat interval per TASKLIST T07 row. */
const HEARTBEAT_INTERVAL_MS = 15_000;

/** Inter-event delay for stub fan-out (Phase 1 UX simulation; remove V-SLICE). */
const STUB_FRAME_DELAY_MS = 100;

/**
 * Parse `req.headers.cookie` header for a specific cookie name.
 * Returns value (decoded) or null. Per C-40 (inline parse, no cookie-parser dep).
 */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookies = header.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const eq = c.indexOf('=');
    if (eq < 0) continue;
    if (c.slice(0, eq) === name) {
      const raw = c.slice(eq + 1);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

/** Sleep helper for stub fan-out timing. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format one SSE frame string per W3C spec: `event: <name>\ndata: <json>\n\n`. */
function formatSse(frame: SseFrame): string {
  return `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
}

@ApiTags('intent')
@Controller('api/v1/intent')
export class IntentController {
  private readonly nestLogger = new NestLogger(IntentController.name);

  constructor(private readonly intentService: IntentService) {}

  /**
   * POST /api/v1/intent — dispatch user input to AI service.
   *
   * Idempotency-Key header gates dedup (T01 middleware). Body validates via
   * `nestjs-zod` `IntentRequestDto` (Phase 1: JSON only; multipart for
   * image/voice modality defer V-SLICE).
   *
   * Response 202 `{request_id, status: "accepted"}` — client then opens
   * `GET /api/v1/intent/stream?id=<request_id>` via EventSource.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Dispatch intent to AI service',
    description: 'Returns request_id for SSE stream pickup. See `GET /intent/stream`.',
  })
  @ApiBody({ type: IntentRequestDto })
  async dispatch(
    @Body() body: IntentRequestDto,
  ): Promise<{ request_id: string; status: 'accepted' }> {
    return this.intentService.dispatch(body);
  }

  /**
   * GET /api/v1/intent/stream?id=<request_id> — SSE event stream.
   *
   * Auth: `icp_session` cookie httpOnly (D-05 LOCK; presence-check Phase 1).
   * Heartbeat: 15s interval per TASKLIST T07.
   * Stream end: after `final` event, server closes connection (`res.end()`).
   */
  @Get('stream')
  @ApiOperation({
    summary: 'SSE stream of intent events',
    description:
      'Emits 10 typed events (per 03_API §3) + heartbeat keepalive. Requires icp_session cookie.',
  })
  @ApiCookieAuth('icp_session')
  async stream(
    @Query('id') requestId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.stream');
    await context.with(trace.setSpan(context.active(), span), async () => {
      try {
        span.setAttribute('intent.request_id', requestId ?? 'missing');

        // 1. Cookie auth check (D-05 + ADR-019).
        const session = readCookie(req, 'icp_session');
        if (!session || session.length === 0) {
          this.nestLogger.warn(
            JSON.stringify({
              message: 'intent.sse_session_missing',
              extras: { request_id: requestId },
            }),
          );
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'missing icp_session cookie' });
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Missing icp_session cookie' },
          });
        }

        // 2. Lookup cached AI response.
        if (!requestId) {
          throw new NotFoundException({
            error: { code: 'INVALID_INTENT', message: 'Missing query param: id' },
          });
        }
        const ai = await this.intentService.lookup(requestId);
        if (!ai) {
          throw new NotFoundException({
            error: {
              code: 'INVALID_INTENT',
              message: `request_id not found or expired: ${requestId}`,
            },
          });
        }

        // 3. Open SSE stream.
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
        res.flushHeaders();

        this.nestLogger.log(
          JSON.stringify({
            message: 'intent.sse_opened',
            extras: { request_id: requestId, intent: ai.intent },
          }),
        );

        // 4. Heartbeat interval.
        const heartbeat = setInterval(() => {
          if (res.writableEnded) return;
          res.write(formatSse({ event: 'heartbeat', data: { ts: Date.now() } }));
          this.nestLogger.debug(
            JSON.stringify({
              message: 'intent.sse_heartbeat_sent',
              extras: { request_id: requestId },
            }),
          );
        }, HEARTBEAT_INTERVAL_MS);

        // Cleanup on client disconnect.
        req.on('close', () => {
          clearInterval(heartbeat);
          if (!res.writableEnded) res.end();
        });

        // 5. Emit fan-out sequence (Phase 1 stub) — 4 frames with delay.
        try {
          for (const frame of this.intentService.buildStubSequence(ai)) {
            await sleep(STUB_FRAME_DELAY_MS);
            if (res.writableEnded) break;
            res.write(formatSse(frame));
          }
        } finally {
          clearInterval(heartbeat);
          if (!res.writableEnded) res.end();
          this.nestLogger.log(
            JSON.stringify({
              message: 'intent.sse_closed',
              extras: { request_id: requestId, intent: ai.intent },
            }),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
