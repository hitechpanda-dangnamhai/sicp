# Phase 06 — Polish, Observability & Operations (Launch Readiness)

> **Status:** OTel + LGTM + log redaction = ✅ **DONE** (verified). Alerting/SLO, load test, DR, runbook = 🟡 **CHƯA CODE** (production launch readiness).
> **Mục tiêu (production):** Ổn định 8 intents, quan sát đầy đủ (traces/logs/metrics), alerting + SLO, độ tin cậy vận hành, sẵn sàng go-live. *(Thay "Demo Prep/Pitch" hackathon — ADR-037.)*
>
> **Cross-ref:** `06_OBSERVABILITY.md`, `05_CODING_CONVENTIONS.md` §11 (performance budget), `LOG_CATALOG.md`, Production Hardening Track @`MASTER_ROADMAP.md`.

<!-- PRODUCTION RECONCILE (2026-06-09, ADR-037 Hackathon→Production):
- XOÁ toàn bộ demo/pitch: §B Demo Script, §C Pitch Deck, §D Demo Reliability, §G Submission Checklist, ICP_DEMO_MODE, make demo:freeze, "force payment 100%", "ban giám khảo", "8 phút", "2 laptop backup", Day1-7.
- Observability verified DONE: OTel NodeSDK+OTLP gRPC→otel-collector:4317; ai/mcp instrument; Pino 6 redact + trace_id/span_id inject; LGTM pinned (Loki2.9.4/Tempo2.4.1/Prom v2.50.0/Grafana10.4.0, no Mimir).
- CHƯA CODE: Grafana Alerting+SLO, production dashboards (placeholder), recording rules, regex-PII redactor, k6 load test, DR/backup, runbook. Kafka consumer-lag panel = Kafka chưa wire.
- GIỮ §E perf budget (→ production SLO). -->

## Definition of Done — production launch readiness

- [x] OTel traces/logs/metrics pipeline (gateway+ai+mcp → otel-collector → LGTM) ✅
- [x] Log redaction (Pino LOCKED fields) — không leak password/token/authorization trong Loki ✅
- [x] Grafana + 3 datasource (Loki/Tempo/Prometheus) auto-provisioned ✅
- [ ] 8 intents ổn định + a11y (loading/empty/error states) — phần lớn DONE; a11y audit 🟡
- [ ] Grafana **Alerting + SLO/error-budget** — 🟡 CHƯA CODE
- [ ] Load test (k6) đạt performance budget — 🟡 CHƯA CODE
- [ ] DR/backup (PITR) + runbook/on-call — 🟡 CHƯA CODE
- [ ] LOG_CATALOG đầy đủ (audit grep) — duy trì

## A. UI Polish

