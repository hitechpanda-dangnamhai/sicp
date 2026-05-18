# Claude Code Task Pack — S00-T01

## Task Type

**Q-GATE** (Audit only, không code)

## Objective

Audit foundation-level repo artifacts: monorepo setup (pnpm workspaces), root configs (package.json, tsconfig.base.json, .env.example, .gitignore, .editorconfig), Makefile, docker-compose orchestration (app stack + observability stack tách riêng), CI workflow (GitHub Actions lint+test), root README. So sánh hiện trạng repo greenfield vs PHASE_01_INFRA.md Day 1 + Day 7 + DoD-1 + DoD-4 expectations. Output per-DoD finding với severity + effort + slice owner.

## Read First (Evidence)

1. `slices/S-00_BRIEF.md` — slice context, evidence list, risks
2. `docs/phases/PHASE_01_INFRA.md` lines 8-16 (DoD-1, DoD-4), lines 22-32 (docker-compose.yml services table), lines 36-42 (docker-compose.observability.yml table), lines 58-110 (cấu trúc thư mục root), lines 114-119 (Day 1 — Repo setup), lines 229-233 (Day 7 — Glue + CI)
3. `docs/00_CONTEXT.md` — tech stack baseline (pnpm, Node, Python pinned versions)
4. `MASTER_ROADMAP.md` lines 41-49 — Stage 1 outputs expected
5. `MASTER_SLICE_BACKLOG.md` lines 38-56 — S-00 spec
6. `ai-delivery/TASK_OPERATING_SYSTEM.md` — 7 Rules (especially Rule 3 evidence, Rule 5 stop conditions)

## Scope (ALLOWED to do)

- Compare claim "greenfield — chỉ có thư mục docs/" against PHASE_01_INFRA Day 1 + Day 7 expectations
- Document gap per artifact: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.editorconfig`, `Makefile`, `docker-compose.yml`, `docker-compose.observability.yml`, `.github/workflows/*.yml`, root `README.md`
- Assess DoD-1 (`make up` boots) feasibility — implicit requires Makefile + 2 compose files + .env.example
- Assess DoD-4 (CI lint + test) feasibility — implicit requires `.github/workflows/` + root scripts
- Classify severity: P0 BLOCKER (blocks any downstream slice), P1 HIGH (blocks Stage 1 completion), P2 MEDIUM (DX nice-to-have)
- Identify slice owner per gap (S-00b foundation scaffold candidate vs absorb into S-02 P-CAP)
- Estimate effort in Day-unit per `PHASE_01_INFRA.md` mapping

## Non-goals (NOT doing in this task)

- KHÔNG audit services skeleton (`apps/{gateway,ai,mcp,web,workers}` Dockerfiles, health endpoints) — defer to S00-T02
- KHÔNG audit migrations/seed/Vespa schema content — defer to S00-T03
- KHÔNG audit observability stack content (otel-collector config, datasources YAML, log schema implementation) — defer to S00-T04
- KHÔNG audit ADR consistency in docs — defer to S00-T05
- KHÔNG propose specific file content (file structures suggestion ok, content design defer to S-02 / S-00b)
- KHÔNG decide whether to insert S-00b — only flag candidate, consolidated report sẽ propose options for human

## Allowed Changes

- Create: `taskpacks/S00-T01_AUDIT_REPO_STRUCTURE.md` (this file)
- Create: `reports/S00-T01_REPORT.md`
- Create: `reviews/S00-T01_REVIEW.md`

## Forbidden Changes

- KHÔNG touch `docs/` (audit reference only — read-only)
- KHÔNG touch `infra/` (read-only audit)
- KHÔNG touch `ai-delivery/TASK_OPERATING_SYSTEM.md`
- KHÔNG modify `MASTER_ROADMAP.md` or `MASTER_SLICE_BACKLOG.md`
- KHÔNG create stub files in `apps/`, `packages/`, root configs — audit only, no fix in this slice

## Acceptance Criteria

Q-GATE audit criteria (replace standard code criteria):

- [ ] Per-DoD finding documented với current state vs expected (DoD-1, DoD-4, Day 1 artifacts, Day 7 artifacts)
- [ ] Each gap có effort estimate (Xx days per PHASE_01_INFRA Day mapping)
- [ ] Each gap có slice owner identified (S-00b candidate / S-02 absorb / explicit defer)
- [ ] Each gap có severity classified (P0 BLOCKER / P1 HIGH / P2 MEDIUM)
- [ ] No unrelated audit drift (T01 stays focused on repo structure + tooling, không lan sang T02-T05 scope)
- [ ] Output report cites file path + line evidence per Rule 3

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- Evidence conflict per Rule 7 — vd `PHASE_01_INFRA.md` Day 1 contradicts `MASTER_ROADMAP.md` Stage 1 outputs
- ADR mới cần thiết để resolve gap (vd tool choice giữa pnpm vs npm chưa lock — kiểm tra `00_CONTEXT.md`)
- Cần human decide architecture cho gap còn pending (vd monorepo tool còn debate)
- Discover requirement chưa có trong specs (vd cần CI matrix multiple Node versions nhưng spec không mention)
- Greenfield assumption thực ra false ở scope T01 (vd phát hiện `package.json` đã có nhưng prompt nói greenfield)

## Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice, không có previous slice để regression check.**

Note explicit per workflow convention: vì S-00 là first slice, gate này không applicable; no integration check to perform against prior slices.
