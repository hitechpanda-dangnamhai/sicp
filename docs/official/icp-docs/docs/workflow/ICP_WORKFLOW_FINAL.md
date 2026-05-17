# ICP Workflow — Quy Trình Làm Việc Chính Thức

> **Tên đầy đủ:** Human-Led Progressive Slice Delivery (HPSD) với Method-Embedded Task Analysis
> **Version:** 1.3 (Phase specs promoted to Tier 5b BẮT BUỘC)
> **Date:** 2026-05-17
> **Status:** ⭐ TRUTH SOURCE — Doc này là căn cứ chính thức làm dự án ICP. Mọi quyết định
> workflow phải tham chiếu doc này.
>
> **Tóm tắt:** Quy trình human-led, slice-based, evidence-driven cho dự án AI-assisted
> development. Phù hợp cho hackathon ICP (~3-4 tuần) với 8 intents end-to-end.
>
> **Changelog:**
> - **v1.0** (initial): HPSD framework (10 steps) + 3 methods (EBT v2 / CDP / VSP) +
>   3 enhancements (Rule 7 Evidence Hierarchy, Gate 9 Cross-Slice, explicit method matrix)
> - **v1.1**: Bổ sung Section 14 (Files Upload Matrix per Step) — fix Step 1 thiếu
>   context evidence
> - **v1.2**: Bổ sung mockups.zip vào Tier 5 (Step 1-2) + Section 14.3.1 Mockup Strategy.
>   Lý do: roadmap cần mockup để identify wow patterns (Rule 6 MOCKUP IS LAW) + hidden
>   complexity + cross-intent reuse. Total upload Step 1-2: 23 files + 1 zip (~1MB).
> - **v1.3**: 4 fixes major:
>   1. Sửa paths folder structure thực tế (docs/handoff/ vs docs/phases/)
>   2. PROMOTE Phase 01-06 specs từ Tier 7 Optional → Tier 5b BẮT BUỘC
>      (rated ⭐⭐⭐⭐⭐ high fidelity, chứa critical implementation constraints)
>   3. Update Rule 7 Evidence Hierarchy: phase planning specs ở priority 4
>      (vs phase handoff retrospective ở priority 3)
>   4. Section 14.4.1 Slice ↔ Phase Spec Mapping table với 11 slices
>      + conflict resolution notes (mockup vs spec wins per Rule 6)
>   Total upload Step 1-2: 30 files + 1 zip (~1.2MB).

---

## 0. Tóm Tắt Triết Lý

```
Không phân tích tasklist toàn dự án quá chi tiết từ đầu.
Nhưng cũng không giao AI tự làm hết.
Ta có roadmap cấp cao, tasklist theo từng slice,
và task pack cụ thể cho từng lần code.
```

**5 nguyên tắc cốt lõi:**

1. **Human owns priority** — AI propose, human approve. Không ngược lại.
2. **Progressive detail** — Roadmap cấp cao có ngay, chi tiết task chỉ làm khi cần.
3. **Evidence-driven** — Mọi task có evidence rõ ràng từ docs/mockup/repo.
4. **Slice-based** — Đơn vị làm việc là Slice (1 luồng demo-able), không phải toàn project.
5. **Living document** — Tasklist update sau code thật, không lock cứng.

---

## 1. Nguồn Gốc Quy Trình

Quy trình này consolidate 3 inputs:

| Nguồn | Đóng góp |
|---|---|
| **AI Agent (Claude)** | 3 methods phân tích: EBT v2 (UI), CDP (Platform), VSP (Vertical Slice) |
| **Chuyên gia 02** | Tách 3 loại task (A/B/C), Semantic Normalization, Platform Capability concept |
| **Chuyên gia 03 (HPSD)** | Framework 10 steps, 5-tier hierarchy, 8 Gates, Stop Conditions, Living Tasklist |

**Output này không phải opinion 1 người.** Là consolidate sau 3 vòng cross-review.

---

## 2. Cấu Trúc Phân Cấp 5 Tầng

```
Project Roadmap        ← Toàn dự án (cấp cao, gần như immutable)
   ↓
Phase                  ← Giai đoạn (Foundation / Core flows / AI flows / Polish)
   ↓
Slice                  ← Đơn vị demo-able (1-3 ngày, full FE-BE-DB-Log)
   ↓
Slice Task List        ← ~5-10 tasks trong slice (review-able by human)
   ↓
Claude Task Pack       ← 1 task duy nhất (executable by AI, 2-8 giờ work)
   ↓
Implementation + Review
```

**Tại sao 5 tầng?**

- Plan-er (human) làm việc với 3 tầng trên (Roadmap → Phase → Slice)
- Executor (AI) làm việc với 2 tầng dưới (Slice TaskList → Task Pack)
- **Tasklist chi tiết chỉ tồn tại ở Slice level**, không bao giờ ở Project level
- → Tránh "plan paralysis" (plan quá nhiều, không bao giờ start)

---

## 3. Bảy Rules Bất Biến (Task Operating System)

Đây là "luật chơi" áp dụng cho MỌI step. Lock vào repo trước khi bắt đầu.

### Rule 1 — Human owns priority

AI can propose. Human approves.

**Áp dụng:**
- Step 1 Roadmap: AI tạo draft, human chốt thứ tự
- Step 3 Select Slice: AI đề xuất 1-3 slices, human chọn 1
- Step 6 Pick Task: AI gợi ý, human OK hoặc đổi
- Step 9 Review: AI verdict (PASS/FIX/REJECT), human decide merge

### Rule 2 — No full detailed backlog upfront

Only create detailed tasklist for the current slice.

**Lý do:** Tasklist chi tiết sẽ stale sau 1-2 slices. Plan chi tiết 8 intents từ đầu = waste.

**Exception:** Cross-slice dependency có thể identify sớm (vd S-06 cần S-05), nhưng KHÔNG breakdown sub-tasks.

### Rule 3 — Every task must have evidence

Evidence sources:
- General docs (`00_CONTEXT.md`, `01_ARCHITECTURE.md`)
- Phase docs (`PHASE_0X_HANDOFF.md`)
- Mockup HTML (visual contract)
- API contracts (`03_API_CONTRACTS.md`, OpenAPI generated)
- Data model (`02_DATA_MODEL.md`, migrations)
- Observability (`06_OBSERVABILITY.md`, `LOG_CATALOG.md`)
- Repo state (actual code, hiện trạng)

**Áp dụng:** Slice Brief (Step 4) MUST list evidence. Task Pack (Step 7) MUST có "Read First" section.

### Rule 4 — Every code task must be reviewable

Each task must produce:
- Changed files (path list)
- Command output (build/test logs)
- Tests (smoke at minimum)
- Known issues (tự khai báo)

**Áp dụng:** Step 8 Implementation Report template bắt buộc.

### Rule 5 — Claude Code cannot decide architecture changes

It must stop and report.

**Trường hợp STOP:**
- Cần thay đổi DB schema không có trong scope
- Cần đổi naming convention
- Cần thêm dependency mới chưa approved
- Cần đổi pattern đã LOCKED (vd Cross-Intent Patterns)

**Áp dụng:** Task Pack (Step 7) có section "Stop Conditions" bắt buộc.

### Rule 6 — MOCKUP IS LAW ⭐

Mọi pattern xuất hiện trong mockup PHẢI build, dù không nằm trong intent specs.

**Lý do:** Mockup = visual contract demo cho judge hackathon. Bỏ pattern = mất wow factor.

**Áp dụng:**
- Slice loại H-UI: KHÔNG được skip wow components dù frequency thấp
- Vd: `<HeroInsightCard>` chỉ 4 mockup → vẫn build
- Vd: `<DrillChipRow>` chỉ Intent 07 → vẫn build

**Exception duy nhất:** Pure utility (animation, layout helper) → CSS only, không cần component.

### Rule 7 — Evidence Hierarchy (when conflict)

When evidence sources conflict, priority order:

1. **Mockup** (per Rule 6 MOCKUP IS LAW)
2. **Recent ADRs** (`DECISIONS.md` mới nhất, vd ADR-031)
3. **Phase handoff docs** (`docs/handoff/PHASE_0X_HANDOFF.md` — retrospective, fact)
4. **Phase planning specs** (`docs/phases/PHASE_0X_*.md` — prospective, may be outdated by mockup)
5. **General specs** (`00_CONTEXT.md`, `04_INTENT_SPECS.md`, etc.)
6. **Repo state** (actual code)

**AI MUST surface conflicts, NOT silently pick.**

**Phân biệt priority 3 vs 4:**
- Priority 3 (`docs/handoff/`): "Đã làm gì" — retrospective, what actually happened
- Priority 4 (`docs/phases/`): "Sẽ làm gì" — prospective, what we planned to do

Phase planning specs có thể outdated nếu:
- Viết trước khi có mockup → mockup wins
- Có ADR mới override → ADR wins
- Phase handoff doc đã commit khác → handoff wins

**Ví dụ:**
- Mockup có "Forgot password" link
- `PHASE_02_AUTH_SEARCH.md` nói "Skip forgot password cho hackathon"
- → Conflict! Mockup wins per Rule 6. AI surface conflict, đề xuất update phase spec.

- `DECISIONS.md` ADR-031 chốt thêm Google Trends
- `PHASE_03_IMPORT.md` chưa mention Google Trends (viết trước ADR-031)
- → ADR wins per priority 2. AI note phase spec cần update.

---

## 4. Mười Steps Workflow

### Step 0 — Establish Control Rules

**Mục đích:** Lock luật chơi vào repo trước khi bắt đầu.

**Output:** `.ai-delivery/TASK_OPERATING_SYSTEM.md` chứa 7 Rules ở Section 3.

