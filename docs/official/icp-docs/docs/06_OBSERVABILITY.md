# 06 — Observability (Operational)

> **Load khi:** code logging/metrics/tracing, hoặc debug production. Đây là doc về **operational** observability — cho dev/ops xem hệ thống chạy thế nào.  
> KHÔNG nhầm với **behavior logs** trong `07_BEHAVIOR_LOGS.md` (dùng cho recommendation/analytics).

## 1. Nguyên Tắc

| Pillar | Tool chính | Mục đích |
|---|---|---|
| **Logs** | OpenTelemetry Logs → Loki | What happened, structured |
| **Metrics** | OpenTelemetry Metrics → Prometheus | How much, how often, how fast |
| **Traces** | OpenTelemetry Traces → Tempo/Jaeger | Request flow across services |

**Tại sao OTel:** Vendor-neutral. Code 1 lần, swap backend tùy ý (Loki → Datadog, Tempo → Honeycomb).

**Hackathon scope:**
- LGTM stack (Loki + Grafana + Tempo + Mimir) self-hosted qua docker-compose
- Hoặc: Grafana Cloud free tier (đề xuất nếu demo, tránh setup phức tạp)

## 2. OTel Stack docker-compose

Thêm vào `infra/docker-compose.observability.yml`:

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports:
      - "4317:4317"     # OTLP gRPC
      - "4318:4318"     # OTLP HTTP
    volumes:
      - ./infra/otel/collector-config.yaml:/etc/otelcol-contrib/config.yaml
    
  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]
    
  tempo:
    image: grafana/tempo:latest
    ports: ["3200:3200", "9095:9095"]
    volumes:
      - ./infra/otel/tempo.yaml:/etc/tempo.yaml
    
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./infra/otel/prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    volumes:
      - ./infra/otel/grafana-datasources.yml:/etc/grafana/provisioning/datasources/ds.yml
      - ./infra/otel/grafana-dashboards:/var/lib/grafana/dashboards
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_AUTH_ANONYMOUS_ENABLED: true
```

OTel collector config receives OTLP from services, fans out to Loki/Tempo/Prometheus.

## 3. Service Instrumentation

### 3.1 NestJS (Gateway, Workers)

Dependencies:
```json
{
  "@opentelemetry/sdk-node": "^0.x",
  "@opentelemetry/auto-instrumentations-node": "^0.x",
  "@opentelemetry/exporter-trace-otlp-grpc": "^0.x",
  "@opentelemetry/exporter-logs-otlp-grpc": "^0.x",
  "@opentelemetry/exporter-metrics-otlp-grpc": "^0.x",
  "@opentelemetry/api-logs": "^0.x",
  "pino": "^9.x",
  "pino-opentelemetry-transport": "^1.x"
}
```

Bootstrap file `apps/gateway/src/observability/otel.ts` (PHẢI import TRƯỚC main.ts):
```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes as A } from '@opentelemetry/semantic-conventions';

export const sdk = new NodeSDK({
  resource: new Resource({
    [A.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'gateway',
    [A.SERVICE_VERSION]: process.env.APP_VERSION ?? '0.0.1',
    [A.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'dev',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
  }),
  // logExporter, metricReader tương tự
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
  })],
});

sdk.start();
```

Trong `main.ts`:
```ts
import './observability/otel';   // BẮT BUỘC ở dòng đầu, trước mọi import khác
import { NestFactory } from '@nestjs/core';
// ...
```

### 3.2 Flask (AI Service)

Dependencies:
```toml
opentelemetry-distro = "*"
opentelemetry-exporter-otlp = "*"
opentelemetry-instrumentation-flask = "*"
opentelemetry-instrumentation-requests = "*"
opentelemetry-instrumentation-logging = "*"
structlog = "*"
```

Auto-instrumentation qua CLI khi start:
```bash
opentelemetry-instrument \
  --service_name ai-service \
  --exporter_otlp_endpoint http://otel-collector:4317 \
  flask run
```

Manual spans cho LangGraph nodes:
```python
from opentelemetry import trace
tracer = trace.get_tracer(__name__)

def vision_analyze_node(state):
    with tracer.start_as_current_span("intent.import.vision_analyze") as span:
        span.set_attribute("user_id", state["user_id"])
        span.set_attribute("image_bytes", len(state["raw_input"]["content"]))
        result = mcp.call_tool("vision.analyze", {...})
        span.set_attribute("vision.category", result["category"])
        span.set_attribute("vision.confidence", result["confidence"])
        return {**state, "tool_results": {**state["tool_results"], "vision": result}}
