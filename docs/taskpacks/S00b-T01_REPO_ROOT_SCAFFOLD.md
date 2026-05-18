# Claude Code Task Pack — S00b-T01 Repo Root Scaffold

> **Slice:** S-00b Foundation Scaffold
> **Phiên:** 4
> **Created:** 2026-05-18
> **Status:** PROPOSED (chờ human ack scope trước khi bước sang implementation)

---

## Task Type

**P-CAP** (Capability — emit foundational repo-root config files, không có UI và không có domain logic; chỉ scaffold cho phép `pnpm install` chạy được và downstream tasks T02-T08 build trên đó.)

## Objective

Emit 8 file config tại root của monorepo `icp/` per `PHASE_01_INFRA.md` Day 1 + Day 7 spec (cấu trúc thư mục root lines 58-110): `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.env.example`, `Makefile`, `README.md`. Mục tiêu là tạo "canvas" để T02 init shared-types package, T03 stub Dockerfiles, T04-T07 add infra/configs, T08 wire compose + web + CI. KHÔNG init bất kỳ subdirectory nào (`apps/`, `packages/`, `infra/`, `.github/`) trong task này — defer T02-T08 per execution guide.

## Read First (Evidence)

1. `slices/S-00b_BRIEF.md` — slice context + Risks section (R1, R3 đặc biệt — R3 C12 LOCKED Option B)
2. `slices/S-00b_EXECUTION_GUIDE.md` Section 1 (decisions D-01 đến D-05, conflicts C8-C12 surfaced) + Section 4.1 (T01 recipe + Task-specific notes)
3. `decisions-log.md` — full file, đặc biệt D-05 (TypeScript module config — base esnext + bundler) + C12 (Option B locked — không VECTOR columns)
4. `docs/phases/PHASE_01_INFRA.md` lines 58-110 (cấu trúc thư mục root), lines 119-123 (Day 1 — Repo setup), lines 220-223 (Day 7 — Glue + CI), lines 263 (pnpm locked)
5. `docs/00_CONTEXT.md` Section 1 (repo layout), Section 2 (tech stack pinned versions: Node 20-alpine, Python 3.11-slim, pnpm 9.x), Section 10 (critical constraints)
6. `docs/05_CODING_CONVENTIONS.md` Section 5 (env vars qua `.env.example` + `.env` gitignored), Section 6 (Conventional Commits — không impose trong T01 nhưng README mention)
7. `docs/06_OBSERVABILITY.md` Section 16 — OTel env vars contract (cho `.env.example`)
8. `docs/DECISIONS.md` ADR-033/034/035/036 (mention trong README)
9. `slices/S-00b_TASKLIST.md` row T01 — output expected (8 code files + 4 workflow files)
10. `ai-delivery/TASK_OPERATING_SYSTEM.md` — 7 Rules (Rule 1, 3, 5, 7 đặc biệt)
11. `docs/workflow/ICP_WORKFLOW_FINAL.md` Step 7-10 templates

## Scope (ALLOWED to do)

### Code emit (8 files at repo root):

1. **`package.json`** — root monorepo package, declare `private: true`, `name: "icp"`, `packageManager: "pnpm@9.x.x"`, scripts orchestrator (`dev`, `build`, `lint`, `test`, `typecheck`, `clean`, `format`, `obs:up`, `obs:down`) tận dụng pnpm filter `--recursive` để chạy across workspaces. **KHÔNG có dependencies** (root only orchestrator) — devDependencies chỉ tooling nếu cần (typescript@5.x, prettier nếu nhẹ).

2. **`pnpm-workspace.yaml`** — declare 2 patterns: `apps/*` và `packages/*` (per `00_CONTEXT.md` Section 1 repo layout). **Critical:** `packages/*` plural — T02 sẽ resolve `@icp/shared-types` qua pattern này.

3. **`tsconfig.base.json`** — per D-05 LOCKED:
   - `target: es2022`
   - `lib: ["es2022", "DOM", "DOM.Iterable"]`
   - `module: esnext`
   - `moduleResolution: bundler`
   - `strict: true`, `skipLibCheck: true`, `esModuleInterop: true`, `resolveJsonModule: true`, `isolatedModules: true`
   - `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`
   - **Note inline:** Gateway (NestJS 10) sẽ override `module: commonjs` + `moduleResolution: node` trong `apps/gateway/tsconfig.json` extends base (defer T03).

