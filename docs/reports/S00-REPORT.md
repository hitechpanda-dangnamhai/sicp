# Audit Report — S-00 Repo Reality Check (Consolidated)

> **Slice:** S-00 Repo Reality Check
> **Type:** Q-GATE (audit-only, no code)
> **Date:** 2026-05-18
> **Status:** All 5 audit tasks DONE; this is the consolidated executive report
> **Audience:** Human-level decide for next slice routing (S-00b vs skip-to-S-01) + open decision (image_embedding dimension)

---

## Executive Summary

**Repo state confirmed:** GREENFIELD with one partial exception (`infra/migrations/` has 5 committed SQL files V002/V003/V005/V006/V008; V001 foundational missing). Everything else under `apps/`, `packages/`, `infra/{otel,seed,vespa}`, root configs, Makefile, CI workflow = absent.

**Phase 01 DoD status: 0/9 met.** All 9 DoD items return TODO. Detail per-DoD in Section 2.

**Total effort to reach Phase 01 DoD: ~13-14 days** (split: ~10 days S-00b foundation scaffold + ~3-4 days S-02 P-CAP per-service capabilities). Stage 1 original budget per `MASTER_ROADMAP.md` is 7 days — gap of ~6-7 days.

**Top priority surface item (Rule 5 STOP):** `image_embedding` field dimension not specified in any doc → blocks V001 SQL DDL + Vespa `product.sd` schema authoring. Must resolve via human decide before S-00b can start work on F1 (V001) and F10 (Vespa schema).

**Recommended next slice:** **Option B — insert S-00b foundation scaffold before Stage 1 V-SLICEs** (rationale + alternative in Section 5).

---

## 1. Per-DoD Findings (synthesis from 5 per-task reports)

### DoD-1 — `make up` khởi động app stack + obs stack ❌ TODO
**Root cause:** No `Makefile`, no `package.json`, no `docker-compose.yml`, no `docker-compose.observability.yml`, no service Dockerfiles to compose.
**Source findings:** T01-F1, T01-F3, T01-F4, T01-F5, T01-F6 + T04-F1 (obs compose).
**Effort to fix:** ~1.5 days (compose files 1d + Makefile 0.25d + scripts wiring 0.25d) — depends on F4 service Dockerfile stubs from T02 scope.
**Owner candidate:** S-00b foundation scaffold (bundle with T02 service stubs).

### DoD-2 — Migrations + seed + `behavior_events` table ❌ TODO
**Root cause:** V001 foundational migration MISSING (file not present despite spec calling for it). 5 V00X migrations committed (V002/V003/V005/V006/V008) cannot apply without V001 base schema. Seed directory `infra/seed/` does not exist. `behavior_events` table cannot exist without V001 (DoD-2 explicitly names this table).
**Source findings:** T03-F1, T03-F2, T03-F12 (seed files).
**Effort to fix:** ~1.5-1.75 days (V001 SQL 1d + seed.ts script + JSON files 0.5-0.75d).
**Owner candidate:** S-00b foundation scaffold.
**Note:** V004 + V007 are intentional skips per `09_FIELD_AUDIT.md` lines 312-315 — informational, not gaps.
**Blocker:** **C7 image_embedding dimension** must resolve before V001 can be authored (V001 will create the products table whose fields cross-reference Vespa schema embedding fields).

### DoD-3 — 4 services `/health` responsive ❌ TODO
**Root cause:** Zero services exist. `apps/gateway/`, `apps/ai/`, `apps/mcp/`, `apps/web/` all absent.
**Source findings:** T02-F1, T02-F2, T02-F3, T02-F4, T02-F7.
**Effort to fix:** ~4 days minimum (gateway 1d + ai 1d + mcp 1d + web 1-1.5d).
**Owner candidate:** S-02 P-CAP for full implementation; S-00b for minimal Dockerfile stubs to enable compose parse + boot.
**Doc gap surfaced:** MCP `/health` endpoint missing from Day 5 task list (PHASE_01 lines 153-162) — see conflict C4.

### DoD-4 — CI pipeline (lint + test) ❌ TODO
**Root cause:** No `.github/` directory, no workflow files.
**Source findings:** T01-F8.
**Effort to fix:** 0.5 day basic ci.yml.
**Owner candidate:** S-00b foundation scaffold for basic; S-02 for contract-check workflow (depends on NestJS Swagger codegen).