```

### 3.3 MCP Server

Cùng pattern Flask. Mỗi tool call là 1 span:
```python
@tool_handler
def vespa_hybrid_search(params):
    with tracer.start_as_current_span("mcp.tool.vespa.hybrid_search") as span:
        span.set_attribute("vespa.query", params["query"])
        span.set_attribute("vespa.limit", params.get("limit", 10))
        # ...
        span.set_attribute("vespa.result_count", len(results))
        return results
```

### 3.4 Next.js (Web)

Phase 06 nice-to-have, dùng `@vercel/otel` hoặc OpenTelemetry browser SDK. Chỉ trace fetch + page-load. Hackathon optional.

## 4. Standard Log Schema

Mọi service emit log JSON với fields chuẩn:

```json
{
  "timestamp": "2026-05-16T10:30:45.123Z",
  "level": "info",
  "service": "gateway",
  "version": "0.0.1",
  "env": "dev",
  
  "trace_id": "5b8aa5a2d2c872e8321cf37308d69df2",
  "span_id": "051581bf3cb55c13",
  
  "message": "product_created",
  
  "request_id": "req_abc123",
  "user_id": "u_xxx",
  "session_id": "s_xxx",
  
  "intent": "importing_by_images",
  "phase": "commit",
  
  "duration_ms": 145,
  "ok": true,
  
  "error_code": null,
  "error_message": null,
  
  "extras": {
    "product_id": "p_xxx",
    "merchant_id": "m_xxx"
  }
}
```

### Fields LOCKED (bắt buộc mọi log entry)

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO 8601 | UTC |
| `level` | enum | `trace`/`debug`/`info`/`warn`/`error`/`fatal` |
| `service` | string | `gateway`/`ai`/`mcp`/`worker-payment`/... |
| `trace_id` | hex | OTel inject |
| `span_id` | hex | OTel inject |
| `message` | string | **snake_case event name**, KHÔNG free-form sentence |

### Fields OPTIONAL (khi liên quan)

| Field | When |
|---|---|
| `request_id` | Every HTTP request |
| `user_id` | After auth |
| `intent` | Inside intent flow |
| `phase` | Inside multi-stage flow (classify/enrich/commit/...) |
| `duration_ms` | Operations with measurable duration |
| `ok` | Result of an operation |
| `error_code` / `error_message` | When `ok=false` |
| `extras` | Domain-specific fields (nested object) |

### Anti-patterns (CẤM)

```js
// ❌ Free-form message
log.info(`User ${user.email} created product ${p.id} at ${new Date()}`);

// ✅ Structured
log.info({
  message: 'product_created',
  user_id: user.id,
  extras: { product_id: p.id }
});
```

```js
// ❌ String interpolation, không filterable
log.error(`Vespa search failed for query "${q}"`);

// ✅
log.error({
  message: 'vespa_search_failed',
  extras: { query: q },
  error_code: 'EXTERNAL_DOWN',
});
```

```js
// ❌ Mỗi service tự định nghĩa schema riêng
// ✅ Dùng shared helper `createLogger(service, version)`
```

## 5. Message Naming Convention

Format: `<noun>_<past_verb>` hoặc `<noun>_<verb>_failed`

| Good | Bad |
|---|---|
| `product_created` | `Product was created` |
| `intent_classified` | `Classified intent` |
| `payment_charge_failed` | `payment failed` |
| `vespa_search_completed` | `Vespa returned results` |
| `cart_item_added` | `Added to cart` |

Catalog các message names được dùng (append-only):

```
auth.login_succeeded
auth.login_failed
auth.logout
auth.token_verified
auth.token_invalid
idempotency.cache_hit
idempotency.lock_conflict
intent.received
intent.classified
intent.dispatched
intent.completed
intent.failed
mcp.tool_called
mcp.tool_completed
mcp.tool_failed
vespa.search_completed
vespa.search_failed
vespa.indexed
vision.analyzed
vision.low_confidence
speech.transcribed
event.appended
event.published
event.publish_failed
event.publish_retried
card.created
card.accepted
card.rejected
order.created
order.placed
payment.charge_started
payment.charge_succeeded
payment.charge_failed
stock.reserved
stock.reservation_failed
stock.released
cart.item_added
cart.item_removed
cart.cleared
```

Khi thêm message mới → append vào catalog (file `docs/log-catalog.md` sau này).

## 6. Log Levels Guide

| Level | When |
|---|---|
| `trace` | Verbose flow, disabled prod |
| `debug` | Detail for debugging, only dev |
| `info` | **Business events** (`product_created`, `intent_classified`), entry/exit of major operations |
| `warn` | Recoverable issues, retries, degraded modes (`fallback_to_bm25`) |
| `error` | Unhandled errors, external service failures (`vespa_timeout`) |
| `fatal` | Service must restart, data corrupted |

Default level prod: `info`. Dev: `debug`.

## 7. Sensitive Data — NEVER LOG

- Passwords (raw or hash)
- Full JWT tokens (chỉ log `jti` claim)
- Credit card numbers, CVV
- Full email body, full audio bytes, full image bytes
- Personal addresses, phone numbers

OK to log:
- `user_id` (UUID, không leak identity)
- `product_id`, `order_id`
- Counts, durations, status codes
- First 8 chars của idempotency-key

Hackathon: thêm middleware redact PII tự động (regex email, phone). File `apps/<service>/src/observability/redactor.ts`.

## 8. Metrics

### 8.1 RED Method cho mọi service

Standard counters/histograms (OTel auto cho HTTP):
- `http.server.duration` histogram
- `http.server.request.size` / `response.size`

Custom metrics:
```ts
import { metrics } from '@opentelemetry/api';
const meter = metrics.getMeter('icp-gateway');

