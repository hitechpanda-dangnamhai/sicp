ICP Workflow — Phiên 2: Slice S-00 Repo Reality Check (Q-GATE)

## Context
Phiên 1 đã setup workflow + roadmap + backlog + resolve 4 conflicts (ADR-032/033/034/035 + V008 migration).
Hôm nay execute toàn bộ Slice S-00 (Q-GATE — audit, không code feature).

## Repo state ⭐ CRITICAL
GREENFIELD — chỉ có thư mục docs/, chưa có:
- apps/ (web, gateway, ai, mcp, workers)
- infra/ (docker-compose, vespa, otel, seed)
- packages/shared-types/
- V001__init.sql migration applied (chỉ có spec ở docs, chưa tạo file)
- Postgres / Redis / Vespa / Kafka / OTel collector / Grafana — chưa chạy
- Root configs (package.json, pnpm-workspace.yaml, Makefile, .env.example)

→ Audit là THEORETICAL gap analysis dựa trên PHASE_01_INFRA DoD vs claim greenfield.
→ AI KHÔNG cần bash execute (không có repo thực tế trong sandbox).
→ Output = full Phase 01 setup task list với severity + dependency + recommend next slice.

## Status patches 2026-05-18
Đã commit tất cả 7 patches từ phiên 1:
- ADR-032 (Shopee Postgres + worker, supersedes ADR-008)
- ADR-033 (shadcn/ui + Tailwind v3)
- ADR-034 (Hybrid CSS-only + Framer Motion + canvas-confetti)
- ADR-035 (Zustand + TanStack Query + react-hook-form + Context + useState)
- V008 migration NEW
- Updates trong 01_ARCHITECTURE / 02_DATA_MODEL / PHASE_00_HANDOFF / PHASE_01_INFRA / MASTER_SLICE_BACKLOG

Files upload là BẢN UPDATED, không phải bản gốc trong zip ban đầu.

## Steps to execute (Steps 3-10 per workflow doc)

### Step 3 — Confirm selection
Phiên 1 đã pick S-00 (recommendation từ MASTER_ROADMAP). AI proceed Step 4 không cần re-propose.

### Step 4 — Slice Brief
Output: `slices/S-00_BRIEF.md`

**Template GỐC theo workflow §Step 4 — đầy đủ 8 sections:**
1. Slice Goal (1 câu user-facing outcome)
2. Slice Type (Q-GATE)
3. Method Áp Dụng ⭐ (Checklist Mode per workflow §5.1)
4. Evidence (list file paths + sections cụ thể)
5. Done Means (bullet list tiêu chí done + smoke test pass)
6. Non-goals (những gì KHÔNG làm trong slice này)
7. Dependencies (depends on / blocks)
8. Risks (surface per Rule 7 nếu phát hiện)

### Step 5 — Slice TaskList (Checklist Mode method per workflow §5.1)
Output: `slices/S-00_TASKLIST.md`

⚠️ **Lưu ý workflow §5.1:** Q-GATE = "Checklist Mode — Liệt kê kiểm tra cần thực hiện, không phân task code."
→ "Không phân task code" = không break thành CODING tasks. **Audit tasks ≠ code tasks**, nên grouping 5 audit task packs theo theme hợp lệ (audit grouping, không phải code grouping).

Group 9 DoD items + cross-cutting checks thành 5 audit task packs theo theme:

| Task ID | Scope | DoD items covered |
|---|---|---|
| S00-T01 | Audit Repo Structure & Tooling | DoD-1 (docker-compose), Day 1 (monorepo, pnpm), Day 7 (Makefile, CI) |
| S00-T02 | Audit Services Skeleton | DoD-3 (4 services /health), Day 3-6 (gateway/ai/mcp/web/workers Dockerfiles) |
| S00-T03 | Audit Data Layer | DoD-2 (migrations + seed + behavior_events), DoD-9 (Vespa schema fields) |
| S00-T04 | Audit Observability | DoD-5 (Grafana :3002 datasources), DoD-6 (trace propagation), DoD-7 (Loki logs schema) |
| S00-T05 | Audit Decisions Consistency | Cross-cutting — verify 4 ADRs reflected trong docs, V008 file exists, "Câu hỏi mở" updated, naming conventions |

