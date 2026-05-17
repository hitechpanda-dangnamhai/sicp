# Phase 01 — Infrastructure & Skeleton

> **Duration:** Tuần 1 (7 ngày)  
> **Mục tiêu:** Hạ tầng chạy được, skeleton 4 services, mock data sẵn sàng. Chưa có business logic.

## Definition of Done

- [ ] `make up` khởi động toàn bộ app stack + observability stack thành công
- [ ] Migrations chạy xong (gồm `behavior_events` table), seed data load đủ
- [ ] 4 services (gateway, ai, mcp, web) boot không lỗi và respond `/health`
- [ ] CI pipeline (GitHub Actions) chạy lint + test (test rỗng cũng OK)
- [ ] `apps/web` show trang trống "ICP loaded"
- [ ] Grafana UI accessible tại `:3002`, đã có 3 datasources (Loki, Tempo, Prometheus) auto-provisioned
- [ ] Gọi `/health` từ gateway → có trace trong Tempo với spans gateway/ai/mcp đầy đủ (verify trace context propagation)
- [ ] Logs từ gateway/ai/mcp xuất hiện trong Loki với schema chuẩn (`service`, `trace_id`, `message` field)
- [ ] Vespa schema gồm cả `text_embedding`, `image_embedding`, và behavioral signal fields (`impressions_7d`, `clicks_7d`, ...)

## Stack thiết lập

### docker-compose.yml services

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | volume persistent |
| `redis` | `redis:7-alpine` | 6379 | |
| `redpanda` | `redpandadata/redpanda:latest` | 9092, 9644 | Kafka-compatible, nhẹ hơn Kafka thật |
| `vespa` | `vespaengine/vespa:latest` | 8080, 19071 | volume |
| `gateway` | build từ `apps/gateway` | 3001 | depends_on: postgres, redis, redpanda, otel-collector |
| `ai` | build từ `apps/ai` | 5001 | depends_on: redpanda, mcp, otel-collector |
| `mcp` | build từ `apps/mcp` | 5050 | depends_on: postgres, vespa, otel-collector |
| `web` | build từ `apps/web` | 3000 | depends_on: gateway |

### docker-compose.observability.yml (tách riêng)

| Service | Image | Port | Notes |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib` | 4317, 4318 | OTLP receiver |
| `loki` | `grafana/loki` | 3100 | Logs backend |
| `tempo` | `grafana/tempo` | 3200 | Traces backend |
| `prometheus` | `prom/prometheus` | 9090 | Metrics backend |
| `grafana` | `grafana/grafana` | 3002 | Dashboards (admin/admin, anonymous enabled cho demo) |

Chi tiết config xem `06_OBSERVABILITY.md` section 2.

### Network & volumes

```yaml
networks:
  icp:
    driver: bridge

volumes:
  pg_data:
  vespa_data:
  redis_data:
```

## Cấu trúc thư mục root

```
icp/
├── docker-compose.yml
├── package.json (root, workspaces)
├── pnpm-workspace.yaml
├── .env.example
├── README.md
├── docs/  (đã có)
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── src/app/page.tsx
│   │   └── ...
│   ├── gateway/
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── src/main.ts
│   │   ├── src/app.module.ts
│   │   ├── src/health.controller.ts
│   │   └── Dockerfile
│   ├── ai/
│   │   ├── pyproject.toml
│   │   ├── src/main.py
│   │   ├── src/health.py
│   │   └── Dockerfile
│   ├── mcp/
│   │   ├── pyproject.toml
│   │   ├── src/main.py
│   │   └── Dockerfile
│   └── workers/
│       ├── package.json
│       └── src/index.ts (skeleton — chưa start)
├── packages/
│   └── shared-types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
└── infra/
    ├── migrations/
    │   └── V001__init.sql
    ├── seed/
    │   ├── users.json
    │   ├── products.json
    │   ├── policies.json
    │   ├── shopee-mock.json
    │   └── seed.ts (or .py)
    └── vespa/
        ├── services.xml
        └── schemas/product.sd
