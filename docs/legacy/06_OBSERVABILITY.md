# 06 — Observability (Operational)

> **Load khi:** code logging/metrics/tracing, hoặc debug production. Đây là doc về **operational** observability — cho dev/ops xem hệ thống chạy thế nào.
> KHÔNG nhầm với **behavior logs** trong `07_BEHAVIOR_LOGS.md` (dùng cho recommendation/analytics).

> **Nhãn trong doc này:** ✅ verified-vs-code (2026-06-10) · 🟡 CHƯA CODE (target, chưa có trong code) · 🟡 CHƯA VERIFY (chưa đối chiếu được code/DB) · 🔵 TÙY CHỌN.

<!-- PRODUCTION RECONCILE (2026-06-10, verified vs live code — SUPERSEDES note 2026-06-09):
KIẾN TRÚC: mỗi service có package observability riêng —
  gateway(NestJS): apps/gateway/src/observability/{otel.ts, logger.ts, index.ts}
  ai/mcp(Flask):   apps/{ai,mcp}/src/observability/{setup.py, logger.py, __init__.py}
TRACES: wired + active. gateway otel.ts (NodeSDK, OTLP gRPC) + ai/mcp setup.py(TracerProvider,
  traces-only) + agent `opentelemetry-instrument`. MCP init_otel() gọi ở server.py:188 (verified);
  AI init call site CHƯA VERIFY (agent vẫn set provider). Spans thủ công phong phú ở cả AI & MCP.
LOGS: app Pino(gateway)+structlog(ai/mcp) → STDOUT JSON. Collector logs-pipeline = otlp→loki,
  NHƯNG KHÔNG nguồn nào feed (không app emit OTel Log Record; không filelog/promtail/logging-driver).
  → log HIỆN KHÔNG tới Loki (chỉ `docker logs`). 🟡 đường log→Loki CHƯA WIRE.
METRICS: gateway otel.ts có metricReader (OTLP) cấu hình; collector otlp→prometheusremotewrite.
  Python(ai/mcp) setup.py = traces-only → emit OTLP metrics CHƯA VERIFY. prometheus service-scrape đang COMMENT.
CHƯA CODE: tenant_id (log schema/span attr); regex-PII redactor.ts; grafana dashboards JSON; alert rules. -->

## 1. Nguyên Tắc

| Pillar | Tool chính | Mục đích |
|---|---|---|
| **Logs** | structured JSON → (stdout) → Loki | What happened, structured |
| **Metrics** | OpenTelemetry Metrics → Prometheus | How much, how often, how fast |
| **Traces** | OpenTelemetry Traces → Tempo | Request flow across services |

**Tại sao OTel:** Vendor-neutral. Code 1 lần, swap backend tùy ý (Loki → Datadog, Tempo → Honeycomb).

**Triển khai thật (verified 2026-06-10):**
- **LGTM stack** ✅ tại `infra/docker-compose.observability.yml`: `otel-collector-contrib 0.96.0` (`icp-otel-collector`) + `Loki 2.9.4` + `Tempo 2.4.1` + `Prometheus v2.50.0` + `Grafana 10.4.0` (host port **3002**). Services export OTLP-gRPC → `otel-collector:4317`.
- **Traces** ✅ wired & active (xem reconcile box). **Logs** 🟡 hiện đi stdout, **đường stdout→Loki CHƯA wire** (collector chỉ có otlp receiver, không filelog/promtail, không app emit OTel Log Record). **Metrics** ✅ gateway cấu hình OTLP exporter; Python emit 🟡 CHƯA VERIFY.
- Production có thể swap Grafana Cloud / Datadog (vendor-neutral OTLP — không đổi code).

## 2. OTel Stack docker-compose (`infra/docker-compose.observability.yml` — verified)