### Step 6 — Pick task
AI propose order linear: T01 → T02 → T03 → T04 → T05.
Rationale: T01 foundation infrastructure, T02 services depend on T01, T03 data, T04 obs depend on T01-T03, T05 cross-cutting at end.
Human đã confirm proceed linear (no need to re-ask each task).

### Step 7 — Task Packs (5 files)
Output: 
- `taskpacks/S00-T01_AUDIT_REPO_STRUCTURE.md`
- `taskpacks/S00-T02_AUDIT_SERVICES_SKELETON.md`
- `taskpacks/S00-T03_AUDIT_DATA_LAYER.md`
- `taskpacks/S00-T04_AUDIT_OBSERVABILITY.md`
- `taskpacks/S00-T05_AUDIT_DECISIONS_CONSISTENCY.md`

**Template:** Dùng template Task Pack GỐC theo workflow §Step 7 — đầy đủ 10 sections:
1. Task Type (Q-GATE)
2. Objective
3. Read First (Evidence)
4. Scope (ALLOWED to do)
5. Non-goals (NOT doing in this task)
6. Allowed Changes
7. Forbidden Changes
8. Acceptance Criteria
9. Stop Conditions ⭐
10. Cross-Slice Integration Check ⭐

**Q-GATE specifics khi điền template:**

- **Section 8 "Acceptance Criteria"** — list audit checkpoints (không phải code criteria):
  - [ ] Per-DoD finding documented với current state vs expected
  - [ ] Effort estimate (Xx days)
  - [ ] Slice owner identified (S-XX)
  - [ ] Severity classified (P0/P1/P2)

- **Section 9 "Stop Conditions"** — adapted cho audit:
  - Evidence conflict per Rule 7 (docs internal inconsistency)
  - ADR mới cần thiết để resolve gap
  - Cần human decide architecture cho gap còn pending
  - Discover requirement chưa có trong specs

- **Section 10 "Cross-Slice Integration Check"** — N/A vì S-00 là first slice. Note explicit trong template: "N/A — S-00 first slice, no previous slice to regression check."

### Step 8 — Execute audit + Per-task Implementation Report

Vì repo greenfield, audit là THEORETICAL:
- AI compare PHASE_01_INFRA DoD 9 items vs claim GREENFIELD
- Mọi DoD item = TODO/MISSING (severity tuỳ blocker priority)
- KHÔNG dùng bash/view trên repo thực tế (không có target)
- T05 cross-cutting: verify docs internal consistency (read updated docs từ patches)

Output: **5 per-task implementation reports** theo strict workflow convention:
- `reports/S00-T01_REPORT.md`
- `reports/S00-T02_REPORT.md`
- `reports/S00-T03_REPORT.md`
- `reports/S00-T04_REPORT.md`
- `reports/S00-T05_REPORT.md`

**Template:** Implementation Report GỐC theo workflow §Step 8 có 8 sections. Cho audit, adapt 2 sections không applicable, giữ nguyên 6 sections còn lại:

| # | Section gốc | Q-GATE audit adapt |
|---|---|---|
| 1 | Files Changed | → **Audit Performed** (list files reviewed + DoD items checked) |
| 2 | What Was Implemented | → **Findings** (per-DoD with status/current/expected/gap/effort/owner/severity) |
| 3 | Commands Run | ❌ N/A — note rõ "N/A: audit không chạy bash" |
| 4 | Test Results | ❌ N/A — note rõ "N/A: audit không có test code" |
| 5 | Deviations From Task Pack | ✅ Giữ nguyên |
| 6 | Known Issues | ✅ Giữ nguyên |
| 7 | Cross-Slice Integration Check | ✅ Giữ — note "N/A: S-00 first slice" |
| 8 | Recommended Next Step | ✅ Giữ — propose next task hoặc finish suite |