4. **`.gitignore`** — patterns standard cho Node monorepo + Python + Docker:
   - Node: `node_modules/`, `.next/`, `dist/`, `build/`, `*.tsbuildinfo`, `.turbo/`
   - Python: `__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`
   - Env: `.env`, `.env.local`, `.env.*.local` (but **NOT** `.env.example` — explicit negation)
   - IDE: `.vscode/` (selective — keep `.vscode/extensions.json` and `.vscode/settings.json` if team config; default ignore root `.vscode/` for hackathon scope, document choice)
   - OS: `.DS_Store`, `Thumbs.db`
   - Logs: `*.log`, `npm-debug.log*`, `pnpm-debug.log*`
   - Misc: `coverage/`, `.nyc_output/`

5. **`.editorconfig`** — per `05_CODING_CONVENTIONS.md` style baseline:
   - `root = true`
   - All files: UTF-8, LF line endings, trim trailing whitespace, insert final newline
   - TS/JS/JSON/YAML/MD: 2 space indent
   - Python: 4 space indent (per Python convention)
   - Makefile: tab indent (hard requirement của make)

6. **`.env.example`** — full env contract per execution guide Section 4.1 (block code embedded). Sections:
   - Core infrastructure (DATABASE_URL, REDIS_URL, KAFKA_BROKERS)
   - Auth (JWT_SECRET placeholder)
   - OpenTelemetry (5 OTEL_* vars per `06_OBSERVABILITY.md` §16)
   - Per-service identity (OTEL_SERVICE_NAME, APP_VERSION — override trong compose)
   - Vespa (VESPA_CONFIG_SERVER, VESPA_QUERY_URL)
   - LLM API keys (GEMINI_API_KEY, OPENAI_API_KEY — empty placeholder, value trong `.env` không commit)
   - Frontend public (3 NEXT_PUBLIC_* vars)

7. **`Makefile`** — targets per execution guide Section 4.1:
   - `up`: `docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml up -d`
   - `down`: tear down both
   - `migrate`: `bash infra/migrations/apply.sh` (file T04 sẽ tạo)
   - `seed`: depend on `migrate`, then `node infra/seed/seed.ts` (T05 sẽ tạo)
   - `vespa:deploy`: `bash infra/vespa/deploy.sh` (T06 sẽ tạo)
   - `obs:up` / `obs:down`: escape hatch obs compose only
   - `logs`: `docker compose logs -f --tail=100`
   - `clean`: `rm -rf node_modules apps/*/node_modules packages/*/node_modules`
   - `lint`: `pnpm -r lint`
   - `test`: `pnpm -r test`
   - `typecheck`: `pnpm -r typecheck`
   - `.PHONY` declared cho tất cả targets
   - Help target default (chạy `make` không args → liệt kê targets)

8. **`README.md`** — quickstart + tech stack overview:
   - Title + project tagline (ICP — Intelligent Commerce Platform, Hackathon 2026)
   - Quickstart: `cp .env.example .env`, `pnpm install`, `make up && make seed`
   - Tech stack bullets (mapping `00_CONTEXT.md` §2)
   - Repo layout snippet (mirror `00_CONTEXT.md` §1 condensed)
   - Mention 4 ADRs LOCKED: ADR-033 (component lib), ADR-034 (animation), ADR-035 (state mgmt), ADR-036 (CLIP 512 image embedding). Link to `docs/DECISIONS.md`.
   - Note: stack chưa runnable end-to-end ở T01 — sẽ runnable sau T08.

### Workflow file emit (sau code):

9. `taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md` (file này — đã include trong outputs)
10. `reports/S00b-T01_REPORT.md`
11. `reviews/S00b-T01_REVIEW.md`
12. `slices/S-00b_TASKLIST.md` (updated — T01 marked DONE + Status Log appended)

## Non-goals (NOT doing in this task)

Per execution guide Section 4.1 "KHÔNG làm trong T01":