> Đối chiếu code thật: host path là `./otel/...` (file compose nằm trong `infra/`); collector mount `/etc/otelcol/config.yaml` + `--config=` flag; grafana datasources file `datasources.yml`.

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0   # pinned, verified
    container_name: icp-otel-collector
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes: ["./otel/collector-config.yaml:/etc/otelcol/config.yaml:ro"]
    ports: ["4317:4317", "4318:4318", "8888:8888"]   # gRPC / HTTP / self-metrics
    networks: [icp]
    depends_on: { loki: {condition: service_healthy}, tempo: {condition: service_healthy}, prometheus: {condition: service_healthy} }
    healthcheck: { test: ["CMD","/otelcol-contrib","components"], start_period: 10s }   # D-02: stateless 10s

  loki:
    image: grafana/loki:2.9.4
    container_name: icp-loki
    command: ["-config.file=/etc/loki/config.yml"]
    volumes: ["./otel/loki-config.yaml:/etc/loki/config.yml:ro", "loki_data:/loki"]
    ports: ["3100:3100"]
    healthcheck: { test: wget /ready, start_period: 30s }   # D-02: stateful 30s

  tempo:
    image: grafana/tempo:2.4.1
    container_name: icp-tempo
    command: ["-config.file=/etc/tempo.yaml"]
    volumes: ["./otel/tempo.yaml:/etc/tempo.yaml:ro", "tempo_data:/var/tempo"]
    ports: ["3200:3200", "9095:9095", "4327:4317"]   # 4327→4317 tránh đụng collector

  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: icp-prometheus
    command: ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--web.enable-remote-write-receiver"]
    volumes: ["./otel/prometheus.yml:/etc/prometheus/prometheus.yml:ro", "prometheus_data:/prometheus"]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:10.4.0
    container_name: icp-grafana
    environment: { GF_SECURITY_ADMIN_PASSWORD: admin, GF_AUTH_ANONYMOUS_ENABLED: "true", GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer, GF_USERS_DEFAULT_THEME: light }
    volumes:
      - ./otel/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
      - ./otel/grafana-dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports: ["3002:3000"]   # C11: 3002 NOT 3001 (3001 = gateway)
    depends_on: { loki: ..., tempo: ..., prometheus: ... }   # condition: service_healthy

networks: { icp: { external: true, name: icp } }   # auto-created bởi make up / obs-up (C22.b)
volumes: { loki_data: {}, tempo_data: {}, prometheus_data: {}, grafana_data: {} }
```

**Collector config** (`infra/otel/collector-config.yaml` — verified): receiver `otlp` (grpc 4317 / http 4318) → processors `[memory_limiter, batch]` → 3 pipeline:
- `traces` → `otlp/tempo` (`tempo:4317`)
- `metrics` → `prometheusremotewrite` (`http://prometheus:9090/api/v1/write`)
- `logs` → `otlphttp/loki` (`http://loki:3100/otlp`, C22.a — Loki OTLP-native ingest; loki-config `allow_structured_metadata: true`).
  > 🟡 **Lưu ý:** pipeline `logs` chỉ có receiver `otlp`. Hiện **không service nào gửi OTel Log Record** vào đây → pipeline logs **chưa có nguồn**.

## 3. Service Instrumentation

### 3.1 NestJS (Gateway)

Dependencies thật (`apps/gateway/package.json` — verified):
```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/api-logs": "^0.52.1",
  "@opentelemetry/auto-instrumentations-node": "^0.49.0",
  "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.1",
  "@opentelemetry/exporter-logs-otlp-grpc": "^0.52.1",
  "@opentelemetry/exporter-metrics-otlp-grpc": "^0.52.1",
  "@opentelemetry/sdk-logs": "^0.52.1",
  "@opentelemetry/sdk-metrics": "1.25.1",
  "@opentelemetry/sdk-node": "0.52.1",
  "@opentelemetry/resources": "1.25.1",
  "@opentelemetry/semantic-conventions": "1.25.1",
  "pino": "^9.3.2",
  "pino-pretty": "^11.2.2"
}
```
> **Pin (C-03):** root `pnpm.overrides` ép `sdk-metrics / resources / semantic-conventions / core = 1.25.1`, `api-logs = 0.52.1` (khớp transitive của `sdk-node 0.52.1`, tránh TS2322).
> 🔵 **`pino-opentelemetry-transport`: KHÔNG cài.** Chỉ cần nếu muốn bridge pino-log → OTLP Logs. Hiện log đi stdout.