### DoD-5 — `apps/web` "ICP loaded" page ❌ TODO
**Root cause:** No web app exists (cross-references DoD-3).
**Source findings:** T02-F6 (cross-ref T02-F4).
**Effort to fix:** 0.25 day after web app init (within DoD-3 effort).
**Owner candidate:** S-00b minimal `<PhoneFrame>` stub (DoD-5 minimum); S-01 H-UI builds proper `<PhoneFrame>` per EBT v2 from 75 mockups.

### DoD-6 — Grafana :3002 + 3 datasources auto-provisioned ❌ TODO
**Root cause:** No obs compose, no datasources YAML, no backend configs.
**Source findings:** T04-F1, T04-F3, T04-F5.
**Effort to fix:** ~1 day (compose 0.5d + datasources YAML 0.25d + backend configs 0.25d).
**Owner candidate:** S-00b foundation scaffold.

### DoD-7 — Trace propagation gateway → ai → mcp ❌ TODO
**Root cause:** Services don't exist to host OTel SDK; collector-config.yaml missing; mcp_client.py traceparent header injection wiring absent.
**Source findings:** T04-F2, T04-F6, T04-F8, T04-F9, T04-F10.
**Effort to fix:** ~1 day (collector-config 0.25-0.5d + per-service SDK init 0.25d × 3 + mcp_client.py header injection 0.25d).
**Owner candidate:** S-00b for collector-config; S-02 for per-service OTel SDK init + mcp_client wrapper.

### DoD-8 — Loki logs schema (`service`, `trace_id`, `message`) ❌ TODO
**Root cause:** No services emit logs; logger helpers (`logger.ts`, `logger.py`) absent.
**Source findings:** T04-F7, T04-F8, T04-F11.
**Effort to fix:** ~0.75 day (logger helpers 0.25d × 3 services, parallelizable).
**Owner candidate:** S-02 P-CAP.
**Note:** DoD-8 lists 3 minimum fields; full `06_OBSERVABILITY.md` schema has 13+ fields. See conflict C6 — interpret DoD-8 as floor.

### DoD-9 — Vespa schema with `text_embedding`, `image_embedding`, behavioral signals (`impressions_7d`, `clicks_7d`) ❌ TODO
**Root cause:** `infra/vespa/schemas/product.sd` + `services.xml` do not exist. **Blocker:** `image_embedding` dimension not specified anywhere (C7 Rule 5 STOP).
**Source findings:** T03-F10, T03-F11.
**Effort to fix:** ~1 day (schema + services.xml + deploy script). **Blocked until C7 resolved.**
**Owner candidate:** S-00b foundation scaffold (after C7 human decide).

---

## 2. Gap List by Severity

### P0 BLOCKER (block Stage 1 DoD; ~10-11 days S-00b + ~3-4 days S-02)

