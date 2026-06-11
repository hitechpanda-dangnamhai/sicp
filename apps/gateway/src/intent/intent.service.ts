/**
 * apps/gateway/src/intent/intent.service.ts
 *
 * S-02 T07 — Intent service (dispatch + cache + stub fan-out).
 * S-04 T03 amendment (Phiên Sx04-8b per D-S04-13 LAW Option Z + Pattern A):
 *   - REFACTOR `dispatch()` — AI service now returns SSE stream + X-Request-Id
 *     header; service caches request_id-only (response shape SHRUNK per
 *     `AiClient.AiIntentResponse` refactor).
 *   - REMOVE `buildStubSequence()` — Phase 1 stub fan-out replaced by
 *     real Redis pub/sub subscribe in `intent.controller.ts` /stream handler.
 *     Real SSE events now flow from AI graph nodes via Redis channel
 *     `sse:pubsub:{rid}` (Option Z architecture).
 *
 * Two responsibilities (S-04 T03 reduced from 3):
 *
 *   1. **dispatch(body)**: POST handler — invoke `AiClient.postIntent()` →
 *      cache request_id in Redis (TTL 60s) → return `{request_id}` for client
 *      to open SSE stream.
 *
 *   2. **lookup(requestId)**: existence check used by /stream auth gate to
 *      verify request_id is valid (cache hit = recently dispatched).
 *
 * The actual SSE event forwarding (was `buildStubSequence` in Phase 1) now
 * happens in `intent.controller.ts` /stream handler via
 * `RedisClient.raw().duplicate().subscribe('sse:pubsub:{rid}')`. Service has
 * no role in event production — clean separation: service = REST handling,
 * controller = transport (Redis sub → SSE forward).
 *
 * **Manual tracing (C-28 LOCKED)**: lazy `getTracer()` + `context.with(
 *   trace.setSpan(...), cb)`. NOT `startActiveSpan(cb)` per Phiên 26 lock.
 *
 * **Redis cache**: reuses `RedisClient` injected via `IdempotencyModule`
 *   exports (T01 line 28 `exports: [RedisClient, ...]`).
 *
 * @see slices/S-02_decisions-log.md D-03 + D-05 + C-28 + C-32 + C-36/37/38
 * @see slices/S-04_decisions-log.md D-S04-13 LAW (Option Z Redis pub/sub +
 *      Pattern A interrupt+resume)
 * @see docs/03_API_CONTRACTS.md §1.2 + §3
 * @see docs/02_DATA_MODEL.md §5 Redis key `intent:cache:{rid}` TTL 60s
 */

import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import {
  AiClient,
  type AiForwardContext,
  type AiIntentResponse,
  type PostIntentBody,
} from '../clients/ai.client';
import { RedisClient } from '../idempotency/redis.client';

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.service');
}

/** Redis key prefix for cached `AiIntentResponse` per request_id. TTL 60s. */
export const INTENT_CACHE_PREFIX = 'intent:cache:';
export const INTENT_CACHE_TTL_SECONDS = 60;

@Injectable()
export class IntentService {
  private readonly nestLogger = new NestLogger(IntentService.name);

  constructor(
    private readonly aiClient: AiClient,
    private readonly redis: RedisClient,
  ) {}

  /**
   * POST /api/v1/intent handler — forwards to AI service, caches request_id.
   *
   * Idempotency middleware (S-02 T01) already gates re-runs by `Idempotency-Key`
   * header — by the time we reach this service, the request is guaranteed
   * unique. We add our own `request_id` (UUID generated AI-side per
   * Q-Sx04-3-6 Option A LAW) for SSE stream correlation (separate concern
   * from idempotency).
   *
   * Returns `request_id` for client to open `GET /intent/stream?id=<rid>`.
   * AI service publishes SSE events to Redis channel `sse:pubsub:{rid}`; the
   * GET /stream handler subscribes the channel to forward events to FE
   * EventSource (Option Z architecture per D-S04-13 LAW).
   */
  async dispatch(
    body: PostIntentBody,
    ctx?: AiForwardContext,
  ): Promise<{ request_id: string; status: 'accepted' }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.dispatch');
    return context.with(trace.setSpan(context.active(), span), async () => {
      span.setAttribute('ai.modality', body.modality);
      if (body.mode) {
        span.setAttribute('ai.mode', body.mode);
      }
      const startedAt = Date.now();
      try {
        const aiResponse = await this.aiClient.postIntent(body, ctx);
        span.setAttribute('ai.request_id', aiResponse.request_id);

        // Cache request_id for SSE stream pickup gate. /stream handler checks
        // existence of this key to confirm request_id is valid + recent (TTL 60s).
        await this.redis.setWithTtl(
          `${INTENT_CACHE_PREFIX}${aiResponse.request_id}`,
          JSON.stringify({ request_id: aiResponse.request_id }),
          INTENT_CACHE_TTL_SECONDS,
        );

        this.nestLogger.log(
          JSON.stringify({
            message: 'intent.received',
            extras: {
              request_id: aiResponse.request_id,
              modality: body.modality,
              mode: body.mode ?? 'ai_augmented',
              intent_hint: body.hint,
              duration_ms: Date.now() - startedAt,
            },
          }),
        );

        return { request_id: aiResponse.request_id, status: 'accepted' as const };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({ message: 'intent.failed', error_message: msg }),
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Lookup cached `AiIntentResponse` for given `request_id`.
   * Returns null if not found (cache expired or invalid id).
   *
   * Used by /stream handler as auth/existence gate before opening SSE
   * connection. Cache hit = request_id was recently dispatched via POST
   * /intent + still within 60s window (matches typical user "open browser
   * → tap chip → SSE" flow well under 60s).
   */
  async lookup(requestId: string): Promise<AiIntentResponse | null> {
    const raw = await this.redis.get(`${INTENT_CACHE_PREFIX}${requestId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AiIntentResponse;
    } catch {
      return null;
    }
  }
}