Bootstrap `apps/gateway/src/observability/otel.ts` (verified — **import TRƯỚC main.ts**). Cấu hình **cả 3 signal** ở SDK:
```ts
export const sdk = new NodeSDK({
  resource: new Resource({ [A.SERVICE_NAME]: 'gateway', [A.SERVICE_VERSION]: ..., [A.DEPLOYMENT_ENVIRONMENT]: ... }),
  traceExporter:  new OTLPTraceExporter({ url: 'http://otel-collector:4317' }),       // → Tempo
  logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter({ url: ... })),  // → Loki (SDK cấu hình)
  metricReader:   new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({...}), exportIntervalMillis: 10_000 }), // → Prometheus
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: req => req.url?.startsWith('/api/v1/health') },
  })],
});
sdk.start();
// + graceful shutdown SIGTERM/SIGINT → sdk.shutdown() (flush spans trước khi exit)
```
Trong `main.ts` (verified — dòng đầu tiên, có guard "MUST BE FIRST. DO NOT MOVE."):
```ts
import './observability/otel';   // BẮT BUỘC ở dòng đầu, trước mọi import khác
```
> **Logs reality:** `logRecordProcessor` được cấu hình ở SDK, nhưng **log của app đi qua Pino → stdout** (xem `logger.ts`), KHÔNG vào OTel Logs API (thiếu `pino-opentelemetry-transport`). Nên SDK-side log-exporter hiện **không nhận log app**. 🟡

### 3.2 Flask (AI Service)

Dependencies thật (`apps/ai/pyproject.toml` — verified):
```toml
opentelemetry-api = ">=1.27,<2.0"
opentelemetry-sdk = ">=1.27,<2.0"
opentelemetry-exporter-otlp-proto-grpc = ">=1.27,<2.0"
opentelemetry-instrumentation-flask = ">=0.48b0,<1.0"
opentelemetry-instrumentation-httpx  = ">=0.48b0,<1.0"   # AI dùng httpx (KHÔNG phải requests)
opentelemetry-distro = ">=0.48b0,<1.0"
structlog = ">=24.1,<25.0"
```
> Doc cũ ghi `opentelemetry-exporter-otlp` (generic), `-instrumentation-requests`, `-instrumentation-logging` — **đã sửa**: thật là `-proto-grpc` + `-httpx`, và **không có `-instrumentation-logging`**.

Start (verified — `apps/ai/Dockerfile`): auto-instrument qua wrapper, **port 5001**:
```bash
CMD ["opentelemetry-instrument", "flask", "--app", "src.main:create_app", "run", "--host=0.0.0.0", "--port=5001"]
```
Bootstrap `apps/ai/src/observability/setup.py` (verified — **traces-only**): `init_otel()` tạo/tái dùng `TracerProvider` (phát hiện provider do agent set sẵn) + `OTLPSpanExporter` gRPC insecure. *(🟡 init_otel() có được gọi lúc startup hay không: CHƯA VERIFY — agent `opentelemetry-instrument` vẫn set provider độc lập.)*

Manual spans (verified, tên span LIVE): `ai.intent.handle`, `ai.intent.resume`, `ai.classify_intent`, `analyze.*` (`load_context/transcribe/classify/execute_queries/narrate`), `voice.*` (`load_context/transcribe/parse_intent`), `mcp.client.{method}`, `llm.gemini.generate`, `llm.openai.generate`, `sse.published`.

### 3.3 MCP Server

Dependencies thật (`apps/mcp/pyproject.toml` — verified): như AI, cộng thêm `opentelemetry-instrumentation-psycopg` + `opentelemetry-instrumentation-requests` (MCP dùng requests + Postgres).

Start (verified — `apps/mcp/Dockerfile`), **port 5050**:
```bash
CMD ["opentelemetry-instrument", "python", "-m", "src.server", "--host=0.0.0.0", "--port=5050"]
```
Bootstrap `apps/mcp/src/observability/setup.py` (verified — **traces-only**): `init_otel()` → `TracerProvider` + `OTLPSpanExporter` gRPC (default `http://otel-collector:4317`) + `BatchSpanProcessor` (queue 2048 / flush 5s / batch 512) + Resource `service.name=mcp`; emit span boot `otel.initialized`; graceful shutdown SIGTERM/SIGINT (force_flush 5s). **`init_otel()` được gọi ở `server.py:188`** ✅.

Spans (verified, tên LIVE): wrapper chung `mcp.tool.{method}` (`tools/__init__.py`) + per-tool: `speech.openai.stt`, `speech.openai.tts`, `vision.gemini.call`, `vision.suggest_attributes.call`, `vespa.compare_similar.call`, `vespa.search_trend.call`, `vespa.index.call`, `vespa.image_nearest_neighbor.call`; và `rpc.dispatch` (`server.py`, **có context propagation** `context=ctx`).

### 3.4 Next.js (Web)