- ✅ Loading/empty/error states: components thật `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, toasts (`UndoRemoveToast`, `PendingSyncToast`, `PromoSuccessBanner`); `SuccessTransition`.
- 🟡 **A11y** (P1): `@media (prefers-reduced-motion: no-preference)` wrap mọi animation; contrast WCAG AA (deep-maroon/hồng); focus ring; aria cho mic/orb/sheet. Cross-ref `PHASE_00 §11`.
- 🔵 Dark mode (TÙY CHỌN P2); streaming typewriter (cosmetic).

## B. Observability

### Verified DONE
- **OTel:** gateway NodeSDK + OTLP gRPC → otel-collector:4317 (+auto-instrumentations); ai/mcp `opentelemetry-*` (flask/httpx/psycopg). Sampler = `parentbased_always_on` (env `OTEL_TRACES_SAMPLER`; production cao tải → `parentbased_traceidratio` ~10%). `apps/gateway/src/observability/otel.ts`.
- **Logs:** Pino JSON, 6 LOCKED fields + `trace_id`/`span_id` auto-inject + path-redact (password/authorization/token/access_token/refresh_token). `logger.ts`.
- **LGTM (pinned):** Loki 2.9.4 / Tempo 2.4.1 / Prometheus v2.50.0 / Grafana 10.4.0 (**không Mimir**).
- **LOG_CATALOG.md** = nguồn message/event (31 behavior event types ở `catalog.ts`).

### Production gaps (🟡 CHƯA CODE)
- **Grafana Alerting + SLO/error-budget** (P0): alert p95 intent > 5s/5min; payment success-rate thấp (sau khi wire VNPay/Momo/ZaloPay); aggregator lag > 10min; error-rate. Nên dùng: Grafana Alerting + Prometheus recording/alerting rules (→ Slack/PagerDuty). *(Thay "alert chỉ console/Slack" hackathon.)*
- **Production dashboards** (P1): Service map (RED) gateway/ai/mcp/workers; Intent latency p95 per intent; LLM token usage + cost; Behavior funnel (`product.viewed→cart.item_added→checkout.completed`); per-tenant panel (ADR-044 usage). *(Hiện grafana-dashboards = placeholder JSON.)*
- **Kafka consumer-lag panel** (P1): chỉ khi Kafka wire (hiện CHƯA WIRE).
- **Regex-PII redactor** (P1): bổ sung Pino path-redact (bắt PII trong message body, không chỉ path).
- **Recording rules** Prometheus (P2): pre-aggregate metric tần suất cao.
- **tenant_id** trong log schema + span attr (P1, khi multi-tenant).

## C. Performance budget → SLO (production)

| Budget | Target | Trạng thái |
|---|---|---|
| API p95 (non-AI) | < 500ms | SLO |
| First SSE event | < 1s | SLO |
| AI full response | < 8s | SLO |
| Voice transcribe (audio 5s) | < 3s | SLO |
| Vision analyze | < 4s | SLO |
| Vespa search | < 200ms | SLO |
| FE bundle/route | < 500KB gz | gate CI (P1) |

Tối ưu khi chậm: cache embedding (Redis key=SHA256 input); pre-warm LLM client; connection pool tuning; CDN ảnh. 🟡 **Load test (k6)** mô phỏng tải → verify SLO (P1).

## D. Reliability & Operations (🟡 CHƯA CODE — P0/P1)

| Hạng mục | Đề xuất + nên dùng gì | Ưu tiên |
|---|---|---|
| **DR / backup / PITR** | `pg_dump` + WAL archiving (WAL-G); Vespa/Redis snapshot; restore runbook | **P0** |
| **Graceful shutdown** | Nest `enableShutdownHooks` + Flask drain; readiness flip | P1 |
| **Circuit breaker + retry** | call ngoài (VNPay/Momo/ZaloPay, Vespa, Gemini/OpenAI, Shopee) | P1 |
| **Runbook + on-call** | sự cố thường gặp + escalation; alert → action | P1 |
| **Outbox relay + DLQ** | khi Kafka wire (events `published_at=NULL` → publish) | P1 |
| **Health/readiness probe** | đã có (`/health`/`/ready`) — verify deep checks (PG/Redis/Vespa) | ✅/P1 |

## E. Security hardening (rollup — cross-ref các phase)

- Rate-limit/lockout auth (P0, `PHASE_02`); CORS allowlist + helmet/CSP/HSTS (P0); refresh reuse-detection (P0); secrets vault + JWT rotation (P1, `PHASE_01`).
- Payment: IPN signature verify + idempotent dedup_key + no-log payload (P0, `PHASE_04`).
- Multi-tenant RLS (P0, ADR-040); GDPR consent/DSAR + retention (P0, ADR-041); hash-chain audit (P1, ADR-042); usage metering (P2, ADR-044). Cross-ref Production Hardening Track @`MASTER_ROADMAP.md`.

## F. Documentation

- Root README (architecture diagram + quickstart `make up && make seed` + env vars).
- `docs/` đầy đủ + runbook + ADRs (`DECISIONS.md`).
- CHANGELOG; API docs từ OpenAPI (`openapi.json`).

## Production launch checklist

- [ ] Alerting + SLO live; dashboards production (P0)
- [ ] DR/backup tested restore (P0)
- [ ] Security hardening (rate-limit/CORS/CSP/secrets/IPN) (P0)
- [ ] Multi-tenant + GDPR (ADR-040/041) (P0)
- [ ] Load test đạt SLO (P1)
- [ ] Runbook + on-call (P1)
- [ ] CI gate (lint --max-warnings 0 + typecheck + openapi:sync + coverage) (P1)

---

## Khi Phase 06 hoàn tất → GO-LIVE

Observability + alerting + DR + security hardening + multi-tenant/GDPR đạt → production go-live. Tạo `RELEASE_NOTES.md` (feature shipped, known issues, runbook link, future work).

---

**END — PHASE_06 (Production reconcile 2026-06-09).**