| ID | Finding | DoD | Effort | Owner |
|---|---|---|---|---|
| **G-01** | Monorepo (`pnpm-workspace.yaml`, root `package.json` + scripts) | DoD-1 | 0.5d | S-00b |
| **G-02** | `tsconfig.base.json` shared compiler options | Day 1 | 0.1d | S-00b |
| **G-03** | `docker-compose.yml` (app stack) | DoD-1 | 0.5d | S-00b |
| **G-04** | `docker-compose.observability.yml` (obs stack) | DoD-1, DoD-6 | 0.5d | S-00b |
| **G-05** | `Makefile` (`make up`, `make seed`, `make logs`, `make down`) | DoD-1, Day 7 | 0.25d | S-00b |
| **G-06** | `.env.example` (env contract; services fail-fast on missing) | implicit Day 1-7 | 0.25d | S-00b |
| **G-07** | `packages/shared-types/` scaffold | Day 1 | 0.5d | S-00b (populated by S-02 codegen) |
| **G-08** | `apps/gateway/` (NestJS, port 3001, `/api/v1/health`, OTel + logger) | DoD-3, Day 3 | 1.0d | S-02 (S-00b: Dockerfile stub) |
| **G-09** | `apps/ai/` (Flask + LangGraph, port 5001, `/health`, OTel + structlog) | DoD-3, Day 4 | 1.0d | S-02 |
| **G-10** | `apps/mcp/` (Python JSON-RPC, port 5050, OTel + 3 initial tools auth.verify_jwt/events.append/products.get) | DoD-3, Day 5 | 1.0d | S-02 |
| **G-11** | `apps/web/` (Next.js 14 + ADR-033/034/035 LOCKED stack: Tailwind v3 + shadcn/ui + Framer Motion + canvas-confetti + Zustand + TanStack + react-hook-form + MSW) | DoD-3, DoD-5, Day 6 | 1.0-1.5d | S-00b minimal init; S-01 components; S-02 stores/api-client |
| **G-12** | `V001__init.sql` (foundational migration — base schema + behavior_events partitioned) | DoD-2, Day 2 | 1.0d (blocked by C7) | S-00b |
| **G-13** | `infra/seed/` files (users.json, products.json 10×5, policies.json, seed.ts) | DoD-2, Day 2 | 0.5-0.75d | S-00b |
| **G-14** | `infra/vespa/schemas/product.sd` + `services.xml` (with text_embedding, image_embedding, impressions_7d, clicks_7d) | DoD-9, Day 2 | 1.0d (blocked by C7) | S-00b |
| **G-15** | `infra/otel/collector-config.yaml` (OTLP receivers + Loki/Tempo/Prometheus exporters) | Day 2 | 0.25-0.5d | S-00b |
| **G-16** | `infra/otel/grafana-datasources.yml` (Loki + Tempo + Prometheus auto-provision) | DoD-6, Day 2 | 0.25d | S-00b |
| **G-17** | `infra/otel/prometheus.yml`, `tempo.yaml`, `loki-config.yaml` | Day 2 | 0.25d | S-00b |
| **G-18** | Per-service OTel SDK init + structured logger (gateway otel.ts/logger.ts, ai setup.py/logger.py, mcp setup.py + span wrap) | DoD-7, DoD-8 | 0.75d | S-02 |
| **G-19** | MCP client traceparent header injection (`apps/ai/src/tools/mcp_client.py`) | DoD-7 | 0.25d | S-02 |

**P0 subtotal:** ~11 days (S-00b ~7d + S-02 ~4d), parallelizable in places.

### P1 HIGH (significant but not strictly blocking DoD literal text)

| ID | Finding | DoD | Effort | Owner |
|---|---|---|---|---|
| **G-20** | `Makefile` is named-explicit in DoD-1 ("`make up`") — P1 if interpret loosely (raw `docker compose` workaround); P0 if strict | DoD-1 | (in G-05) | S-00b |
| **G-21** | `.gitignore` (will commit node_modules accidentally) | Day 1 | 0.05d | S-00b |
| **G-22** | `.github/workflows/ci.yml` (lint + test, test rỗng OK) | DoD-4, Day 7 | 0.5d | S-00b basic; S-02 contract-check |
| **G-23** | `<PhoneFrame>` "ICP loaded" placeholder page (strict DoD-5 literal) | DoD-5 | (in G-11) | S-00b |
| **G-24** | `packages/shared-types/` consumption pattern for Stage 1 (initial empty package OK; codegen pipeline lives here for Stage 2) | Day 6 | (in G-07) | S-02 codegen |
| **G-25** | **C7 image_embedding dimension OPEN DECISION** (Rule 5 STOP — blocks G-12 V001 + G-14 Vespa schema authoring) | DoD-9 | Human decide | Human → then S-00b |

**P1 subtotal:** ~0.5-1 day (most G-22 only; rest absorbed into P0).
**Critical:** **G-25 blocks the schedule** — must resolve before S-00b can start G-12 + G-14.

### P2 MEDIUM (DX / polish / docs)

