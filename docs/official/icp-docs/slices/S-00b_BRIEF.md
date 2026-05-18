# Slice Brief — S-00b Foundation Scaffold

## Slice Goal

Land toàn bộ P0 foundation scaffold (monorepo + 2 compose files + observability stack configs + V001 init + seed scaffolding + Vespa schema + web placeholder + CI workflow) trong 1 slice coordinated. Sau khi merge S-00b, gõ `make up && make seed` PASS được **5/9 DoD Phase 01** (DoD-1, DoD-2, DoD-5, DoD-6, DoD-9), tạo Stage 1 floor sạch cho S-01 H-UI + S-02 P-CAP chạy parallel. Per `s00-outputs/reports/S00-REPORT.md` Section 5 Option B (recommended).

## Slice Type

**P-CAP** (Platform Capability — code thật, scaffold capabilities mà mọi service downstream consume).

> **Note:** S-02 Runtime Foundation cũng là P-CAP nhưng tập trung per-service capabilities (OTel SDK init mỗi service, OpenAPI codegen, idempotency middleware, behavior tracker SDK, LangGraph router skeleton). S-00b vs S-02 split confirmed ở `s00-outputs/reports/S00-REPORT.md` Section 5 Option B (lines 197-208 S-00b scope vs lines 210-218 S-02 remaining).

## Method Áp Dụng ⭐

**CDP — Capability-Driven Planning** (per `docs/workflow/ICP_WORKFLOW_FINAL.md` §5.3, lines 456-479).

5 bước: `INVENTORY → CONSUMER_MAPPING → TIMING_DECISION → TASK_BREAKDOWN → ACCEPTANCE_TESTS`.

### Bước 1 — INVENTORY (capabilities deliverable trong S-00b)

Liệt kê theo gap ID từ S00-REPORT.md:

| Capability | Gap IDs | DoD covered |
|---|---|---|
| Monorepo root scaffold (pnpm workspace, tsconfig.base, .gitignore, .editorconfig, .env.example, root package.json scripts, Makefile, README) | G-01, G-02, G-05, G-06, G-20, G-21, G-26, G-27 | DoD-1 (Makefile), implicit DoD-4 (lint script registered) |
| Shared packages scaffold (`packages/shared-types/` empty package + `apps/workers/` skeleton) | G-07, G-28 (shell) | Day 1 prerequisite for FE-BE contract pattern (codegen filled by S-02) |
| Service Dockerfile stubs (gateway/ai/mcp/web — minimal `HEALTHCHECK`-only images, no business logic) | G-08 stub, G-09 stub, G-10 stub, G-11 stub | DoD-1 partial (compose parses + boot) — DoD-3 full implementation deferred to S-02 |
| Database migrations layer (V001 + chained apply V001→V002→V003→V005→V006→V008) | G-12 | DoD-2 |
| Seed data scaffold (`users.json` + `products.json` minimal 10×5 + `policies.json` + `seed.ts`) | G-13 | DoD-2 |
| Vespa schema (`product.sd` + `services.xml` per ADR-036 CLIP 512) | G-14 | DoD-9 |
| Observability stack configs (`docker-compose.observability.yml` + `collector-config.yaml` + `grafana-datasources.yml` + `prometheus.yml` + `tempo.yaml` + `loki-config.yaml` + `grafana-dashboards/` placeholder) | G-04, G-15, G-16, G-17, G-29 | DoD-1 (obs stack boots), DoD-6 (Grafana :3002 + 3 datasources) |
| App compose + Next.js placeholder + CI | G-03, G-11 (web partial: init + Tailwind + shadcn + `<PhoneFrame>` placeholder), G-22, G-23 | DoD-1 (app stack), DoD-5 (ICP loaded page) |

### Bước 2 — CONSUMER_MAPPING

Mọi capability của S-00b serve **8/8 downstream slices** (S-01 và mọi V-SLICE) — đây là foundation, không có optional consumer:

| Capability | S-01 (UI Foundation) | S-02 (Runtime Foundation) | S-03+ (V-SLICE intents) |
|---|---|---|---|
| Monorepo + pnpm + tsconfig | ✅ install path | ✅ install path | ✅ install path |
| `packages/shared-types/` scaffold | ✅ import target | ✅ codegen output target | ✅ import types |
| Service Dockerfile stubs | — | ✅ replace with full impl | ✅ |
| V001 migrations chain | — | ✅ DB layer | ✅ all queries |
| Seed data | — | ✅ dev fixtures | ✅ demo data |
| Vespa schema | — | ✅ deploy target for S-04 search | ✅ S-04 Intent 03 |
| Obs stack configs | — | ✅ collector endpoint target | ✅ tracing |
| App compose + web placeholder | ✅ Tailwind/shadcn pre-installed | ✅ gateway/ai/mcp wire | ✅ E2E |

→ Tất cả capabilities là **MUST_BEFORE** (8/8 consumers per §5.3 Bước 3).

### Bước 3 — TIMING_DECISION

Toàn bộ scope **MUST_BEFORE** (DoD-1 intrinsically requires all-at-once delivery — `make up` boot stack chỉ pass khi mọi mảnh tồn tại đồng thời). KHÔNG có `CAN_INCREMENTAL` hoặc `DEFER` candidates trong S-00b — đây là điểm khác S-02 P-CAP (S-02 có 3 nhóm phân biệt).

Items defer hẳn (out of scope S-00b, không phải `DEFER` group trong slice):
- Per-service OTel SDK init code (`apps/<svc>/src/observability/otel.ts|setup.py|logger.ts|logger.py`) → S-02
- `mcp_client.py` traceparent header injection → S-02
- `packages/shared-types/` codegen pipeline (NestJS Swagger → OpenAPI → openapi-typescript-codegen) → S-02
- `shopee-mock-seed-worker.ts` content (chỉ apps/workers/ skeleton package.json + index.ts stub trong S-00b) → S-02 (defer unless Intent 01 demo forces earlier — surface lại để human re-decide nếu cần)

### Bước 4 — TASK_BREAKDOWN

8 tasks linear T01 → T08, propose trong `slices/S-00b_TASKLIST.md`. Mỗi task ~0.5-1.5 day equivalent of original PHASE_01 Day mapping.

### Bước 5 — ACCEPTANCE_TESTS

Per-DoD smoke tests sau khi S-00b done:
- **DoD-1 smoke:** `make up` exit 0; `docker compose ps` show 9 services up; `docker compose -f docker-compose.observability.yml ps` show 5 obs services up
- **DoD-2 smoke:** `make seed` exit 0; `psql -c "SELECT COUNT(*) FROM behavior_events_y2026m05"` returns 0 (table exists, partition exists); `psql -c "\dt"` shows users/sessions/products/events/policies/action_cards/orders/order_items/transactions/behavior_events/shopee_prices_mock + 3 V002+ added tables
- **DoD-5 smoke:** `curl localhost:3000` returns HTML containing "ICP loaded"; viewport mobile 390px shows `<PhoneFrame>` wrapper
- **DoD-6 smoke:** `curl localhost:3002/api/datasources` returns 3 datasources (Loki, Tempo, Prometheus); Grafana UI accessible
- **DoD-9 smoke:** `vespa status` returns OK; `vespa query 'select * from product where true'` returns valid response; schema dump shows `text_embedding tensor<float>(x[512])` + `image_embedding tensor<float>(x[512])` + `impressions_7d` + `clicks_7d` fields

DoD-3 (full /health for 4 services), DoD-4 (CI green), DoD-7 (full trace propagation), DoD-8 (Loki schema fields populated) — không trong scope smoke test S-00b. S-00b delivers Dockerfile stubs + basic CI yaml (no real test), so DoD-4 will pass strict literal ("test rỗng cũng OK") but DoD-3/7/8 explicitly defer to S-02.

## Evidence

