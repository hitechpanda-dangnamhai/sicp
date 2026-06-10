# Phase 01 — Infrastructure & Skeleton

> **Status:** ✅ **DONE phần lõi** (monorepo + 4 service + DB/migrations + observability + codegen verified vs code/DB 2026-06-09). Phần production (Kafka wire, 8 worker, DR/backup, CI gate) = §Production hardening.
> **Mục tiêu:** Hạ tầng chạy được, 4 service skeleton, observability + codegen pipeline. Là nền cho Phase 02–06.
>
> **Cross-ref:** `01_ARCHITECTURE.md`, `02_DATA_MODEL.md`, `06_OBSERVABILITY.md`, `05_CODING_CONVENTIONS.md`.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs infra/docker-compose*.yml + query DB):
- Bỏ "Duration Tuần 1 / Day 1-7" (hackathon timebox) → status-based.
- Stack images = PINNED thật: postgres:16-alpine · redis/redis-stack-server:7.4.0-v8 (RedisJSON, KHÔNG redis:7-alpine) · redpandadata/redpanda:v23.3.10 · vespaengine/vespa:8. Observability pinned: Loki 2.9.4/Tempo 2.4.1/Prometheus v2.50.0/Grafana 10.4.0 (KHÔNG :latest, KHÔNG Mimir). Compose ở infra/ (KHÔNG root).
- redpanda CÓ trong compose nhưng Kafka CHƯA WIRE ở code (chỉ Redis pub/sub SSE) → đánh dấu rõ.
- DB: 8 migration applied (cao nhất V010, gap V004/V007), KHÔNG chỉ V001.
- Folder: apps/web dùng app/ (KHÔNG src/app); components/{ui,icp}.
- ADR-032 (mock, hackathon) → production = ADR-039 crawler thật → shopee_prices; hiện code = shopee_prices_mock (V008).
- MCP 37 tool (DONE); auth.verify_jwt = STUB. THÊM §Production hardening (DR/backup, CI gate, Kafka wire, workers, secrets). -->

## Definition of Done — trạng thái thật (verified 2026-06-09)

- [x] App stack `infra/docker-compose.yml` + observability `infra/docker-compose.observability.yml` boot ✅
- [x] **8 migration applied** (V001/002/003/005/006/008/009/010; gap V004/V007; cao nhất V010), `behavior_events` partitioned (y2026m05/06/07) ✅
- [x] 4 service (gateway/ai/mcp/web) `/health` + `/ready` ✅
- [x] Grafana `:3002` + 3 datasource (Loki/Tempo/Prometheus) auto-provisioned ✅
- [x] OTel trace context propagation gateway→ai→mcp (NodeSDK + OTLP gRPC → otel-collector:4317) ✅ (`06_OBSERVABILITY.md`)
- [x] Log schema chuẩn Loki (`service`/`trace_id`/`message`) + Pino redact ✅
- [x] Vespa `product.sd`: `text_embedding`, `image_embedding` (embed **native** từ `image_description`), behavioral signals (`impressions_7d`/`clicks_7d`/…/`dismissals_7d`/`ctr_7d`/`cvr_7d`/`velocity_score`) ✅
- [x] `apps/web` render UI thật (route `home`/`auth`/`intent-01..07`) — KHÔNG còn "trang trống ICP loaded" ✅
- [x] CI `.github/workflows/ci.yml` chạy lint + test ✅ (production: nâng gate — §hardening)
- [ ] Kafka topics — 🟡 **CHƯA WIRE** (redpanda có trong compose; code chỉ Redis pub/sub SSE). Phase 04 khi cần choreography.

## Stack thiết lập (verified — PINNED)

### `infra/docker-compose.yml` (app stack)

| Service | Image (pinned) | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | volume persistent |
| `redis` | `redis/redis-stack-server:7.4.0-v8` | 6379 | **redis-stack** (RedisJSON/RediSearch) — cần cho LangGraph RedisSaver + intent state |
| `redpanda` | `redpandadata/redpanda:v23.3.10` | 9092, 9644 | Kafka-compatible. ⚠️ **CHƯA WIRE ở code** (declared infra, app dùng Redis pub/sub). Dùng khi wire Kafka (Phase 04). |
| `vespa` | `vespaengine/vespa:8` | 8080, 19071 | volume |
| `gateway` | `icp/gateway:dev` (build `apps/gateway`) | 3001 | depends_on: postgres, redis, otel-collector |
| `ai` | `icp/ai:dev` (build `apps/ai`) | 5001 | depends_on: mcp, redis, otel-collector |
| `mcp` | `icp/mcp:dev` (build `apps/mcp`) | 5050 | depends_on: postgres, vespa, otel-collector |
| `web` | `icp/web:dev` (build `apps/web`) | 3000 | depends_on: gateway |