| ID | Finding | Source | Effort | Owner |
|---|---|---|---|---|
| **G-26** | `.editorconfig` (charset + indent consistency) | T01-F2 | 0.05d | S-00b |
| **G-27** | Root `README.md` with quickstart (`make up && make seed`) | T01-F9 | 0.25d | S-00b polish |
| **G-28** | `apps/workers/` skeleton package (full content Phase 04; shopee-mock-seed-worker may need earlier if Intent 01 demo richness depends on pre-seeded mock) | T02-F5 | 0.25-0.5d | S-00b shell; S-02 shopee-mock seed worker |
| **G-29** | `infra/otel/grafana-dashboards/` placeholder directory + provisioning YAML | T04-F4 | 0.1d | S-00b skeleton; Phase 06 fill |
| **G-30** | Seed data quality enrichment for Intent 01 demo (V002 enrichment columns populated + ADR-032 sample data structured) | T03-F14 | 0.25d | S-00b or S-07 polish |
| **G-31** | Zustand store file naming convention not codified in `05_CODING_CONVENTIONS.md` | T05-F7 | 0.05d docs | docs maintainer |
| **G-32** | RED dashboards (Rate/Error/Duration per service) | T04-F12 | 0.5-1d (Phase 06) | S-11 polish |
| **G-33** | PII redactor middleware (regex strip email/phone before log) | T04-F13 | 0.25d (Phase 06) | S-11 polish |
| **G-34** | Docs patches batch C1-C5 (PHASE_01 stale references) — see Section 3 | T05-F8 | 0.25d batch | docs maintainer |

**P2 subtotal:** ~1.5-2.5 days (split Stage 1 ~0.5d + Phase 06 ~1-2d).

---

## 3. Conflicts Surfaced (Rule 7)

**6 docs internal inconsistencies + 1 open decision** aggregated from T01-T04 by T05:

| ID | Source task | Conflict | Severity | Rule 7 resolution path | Action |
|---|---|---|---|---|---|
| **C1** | T03-F13 | `PHASE_01_INFRA.md` line 105 lists `infra/seed/shopee-mock.json` (ADR-008 approach) vs ADR-032 supersede (Postgres `shopee_prices_mock` table + worker seed) | P2 docs | ADR-032 (priority 2) wins over PHASE_01 (priority 4 prospective spec) | Patch PHASE_01 line 105: remove shopee-mock.json bullet, add reference to ADR-032 + V008 migration + worker |
| **C2** | T02-Bonus | `PHASE_01_INFRA.md` Day 6 has duplicate headers — line 164 generic legacy + line 179 ADR-033/034/035 LOCKED | P2 docs | Keep line 179+ LOCKED version (post-ADR); strike legacy lines 164-178 | Docs patch — single block delete + re-anchor |
| **C3** | T02-Bonus | `PHASE_01_INFRA.md` line 176 "HTTP server mode (JSON-RPC over POST /rpc)" appears under web Day 6 — copy-paste residue from MCP Day 5 | P2 docs | Remove line 176; not applicable to web | Docs patch — single line delete |
| **C4** | T02-Bonus | MCP service `/health` endpoint absent from Day 5 task list (PHASE_01 lines 153-162) but DoD-3 says "4 services respond /health" | P2 docs | Add `/health` HTTP endpoint task to Day 5 (separate from JSON-RPC `/rpc` — each service should respond HTTP GET for readiness probes) | Docs patch — add bullet to Day 5 task list |
| **C5** | T01-Bonus | `PHASE_01_INFRA.md` line 272 still phrases pnpm as "Câu hỏi cho human" but `MASTER_ROADMAP.md` line 42 declares "pnpm workspaces" | P2 docs | ROADMAP wins (approved Stage 1 outputs decision) | Patch PHASE_01 line 272: remove question, replace with "pnpm (locked per MASTER_ROADMAP)" |
| **C6** | T04-Bonus | DoD-8 lists 3 fields (`service`, `trace_id`, `message`) as Loki schema requirement; full `06_OBSERVABILITY.md` schema has 13+ fields | P3 phrasing | Spec-as-floor reading is fine | Optional clarification: "schema chuẩn (minimum: `service`, `trace_id`, `message`; full schema per 06_OBSERVABILITY)" — defer |
| **C7** ⚠️ | T03-F11 | `image_embedding` field dimension not specified in `07_BEHAVIOR_LOGS.md`, `02_DATA_MODEL.md`, or `01_ARCHITECTURE.md` | **P1 OPEN DECISION** | Rule 5 STOP — surface to human, not pick | **Human decide required.** Likely 512 (CLIP) or 768 (sentence-transformers). Needed before G-12 (V001) + G-14 (Vespa product.sd) can be authored. **Top priority surface item.** |

**Batch effort:** C1-C5 docs patches ~0.25 day single batch by docs maintainer. C6 optional polish. **C7 blocks schedule until human decides.**

