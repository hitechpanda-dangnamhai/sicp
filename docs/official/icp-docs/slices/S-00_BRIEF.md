# Slice Brief — S-00 Repo Reality Check

## Slice Goal

Audit hiện trạng repo so với `PHASE_01_INFRA.md` Definition of Done (9 items), surface tất cả gap với severity + effort + owner; output ra báo cáo executive đủ để human chốt thứ tự slice tiếp theo (S-01 / S-02 / chèn S-00b foundation scaffold).

## Slice Type

**Q-GATE** (Quality Gate — checklist audit, không code feature)

## Method Áp Dụng ⭐

**Checklist Mode** (per workflow §5.1 Method Selection Matrix).

Cụ thể: liệt kê 9 DoD items từ `PHASE_01_INFRA.md` + cross-cutting checks (Phase 01 Day 1-7 tasks + ADR consistency) → group thành **5 audit task packs** theo theme (không phải task code). "Không phân task code" của Checklist Mode không cấm grouping audit checkpoints theo theme — đây là audit grouping, không phải code grouping.

| Task ID | Theme | DoD items covered |
|---|---|---|
| S00-T01 | Audit Repo Structure & Tooling | DoD-1 (`make up` boots), Day 1 (monorepo, pnpm, shared-types), Day 7 (Makefile, CI, README) |
| S00-T02 | Audit Services Skeleton | DoD-3 (4 services `/health`), DoD-5 partial (`apps/web` "ICP loaded"), Day 3-6 (gateway/ai/mcp/web/workers Dockerfiles) |
| S00-T03 | Audit Data Layer | DoD-2 (migrations + seed + `behavior_events`), DoD-9 (Vespa schema fields incl. `text_embedding`, `image_embedding`, behavioral signals) |
| S00-T04 | Audit Observability | DoD-6 (Grafana :3002 + 3 datasources auto-provisioned), DoD-7 (trace propagation `/health` → Tempo), DoD-8 (Loki logs schema: `service`, `trace_id`, `message`) |
| S00-T05 | Audit Decisions Consistency | Cross-cutting — verify ADR-032/033/034/035 reflected in docs, V008 file exists, "Câu hỏi mở" updated trong `PHASE_00_HANDOFF.md` |

## Evidence

**Primary phase spec (priority 4 per Rule 7):**
- `docs/phases/PHASE_01_INFRA.md` — "Definition of Done" (9 items, lines 8-16); "Tasks ordering Day 1-7" (lines 113-228); "Cấu trúc thư mục root" (lines 58-110); "docker-compose.yml services" table (lines 22-32); "docker-compose.observability.yml" table (lines 36-42)

**General architecture docs (priority 5):**
- `docs/00_CONTEXT.md` — tech stack baseline
- `docs/01_ARCHITECTURE.md` line 205-206 — Shopee mock reference per ADR-032 (verify ADR-032 reflected)
- `docs/02_DATA_MODEL.md` lines 416, 432-542 — migration numbering, V008 ADR-032 reference, `shopee_prices_mock` schema
- `docs/06_OBSERVABILITY.md` lines 171-220 — log schema (`service`, `trace_id`, `message`), trace propagation §419-421
- `docs/07_BEHAVIOR_LOGS.md` lines 148-178 (`behavior_events` table DDL), 197-198 (`impressions_7d`, `clicks_7d` Vespa fields), 269 (event examples)
- `docs/05_CODING_CONVENTIONS.md` — naming conventions (cần verify T05)

**Recent ADRs (priority 2):**
- `docs/DECISIONS.md` ADR-032 (line 283) — Shopee Postgres + worker, supersedes ADR-008
- `docs/DECISIONS.md` ADR-033 (line 320) — shadcn/ui + Tailwind v3
- `docs/DECISIONS.md` ADR-034 (line 363) — Hybrid CSS-only + Framer Motion + canvas-confetti
- `docs/DECISIONS.md` ADR-035 (line 410) — Zustand + TanStack Query + react-hook-form + Context + useState

**Phase handoff (priority 3):**
- `docs/handoff/PHASE_00_HANDOFF.md` line 427-433 — "Câu hỏi mở" updated với 3 checkmarks ADR-033/034/035

**Migration files (artifacts):**
- `infra/migrations/V002__product_enrichment.sql`, `V003__insights.sql`, `V005__payment_metadata.sql`, `V006__analytics_aggregations.sql`, `V008__shopee_prices_mock.sql` — committed; V001/V004/V007 NOT present (V001 foundational missing; V004/V007 intentionally skipped per `docs/09_FIELD_AUDIT.md` line 312-315)

**Existing repo files:**
- `docs/` tree only (per context: greenfield — no `apps/`, no `docker-compose.yml`, no `Makefile`, no root `package.json`)

