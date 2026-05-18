# Claude Code Task Pack — S00-T02

## Task Type

**Q-GATE** (Audit only, không code)

## Objective

Audit 5 services skeleton (gateway, ai, mcp, web, workers) + `packages/shared-types`: existence of `apps/<service>/` directory, package.json/pyproject.toml, Dockerfile multi-stage, `src/main.{ts,py}` entry, `/health` + `/ready` endpoints, env vars validation. So sánh hiện trạng repo greenfield vs PHASE_01_INFRA.md Day 3-6 + DoD-3 + DoD-5 expectations. Output per-DoD finding với severity + effort + slice owner.

## Read First (Evidence)

1. `slices/S-00_BRIEF.md` — slice context
2. `reports/S00-T01_REPORT.md` — T01 findings (depends on for repo structure baseline)
3. `docs/phases/PHASE_01_INFRA.md` lines 8-16 (DoD-3, DoD-5), lines 22-32 (gateway/ai/mcp/web port assignments), lines 60-110 (apps/ tree expectation), lines 132-220 (Day 3 gateway, Day 4 ai, Day 5 mcp, Day 6 web full LOCKED tech stack ADR-033/034/035)
4. `docs/01_ARCHITECTURE.md` — 3-tier services boundary, MCP tools surface
5. `docs/DECISIONS.md` ADR-033 (line 320), ADR-034 (line 363), ADR-035 (line 410) — Day 6 web tech stack LOCKED
6. `docs/handoff/PHASE_00_HANDOFF.md` line 427-433 — "Câu hỏi mở" with ADR pointers
7. `ai-delivery/TASK_OPERATING_SYSTEM.md` — Rules 3, 5, 7

## Scope (ALLOWED to do)

- Audit existence of 5 service directories: `apps/gateway/`, `apps/ai/`, `apps/mcp/`, `apps/web/`, `apps/workers/`
- Audit existence of `packages/shared-types/` with `package.json`, `tsconfig.json`, `src/index.ts`
- Per-service check:
  - **gateway** (NestJS): `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/health.controller.ts`, `Dockerfile`, env validation, port 3001
  - **ai** (Flask + LangGraph): `pyproject.toml`, `src/main.py`, `src/health.py`, `src/state.py` (IcpState), `src/graphs/router_graph.py`, `src/tools/mcp_client.py`, `Dockerfile`, port 5001
  - **mcp** (Python): `pyproject.toml`, `src/main.py`, tool registry pattern, 3 initial tools (`auth.verify_jwt`, `events.append`, `products.get`), HTTP JSON-RPC `/rpc`, `Dockerfile`, port 5050
  - **web** (Next.js 14 App Router): full ADR-033/034/035 stack — Tailwind v3, shadcn/ui, Framer Motion `framer-motion/m`, canvas-confetti, Zustand v5, TanStack Query, react-hook-form, MSW, `Dockerfile`, port 3000
  - **workers** (TypeScript): `package.json`, `src/index.ts` skeleton (chưa start per spec)
- Assess DoD-3 (4 services `/health` respond) feasibility
- Assess DoD-5 (`apps/web` "ICP loaded" placeholder via `<PhoneFrame>`) feasibility
- Classify severity, identify slice owner, estimate effort per Day mapping (Day 3 gateway, Day 4 ai, Day 5 mcp, Day 6 web)

## Non-goals (NOT doing in this task)

- KHÔNG audit observability instrumentation content (`apps/<service>/src/observability/`) — surface existence only, defer detail to S00-T04
- KHÔNG audit OTel SDK init code correctness — S00-T04
- KHÔNG audit data layer (Postgres connection, migrations) — S00-T03
- KHÔNG build component library 75 mockup extraction — defer S-01 H-UI
- KHÔNG audit OpenAPI codegen pipeline detail — surface only, S-02 P-CAP owns deep
- KHÔNG decide architecture (vd swap Flask → FastAPI for AI service — that's ADR territory, Rule 5 stop)

## Allowed Changes

- Create: `taskpacks/S00-T02_AUDIT_SERVICES_SKELETON.md` (this file)
- Create: `reports/S00-T02_REPORT.md`
- Create: `reviews/S00-T02_REVIEW.md`

## Forbidden Changes

- KHÔNG touch `apps/` (does not exist; do not stub)
- KHÔNG touch `packages/` (does not exist; do not stub)
- KHÔNG touch `docs/`, `infra/`, `ai-delivery/`
- KHÔNG modify ADR-033/034/035 (LOCKED)
- KHÔNG create dependency manifests — audit only

## Acceptance Criteria

- [ ] Per-service finding: directory exists yes/no, key files list expected vs actual, severity
- [ ] DoD-3 verdict per service (gateway/ai/mcp/web) — all MISSING expected (greenfield)
- [ ] DoD-5 verdict — `<PhoneFrame>` "ICP loaded" page MISSING expected
- [ ] Effort estimate per service mapped to Day 3-6
- [ ] Slice owner identified: S-02 (gateway/ai/mcp services + workers skeleton); S-01 (web component library populate); possibly S-00b foundation scaffold (Dockerfiles + nest CLI init + Next.js init)
- [ ] No drift into T01 (root configs) or T04 (obs detail) scope
- [ ] Output report cites file path + line evidence per Rule 3

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- Evidence conflict per Rule 7 — vd PHASE_01_INFRA Day 6 web stack contradicts ADR-033/034/035 (already checked: ADR-033/034/035 reflected ở Day 6 lines 179-227, no conflict expected)
- ADR mới cần thiết — vd MCP HTTP transport format chưa lock (current spec: JSON-RPC POST /rpc per Day 5)
- Cần human decide — vd `workers` service language (TypeScript per spec line 92, but check Day 6 hint about "HTTP server mode (JSON-RPC over POST /rpc)" appearing under Web — possible doc inconsistency to surface)
- Discover requirement chưa có specs — vd health check protocol (HTTP GET 200 vs gRPC?) — current spec implicit HTTP GET via Day 3 line 137
- Greenfield assumption violation — vd phát hiện `apps/gateway/` đã exist (per prompt: greenfield, so MUST flag if found)

## Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice, không có previous slice để regression check.**

Forward-looking note (informational, not regression):
- T02 findings inform S-01 (web foundation owner) + S-02 (gateway/ai/mcp runtime owner) — but those are future slices, not regression targets.
