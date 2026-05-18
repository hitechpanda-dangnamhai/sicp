# Implementation Report — S00-T04 Audit Observability

> **Task Type:** Q-GATE audit-only
> **Method:** Checklist Mode (PHASE_01_INFRA.md DoD-6/7/8 + Day 2/3-6 + 06_OBSERVABILITY.md)
> **Date:** 2026-05-18

## 1. Audit Performed

**Files reviewed:**
- `docs/phases/PHASE_01_INFRA.md` (DoD-6/7/8 lines 13-15; obs stack table line 36-42; Day 2 obs tasks lines 122-127; per-service obs hooks Day 3 lines 134-141 / Day 4 lines 146-147 / Day 5 line 156)
- `docs/06_OBSERVABILITY.md` (full — LGTM stack rationale lines 10-17; otel-collector fan-out line 61; log JSON schema lines 171-220; DO/DON'T examples lines 233-258; message catalog lines 273-317; log levels line 327; PII redactor line 346; RED method lines 350-358; trace propagation HTTP/Kafka/SSE lines 419-421; resource attributes line 437)
- `docs/07_BEHAVIOR_LOGS.md` line 269 (event property example for context)
- `reports/S00-T01_REPORT.md` (T01-F5 docker-compose.observability.yml baseline)
- `reports/S00-T02_REPORT.md` (T02-F1/F2/F3/F4 services baseline — instrumentation hooks live inside services)
- `reports/S00-T03_REPORT.md` (T03 baseline — Postgres/Vespa connections that obs metrics scrape)
- `slices/S-00_BRIEF.md`
- `ai-delivery/TASK_OPERATING_SYSTEM.md`

**DoD items checked in this task:**
- DoD-6 — Grafana UI accessible :3002, 3 datasources auto-provisioned (Loki, Tempo, Prometheus)
- DoD-7 — Calling gateway `/health` produces trace in Tempo with spans gateway/ai/mcp (trace context propagation verified)
- DoD-8 — Logs from gateway/ai/mcp appear in Loki with schema `service`, `trace_id`, `message`

**Repo state:** GREENFIELD per prompt — no `infra/otel/`, no `apps/<service>/src/observability/` files.

## 2. Findings

### Finding T04-F1 — `docker-compose.observability.yml` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-1 + DoD-6 + Day 2 (line 122) — obs compose tách riêng |
| **Current state** | File absent (cross-reference T01-F5) |
| **Expected** | 5 services per PHASE_01 line 36-42: otel-collector (ports 4317 gRPC + 4318 HTTP OTLP), loki:3100, tempo:3200, prometheus:9090, grafana:3002 (admin/admin, **anonymous enabled cho demo**). Grafana admin defaults documented; healthchecks per service; volumes for tempo/loki/prometheus retention; shared network `icp`. |
| **Gap** | Entire obs orchestration absent |
| **Effort** | 0.5 day |
| **Slice owner** | **S-00b foundation scaffold** (foundational obs — DoD-6 explicit; must boot before any service instrumentation can validate) |
| **Severity** | **P0 BLOCKER** — DoD-1 + DoD-6 directly fail |

### Finding T04-F2 — `infra/otel/collector-config.yaml` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 (line 123) — receive OTLP, fan out to backends |
| **Current state** | File absent (`infra/otel/` directory does not exist) |
| **Expected** | OTel Collector pipeline config per `06_OBSERVABILITY.md` line 61:<br>• Receivers: `otlp` (grpc:4317 + http:4318)<br>• Processors: `batch`, `resource` (annotate `service.name`), optionally `attributes` for PII redaction stub per line 346<br>• Exporters: `loki` (push to loki:3100), `otlp/tempo` (push to tempo:4317), `prometheusremotewrite` (push to prometheus:9090) OR `prometheus` (scrape mode)<br>• Service pipelines: `logs` → loki, `traces` → tempo, `metrics` → prometheus |
| **Gap** | Fan-out config absent |
| **Effort** | 0.25-0.5 day |
| **Slice owner** | S-00b foundation scaffold |
| **Severity** | **P0 BLOCKER** — without collector, traces/logs/metrics from services have no destination |

### Finding T04-F3 — `infra/otel/grafana-datasources.yml` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-6 explicit + Day 2 (line 124) — auto-provision 3 datasources |
| **Current state** | File absent |
| **Expected** | Grafana provisioning YAML mounted at `/etc/grafana/provisioning/datasources/`:<br>• Loki datasource (URL `http://loki:3100`)<br>• Tempo datasource (URL `http://tempo:3200`)<br>• Prometheus datasource (URL `http://prometheus:9090`)<br>+ derived fields linking Loki `trace_id` → Tempo trace view (per `06_OBSERVABILITY.md` line 17-18 Grafana Cloud free tier optional alternative, but LGTM self-hosted is default) |
| **Gap** | Auto-provision contract absent |
| **Effort** | 0.25 day |
| **Slice owner** | S-00b |
| **Severity** | **P0 BLOCKER** — DoD-6 literal text says "3 datasources auto-provisioned" |

### Finding T04-F4 — `infra/otel/grafana-dashboards/*.json` placeholder MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 (line 125) — placeholder JSON, "sẽ fill Phase 06" |
| **Current state** | Directory + placeholder files absent |
| **Expected** | At minimum a Grafana provisioning YAML pointing to `/etc/grafana/dashboards/` + 1-2 empty dashboard JSON stubs (Intent Performance placeholder per `MASTER_ROADMAP.md` Stage 2 line 90, RED dashboards per `06_OBSERVABILITY.md` Section 9.1) |
| **Gap** | Placeholders absent |
| **Effort** | 0.1 day |
| **Slice owner** | S-00b (skeleton) — content in Phase 06 polish |
| **Severity** | **P2 MEDIUM** — not blocking DoD-6 literal datasource check; nice-to-have for early dashboard navigation |

### Finding T04-F5 — `infra/otel/prometheus.yml`, `tempo.yaml`, `loki-config.yaml` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 (line 126) |
| **Current state** | All three absent |
| **Expected** | Backend-specific configs:<br>• `prometheus.yml` — scrape configs for otel-collector + any direct service `/metrics` endpoints<br>• `tempo.yaml` — local storage backend (or S3 for prod), OTLP receivers wiring<br>• `loki-config.yaml` — local filesystem storage, retention policy (e.g., 7d for demo) |
| **Gap** | All three absent |
| **Effort** | 0.25 day combined |
| **Slice owner** | S-00b |
| **Severity** | **P0 BLOCKER** — backend containers will not start without their configs (or will use defaults that don't suit OTLP push from collector) |

### Finding T04-F6 — `apps/gateway/src/observability/otel.ts` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-7 + DoD-8 + Day 3 (lines 134-135) |
| **Current state** | Cross-reference T02-F1 — gateway service does not exist |
| **Expected** | OTel SDK bootstrap, MUST be imported FIRST in `main.ts` (per PHASE_01 line 134). Init Resource with `service.name=gateway`, `service.version=$NEXT_PUBLIC_APP_VERSION`. NodeSDK with OTLP exporter pointing to `OTEL_EXPORTER_OTLP_ENDPOINT`. Auto-instrumentation: http, express, pg, redis, kafkajs, ioredis. |
| **Gap** | SDK bootstrap absent |
| **Effort** | 0.25 day (within Day 3 gateway effort, T02-F1) |
| **Slice owner** | S-02 P-CAP (OTel SDK init is MUST_BEFORE capability per `MASTER_SLICE_BACKLOG.md` S-02 details) |
| **Severity** | **P0 BLOCKER** — DoD-7 + DoD-8 fail without SDK init |

### Finding T04-F7 — `apps/gateway/src/observability/logger.ts` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 3 (line 135) + DoD-8 |
| **Current state** | Cross-reference T02-F1 |
| **Expected** | pino + OTel transport (logs export via OTLP to collector → Loki). Helper `createLogger(service, version)` per `06_OBSERVABILITY.md` line 258. Output JSON per spec schema lines 171-220: `service`, `version`, `level`, `trace_id`, `span_id`, `message` (snake_case event name), `event_id`, `user_id`, `request_id`, `latency_ms`, `status_code`, `ok`, `error_code`, `error_message`. |
| **Gap** | Logger helper absent |
| **Effort** | 0.25 day |
| **Slice owner** | S-02 P-CAP |
| **Severity** | **P0 BLOCKER** — DoD-8 schema compliance fails without helper |

### Finding T04-F8 — `apps/ai/src/observability/setup.py` + `logger.py` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 4 (lines 146-147) |
| **Current state** | Cross-reference T02-F2 |
| **Expected** | `setup.py`: OTel init via `opentelemetry-distro` + `opentelemetry-instrumentation-flask`; start command `opentelemetry-instrument flask run` (per PHASE_01 line 147 explicit). `logger.py`: structlog with JSON formatter, processors include trace_id/span_id auto-inject from current span context. |
| **Gap** | Both files absent |
| **Effort** | 0.25 day combined |
| **Slice owner** | S-02 P-CAP |
| **Severity** | **P0 BLOCKER** — AI service traces invisible in Tempo; DoD-7 fails for ai span |

### Finding T04-F9 — `apps/mcp/src/observability/setup.py` MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 5 (line 156) |
| **Current state** | Cross-reference T02-F3 |
| **Expected** | OTel init in MCP server; tool execution wrapped in `tracer.start_as_current_span("mcp.tool.<name>")` per PHASE_01 line 157. Trace context extracted from request `traceparent` header per Day 5 line 161. |
| **Gap** | OTel init + span wrapping absent |
| **Effort** | 0.25 day |
| **Slice owner** | S-02 P-CAP |
| **Severity** | **P0 BLOCKER** — DoD-7 spec says "spans gateway/ai/mcp đầy đủ" — without MCP span wrapping, DoD-7 visibly fails |

### Finding T04-F10 — Trace context propagation contract MISSING wiring

| Field | Value |
|---|---|
| **DoD/Day** | DoD-7 + `06_OBSERVABILITY.md` lines 419-421 |
| **Current state** | No services exist to wire propagation |
| **Expected** | Per spec:<br>• **HTTP:** `traceparent` header automatic via auto-instrumentation (gateway → ai/mcp HTTP calls)<br>• **Kafka:** pass `traceparent` in message headers manually (Phase 04 Kafka territory — not Stage 1 critical)<br>• **SSE:** pass `traceparent` in query string manually (Stage 2 Intent 03 critical)<br>• In AI service, MCP client wrapper (`apps/ai/src/tools/mcp_client.py` per Day 4 line 150) MUST inject `traceparent` header explicitly |
| **Gap** | Wiring absent across services |
| **Effort** | 0.25 day (mainly mcp_client.py header injection — pure HTTP propagation is automatic) |
| **Slice owner** | S-02 P-CAP (MCP client wrapper is MUST_BEFORE) |
| **Severity** | **P0 BLOCKER** — DoD-7 explicit test "gọi /health từ gateway → có trace trong Tempo với spans gateway/ai/mcp" |

### Finding T04-F11 — Log schema compliance (`service`, `trace_id`, `message`)

| Field | Value |
|---|---|
| **DoD/Day** | DoD-8 explicit |
| **Current state** | No services emit logs yet (greenfield) |
| **Expected** | Per `06_OBSERVABILITY.md` lines 211-215:<br>• `service` (string: `gateway`/`ai`/`mcp`/`worker-*`)<br>• `trace_id` (hex, OTel inject)<br>• `span_id` (hex, OTel inject — implicit, not listed in DoD-8 minimum)<br>• `message` (snake_case event name, NOT free-form per line 215 + 233-238)<br>• Other fields: `version`, `level`, `event_id`, `user_id`, `request_id`, `latency_ms`, `status_code`, `ok`, `error_code` (when ok=false), `error_message` (when ok=false) |
| **Gap** | No emission; schema check deferred to validation after S-02 lands instrumentation |
| **Effort** | (covered in F7/F8/F9 logger files) |
| **Slice owner** | S-02 |
| **Severity** | **P0 BLOCKER** for DoD-8; **minor doc clarification:** DoD-8 lists `service`, `trace_id`, `message` as required — full schema is larger. Treat DoD-8 as floor, not ceiling. |

### Finding T04-F12 — RED dashboards (Phase 06 polish) NOT a Stage 1 blocker

| Field | Value |
|---|---|
| **DoD/Day** | `06_OBSERVABILITY.md` Section 9.1 — RED method per service |
| **Current state** | No dashboards |
| **Expected per Phase 06 polish (not Phase 01)** | RED (Rate/Error/Duration) per service |
| **Gap** | Polish item |
| **Effort** | 0.5-1 day in Phase 06 |
| **Slice owner** | Phase 06 polish slice (S-11 candidate) |
| **Severity** | **P2 MEDIUM** — outside Stage 1 DoD |

### Finding T04-F13 — PII redactor (Section 8 line 346) NOT a Stage 1 blocker

| Field | Value |
|---|---|
| **DoD/Day** | `06_OBSERVABILITY.md` line 346 — "Hackathon: thêm middleware redact PII tự động (regex email, phone). File `apps/<service>/src/observability/redactor.ts`" |
| **Current state** | Absent |
| **Expected** | Middleware regex strip email/phone before log emission |
| **Gap** | Polish |
| **Effort** | 0.25 day |
| **Slice owner** | Phase 06 polish |
| **Severity** | **P2 MEDIUM** — defer per spec phrasing "Hackathon: thêm" (optional add-on) |

### Summary Table — T04 Findings

| Finding | DoD/Day | Severity | Effort (days) | Owner candidate |
|---|---|---|---|---|
| F1 docker-compose.observability.yml | DoD-1/6 / Day 2 | P0 | 0.5 | S-00b |
| F2 collector-config.yaml | Day 2 | P0 | 0.25-0.5 | S-00b |
| F3 grafana-datasources.yml | DoD-6 / Day 2 | P0 | 0.25 | S-00b |
| F4 grafana-dashboards placeholder | Day 2 | P2 | 0.1 | S-00b skeleton; Phase 06 fill |
| F5 prometheus.yml / tempo.yaml / loki-config.yaml | Day 2 | P0 | 0.25 | S-00b |
| F6 gateway otel.ts | DoD-7/8 / Day 3 | P0 | 0.25 | S-02 |
| F7 gateway logger.ts | DoD-8 / Day 3 | P0 | 0.25 | S-02 |
| F8 ai setup.py + logger.py | DoD-7/8 / Day 4 | P0 | 0.25 | S-02 |
| F9 mcp setup.py + span wrap | DoD-7 / Day 5 | P0 | 0.25 | S-02 |
| F10 Trace propagation wiring (mcp_client.py) | DoD-7 / Day 4 | P0 | 0.25 | S-02 |
| F11 Log schema compliance | DoD-8 | P0 (in F7/F8/F9) | — | S-02 |
| F12 RED dashboards | Phase 06 | P2 | 0.5-1 (Phase 06) | S-11 polish |
| F13 PII redactor | optional | P2 | 0.25 (Phase 06) | S-11 polish |
| **Total T04 scope (Stage 1)** | | | **~2.5 days** | (split S-00b ~1.5d + S-02 ~1d) |

### DoD verdict from T04 perspective
- **DoD-6** (Grafana :3002 + 3 datasources auto-provisioned): ❌ TODO
- **DoD-7** (Trace propagation gateway → ai → mcp): ❌ TODO
- **DoD-8** (Loki logs schema): ❌ TODO

## 3. Commands Run

**N/A: audit không chạy bash.**

## 4. Test Results

**N/A: audit không có test code.**

## 5. Deviations From Task Pack

None. Stayed within obs scope. Did not audit log catalog file content (`docs/LOG_CATALOG.md`) for new ADR impact per Non-goals. Did not audit specific event names per intent flow.

## 6. Known Issues

- **F11 schema clarification minor:** DoD-8 lists only 3 fields (`service`, `trace_id`, `message`) but full spec (`06_OBSERVABILITY.md` lines 171-220) has 13+ fields. T05 should note as P3-informational (DoD acts as floor, not ceiling — spec wins for full compliance). Not a conflict per Rule 7, just spec phrasing trade-off.
- **F4 + F12 placeholder vs Phase 06 fill timing:** Stage 1 only needs empty dashboards directory + provisioning YAML pointing to it. Actual dashboard JSON authoring is Phase 06. Be careful S-00b doesn't over-deliver and consume Phase 06 polish budget.
- **F10 SSE `traceparent` query string** (per spec line 421) is unusual — most tools auto-inject via header. Will need explicit custom client logic in SSE wrapper (Day 6 line 213 `lib/sse-client.ts`). Note for S-02 P-CAP CAN_INCREMENTAL slot (per backlog matrix).

## 7. Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice.**

## 8. Recommended Next Step

Proceed to **S00-T05 Audit Decisions Consistency**. T05 will synthesize the docs inconsistencies surfaced by T01 (PHASE_01 line 273 pnpm question still phrased open), T02 (MCP `/health` doc gap; Day 6 stray JSON-RPC line; duplicate Day 6 headers), T03 (F13 shopee-mock.json ADR-008 vs ADR-032).

## Bonus — Conflicts Surfaced (Rule 7)

**No new conflicts in T04 scope** — `06_OBSERVABILITY.md` is internally consistent and aligns with `PHASE_01_INFRA.md` Day 2-5 obs tasks.

**1 minor spec phrasing observation** (informational, not a conflict — forwarded to T05):
- DoD-8 minimum schema list (`service`, `trace_id`, `message`) is subset of full `06_OBSERVABILITY.md` schema. Either expand DoD-8 enumeration to match, OR keep DoD-8 as "minimum acceptable" and note spec is authoritative. P3 polish, defer.