const intentRequests = meter.createCounter('icp.intent.requests', {
  description: 'Number of intent requests',
});

intentRequests.add(1, {
  intent: 'importing_by_images',
  modality: 'image',
  status: 'success',
});
```

### 8.2 Bắt buộc track

| Metric | Type | Labels | Mục đích |
|---|---|---|---|
| `icp.intent.requests` | Counter | `intent`, `modality`, `status` | Throughput per intent |
| `icp.intent.duration` | Histogram | `intent`, `modality` | Latency per intent |
| `icp.mcp.tool.calls` | Counter | `tool`, `status` | MCP usage |
| `icp.mcp.tool.duration` | Histogram | `tool` | MCP tool latency |
| `icp.vespa.results` | Histogram | `rank_profile` | Result count distribution |
| `icp.events.published` | Counter | `event_type` | Event volume |
| `icp.cards.generated` | Counter | `action_type` | Card frequency |
| `icp.orders.placed` | Counter | - | Business throughput |
| `icp.payments.outcome` | Counter | `outcome=success/failed` | Payment success rate |
| `icp.llm.tokens` | Counter | `provider`, `model`, `kind=input/output` | LLM cost tracking |
| `icp.llm.duration` | Histogram | `provider`, `model` | LLM latency |

### 8.3 Service health

- Process metrics auto (memory, CPU, GC)
- DB pool: active/idle connections
- Kafka consumer lag
- Redis cache hit ratio

## 9. Traces

### 9.1 Span hierarchy mẫu cho Intent 01

```
[span] gateway.POST /intent (root)
  ├ [span] gateway.middleware.idempotency
  ├ [span] gateway.middleware.auth
  ├ [span] gateway.controller.intent_dispatch
  │   └ [span] gateway.client.ai.POST /intent (HTTP call)
  │       └ [span] ai.handler.intent     (continued via trace context)
  │           ├ [span] ai.graph.router.classify
  │           │   └ [span] llm.openai.chat
  │           └ [span] ai.graph.intent_01.run
  │               ├ [span] mcp.client.call vision.analyze
  │               │   └ [span] mcp.tool.vision.analyze
  │               │       └ [span] llm.gemini.generate_content
  │               ├ [span] mcp.client.call vespa.search_trend
  │               │   └ [span] mcp.tool.vespa.search_trend
  │               │       └ [span] vespa.http.search
  │               └ [span] ai.graph.intent_01.synthesize
