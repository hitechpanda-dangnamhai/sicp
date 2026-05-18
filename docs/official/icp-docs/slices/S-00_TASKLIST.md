# Current Slice Task List — S-00 Repo Reality Check

> **Method:** Checklist Mode (per workflow §5.1 — Q-GATE slice type)
> **Status:** ACTIVE
> **Ordering:** Linear T01 → T02 → T03 → T04 → T05 (human đã confirm proceed linear)
> **Rationale ordering:** T01 foundation (repo+tooling), T02 services depend on T01, T03 data layer parallel, T04 observability depends on T01+T02 boots, T05 cross-cutting decisions consistency at end (synthesize after task-level findings)

## Task Table

| ID | Task Name | Type | Priority | Depends On | Output | Status |
|---|---|---|---|---|---|---|
| S00-T01 | Audit Repo Structure & Tooling | Q-GATE | P0 | none | `taskpacks/S00-T01_AUDIT_REPO_STRUCTURE.md` → `reports/S00-T01_REPORT.md` → `reviews/S00-T01_REVIEW.md` | DONE |
| S00-T02 | Audit Services Skeleton | Q-GATE | P0 | T01 | `taskpacks/S00-T02_AUDIT_SERVICES_SKELETON.md` → `reports/S00-T02_REPORT.md` → `reviews/S00-T02_REVIEW.md` | DONE |
| S00-T03 | Audit Data Layer | Q-GATE | P0 | T01 | `taskpacks/S00-T03_AUDIT_DATA_LAYER.md` → `reports/S00-T03_REPORT.md` → `reviews/S00-T03_REVIEW.md` | DONE |
| S00-T04 | Audit Observability | Q-GATE | P0 | T01, T02, T03 | `taskpacks/S00-T04_AUDIT_OBSERVABILITY.md` → `reports/S00-T04_REPORT.md` → `reviews/S00-T04_REVIEW.md` | DONE |
| S00-T05 | Audit Decisions Consistency | Q-GATE | P1 | T01-T04 (synthesis) | `taskpacks/S00-T05_AUDIT_DECISIONS_CONSISTENCY.md` → `reports/S00-T05_REPORT.md` → `reviews/S00-T05_REVIEW.md` | DONE |

## DoD Coverage Matrix

| DoD Item (from PHASE_01_INFRA.md) | Covered by Task |
|---|---|
| DoD-1: `make up` khởi động app + obs stack | S00-T01 (Makefile, compose files) + S00-T04 (obs stack content) |
| DoD-2: Migrations + seed + `behavior_events` | S00-T03 |
| DoD-3: 4 services `/health` responsive | S00-T02 |
| DoD-4: CI pipeline (lint + test) | S00-T01 |
| DoD-5: `apps/web` "ICP loaded" page | S00-T02 |
| DoD-6: Grafana :3002 + 3 datasources auto-provisioned | S00-T04 |
| DoD-7: Trace propagation gateway → ai → mcp | S00-T04 |
| DoD-8: Loki logs schema (`service`, `trace_id`, `message`) | S00-T04 |
| DoD-9: Vespa schema with `text_embedding`, `image_embedding`, behavioral signals | S00-T03 |
| Cross-cut: ADR-032/033/034/035 reflected, V008 exists, "Câu hỏi mở" updated | S00-T05 |

## Consolidated Outputs

After all 5 tasks DONE:
- `reports/S00-REPORT.md` ⭐ — **consolidated executive audit report** (synthesize từ 5 per-task reports)

## Status Log

- 2026-05-18 — All 5 tasks executed in single pass (audit-only, no code).
- 2026-05-18 — Step 10 update: T01-T05 marked DONE; consolidated `S00-REPORT.md` produced.

---

**Reference:**
- Slice Brief: `slices/S-00_BRIEF.md`
- Workflow: `docs/workflow/ICP_WORKFLOW_FINAL.md` §5.1 (Checklist Mode), §5.5 (Task List Format)
- Rules: `ai-delivery/TASK_OPERATING_SYSTEM.md`
