/**
 * apps/gateway/src/clients/ai.client.ts
 *
 * NestJS @Injectable() HTTP client for the ICP AI service (Flask + LangGraph).
 *
 * S-02 T05 (Phiên 26) — Trace propagation E2E verify Gateway → AI → MCP.
 *
 * Why this exists:
 *   - HealthService.readiness() needs to ping AI service (replaces T01 'unknown'
 *     placeholder; backfills the readiness report gap honestly).
 *   - T07 SSE wrapper will use AiClient.postIntent() to forward user intents
 *     to AI service. T05 provides the client; T07 wires the controller.
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
 *   - docs/03_API_CONTRACTS.md §1.2 — POST /intent body shape (T07 will wire)
 *   - apps/ai/src/main.py — AI service endpoints (GET /health, POST /intent)
 *   - apps/ai/src/tools/mcp_client.py — Python sibling client pattern (T03)
 *
 * Decisions applied:
 *   - D-01 (S-02): OTLP gRPC for exporter — outgoing traces flow through
 *     Gateway's already-configured OTLP pipeline (no client-specific config).
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
 * Shape of AI service `POST /intent` response (Phase 1 stub).
 * Per apps/ai/src/main.py intent() handler. T07 will replace with SSE stream.
 */
export interface AiIntentResponse {
  request_id: string;
  modality: string;
  intent: string; // 'unknown' in Phase 1 per D-03
  confidence: number; // 0.0 in Phase 1
  stub: true;
}

export interface PostIntentBody {
  modality: 'text' | 'image' | 'voice';
  content?: string;
  hint?: 'import' | 'buy' | 'search' | 'recommend';
}

/**
 * Default request timeout. 5s for /health (should be fast); 10s for /intent
 * (LangGraph node execution + future LLM round-trip). T05 only uses /health
 * for readiness; /intent is exposed for T07.
 */
const HEALTH_TIMEOUT_MS = 5_000;
const INTENT_TIMEOUT_MS = 10_000;

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
   * Span: `gateway.client.ai.get_health` (manual) + auto child fetch span
   * (when undici instrumentation patches native fetch — currently no-op in
   * `@opentelemetry/instrumentation-undici@0.5.0` per debug log "No modules
   * instrumentation has been defined", KI-T05-NEW; manual span is sole
   * Tempo evidence for outgoing AI calls until SDK bump unblocks undici).
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
   * POST {AI_SERVICE_URL}/intent — Phase 1 JSON request/response. T07 will
   * replace consumption with SSE streaming (AI side already SSE-ready per
   * 03_API_CONTRACTS.md §1.2; Phase 1 stub returns plain JSON).
   *
   * NOT consumed by T05 readiness — exposed here so T07 controller can inject
   * AiClient + call this. T05 just needs the method to exist for clean DI
   * boundaries (avoid T07 having to patch AiClient mid-slice).
   *
   * Throws on non-2xx or network error (caller handles via NestJS exception
   * filter when wired in T07).
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
      const startedAt = Date.now();
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(INTENT_TIMEOUT_MS),
        });
        span.setAttribute('http.status_code', response.status);
        if (!response.ok) {
          const errMsg = `AI /intent returned ${response.status}`;
          span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
          throw new Error(errMsg);
        }
        const parsed = (await response.json()) as AiIntentResponse;
        span.setAttribute('ai.intent', parsed.intent);
        span.setAttribute('ai.confidence', parsed.confidence);
        this.nestLogger.debug(
          JSON.stringify({
            message: 'ai_client.intent_ok',
            extras: { duration_ms: Date.now() - startedAt, intent: parsed.intent },
          }),
        );
        return parsed;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
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
        span.end();
      }
    });
  }
}