**Ai chủ động:**
- Claude tạo draft
- Human review + approve
- Lock vào git, không sửa trừ khi cần upgrade workflow

**Effort:** 30 phút (1 lần duy nhất cho cả dự án)

---

### Step 1 — Build Project Roadmap

**Mục đích:** Biết toàn dự án đi hướng nào, nhưng chưa chia task chi tiết.

**Input:** ⭐ ĐỦ EVIDENCE từ existing docs, KHÔNG cut corner.

Roadmap không phải "AI guess" — phải dựa trên TẤT CẢ constraints đã LOCKED.
Xem **Section 15 — Files Upload Matrix** ở dưới để có danh sách đầy đủ.

Tóm tắt input Step 1 (~19 files BẮT BUỘC):
- **Tier 1 (Anchor):** 00_CONTEXT, 01_ARCHITECTURE, 04_INTENT_SPECS
- **Tier 2 (Contracts):** 02_DATA_MODEL, 03_API_CONTRACTS, 08_FE_BE_CONTRACT
- **Tier 3 (Infrastructure):** 06_OBSERVABILITY, 07_BEHAVIOR_LOGS, 09_FIELD_AUDIT
- **Tier 4 (Decisions):** DECISIONS, INTENT_AUDIT_REPORT, LOG_CATALOG
- **Tier 5 (Current state):** PHASE_00_HANDOFF, infra/migrations/V00X*.sql (4 files)
- **Tier 6 (Workflow):** ICP_WORKFLOW_FINAL (this doc), PROMPT_TEMPLATES

**Lý do cần đầy đủ:**
- Roadmap cần biết tech stack LOCKED (00_CONTEXT) → không plan ngược spec
- Roadmap cần biết DB schema + events (02_DATA_MODEL) → identify migration needs
- Roadmap cần biết API/SSE/MCP contracts (03_API_CONTRACTS) → identify Platform Capabilities
- Roadmap cần biết existing ADRs (DECISIONS) → không lặp lại quyết định
- Roadmap cần biết existing migrations (V00X*.sql) → biết bắt đầu từ đâu
- Roadmap cần biết OTel + Logs (06, LOG_CATALOG) → identify P-CAP Stage 1
- Roadmap cần biết audit kết quả (INTENT_AUDIT_REPORT) → confidence migration count

**Action:**
- AI đề xuất roadmap dạng Stages (không phải Phases technical)
- Mỗi Stage có goal cao cấp
- Identify cross-Stage dependencies

**Output:** `MASTER_ROADMAP.md`

```markdown
# Master Roadmap

## Stage 1 — Foundation (Week 1)
- UI foundation (component library FE)
- Runtime/platform foundation (OTel, OpenAPI, error format)
- Repo reality check (audit current state)

## Stage 2 — First Runnable Flow (Week 1-2)
- First authenticated flow (login + session)
- First product discovery flow (search)
- Smoke test cross-flow

## Stage 3 — Core Commerce Flows (Week 2)
- Cart + order flow
- Payment flow
- Receipt + confirmation

## Stage 4 — AI / Multimodal Flows (Week 3)
- Image AI flow (import by image)
- Voice AI flow (buy + analyze by voice)
- Recommendation flow

## Stage 5 — Demo Hardening (Week 3-4)
- Seed data + analytics fixtures
- Observability dashboards
- Visual polish + fallback scripts
- Pitch path rehearsal
```

**Ai chủ động:**
- Claude đề xuất roadmap
- Human chọn priority cuối

**Effort:** 1 conversation (~45 phút)

---

### Step 2 — Create Master Slice Backlog

**Mục đích:** Chia roadmap thành các slice lớn, mỗi slice có thể tạo output thật.

**Input:** Tất cả files từ Step 1 (~19 files) + `MASTER_ROADMAP.md` vừa tạo.

Xem **Section 15 — Files Upload Matrix** cho detail.

**Action:** Claude tạo bảng slice với:
- Slice ID (S-XX)
- Slice Name
- Goal (1 câu)
- Type (xem bảng dưới)
- Priority (P0/P1/P2)
- Status (TODO/IN_PROGRESS/DONE)

**Slice Types (LOCKED):**

| Type | Tên đầy đủ | Đặc tính | Method áp dụng |
|---|---|---|---|
| **Q-GATE** | Quality Gate | Audit/check, không code feature | Checklist mode |
| **H-UI** | Horizontal UI | Component library FE-only | **EBT v2** |
| **H-RUNTIME** | Horizontal Runtime | Runtime helpers, stores | Custom inline |
| **P-CAP** | Platform Capability | Cross-cutting infrastructure | **CDP** |
| **D-SLICE** | Demo Slice | First demo-able flow của 1 use case | **VSP (lite)** |
| **V-SLICE** | Vertical Slice | Full end-to-end của 1 intent | **VSP (full)** |

**Output:** `MASTER_SLICE_BACKLOG.md`

```markdown
# Master Slice Backlog

| Slice ID | Slice Name | Goal | Type | Priority | Status |
|---|---|---|---|---|---|
| S-00 | Repo Reality Check | Audit current repo state | Q-GATE | P0 | TODO |
| S-01 | Minimal UI Foundation | Build reusable UI components | H-UI | P0 | TODO |
| S-02 | Runtime Foundation | API/error/log/runtime skeleton | P-CAP | P0 | TODO |
| S-03 | First Authenticated Flow | User can login/logout end-to-end | V-SLICE | P0 | TODO |
| S-04 | First Product Discovery | User can search + view results | V-SLICE | P0 | TODO |
| S-05 | First Cart/Order Flow | User can add to cart + view cart | V-SLICE | P1 | TODO |
| S-06 | First Payment Flow | User can complete payment | V-SLICE | P1 | TODO |
| S-07 | First Image AI Flow | User can import product by image | V-SLICE | P1 | TODO |
| S-08 | First Voice AI Flow | User can buy/analyze by voice | V-SLICE | P2 | TODO |
| S-09 | Recommendation Flow | User gets recommendations | V-SLICE | P2 | TODO |
| S-10 | Analytics Flow | User sees insights + charts | V-SLICE | P2 | TODO |
| S-11 | Demo Hardening | Polish + fallback + pitch path | Q-GATE | P0-final | TODO |
```

**Ai chủ động:**
- Claude tạo backlog
- Human review thứ tự + priority

**Effort:** 30-45 phút (cùng conversation với Step 1)

---

### Step 3 — Select Current Slice

**Mục đích:** Mỗi lần chỉ chọn 1 slice để làm. Tránh multitasking.

**Tiêu chí chọn:**

| Tiêu chí | Câu hỏi |
|---|---|
| Demo value | Làm xong có thấy được không? |
| Dependency | Có unlock slice sau không? |
| Risk reduction | Có giảm rủi ro lớn không? |
| Reuse | Có tạo nền dùng lại không? |
| Testability | Có test được không? |

**Output:** Decision rõ ràng, vd "Làm S-03 First Authenticated Flow trước"

**Ai chủ động:**
- AI đề xuất 1-3 slices nên làm tiếp dựa trên dependency
- Human chốt 1 slice

**Effort:** 5-10 phút (mỗi lần bắt đầu slice mới)

---

### Step 4 — Analyze Current Slice

**Mục đích:** Tạo Slice Brief — context để mọi người (kể cả AI conversation sau) hiểu slice này làm gì.

**Output:** `slices/S-XX_BRIEF.md`

**Format chuẩn:**

```markdown
# Slice Brief — S-XX <Slice Name>

## Slice Goal
1 câu mô tả user-facing outcome.

## Slice Type
<Q-GATE | H-UI | H-RUNTIME | P-CAP | D-SLICE | V-SLICE>

## Method Áp Dụng ⭐
<EBT v2 | CDP | VSP | Checklist>
(Theo bảng Slice Types ở Step 2)

## Evidence
- General architecture docs: <list>
- API contract docs: <list>
- Data model docs: <list>
- Mockup states: <list HTML files>
- Existing repo files: <list>

## Done Means
- <bullet list các tiêu chí done>
- <smoke test pass>

## Non-goals
- <những gì KHÔNG làm trong slice này>
- <defer sang slice khác nào>

## Dependencies
- Depends on slice: <S-XX, S-YY>
- Blocks slice: <S-ZZ>

## Risks
- <known risks>
```

**Ai chủ động:**
- Claude tự phân tích từ evidence
- Human duyệt scope + non-goals

**Effort:** 30 phút (mỗi slice)

---

### Step 5 — Create Slice Task List ⭐

**Mục đích:** Danh sách task cho **slice hiện tại**, không phải toàn dự án.

**Đây là điểm KEY** — method khác nhau cho slice type khác nhau.

#### 5.1 Method Selection Matrix

| Slice Type | Method | Mô tả |
|---|---|---|
| **Q-GATE** | Checklist Mode | Liệt kê kiểm tra cần thực hiện, không phân task code |
| **H-UI** | **EBT v2** (5 bước) | Component extraction từ mockup |
| **H-RUNTIME** | Custom Inline | Tasks định nghĩa trực tiếp, ít cần method |
| **P-CAP** | **CDP** (5 bước) | Capability inventory + consumer mapping |
| **D-SLICE** | **VSP (lite)** | Vertical slice với mock data, scope hẹp |
| **V-SLICE** | **VSP (full)** | Vertical slice end-to-end, full edge cases |

#### 5.2 Method EBT v2 — Evidence-Based Task Breakdown (cho H-UI slices)

**Áp dụng:** S-01 Minimal UI Foundation

**Quy trình 5 bước:**

```
SCAN → COUNT → SEMANTIC_NORMALIZE → CLASSIFY → BUDGET
```

**Bước 1 — SCAN:** Extract mockup.zip, parse 75 HTML files → raw inventory.