**Master planning artifacts:**
- `MASTER_ROADMAP.md` — Stage 1 outputs (lines 41-49)
- `MASTER_SLICE_BACKLOG.md` lines 38-56 — S-00 spec, blocks S-01/S-02

**Workflow + rules:**
- `docs/workflow/ICP_WORKFLOW_FINAL.md` §Step 4-10 (lines 361-740)
- `ai-delivery/TASK_OPERATING_SYSTEM.md` — 7 Rules

## Done Means

- [ ] 5 task packs created (S00-T01 → S00-T05) theo template 10 sections workflow §Step 7
- [ ] 5 per-task implementation reports (`reports/S00-T0X_REPORT.md`) với audit-adapted template (Audit Performed + Findings + Deviations + Known Issues + Cross-Slice + Recommended Next)
- [ ] 5 per-task reviews (`reviews/S00-T0X_REVIEW.md`) với 9 Gates explicit (4 active + 5 N/A)
- [ ] Mỗi DoD item (9 items) được documented với: current state vs expected vs gap vs effort estimate vs slice owner vs severity (P0/P1/P2)
- [ ] Consolidated report `reports/S00-REPORT.md` với: executive summary, gap list by severity, recommended next steps (Option A skip foundation scaffold / Option B insert S-00b), effort estimate per Day 1-7, decisions consistency check (T05 synthesis), reference trail
- [ ] Conflicts surfaced (Rule 7) nếu phát hiện docs internal inconsistency
- [ ] `slices/S-00_TASKLIST.md` updated với status DONE sau Step 10
- [ ] **Smoke test pass (audit-adapted):** 9/9 DoD items có finding rõ ràng, không có item "không biết status" — mỗi item phải có verdict MET / TODO / PARTIAL

## Non-goals

- KHÔNG code feature mới (Q-GATE audit-only per Rule 5)
- KHÔNG run bash/view trên repo thực (không có repo target — audit là theoretical gap analysis dựa trên claim greenfield)
- KHÔNG tự decide architecture changes — chỉ surface gap (per Rule 5)
- KHÔNG plan chi tiết tasks cho S-01 / S-02 / S-00b (per Rule 2 — chỉ active slice mới có tasklist chi tiết)
- KHÔNG fix gap trong slice này (defer sang S-00b nếu human chốt, hoặc cho slice owner identified)
- KHÔNG re-litigate 4 ADRs đã commit (ADR-032/033/034/035) — chỉ verify reflection trong docs

## Dependencies

- **Depends on slice:** (none — S-00 là first slice)
- **Blocks slice:** S-01 UI Foundation, S-02 Runtime Foundation (per `MASTER_SLICE_BACKLOG.md` line 48). Rationale: nếu repo state khác PHASE_01 DoD đáng kể, có thể cần thêm slice S-00b để fill gap trước Stage 1.

## Risks

**R1 — Greenfield assumption có thể partial false** (Rule 7 conflict potential)
- Prompt context khẳng định greenfield: "chỉ có thư mục docs/, chưa có apps/ infra/ packages/"
- Nhưng `infra/migrations/` thực tế có 5 file SQL committed (V002/V003/V005/V006/V008)
- → Resolution: treat migrations như "spec artifacts committed but NOT applied" (vì không có Postgres running). V001 (foundational init) thiếu file — biggest data gap. Document explicit trong T03.

**R2 — Audit không có repo target để verify**
- AI không chạy bash, không view repo thực
- Mọi finding = "expected per spec vs claim greenfield = MISSING"
- → Acceptable per prompt: "AI KHÔNG cần bash execute. Output = full Phase 01 setup task list với severity + dependency"

**R3 — Tasklist effort estimate chỉ rough**
- Không có team velocity baseline → effort estimate theo `PHASE_01_INFRA.md` Day 1-7 mapping (1 ngày = 1 effort unit)
- → Acceptable cho audit phase; human có thể recalibrate

**R4 — ADR reflection có thể partial trong docs khác**
- Đã verify ADR-032/033/034/035 trong DECISIONS.md, PHASE_00_HANDOFF.md "Câu hỏi mở", PHASE_01_INFRA.md Day 6
- Chưa exhaustive grep mọi doc → T05 sẽ check comprehensive

**R5 — Migration numbering gap V004/V007**
- V004 (promotions) + V007 (media_uploads) intentionally skipped per `docs/09_FIELD_AUDIT.md` line 312-315
- → Document explicit trong T03 để tránh future confusion khi thấy gap

**R6 — Recommended next slice là Rule 1 AI proposal, không phải decision**
- Per Rule 1: AI propose, human chốt
- Consolidated report sẽ list Option A vs Option B với rationale, không tự quyết