---

## 4. Decisions Consistency Check (from T05 synthesis)

| Item | Status | Notes |
|---|---|---|
| ADR-032 (Shopee Postgres + worker) reflected | ✅ 6/7 locations | 1 stale at PHASE_01 line 105 → C1 patch |
| ADR-033 (shadcn/ui + Tailwind v3) reflected | ✅ 4/4 locations | DECISIONS, PHASE_01 Day 6, PHASE_00_HANDOFF, MASTER_SLICE_BACKLOG |
| ADR-034 (Hybrid CSS + Framer Motion + canvas-confetti) reflected | ✅ 4/4 locations | Same coverage |
| ADR-035 (Zustand + TanStack + react-hook-form + Context + useState) reflected | ✅ 4/4 + bonus | Includes scaffold reference in PHASE_01 line 208 |
| V008 migration file exists | ✅ Yes | At `infra/migrations/V008__shopee_prices_mock.sql` with inline ADR-032 cross-ref + V004/V007 skip note |
| "Câu hỏi mở" 3 architecture questions resolved | ✅ 3/3 checked | All in PHASE_00_HANDOFF lines 427-433 |
| Naming conventions documented | ✅ + minor gap | `05_CODING_CONVENTIONS.md` lines 230-241 + Python snake_case line 240; Zustand store file pattern gap (G-31) |
| Operational items in PHASE_01 line 270-275 | ⚠️ Mixed | pnpm resolved by ROADMAP → C5 patch; API keys + deployment target operational (no ADR needed) |

---

## 5. Recommended Next Steps

### Option A — Skip S-00b, proceed S-01 + S-02 parallel
**Approach:** Treat all P0 BLOCKER items as part of S-02 P-CAP MUST_BEFORE capabilities. S-01 H-UI starts component library work in parallel using local Tailwind/shadcn setup without full monorepo wiring.

**Pros:**
- No schedule extension for foundation scaffold; parallelism saves wall-clock time if team has bandwidth.
- S-02 owner already responsible for many P0 items (services, OTel hooks, codegen pipeline).

**Cons:**
- **S-01 cannot test components in isolation without `apps/web/` scaffold** → either S-01 owns minimal web app init (scope creep into S-00b territory by another name), or S-01 work goes into a sandbox that needs re-integration later (rework risk).
- **G-12 (V001) and G-14 (Vespa schema) blocked by C7 image_embedding dimension** — without resolving C7, no S-02 V-SLICE that touches search (Intent 03) or product list (Intent 02) can run end-to-end.
- DoD-1 (`make up` boots stack) requires ALL compose pieces + Dockerfiles to exist simultaneously — S-02 cannot incrementally deliver this; it's chicken-and-egg without coordinated foundation.

### Option B ⭐ — Insert S-00b foundation scaffold first (RECOMMENDED)
**Approach:** Single bounded slice S-00b that delivers the entire P0 foundation in one coordinated effort. After S-00b lands, DoD-1 + DoD-2 + DoD-5 + DoD-6 + DoD-9 should pass smoke test. S-01 and S-02 can then run parallel on a working foundation.

**S-00b scope (per gap list):**
- G-01 to G-07 (monorepo + tsconfig + 2 compose + Makefile + .env.example + shared-types scaffold) — ~2 days
- G-08 to G-11 minimal Dockerfile stubs for 4 services so compose parses — ~0.5 day
- G-11 partial: Next.js init + Tailwind + shadcn init + `<PhoneFrame>` "ICP loaded" placeholder for DoD-5 — ~0.5 day
- G-12 V001 SQL DDL — ~1 day (after C7 resolved)
- G-13 seed scaffolding (minimal users.json + products.json) — ~0.5-0.75 day
- G-14 Vespa product.sd + services.xml — ~1 day (after C7 resolved)
- G-15 to G-17 obs configs (collector + datasources + backend YAMLs) — ~1 day
- G-26 to G-29 P2 DX items (.editorconfig, README, workers skeleton, dashboards placeholder) — ~0.5 day
- C1-C5 docs patches batch — ~0.25 day

**S-00b total:** ~7-8 days (P0 + P2 + docs patches).