**Bước 2 — COUNT:** Đếm frequency CSS classes, SVG patterns.

**Bước 3 — SEMANTIC_NORMALIZE ⭐:** Áp dụng 4 sub-rules:
- **3.1 Component vs Utility:** `shimmer`, `pulse-ring` → utility CSS, không component
- **3.2 Compound merging:** `ai-avatar` + `ai-bubble` + `user-bubble` → 1 `<ConversationBubble>` compound
- **3.3 Variants:** `ac-tag-price`, `ac-tag-stock`... → 1 component với prop variant
- **3.4 MOCKUP IS LAW filter:** Pattern frequency thấp nhưng wow → vẫn build

**Bước 4 — CLASSIFY:** Atom / Molecule / Organism / Utility

**Bước 5 — BUDGET:** Map vào task buckets theo dependency order (atoms → molecules → organisms)

**Output:** `slices/S-01_TASKLIST.md` với ~5-7 tasks code components

#### 5.3 Method CDP — Capability-Driven Planning (cho P-CAP slices)

**Áp dụng:** S-02 Runtime Foundation

**Quy trình 5 bước:**

```
INVENTORY → CONSUMER_MAPPING → TIMING_DECISION → TASK_BREAKDOWN → ACCEPTANCE_TESTS
```

**Bước 1 — INVENTORY:** Đọc docs (06_OBSERVABILITY, 07_BEHAVIOR, 08_FE_BE), list capabilities.

**Bước 2 — CONSUMER_MAPPING:** Tạo matrix Capability × Intent (8 intents).

**Bước 3 — TIMING_DECISION:** Phân 3 nhóm:
- **MUST_BEFORE** (8/8 consumers): error format, OTel, OpenAPI codegen, auth guard
- **CAN_INCREMENTAL** (3-7/8): SSE contract, idempotency, event envelope, MCP contract
- **DEFER** (1-2/8): behavior SDK, rate limiting

**Bước 4 — TASK_BREAKDOWN:** Mỗi capability = 1 task (~1-2 ngày).

**Bước 5 — ACCEPTANCE_TESTS:** Smoke test integration cho mỗi MUST_BEFORE capability.

**Output:** `slices/S-02_TASKLIST.md` với ~5-7 tasks platform foundation

#### 5.4 Method VSP — Vertical Slice Planning (cho D/V-SLICE)

**Áp dụng:** S-03 đến S-10 (8 intents)

**Quy trình 5 bước:**

```
USER_JOURNEY → LAYER_SLICING → HAPPY_VS_EDGE → SUB_TASK_BREAKDOWN → ESTIMATE_SEQUENCE
```

**Bước 1 — USER_JOURNEY:** Vẽ sequence từ mockup handoff (vd Intent 08: splash → form → loading → success/error).

**Bước 2 — LAYER_SLICING:** Tạo matrix Milestone × Layer (FE/BE/DB/Events/Logs).

**Bước 3 — HAPPY_VS_EDGE:** Classify mỗi state:
- **MUST:** happy path + critical edges (vd wrong password)
- **SHOULD:** defensive (vd network error)
- **NICE_TO_HAVE:** polish (vd logout flow)

**Bước 4 — SUB_TASK_BREAKDOWN:** ~5-8 sub-tasks theo dependency:
- DB migration → Shared types → BE → FE → Wire-up → Edge cases → Logs

**Bước 5 — ESTIMATE_SEQUENCE:** Effort + cross-slice dependency + roadmap.

**Output:** `slices/S-XX_TASKLIST.md` với ~5-8 tasks vertical slice

#### 5.5 Slice Task List Format (chuẩn)

```markdown
# Current Slice Task List — S-XX <Name>

| ID | Task Name | Type | Priority | Depends On | Output | Status |
|---|---|---|---|---|---|---|
| SXX-T01 | <name> | Q-GATE | P0 | none | <deliverable> | TODO |
| SXX-T02 | <name> | P-CAP | P0 | T01 | <deliverable> | TODO |
| SXX-T03 | <name> | H-UI | P1 | T01 | <deliverable> | TODO |
| ... |
```

**Ai chủ động:**
- Claude tạo tasklist (apply method tương ứng)
- Human duyệt, có thể defer task

**Effort:**
- H-UI / P-CAP: 1 conversation planning (~45 phút)
- V-SLICE: 30 phút mỗi intent

---

### Step 6 — Pick One Task From Slice Task List

**Mục đích:** Không giao cả tasklist cho Claude Code làm một lần.

**Tiêu chí pick:**
- Dependency satisfied (depends on tasks đều DONE)
- Highest priority among ready tasks
- Logical sequence (vd schema trước, BE sau, FE cuối)

**Ví dụ:** Trong S-03, pick `S03-T05 Implement login walking skeleton`

**Ai chủ động:**
- AI đề xuất task tiếp theo
- Human đồng ý hoặc đổi task

**Effort:** 2-3 phút

---

### Step 7 — Create Claude Task Pack

**Mục đích:** Bản giao việc cụ thể cho Claude Code (executable).

**Output:** `taskpacks/S03-T05_LOGIN_WALKING_SKELETON.md`

**Template chuẩn (bắt buộc đủ sections):**

```markdown
# Claude Code Task Pack — <ID>

## Task Type
<Q-GATE | H-UI | H-RUNTIME | P-CAP | D-SLICE | V-SLICE>

## Objective
1-2 câu mô tả deliverable cụ thể.

## Read First (Evidence)
- <list docs/files Claude PHẢI đọc trước khi code>
- CURRENT_SLICE_BRIEF.md
- API contract docs related
- Existing route/app shell files
- Existing mock data convention
- TASK_OPERATING_SYSTEM.md (7 Rules)

## Scope (ALLOWED to do)
- <bullet list những gì task này làm>

## Non-goals (NOT doing in this task)
- <bullet list những gì defer>
- <reference task khác sẽ làm>

## Allowed Changes
- <list file paths/folders được modify>

## Forbidden Changes
- <list file paths/folders KHÔNG được touch>
- <vd: database schema, payment modules, unrelated screens>

## Acceptance Criteria
- [ ] App runs without error
- [ ] <happy path>
- [ ] <edge case 1>
- [ ] <edge case 2>
- [ ] No unrelated files changed
- [ ] Smoke test added or updated

## Stop Conditions ⭐
Stop and report (NOT proceed) if:
- No app start command exists
- <contract> conflicts with existing code
- Required component does not exist (defer to atom task)
- Implementation requires changing architecture
- Test setup is broken for unrelated reason
- Evidence conflict per Rule 7 (mockup vs spec)

## Cross-Slice Integration Check ⭐
After implementation, verify:
- Slice S-XX (previous) flow still works
- No regression in shared components
```

**Ai chủ động:**
- Claude tạo task pack
- Human review nhanh (~5 phút)
- Claude Code implement

**Effort:** 10-15 phút tạo task pack

---

### Step 8 — Claude Code Implements

**Mục đích:** Code task trong scope đã định.

**Constraint:** KHÔNG được mở rộng scope. Gặp blocker → STOP per Stop Conditions.

**Output bắt buộc:** Implementation Report

```markdown
# Implementation Report — <Task ID>

## Files Changed
- <path 1>: created/modified
- <path 2>: modified
- ...

## What Was Implemented
- <bullet list features completed>

## Commands Run
```bash
pnpm install
pnpm dev
pnpm test
```
Output: <logs>

## Test Results
- Unit tests: <X/Y passed>
- Smoke tests: <pass/fail>
- Manual verification: <list steps taken>

## Deviations From Task Pack
- <if any deviation, explain WHY>
- <reference Stop Conditions if applicable>

## Known Issues
- <self-declared issues>
- <TODO items deferred>

## Cross-Slice Integration Check ⭐
- Previous slice S-XX flow: <still works / regression detected>
- Shared components affected: <none / list>

## Recommended Next Step
- <suggest task ID nên làm tiếp>
```

**Ai chủ động:**
- Claude Code implement trong scope
- KHÔNG tự mở rộng

**Effort:** 2-6 giờ tùy task (theo task pack scope)

---

### Step 9 — Review Implementation (9 Gates ⭐)

**Mục đích:** Verify implementation match task pack + không gây regression.

**9 Gates (bắt buộc check hết):**

| # | Gate | Câu hỏi |
|---|---|---|
| 1 | **Scope Gate** | Có làm đúng task không? Không over/under? |
| 2 | **Source Gate** | Có bám evidence (Read First docs) không? |
| 3 | **Architecture Gate** | Có phá boundary 3 layers không? |
| 4 | **Contract Gate** | Có bịa API/DTO/event chưa có trong spec không? |
| 5 | **UI Gate** | Có đủ state tối thiểu (idle/loading/success/error) không? |
| 6 | **Test Gate** | Có test thật không, hay chỉ "claim" có test? |
| 7 | **Regression Gate** | Có đụng file ngoài scope không? |
| 8 | **Demo Gate** | Có chạy được flow của slice này không? |
| 9 | **Cross-Slice Gate ⭐** | Slice trước đó có còn work không? Integration test pass? |

**Verdict (chỉ 3 options):**

- **PASS** — Merge được, không cần fix
- **FIX REQUIRED** — Cần fix nhỏ, tạo sub-task fix pack
- **REJECT** — Lệch scope/risk lớn, rollback và làm lại

**Ai chủ động:**
- Claude review (check 9 gates)
- Human decide merge/fix

**Effort:** 15-30 phút mỗi task

---

### Step 10 — Update Task List

**Mục đích:** Tasklist là **living document**. Update sau code thật, không lock cứng.

**Action:**