**Phase planning specs (priority 4 per Rule 7):**
- `docs/phases/PHASE_01_INFRA.md` — Definition of Done (lines 8-16), thư mục root tree (58-110, đã patch C1 inline note line 111-116), Day 1-7 tasks (119-227, đã patch C2/C3/C4/C5 inline), Risks (256-261), Câu hỏi cho human (263-271 — pnpm + Gemini/OpenAI plan + local Docker đã resolved)
- `docs/phases/PHASE_00_DESIGN_SYSTEM.md` — Section 1 color tokens (needed for `apps/web/globals.css` CSS vars)

**Recent ADRs (priority 2):**
- ADR-032 (DECISIONS.md line 283) — Shopee Postgres + worker (V008 migration + worker stub in apps/workers/)
- ADR-033 (DECISIONS.md line 320) — shadcn/ui + Tailwind v3 (Day 6 web init in T08)
- ADR-034 (DECISIONS.md line 363) — Hybrid CSS + Framer Motion + canvas-confetti (Day 6 deps install)
- ADR-035 (DECISIONS.md line 410) — Zustand + TanStack Query + react-hook-form + Context + useState (Day 6 deps install)
- **ADR-036 (DECISIONS.md line 472) — CLIP ViT-B/32 512 dimensions** ⭐ — drive V001 `image_embedding VECTOR(512)` + Vespa `tensor<float>(x[512])`. Overrides 02_DATA_MODEL.md spec (768) per Rule 7 hierarchy (ADR priority 2 > general spec priority 5).

**Phase handoff (priority 3):**
- `s00-outputs/reports/S00-REPORT.md` ⭐ — executive summary, gap list G-01→G-34, Section 5 Option B scope (lines 194-241), Section 6 Effort per Day table (lines 244-258)
- `s00-outputs/reports/S00-T01_REPORT.md` (repo structure findings F1-F10)
- `s00-outputs/reports/S00-T02_REPORT.md` (services skeleton findings F1-F8)
- `s00-outputs/reports/S00-T03_REPORT.md` (data layer findings F1-F14)
- `s00-outputs/reports/S00-T04_REPORT.md` (observability findings F1-F13)
- `s00-outputs/reports/S00-T05_REPORT.md` (decisions consistency findings F1-F8)
- `docs/handoff/PHASE_00_HANDOFF.md` lines 427-433 (Câu hỏi mở all checked ADR-033/034/035)

**General specs (priority 5):**
- `docs/00_CONTEXT.md` — tech stack LOCKED (Section 2), repo layout (Section 1), naming conventions (Section 5), 17 sub-rules cho AI code (Section 10), Mock data strategy (Section 9 — 50 products, 5 users, 10 categories)
- `docs/01_ARCHITECTURE.md` — 3-tier services boundary
- `docs/02_DATA_MODEL.md` lines 1-165 (Postgres DDL — base for V001), lines 166-263 (Vespa schema — base for product.sd but **override embedding dims to 512 per ADR-036**), lines 414-417 (migration strategy), lines 432-548 (shopee_prices_mock cross-check vs V008 file)
- `docs/05_CODING_CONVENTIONS.md` — naming, file structure
- `docs/06_OBSERVABILITY.md` — log schema fields (DoD-8 minimum 3 fields), collector-config.yaml topology, trace context propagation pattern
- `docs/07_BEHAVIOR_LOGS.md` — `behavior_events` DDL (V001 inclusion), Vespa behavioral signal fields (`impressions_7d`, `clicks_7d`, etc — for product.sd)
- `docs/09_FIELD_AUDIT.md` lines 305-320 — V004/V007 skip rationale + image storage base64 inline decision (drives V001 — no separate media_uploads table)

**Repo state (priority 6):**
- `infra/migrations/V002__product_enrichment.sql` — ALTER products + add product_reviews (depends on V001 products table)
- `infra/migrations/V003__insights.sql` — CREATE insights (FK users)
- `infra/migrations/V005__payment_metadata.sql` — ALTER transactions
- `infra/migrations/V006__analytics_aggregations.sql` — MATERIALIZED VIEW analytics_daily (depends on V001 orders + order_items)
- `infra/migrations/V008__shopee_prices_mock.sql` — CREATE shopee_prices_mock (standalone, no FK)