> Version pinned (không `:latest`) — đúng `05 §10` "pin versions, đừng dùng latest".

### `infra/docker-compose.observability.yml` (LGTM, pinned)

| Service | Image (pinned) | Port | Notes |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib:0.96.0` | 4317, 4318 | OTLP receiver (gRPC/HTTP) |
| `loki` | `grafana/loki:2.9.4` | 3100 | Logs |
| `tempo` | `grafana/tempo:2.4.1` | 3200 | Traces |
| `prometheus` | `prom/prometheus:v2.50.0` | 9090 | Metrics (**không Mimir**) |
| `grafana` | `grafana/grafana:10.4.0` | 3002 | Dashboards |

Chi tiết config: `06_OBSERVABILITY.md`.

### Network & volumes

```yaml
networks:
  icp: { driver: bridge }
volumes:
  pg_data:
  vespa_data:
  redis_data:
```

## Cấu trúc thư mục root (verified)

```
icp/  (~/projects/icpp/sicp)
├── package.json (root, pnpm workspaces; scripts: openapi:export/generate/sync, lint, test…)
├── pnpm-workspace.yaml
├── .env.example
├── apps/
│   ├── web/            ← Next.js App Router: app/{home,auth,me,intent-01..07,dev,api}, components/{ui,icp}, tailwind.config.ts  (KHÔNG có src/)
│   ├── gateway/        ← NestJS: src/{auth,cart,cards,intent,products,tracking,health,dashboard,observability,config}
│   ├── ai/             ← Flask + LangGraph: src/{main.py,state.py,graphs/{router_graph,intents/*},tools/mcp_client}
│   ├── mcp/            ← MCP server: src/tools/* (37 tool registered)
│   └── workers/        ← SKELETON: src/{index.ts, shopee-mock-seed-worker.ts}  (8 worker canonical 🟡 CHƯA CODE)
├── packages/
│   └── shared-types/   ← src/{api/(codegen từ OpenAPI), behavior/, dto/, sse/, cart.ts, products.ts, recommendations.ts, index.ts}
└── infra/
    ├── docker-compose.yml + docker-compose.observability.yml
    ├── migrations/     ← V001,V002,V003,V005,V006,V008,V009,V010 (+apply.sh). ⚠️ .sql có thể lệch DB → query DB là chuẩn.
    ├── seed/
    └── vespa/{services.xml, schemas/product.sd}
```

> **Shopee data (ADR-032 → ADR-039):** ADR-032 (hackathon) chốt mock = Postgres `shopee_prices_mock` (V008), seed bởi `apps/workers/src/shopee-mock-seed-worker.ts`. **Production = ADR-039 crawler thật → bảng `shopee_prices`** (worker `shopee-crawl` 🟡 CHƯA CODE); tool `shopee.price_range` giữ shape, đổi nguồn khi crawler online. ⚠️ rủi ro ToS.

## Build status (đã làm — thay "Day 1-7")

| Hạng mục | Trạng thái | Evidence |
|---|---|---|
| Monorepo pnpm + shared-types | ✅ | root `package.json`, `pnpm-workspace.yaml`, `packages/shared-types` |
| App + observability compose | ✅ | `infra/docker-compose*.yml` |
| OTel collector + LGTM provisioned | ✅ | `infra/` configs, datasources auto-provision (`06`) |
| Migrations (8) + behavior_events partitioned | ✅ | query DB |
| Vespa `product.sd` (6 rank-profile, 512-dim, signals) | ✅ | `02 §2` |
| Gateway skeleton + OTel + logger redact + health/ready | ✅ | `apps/gateway/src/observability/{otel.ts,logger.ts}`, health controller |
| AI service Flask + LangGraph router + mcp_client trace propagation | ✅ | `apps/ai/src/{main.py,graphs/router_graph.py,tools/mcp_client.py}` |
| MCP server + tool registry tracing | ✅ | **37 tool** registered; `auth.verify_jwt` = **STUB** (trả None, verify thật ở gateway) |
| Web Next.js (Tailwind+shadcn) + tracker + api-client codegen | ✅ | `apps/web`, `lib/tracker.ts`, `@icp/shared-types/api` |
| Codegen contract-first wired (`openapi:export/generate/sync`) | ✅ | root `package.json`, `openapi.json` committed (`05 §8`, `08`) |
| CI lint + test | ✅ (cơ bản) | `.github/workflows/ci.yml` — production nâng gate (§hardening) |

## Public interfaces sẵn cho Phase 02

- TypeScript types từ `@icp/shared-types` (api/ codegen + behavior/ + sse/).
- REST `/api/v1/health` + `/ready`.
- MCP: 37 tool (vd `auth.verify_jwt` STUB, `events.append`, `products.get`, `vespa.hybrid_search`…).
- DB tables: tất cả (8 migration applied).
- Redis (redis-stack) available; Vespa available.
- Kafka topics: 🟡 chưa create (Kafka chưa wire).

## Mock/dev data seed (dev only)

```
infra/seed/ : users (merchant/customer/admin demo), products (~50, ~10 category), policies
```

> Seed dev (mật khẩu demo, ~50 product) chỉ cho local/dev. **Production:** dữ liệu thật + (khi multi-tenant ADR-040) backfill `tenant_id` cho seed; KHÔNG commit secret; data seed không chứa PII thật.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vespa startup chậm + cấu hình | script deploy app package tự động; healthcheck |
| Version drift Python/Node | **Đã pin** images + Dockerfile (verified) |
| Migration không idempotent | Flyway versioning + `IF NOT EXISTS`; **forward-only + rollback plan** (production) |
| `.sql`/seed lệch DB thật | **Query DB là chuẩn cao nhất** (rule LAW) |

---

## Production hardening (CHƯA CODE / TÙY CHỌN — §5b)

| Hạng mục | Hiện trạng | Đề xuất + nên dùng gì | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **Backup / PITR / DR** | chưa thấy | `pg_dump` + WAL archiving (WAL-G) + restore runbook; Vespa/Redis snapshot | 🟡 CHƯA CODE | **P0** |
| **Migration rollback plan** | Flyway forward-only | mỗi V011+ kèm down/rollback note; test trên staging | 🟡 CHƯA CODE | **P0** |
| **CI gate nâng cao** | ci.yml lint+test | `eslint --max-warnings 0` + `tsc --noEmit` + `pnpm openapi:sync` drift check + coverage threshold (vitest chưa cấu hình — `05 §4`) | 🟡 CHƯA CODE | **P1** |
| **Kafka wiring** | redpanda có, code chưa dùng | KafkaJS + topic `icp.*` + transactional outbox + DLQ; producer inject trace context, consumer extract | 🟡 CHƯA CODE | P1 |
| **8 worker canonical** | skeleton (index + shopee-mock-seed) | card-generator/payment-consumer/inventory-consumer/notification-consumer/behavior-aggregator/outbox/audit-logger/shopee-crawl | 🟡 CHƯA CODE | P0–P1 |
| **Secrets management** | `.env` gitignored | vault/secret manager (rotate JWT secret, API keys); fail-fast config validate (đã có `05 §5`) | 🟡 CHƯA CODE | P1 |
| **Connection pool tuning + timeout I/O** | pool 10 default (`05 §9`) | tune per-service; timeout mọi I/O | 🟡 CHƯA CODE | P1 |
| **Graceful shutdown** | chưa thấy | SIGTERM drain (Nest `enableShutdownHooks`, Flask) + readiness flip | 🟡 CHƯA CODE | P1 |
| **Multi-tenant infra (ADR-040)** | 0 tenant_id | RLS GUC `app.current_tenant` + migration V011 (xem `02 §1.X`, Production Hardening Track @MASTER_ROADMAP) | 🟡 CHƯA CODE | **P0** |

---

## Khi Phase 01 hoàn tất (đã DONE)

Hạ tầng + 4 service + DB/migrations + observability + codegen đã chạy. Lưu ý Phase 02+: AI service đã wire qua gateway (intent stream qua Redis pub/sub SSE); Kafka/workers + DR/backup + CI gate = production hardening còn lại.

---

**END — PHASE_01 (Production reconcile 2026-06-09).**