1. **Mark task status:**
   ```
   S03-T05 | Implement login walking skeleton | DONE
   S03-T06 | Implement logout flow | NEXT
   ```

2. **Add new tasks discovered during implementation:**
   ```
   S03-T11 | Fix auth store hydration issue | H-RUNTIME | P0 | TODO
   ```

3. **Defer/cancel tasks if needed:**
   ```
   S03-T08 | Auth behavior logs | DEFERRED to Stage 5 polish
   ```

4. **Update dependencies if architecture changed:**
   ```
   S03-T09 now depends on S03-T11 (newly added)
   ```

**Ai chủ động:**
- Claude propose tasklist updates
- Human approve

**Effort:** 5 phút

---

## 5. Quy Trình Áp Dụng Cho Dự Án ICP

### 5.1 Timeline tổng thể

```
Week 0 (now):
  ├─ Step 0: Lock TASK_OPERATING_SYSTEM.md
  ├─ Step 1: MASTER_ROADMAP.md
  └─ Step 2: MASTER_SLICE_BACKLOG.md
  Effort: 1-2 ngày

Week 1: Foundation
  ├─ S-00 Repo Reality Check (Q-GATE, 0.5 ngày)
  ├─ S-01 Minimal UI Foundation (H-UI, 3-5 ngày, apply EBT v2)
  └─ S-02 Runtime Foundation (P-CAP, 3-5 ngày, apply CDP)
  Note: S-01 + S-02 có thể PARALLEL nếu có team

Week 2: First flows
  ├─ S-03 First Authenticated Flow (V-SLICE, 2-3 ngày)
  ├─ S-04 First Product Discovery (V-SLICE, 2-3 ngày)
  └─ S-05 First Cart/Order (V-SLICE, 2-3 ngày)

Week 3: AI flows
  ├─ S-06 Payment Flow (V-SLICE, 2-3 ngày)
  ├─ S-07 Image AI Flow (V-SLICE, 2-3 ngày)
  ├─ S-08 Voice AI Flow (V-SLICE, 2-3 ngày)
  ├─ S-09 Recommendation (V-SLICE, 1-2 ngày)
  └─ S-10 Analytics (V-SLICE, 2-3 ngày)

Week 4: Hardening
  └─ S-11 Demo Hardening (Q-GATE, 2-3 ngày)
```

**Total:** ~25-30 ngày work cho 1 dev. Với team 2-3 → 12-15 ngày.

### 5.2 Files cần tạo (deliverables)

**One-time setup:**
- `.ai-delivery/TASK_OPERATING_SYSTEM.md`
- `MASTER_ROADMAP.md`
- `MASTER_SLICE_BACKLOG.md`

**Per slice (~11 slices):**
- `slices/S-XX_BRIEF.md`
- `slices/S-XX_TASKLIST.md`

**Per task (~50-80 tasks total):**
- `taskpacks/SXX-TYY_<NAME>.md`
- `reports/SXX-TYY_REPORT.md`
- `reviews/SXX-TYY_REVIEW.md`

**Total files:** ~150-200 markdown files trong project lifecycle.

### 5.3 Conversation count estimate

| Activity | Count | Effort per |
|---|---|---|
| Step 0 + 1 + 2 setup | 1 conv | 2 hours |
| Slice planning (Step 4 + 5) per slice | 11 convs | 30-60 min |
| Task execution (Step 7 + 8) per task | 50-80 convs | 1-4 hours |
| Review (Step 9) per task | bundled với execution | — |

**Total:** ~70-95 conversations cho cả dự án.

---

## 6. Roles & Responsibilities

| Role | Owner | Responsibilities |
|---|---|---|
| **Plan Owner** | Human | Approve roadmap, priority, slice selection, merge decisions |
| **Task Designer** | Claude (planning) | Slice Brief, Slice Task List, Task Pack |
| **Implementer** | Claude Code | Execute Task Pack in scope, write Implementation Report |
| **Reviewer** | Claude (review) | 9 Gates check, verdict PASS/FIX/REJECT |
| **Conflict Resolver** | Human | When AI surfaces evidence conflict per Rule 7 |
| **Living Doc Maintainer** | Claude + Human | Update tasklist per Step 10 |

**Quan trọng:**
- Claude planning role và Claude Code role có thể là **different conversations** (different model instances)
- Human không phải "review từng dòng code", chỉ review **decisions + gates**

---

## 7. Workflow Diagram