```

## Tasks ordering (theo dependency)

### Day 1 — Repo setup
- [ ] Tạo monorepo với pnpm workspaces (`pnpm-workspace.yaml`)
- [ ] `packages/shared-types` đầu tiên với các types từ `02_DATA_MODEL` + `03_API_CONTRACTS` + `07_BEHAVIOR_LOGS` (`PropertiesMap`)
- [ ] Root `package.json` với scripts: `dev`, `build`, `lint`, `test`, `obs:up`, `obs:down`
- [ ] `.gitignore`, `.editorconfig`, root `tsconfig.base.json`

### Day 2 — Infra services + Observability stack
- [ ] `docker-compose.yml` với postgres, redis, redpanda, vespa
- [ ] `docker-compose.observability.yml` với otel-collector, loki, tempo, prometheus, grafana
- [ ] `infra/otel/collector-config.yaml` — receive OTLP, fan out to backends
- [ ] `infra/otel/grafana-datasources.yml` — auto-provision 3 datasources
- [ ] `infra/otel/grafana-dashboards/` — placeholder dashboards JSON (sẽ fill Phase 06)
- [ ] `infra/otel/prometheus.yml`, `infra/otel/tempo.yaml`, `infra/otel/loki-config.yaml`
- [ ] `infra/migrations/V001__init.sql` — toàn bộ DDL từ `02_DATA_MODEL.md` + `behavior_events` table từ `07_BEHAVIOR_LOGS.md` section 5
- [ ] `infra/vespa/schemas/product.sd` — bao gồm behavioral signal fields từ `07_BEHAVIOR_LOGS.md` section 6.1
- [ ] `infra/seed/` — JSON files, plus `seed.ts` script
- [ ] Test: `make up` toàn stack, verify từng service alive, Grafana UI accessible

### Day 3 — Gateway skeleton (NestJS) với OTel
- [ ] `apps/gateway/src/observability/otel.ts` — OTel SDK bootstrap (PHẢI import đầu tiên trong main.ts)
- [ ] `apps/gateway/src/observability/logger.ts` — pino + OTel transport, helper `createLogger()` đảm bảo schema chuẩn
- [ ] `apps/gateway` init với Nest CLI
- [ ] Modules đăng ký: `HealthModule`, `ConfigModule`, `DbModule`, `ObservabilityModule`
- [ ] `HealthController`: `GET /api/v1/health` + `/ready` (check PG, Redis, Kafka, otel-collector)
- [ ] `IdempotencyMiddleware` skeleton — log `idempotency.lock_acquired` / `cache_hit` / `lock_conflict`
- [ ] `Dockerfile` multi-stage
- [ ] Env vars validation ở startup (fail-fast), bao gồm `OTEL_EXPORTER_OTLP_ENDPOINT`
- [ ] Smoke test: gọi `/health`, verify trace xuất hiện ở Tempo (qua Grafana Explore)

### Day 4 — AI service skeleton (Flask + LangGraph) với OTel
- [ ] `apps/ai` với `pyproject.toml`, deps: flask, langgraph, langchain, langchain-google-genai, langchain-openai, structlog, pydantic, **opentelemetry-distro**, **opentelemetry-instrumentation-flask**, **opentelemetry-exporter-otlp**
- [ ] `src/observability/setup.py` — initialize OTel (gọi đầu main.py)
- [ ] `src/observability/logger.py` — structlog với JSON formatter + trace_id/span_id auto-inject
- [ ] `src/main.py`: Flask app với `GET /health`, `/ready`. Start command: `opentelemetry-instrument flask run`
- [ ] `src/state.py`: `IcpState` TypedDict
- [ ] `src/graphs/router_graph.py`: skeleton, classify ra "unknown", log `intent.received` + `intent.classified`
- [ ] `src/tools/mcp_client.py`: MCP client với trace context propagation (inject `traceparent` header)
- [ ] `Dockerfile`

### Day 5 — MCP server skeleton với OTel
- [ ] `apps/mcp` Python, deps: pydantic, psycopg, redis, requests, OTel stack
- [ ] `src/observability/setup.py` — OTel init
- [ ] Tool registry pattern: mỗi tool wrap trong `tracer.start_as_current_span("mcp.tool.<name>")`
- [ ] Implement 3 tools đầu tiên + logging chuẩn:
  - `auth.verify_jwt` (log `auth.token_verified` / `token_invalid`)
  - `events.append` (log `event.appended`)
  - `products.get`
- [ ] HTTP server mode (JSON-RPC over POST /rpc), trace context extract from request headers
- [ ] Dockerfile

### Day 6 — Web skeleton (Next.js) + tracker SDK + OpenAPI codegen
- [ ] `apps/web` Next.js 14 App Router init (BÁM theo `PHASE_00_DESIGN_SYSTEM.md` đã chốt)
- [ ] **Component library từ Phase 00 sẵn sàng** — KHÔNG tạo lại
- [ ] `app/layout.tsx`, `app/page.tsx` → import từ `@/components/ui/*`
- [ ] `lib/api-client.ts` — import generated client từ `@icp/shared-types/api`, set `OpenAPI.BASE` + `OpenAPI.TOKEN`
- [ ] `lib/sse-client.ts` — typed wrapper từ `08_FE_BE_CONTRACT.md` section 6
- [ ] **`lib/tracker.ts`** — behavior event tracker từ `07_BEHAVIOR_LOGS.md` section 7
- [ ] **NestJS Swagger module** setup ở gateway, script `pnpm openapi:sync` chạy được
- [ ] **CI step**: `contract-check` workflow verify generated files committed
- [ ] **MSW setup** — `apps/web/src/mocks/handlers.ts` skeleton cho dev và Storybook
- [ ] **TanStack Query** Provider wrap app
- [ ] env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_VERSION`
- [ ] HTTP server mode (JSON-RPC over POST /rpc)
- [ ] Dockerfile

### Day 6 — Web skeleton (Next.js)
- [ ] `apps/web` Next.js 14 App Router init
- [ ] TailwindCSS + shadcn/ui setup
- [ ] `app/layout.tsx`, `app/page.tsx` → "ICP loaded"
- [ ] `lib/api-client.ts` skeleton (gọi gateway)
- [ ] `lib/sse-client.ts` skeleton (EventSource wrapper)
- [ ] env variable `NEXT_PUBLIC_API_URL`

### Day 7 — Glue + CI
- [ ] `Makefile` hoặc `package.json` root scripts: `make up`, `make seed`, `make logs`, `make down`
- [ ] GitHub Actions: lint + test workflow
- [ ] Root `README.md` với quickstart
- [ ] Smoke test: chạy toàn stack, hit health endpoints, seed chạy không lỗi

## Public interfaces sẵn cho Phase 02

- TypeScript types từ `shared-types`
- REST `/api/v1/health`
- MCP tools: `auth.verify_jwt`, `events.append`, `products.get`
- DB tables: tất cả (đã migrate)
- Redis available
- Kafka topics: chưa create (Phase 04 sẽ tạo)

## Mock data seed

```json
// users.json (5 users)
[
  { "email": "merchant1@demo.icp", "password": "demo1234", "role": "merchant", "display_name": "Anh Nam" },
  { "email": "merchant2@demo.icp", "password": "demo1234", "role": "merchant", "display_name": "Chị Lan" },
  { "email": "customer1@demo.icp", "password": "demo1234", "role": "customer", "display_name": "Khách 1" },
  { "email": "customer2@demo.icp", "password": "demo1234", "role": "customer", "display_name": "Khách 2" },
  { "email": "admin@demo.icp", "password": "demo1234", "role": "admin", "display_name": "Admin" }
]

// products.json — 50 sản phẩm
// 10 categories x 5 products mỗi cat
// Categories: nuoc_tuong, dau_an, mi_tom, sua, banh_keo, gia_vi, nuoc_giai_khat, do_dong_hop, gao, banh_mi
```

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vespa startup chậm + cấu hình nhức đầu | Có script `scripts/vespa-init.sh` deploy app package tự động |
| Conflict version Python/Node | Pin versions trong Dockerfile, đừng dùng "latest" |
| Migration chưa idempotent | Dùng `IF NOT EXISTS` everywhere, hoặc Flyway versioning |
| Team không biết Vespa | Pair-program 1 buổi, viết tutorial nội bộ |

## Câu hỏi cho human trước khi start

- [ ] Dùng pnpm hay yarn hay npm? (đề xuất pnpm)
- [ ] Có sẵn API key Gemini và OpenAI chưa?
- [ ] Test trên local Docker hay máy chủ riêng?

---

## Khi xong Phase 01

Tạo `PHASE_01_HANDOFF.md` với:
- ✅ List file/folder đã tạo
- ✅ Env vars cần thiết (đầy đủ trong `.env.example`)
- ✅ Cách chạy stack từ zero (`make up && make seed`)
- ✅ Decisions ad-hoc đã phát sinh
- ✅ Lưu ý cho Phase 02 (ví dụ: AI service chưa wire vào gateway, P02 sẽ làm)
