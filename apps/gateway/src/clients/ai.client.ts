/**
 * apps/gateway/src/clients/ai.client.ts
 *
 * NestJS @Injectable() HTTP client for the ICP AI service (Flask + LangGraph).
 *
 * S-02 T05 (Phiên 26) — Trace propagation E2E verify Gateway → AI → MCP.
 *
 * **S-04 T03 amendment (Phiên Sx04-8b per D-S04-13 LAW Option Z + Pattern A):**
 * `postIntent()` REFACTOR — AI service now returns SSE stream (text/event-stream)
 * instead of JSON. Gateway pattern: read `X-Request-Id` response header, abort
 * response body via `AbortController` (graph thread already spawned fire-and-forget
 * at AI side per `apps/ai/src/main.py` line 450), return `{request_id}` only.
 * AI side publishes SSE events to Redis pub/sub channel `sse:pubsub:{rid}` —
 * Gateway `intent.controller.ts` /stream handler subscribes the channel to
 * forward to FE EventSource (Option Z architecture).
 *
 * `postIntentResume()` NEW — Gateway forwards `POST /api/v1/intent/{rid}/action`
 * body to AI internal `POST /intent/{rid}/resume` endpoint. AI calls
 * `graph.astream(Command(resume=<choice>), config={'thread_id': rid})` resuming
 * graph from interrupt checkpoint (Pattern A semantics per
 * `03_API_CONTRACTS.md §1.2` line 95-96).
 *
 * **Why header-fetch + AbortController pattern:**
 *   - Graph at AI side is fire-and-forget background thread; does NOT need
 *     Gateway to consume SSE body to keep graph running.
 *   - Gateway just needs `request_id` to (a) cache + (b) subscribe Redis
 *     channel from /stream handler.
 *   - Consuming SSE body in `postIntent()` would block Gateway dispatch
 *     handler for entire intent duration (10s+ with Variant B LLM calls).
 *   - AbortController.abort() releases socket back to fetch pool immediately
 *     after headers received — clean resource handoff to Redis pub/sub.
 *
 * Why this exists:
 *   - HealthService.readiness() needs to ping AI service (replaces T01 'unknown'
 *     placeholder; backfills the readiness report gap honestly).
 *   - T07 SSE wrapper uses AiClient.postIntent() to dispatch user intents
 *     to AI service. S-04 T03 refactor matches SSE-streaming reality.
 *
 * Trace propagation pattern:
 *   - Native Node 20 `fetch()` is auto-instrumented by
 *     `@opentelemetry/instrumentation-undici` (bundled in
 *     `@opentelemetry/auto-instrumentations-node@0.49.0` per T01 deps).
 *     The auto-instrumentation writes W3C `traceparent` header onto outgoing
 *     fetch requests transparently.
 *   - We wrap each method in a manual span `gateway.client.ai.<method>` per
 *     docs/06_OBSERVABILITY.md §9.2 (`<layer>.<component>.<operation>` naming).
 *     The manual span becomes parent of the auto-instrument HTTP span, giving
 *     us business semantics in Tempo (find "ai readiness check failed" in
 *     1 search, not 5 anonymous HTTP spans).
 *
 * Source-of-truth:
 *   - docs/06_OBSERVABILITY.md §9.1 line 419 — "HTTP: traceparent header tự
 *     động (auto-instrumentation)"
 *   - docs/06_OBSERVABILITY.md §9.2 — span naming convention
 *   - docs/03_API_CONTRACTS.md §1.2 — POST /intent body shape + /action endpoint
 *   - apps/ai/src/main.py line 392-475 (POST /intent) + 477-530 (/resume)
 *
 * Decisions applied:
 *   - D-01 (S-02): OTLP gRPC for exporter — outgoing traces flow through
 *     Gateway's already-configured OTLP pipeline (no client-specific config).
 *   - D-S04-13 LAW (S-04 T02 Phiên Sx04-3): Option Z Redis pub/sub + Pattern A
 *     interrupt+resume → /intent SSE stream + /resume internal endpoint.
 */

import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import type { Env } from '../config/env.schema';

/**
 * Shape of AI service `GET /health` response.
 * Per apps/ai/src/main.py health() handler.
 */
export interface AiHealthResponse {
  status: string; // 'ok' when healthy
  service: string; // 'ai'
  version: string;
}