```
┌────────────────────────────────────────────────────────────┐
│ ONE-TIME SETUP                                              │
│                                                              │
│  Step 0 ──► Step 1 ──► Step 2                              │
│   (Rules)   (Roadmap)  (Slice Backlog)                     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ PER SLICE LOOP (lặp lại N slices)                          │
│                                                              │
│   Step 3 ──► Step 4 ──► Step 5                             │
│   (Select)   (Brief)    (Slice TaskList - apply method)    │
│                                                              │
│              ┌──────────────────┐                          │
│              │ PER TASK LOOP    │                          │
│              │                  │                          │
│              │  Step 6 ──► 7    │                          │
│              │  (Pick) (Pack)   │                          │
│              │     │            │                          │
│              │     ▼            │                          │
│              │  Step 8 ──► 9    │                          │
│              │ (Impl) (Review)  │                          │
│              │     │            │                          │
│              │     ▼            │                          │
│              │  Step 10 ────────┼──► loop next task        │
│              │  (Update)        │                          │
│              └──────────────────┘                          │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                       │
│              │ Slice DONE?         │                       │
│              │  Yes → next slice   │                       │
│              │  No  → next task    │                       │
│              └─────────────────────┘                       │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Lợi Ích & Trade-offs

### Lợi ích

1. **Tránh plan paralysis** — Plan cấp cao có, chi tiết just-in-time
2. **AI scope clear** — Task Pack có Stop Conditions, không drift
3. **Human-in-the-loop** — Mọi decision quan trọng có human approval
4. **Living document** — Plan thay đổi theo reality, không lock
5. **9 Gates anti-pattern killer** — Catch issues sớm
6. **Demo-able mỗi slice** — Progress visible, judge thấy được
7. **Multi-method depth** — EBT/CDP/VSP cho từng slice type → tasklist chất lượng cao
8. **Reusable cho dự án sau** — Framework không phụ thuộc ICP

### Trade-offs

1. **Setup overhead** — Step 0+1+2 tốn 1-2 ngày trước khi code
2. **File proliferation** — ~150-200 markdown files trong project (acceptable cho hackathon)
3. **Discipline required** — Nếu skip Stop Conditions / Gates → workflow giảm hiệu quả
4. **Human bottleneck** — Mỗi step cần human approval → có thể chậm nếu human busy
5. **Method learning curve** — EBT/CDP/VSP có học, không bưng vào dùng ngay

### Mitigations cho trade-offs

- Overhead: Step 0+1+2 chỉ làm 1 lần, amortized over toàn dự án
- File proliferation: Folder structure rõ (`.ai-delivery/`, `slices/`, `taskpacks/`)
- Discipline: 7 Rules locked trong repo, AI tự reference
- Human bottleneck: Step 3 chọn slice + Step 6 pick task có thể bulk decide cuối tuần
- Learning curve: Có doc này làm reference, gradually internalize

---

## 9. Anti-Patterns Cần Tránh

### AP1 — "Mega Task Pack"
- ❌ Task Pack với scope quá lớn ("build entire S-03 in one task")
- ✅ Task Pack scope ≤ 1 ngày work (~2-6 hours)

### AP2 — "Silent Conflict Resolution"
- ❌ AI tự decide khi evidence conflict
- ✅ Surface conflict per Rule 7, hỏi human

### AP3 — "Scope Creep"
- ❌ Implementation mở rộng beyond Task Pack
- ✅ Stop per Rule 5, tạo task mới nếu cần

### AP4 — "Skip Cross-Slice Gate"
- ❌ Mark task DONE without integration check
- ✅ Gate 9 mandatory, regression detection sớm

### AP5 — "Dead Tasklist"
- ❌ Tạo tasklist, không update sau implementation
- ✅ Step 10 mỗi task, living document

### AP6 — "Wishful Acceptance Criteria"
- ❌ AC mơ hồ ("user can login")
- ✅ AC measurable ("POST /auth/login returns 200 with JWT cookie")

### AP7 — "Premature Backlog Detail"
- ❌ Plan chi tiết 8 intents ngay từ đầu
- ✅ Plan chi tiết chỉ cho slice hiện tại

---

## 10. Migration Path (Từ Hiện Trạng)

Hiện trạng dự án ICP:
- Phase 00 mockup đã xong (75 HTML files)
- Có handoff docs nhiều
- Chưa code production

### Migration plan

**Day 1 — Setup workflow:**
- Tạo `.ai-delivery/TASK_OPERATING_SYSTEM.md` (Step 0)
- Tạo `MASTER_ROADMAP.md` (Step 1)
- Tạo `MASTER_SLICE_BACKLOG.md` (Step 2)
- Lock vào git

**Day 2 — First slice:**
- Pick S-00 Repo Reality Check (Q-GATE) làm slice đầu tiên
- Lý do: Audit current state trước khi build mới
- Output: Repo finding report

**Day 3+ — Iterate:**
- Apply workflow per slice
- Tasklist hiện tại (handoffs, frequency analysis) trở thành **evidence** cho slices, không phải tasklist live

### Existing docs hậu Phase 00

Các handoff docs (`PHASE_00_INTENT_XX_MOCKUP_HANDOFF.md`) → KHÔNG bỏ:
- Trở thành **evidence sources** trong Step 4 Slice Brief
- Reference khi planning V-SLICE cho intent tương ứng

`PHASE_00_HANDOFF.md` → trở thành snapshot Phase 00 đã DONE, không update nữa.

---

## 11. Glossary

- **Slice** — Đơn vị làm việc demo-able, gồm full FE+BE+DB+events+logs cho 1 user flow
- **Task Pack** — Bản giao việc cụ thể cho Claude Code, có scope rõ + Stop Conditions
- **Living Document** — Doc được update sau code thật, không lock cứng
- **MOCKUP IS LAW** — Rule 6, mọi pattern mockup MUST build
- **Stop Conditions** — Tình huống Claude Code phải dừng và report, không tự decide
- **9 Gates** — Checklist review implementation (Scope/Source/Architecture/Contract/UI/Test/Regression/Demo/Cross-Slice)
- **EBT v2** — Evidence-Based Task Breakdown method, dùng cho H-UI slices
- **CDP** — Capability-Driven Planning, dùng cho P-CAP slices
- **VSP** — Vertical Slice Planning, dùng cho D-SLICE / V-SLICE
- **Q-GATE** — Quality Gate slice (audit/check, không code feature)
- **HPSD** — Human-Led Progressive Slice Delivery (tên framework gốc của chuyên gia 03)

---

## 12. References

**Nguồn quy trình:**
- Y_Kien_chuyen_gia_03.md (HPSD framework, 10 steps, 5 tiers)
- Y_Kien_chuyen_gia_02.md (3 loại task, Semantic Normalization, Platform Capability)
- METHODOLOGY_TASK_ANALYSIS.md (Claude — EBT/CDP/VSP methods)

**Docs dự án (sẽ trở thành evidence):**

*Tier 1 — Anchor docs:*
- `00_CONTEXT.md` — Project anchor, naming, tech stack
- `01_ARCHITECTURE.md` — 3-layer architecture, choreography
- `04_INTENT_SPECS.md` — 8 intents functional specs

*Tier 2 — Contracts + Data:*
- `02_DATA_MODEL.md` — DB schema, events, behavior_events
- `03_API_CONTRACTS.md` — REST + MCP + SSE contracts
- `08_FE_BE_CONTRACT.md` — OpenAPI codegen workflow

*Tier 3 — Infrastructure:*
- `06_OBSERVABILITY.md` — OTel, logs schema
- `07_BEHAVIOR_LOGS.md` — User events SDK
- `09_FIELD_AUDIT.md` — UI field ↔ data source mapping

*Tier 4 — Decisions + Audit:*
- `DECISIONS.md` — ADR log
- `INTENT_AUDIT_REPORT.md` — Migration roadmap pre-spec
- `LOG_CATALOG.md` — Log message registry

*Tier 5 — Phase 00 deliverables (current state):*
- `PHASE_00_HANDOFF.md` — Mockup deliverable snapshot
- `PHASE_00_DESIGN_SYSTEM.md` — Design tokens v3
- `PHASE_00_CROSS_INTENT_PATTERNS.md` — Reusable patterns LOCKED
- `PHASE_00_INTENT_XX_MOCKUP_HANDOFF.md` × 8 — Per intent mockup details

*Tier 5 — Existing migrations:*
- `infra/migrations/V002__product_enrichment.sql`
- `infra/migrations/V003__insights.sql`
- `infra/migrations/V005__payment_metadata.sql`
- `infra/migrations/V006__analytics_aggregations.sql`

*Tier 6 — Workflow + Templates:*
- `ICP_WORKFLOW_FINAL.md` — This doc
- `PROMPT_TEMPLATES.md` — Reusable prompts
- `_HANDOFF_TEMPLATE.md` — Handoff format template

*Tier 7 — Optional (load when needed):*
- `05_CODING_CONVENTIONS.md` — Code style standards
- `PHASE_01_INFRA.md` đến `PHASE_06_POLISH.md` — Existing phase specs

---

## 13. Checklist Trước Khi Bắt Đầu

Bạn confirm 8 điều trước khi bắt đầu execute workflow:

- [ ] Đọc xong toàn bộ doc này (Section 0-15)
- [ ] Đồng ý 7 Rules ở Section 3 — đặc biệt Rule 6 MOCKUP IS LAW và Rule 7 Evidence Hierarchy
- [ ] Đồng ý 5-tier hierarchy ở Section 2
- [ ] Đồng ý method matrix ở Section 5.1 (H-UI → EBT v2, P-CAP → CDP, V-SLICE → VSP)
- [ ] Đồng ý Files Upload Matrix ở Section 14 (đặc biệt 30 files + mockups.zip cho Step 1-2)
- [ ] Đã đọc Phase specs PHASE_01-06 (verify high fidelity ⭐⭐⭐⭐⭐) và đồng ý promote lên Tier 5b
- [ ] Đã chuẩn bị `mockups.zip` (75 HTML + 8 builder scripts) để upload Step 1-2
- [ ] Sẵn sàng tạo 3 setup files (TASK_OPERATING_SYSTEM, MASTER_ROADMAP, MASTER_SLICE_BACKLOG)

Sau khi 8 checkboxes ✓ → mở conversation mới với prompt ở Section 15.

---

## 14. Files Upload Matrix Per Step ⭐

**Quan trọng:** Mỗi step có set files khác nhau cần upload. KHÔNG dùng "1 size fits all".

### 14.1 Nguyên tắc upload files

1. **Step càng "early" (Step 0-2) cần càng đủ context** — vì decisions ở đây ảnh hưởng toàn dự án
2. **Step càng "detail" (Step 7-8) cần càng focused** — chỉ upload files liên quan task hiện tại
3. **Workflow doc (ICP_WORKFLOW_FINAL.md) PHẢI có ở MỌI step** — anchor cho AI
4. **Slice Brief PHẢI có cho Steps 5-9** — context của slice hiện tại

### 14.2 Files Upload Matrix

| Step | Hoạt động | Files BẮT BUỘC | Files NICE-TO-HAVE |
|---|---|---|---|
| **0** | Lock 7 Rules | ICP_WORKFLOW_FINAL.md | — |
| **1** | Build Roadmap | **23 files + mockups.zip** (xem 14.3 dưới) | Optional Tier 7 |
| **2** | Slice Backlog | Same as Step 1 + MASTER_ROADMAP.md | — |
| **3** | Select Slice | MASTER_SLICE_BACKLOG.md + last 3 slice reports | — |
| **4** | Slice Brief | Workflow + slice-specific evidence (xem 14.4) | — |
| **5** | Slice TaskList | Slice Brief + method-specific docs (xem 14.5) | — |
| **6** | Pick Task | Slice TaskList + Slice Brief | — |
| **7** | Task Pack | Workflow + Slice Brief + task-specific evidence | — |
| **8** | Implement | Task Pack + repo state (auto-load) | — |
| **9** | Review | Task Pack + Implementation Report | — |
| **10** | Update TaskList | Slice TaskList + Review verdict | — |

### 14.3 Step 1 + Step 2 — Full Context (23 files + 1 zip) ⭐

Đây là phase nặng nhất về context. **Roadmap quyết định cả dự án → không cut corner.**

**Tier 1 — Anchor docs (3 files, ~80KB):**
```
docs/00_CONTEXT.md              ← project anchor, naming, tech stack
docs/01_ARCHITECTURE.md         ← 3-layer architecture, choreography
docs/04_INTENT_SPECS.md         ← 8 intents functional specs
```

**Tier 2 — Contracts + Data (3 files, ~120KB):**
```
docs/02_DATA_MODEL.md           ← DB schema, events table, behavior_events
docs/03_API_CONTRACTS.md        ← REST + MCP + SSE contracts
docs/08_FE_BE_CONTRACT.md       ← OpenAPI codegen workflow
```

**Tier 3 — Infrastructure (3 files, ~100KB):**
```
docs/06_OBSERVABILITY.md        ← OTel, logs schema
docs/07_BEHAVIOR_LOGS.md        ← User events SDK
docs/09_FIELD_AUDIT.md          ← UI field ↔ data source mapping rule
```

**Tier 4 — Decisions + Audit (3 files, ~80KB):**
```
docs/DECISIONS.md               ← ADR log (TẤT CẢ ADRs đã chốt)
docs/INTENT_AUDIT_REPORT.md     ← Migration roadmap đã spec
docs/LOG_CATALOG.md             ← Log message registry
```

**Tier 5a — Phase 00 deliverables (handoff/ folder, 5 files + 1 zip, ~600KB):**
```
docs/handoff/PHASE_00_HANDOFF.md                   ← Mockup deliverable Phase 00 (summary)
docs/handoff/PHASE_00_CROSS_INTENT_PATTERNS.md     ← Patterns LOCKED (cross-intent)
docs/handoff/PHASE_00_INTENT_01_HANDOFF_DELTA.md   ← v1→v2 patch (Google Trends)
docs/handoff/CROSS_INTENT_BUG_IMPACT_ANALYSIS.md   ← Bug audit cross intents
docs/handoff/PHASE_03_FRONTEND_KICKOFF.md          ← Phase 03 FE kickoff brief
docs/phases/PHASE_00_DESIGN_SYSTEM.md              ← Design tokens v3 (ở phases/, không handoff/)
mockups.zip                                         ← ⭐ 75 HTML + 8 Python builders
```

**Lưu ý folder structure thực tế:**
- `docs/handoff/` chứa **retrospective handoff docs** (sau khi xong 1 phase)
- `docs/phases/` chứa **prospective phase specs** (forward-looking, planning)
- Không nhầm lẫn 2 folders này khi upload

**Tier 5b — Phase Planning Specs ⭐ BẮT BUỘC (6 files, ~150KB):**

⚠️ **MỚI BỔ SUNG v1.3** — Phase specs PHẢI upload Step 1-2.

Lý do: Phase specs chứa **implementation constraints** mà mockup KHÔNG có:
- Tech decisions (JWT exp 24h, Bcrypt cost 10, Vespa rank profile)
- Implementation patterns (LangGraph interrupt, Kafka tracing, idempotency strategy)
- Performance budgets (SSE <1s, Vespa <200ms, Vision <4s)
- Test scenarios cụ thể
- Day-by-day breakdown

→ Roadmap KHÔNG có phase specs = plan ra Stage có thể impossible/incomplete.

```
docs/phases/PHASE_01_INFRA.md          ← Infrastructure + skeleton (Week 1)
docs/phases/PHASE_02_AUTH_SEARCH.md    ← Auth + text search (Week 2)
docs/phases/PHASE_03_IMPORT.md         ← Import by image flagship (Week 3)
docs/phases/PHASE_04_BUY_CART_PAY.md   ← Voice buy + cart + payment (Week 4)
docs/phases/PHASE_05_RECO_ANALYTICS.md ← Recommendation + analytics (Week 5)
docs/phases/PHASE_06_POLISH.md         ← Demo prep + pitch (Week 6)
```

**Per Rule 7 (Evidence Hierarchy):** Phase specs ở priority 4 (Phase planning specs).
Khi conflict với mockup → mockup wins. AI surface conflict, không silent.

**Tier 5c — Migrations (4 SQL files, ~30KB):**
```
infra/migrations/V002__product_enrichment.sql
infra/migrations/V003__insights.sql
infra/migrations/V005__payment_metadata.sql
infra/migrations/V006__analytics_aggregations.sql
```

**Lưu ý mockups.zip:**
- Compress 75 HTML files (8 intents) + 8 `build_intent_XX.py` builder scripts
- Total ~1.5MB raw, ~500-600KB compressed
- AI extract trong sandbox khi cần phân tích — KHÔNG load 75 files vào prompt context

**Tier 6 — Workflow reference (2 files, ~60KB):**
```
docs/workflow/ICP_WORKFLOW_FINAL.md      ← THIS DOC (workflow rules)
docs/workflow/METHODOLOGY_TASK_ANALYSIS.md  ← Methodology backup (EBT/CDP/VSP detail)
```

**Total Tier 1-6:** ~28 files + 1 zip (~1.2MB total) → fit context window (~150K tokens).

#### 14.3.0 Folder Structure Thực Tế Repo ICP ⭐ NEW v1.3

**Quan trọng: Verify đúng path TRƯỚC khi upload.**

```
sicp/                                       # repo root
├── docs/
│   ├── draft/                              # work-in-progress, KHÔNG upload
│   ├── handoff/                            # ⭐ retrospective handoff docs
│   │   ├── 00/                             # subfolder cho Phase 00 details
│   │   ├── CROSS_INTENT_BUG_IMPACT_ANALYSIS.md
│   │   ├── PHASE_00_CROSS_INTENT_PATTERNS.md
│   │   ├── PHASE_00_HANDOFF.md             ⭐ MAIN handoff doc Phase 00
│   │   ├── PHASE_00_INTENT_01_HANDOFF_DELTA.md
│   │   └── PHASE_03_FRONTEND_KICKOFF.md
│   ├── mockups/                            # 75 HTML + 8 builders → zip
│   │   ├── intent-01/ ... intent-08/
│   │   └── (builders inside each intent folder)
│   ├── phases/                             # ⭐ prospective phase SPECS
│   │   ├── _HANDOFF_TEMPLATE.md            # template, không upload
│   │   ├── PHASE_00_DESIGN_SYSTEM.md       # design tokens (KHÔNG ở handoff/)
│   │   ├── PHASE_01_INFRA.md
│   │   ├── PHASE_02_AUTH_SEARCH.md
│   │   ├── PHASE_03_IMPORT.md
│   │   ├── PHASE_04_BUY_CART_PAY.md
│   │   ├── PHASE_05_RECO_ANALYTICS.md
│   │   └── PHASE_06_POLISH.md
│   ├── workflow/                           # ⭐ process docs
│   │   ├── ICP_WORKFLOW_FINAL.md           # THIS DOC
│   │   └── METHODOLOGY_TASK_ANALYSIS.md
│   ├── 00_CONTEXT.md ... 09_FIELD_AUDIT.md  # numbered specs
│   ├── DECISIONS.md
│   ├── INTENT_AUDIT_REPORT.md
│   ├── LOG_CATALOG.md
│   └── PROMPT_TEMPLATES.md
└── infra/
    └── migrations/
        ├── V002__product_enrichment.sql
        ├── V003__insights.sql
        ├── V005__payment_metadata.sql
        └── V006__analytics_aggregations.sql