```

Context propagation:
- HTTP: `traceparent` header tự động (auto-instrumentation)
- Kafka: pass `traceparent` trong message headers (manual)
- SSE: pass `traceparent` trong query string (manual)

### 9.2 Span naming convention

Format: `<layer>.<component>.<operation>`

Examples:
- `gateway.controller.products.create`
- `ai.graph.intent_01.classify`
- `mcp.tool.vespa.hybrid_search`
- `worker.payment.charge`
- `db.products.insert`

### 9.3 Span attributes — chuẩn

Mọi span gắn:
- `service.name`, `service.version` (qua Resource)
- `user.id` nếu có
- `intent.type` nếu có
- `request.id` nếu có

Specific attributes per span type:
- HTTP: `http.method`, `http.route`, `http.status_code`
- DB: `db.system`, `db.statement` (CẨN THẬN sensitive)
- LLM: `llm.provider`, `llm.model`, `llm.input_tokens`, `llm.output_tokens`, `llm.temperature`
- Vespa: `vespa.yql`, `vespa.hits`
- MCP: `mcp.tool`, `mcp.duration_ms`

### 9.4 Error recording

Khi có error:
```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
const span = trace.getActiveSpan();
span?.recordException(err);
span?.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
span?.setAttribute('error.code', 'VESPA_TIMEOUT');
```

## 10. Kafka Tracing

Producer phải inject context:
```ts
import { propagation, context } from '@opentelemetry/api';

const headers: Record<string, string> = {};
propagation.inject(context.active(), headers);

await producer.send({
  topic: 'icp.orders.placed',
  messages: [{
    key: order.id,
    value: JSON.stringify(payload),
    headers,
  }],
});
```

Consumer extract:
```ts
const parent = propagation.extract(context.active(), message.headers);
context.with(parent, async () => {
  await handleOrderPlaced(payload);
});
```

## 11. Logs/Metrics/Traces Correlation

Trong mọi log entry, OTel logging instrumentation tự inject `trace_id` và `span_id`. Trong Grafana:
- Click 1 log → "View related trace" → mở Tempo trace
- Click 1 trace → "View logs" → filter Loki by trace_id
- Click metric spike → "Exemplars" → trace samples

Đây là **superpower** của OTel: 1 click navigate giữa 3 pillars.

## 12. Health Endpoints (Đã có từ P01, format chuẩn)

```
GET /health → 200 { status: 'ok' }   # liveness, cực nhanh
GET /health/ready → 200 { status: 'ok', deps: { pg: 'up', redis: 'up', ... } }
GET /health/live → 200                # k8s style
```

## 13. Dashboards (Phase 02 đã có draft, Phase 06 polish)

Grafana dashboards JSON trong `infra/otel/grafana-dashboards/`:

1. **Service Overview** — RED metrics per service
2. **Intent Performance** — duration p50/p95/p99 by intent
3. **LLM Cost** — token usage by model
4. **Choreography Health** — Kafka consumer lag, event throughput
5. **Action Cards** — generated/accepted/rejected by type
6. **Business KPI** — orders/hour, payment success rate, GMV

Pre-built dashboards check-in repo, auto-provisioned via grafana-datasources volume mount.

## 14. Alerting (Hackathon scope — chỉ console)

Nice-to-have nếu có thời gian Phase 06:
- Grafana alert rules → Discord/Slack webhook
- 3 alert mẫu:
  - p95 intent duration > 5s for 5min
  - Payment success rate < 70% for 10min
  - Any service `error` log rate > 10/min

## 15. Phase Mapping

| Phase | What to instrument |
|---|---|
| **Phase 01** | OTel SDK bootstrap mọi service, JSON logger, health endpoints, basic auto-instrumentation |
| **Phase 02** | Manual spans cho login, search; metric `icp.intent.requests`, `icp.intent.duration` |
| **Phase 03** | Spans cho LangGraph nodes, attributes cho vision/Vespa results, metric `icp.cards.generated` |
| **Phase 04** | Kafka context propagation, metrics `icp.events.published`, `icp.payments.outcome` |
| **Phase 05** | LLM token tracking, Vespa result histograms |
| **Phase 06** | Grafana dashboards, alerts, redact middleware, run k6 load test |

## 16. Env Vars

Mỗi service cần:
```
OTEL_SERVICE_NAME=<service>
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
OTEL_LOG_LEVEL=info
OTEL_TRACES_SAMPLER=parentbased_always_on
APP_VERSION=0.0.1
```

Sampling: full sampling cho Hackathon (low volume). Production sẽ chuyển `parentbased_traceidratio` 10%.

## 17. Local Dev UX

```bash
# 1 command up cả app + observability
make up        # docker-compose -f compose.yml -f compose.observability.yml up

# Xem dashboards
open http://localhost:3001    # Grafana, anonymous enabled
```

Grafana auto-provisioned với 3 datasources (Loki, Tempo, Prometheus) — không config tay.

---

**END OF OBSERVABILITY DOC.**

Phần tiếp theo: `07_BEHAVIOR_LOGS.md` về user behavior events cho recommendation/analytics.