🟡 **CHƯA VERIFY.** Service `icp/web:dev` tồn tại trong compose; instrumentation observability của web chưa đối chiếu code. Production (nice-to-have): `@vercel/otel` hoặc OTel browser SDK, chỉ trace fetch + page-load.

## 4. Standard Log Schema

Mọi service emit log JSON với fields chuẩn:
```json
{
  "timestamp": "2026-05-21T10:30:45.123Z", "level": "info", "service": "gateway",
  "trace_id": "5b8a...", "span_id": "0515...",
  "message": "product_created",
  "request_id": "req_abc", "user_id": "u_xxx", "intent": "importing_by_images", "phase": "commit",
  "duration_ms": 145, "ok": true, "error_code": null, "error_message": null,
  "extras": { "product_id": "p_xxx" }
}
```

### Fields LOCKED (bắt buộc mọi log entry) — verified ở Pino (gateway) + structlog (ai/mcp)

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO 8601 | UTC |
| `level` | enum | xem §6 — ⚠️ **enum khác nhau giữa Node và Python** |
| `service` | string | gateway: từ `base`; mcp: hardcode `"mcp"`; **ai: cơ chế 🟡 CHƯA VERIFY** |
| `trace_id` | hex | OTel inject per-call |
| `span_id` | hex | OTel inject per-call |
| `message` | string | snake_case event name (structlog rename `event`→`message`) |

> ⚠️ **Bất nhất no-span placeholder (verified):** khi không có active span → gateway Pino = `""`, AI structlog = `""`, **MCP structlog = `"0"*32` / `"0"*16`**. Cần thống nhất 1 quy ước.

### Fields OPTIONAL (khi liên quan)

| Field | When |
|---|---|
| `request_id` | Every HTTP request |
| `user_id` | After auth |
| `tenant_id` | Multi-tenant (ADR-040) — **🟡 CHƯA CODE** (không có trong logger gateway/ai/mcp) |
| `intent` / `phase` | Inside intent flow / multi-stage |
| `duration_ms` / `ok` | Operations |
| `error_code` / `error_message` | When `ok=false` |
| `extras` | Domain-specific (nested object) |

### Anti-patterns (CẤM)
```js
log.info(`User ${user.email} created product ${p.id}`);          // ❌ free-form
log.info({ message: 'product_created', extras: { product_id: p.id } }); // ✅ structured
```
Dùng shared helper: gateway `createLogger(service, version)`; ai/mcp `get_logger()` / `setup_logger()`.

## 5. Message Naming Convention

Format: `<noun>_<past_verb>` hoặc `<noun>_<verb>_failed`. Catalog message names → `LOG_CATALOG.md` (append-only). *(🟡 Danh sách message dùng trong code CHƯA verify toàn diện — coi là convention/registry mục tiêu.)*

## 6. Log Levels Guide

| Level | When |
|---|---|
| `trace` | Verbose flow, disabled prod *(🟡 structlog Python không có level này)* |
| `debug` | Detail for debugging, only dev |
| `info` | Business events, entry/exit major operations |
| `warn` / `warning` | Recoverable issues, retries *(Pino=`warn`; **structlog=`warning`**)* |
| `error` | Unhandled errors, external failures |
| `fatal` / `critical` | Service must restart *(Pino=`fatal`; **structlog=`critical`**)* |

> ⚠️ **Bất nhất level (verified — code):** gateway Pino dùng `trace/debug/info/warn/error/fatal`; ai/mcp structlog `add_log_level` cho `debug/info/warning/error/critical` (**không** `trace`, `warn`→`warning`, `fatal`→`critical`). *(Chuỗi runtime thật: 🟡 chưa lấy sample.)* Cần reconcile để Loki query đồng nhất.

## 7. Sensitive Data — NEVER LOG

- Passwords (raw/hash); Full JWT (chỉ log `jti`); Credit card / CVV; Full email/audio/image bytes; Personal addresses, phone numbers.

OK to log: `user_id` (UUID), `product_id`, `order_id`, counts/durations/status, first 8 chars idempotency-key.

**Redact thật — 3 cơ chế khác nhau (verified):**
- **Gateway (Pino, `logger.ts`):** path-based redact, list **hẹp**: `password, authorization, token, access_token, refresh_token, jwt` (+ glob `*.`), **không** redact `jti`.
- **MCP (structlog, `logger.py`):** key-recursive (depth ≤10), list **RỘNG**: `password, passwd, secret, token, access_token, refresh_token, jwt, authorization, auth, api_key, apikey, private_key, cookie, session`.
- **AI (structlog, `logger.py`):** key-recursive; comment khai "parity gateway" → **🟡 danh sách `_REDACT_KEYS` thật CHƯA VERIFY**.
- **Middleware regex-PII `redactor.ts` (tự che email/phone): 🟡 CHƯA CODE** — production nên thêm (GDPR/consent ADR-041).

