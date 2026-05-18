# Implementation Report — S00-T02 Audit Services Skeleton

> **Task Type:** Q-GATE audit-only
> **Method:** Checklist Mode (compare claim greenfield vs PHASE_01_INFRA.md Day 3-6 + DoD-3 + DoD-5)
> **Date:** 2026-05-18

## 1. Audit Performed

**Files reviewed:**
- `docs/phases/PHASE_01_INFRA.md` (DoD-3, DoD-5; Day 3 gateway lines 132-142; Day 4 ai lines 143-152; Day 5 mcp lines 153-162; Day 6 web lines 164-227 with full ADR-033/034/035 LOCKED stack; lines 60-110 apps/ tree)
- `docs/01_ARCHITECTURE.md` — 3-tier boundary, MCP tools surface
- `docs/DECISIONS.md` ADR-033/034/035 entries (lines 320, 363, 410)
- `docs/handoff/PHASE_00_HANDOFF.md` lines 427-433 "Câu hỏi mở" with checkmarks
- `reports/S00-T01_REPORT.md` (depends_on — F1 monorepo, F10 packages/shared-types blocks all of T02 scope)
- `slices/S-00_BRIEF.md`

**DoD items checked in this task:**
- DoD-3 — 4 services (gateway, ai, mcp, web) boot không lỗi và respond `/health`
- DoD-5 — `apps/web` show trang trống "ICP loaded"
- Day 3-6 service-level artifacts (Dockerfiles, entry files, modules)

**Repo state:** GREENFIELD per prompt — no `apps/`, no `packages/`.

## 2. Findings

### Finding T02-F1 — `apps/gateway/` (NestJS) MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-3 + Day 3 (lines 132-142) |
| **Current state** | `apps/gateway/` does not exist |
| **Expected** | Per PHASE_01 line 74-80 + Day 3:<br>• `package.json`, `nest-cli.json`, `Dockerfile` multi-stage<br>• `src/main.ts` (OTel import FIRST then bootstrap Nest)<br>• `src/app.module.ts` registering: `HealthModule`, `ConfigModule`, `DbModule`, `ObservabilityModule`<br>• `src/health.controller.ts` → `GET /api/v1/health` + `/ready` (PG/Redis/Kafka/otel checks)<br>• `src/common/idempotency.middleware.ts` skeleton (log lock_acquired/cache_hit/lock_conflict)<br>• `src/observability/otel.ts`, `src/observability/logger.ts` (pino + OTel transport, `createLogger()` helper) — content audit in T04<br>• Env vars validation fail-fast incl. `OTEL_EXPORTER_OTLP_ENDPOINT`<br>• Port 3001 (per PHASE_01 line 28) |
| **Gap** | Entire NestJS service absent |
| **Effort** | 1 day (Day 3 mapped) |
| **Slice owner** | S-02 P-CAP — but minimal Dockerfile/skeleton may need S-00b foundation if compose `make up` requires Dockerfile presence to parse |
| **Severity** | **P0 BLOCKER** — DoD-3 directly fails; blocks S-03 (auth), S-04 (search), and all downstream V-SLICEs |

### Finding T02-F2 — `apps/ai/` (Flask + LangGraph) MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-3 + Day 4 (lines 143-152) |
| **Current state** | `apps/ai/` does not exist |
| **Expected** | Per PHASE_01 line 81-85 + Day 4:<br>• `pyproject.toml` with deps: flask, langgraph, langchain, langchain-google-genai, langchain-openai, structlog, pydantic, opentelemetry-distro, opentelemetry-instrumentation-flask, opentelemetry-exporter-otlp<br>• `src/main.py` Flask app, `GET /health`, `/ready`, started with `opentelemetry-instrument flask run`<br>• `src/state.py` — `IcpState` TypedDict<br>• `src/graphs/router_graph.py` — skeleton classify "unknown", log `intent.received` + `intent.classified`<br>• `src/tools/mcp_client.py` — MCP client with trace context propagation (inject `traceparent` header)<br>• `src/observability/setup.py`, `src/observability/logger.py` (structlog JSON + trace_id auto-inject) — content audit in T04<br>• `Dockerfile`<br>• Port 5001 |
| **Gap** | Entire AI service absent |
| **Effort** | 1 day |
| **Slice owner** | S-02 P-CAP (LangGraph router skeleton listed in S-02 MUST_BEFORE capabilities per `MASTER_SLICE_BACKLOG.md` S-02 detail) |
| **Severity** | **P0 BLOCKER** — DoD-3 fails; blocks Intent 03 search Variant B (AI-augmented) and all AI intents |