**S-02 P-CAP remaining after S-00b:**
- G-08 to G-10 full service content (gateway/ai/mcp NestJS + Flask + Python) — ~3 days
- G-11 web stores/api-client/codegen (after S-01 components landed) — ~1 day
- G-18 per-service OTel SDK + logger helpers — ~0.75 day
- G-19 mcp_client.py traceparent injection — ~0.25 day
- G-22 contract-check CI workflow — ~0.25 day
- G-28 shopee-mock-seed-worker (if Intent 01 demo timing forces it earlier than Phase 04) — ~0.5 day

**S-02 P-CAP total:** ~5-6 days.

**Pros:**
- Foundation lands as a coherent, demo-able milestone (`make up` boots stack — visible DoD-1 pass).
- S-01 H-UI starts on working `apps/web/` with Tailwind + shadcn pre-installed — no integration rework.
- C7 image_embedding decision becomes single blocker at S-00b start, not recurring blocker across parallel slices.
- Docs patches (C1-C5) folded in so S-00b doesn't follow stale spec.

**Cons:**
- ~7-8 days extension before V-SLICEs can start (vs ~7 days original Stage 1 budget) — Stage 1 grows to ~15 days.
- Owner concentration risk: S-00b is broad, needs senior generalist or coordinated pair.

### AI Recommendation: **Option B**

**Rationale:**
1. **C7 image_embedding is non-negotiable Rule 5 STOP.** Without resolution, no V-SLICE that touches search/product can complete. Option A doesn't escape this — it just hides it.
2. **DoD-1 is intrinsically a "whole foundation" milestone.** `make up` requires compose + Dockerfiles + obs configs + service stubs simultaneously. There's no incremental path. Option B respects this; Option A pretends incremental delivery is possible and then forces last-minute integration.
3. **Rework risk in Option A is high.** S-01 components built against ad-hoc local setup will likely need adjustment when monorepo/Tailwind/shadcn wiring lands later. Net wall-clock not saved.
4. **Demo value of S-00b lands clean Stage 1 floor.** After S-00b, all 9 DoD items either pass (DoD-1/2/5/6) or have clear known-good service-side gap (DoD-3/4/7/8/9 will pass after S-02 lands per-service work). This is a much cleaner Stage 1 review state.

**Prerequisite for S-00b kickoff:** Human resolves C7 (image_embedding field dimension). Suggest 5-minute decision: pick CLIP 512 vs sentence-transformers 768 (or single text+image multimodal model). Cite choice in a new ADR-036 or as an inline V001/product.sd comment.

**Secondary recommendation:** Batch C1-C5 docs patches BEFORE S-00b starts (single docs-only commit, ~0.25 day) so S-00b doesn't accidentally follow stale spec.

---

## 6. Effort Estimate Per Phase 01 Day (Day 1-7)

| Day | Per-PHASE_01 spec scope | Current state | Effort to deliver | Blocker? | Owner |
|---|---|---|---|---|---|
| Day 1 | Monorepo (pnpm), `packages/shared-types`, root `package.json`, `.gitignore`, `.editorconfig`, `tsconfig.base.json` | 0% | 1.0d | No | S-00b |
| Day 2 | `docker-compose.yml`, `docker-compose.observability.yml`, obs configs (collector, datasources, prom/tempo/loki), V001 migration, seed, Vespa schema | 0% (V002-V008 committed but unapplicable) | 4.5-5d | **Yes — C7 image_embedding** | S-00b |
| Day 3 | NestJS gateway skeleton (OTel + logger + health + idempotency middleware skel) | 0% | 1.0d | No | S-02 |
| Day 4 | Flask + LangGraph ai skeleton (OTel + structlog + router_graph stub + mcp_client) | 0% | 1.0d | No | S-02 |
| Day 5 | Python MCP server (JSON-RPC + 3 initial tools + OTel span wrap + `/health`) | 0% | 1.0d | C4 docs patch (add `/health` to Day 5) | S-02 |
| Day 6 | Next.js 14 web skeleton (ADR-033/034/035 full LOCKED stack: Tailwind + shadcn + Framer Motion + canvas-confetti + Zustand + TanStack + react-hook-form + MSW + tracker + sse-client + `<PhoneFrame>`) | 0% | 1.0-1.5d | C2 + C3 docs patches | S-00b minimal init; S-01 components; S-02 stores/api-client |
| Day 7 | `Makefile` (`make up/seed/logs/down`), GitHub Actions CI lint+test, root `README.md`, smoke test | 0% | 0.75d | No | S-00b |