- **KHÔNG init `packages/shared-types/`** (package.json, tsconfig.json, src/index.ts) — defer T02
- **KHÔNG init `apps/workers/`** (package.json, src/index.ts skeleton) — defer T02
- **KHÔNG init `apps/{gateway,ai,mcp,web}/`** files — defer T03
- **KHÔNG tạo `infra/migrations/`, `infra/seed/`, `infra/vespa/`, `infra/otel/`** content (Makefile chỉ reference path, files chưa tồn tại OK) — defer T04-T07
- **KHÔNG tạo compose files** (`infra/docker-compose.yml`, `infra/docker-compose.observability.yml`) — defer T07 (obs) + T08 (app)
- **KHÔNG tạo `.github/workflows/ci.yml`** — defer T08
- **KHÔNG tạo `.dockerignore`** — defer T03 (mỗi service tự có) hoặc T08 (root nếu cần)
- **KHÔNG install dependencies thật** (root `package.json` zero deps; pnpm install chỉ chạy sau khi có workspaces có content — defer T02)
- **KHÔNG tạo lockfile** `pnpm-lock.yaml` — generated bởi `pnpm install` first run sau T02
- **KHÔNG tạo `.prettierrc` / `eslint.config.js`** — Hackathon scope, defer hoặc out-of-scope hoàn toàn (per S00-REPORT G-26/G-27 partial coverage)
- **KHÔNG decide architecture mới** (Rule 5 STOP — surface to ADR nếu cần)

## Allowed Changes

- Create: `outputs/package.json`
- Create: `outputs/pnpm-workspace.yaml`
- Create: `outputs/tsconfig.base.json`
- Create: `outputs/.gitignore`
- Create: `outputs/.editorconfig`
- Create: `outputs/.env.example`
- Create: `outputs/Makefile`
- Create: `outputs/README.md`
- Create: `outputs/taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md` (this file)
- Create: `outputs/reports/S00b-T01_REPORT.md`
- Create: `outputs/reviews/S00b-T01_REVIEW.md`
- Modify: `outputs/slices/S-00b_TASKLIST.md` (mark T01 = DONE + append Status Log)
- Optionally append: `outputs/decisions-log.md` (CHỈ nếu phát sinh amendment human ack — default skip)

## Forbidden Changes

- KHÔNG touch `docs/` (read-only reference)
- KHÔNG touch `ai-delivery/TASK_OPERATING_SYSTEM.md`
- KHÔNG touch `MASTER_ROADMAP.md` hoặc `MASTER_SLICE_BACKLOG.md` (defer C9 fix to docs maintainer)
- KHÔNG touch `slices/S-00b_BRIEF.md` (frozen ở Phiên 3)
- KHÔNG touch `slices/S-00b_EXECUTION_GUIDE.md`
- KHÔNG patch `02_DATA_MODEL.md` 768 → 512 (C8 defer to docs maintainer)
- KHÔNG patch `06_OBSERVABILITY.md` line 52 + 559 port 3001 → 3002 (C11 defer to docs maintainer)
- KHÔNG patch `PHASE_01_INFRA.md` line 184 `shadcn-ui` → `shadcn` (C10 defer to docs maintainer)
- KHÔNG create files trong `apps/`, `packages/`, `infra/`, `.github/` (out of scope T01)
- KHÔNG `pnpm install` chạy thật (lockfile defer T02+)
- KHÔNG `make up` chạy thật (compose files chưa tồn tại đến T07/T08)

## Acceptance Criteria

- [ ] 8 file root config emit đúng theo PHASE_01_INFRA.md lines 58-110 spec
- [ ] `package.json` valid JSON, scripts đầy đủ, `private: true`, `packageManager: "pnpm@9.x.x"`, không có deps thật (workspace orchestrator only)
- [ ] `pnpm-workspace.yaml` pattern `apps/*` + `packages/*` (plural critical — T02 prereq để resolve `@icp/shared-types`)
- [ ] `tsconfig.base.json` match D-05 spec exactly (target es2022, module esnext, moduleResolution bundler, strict true)
- [ ] `.gitignore` ignore `.env` nhưng KHÔNG ignore `.env.example` (explicit negation `!.env.example`)
- [ ] `.editorconfig` cover TS/JS/JSON/YAML 2-space + Python 4-space + Makefile tab
- [ ] `.env.example` chứa đủ 11 keys (DATABASE_URL, REDIS_URL, KAFKA_BROKERS, JWT_SECRET, 5x OTEL_*, OTEL_SERVICE_NAME, APP_VERSION, 2x VESPA_*, 2x LLM keys, 3x NEXT_PUBLIC_*) per execution guide Section 4.1 block
- [ ] `Makefile` 13 targets (`up`, `down`, `migrate`, `seed`, `vespa:deploy`, `obs:up`, `obs:down`, `logs`, `clean`, `lint`, `test`, `typecheck`, `help` default), `.PHONY` declared, tab-indented (NOT spaces — hard make requirement)
- [ ] `README.md` mention 4 ADR-033/034/035/036 + link `docs/DECISIONS.md`, quickstart `make up && make seed`, repo layout snippet, **explicit note** stack chưa runnable end-to-end cho đến T08
- [ ] Per-DoD evidence quick-check:
  - **DoD-1 (`make up`)** — Makefile target ready, compose paths reference defer (Known Issue documented)
  - **DoD-4 (CI)** — N/A T01 (defer T08)