**Bonus section cho Q-GATE:** "Conflicts Surfaced (Rule 7)" — list nếu phát hiện docs internal inconsistency trong khi audit.

### Step 9 — Review per 9 Gates ⭐ — Per-task review

Output: **5 per-task review files** theo strict workflow convention:
- `reviews/S00-T01_REVIEW.md`
- `reviews/S00-T02_REVIEW.md`
- `reviews/S00-T03_REVIEW.md`
- `reviews/S00-T04_REVIEW.md`
- `reviews/S00-T05_REVIEW.md`

**Workflow §Step 9 yêu cầu:** "9 Gates (bắt buộc check hết)" — check đủ 9 gates, không skip.

**3 verdicts gốc per workflow:** PASS / FIX REQUIRED / REJECT.

**Q-GATE specifics:** 5 Gates không applicable cho audit-only slice. Cho mỗi gate không apply, mark **"N/A"** với explanation. Lưu ý: **"N/A" KHÔNG phải verdict thứ 4 ngang hàng PASS/FIX/REJECT** — "N/A" nghĩa là **gate này không applicable cho slice type này**, do đó không có gì để verdict.

| Gate | Q-GATE audit status | Verdict scope |
|---|---|---|
| 1. Scope Gate | ✅ Active | PASS / FIX REQUIRED / REJECT |
| 2. Source Gate | ✅ Active | PASS / FIX REQUIRED / REJECT |
| 3. Architecture Gate | ⚪ N/A | Audit không code → gate không applicable |
| 4. Contract Gate | ⚪ N/A | Audit không bịa API → gate không applicable |
| 5. UI Gate | ⚪ N/A | Audit không tạo UI → gate không applicable |
| 6. Test Gate | ⚪ N/A | Audit không có test code → gate không applicable |
| 7. Regression Gate | ✅ Active | PASS / FIX REQUIRED / REJECT |
| 8. Demo Gate | ✅ Active | PASS / FIX REQUIRED / REJECT |
| 9. Cross-Slice Gate | ⚪ N/A | S-00 first slice → gate không applicable |

→ **4 Gates active + 5 Gates N/A.** Mỗi review file:
- Document explicit status cho cả 9 gates (không skip)
- Verdict overall (PASS/FIX/REJECT) cho task — tổng hợp từ 4 active gates

### Step 10 — Update tasklist + Consolidated final report

Output:
1. **Update** `slices/S-00_TASKLIST.md` mark tasks DONE
2. **Create** `reports/S00-REPORT.md` ⭐ — **consolidated audit report cuối cùng** (synthesize từ 5 per-task reports). Đây là **findings file quan trọng nhất** cho human review.

**Convention note:** `S00-REPORT.md` (consolidated, slice-level) song song với 5 `S00-TXX_REPORT.md` (per-task) — không conflict, cả 2 đều có giá trị riêng:
- Per-task reports: granular audit trail, dùng để review từng task
- Consolidated report: executive summary + cross-task synthesis, dùng để decide next slice

**`reports/S00-REPORT.md` structure:**