## 8. Metrics

### 8.1 Cơ chế (verified)
App emit OTLP metrics → **otel-collector** → `prometheusremotewrite` → Prometheus (`/api/v1/write`). Prometheus chỉ scrape `prometheus` (self) + `otel-collector:8888`; **scrape `/metrics` của service đang COMMENT** trong `prometheus.yml` ("Future: S-02 add").
- Gateway: `metricReader` (OTLP) **được cấu hình** ở `otel.ts` (emit runtime: 🟡 chưa quan sát).
- AI/MCP: setup.py traces-only → **OTLP metrics emit 🟡 CHƯA VERIFY** (tùy env auto-instrument).

### 8.2 Bắt buộc track — 🟡 TARGET (chưa verify tên metric trong code)

| Metric | Type | Labels |
|---|---|---|
| `icp.intent.requests` | Counter | `intent`, `modality`, `status` |
| `icp.intent.duration` | Histogram | `intent`, `modality` |
| `icp.mcp.tool.calls` / `.duration` | Counter / Histogram | `tool`, `status` |
| `icp.vespa.results` | Histogram | `rank_profile` |
| `icp.events.published` | Counter | `event_type` |
| `icp.cards.generated` | Counter | `action_type` |
| `icp.orders.placed` / `icp.payments.outcome` | Counter | — / `outcome` |
| `icp.llm.tokens` / `icp.llm.duration` | Counter / Histogram | `provider`, `model`, `kind` |

### 8.3 Service health
Process metrics (mem/CPU/GC), DB pool, Kafka consumer lag, Redis hit ratio — auto qua instrumentation. *(🟡 chưa verify chi tiết.)*

## 9. Traces

### 9.1 Span hierarchy (tên span theo LIVE code — verified)
```
gateway.POST /intent (root)
  ├ gateway.controller.intent_dispatch
  │   └ (HTTP) → ai.intent.handle            (continued via trace context)
  │       ├ ai.classify_intent
  │       ├ mcp.client.{method}              → mcp.tool.{method}
  │       │                                     └ vision.gemini.call / vespa.search_trend.call / speech.openai.stt
  │       ├ llm.gemini.generate / llm.openai.generate
  │       └ sse.published
```
> Doc cũ dùng tên minh hoạ (`ai.graph.router.classify`, `mcp.tool.vision.analyze`, `llm.gemini.generate_content`, `vespa.http.search`) — **đã thay bằng tên LIVE**. *(🟡 Cây parent-child runtime chưa trace; mới đối chiếu tên span.)*

Context propagation:
- HTTP: `traceparent` header tự động (auto-instrumentation).
- MCP RPC: `rpc.dispatch` nhận `context=ctx` (verified — `server.py`).
- Kafka/SSE: pass `traceparent` (manual). *(🟡 impl Kafka propagation chưa verify — xem §10.)*

### 9.2 Span naming convention
Format gợi ý `<layer>.<component>.<operation>`. Tên LIVE thực tế (verified) đa dạng: `ai.intent.handle`, `vespa.search_trend.call`, `speech.openai.stt`, `mcp.tool.{method}`, `llm.gemini.generate`, `rpc.dispatch`, `sse.published`.

### 9.3 Span attributes
Mọi span: `service.name`, `service.version` (Resource); `user.id`, `intent.type`, `request.id` (nếu có). **`tenant.id`: 🟡 CHƯA CODE** (ADR-040 multi-tenant). Per type: HTTP (`http.method/route/status_code`), DB (`db.system/statement`), LLM (`llm.provider/model/input_tokens/output_tokens`), Vespa, MCP. *(🟡 attribute set thật chưa verify chi tiết.)*

### 9.4 Error recording
```ts
span?.recordException(err);
span?.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
span?.setAttribute('error.code', 'VESPA_TIMEOUT');
```

## 10. Kafka Tracing — 🟡 CHƯA VERIFY (impl)

Broker = Redpanda (`icp-redpanda`, verified tồn tại). Pattern mục tiêu: producer `propagation.inject(context.active(), headers)` → message headers; consumer `propagation.extract(...)` → `context.with(...)`. *(Code propagation Kafka thật chưa đối chiếu.)*

