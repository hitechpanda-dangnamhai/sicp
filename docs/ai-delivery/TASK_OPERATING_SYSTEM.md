# Task Operating System — 7 Rules (LOCKED)

> **Tên đầy đủ:** ICP Task Operating System
> **Version:** 1.0 (lock từ Step 0)
> **Date:** 2026-05-18
> **Status:** ⭐ ACTIVE — Đây là "luật chơi" cho mọi step của workflow ICP. Lock vào git
> trước khi bắt đầu code, không sửa trừ khi cần upgrade workflow.
>
> **Source:** `docs/workflow/ICP_WORKFLOW_FINAL.md` v1.3, Section 3 (Bảy Rules Bất Biến)
>
> **Mục đích:** Khi mở conversation mới với AI (Claude/agent code), paste hoặc reference
> file này TRƯỚC tiên. AI phải đọc + acknowledge 7 rules này trước khi propose bất kỳ
> task/code nào.

---

## Rule 1 — Human owns priority

AI can propose. Human approves.

**Áp dụng cụ thể:**
- **Step 1 (Roadmap):** AI tạo draft, human chốt thứ tự Stages
- **Step 3 (Select Slice):** AI đề xuất 1-3 slices nên làm tiếp dựa trên dependency, human chọn 1
- **Step 6 (Pick Task):** AI gợi ý task tiếp theo trong slice, human OK hoặc đổi
- **Step 9 (Review):** AI verdict PASS/FIX/REJECT, human decide merge

**Anti-pattern (CẤM):**
- AI tự quyết slice nào làm trước
- AI tự merge code khi review chưa pass

---

## Rule 2 — No full detailed backlog upfront

Only create detailed tasklist for the current slice.

**Lý do:** Tasklist chi tiết sẽ stale sau 1-2 slices (code thay đổi assumption, ADR mới, mockup edge case). Plan chi tiết 8 intents từ đầu = waste.

**Exception:** Cross-slice dependency identify sớm OK (vd "S-06 cần S-05 cart done"), nhưng KHÔNG breakdown sub-tasks của slice chưa active.

**Áp dụng:**
- `MASTER_SLICE_BACKLOG.md` chỉ list slice ID + name + goal + type + priority (1-2 dòng/slice)
- `slices/S-XX_TASKLIST.md` chỉ tạo khi slice đã active (sau Step 3 select)

---

## Rule 3 — Every task must have evidence

Mọi task phải có evidence cụ thể từ docs hoặc mockup hoặc repo state.

**Evidence sources (theo priority Rule 7):**
- Mockup HTML (visual contract — priority 1)
- ADRs trong `DECISIONS.md` (priority 2)
- Phase handoff retrospective `docs/handoff/PHASE_0X_HANDOFF.md` (priority 3)
- Phase planning specs `docs/phases/PHASE_0X_*.md` (priority 4)
- General specs `00_CONTEXT.md`, `01_ARCHITECTURE.md`, `04_INTENT_SPECS.md` (priority 5)
- Repo state (actual code — priority 6)

**Áp dụng:**
- **Slice Brief (Step 4)** MUST list evidence sources
- **Task Pack (Step 7)** MUST có section "Read First" với 3-8 file references

**Anti-pattern (CẤM):**
- "Tôi nghĩ nên làm X..." mà không reference doc/mockup
- Cite chung chung "theo best practice" thay vì cite file cụ thể

---

## Rule 4 — Every code task must be reviewable

Each code task must produce:
- **Changed files** (path list)
- **Command output** (build / test / lint logs)
- **Tests** (smoke at minimum)
- **Known issues** (tự khai báo, không giấu)

**Áp dụng:**
- Step 8 Implementation Report (`reports/SXX-TYY_REPORT.md`) là MANDATORY template
- Không có report → review verdict tự động FIX

**Anti-pattern (CẤM):**
- Ship code không có test (kể cả smoke)
- Ẩn TypeScript errors bằng `// @ts-ignore` mà không note
- Skip `pnpm openapi:sync` sau đổi DTO

---

## Rule 5 — Claude Code cannot decide architecture changes

AI must stop and report, không tự ý change architecture.

**Trường hợp STOP (BẮT BUỘC report + đợi human approve):**
- Cần thay đổi DB schema không có trong scope slice
- Cần đổi naming convention (xem `00_CONTEXT.md` Section 5)
- Cần thêm dependency mới chưa approved (vd thêm package npm/pip)
- Cần đổi pattern đã LOCKED (vd Cross-Intent Patterns 12 patterns trong `PHASE_00_CROSS_INTENT_PATTERNS.md`)
- Cần đổi tech stack (vd swap Vespa sang Elasticsearch)
- Phát hiện ADR mới cần thiết → propose, log status="Proposed", đợi → "Accepted"

**Áp dụng:**
- Task Pack (Step 7) có section "Stop Conditions" bắt buộc với checklist
- Nếu AI hit STOP condition giữa code → break, write status, ask

---

## Rule 6 — MOCKUP IS LAW ⭐

Mọi pattern xuất hiện trong mockup PHẢI build, dù không nằm trong intent specs hoặc phase specs.

**Lý do:** Mockup = visual contract demo cho ban giám khảo hackathon. Bỏ pattern wow = mất impact demo.

**Áp dụng:**
- **Slice loại H-UI (S-01):** KHÔNG được skip wow components dù frequency thấp
  - Vd: `<HeroInsightCard>` chỉ 4 mockup → vẫn build
  - Vd: `<DrillChipRow>` chỉ Intent 07 → vẫn build
