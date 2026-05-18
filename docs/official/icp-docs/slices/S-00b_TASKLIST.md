# Current Slice Task List — S-00b Foundation Scaffold

> **Method:** CDP — Capability-Driven Planning (per workflow §5.3 — P-CAP slice type)
> **Status:** ACTIVE (T01 DONE, T02-T08 TODO)
> **Ordering:** Linear T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08
> **Rationale ordering:** Dependency chain — root scaffold first (T01) enables `pnpm install` for everything downstream; shared packages (T02) needed before service builds reference them; service Dockerfile stubs (T03) needed before compose can resolve build contexts (T08); migrations chain (T04) independent and can land anytime after T01; seed (T05) needs V001 schema (T04); Vespa schema (T06) independent technically but logically grouped with data layer; obs stack (T07) independent but landed before T08 so compose file (T08 deliverable) has obs services to reference network-wise; final compose stitch + web init + CI (T08) stitches everything for DoD-1/5/6/9 smoke test.

## Task Table

| ID | Task Name | Type | Priority | Depends On | Gap IDs Covered | Output | Status |
|---|---|---|---|---|---|---|---|
| **S00b-T01** | Repo Root Scaffold | P-CAP | P0 | none | G-01, G-02, G-05, G-06, G-20, G-21, G-26, G-27 | `taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md` → `reports/S00b-T01_REPORT.md` → `reviews/S00b-T01_REVIEW.md` + actual files (root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.env.example`, `Makefile`, `README.md`) | **DONE** |
| **S00b-T02** | Shared Packages & Workers Skeleton | P-CAP | P0 | T01 | G-07, G-28 (shell) | `taskpacks/S00b-T02_SHARED_PACKAGES.md` → reports/reviews + actual files (`packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/src/index.ts` empty barrel, `apps/workers/package.json`, `apps/workers/src/index.ts` skeleton stub) | TODO |
| **S00b-T03** | Service Dockerfile Stubs (gateway/ai/mcp/web) | P-CAP | P0 | T01 | G-08 stub, G-09 stub, G-10 stub, G-11 stub (Dockerfile only) | `taskpacks/S00b-T03_SERVICE_DOCKERFILE_STUBS.md` → reports/reviews + `apps/gateway/Dockerfile`, `apps/ai/Dockerfile`, `apps/mcp/Dockerfile`, `apps/web/Dockerfile` (each: minimal HEALTHCHECK-only image, no business logic) + per-service `package.json` or `pyproject.toml` stub to allow build context resolve | TODO |
| **S00b-T04** | Database Migrations — V001 Init + Chain Apply Script | P-CAP | P0 | T01 | G-12 | `taskpacks/S00b-T04_DB_MIGRATIONS_V001.md` → reports/reviews + `infra/migrations/V001__init.sql` (foundational base — users, sessions, products, events, policies, action_cards, orders, order_items, transactions, behavior_events partitioned + 3 month partitions, indexes) + `infra/migrations/apply.sh` (bash runner walks V*.sql alphabetically, records to schema_migrations table, **CLIP 512 dim per ADR-036 — surface 768 vs 512 conflict vs 02_DATA_MODEL.md**) | TODO |
| **S00b-T05** | Seed Data Scaffold | P-CAP | P0 | T04 | G-13 | `taskpacks/S00b-T05_SEED_DATA.md` → reports/reviews + `infra/seed/users.json` (5 users per `00_CONTEXT.md` Section 9), `infra/seed/products.json` (50 products: 10 categories × 5 products), `infra/seed/policies.json` (mock policies for action cards), `infra/seed/seed.ts` (bcrypt password hash + insert + idempotent) | TODO |
| **S00b-T06** | Vespa Schema (product.sd + services.xml) | P-CAP | P0 | T01 | G-14 | `taskpacks/S00b-T06_VESPA_SCHEMA.md` → reports/reviews + `infra/vespa/schemas/product.sd` (CLIP 512 per ADR-036 + behavioral signal fields per 07_BEHAVIOR_LOGS), `infra/vespa/services.xml` (single-container dev cluster), `infra/vespa/deploy.sh` (deploy script for `make up`) | TODO |
| **S00b-T07** | Observability Stack Configs | P-CAP | P0 | T01 | G-04, G-15, G-16, G-17, G-29 | `taskpacks/S00b-T07_OBSERVABILITY_STACK.md` → reports/reviews + `infra/docker-compose.observability.yml` (otel-collector, loki, tempo, prometheus, grafana), `infra/otel/collector-config.yaml`, `infra/otel/grafana-datasources.yml`, `infra/otel/prometheus.yml`, `infra/otel/tempo.yaml`, `infra/otel/loki-config.yaml`, `infra/otel/grafana-dashboards/.gitkeep` (placeholder dir) | TODO |
| **S00b-T08** | App Compose + Web Placeholder + CI Workflow | P-CAP | P0 | T01-T07 | G-03, G-11 (web partial: init + Tailwind v3 + shadcn + `<PhoneFrame>` placeholder), G-22, G-23 | `taskpacks/S00b-T08_COMPOSE_WEB_CI.md` → reports/reviews + `infra/docker-compose.yml` (app stack: postgres, redis, redpanda, vespa, gateway, ai, mcp, web), `apps/web/` Next.js 14 init (package.json, next.config.js, tsconfig.json, tailwind.config.ts, postcss.config.js, components.json shadcn, app/layout.tsx, app/page.tsx with `<PhoneFrame>` "ICP loaded", globals.css with MoMo tokens, components/icp/PhoneFrame.tsx), `.github/workflows/ci.yml` (lint + test placeholder) | TODO |

## DoD Coverage Matrix (per PHASE_01_INFRA.md Definition of Done)

| DoD Item | S-00b Coverage | Verdict After S-00b |
|---|---|---|
| **DoD-1** `make up` khởi động toàn bộ app stack + observability stack | T01 (Makefile) + T03 (service Dockerfiles for build context) + T07 (obs compose) + T08 (app compose) | **PASS expected** — stack boots end-to-end |
| **DoD-2** Migrations + seed + behavior_events | T04 (V001 + apply.sh + V001→V008 chain) + T05 (seed.ts) | **PASS expected** — `make migrate && make seed` clean |
| **DoD-3** 4 services `/health` responsive | T03 stubs (HEALTHCHECK-only echo server, NOT real /health controllers) | **PARTIAL** — stubs respond to /health literal; controllers + business logic → S-02 |
| **DoD-4** CI pipeline (lint + test) | T08 (basic `.github/workflows/ci.yml` lint + test rỗng) | **PASS expected (literal)** — empty test OK per DoD wording |
| **DoD-5** `apps/web` "ICP loaded" page | T08 (Next.js init + `<PhoneFrame>` placeholder with "ICP loaded" text) | **PASS expected** |
| **DoD-6** Grafana :3002 + 3 datasources auto-provisioned | T07 (grafana-datasources.yml + obs compose Grafana service) | **PASS expected** |
| **DoD-7** Trace propagation gateway → ai → mcp | T07 (collector-config.yaml) only — per-service SDK init defer S-02 | **TODO** — collector ready but services don't emit traces yet |
| **DoD-8** Loki logs schema (`service`, `trace_id`, `message`) | T07 (loki-config.yaml) only — logger helpers defer S-02 | **TODO** — Loki ready but services don't emit logs yet |
| **DoD-9** Vespa schema with text_embedding, image_embedding, behavioral fields | T06 (product.sd with CLIP 512 + 11 behavioral fields per 07_BEHAVIOR_LOGS) | **PASS expected** — schema deployable |

**Summary: 5/9 PASS expected after S-00b (DoD-1, 2, 4, 5, 6, 9), 1 PARTIAL (DoD-3), 2 TODO (DoD-7, DoD-8) — matches user prompt scope confirmation.**

Wait — recount: PASS = DoD-1, 2, 4, 5, 6, 9 = **6 items**. PARTIAL = DoD-3. TODO = DoD-7, DoD-8. That's 6 + 1 + 2 = 9. ✓

Note vs user prompt ("Sau khi merge S-00b, gõ `make up && make seed` PASS được 5/9 DoD"): user prompt lists 5 explicitly (DoD-1, 2, 5, 6, 9) — leaves out DoD-4 (CI pipeline lint+test) which is silently includable via `.github/workflows/ci.yml` basic. T08 covers it. **Propose to human:** include DoD-4 as 6th PASS, or scope DoD-4 out of S-00b (CI workflow is small, ~0.25 day per S00-REPORT line 121). AI propose include; surface to confirm.

## Consolidated Outputs

After all 8 tasks DONE:
- `reports/S00b-REPORT.md` ⭐ — consolidated executive report (per-task synthesis, gap-closed list, DoD verdict, recommended next slice S-01 vs S-02 parallel feasibility)
- `reviews/S00b_REVIEW.md` — consolidated review meta (lesson learned từ Phiên 2 pattern)

## Status Log

- 2026-05-18 — Tasklist proposed (Step 5 output). Awaiting Step 6 Confirm-and-Lock from human.
- (To be appended during Phase 3-4 execution per Step 10.)
- **2026-05-18 (Phiên 4) — S00b-T01 DONE.** Emit 8 root config files (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.env.example`, `Makefile`, `README.md`) + 4 workflow files (taskpack/report/review/this tasklist update). Verdict: PASS per `reviews/S00b-T01_REVIEW.md` (5/5 active gates pass, 4 N/A justified). 1 deviation surfaced: Makefile `vespa:deploy` → `vespa-deploy` per GNU Make grammar (docs maintainer note). Bonus section: no NEW conflicts beyond C8-C12. Next: T02 Shared Packages & Workers Skeleton.