**Total: ~10-11 days** of work to deliver Phase 01 DoD in full. Includes ~1-1.5 days waste-buffer vs the ~13-14d estimate above due to parallelization (Day 3/4/5 can run parallel after Day 2 ships).

**Critical path:** C7 resolve → Day 2 V001+Vespa → Day 1+7 root scaffold → Day 3/4/5 parallel services → Day 6 web → smoke test DoD-1+5+6+7+8.

---

## 7. Reference Trail

**Per-task implementation reports:**
- `reports/S00-T01_REPORT.md` — Repo Structure & Tooling (10 findings, DoD-1+4)
- `reports/S00-T02_REPORT.md` — Services Skeleton (8 findings, DoD-3+5)
- `reports/S00-T03_REPORT.md` — Data Layer (14 findings, DoD-2+9)
- `reports/S00-T04_REPORT.md` — Observability (13 findings, DoD-6+7+8)
- `reports/S00-T05_REPORT.md` — Decisions Consistency (8 findings, cross-cutting)

**Per-task reviews (9 Gates, 4 active + 5 N/A each):**
- `reviews/S00-T01_REVIEW.md` — PASS
- `reviews/S00-T02_REVIEW.md` — PASS
- `reviews/S00-T03_REVIEW.md` — PASS
- `reviews/S00-T04_REVIEW.md` — PASS
- `reviews/S00-T05_REVIEW.md` — PASS

**Task packs (10 sections each per workflow §Step 7):**
- `taskpacks/S00-T01_AUDIT_REPO_STRUCTURE.md`
- `taskpacks/S00-T02_AUDIT_SERVICES_SKELETON.md`
- `taskpacks/S00-T03_AUDIT_DATA_LAYER.md`
- `taskpacks/S00-T04_AUDIT_OBSERVABILITY.md`
- `taskpacks/S00-T05_AUDIT_DECISIONS_CONSISTENCY.md`

**Slice artifacts:**
- `slices/S-00_BRIEF.md` — Slice brief (8 sections)
- `slices/S-00_TASKLIST.md` — Task list (T01-T05 all DONE)

**Source docs referenced:**
- `docs/phases/PHASE_01_INFRA.md` (DoD 9 items)
- `docs/DECISIONS.md` (ADR-008/032/033/034/035)
- `docs/01_ARCHITECTURE.md`, `docs/02_DATA_MODEL.md`, `docs/05_CODING_CONVENTIONS.md`, `docs/06_OBSERVABILITY.md`, `docs/07_BEHAVIOR_LOGS.md`, `docs/09_FIELD_AUDIT.md`
- `docs/handoff/PHASE_00_HANDOFF.md`
- `docs/workflow/ICP_WORKFLOW_FINAL.md`
- `ai-delivery/TASK_OPERATING_SYSTEM.md`
- `MASTER_ROADMAP.md`, `MASTER_SLICE_BACKLOG.md`
- 5 committed `infra/migrations/V00X__*.sql` files

---

## 8. Action Items for Human (Phiên 3 Decide)

1. **⚠️ HIGH PRIORITY — Resolve C7:** Decide `image_embedding` field dimension (likely CLIP 512 vs sentence-transformers 768 vs multimodal). Document in new ADR-036 or inline V001/product.sd comment. **Blocks S-00b G-12 + G-14.**
2. **Approve Option B vs Option A** for next slice (AI recommends Option B — insert S-00b before Stage 1 V-SLICEs).
3. **Approve docs patches batch C1-C5** (P2, ~0.25 day single commit) — recommend doing BEFORE S-00b kickoff so S-00b follows current spec.
4. **Optional:** Decide C6 DoD-8 phrasing clarification (P3 polish, can defer).
5. **Optional:** Add G-31 Zustand store file naming convention to `05_CODING_CONVENTIONS.md` (~5 min) before S-02 P-CAP creates first stores.
6. **Operational items (no ADR needed):** PHASE_01 line 273-275 — API key availability + local Docker vs remote test environment. Surface to ops/devops track, not architecture.

---

**End of consolidated report.** Phiên 3 will pick next slice based on human decide on items 1-2 above.
