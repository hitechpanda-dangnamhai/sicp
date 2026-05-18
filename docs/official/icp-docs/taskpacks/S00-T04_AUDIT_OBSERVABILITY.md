# Claude Code Task Pack — S00-T04

## Task Type

**Q-GATE** (Audit only, không code)

## Objective

Audit observability stack: `docker-compose.observability.yml` (otel-collector, loki, tempo, prometheus, grafana), config files (`infra/otel/collector-config.yaml`, `grafana-datasources.yml`, `prometheus.yml`, `tempo.yaml`, `loki-config.yaml`, dashboards placeholders), per-service instrumentation hooks (OTel SDK init + structured logger), trace propagation contract (`traceparent` header HTTP + Kafka + SSE). So sánh hiện trạng vs PHASE_01_INFRA.md DoD-6 + DoD-7 + DoD-8 + `06_OBSERVABILITY.md` Section 4-8.

## Read First (Evidence)

1. `slices/S-00_BRIEF.md` — slice context
2. `reports/S00-T01_REPORT.md` (T01 baseline for compose files) + `reports/S00-T02_REPORT.md` (T02 baseline for services where instrumentation hooks live) + `reports/S00-T03_REPORT.md` (T03 for Postgres/Vespa connections that obs needs)
3. `docs/phases/PHASE_01_INFRA.md` lines 8-16 (DoD-6, DoD-7, DoD-8), lines 36-42 (obs stack table), lines 120-130 (Day 2 obs tasks)
4. `docs/06_OBSERVABILITY.md` lines 10-17 (LGTM stack rationale), line 61 (OTel collector receives OTLP, fans out), lines 171-220 (log JSON schema: `service`, `trace_id`, `span_id`, `message` snake_case), lines 233-258 (DO/DON'T examples), lines 273-317 (message catalog), line 327 (log levels), lines 346 (PII redactor), lines 350-358 (RED method per service), lines 419-421 (trace propagation: HTTP traceparent auto, Kafka manual, SSE query string), lines 437 (resource attributes `service.name`, `service.version`)
5. `docs/07_BEHAVIOR_LOGS.md` line 269 — event properties example for context propagation case
6. Per-service obs files (expected per PHASE_01 Day 3-6):
   - `apps/gateway/src/observability/otel.ts` (line 134)
   - `apps/gateway/src/observability/logger.ts` (line 135 — pino + OTel transport, `createLogger()` helper)
   - `apps/ai/src/observability/setup.py` (line 146 — OTel init)
   - `apps/ai/src/observability/logger.py` (line 147 — structlog + trace_id auto-inject)
   - `apps/mcp/src/observability/setup.py` (line 156)
7. `ai-delivery/TASK_OPERATING_SYSTEM.md` — Rules 3, 7

## Scope (ALLOWED to do)

- Audit `docker-compose.observability.yml` existence (separate from app `docker-compose.yml` per PHASE_01 line 33)
- Audit observability config files in `infra/otel/`:
  - `collector-config.yaml` (OTLP receivers + Loki/Tempo/Prometheus exporters fan-out)
  - `grafana-datasources.yml` (auto-provision Loki, Tempo, Prometheus — DoD-6 explicit)
  - `grafana-dashboards/*.json` placeholder
  - `prometheus.yml`, `tempo.yaml`, `loki-config.yaml`
- Audit per-service observability hooks expected at S-02 deliverable time:
  - **gateway:** `src/observability/otel.ts` (PHẢI import đầu tiên trong main.ts), `src/observability/logger.ts` (pino + OTel transport)
  - **ai:** `src/observability/setup.py` (gọi đầu main.py), `src/observability/logger.py` (structlog + trace_id auto-inject)
  - **mcp:** `src/observability/setup.py` + tool span wrapper pattern (`tracer.start_as_current_span("mcp.tool.<name>")`)
- Assess DoD-6 (Grafana :3002 accessible + 3 datasources auto-provisioned) feasibility
- Assess DoD-7 (gateway `/health` → trace propagates qua ai + mcp, spans visible Tempo) feasibility
- Assess DoD-8 (logs xuất hiện trong Loki với schema chuẩn `service`, `trace_id`, `message`) feasibility
- Cross-check log schema (`06_OBSERVABILITY.md` line 177-184) vs spec naming conventions
- Cross-check trace context propagation (HTTP auto via traceparent, Kafka manual headers, SSE query string per line 419-421)
- Classify severity (P0 if blocks DoD-6/7/8 demo; P1 if blocks Stage 2+ telemetry; P2 if polish)
- Identify slice owner: S-00b foundation scaffold (compose + YAML configs) OR S-02 (per-service instrumentation hooks)
- Estimate effort per Day 2 (compose + configs) + Day 3-5 (per-service instrumentation)

## Non-goals (NOT doing in this task)

- KHÔNG audit Grafana dashboard JSON content (placeholder Phase 06 territory per PHASE_01 line 124-125)
- KHÔNG audit specific log event names per intent flow — defer to LOG_CATALOG.md scope (T05 may surface cross-cut, but content owns by `docs/LOG_CATALOG.md`)
- KHÔNG audit PII redactor implementation (Section 8 line 346 hackathon polish)
- KHÔNG audit RED method dashboards (Section 9.1 deferred to Phase 06)
- KHÔNG audit Kafka topics observability (Phase 04 territory)
- KHÔNG decide LGTM self-hosted vs Grafana Cloud (per 06_OBSERVABILITY line 17-18 spec leaves both options; default LGTM self-hosted per PHASE_01 line 36-42)

## Allowed Changes

- Create: `taskpacks/S00-T04_AUDIT_OBSERVABILITY.md` (this file)
- Create: `reports/S00-T04_REPORT.md`
- Create: `reviews/S00-T04_REVIEW.md`

## Forbidden Changes

- KHÔNG touch `infra/otel/` (does not exist; do not stub)
- KHÔNG touch `apps/<service>/src/observability/` (does not exist; do not stub)
- KHÔNG touch `docs/` or `ai-delivery/`
- KHÔNG modify log schema (LOCKED per `06_OBSERVABILITY.md` line 177-220)
- KHÔNG propose specific YAML content — audit only

## Acceptance Criteria

- [ ] Per-config-file finding: `collector-config.yaml`, `grafana-datasources.yml`, `prometheus.yml`, `tempo.yaml`, `loki-config.yaml`, dashboards placeholder — exists yes/no, severity
- [ ] Per-service-hook finding: gateway otel/logger, ai setup/logger, mcp setup — exists yes/no
- [ ] DoD-6 verdict (Grafana :3002 + 3 datasources)
- [ ] DoD-7 verdict (trace propagation `/health` qua gateway/ai/mcp)
- [ ] DoD-8 verdict (Loki log schema compliance — `service`, `trace_id`, `message` snake_case)
- [ ] Severity classified; slice owner identified per gap (S-00b for configs; S-02 for per-service instrumentation hooks)
- [ ] Effort per Day mapping
- [ ] No drift into T05 (decisions consistency)
- [ ] Output report cites file path + line per Rule 3

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- Evidence conflict per Rule 7 — vd `06_OBSERVABILITY.md` log schema field `span_id` (line 182 implicit) chưa có trong DoD-8 spec line 15 ("`service`, `trace_id`, `message` field") → minor: spec sub-set of full schema, OK; flag for T05 if larger inconsistency
- ADR mới cần thiết — vd otel-collector exporter ordering (parallel vs serial) chưa spec
- Cần human decide — vd Tempo storage backend (local volume vs S3) — current spec defaults local volume per docker-compose
- Discover requirement chưa có specs — vd dashboard placeholder count, language for grafana-provisioning version
- Greenfield assumption violation — vd `infra/otel/` đã có files (per prompt: greenfield — MUST flag)

## Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice, không có previous slice để regression check.**

Forward-looking note:
- T04 findings inform S-00b candidacy heavily (obs stack is a Day 2 task, foundational scaffold) + S-02 P-CAP per-service instrumentation hooks.