**Workflow + rules:**
- `docs/workflow/ICP_WORKFLOW_FINAL.md` §5.3 (CDP method), §Step 7-10
- `ai-delivery/TASK_OPERATING_SYSTEM.md` — 7 Rules (esp Rule 5 STOP, Rule 7 hierarchy)

**S-00 slice artifacts (Phiên 2 outputs):**
- `s00-outputs/slices/S-00_BRIEF.md` — format reference
- `s00-outputs/slices/S-00_TASKLIST.md` — format reference
- `s00-outputs/taskpacks/S00-T01_*.md` through `S00-T05_*.md` — 10-section template reference

## Done Means

- [ ] 8 task packs created (`taskpacks/S00b-T01_*.md` → `taskpacks/S00b-T08_*.md`) per workflow §Step 7 template (10 sections each)
- [ ] 8 per-task implementation reports (`reports/S00b-T0X_REPORT.md`) per workflow §Step 8 template
- [ ] 8 per-task reviews (`reviews/S00b-T0X_REVIEW.md`) with 9 Gates explicit (active count varies per task: T01/T07 mostly config = ~4 active; T04/T05/T06 has Contract Gate active = ~5-6 active; T08 has UI Gate + Demo Gate active = ~6 active)
- [ ] Actual code files delivered in outputs mirror repo structure (root configs + `apps/` skeletons + `infra/` configs + `packages/shared-types/`)
- [ ] All 8 chained migrations applicable in sequence V001→V002→V003→V005→V006→V008 (V004+V007 intentionally skipped)
- [ ] CLIP 512 dim consistent across V001 `image_embedding VECTOR(512)` + Vespa `tensor<float>(x[512])` (per ADR-036, override 02_DATA_MODEL.md 768)
- [ ] Consolidated report `reports/S00b-REPORT.md` (executive summary, per-task synthesis, gap-closed list G-01→G-29 status, DoD verdict 5/9 met, recommended next slice S-01 vs S-02)
- [ ] Consolidated review `reviews/S00b_REVIEW.md` (review of consolidated report — lesson learned từ Phiên 2)
- [ ] `slices/S-00b_TASKLIST.md` updated với status DONE per task at Step 10
- [ ] **Smoke test pass (conceptual):** 5/9 DoD items có deliverable artifact rõ ràng để verify khi human run; 4/9 còn lại có explicit gap statement chỉ ra S-02 work

## Non-goals

- KHÔNG implement service business logic (auth controllers, search routes, intent routing, MCP tool bodies beyond stubs) — defer S-02 P-CAP
- KHÔNG build 75 mockup → React component library — defer S-01 H-UI
- KHÔNG populate `packages/shared-types/` content (only scaffold empty package) — codegen pipeline + types defer S-02 (`pnpm openapi:sync` workflow)
- KHÔNG implement per-service OTel SDK init code (`apps/gateway/src/observability/otel.ts`, `apps/ai/src/observability/setup.py`, etc) — only stack-level config in S-00b (`infra/otel/collector-config.yaml`) — defer per-service init S-02
- KHÔNG implement `mcp_client.py` traceparent header injection — defer S-02
- KHÔNG implement structured logger helpers (`logger.ts` for gateway, `logger.py` for ai/mcp) — defer S-02
- KHÔNG populate `shopee-mock-seed-worker.ts` business logic (only `apps/workers/src/index.ts` skeleton + package.json) — defer S-02 (unless Intent 01 demo timing forces earlier — surface to human re-decide)
- KHÔNG fill Grafana dashboards JSON (only placeholder directory) — defer Phase 06 polish (per S00-REPORT G-29)
- KHÔNG add RED dashboards / PII redactor middleware — defer Phase 06 polish (G-32, G-33)
- KHÔNG re-do C1-C5 docs patches (đã apply trong Phiên 2, confirmed by user in prompt)
- KHÔNG resolve C6 DoD-8 phrasing (defer per user prompt scope)
- KHÔNG add G-31 Zustand store naming convention to 05_CODING_CONVENTIONS.md (docs maintainer task, not S-00b)
- KHÔNG decide architecture mới (Rule 5 STOP — surface to ADR if encountered)

