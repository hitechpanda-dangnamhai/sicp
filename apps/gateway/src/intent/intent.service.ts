/**
 * apps/gateway/src/intent/intent.service.ts
 *
 * S-02 T07 — Intent service. Two responsibilities:
 *
 *   1. **dispatch(body)**: POST handler — invoke `AiClient.postIntent()` →
 *      cache response in Redis keyed by `request_id` (TTL 60s) → return
 *      `{request_id}` for client to open SSE stream.
 *
 *   2. **buildEventStream(requestId)**: GET stream handler — yield typed SSE
 *      event sequence for stub intent (D-03 router returns "unknown"). Phase 1
 *      sequence: `status:classifying → status:analyzing → status:done → final`
 *      (real `tool_call`/`tool_result`/`products`/`card`/`chart`/`order_update`
 *      defer V-SLICE per BRIEF §4 Non-Goals).
 *
 * **Pattern: Gateway-side wrapping** (per Phiên N decision X):
 *   - AI service emits JSON (T03 D-03 stub) — Gateway translates to SSE
 *     events. AI service NOT touched (Non-Goals protection).
 *
 * **Manual tracing (C-28 LOCKED)**: lazy `getTracer()` + `context.with(
 *   trace.setSpan(...), cb)`. NOT `startActiveSpan(cb)` per Phiên 26 lock.
 *
 * **Redis cache**: reuses `RedisClient` injected via `IdempotencyModule`
 *   exports (T01 line 28 `exports: [RedisClient, ...]`).
 *
 * @see slices/S-02_decisions-log.md D-03 + D-05 + C-28 + C-32 + C-36/37/38
 * @see docs/03_API_CONTRACTS.md §1.2 + §3
 */

import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import {
  type IntentStreamEventType,
  type IntentStreamEventMap,
} from '@icp/shared-types';
import { AiClient, type AiIntentResponse, type PostIntentBody } from '../clients/ai.client';
import { RedisClient } from '../idempotency/redis.client';

/** Lazy tracer per C-28 LOCK. */
function getTracer(): Tracer {
  return trace.getTracer('gateway.intent.service');
}

/** Redis key prefix for cached `AiIntentResponse` per request_id. TTL 60s. */
const INTENT_CACHE_PREFIX = 'intent:cache:';
const INTENT_CACHE_TTL_SECONDS = 60;

/** Single SSE event tuple — emitted via `for await` generator. */
export interface SseFrame {
  event: IntentStreamEventType | 'heartbeat';
  data: unknown;
}

@Injectable()
export class IntentService {
  private readonly nestLogger = new NestLogger(IntentService.name);

  constructor(
    private readonly aiClient: AiClient,
    private readonly redis: RedisClient,
  ) {}

  /**
   * POST /api/v1/intent handler — forwards to AI service, caches response.
   *
   * Idempotency middleware (T01) already gates re-runs by `Idempotency-Key`
   * header — by the time we reach this service, the request is guaranteed
   * unique. We add our own `request_id` (UUID) for SSE stream correlation
   * (separate concern from idempotency).
   *
   * Returns `request_id` for client to open `GET /intent/stream?id=<rid>`.
   */
  async dispatch(body: PostIntentBody): Promise<{ request_id: string; status: 'accepted' }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.intent.dispatch');
    return context.with(trace.setSpan(context.active(), span), async () => {
      span.setAttribute('ai.modality', body.modality);
      const startedAt = Date.now();
      try {
        const aiResponse = await this.aiClient.postIntent(body);
        span.setAttribute('ai.intent', aiResponse.intent);
        span.setAttribute('ai.request_id', aiResponse.request_id);

        // Cache for SSE stream pickup.
        await this.redis.setWithTtl(
          `${INTENT_CACHE_PREFIX}${aiResponse.request_id}`,
          JSON.stringify(aiResponse),
          INTENT_CACHE_TTL_SECONDS,
        );

        this.nestLogger.log(
          JSON.stringify({
            message: 'intent.received',
            extras: {
              request_id: aiResponse.request_id,
              modality: body.modality,
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

  /**
   * Build SSE frame sequence for stub intent (Phase 1 fan-out).
   *
   * Sequence (D-03 stub flow):
   *   status:classifying → status:analyzing → status:done → final
   *
   * Real `tool_call`/`tool_result`/etc. emit defer V-SLICE S-04..S-10.
   * Heartbeat (every 15s) is emitted by controller loop, not generator.
   */
  *buildStubSequence(ai: AiIntentResponse): Generator<SseFrame, void, void> {
    yield { event: 'status', data: { phase: 'classifying' } satisfies IntentStreamEventMap['status'] };
    yield { event: 'status', data: { phase: 'analyzing' } satisfies IntentStreamEventMap['status'] };
    yield { event: 'status', data: { phase: 'done' } satisfies IntentStreamEventMap['status'] };
    yield {
      event: 'final',
      data: {
        text: `Intent classified as ${ai.intent}`,
        summary: { request_id: ai.request_id, intent: ai.intent, confidence: ai.confidence },
      } satisfies IntentStreamEventMap['final'],
    };
  }
}