/**
 * Shape of AI service `POST /intent` response — S-04 T03 SHRUNK.
 *
 * Previously (S-02 stub): `{request_id, modality, intent, confidence, stub}`.
 * S-04 T03 (Phiên Sx04-8b per D-S04-13 LAW): AI service returns SSE stream;
 * Gateway only reads `X-Request-Id` response header. Other fields no longer
 * meaningful (intent classification now happens inside graph nodes that
 * publish SSE events directly).
 */
export interface AiIntentResponse {
  request_id: string;
}

/**
 * Shape of AI service `POST /intent/{rid}/resume` response (S-04 T03 NEW).
 *
 * Per `apps/ai/src/main.py` line 530: AI returns 202 JSON `{status, request_id}`
 * immediately after spawning graph resume thread (fire-and-forget). Graph
 * continues publishing SSE events to same `sse:pubsub:{rid}` channel that
 * Gateway /stream handler is already subscribed to.
 */
export interface AiIntentResumeResponse {
  request_id: string;
  status: 'accepted';
}

export interface PostIntentBody {
  modality: 'text' | 'image' | 'voice';
  content?: string;
  /**
   * S-04 ship: classifier-informational hint (import/buy/search/recommend).
   * S-05 T02 NEW per C-S05-F Path α LAW (Phiên Sx05-2): +2 explicit
   * entry-intent override values dispatching AI service to cart_by_text.py
   * (cart_clear_confirm + cart_view_with_stock_check). Mirrors
   * `intent-request.dto.ts` Zod enum (S-05 emit). Backward-compat:
   * `hint` absent → AI uses S-04 classifier path.
   */
  hint?:
    | 'import'
    | 'buy'
    | 'search'
    | 'recommend'
    | 'cart_clear_confirm'
    | 'cart_view_with_stock_check';
  /** S-04 NEW per D-S04-03 LAW Adaptive Single Endpoint. */
  mode?: 'ai_augmented' | 'basic_fallback';
  /**
   * Sx05-3-CODE HOTFIX (D-S05-13 LAW Cross-service User Context Propagation,
   * Phiên Sx05-3-CODE manual test discovery).
   *
   * JWT-resolved authenticated user_id extracted by `intent.controller.ts`
   * @UseGuards(JwtAuthGuard) → req.user.id, forwarded here for AI service to
   * persist into IcpState. Without this field, AI cart_by_text graph nodes
   * fall back to 'anon' user_id → wrong cart cleared/checked.
   *
   * Optional for backward-compat with non-authed smoke test callers.
   */
  user_id?: string;
}

/**
 * Resume body forwarded from Gateway `intent-action.controller.ts` to AI
 * internal `POST /intent/{rid}/resume`. Shape mirrors
 * `apps/gateway/src/intent/dto/intent-action.dto.ts`.
 */
export interface PostIntentResumeBody {
  /**
   * Resume choice for Pattern A interrupt+resume per D-S04-13 LAW + S-05 T02
   * extension per D-S05-01/03 LAW (Phiên Sx05-2 — cart_by_text.py
   * clear_action + stock_action interrupts).
   *
   * Mirrors `intent-action.dto.ts` Zod enum (S-05 emit).
   */
  choice:
    | 'accept'
    | 'reject'
    | 'retry_ai'
    | 'continue_basic'
    | 'add_to_cart'
    | 'skip'
    // S-05 T02 NEW per D-S05-01 + D-S05-03 LAW:
    | 'confirm_clear'
    | 'cancel_clear'
    | 'resolve_remove'
    | 'resolve_replace';
  value?: Record<string, unknown>;
  _meta?: { attempt_n: number };
}

/**
 * Default request timeout. 5s for /health (should be fast); 10s for /intent
 * header read (graph spawn is sub-100ms at AI side, just network); 10s for
 * /resume (AI returns 202 immediately after spawning background thread).
 */
const HEALTH_TIMEOUT_MS = 5_000;
const INTENT_TIMEOUT_MS = 10_000;
const RESUME_TIMEOUT_MS = 10_000;

/**
 * Lazy tracer resolution (S-02 T05 Phiên 26 mid-fix per C-28).
 *
 * Previous module-level `const _tracer = trace.getTracer(...)` cached at
 * require-time may resolve to NoopTracer if `health.controller.ts` /
 * `ai.client.ts` are loaded before NodeSDK.start() fully settles its global
 * TracerProvider (race between NestJS module resolution and OTel SDK async
 * boot). NoopTracer's startActiveSpan creates no-op spans that don't export
 * to Tempo — verified Phiên 26 manual smoke (gateway service had Tempo
 * traces from auto-instrument but ZERO manual spans).
 *
 * Lazy `getTracer()` resolves on first method call after SDK has fully
 * registered global TracerProvider → returns real ProxyTracer.
 */