## Dependencies

- **Depends on slice:** S-00 (Q-GATE audit complete; gap list G-01→G-34 + ADR-036 image_embedding decision required as input). All preconditions met per Phiên 2 outputs + Phiên 3 ADR-036 commit.
- **Blocks slice:** S-01 UI Foundation (cần `apps/web/` scaffold với Tailwind + shadcn để components có context render), S-02 Runtime Foundation (cần monorepo + Dockerfiles + V001 base + obs collector config làm canvas để overlay per-service capabilities).

## Risks

**R1 — Spec ambiguity within S-00b implementation might force Rule 5 STOP**

Per user prompt: nếu gặp ambiguity (vd password hash algorithm cho seed.ts, connection pool defaults, JWT expiry, technical infeasibility với ADR-036), AI dừng + hỏi human. Anticipated potential STOPs:

| Anticipated STOP | Resolution path |
|---|---|
| `users.json` password hash format (plain "demo1234" → bcrypt? Or pre-hashed in JSON?) | Likely pre-hash bcrypt in `seed.ts` at insert time. Surface khi viết T05 nếu spec vẫn không có. |
| `seed.ts` runtime (Node.js direct vs ts-node vs tsx)? | Default tsx (per 2026 standard). Surface nếu cần ADR. |
| Vespa version cụ thể (compose uses `vespaengine/vespa:latest` per PHASE_01 line 27, but CLIP 512 needs Vespa 8.x verified) | Pin `vespaengine/vespa:8.x` (latest minor) per `00_CONTEXT.md` Section 2 spec "8.x"; confirm pinned tag exists. |
| V001 indexes on text_search columns (full-text search via Vespa, not Postgres GIN tsvector — so V001 may skip Postgres FT) | Spec says no, only GIN attributes per V001 line 49. Confirm. |
| Docker Compose health check intervals + retries (PHASE_01 doesn't specify) | Use sensible defaults (30s interval, 3 retries, 5s timeout) and document inline as choice. |
| Next.js version cụ thể (Next 14.x — pin 14.2 LTS or 14.latest?) | Pin to `14.2.x` (LTS-ish for App Router maturity) and document. |
| Tailwind v3 minor version (v3.4 stable per ADR-033) | Per ADR-033 — verify. |
| shadcn/ui CLI new-syntax `npx shadcn@latest init` vs legacy `npx shadcn-ui@latest init` | PHASE_01 line 184 uses legacy `shadcn-ui@latest`. Per 2026 reality: shadcn renamed package to `shadcn` (legacy `shadcn-ui` deprecated 2024). Surface to human as docs C8 patch propose. |

**R2 — Conflict CLIP 512 (ADR-036) vs 768 (02_DATA_MODEL.md) — Rule 7 surface**

- `02_DATA_MODEL.md` lines 205-217 explicitly spec `tensor<float>(x[768])` for both `text_embedding` and `image_embedding`, plus rank-profile `query(text_query) tensor<float>(x[768])`.
- ADR-036 LOCKED 2026-05-18 says CLIP 512 for both.
- Rule 7 hierarchy: ADR (priority 2) wins over general spec (priority 5). **Resolution: AI writes V001 + product.sd with 512 dim.** Surface 02_DATA_MODEL.md as docs C8 patch candidate (defer to docs maintainer, not S-00b).
- **NOT silent fix:** explicit Bonus section in S00b-T04/T06 reports + consolidated S00b-REPORT.md.

**R3 — V001 strict mirror 02_DATA_MODEL.md, NO VECTOR columns (C12 LOCKED Option B 2026-05-18)**

- Human đã chốt C12 = Option B trong Phiên 3 conversation: embeddings 
  stored Vespa-only, V001 KHÔNG có `text_embedding` / `image_embedding` 
  VECTOR columns trong Postgres products table.
- Decision rationale: Thống nhất 1 nơi duy nhất — Vespa search index. 
  Postgres products giữ source-of-truth domain data, không duplicate embedding.
- Implication cho V001:
  - Mirror EXACTLY `02_DATA_MODEL.md` Section 1 lines 1-165 (10 tables 
    base DDL, không thêm gì)
  - KHÔNG cần `CREATE EXTENSION vector;`
  - KHÔNG đổi Postgres image — giữ `postgres:16-alpine` per PHASE_01 line 24
- Implication cho T06 Vespa schema: là nơi duy nhất có embedding fields, 
  dim 512 per ADR-036 (C8 resolution).
- Reject pattern: bất kỳ reference nào nói "V001 with VECTOR columns" 
  trong context T04-T08 → REJECT theo C12 LOCKED. Surface inconsistency.
- See `decisions-log.md` C12 + `S-00b_EXECUTION_GUIDE.md` Section 1.2.

**R3-bis — V001 vs V002+ ALTER chain compatibility (kept from original R3)**

- `02_DATA_MODEL.md` line 30-46 specs base `products` table WITHOUT V002 
  added columns (brand, original_price, rating_avg, rating_count, sold_count, 
  image_gradient, icon_hint).
- V002 ALTERs add them — V001 must NOT preemptively include them (V002 
  idempotent ALTER + V001 will produce duplicate column error).
- Resolution: V001 strictly mirrors `02_DATA_MODEL.md` Section 1 (base DDL 
  only). V002+ chain through their respective ALTERs unchanged.
- Caveat: V005 ALTERs transactions table — V001 must include base transactions 
  DDL minus the V005-added columns (payment_method, failure_reason, metadata, 
  provider_txn_id, completed_at).
- Caveat: V006 MATERIALIZED VIEW (V006 runs after V001 creates orders + 
  order_items and after V005 adds payment_method).
- Cross-check V008: standalone CREATE TABLE shopee_prices_mock (no FK to 
  base tables) — applies cleanly after V001.

**R4 — Dockerfile stubs for services without business logic — what HEALTHCHECK target?**

- Compose `healthcheck:` directive needs working command. For minimal stub:
  - **gateway/web (Node):** stub `node -e "require('http').createServer((req,res)=>res.end('ok')).listen(<PORT>)"` runs in CMD; HEALTHCHECK `curl -f http://localhost:<PORT>/health || exit 1` against same stub.
  - **ai/mcp (Python):** stub `python -m http.server <PORT>` (returns 200 to any path including /health).
- Trade-off: services boot to a stub HTTP echo, not real `/health` controller. DoD-3 technically passes literal "respond to /health" but logical layer empty. **DoD-3 verdict still TODO in S-00b consolidated report** to make ownership clear (S-02 replaces stubs with NestJS HealthController etc).
- Resolution: stubs are intentional minimal viable units. Document in T03 (Service Dockerfile Stubs) explicitly.

**R5 — Migration runner: where does V001→V008 chain apply from?**

- PHASE_01 spec line 135: "test: make up toàn stack, verify từng service alive" — implies migrations apply during `make up` somehow.
- Options:
  - (A) Manual `psql -f infra/migrations/V001__init.sql && psql -f V002 ...` script run by `make seed` (sequential apply).
  - (B) Flyway/Liquibase in compose service (heavyweight, adds infra dependency).
  - (C) Custom Node/TS migration runner in `infra/seed/seed.ts` that walks `infra/migrations/V*.sql` alphabetically + applies + records to `schema_migrations` table.
- Per `02_DATA_MODEL.md` line 415-417 "Migration strategy: Flyway-style versioning, manual apply via `psql -f` in scripts hoặc dùng Flyway image trong compose. Hackathon: bash script `infra/migrations/apply.sh` đủ."
- Resolution: Option C — `infra/migrations/apply.sh` bash script (per 02_DATA_MODEL guidance), called by Makefile `make migrate` target, run by `make seed` (migrate + then seed.ts).

**R6 — Effort estimate vs original 7-day Phase 01 budget**

- Per S00-REPORT.md Section 6 (line 256): "~10-11 days work to deliver Phase 01 DoD in full" — S-00b portion ~7-8 days, S-02 ~3-4 days.
- S-00b 8 tasks × ~0.5-1.5 day each = ~6-10 day band; midpoint ~8 days aligns with S00-REPORT estimate.
- AI execution in this conversation: code generation is bounded by token budget + human review steps, not real wall-clock days. Acceptable — Phase 3-4 will iterate per task, human can pause anytime.

**R7 — MASTER_SLICE_BACKLOG.md does not yet list S-00b**

- Backlog `MASTER_SLICE_BACKLOG.md` (committed pre-Phiên 3) only lists S-00, S-01, S-02, ... S-11. No S-00b entry.
- Per Rule 7: not a conflict — backlog generated pre-S-00 audit, S-00b emerged from audit recommendation.
- Resolution: surface as known docs gap in S00b-REPORT.md final consolidated. Docs maintainer adds S-00b row between S-00 and S-01 (5-min patch, not S-00b scope).

**R8 — `make up` requires both compose files orchestrated together**

- Make target `make up` typically runs `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d` (single docker compose CLI session merging both).
- Alternative: `make up` only starts app stack; `make obs:up` starts obs stack separately (per PHASE_01 line 121 root scripts include `obs:up`/`obs:down`).
- Per DoD-1 literal: "make up khởi động toàn bộ app stack + observability stack" — must start both.
- Resolution: `make up` starts both compose files; `make obs:up`/`make obs:down` provide independent control as escape hatches. Document in Makefile + README.

**R9 — TypeScript ESM vs CommonJS in monorepo workspace**

- PHASE_01 spec line 118 `tsconfig.base.json` no module preference declared.
- 2026 default: Next.js 14 (ESM-first), NestJS 10 (CommonJS unless override), Python services don't care.
- Resolution: `tsconfig.base.json` set `"module": "esnext"` + `"moduleResolution": "bundler"` for shared-types and web; gateway gets local override `"module": "commonjs"` in `apps/gateway/tsconfig.json` extending base. Document inline as choice.

**R10 — Conflict between MASTER_ROADMAP.md S-02 dependencies and Option B**

- `MASTER_SLICE_BACKLOG.md` line 102: "S-02 Depends on: S-00 (audit), S-01 (design tokens accessible)".
- Per Option B: S-00b should slot between S-00 and S-01/S-02. After S-00b, S-01 can start (depends on S-00b not S-00 anymore).
- Resolution: surface in S00b-REPORT.md as docs C9 patch — backlog dep edges need update post-S-00b. Defer to docs maintainer.


**R11 — Grafana port conflict C11 (Phiên 3 phát hiện)**

- `06_OBSERVABILITY.md` lines 52, 559 spec port `3001:3000` cho Grafana 
  (legacy doc).
- `PHASE_01_INFRA.md` line 13 + 41 + DoD-6 spec `3002`.
- Plus: port 3001 collide gateway service (PHASE_01 line 28).
- Resolution per Rule 7: PHASE_01 (priority 4) > 06_OBSERVABILITY (priority 5).
- T07 dùng `3002:3000`. Document trong T07 report + S00b-REPORT bonus 
  conflicts section.
- Docs maintainer batch với C8/C9/C10 sau S-00b done.
- See `decisions-log.md` C11 + `S-00b_EXECUTION_GUIDE.md` Section 1.3.

**R12 — Decisions-log.md cumulative cross-session (Phiên 3 phát hiện workflow gap)**

- Workflow "1-task-per-session" tách 8 task code thành 8 phiên + 1 phiên 
  consolidate.
- Risk: AI mỗi phiên re-derive decisions từ docs → có thể inconsistent.
- Mitigation: `decisions-log.md` standalone file cumulative qua sessions. 
  Mỗi phiên load đầu tiên + append amendments cuối nếu có. Phiên T01-T08 
  prompt template explicitly reference D-01 đến D-05 + C8 đến C12.
- See `S-00b_EXECUTION_GUIDE.md` Section 3 (Common Prompt Preamble) + 
  Section 9 (decisions-log initial content).

---

**End of Slice Brief.** Next: `slices/S-00b_TASKLIST.md` (Step 5 output), then DỪNG hỏi human confirm before proceeding to Step 7-10 iterations.