```

**Sai thường gặp:**
- ❌ `docs/phases/PHASE_00_HANDOFF.md` → SAI, đúng là `docs/handoff/PHASE_00_HANDOFF.md`
- ❌ `docs/handoff/PHASE_00_DESIGN_SYSTEM.md` → SAI, đúng là `docs/phases/PHASE_00_DESIGN_SYSTEM.md`
- ✅ Quy ước: handoff retrospective ở `handoff/`, planning prospective ở `phases/`

#### 14.3.1 Mockup Strategy cho Step 1-2 ⭐

**Lý do CẦN mockup ở Step 1-2 (không defer sang Step 4):**

1. **Rule 6 MOCKUP IS LAW** — Mọi pattern trong mockup PHẢI build. Roadmap không có mockup → vi phạm chính rule mình đặt ra.

2. **Identify hidden complexity** — Có những thứ chỉ thấy được qua mockup, không thấy qua text:
   - Intent 07 có 3 chart types (line + bar + donut) cần render
   - Intent 01 v2 có Market Trend expanded state H (extra so với v1)
   - Intent 06 có OTP 3DS state G (cần payment provider integration)
   - Intent 02 có waveform animation orb pulse phức tạp

3. **Priority decision dựa trên wow factor visual** — Roadmap Stage prioritize theo wow:
   - Stage 4 "AI flows" có wow factor cao? → Xem mockup Intent 01 (vision), 07 (chart) mới biết
   - Mockup nào "WOW for judge" → priority cao trong demo path

4. **Cross-intent pattern reuse identification** — H-UI slice scope phụ thuộc patterns reuse:
   - Component nào dùng cho ≥ 3 intents → MUST extract (atom/molecule)
   - Component nào chỉ 1 intent → có thể inline
   - Không có mockup → không thấy được pattern reuse

5. **8 Python builder scripts trong zip** — Chứa logic generate states + CSS shared:
   - Giúp AI hiểu pattern reuse giữa các states của cùng 1 intent
   - Reveal động (animation, interaction) mà HTML tĩnh không show được
   - Useful để analyze frequency programmatic

**Cách upload mockups.zip (Strategy A — recommend):**

```bash
# Trên máy bạn, zip cả 8 intent folders
cd docs/mockups/
zip -r mockups.zip intent-01/ intent-02/ intent-03/ intent-04/ \
                    intent-05/ intent-06/ intent-07/ intent-08/
# Output: mockups.zip (~500-600KB)
```

**AI sẽ:**
1. Extract zip vào sandbox `/tmp/mockups/`
2. Python script analyze (frequency CSS classes, structural patterns, SVG)
3. Load **summary** vào context (~10K tokens), KHÔNG load 75 raw files
4. Cross-reference với PHASE_00_HANDOFF.md để verify consistency

**Alternative (nếu không zip được):**
- Upload 8 builder scripts riêng (`build_intent_01.py` đến `build_intent_08.py`) — đủ để hiểu component patterns
- + 8 golden mockup HTML (1 file đại diện mỗi intent)
- Total ~250KB → fit context

#### 14.3.2 Total upload cho Step 1-2

| Tier | Files | Size |
|---|---|---|
| Tier 1 (Anchor) | 3 files | ~80KB |
| Tier 2 (Contracts) | 3 files | ~120KB |
| Tier 3 (Infrastructure) | 3 files | ~100KB |
| Tier 4 (Decisions) | 3 files | ~80KB |
| Tier 5a (Phase 00 deliverables) | 6 files + 1 zip | ~600KB |
| Tier 5b (Phase planning specs) ⭐ | 6 files | ~150KB |
| Tier 5c (Migrations) | 4 SQL files | ~30KB |
| Tier 6 (Workflow) | 2 files | ~60KB |
| **Total BẮT BUỘC** | **30 files + 1 zip** | **~1.2MB** |

**Tier 7 — Optional (upload nếu có capacity):**
```
docs/05_CODING_CONVENTIONS.md            ← Code style standards
docs/phases/_HANDOFF_TEMPLATE.md         ← Handoff template format
docs/handoff/PHASE_00_INTENT_XX_MOCKUP_HANDOFF.md × 8  ← Per intent details (optional)
```

**Files KHÔNG upload Step 1-2:**
```
❌ docs/draft/ folder
   → Chỉ là work-in-progress, không stable

❌ Handoff intent-specific full (PHASE_00_INTENT_XX_*)
   → Defer sang Tier 7 optional
   → Đã được summary trong PHASE_00_HANDOFF.md
   → Chi tiết upload Step 4 khi planning slice cho intent đó