## Risk Notes Specific To Tasklist Ordering

- **T03 service Dockerfile stubs can land in parallel with T04/T05/T06** if human elects to skip strict linear and parallelize. Linear ordering is conservative default per workflow §5.5 example. AI propose linear; human can override to allow parallel batches in Step 6 ack.
- **T02 (shared-types empty package) is logically Day 1 but separated from T01** because spinning a workspace package is a discrete review unit (package.json + tsconfig.json + barrel export). Alternative: fold into T01 → 7 tasks instead of 8. AI propose 8 separation for review clarity; surface to human.
- **T08 is the biggest single task** (Next.js init with full ADR-033/034/035 LOCKED stack + compose + CI). Could split T08 into T08a (compose + CI) and T08b (web init) → 9 tasks. AI propose keep as 1 task (T08) for coherence — web init has tight dep on compose (Dockerfile references web port 3000, compose wires it); splitting adds review overhead without coherence benefit. Surface to human if disagree.

---

**Reference:**
- Slice Brief: `slices/S-00b_BRIEF.md`
- Workflow: `docs/workflow/ICP_WORKFLOW_FINAL.md` §5.3 (CDP method), §5.5 (Task List Format), §Step 6 (Confirm-and-Lock), §Step 7-10 (per-task iteration)
- Rules: `ai-delivery/TASK_OPERATING_SYSTEM.md`
- Source gap list: `s00-outputs/reports/S00-REPORT.md` Section 5 Option B (lines 194-241), Section 2 Gap List (lines 87-144)
- ADR-036 image embedding dim: `docs/DECISIONS.md` line 472 (CLIP ViT-B/32 512 dim — drives T04 V001 + T06 Vespa schema)