function getTracer(): Tracer {
  return trace.getTracer('gateway.client.ai');
}

@Injectable()
export class AiClient {
  private readonly baseUrl: string;
  private readonly nestLogger = new NestLogger(AiClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    // Per T05 env.schema.ts addition: AI_SERVICE_URL with default 'http://ai:5001'.
    // Inside docker-compose `icp` network, hostname `ai` resolves to the AI
    // container via Compose DNS. Outside compose, override via env var.
    this.baseUrl = this.config.get('AI_SERVICE_URL', { infer: true });
    this.nestLogger.log(
      JSON.stringify({ message: 'ai_client.initialized', extras: { base_url: this.baseUrl } }),
    );
  }

  /**
   * GET {AI_SERVICE_URL}/health — liveness check.
   *
   * Used by HealthService.readiness() to populate `.deps.ai` field.
   * Returns `null` on any network/HTTP/parse error (caller maps to 'down').
   *
   * Span: `gateway.client.ai.get_health` (manual) + auto child fetch span.
   */
  async getHealth(): Promise<AiHealthResponse | null> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.client.ai.get_health');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const url = `${this.baseUrl}/health`;
      span.setAttribute('http.url', url);
      span.setAttribute('peer.service', 'ai');
      const startedAt = Date.now();
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        span.setAttribute('http.status_code', response.status);
        if (!response.ok) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` });
          this.nestLogger.warn(
            JSON.stringify({
              message: 'ai_client.unhealthy',
              extras: { status: response.status, duration_ms: Date.now() - startedAt },
            }),
          );
          return null;
        }
        const body = (await response.json()) as AiHealthResponse;
        span.setAttribute('ai.service', body.service);
        span.setAttribute('ai.version', body.version);
        this.nestLogger.debug(
          JSON.stringify({
            message: 'ai_client.health_ok',
            extras: { duration_ms: Date.now() - startedAt },
          }),
        );
        return body;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.warn(
          JSON.stringify({
            message: 'ai_client.unreachable',
            error_message: msg,
            extras: { duration_ms: Date.now() - startedAt },
          }),
        );
        return null;
      } finally {
        span.end();
      }
    });
  }

  /**
   * POST {AI_SERVICE_URL}/intent — dispatch intent, read X-Request-Id, abort body.
   *
   * S-04 T03 refactor (Phiên Sx04-8b per D-S04-13 LAW Option Z):
   *   AI service returns `text/event-stream` SSE response. Gateway does NOT
   *   consume the body — graph thread already spawned at AI side (fire-and-
   *   forget per `apps/ai/src/main.py` line 450). Gateway just needs
   *   `X-Request-Id` header value to:
   *     1. Cache in Redis (`intent:cache:{rid}` TTL 60s) for /stream auth check
   *     2. Return to FE so FE can open `GET /api/v1/intent/stream?id=<rid>`
   *
   * Pattern (verified Phiên Sx04-7 T02 smoke iter 7):
   *   - `fetch()` returns immediately on headers received (response body
   *     stream not consumed)
   *   - Read `response.headers.get('x-request-id')` (lowercase per Fetch spec)
   *   - `controller.abort()` releases socket immediately to fetch pool
   *   - Graph continues async at AI side; events flow via Redis pub/sub
   *     channel `sse:pubsub:{rid}` → Gateway /stream handler picks up
   *
   * Throws on non-2xx, missing X-Request-Id header, or network error.
   *
   * Span: `gateway.client.ai.post_intent` (manual) + auto child fetch span.
   */
  async postIntent(body: PostIntentBody): Promise<AiIntentResponse> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.client.ai.post_intent');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const url = `${this.baseUrl}/intent`;
      span.setAttribute('http.url', url);
      span.setAttribute('peer.service', 'ai');
      span.setAttribute('ai.modality', body.modality);
      if (body.mode) {
        span.setAttribute('ai.mode', body.mode);
      }
      const startedAt = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INTENT_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        span.setAttribute('http.status_code', response.status);

        if (!response.ok) {
          const errMsg = `AI /intent returned ${response.status}`;
          span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
          throw new Error(errMsg);
        }

        // Read X-Request-Id BEFORE aborting body. Fetch headers normalize
        // to lowercase per WHATWG spec.
        const requestId = response.headers.get('x-request-id');
        if (!requestId) {
          throw new Error('AI /intent response missing X-Request-Id header');
        }

        span.setAttribute('ai.request_id', requestId);

        // Abort body — we don't consume SSE stream; graph runs async at AI.
        // Releases socket back to fetch connection pool immediately.
        controller.abort();

        this.nestLogger.debug(
          JSON.stringify({
            message: 'ai_client.intent_dispatched',
            extras: { duration_ms: Date.now() - startedAt, request_id: requestId },
          }),
        );

        return { request_id: requestId };
      } catch (err) {
        // AbortError from our own controller.abort() after reading header is
        // NORMAL flow (not a failure). Detect via signal already aborted +
        // requestId resolved path returning above.
        const msg = err instanceof Error ? err.message : String(err);
        // If abort was triggered by timeout (not our header-read success path),
        // signal will be aborted but we never set requestId. The throw above
        // for missing header catches that case explicitly. Other AbortError
        // here = legitimate network/timeout failure.
        if (err instanceof Error && err.name === 'AbortError') {
          // Distinguish controller.abort() (post-header) from timeout abort:
          // we only reach this catch if header read failed BEFORE we called
          // controller.abort() ourselves. So AbortError here = timeout.
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'AI /intent timeout' });
          this.nestLogger.error(
            JSON.stringify({
              message: 'ai_client.intent_timeout',
              extras: { duration_ms: Date.now() - startedAt, timeout_ms: INTENT_TIMEOUT_MS },
            }),
          );
          throw new Error('AI /intent timeout');
        }
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({
            message: 'ai_client.intent_failed',
            error_message: msg,
            extras: { duration_ms: Date.now() - startedAt },
          }),
        );
        throw err;
      } finally {
        clearTimeout(timeoutId);
        span.end();
      }
    });
  }

  /**
   * POST {AI_SERVICE_URL}/intent/{rid}/resume — forward action body to AI.
   *
   * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW Pattern A interrupt+resume).
   *
   * Called by Gateway `intent-action.controller.ts` after Idempotency-Key
   * middleware passes. Forwards request body verbatim to AI internal endpoint;
   * AI calls `graph.astream(Command(resume=<choice>), thread_id=rid)` to
   * resume graph from interrupt checkpoint.
   *
   * Returns 202 JSON immediately (AI spawns background resume thread); new
   * SSE events flow to same `sse:pubsub:{rid}` channel Gateway /stream is
   * already subscribed to. No FE reconnect required.
   *
   * Span: `gateway.client.ai.post_intent_resume` (manual) + auto child fetch.
   */
  async postIntentResume(
    rid: string,
    body: PostIntentResumeBody,
  ): Promise<AiIntentResumeResponse> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.client.ai.post_intent_resume');
    return context.with(trace.setSpan(context.active(), span), async () => {
      const url = `${this.baseUrl}/intent/${rid}/resume`;
      span.setAttribute('http.url', url);
      span.setAttribute('peer.service', 'ai');
      span.setAttribute('ai.request_id', rid);
      span.setAttribute('ai.resume.choice', body.choice);
      if (body._meta?.attempt_n) {
        span.setAttribute('ai.resume.attempt_n', body._meta.attempt_n);
      }
      const startedAt = Date.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(RESUME_TIMEOUT_MS),
        });
        span.setAttribute('http.status_code', response.status);

        if (!response.ok) {
          const errMsg = `AI /intent/${rid}/resume returned ${response.status}`;
          span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
          throw new Error(errMsg);
        }

        const parsed = (await response.json()) as AiIntentResumeResponse;
        this.nestLogger.debug(
          JSON.stringify({
            message: 'ai_client.intent_resume_ok',
            extras: {
              duration_ms: Date.now() - startedAt,
              request_id: rid,
              choice: body.choice,
            },
          }),
        );
        return parsed;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        span.recordException(err instanceof Error ? err : new Error(msg));
        span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
        this.nestLogger.error(
          JSON.stringify({
            message: 'ai_client.intent_resume_failed',
            error_message: msg,
            extras: { duration_ms: Date.now() - startedAt, request_id: rid },
          }),
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }
}