```

### 14.4 Step 4 — Slice Brief (depends on slice type)

**Common (mọi slice type):**
```
docs/workflow/ICP_WORKFLOW_FINAL.md
.ai-delivery/TASK_OPERATING_SYSTEM.md
MASTER_ROADMAP.md
MASTER_SLICE_BACKLOG.md
```

#### 14.4.1 Slice ↔ Phase Spec Mapping ⭐ NEW v1.3

Mỗi slice có **chính xác 1 (hoặc 2) phase spec làm primary reference** (priority 4 evidence per Rule 7).
Khi planning slice, AI PHẢI đọc phase spec tương ứng + handle conflict với mockup (priority 1) per Rule 7.

| Slice | Slice Type | Primary Phase Spec | Conflict resolution notes |
|---|---|---|---|
| **S-00** Repo Reality Check | Q-GATE | PHASE_01_INFRA (DoD section) | Check repo state vs PHASE_01 DoD checklist |
| **S-01** UI Foundation | H-UI | PHASE_00_DESIGN_SYSTEM | Mockup wins over spec for visual decisions |
| **S-02** Runtime Foundation | P-CAP | PHASE_01_INFRA (full) | High fidelity spec, follow ngay |
| **S-03** First Auth Flow | V-SLICE | PHASE_02_AUTH_SEARCH (Section A) | Mockup state F-logout có thể conflict với spec; mockup wins |
| **S-04** First Discovery | V-SLICE | PHASE_02_AUTH_SEARCH (Section C, E) | Variant A vs B (mockup) chưa có trong spec; surface conflict |
| **S-05** First Cart/Order | V-SLICE | PHASE_04_BUY_CART_PAY (Section B, F) | Cart UI spec là sidebar, mockup là full-screen page; mockup wins (ADR-05-01) |
| **S-06** First Payment | V-SLICE | PHASE_04_BUY_CART_PAY (Section C-G) | OTP 3DS state G (mockup) chưa trong spec; expand spec |
| **S-07** First Image AI | V-SLICE | PHASE_03_IMPORT (full) | Google Trends (ADR-031) chưa trong spec; ADR wins per priority 2 |
| **S-08** First Voice AI | V-SLICE | PHASE_04_BUY_CART_PAY (Section A) + PHASE_05_RECO_ANALYTICS (Intent 07) | Voice buy + voice analyze trong 2 specs khác nhau |
| **S-09** Recommendation | V-SLICE | PHASE_05_RECO_ANALYTICS (Section A-C, H) | Behavior aggregator critical |
| **S-10** Analytics | V-SLICE | PHASE_05_RECO_ANALYTICS (Section D-F) | Chart spec từ mockup (3 types) vs spec; verify alignment |
| **S-11** Demo Hardening | Q-GATE | PHASE_06_POLISH (full) | Demo script + pitch deck |

**Quy trình AI phải làm trong Step 4 cho mỗi slice:**

1. Đọc phase spec primary tương ứng (Tier 5b BẮT BUỘC ở Step 1, đã có sẵn)
2. Đọc handoff doc retrospective (nếu có, vd PHASE_03_FRONTEND_KICKOFF.md cho slice S-07)
3. Đọc mockup HTML của intent tương ứng
4. **Verify alignment giữa 3 sources** (phase spec + handoff + mockup)
5. **Surface conflicts** per Rule 7 trong section "Risks" của Slice Brief
6. Reference phase spec sections trong Slice Brief evidence list

#### 14.4.2 Per slice type — Files upload thêm cho Step 4

| Slice Type | Slice ID example | Files thêm |
|---|---|---|
| **Q-GATE** (S-00 Repo Reality Check) | S-00, S-11 | Phase spec tương ứng + Repo state listing (auto-load from disk) |
| **H-UI** (S-01 UI Foundation) | S-01 | mockups.zip + PHASE_00_DESIGN_SYSTEM + PHASE_00_CROSS_INTENT_PATTERNS + PHASE_00_HANDOFF |
| **P-CAP** (S-02 Runtime Foundation) | S-02 | **PHASE_01_INFRA** + 03_API_CONTRACTS + 06_OBSERVABILITY + 07_BEHAVIOR_LOGS + 08_FE_BE_CONTRACT + LOG_CATALOG |
| **V-SLICE** Login (S-03) | S-03 | **PHASE_02_AUTH_SEARCH** + 04_INTENT_SPECS (Intent 08) + PHASE_00_INTENT_08_MOCKUP_HANDOFF + 7 mockup HTML Intent 08 + 02_DATA_MODEL (sessions) |
| **V-SLICE** Search (S-04) | S-04 | **PHASE_02_AUTH_SEARCH** + Intent 03 mockup handoff + 14 mockup HTML Intent 03 + Vespa schema spec |
| **V-SLICE** Cart/Order (S-05) | S-05 | **PHASE_04_BUY_CART_PAY** + Intent 05 handoff + mockup + 02_DATA_MODEL (cart Redis pattern) |
| **V-SLICE** Payment (S-06) | S-06 | **PHASE_04_BUY_CART_PAY** + Intent 06 handoff + mockup + V005 migration + payment provider docs |
| **V-SLICE** Image AI (S-07) | S-07 | **PHASE_03_IMPORT** + PHASE_03_FRONTEND_KICKOFF (handoff) + Intent 01 handoff + Intent 01 v2 delta + mockup + image storage ADR |
| **V-SLICE** Voice AI (S-08) | S-08 | **PHASE_04_BUY_CART_PAY** (Voice section) + **PHASE_05_RECO_ANALYTICS** (Intent 07) + Intent 02 + Intent 07 handoff + mockup + Gemini STT contract |
| **V-SLICE** Recommend (S-09) | S-09 | **PHASE_05_RECO_ANALYTICS** + Intent 04 handoff + mockup + Vespa recommend tool spec |
| **V-SLICE** Analytics (S-10) | S-10 | **PHASE_05_RECO_ANALYTICS** + Intent 07 handoff + mockup + V006 migration + chart specs |
| **Q-GATE** (S-11 Polish) | S-11 | **PHASE_06_POLISH** + demo script + pitch deck draft |

### 14.5 Step 5 — Slice TaskList (depends on method)

**Method-specific docs:**

**EBT v2 (H-UI slices):**
```
mockups.zip                                ← 75 HTML files
docs/phases/PHASE_00_DESIGN_SYSTEM.md      ← Token values cụ thể
docs/phases/PHASE_00_CROSS_INTENT_PATTERNS.md  ← Patterns LOCKED
docs/phases/PHASE_00_HANDOFF.md            ← Component summary
docs/05_CODING_CONVENTIONS.md              ← Component structure rules
```

**CDP (P-CAP slices):**
```
docs/03_API_CONTRACTS.md
docs/06_OBSERVABILITY.md
docs/07_BEHAVIOR_LOGS.md
docs/08_FE_BE_CONTRACT.md
docs/LOG_CATALOG.md
docs/02_DATA_MODEL.md (event envelope section)
```

**VSP (D/V-SLICE):**
```
Per intent mockup handoff (PHASE_00_INTENT_XX_MOCKUP_HANDOFF.md)
Intent-specific mockup HTML files (5-14 files)
docs/04_INTENT_SPECS.md (relevant intent section)
docs/02_DATA_MODEL.md (relevant schema)
docs/03_API_CONTRACTS.md (relevant endpoints)
```

### 14.6 Step 7 — Task Pack (focused, ~5-8 files)

```
docs/workflow/ICP_WORKFLOW_FINAL.md        ← MUST (for 7 Rules)
slices/S-XX_BRIEF.md                       ← MUST (slice context)
slices/S-XX_TASKLIST.md                    ← MUST (where this task fits)
<task-specific evidence>                   ← 2-5 files focused
```

**Ví dụ Task S03-T05 (Login walking skeleton):**
```
docs/workflow/ICP_WORKFLOW_FINAL.md
slices/S-03_BRIEF.md
slices/S-03_TASKLIST.md
docs/03_API_CONTRACTS.md (auth section only)
docs/02_DATA_MODEL.md (sessions table only)
mockups/intent-08/intent-08-state-A-login.html
mockups/intent-08/intent-08-state-B-loading.html
mockups/intent-08/intent-08-state-C-wrong-password.html
.ai-delivery/COMPONENT_REGISTRY.md (from S-01 output)
```

### 14.7 Quy ước context budget

| Conversation type | Context budget | Notes |
|---|---|---|
| Setup (Step 0+1+2) | ~120K tokens | Full Tier 1-6 |
| Slice planning (Step 4+5) | ~80K tokens | Slice-type specific |
| Task execution (Step 7+8) | ~50K tokens | Focused |
| Review (Step 9) | ~30K tokens | Task pack + report |

**Rule of thumb:** Nếu upload > 150K tokens → tách thành 2 conversations.

### 14.8 Folder structure khuyến nghị (sau khi adopt workflow)

```
sicp/                                        # repo root
├── .ai-delivery/                            # workflow operational files
│   ├── TASK_OPERATING_SYSTEM.md             # 7 Rules (Step 0)
│   └── COMPONENT_REGISTRY.md                # output of S-01 H-UI slice
├── MASTER_ROADMAP.md                        # Step 1 output
├── MASTER_SLICE_BACKLOG.md                  # Step 2 output
├── slices/                                  # per-slice docs
│   ├── S-00_BRIEF.md
│   ├── S-00_TASKLIST.md
│   ├── S-01_BRIEF.md
│   ├── S-01_TASKLIST.md
│   └── ...
├── taskpacks/                               # per-task pack
│   ├── S00-T01_<NAME>.md
│   ├── S01-T01_<NAME>.md
│   └── ...
├── reports/                                 # implementation reports
│   ├── S00-T01_REPORT.md
│   └── ...
├── reviews/                                 # review verdicts
│   ├── S00-T01_REVIEW.md
│   └── ...
└── docs/                                    # existing project docs (unchanged)
    ├── workflow/
    │   ├── ICP_WORKFLOW_FINAL.md
    │   └── METHODOLOGY_TASK_ANALYSIS.md
    ├── phases/
    ├── handoff/
    ├── mockups/
    ├── 00_CONTEXT.md
    └── ...
```

---

## 15. Next Action

Khi bạn approve doc này, mở conversation mới với prompt sau:

```
ICP Workflow — Step 0 + 1 + 2 Setup (Roadmap + Slice Backlog)