- **Slice loại V-SLICE:** Khi conflict mockup vs phase spec, mockup wins
  - Vd: Intent 05 Cart full-screen (mockup) vs Cart sidebar (PHASE_04 spec) → mockup wins (ADR-05-01)
  - Vd: Intent 06 OTP 3DS state G (mockup) chưa có trong PHASE_04 spec → vẫn build, expand spec

**Exception duy nhất:** Pure utility (animation keyframe, layout helper CSS) → CSS only, không cần wrap component.

**Áp dụng đặc biệt cho 75 HTML mockups đã LOCKED ở Phase 00:**
- Mọi state hiện trong 75 HTML phải có code React tương ứng (component hoặc page state)
- Không "improve" visual của mockup mà không update mockup + Cross-Intent patterns

---

## Rule 7 — Evidence Hierarchy (when conflict)

When evidence sources conflict, priority order (HIGH → LOW):

| Priority | Source | Loại evidence | Note |
|---|---|---|---|
| **1** | Mockup HTML | Visual contract | per Rule 6 MOCKUP IS LAW |
| **2** | Recent ADRs | `DECISIONS.md` mới nhất | vd ADR-031 Google Trends |
| **3** | Phase handoff retrospective | `docs/handoff/PHASE_0X_HANDOFF.md` | "Đã làm gì" — fact |
| **4** | Phase planning specs | `docs/phases/PHASE_0X_*.md` | "Sẽ làm gì" — prospective, có thể outdated bởi mockup |
| **5** | General specs | `00_CONTEXT`, `01_ARCHITECTURE`, `04_INTENT_SPECS`, `02_DATA_MODEL`, etc. | |
| **6** | Repo state | Actual code | |

**AI MUST surface conflicts, NOT silently pick.**

**Phân biệt priority 3 vs 4:**
- Priority 3 (`docs/handoff/`): retrospective — "what actually happened"
- Priority 4 (`docs/phases/`): prospective — "what we planned"
- Phase planning specs có thể outdated nếu:
  - Viết TRƯỚC khi có mockup → mockup wins
  - Có ADR mới override → ADR wins
  - Phase handoff doc đã commit khác → handoff wins

**Ví dụ thực tế (sẽ gặp khi planning slices ICP):**

| Conflict | Source A (winning) | Source B (losing) | Resolution |
|---|---|---|---|
| Cart UI layout | Mockup Intent 05 full-screen page | PHASE_04 spec "sidebar always visible" | Mockup wins (priority 1) — ADR-05-01 đã ghi |
| Forgot password link | Mockup Intent 08 KHÔNG có | PHASE_02 spec không mention | No conflict — align |
| Google Trends integration | ADR-031 + mockup Intent 01 State B | PHASE_03_IMPORT spec không mention `gtrends.interest_over_time` | ADR + mockup win (priorities 1+2) — expand phase spec |
| OTP 3DS state | Mockup Intent 06 state G | PHASE_04 spec chỉ note autofill issue | Mockup wins — design handler trong slice |
| Shopee price source | (human decision 2026-05-18) Postgres table + worker seed | ADR-008 "JSON file" | Human decision → propose ADR-032 override ADR-008 |

**Action khi phát hiện conflict:**
1. NOT silently pick — STOP
2. Document conflict trong Slice Brief Section "Risks"
3. Propose resolution dựa trên hierarchy
4. Đợi human confirm trước khi code
5. Update `DECISIONS.md` với ADR mới (status="Proposed" → "Accepted")

---

## Meta-Rule — Tự sửa lỗi sau khi commit

Khi AI phát hiện đã vi phạm 1 trong 7 rules sau khi đã code:

1. **Stop** code ngay
2. **Acknowledge** vi phạm rule nào
3. **Propose fix** (rollback / patch / re-design)
4. **Update report** với "Known issues" để human biết
5. **Không tự rollback git** — đợi human OK

**Anti-pattern (CẤM):**
- Silent fix (sửa lén không note)
- Đổ lỗi cho "spec không rõ" (spec sẽ ambiguous, đó là lý do có Rule 7 hierarchy)

---

## Reference

| Doc | Section relevant |
|---|---|
| `docs/workflow/ICP_WORKFLOW_FINAL.md` | Section 3 (Bảy Rules), Section 14.4.1 (Slice ↔ Phase Spec Mapping) |
| `docs/00_CONTEXT.md` | Section 10 (Critical Constraints — 17 sub-rules cho AI code) |
| `docs/handoff/PHASE_00_CROSS_INTENT_PATTERNS.md` | 12 patterns LOCKED — Rule 5 stop condition khi muốn change |
| `docs/handoff/PHASE_00_HANDOFF.md` | Section "Phase-specific notes" — phase ordering |
| `docs/DECISIONS.md` | All ADRs (priority 2 evidence per Rule 7) |

---

## Acknowledgment workflow

Khi mở conversation mới với AI cho ICP project:

1. AI đọc file này (paste hoặc reference path)
2. AI confirm: "Acknowledged 7 Rules. Sẽ follow Rule 7 hierarchy khi gặp conflict, không silent pick."
3. AI list những file evidence sẽ đọc tiếp theo (per Step's Files Upload Matrix ở workflow doc Section 14)
4. Human confirm OK → AI bắt đầu execute step

---

**END OF TASK OPERATING SYSTEM.**

**Generated:** 2026-05-18
**Version:** 1.0
**Authority:** Lock từ Step 0 of ICP Workflow v1.3
**Update policy:** Chỉ change khi upgrade workflow doc version (vd v1.3 → v1.4) hoặc human chốt rule mới.