```markdown
# Audit Report — S-00 Repo Reality Check (Consolidated)

## Executive Summary
Repo state: GREENFIELD → 0/9 DoD items met.
Total effort estimate to reach Phase 01 DoD: ~X days.
Recommend next slice: <S-01 / S-02 / S-00b>

## Per-DoD Findings
[Consolidated synthesis từ 5 per-task reports — không duplicate, chỉ executive view]

## Gap List by Severity
### P0 BLOCKER
### P1 HIGH
### P2 MEDIUM

## Conflicts Surfaced (Rule 7)
[Nếu phát hiện docs internal inconsistency]

## Recommended Next Steps
### Option A: Skip S-00b, proceed S-01 + S-02 parallel
### Option B: Insert S-00b foundation scaffold first
My recommendation: <Option X với rationale>

## Effort Estimate Per Phase 01 Day (Day 1-7)
| Day | Tasks | Effort | Blocker? |

## Decisions Consistency Check (from T05)
- ADR-032 reflected: ✅ / ❌
- ADR-033 reflected: ✅ / ❌
- ADR-034 reflected: ✅ / ❌
- ADR-035 reflected: ✅ / ❌
- V008 file exists: ✅ / ❌
- "Câu hỏi mở" updated: ✅ / ❌
- Naming conventions documented: ✅ / ❌

## Reference Trail
- Per-task reports: reports/S00-T01_REPORT.md ... S00-T05_REPORT.md
- Per-task reviews: reviews/S00-T01_REVIEW.md ... S00-T05_REVIEW.md
- Task packs: taskpacks/S00-T01_*.md ... S00-T05_*.md
- Slice brief: slices/S-00_BRIEF.md
```

## Outputs cuối phiên (13 files total)

```
slices/                                         (2 files)
  S-00_BRIEF.md
  S-00_TASKLIST.md (updated với DONE status sau Step 10)

taskpacks/                                      (5 files)
  S00-T01_AUDIT_REPO_STRUCTURE.md
  S00-T02_AUDIT_SERVICES_SKELETON.md
  S00-T03_AUDIT_DATA_LAYER.md
  S00-T04_AUDIT_OBSERVABILITY.md
  S00-T05_AUDIT_DECISIONS_CONSISTENCY.md

reports/                                        (5 per-task + 1 consolidated = 6 files)
  S00-T01_REPORT.md
  S00-T02_REPORT.md
  S00-T03_REPORT.md
  S00-T04_REPORT.md
  S00-T05_REPORT.md
  S00-REPORT.md ⭐ (consolidated — findings file quan trọng nhất)

reviews/                                        (5 files — per workflow strict convention)
  S00-T01_REVIEW.md
  S00-T02_REVIEW.md
  S00-T03_REVIEW.md
  S00-T04_REVIEW.md
  S00-T05_REVIEW.md
```

**Total: 18 files** (2 slice + 5 task packs + 6 reports + 5 reviews)

## Constraints (PHẢI follow per workflow doc)

- Follow 7 Rules trong `.ai-delivery/TASK_OPERATING_SYSTEM.md`
- **Rule 1**: AI propose recommend next slice, human chốt ở phiên 3
- **Rule 2**: KHÔNG plan chi tiết task của slice tiếp theo trong audit
- **Rule 3**: Mọi finding có evidence (file path + section/line)
- **Rule 4**: Mỗi audit task có implementation report reviewable + per-task review
- **Rule 5**: KHÔNG decide architecture changes — surface gaps only
- **Rule 7**: Surface conflicts nếu phát hiện docs internal inconsistency
- KHÔNG code feature mới — Q-GATE audit-only
- KHÔNG cần bash/view repo (không có repo thực)
- **Slice Brief:** 8 sections per workflow §Step 4 template
- **Task Pack:** 10 sections per workflow §Step 7 template (gốc), Q-GATE chỉ adapt nội dung Acceptance Criteria + Stop Conditions + Cross-Slice = N/A
- **Implementation Report:** 8 sections per workflow §Step 8 template; Q-GATE adapt sections 1+2 (Audit Performed + Findings), mark N/A sections 3+4 (Commands Run + Test Results), giữ nguyên 4 sections còn lại
- **9 Gates Review:** Check ĐỦ 9 Gates per workflow §Step 9. 4 active (1, 2, 7, 8) verdict PASS/FIX/REJECT; 5 N/A (3, 4, 5, 6, 9) note explicit "không applicable cho Q-GATE", không phải verdict thứ 4
- **Naming convention:** Strict per workflow Section 13 — `reports/SXX-TYY_REPORT.md` per task + `reviews/SXX-TYY_REVIEW.md` per task. Consolidated `S00-REPORT.md` thêm ngoài convention, dùng cho executive summary.