## 11. Logs/Metrics/Traces Correlation

Grafana datasources (verified `grafana-datasources.yml`): Loki, Tempo, **Prometheus (default)**. Tempo có `tracesToLogsV2` (→ Loki, tag `service`) + `lokiSearch`.
- ✅ Cấu hình correlation trace→logs **có sẵn**.
- 🟡 **NHƯNG hiện chưa hoạt động end-to-end:** logs chưa vào Loki (§1/§2) ⇒ "click trace → view logs" trả rỗng. Sửa khi đường log→Loki được wire.
- 🟡 `tracesToLogsV2.datasourceUid: loki` tham chiếu uid `loki` nhưng datasource Loki không khai `uid:` tường minh — nên kiểm tra linkage.

## 12. Health Endpoints (verified — `apps/gateway/src/health/health.controller.ts`)

```
GET /api/v1/health        → liveness   (@Get())
GET /api/v1/health/ready   → readiness  (@Get('ready'))
```
> **Đã sửa:** prefix thật là `/api/v1/health` (KHÔNG phải `/health`). **Không có `/health/live`** trong code → đã xóa khỏi doc.
> 🟡 Response body (`{ status, deps }`) — mới verify decorator/route, thân method chưa xem.

## 13. Dashboards — 🟡 CHƯA CODE

`infra/otel/grafana-dashboards/` hiện **chỉ có `.gitkeep`** (rỗng) — compose đã mount sẵn thư mục, **chưa có JSON nào**. Target (production):
1. Service Overview (RED) · 2. Intent Performance (p50/p95/p99) · 3. LLM Cost (tokens) · 4. Choreography Health (Kafka lag) · 5. Action Cards · 6. Business KPI (orders/h, payment success, GMV).

## 14. Alerting — 🟡 CHƯA CODE

Không có alert rule trong repo (verified). Target production (Grafana Alerting → Discord/Slack, check-in repo):
- p95 intent duration > 5s for 5min · Payment success rate < 70% for 10min · Any service `error` log rate > 10/min.

## 15. Phase Mapping

| Phase | What to instrument |
|---|---|
| **Phase 01** | OTel SDK bootstrap mọi service, JSON logger, health endpoints, auto-instrumentation |
| **Phase 02** | Manual spans login/search; metric `icp.intent.requests/.duration` |
| **Phase 03** | Spans LangGraph nodes, attributes vision/Vespa; `icp.cards.generated` |
| **Phase 04** | Kafka context propagation; `icp.events.published`, `icp.payments.outcome` |
| **Phase 05** | LLM token tracking, Vespa result histograms |
| **Phase 06** | Grafana dashboards, alerts, redact middleware, k6 load test |

> 🟡 **`worker-payment`**: doc tham chiếu (§4 service, `worker.payment.charge`, Phase 04) nhưng compose **không có container worker** (chỉ gateway/ai/mcp/web). In-process trong gateway hay CHƯA CODE: CHƯA VERIFY.

## 16. Env Vars

```
OTEL_SERVICE_NAME=<service>
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
OTEL_TRACES_SAMPLER=parentbased_always_on
APP_VERSION=0.0.1
```
Defaults trong `otel.ts` (gateway) verified (endpoint, service_name, version). **Sampler:** `otel.ts` KHÔNG set tường minh → effective = SDK default (`parentbased_always_on`) hoặc theo env. Production volume cao → `parentbased_traceidratio` ~10%.
> 🟡 `config/env.schema.ts` validate các biến này (otel.ts khai trong comment): CHƯA VERIFY.

## 17. Local Dev UX

```bash
# 1 command up cả app + observability (per comment compose; Makefile target: 🟡 CHƯA VERIFY)
make up        # docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml up

open http://localhost:3002    # Grafana, anonymous enabled (port 3002 per C11)
```
> **Đã sửa:** path thật là `infra/docker-compose.yml` + `infra/docker-compose.observability.yml` (doc cũ ghi `compose.yml` — sai; file nằm trong `infra/`, verified bằng `ls`).
Grafana auto-provisioned **3 datasources** (Loki, Tempo, Prometheus) ✅.

---

**END OF OBSERVABILITY DOC.**

Phần tiếp theo: `07_BEHAVIOR_LOGS.md` về user behavior events cho recommendation/analytics.