### Finding T02-F3 — `apps/mcp/` (Python MCP server) MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-3 + Day 5 (lines 153-162) |
| **Current state** | `apps/mcp/` does not exist |
| **Expected** | Per PHASE_01 line 86-89 + Day 5:<br>• `pyproject.toml` with deps: pydantic, psycopg, redis, requests, OTel stack<br>• `src/main.py` HTTP server mode JSON-RPC over `POST /rpc`<br>• `src/observability/setup.py` — OTel init<br>• Tool registry pattern: each tool wrapped in `tracer.start_as_current_span("mcp.tool.<name>")`<br>• 3 initial tools with logging: `auth.verify_jwt` (logs `auth.token_verified`/`token_invalid`), `events.append` (logs `event.appended`), `products.get`<br>• Trace context extract from request headers (traceparent propagation downstream)<br>• `Dockerfile`<br>• Port 5050 |
| **Gap** | Entire MCP server absent |
| **Effort** | 1 day |
| **Slice owner** | S-02 P-CAP (MCP client wrapper + 3 initial tools is part of MUST_BEFORE per backlog) |
| **Severity** | **P0 BLOCKER** — DoD-3 fails; auth/events/products tools needed by every V-SLICE |

### Finding T02-F4 — `apps/web/` (Next.js 14 App Router) MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-3 + DoD-5 + Day 6 (lines 164-227, full ADR-033/034/035 LOCKED) |
| **Current state** | `apps/web/` does not exist |
| **Expected** | Per PHASE_01 Day 6 (LOCKED tech stack):<br>**Framework + build:**<br>• Next.js 14 App Router init<br>• `Dockerfile`<br>• env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_VERSION`<br>• Port 3000<br><br>**ADR-033 (component framework):**<br>• Tailwind CSS v3 install + content paths cover `apps/web/components/**`<br>• shadcn/ui CLI init `npx shadcn-ui@latest init` with MoMo Premium tokens import vào `globals.css`<br>• Component directory structure: `components/{ui,icp,layout,cards,chat}/`<br><br>**ADR-034 (animation):**<br>• Framer Motion with `framer-motion/m` entry point (lazy-load)<br>• canvas-confetti<br>• CSS keyframes + `@media (prefers-reduced-motion)` guard<br><br>**ADR-035 (state management):**<br>• Zustand v5 install + `apps/web/stores/` directory (populated S-02+)<br>• TanStack Query install + Provider wrap app<br>• react-hook-form install<br><br>**Other:**<br>• MSW setup `apps/web/src/mocks/handlers.ts` skeleton<br>• `app/layout.tsx` wrap với TanStack Query Provider + AuthContext + Toaster<br>• `app/page.tsx` → render `<PhoneFrame>` "ICP loaded" placeholder (DoD-5)<br>• `lib/api-client.ts` (import generated client from `@icp/shared-types/api`)<br>• `lib/sse-client.ts` (typed wrapper from `08_FE_BE_CONTRACT.md` §6)<br>• `lib/tracker.ts` (behavior event tracker from `07_BEHAVIOR_LOGS.md` §7)<br>• `globals.css` CSS variables MoMo Premium (`PHASE_00_DESIGN_SYSTEM.md` Section 1) |
| **Gap** | Entire Next.js app + LOCKED tech stack absent |
| **Effort** | 1-1.5 days (Day 6) — heavy because ADR-033/034/035 LOCKED stack means setup of 7+ libs |
| **Slice owner** | **Split:**<br>• S-00b foundation scaffold: Next.js init + Dockerfile + Tailwind + shadcn init + `app/page.tsx` placeholder `<PhoneFrame>` (DoD-5 minimum)<br>• S-01 H-UI: populate `components/{ui,icp,layout,cards,chat}/` per EBT v2 from 75 mockups<br>• S-02 P-CAP: Zustand stores, TanStack Query Provider + `lib/api-client.ts` (after OpenAPI codegen runs), `lib/tracker.ts`<br>**Strong recommendation:** S-00b owns the bare Next.js init so DoD-3 (boot `/health`) + DoD-5 (placeholder page) passes before S-01 starts component library work |
| **Severity** | **P0 BLOCKER** — DoD-3 + DoD-5 fail; blocks ALL UI work |

### Finding T02-F5 — `apps/workers/` skeleton MISSING

| Field | Value |
|---|---|
| **DoD/Day** | Day 1 (line 90-92) — `workers/` skeleton chưa start |
| **Current state** | `apps/workers/` does not exist |
| **Expected** | Per PHASE_01 line 90-92:<br>• `package.json`<br>• `src/index.ts` (skeleton — chưa start) |
| **Gap** | Workers package absent |
| **Effort** | 0.25 day (skeleton only) |
| **Slice owner** | S-00b foundation scaffold; populated by Phase 04 V-SLICEs (payment-worker, inventory-worker, notification-worker) and S-02-or-later for shopee-mock-seed-worker (per ADR-032) |
| **Severity** | **P2 MEDIUM** — Phase 01 says "skeleton chưa start", so empty package OK for DoD; full workers belong Phase 04. **HOWEVER** — `shopee-mock-seed-worker.ts` is referenced by V008 migration (per ADR-032) as seed mechanism, so it's borderline Stage 1 if Intent 01 demo wants pre-seeded data. Surface for consolidated report. |

### Finding T02-F6 — `apps/web` `<PhoneFrame>` "ICP loaded" page MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-5 explicit ("`apps/web` show trang trống 'ICP loaded'") |
| **Current state** | No web app, so page absent by extension |
| **Expected** | `app/page.tsx` rendering minimal `<PhoneFrame>` shell with "ICP loaded" text per PHASE_01 line 211 |
| **Gap** | Cross-references F4 |
| **Effort** | 0.25 day (after F4 init) |
| **Slice owner** | S-00b foundation scaffold (lightweight `<PhoneFrame>` stub or even bare `<div>` "ICP loaded" — S-01 owns proper `<PhoneFrame>` component build per EBT v2) |
| **Severity** | **P0 BLOCKER** for DoD-5 literal pass; **P1 HIGH** if interpret loosely (any "ICP loaded" page suffices) |

### Finding T02-F7 — Health endpoint contract MISSING across services

| Field | Value |
|---|---|
| **DoD/Day** | DoD-3 explicit |
| **Current state** | No services to host endpoints |
| **Expected** | Per PHASE_01 Day 3 (gateway): `GET /api/v1/health` + `/ready` (NestJS); Day 4 (ai): `GET /health` + `/ready` (Flask); Day 5 (mcp): JSON-RPC `POST /rpc` for tools — but health unspecified in Day 5; web `<PhoneFrame>` page is "health" surrogate. **Doc gap surfaced:** MCP service `/health` not explicitly listed in Day 5 tasks (line 153-162) although DoD-3 says "4 services respond /health". Surface to T05. |
| **Gap** | Endpoints + readiness checks (PG/Redis/Kafka/otel) absent |
| **Effort** | Part of F1/F2/F3 effort |
| **Slice owner** | S-02 P-CAP (each service implements its own); spec gap for MCP `/health` belongs to T05 consistency batch |
| **Severity** | **P0 BLOCKER** — DoD-3 explicit |

### Finding T02-F8 — `packages/shared-types/` consumption pattern not yet established

| Field | Value |
|---|---|
| **DoD/Day** | Day 1 (line 116) + Day 6 (line 212) — `apps/web/lib/api-client.ts` import generated client from `@icp/shared-types/api` |
| **Current state** | No `packages/shared-types/`; T01-F10 covers scaffold gap |
| **Expected** | All services import types from `@icp/shared-types` (NestJS DTOs at gateway end, TS types at web end). Phase 01 establishes the package; Phase 02+ populates via OpenAPI codegen (`pnpm openapi:sync`). |
| **Gap** | No consumption wiring yet — services + web don't exist to import |
| **Effort** | Captured in F1/F4 (web import wiring) + S-02 (codegen pipeline) |
| **Slice owner** | S-02 P-CAP MUST_BEFORE capability |
| **Severity** | **P0 BLOCKER** for Stage 2; **P1 HIGH** for Stage 1 (initial empty package OK) |

### Summary Table — T02 Findings

| Finding | DoD/Day | Severity | Effort (days) | Owner candidate |
|---|---|---|---|---|
| F1 apps/gateway (NestJS) | DoD-3 / Day 3 | P0 | 1.0 | S-02 P-CAP (S-00b minimal stub) |
| F2 apps/ai (Flask) | DoD-3 / Day 4 | P0 | 1.0 | S-02 P-CAP |
| F3 apps/mcp (Python) | DoD-3 / Day 5 | P0 | 1.0 | S-02 P-CAP |
| F4 apps/web (Next.js + ADR-033/034/035) | DoD-3 + DoD-5 / Day 6 | P0 | 1.0-1.5 | Split: S-00b scaffold + S-01 components + S-02 stores |
| F5 apps/workers skeleton | Day 1 | P2 | 0.25 | S-00b |
| F6 `<PhoneFrame>` "ICP loaded" page | DoD-5 | P0 | 0.25 | S-00b |
| F7 Health endpoints across all 4 services | DoD-3 | P0 | (in F1-F4) | S-02 |
| F8 packages/shared-types consumption | Day 6 | P0/P1 | (cross-task) | S-02 |
| **Total T02 scope** | | | **~4.5 days** | |

### DoD verdict from T02 perspective
- **DoD-3** (4 services boot + `/health`): ❌ TODO (zero services exist)
- **DoD-5** (`apps/web` "ICP loaded" page): ❌ TODO (no web app)

## 3. Commands Run

**N/A: audit không chạy bash.**

## 4. Test Results

**N/A: audit không có test code.**

## 5. Deviations From Task Pack

None. Stayed strictly within services skeleton scope. Did not audit observability instrumentation correctness (deferred to T04 per task pack Non-goals section); only surfaced "obs files expected to exist" as part of per-service expected file list.

## 6. Known Issues

- **F4 owner split is a 3-slice handoff** (S-00b → S-01 → S-02). Risk of integration friction if scaffold doesn't anticipate which directories S-01 will populate. Recommend S-00b creates empty `components/{ui,icp,layout,cards,chat}/` directories with `.gitkeep` per ADR-033 directory pattern (PHASE_01 line 201-207) so S-01 has structure pre-defined.
- **F5 shopee-mock-seed-worker timing ambiguity:** Per ADR-032 the worker seeds Postgres `shopee_prices_mock` table at startup. If Intent 01 demo requires this seed pre-Stage 1, then F5 effort goes up. Surface in consolidated report — possibly add as explicit S-00b task or carry into S-02 (depends on Intent 01 V-SLICE timing).
- **F7 MCP `/health` doc gap:** PHASE_01 Day 5 (line 153-162) does not list `/health` endpoint for MCP — but DoD-3 says "4 services respond /health". Either MCP implements `/health` separately from JSON-RPC `/rpc`, OR DoD-3 means "4 services boot + 3 expose /health + MCP exposes /rpc health-like". Flagged for T05 cross-cutting consistency check.

## 7. Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice.**

## 8. Recommended Next Step

Proceed to **S00-T03 Audit Data Layer**. T02 surfaced F8 (shared-types consumption) and F5 (shopee-mock-seed-worker for V008 ADR-032) — both data-adjacent forward references for T03. T07 (MCP /health doc gap) + spec inconsistency in F5 forwarded to T05 synthesis.

## Bonus — Conflicts Surfaced (Rule 7)

**1 minor docs inconsistency surfaced**, forwarded to T05:

- **PHASE_01 Day 5 vs DoD-3:** MCP service's `/health` endpoint not listed in Day 5 tasks (PHASE_01 lines 153-162) but DoD-3 (line 10) requires "4 services boot không lỗi và respond `/health`". Resolution candidate: either expand Day 5 to add `GET /health` task, or interpret DoD-3 to allow JSON-RPC tool-list as health-equivalent for MCP. P2 severity (docs clarification), not a slice blocker.

- **PHASE_01 Day 6 line 176 stray line:** "HTTP server mode (JSON-RPC over POST /rpc)" appears under Day 6 web tasks (line 176) but JSON-RPC is MCP server pattern (Day 5). Likely doc copy-paste residue. P2 severity, forward to T05.

- **PHASE_01 Day 6 has duplicate section header at lines 164 and 179:** Both labeled "Day 6 — Web skeleton (Next.js)" — first is legacy generic version, second is ADR-033/034/035 LOCKED version added Phiên 1. P2 polish for T05.