- [ ] 4 workflow files emit (taskpack, report, review, updated tasklist)
- [ ] No unrelated files changed (no `apps/`, no `packages/`, no `infra/`, no `.github/`)
- [ ] Report Bonus section: nếu phát hiện inconsistency MỚI ngoài C8-C12 → document, KHÔNG silent fix
- [ ] Review verdict per 9 Gates với active/N/A justification (config-only task expected ~4 active gates: Scope, Source, Architecture, Regression; UI/Test/Demo/Contract/Cross-Slice typically N/A trong scaffold task)

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- **Spec ambiguity ngoài 5 pre-approved decisions (D-01 đến D-05) + C12 resolution** — surface to human, không tự decide. Vd:
  - `pnpm@9.x.x` minor version cụ thể không specified (vd 9.0 vs 9.15) → propose `9.15.0` per "latest stable" Phiên 3 D-03 framing, surface if disagree
  - `typescript` version cho devDependencies root → propose `5.6.x` (latest stable 2026 mid), surface if disagree
  - `.editorconfig` Markdown trailing whitespace policy (some teams keep `  ` for line break) → propose `trim_trailing_whitespace = false` for `*.md` only, surface
- **Phát hiện C12 violation trong context được paste** — REJECT, surface user prompt confusion. (Hiện tại không thấy — context clean.)
- **Phát hiện rằng PHASE_01_INFRA.md cấu trúc root contradicts với `00_CONTEXT.md` Section 1** trong nội dung trọng yếu (ngoài đã surface C8-C12) — surface as new conflict trong report Bonus, không silent reconcile.
- **CLIP 512 vs Vespa 8.x technical infeasibility** — N/A scope T01 (chỉ T04/T06 expose), nhưng nếu README touch dimension thì giữ 512 per ADR-036.

## Cross-Slice Integration Check ⭐

**N/A — S-00b T01 là task đầu tiên trong slice S-00b, và S-00b là first scaffold slice sau S-00 audit (audit slice không produce code regression surface).**

Cụ thể:
- S-00 outputs (audit reports) là docs read-only, T01 không touch → no regression
- T01 là root scaffold mới (greenfield) — không có previous code state để regression check
- Downstream tasks T02-T08 sẽ depend on T01 outputs nhưng forward-direction, không backward

Explicit note per workflow convention: vì T01 mở slice S-00b execution, gate này không applicable; no integration check to perform against prior code.

---

## Section bổ sung — Emit order & spot-check pause points

Per execution guide Section 4.1 "Emit order (3 groups)":

| Group | Files | Spot-check focus |
|---|---|---|
| **Group 1** | `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json` | Workspaces pattern correct, D-05 TS config exact, scripts có đủ orchestration |
| **Group 2** | `.gitignore` + `.editorconfig` + `.env.example` | `.env.example` explicit not-ignored, env keys đủ 11+, editorconfig cover Makefile tab |
| **Group 3** | `Makefile` + `README.md` | Makefile tab-indent (verify trực quan), targets đủ, README ADRs mention đúng |

Sau Group 3, emit 4 workflow files (taskpack đã có, report + review + updated tasklist).

---

## Section bổ sung — Cross-check trước finalize

Per execution guide Section 4.1 "Cross-check trước khi finalize":

- [ ] `pnpm-workspace.yaml` pattern `packages/*` (NOT `package/*` singular typo) — T02 prereq
- [ ] Makefile references files chưa tồn tại (`apply.sh`, `deploy.sh`, 2 compose files) — đây OK, T04-T08 sẽ tạo, **MUST document trong report Known Issues**
- [ ] `README.md` mention 4 ADR-033/034/035/036 + link DECISIONS.md path

---

**END OF TASK PACK — chờ human ack scope trước khi sang Bước 2 (implement code).**