Tôi đã approve workflow tại docs/workflow/ICP_WORKFLOW_FINAL.md (v1.3 TRUTH SOURCE).

Apply Steps 0-1-2 với 3 deliverables:
1. Step 0: Tạo .ai-delivery/TASK_OPERATING_SYSTEM.md với 7 Rules
   (theo Section 3 của ICP_WORKFLOW_FINAL.md)
2. Step 1: Tạo MASTER_ROADMAP.md (5 Stages)
   (theo Section 4 Step 1 của workflow doc)
3. Step 2: Tạo MASTER_SLICE_BACKLOG.md (~11 slices: S-00 đến S-11)
   (theo Section 4 Step 2 + Section 14.4.1 Slice ↔ Phase Spec Mapping)

## Files upload (Tier 1-6 BẮT BUỘC, 30 files + 1 zip)

### Tier 1 — Anchor docs (3 files)
- docs/00_CONTEXT.md
- docs/01_ARCHITECTURE.md
- docs/04_INTENT_SPECS.md

### Tier 2 — Contracts + Data (3 files)
- docs/02_DATA_MODEL.md
- docs/03_API_CONTRACTS.md
- docs/08_FE_BE_CONTRACT.md

### Tier 3 — Infrastructure (3 files)
- docs/06_OBSERVABILITY.md
- docs/07_BEHAVIOR_LOGS.md
- docs/09_FIELD_AUDIT.md

### Tier 4 — Decisions + Audit (3 files)
- docs/DECISIONS.md
- docs/INTENT_AUDIT_REPORT.md
- docs/LOG_CATALOG.md

### Tier 5a — Phase 00 deliverables / Handoff (5 files + 1 zip)
- docs/handoff/PHASE_00_HANDOFF.md
- docs/handoff/PHASE_00_CROSS_INTENT_PATTERNS.md
- docs/handoff/PHASE_00_INTENT_01_HANDOFF_DELTA.md
- docs/handoff/CROSS_INTENT_BUG_IMPACT_ANALYSIS.md
- docs/handoff/PHASE_03_FRONTEND_KICKOFF.md
- docs/phases/PHASE_00_DESIGN_SYSTEM.md
- mockups.zip ⭐ (75 HTML + 8 Python builders, ~500-600KB compressed)

### Tier 5b — Phase Planning Specs ⭐ BẮT BUỘC (6 files)
- docs/phases/PHASE_01_INFRA.md
- docs/phases/PHASE_02_AUTH_SEARCH.md
- docs/phases/PHASE_03_IMPORT.md
- docs/phases/PHASE_04_BUY_CART_PAY.md
- docs/phases/PHASE_05_RECO_ANALYTICS.md
- docs/phases/PHASE_06_POLISH.md

### Tier 5c — Migrations (4 SQL files)
- infra/migrations/V002__product_enrichment.sql
- infra/migrations/V003__insights.sql
- infra/migrations/V005__payment_metadata.sql
- infra/migrations/V006__analytics_aggregations.sql

### Tier 6 — Workflow reference (2 files)
- docs/workflow/ICP_WORKFLOW_FINAL.md (this doc)
- docs/workflow/METHODOLOGY_TASK_ANALYSIS.md

Total: 30 files + 1 zip, ~1.2MB.

## Quy trình phân tích đa nguồn ⭐ NEW v1.3

AI phải đọc và CROSS-REFERENCE 3 nguồn evidence:

### Source 1: Phase planning specs (Tier 5b, priority 4)
- 6 phase specs ⭐⭐⭐⭐⭐ high fidelity (PHASE_01-06)
- Chứa: tech decisions, day-by-day breakdown, DoD, test scenarios
- Vd: JWT exp 24h, Bcrypt cost 10, Kafka tracing pattern, behavior aggregator schedule

### Source 2: Phase handoff retrospective (Tier 5a, priority 3)
- 5 handoff docs trong docs/handoff/
- Chứa: actual state Phase 00, decisions ad-hoc, lessons learned
- Vd: PHASE_00_HANDOFF summary 8 intents mockup, CROSS_INTENT_PATTERNS LOCKED

### Source 3: Mockup evidence (priority 1 - MOCKUP IS LAW)
- 75 HTML + 8 Python builders trong mockups.zip
- Chứa: actual visual contract demo
- AI extract + analyze frequency CSS + identify hidden complexity

### Conflict resolution per Rule 7

Khi 3 sources conflict, priority order:
1. Mockup (Rule 6 MOCKUP IS LAW wins always)
2. Recent ADRs (DECISIONS.md)
3. Phase handoff retrospective (docs/handoff/)
4. Phase planning specs (docs/phases/PHASE_0X_*.md) ← có thể outdated
5. General specs (00_CONTEXT, 04_INTENT_SPECS)
6. Repo state

AI MUST surface conflicts trong Section "Risks" của outputs, không silent.

## Mockup analysis instruction

Mockups.zip chứa 75 HTML files (8 intents) + 8 Python builder scripts.
KHÔNG load 75 files vào prompt context. Thay vào đó:

1. Extract zip vào sandbox (vd /tmp/mockups/)
2. Đọc 8 builder scripts (build_intent_XX.py) để hiểu component patterns
3. Analyze frequency CSS classes + structural patterns (Python script)
4. Load **summary** (~10K tokens) vào context, không load raw HTML
5. Cross-reference với PHASE_00_HANDOFF.md + phase specs để verify consistency

Output expected từ analyze:
- Frequency table CSS classes + components
- Hidden complexity flags (vd Intent 07 có 3 chart types)
- Cross-intent reuse patterns
- Conflicts flagged (mockup vs phase spec)
→ Dùng những info này khi tạo MASTER_ROADMAP.md (Step 1) + MASTER_SLICE_BACKLOG.md (Step 2)

## Output mong muốn (3 files commit vào git)

1. .ai-delivery/TASK_OPERATING_SYSTEM.md (7 Rules locked, theo Section 3 workflow doc)
2. MASTER_ROADMAP.md (5 Stages với rationale từ mockup + phase specs evidence)
3. MASTER_SLICE_BACKLOG.md (~11 slices với:
   - Slice ID, Name, Goal, Type, Priority
   - Phase Spec Reference per slice (per Section 14.4.1 mapping)
   - Cross-slice dependencies
   - Known conflicts flagged)

Sau đó tôi sẽ pick first slice (Step 3) trong conversation tiếp theo.

## Constraints (PHẢI follow per workflow doc)

- Follow đúng 7 Rules trong Section 3 của workflow doc
- KHÔNG tự decide slice priority — đề xuất, đợi tôi confirm
- KHÔNG plan chi tiết task của slices (đó là Step 5 sau, không phải Step 2)
- Nếu phát hiện evidence conflict (mockup vs phase spec) → surface per Rule 7, không silent
- Output files theo template ở Section 4 (Step 0, 1, 2) workflow doc
- Mockup IS LAW (Rule 6) — roadmap phải reflect mọi pattern wow trong mockup
- Phase specs có thể được expand/refine khi planning slice cụ thể ở Step 4-5
  (KHÔNG modify phase specs ở Step 1-2)
```

---

**END OF WORKFLOW DOC.**

**Generated:** 2026-05-17
**Version:** 1.3 (TRUTH SOURCE)
**Status:** ⭐ Approved by user → Authoritative reference for dự án ICP
**Approver:** User
**Changelog:**
- v1.0 (initial): HPSD framework + 3 methods + 3 enhancements
- v1.1: Added Section 14 (Files Upload Matrix per Step) — fix Step 1 thiếu context
- v1.2: Added mockups.zip + Section 14.3.1 Mockup Strategy — roadmap cần mockup evidence
- v1.3: 4 fixes major:
  * Fix folder paths (docs/handoff/ vs docs/phases/) per repo structure thực tế
  * PROMOTE Phase 01-06 specs → Tier 5b BẮT BUỘC (rated ⭐⭐⭐⭐⭐ high fidelity)
  * Update Rule 7 Evidence Hierarchy (phase planning specs ở priority 4)
  * Add Section 14.4.1 Slice ↔ Phase Spec Mapping với conflict resolution

**Phase Specs Fidelity Assessment (verified v1.3):**
- PHASE_01_INFRA: ⭐⭐⭐⭐⭐ — docker-compose, 7-day breakdown, OTel setup
- PHASE_02_AUTH_SEARCH: ⭐⭐⭐⭐⭐ — JWT/Bcrypt config, behavior tracker plan
- PHASE_03_IMPORT: ⭐⭐⭐⭐⭐ — LangGraph interrupt, 5 card UI variants, Policy DSL
- PHASE_04_BUY_CART_PAY: ⭐⭐⭐⭐⭐ — Kafka tracing, choreography 3 workers
- PHASE_05_RECO_ANALYTICS: ⭐⭐⭐⭐⭐ — Behavior aggregator, co-purchased SQL
- PHASE_06_POLISH: ⭐⭐⭐⭐⭐ — Demo script 8min, pitch deck 10 slides, risks matrix

**Khi đọc doc này:**
1. Section 0-3 → triết lý + rules bất biến (đọc trước)
2. Section 4 → 10 Steps workflow (đọc khi cần execute step)
3. Section 5 → method matrix cho từng slice type
4. Section 14 → Files Upload Matrix per Step (reference khi mở conversation mới)
5. Section 14.4.1 → Slice ↔ Phase Spec Mapping (reference khi planning slice)
6. Section 15 → Next Action prompt (copy-paste cho conversation Step 0+1+2)

**Khi cần update doc:**
- Bump version (v1.X → v1.Y)
- Update changelog
- Note rõ section nào thay đổi
- Lock vào git với commit message rõ ràng
