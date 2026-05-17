# ICP Session Guide — Hướng Dẫn Thực Hành Workflow Per Phiên Chat

> **Version:** 1.0
> **Date:** 2026-05-17
> **Mục đích:** Doc thực hành hằng ngày. Mỗi lần mở phiên chat mới, mở doc này → biết upload gì, làm gì, output gì, update gì.
> **Companion doc:** `ICP_WORKFLOW_FINAL.md` v1.3 (TRUTH SOURCE — workflow rules)
> **Quan hệ:** SESSION_GUIDE = "how to do", WORKFLOW = "what + why"

---

## Mục Lục

- [Phần 1: Hiểu chu trình update giữa các phiên](#phần-1)
- [Phần 2: Living Documents là gì](#phần-2)
- [Phần 3: Checklist cuối mỗi phiên](#phần-3)
- [Phần 4: Chi tiết 35 phiên chat](#phần-4)
- [Phần 5: Template prompt sẵn dùng](#phần-5)
- [Phần 6: Troubleshooting](#phần-6)

---

<a name="phần-1"></a>
## Phần 1: Hiểu Chu Trình Update Giữa Các Phiên ⭐

### 1.1 Vấn đề cốt lõi

Mỗi phiên chat = context refresh. AI **không nhớ** phiên trước. Vậy làm sao đảm bảo:
1. AI phiên N biết phiên N-1 đã làm gì?
2. Plan thay đổi sau implementation (Step 10 Living Document)?
3. Files quan trọng không bị mất/quên?

**Câu trả lời:** Sau mỗi phiên, **bạn (human) update các "living documents"** + **commit Git**. Phiên sau, upload các living documents này → AI có đủ context.

### 1.2 Living Documents là gì (chi tiết)

**Living documents** = các file thay đổi theo thời gian, update sau mỗi phiên.

```
KHÔNG LIVING (lock 1 lần, không sửa):
  ✅ docs/00_CONTEXT.md, 01_ARCHITECTURE.md, ...  (general specs)
  ✅ docs/phases/PHASE_0X_*.md                     (phase planning specs)
  ✅ docs/handoff/PHASE_00_*.md                    (Phase 00 retrospective)
  ✅ infra/migrations/*.sql                        (DB schema, immutable)
  ✅ docs/workflow/ICP_WORKFLOW_FINAL.md           (workflow truth source)
  ✅ .ai-delivery/TASK_OPERATING_SYSTEM.md         (7 Rules locked sau Phiên 1)
  ✅ MASTER_ROADMAP.md                             (5 Stages, hiếm khi sửa)

LIVING (update sau mỗi phiên):
  ⭐ MASTER_SLICE_BACKLOG.md                      (status slice: TODO → IN_PROGRESS → DONE)
  ⭐ .ai-delivery/COMPONENT_REGISTRY.md           (sau mỗi phiên S-01 build component mới)
  ⭐ slices/S-XX_TASKLIST.md                      (task status, có thể thêm task mới)
  ⭐ slices/S-XX_BRIEF.md                         (hiếm update, chỉ khi scope thay đổi)
```

### 1.3 Workflow giữa các phiên — 4 bước

```
Cuối Phiên N:
  ↓
Bước 1: AI tạo outputs đầy đủ trong phiên
  - Files mới (brief, tasklist, task pack, report, review)
  - Code changes (nếu execution phiên)
  - AI update living docs trong context
  ↓
Bước 2: Human download outputs từ AI
  - Save vào folder structure chuẩn
  - Verify đủ files theo checklist
  ↓
Bước 3: Human commit Git
  - git add -A
  - git commit -m "Phiên N: <summary>"
  - git push
  ↓
Bước 4: Human chuẩn bị Phiên N+1
  - Đọc workflow doc Section 14 → biết files upload cho phiên sau
  - Đọc tasklist mới → biết task tiếp theo
  - Note conflicts/blockers cần resolve
  ↓
Mở Phiên N+1:
  ↓
Bước 5: Upload bundle phù hợp
  - Common files (workflow, TOS, masters)
  - Slice context (brief, tasklist)
  - Task-specific evidence
  ↓
... lặp lại
```

### 1.4 Bảng update sau mỗi loại phiên

| Loại Phiên | Steps | Living docs update | Static docs (chỉ tạo mới) |
|---|---|---|---|
| **Setup (Phiên 1)** | 0+1+2 | — (tạo mới hoàn toàn) | TASK_OPERATING_SYSTEM, MASTER_ROADMAP, MASTER_SLICE_BACKLOG |
| **Slice Planning** | 3+4+5 | MASTER_SLICE_BACKLOG (status: IN_PROGRESS) | slices/S-XX_BRIEF, slices/S-XX_TASKLIST, reports/S-XX_*_REPORT (intermediate) |
| **Task Execution** | 6+7+8+9+10 | slices/S-XX_TASKLIST (T0X DONE), COMPONENT_REGISTRY (nếu component mới) | taskpacks/SXX-TYY, reports/SXX-TYY, reviews/SXX-TYY, code files |
| **Slice Complete** | last task của slice | MASTER_SLICE_BACKLOG (S-XX status: DONE) | (none) |

---

<a name="phần-2"></a>
## Phần 2: Living Documents Chi Tiết

### 2.1 MASTER_SLICE_BACKLOG.md (update sau mỗi slice)

**Tạo:** Phiên 1
**Update khi:** Bắt đầu slice mới + Hoàn thành slice

**Trước khi bắt đầu slice S-01:**
```markdown
| S-01 | Minimal UI Foundation | Build reusable UI components | H-UI | P0 | TODO |
```

**Sau khi bắt đầu (đầu Phiên 3 planning):**
```markdown
| S-01 | Minimal UI Foundation | Build reusable UI components | H-UI | P0 | IN_PROGRESS (planning) |
```

**Sau khi xong execution (cuối Phiên 7):**
```markdown
| S-01 | Minimal UI Foundation | Build reusable UI components | H-UI | P0 | DONE (2026-05-25) |
```

**Add notes nếu có thay đổi:**
```markdown
| S-01 | Minimal UI Foundation | Build reusable UI components | H-UI | P0 | DONE (2026-05-25) |
| | Notes: | Tăng từ 25 → 28 components do phát hiện wow patterns trong mockup |
```

### 2.2 COMPONENT_REGISTRY.md (update sau mỗi phiên S-01)

**Tạo:** Phiên 4 (đầu execution S-01)
**Update khi:** Mỗi task S-01 hoàn thành, có component mới

**Format chuẩn (mỗi entry):**
```markdown
## <Button> — apps/web/src/components/ui/button/
- **Variants:** primary | success | premium | ghost | danger | hero-cta-white | hero-cta-glass | white-on-pink
- **Props:** { variant, size: 'sm'|'md'|'lg', leftIcon?, rightIcon?, loading?, fullWidth?, ...HTMLButtonAttrs }
- **Visual ref:** intent-08-state-A-login.html (primary), intent-05-state-G (success confetti)
- **Tokens used:** --grad-mic, --grad-hero, --shadow-pink-md
- **Dependencies:** <Icon>, <Spinner>
- **Built in:** Phiên 4, Task S01-T01
- **Tests:** button.test.tsx (variants render + loading state) ✅
- **Status:** v1 stable
```

**Tại sao quan trọng:**
- Phiên sau dùng `<Button>`, AI đọc registry → biết props gì, không tự đoán
- Tránh drift API giữa các phiên
- Slice S-03+ (vertical slices) reference registry để wire FE

### 2.3 slices/S-XX_TASKLIST.md (update sau mỗi task)

**Tạo:** Phiên Planning (Phiên 3 cho S-01, Phiên 8 cho S-02, ...)
**Update khi:** Mỗi task xong, có task mới phát sinh

**Trước task:**
```markdown
| S01-T01 | Foundation + Atoms batch 1 | H-UI | P0 | none | apps/web setup + 5 atoms | TODO |
| S01-T02 | Atoms batch 2 | H-UI | P0 | T01 | 5 atoms còn lại | TODO |
```

**Sau task T01 xong (cuối Phiên 4):**
```markdown
| S01-T01 | Foundation + Atoms batch 1 | H-UI | P0 | none | apps/web setup + 5 atoms | ✅ DONE |
| S01-T02 | Atoms batch 2 | H-UI | P0 | T01 | 5 atoms còn lại | NEXT |
| S01-T07 | (NEW) Fix Tailwind v4 config issue | H-UI | P1 | T01 | tokens.css fix | TODO |
```

**Quan trọng:**
- Status PHẢI update (TODO/IN_PROGRESS/✅ DONE/⚠️ BLOCKED)
- Nếu phát sinh task mới → add với ID continuation (T07, T08...)
- Nếu defer task → mark `DEFERRED to S-XX`

### 2.4 Bảng tổng hợp living docs

| Living Doc | Update tần suất | Update bởi ai | Update khi nào |
|---|---|---|---|
| MASTER_SLICE_BACKLOG | ~11 lần | Human (sau khi AI report) | Bắt đầu + Kết thúc mỗi slice |
| COMPONENT_REGISTRY | ~5 lần (S-01 only) | AI tạo, Human verify | Cuối mỗi phiên S-01 execution |
| S-XX_TASKLIST | ~3-5 lần per slice | AI update, Human verify | Cuối mỗi phiên execution |
| S-XX_BRIEF | Hiếm | Human nếu scope thay đổi | Khi mockup/spec change |

---

<a name="phần-3"></a>
## Phần 3: Checklist Cuối Mỗi Phiên ⭐

### 3.1 Checklist universal (mọi phiên)

**Trước khi đóng phiên chat:**

- [ ] **Outputs đầy đủ?** Verify files tạo mới + files update đã có
- [ ] **Files đã save về máy?** Download từ AI hoặc copy nội dung
- [ ] **Folder structure đúng?** Check files vào đúng chỗ:
  - Slice docs → `slices/`
  - Task packs → `taskpacks/`
  - Reports → `reports/`
  - Reviews → `reviews/`
  - Code → `apps/web/`, `apps/gateway/`, ...
- [ ] **Living docs đã update?** Bảng dưới
- [ ] **Git commit đã làm?** Với message rõ ràng
- [ ] **Phiên tiếp theo biết làm gì?** Note xuống

### 3.2 Checklist theo loại phiên

#### Loại A: Setup Phiên (chỉ Phiên 1)

- [ ] `.ai-delivery/TASK_OPERATING_SYSTEM.md` có 7 Rules
- [ ] `MASTER_ROADMAP.md` có 5 Stages
- [ ] `MASTER_SLICE_BACKLOG.md` có 11 slices (S-00 đến S-11)
- [ ] Mỗi slice có: ID, Name, Goal, Type, Priority, Status (all TODO)
- [ ] Phase Spec Reference per slice (cột mới theo Section 14.4.1)
- [ ] AI surface conflicts (nếu có) trong appendix
- [ ] Git commit: `"Phiên 1: Setup workflow + roadmap + slice backlog v1.0"`

#### Loại B: Slice Planning Phiên (Phiên 3, 8, 13, 17, 21, 24, 28, 32, ...)

- [ ] `slices/S-XX_BRIEF.md` đầy đủ format Section 4 Step 4
- [ ] `slices/S-XX_TASKLIST.md` đầy đủ format Section 4 Step 5
- [ ] Intermediate reports nếu method requires:
  - H-UI: `reports/S-XX_FREQUENCY_REPORT.md` + `reports/S-XX_SEMANTIC_COMPONENTS.md`
  - P-CAP: `reports/S-XX_CAPABILITY_MATRIX.md`
  - V-SLICE: `reports/S-XX_LAYER_MATRIX.md`
- [ ] **Update MASTER_SLICE_BACKLOG:** S-XX status `TODO → IN_PROGRESS (planning)`
- [ ] Conflicts flagged trong S-XX_BRIEF Section "Risks"
- [ ] Git commit: `"Phiên N: S-XX planning — <Slice Name>"`

#### Loại C: Task Execution Phiên (Phiên 2, 4-7, 9-12, 14-16, ...)

**Đây là loại phiên nhiều nhất (~25 phiên trong tổng 35).**

- [ ] `taskpacks/SXX-TYY_*.md` với Stop Conditions
- [ ] Code files đã commit (apps/web, apps/gateway, ...)
- [ ] `reports/SXX-TYY_REPORT.md` đầy đủ:
  - Files Changed
  - What Was Implemented
  - Commands Run + output
  - Test Results
  - Deviations
  - Known Issues
  - Cross-Slice Integration Check ⭐
- [ ] `reviews/SXX-TYY_REVIEW.md` với 9 Gates verdict (PASS/FIX/REJECT)
- [ ] **Update `slices/S-XX_TASKLIST.md`:** Task TYY status `TODO → ✅ DONE`
- [ ] **Update `COMPONENT_REGISTRY.md`** nếu có component mới (S-01 phiên)
- [ ] **Update MASTER_SLICE_BACKLOG** nếu slice xong (last task)
- [ ] Git commit: `"Phiên N: SXX-TYY <Task Name> — PASS/FIX"`

### 3.3 Bảng quick reference

| Phiên type | File mới tạo | File update | Code? |
|---|---|---|---|
| Setup | TOS, ROADMAP, BACKLOG | — | No |
| Slice Planning | BRIEF, TASKLIST, intermediate reports | BACKLOG status | No |
| Task Execution | TASKPACK, REPORT, REVIEW, code | TASKLIST status, REGISTRY (if S-01) | **Yes** |
| Slice Complete (last task) | (same as Task Execution) + handoff note | BACKLOG status DONE | Yes |

---

<a name="phần-4"></a>
## Phần 4: Chi Tiết 35 Phiên Chat

### Phiên 1 — Setup Workflow + Master Planning

**Mục đích:** Lock 7 Rules + Tạo roadmap 5 Stages + Chia 11 slices backlog.

**Files upload (30 + 1 zip, ~1.2MB):**

Trước phiên, chuẩn bị mockups.zip:
```bash
cd docs/mockups/
zip -r ../../mockups.zip intent-01/ intent-02/ intent-03/ intent-04/ \
                          intent-05/ intent-06/ intent-07/ intent-08/
```

Upload theo 6 tiers:
```
Tier 1 (3): 00_CONTEXT, 01_ARCHITECTURE, 04_INTENT_SPECS
Tier 2 (3): 02_DATA_MODEL, 03_API_CONTRACTS, 08_FE_BE_CONTRACT
Tier 3 (3): 06_OBSERVABILITY, 07_BEHAVIOR_LOGS, 09_FIELD_AUDIT
Tier 4 (3): DECISIONS, INTENT_AUDIT_REPORT, LOG_CATALOG
Tier 5a (5+zip): handoff/PHASE_00_HANDOFF, handoff/PHASE_00_CROSS_INTENT_PATTERNS,
                 handoff/PHASE_00_INTENT_01_HANDOFF_DELTA, handoff/CROSS_INTENT_BUG_IMPACT_ANALYSIS,
                 handoff/PHASE_03_FRONTEND_KICKOFF, phases/PHASE_00_DESIGN_SYSTEM, mockups.zip
Tier 5b (6): phases/PHASE_01_INFRA through PHASE_06_POLISH
Tier 5c (4 SQL): V002, V003, V005, V006
Tier 6 (2): workflow/ICP_WORKFLOW_FINAL, workflow/METHODOLOGY_TASK_ANALYSIS
```

**Prompt:** Copy nguyên Section 15 của ICP_WORKFLOW_FINAL.md.

**Output (3 files):**
- `.ai-delivery/TASK_OPERATING_SYSTEM.md` (7 Rules)
- `MASTER_ROADMAP.md` (5 Stages)
- `MASTER_SLICE_BACKLOG.md` (11 slices)

**Update sau phiên:** — (tạo mới hoàn toàn)

**Git commit:** `"Phiên 1: Setup workflow v1.3 — 7 Rules + Roadmap + Backlog"`

**Effort:** 2-3 giờ.

---

### Phiên 2 — Slice S-00 Repo Reality Check (Q-GATE)

**Mục đích:** Audit hiện trạng repo, identify gaps trước khi build mới.

**Files upload (~13 files):**
```
Common (4):
  - workflow/ICP_WORKFLOW_FINAL.md
  - .ai-delivery/TASK_OPERATING_SYSTEM.md
  - MASTER_ROADMAP.md
  - MASTER_SLICE_BACKLOG.md

Slice-specific cho S-00 (9):
  - phases/PHASE_01_INFRA.md (primary — DoD checklist)
  - 00_CONTEXT.md (folder structure expected)
  - 01_ARCHITECTURE.md
  - 02_DATA_MODEL.md
  - infra/migrations/V002_*.sql, V003_*.sql, V005_*.sql, V006_*.sql
```

**Prompt:**
```
ICP Workflow — Phiên 2: Slice S-00 Repo Reality Check

Context: Phiên 1 đã setup workflow + roadmap + backlog.
Hôm nay execute toàn bộ Slice S-00 (Q-GATE — audit, không code feature).

Apply Steps 3-10 cho S-00:
- Step 3: Confirm S-00 (đầu backlog)
- Step 4: Tạo slices/S-00_BRIEF.md
- Step 5: Tạo slices/S-00_TASKLIST.md (~3-5 audit tasks)
- Step 6-7: Pick task + tạo task pack
- Step 8: Execute audit với bash/view tools
- Step 9: Review per 9 Gates
- Step 10: Update tasklist + tạo S-00_REPORT.md

Goal: Compare repo state vs PHASE_01_INFRA DoD checklist.
Output cuối: reports/S00-REPORT.md với findings.

Constraints:
- KHÔNG code feature mới, chỉ audit
- Follow 7 Rules
- 9 Gates check
- Surface conflicts per Rule 7
```

**Output:**
- `slices/S-00_BRIEF.md`
- `slices/S-00_TASKLIST.md`
- `taskpacks/S00-T01_*.md` đến `S00-T0X_*.md`
- `reports/S00-REPORT.md` ⭐ (findings file quan trọng nhất)
- `reviews/S00_REVIEW.md`

**Update sau phiên:**
- ⭐ `MASTER_SLICE_BACKLOG.md`: S-00 status `TODO → ✅ DONE`

**Git commit:** `"Phiên 2: S-00 Repo Reality Check — audit findings"`

**Effort:** 2-3 giờ.

---

### Phiên 3 — Slice S-01 Planning (H-UI, EBT v2)

**Mục đích:** Phân tích mockup để output detailed component tasklist.

**Files upload (~13 files + zip):**
```
Common (4):
  - workflow, TOS, ROADMAP, BACKLOG

Slice-specific cho S-01 (8 + zip):
  - phases/PHASE_00_DESIGN_SYSTEM.md (primary — token values)
  - handoff/PHASE_00_HANDOFF.md
  - handoff/PHASE_00_CROSS_INTENT_PATTERNS.md
  - handoff/PHASE_00_INTENT_01_HANDOFF_DELTA.md
  - mockups.zip ⭐ (75 HTML + 8 builders)
  - 05_CODING_CONVENTIONS.md
  - reports/S00-REPORT.md (từ Phiên 2 — biết apps/web đã có gì)
```

**Prompt:**
```
ICP Workflow — Phiên 3: Slice S-01 Planning (H-UI — EBT v2)

Context: S-00 audit xong (xem reports/S00-REPORT.md).
Hôm nay plan S-01 UI Foundation — apply EBT v2 method.

Apply Steps 3-5 cho S-01:
- Step 4: Tạo slices/S-01_BRIEF.md
- Step 5: Apply EBT v2 method:
  1. SCAN: Extract mockups.zip vào sandbox, parse 75 HTML
  2. COUNT: Đếm frequency CSS classes + SVG patterns
  3. SEMANTIC_NORMALIZE: Gom thành semantic components (4 sub-rules)
     - Component vs Utility filter
     - Compound merging
     - Variants identification
     - MOCKUP IS LAW (Rule 6) — không skip wow patterns
  4. CLASSIFY: Atom/Molecule/Organism/Utility
  5. BUDGET: Map vào ~5-7 task buckets dependency order

Output:
- slices/S-01_BRIEF.md
- reports/S-01_FREQUENCY_REPORT.md (Bước 1+2 output)
- reports/S-01_SEMANTIC_COMPONENTS.md (Bước 3+4 output)
- slices/S-01_TASKLIST.md (~5-7 tasks)

Constraints:
- KHÔNG code yet, chỉ planning
- Apply method matrix Section 5.1 (H-UI → EBT v2)
- MOCKUP IS LAW (Rule 6)
```

**Output:**
- `slices/S-01_BRIEF.md`
- `reports/S-01_FREQUENCY_REPORT.md`
- `reports/S-01_SEMANTIC_COMPONENTS.md`
- `slices/S-01_TASKLIST.md`

**Update sau phiên:**
- ⭐ `MASTER_SLICE_BACKLOG.md`: S-01 status `TODO → IN_PROGRESS (planning done)`

**Git commit:** `"Phiên 3: S-01 Planning — EBT v2 frequency analysis"`

**Effort:** 3-4 giờ.

---

### Phiên 4 — S-01 Task 1 (Foundation + Atoms batch 1)

**Mục đích:** Setup Next.js + Tailwind + tokens + PhoneFrame + 5 atoms cơ bản.

**Files upload (~11 files):**
```
Common (4):
  - workflow, TOS, slices/S-01_BRIEF, slices/S-01_TASKLIST

Task-specific (7):
  - reports/S-01_SEMANTIC_COMPONENTS.md (component definitions)
  - phases/PHASE_00_DESIGN_SYSTEM.md (token values)
  - handoff/PHASE_00_CROSS_INTENT_PATTERNS.md (PhoneFrame constraints)
  - 2-3 mockup HTML golden states (vd intent-08-state-A-login.html)
  - 05_CODING_CONVENTIONS.md
  - reports/S00-REPORT.md (biết apps/web đã có gì chưa)
```

**Prompt:**
```
ICP Workflow — Phiên 4: Task S01-T01 Foundation + Atoms Batch 1

Context: S-01 đã plan xong (xem S-01_TASKLIST có 5-7 tasks).
Hôm nay execute Task T01 đầu tiên.

Apply Steps 6-10:
- Step 6: Confirm T01 (foundation + atoms cơ bản)
- Step 7: Tạo taskpacks/S01-T01_FOUNDATION_ATOMS.md với Stop Conditions
- Step 8: Implement:
  - apps/web/ init Next.js 14 + Tailwind v3 + shadcn/ui
  - tokens.css với CSS variables (theo PHASE_00_DESIGN_SYSTEM)
  - tailwind.config.ts extend từ tokens
  - <PhoneFrame> wrapper
  - 5 atoms: Button, Input, Badge, Avatar, Icon
- Step 9: Self-review per 9 Gates
- Step 10: Update tasklist + report

Constraints:
- KHÔNG hardcode hex (CSS variables only)
- Stop Conditions: thiếu token X → STOP, không tự đoán
- 9 Gates check cuối
- Output COMPONENT_REGISTRY.md với 5 atoms entries
```

**Output:**
- Code: apps/web/ runnable (`pnpm dev`)
- 5 atom components trong `apps/web/src/components/ui/`
- `taskpacks/S01-T01_FOUNDATION_ATOMS.md`
- `reports/S01-T01_REPORT.md`
- `reviews/S01-T01_REVIEW.md`
- ⭐ **NEW:** `.ai-delivery/COMPONENT_REGISTRY.md` (initial với 5 atoms)

**Update sau phiên:**
- ⭐ `slices/S-01_TASKLIST.md`: T01 `TODO → ✅ DONE`, T02 `→ NEXT`
- ⭐ `.ai-delivery/COMPONENT_REGISTRY.md`: Add 5 atoms entries (Button, Input, Badge, Avatar, Icon)

**Git commit:** `"Phiên 4: S01-T01 Foundation + 5 atoms — PASS"`

**Effort:** 4-6 giờ.

---

### Phiên 5 — S-01 Task 2 (Atoms batch 2)

**Mục đích:** 5 atoms còn lại (Chip, IconButton, Spinner, Skeleton, + 1 atom theo plan).

**Files upload (~10 files):**
```
Common (4):
  - workflow, TOS, slices/S-01_BRIEF, slices/S-01_TASKLIST

Task-specific (6):
  - .ai-delivery/COMPONENT_REGISTRY.md ⭐ (5 atoms từ Phiên 4)
  - reports/S-01_SEMANTIC_COMPONENTS.md
  - phases/PHASE_00_DESIGN_SYSTEM.md
  - 2-3 mockup HTML có Chip/Skeleton (vd intent-07-state-B-analyzing.html)
  - 05_CODING_CONVENTIONS.md
```

**Prompt:** Tương tự Phiên 4, đổi task ID + scope.

**Output:**
- 5 atoms mới + tests
- Reports + Review
- Update `COMPONENT_REGISTRY.md` (+5 entries)

**Update sau phiên:**
- ⭐ `slices/S-01_TASKLIST.md`: T02 ✅ DONE, T03 NEXT
- ⭐ `COMPONENT_REGISTRY.md`: +5 atoms

**Git commit:** `"Phiên 5: S01-T02 Atoms batch 2 — PASS"`

**Effort:** 4-6 giờ.

---

### Phiên 6 — S-01 Task 3 (Molecules)

**Mục đích:** 9-12 molecules (ChatBubble, Pulse, MiniChart, BottomSheet, Toast, LiveDot, RadialGlow, Money, StatCell).

**Files upload (~11 files):**
```
Common (4):
  - workflow, TOS, slices/S-01_BRIEF, slices/S-01_TASKLIST

Task-specific (7):
  - .ai-delivery/COMPONENT_REGISTRY.md ⭐ (10 atoms ready)
  - reports/S-01_SEMANTIC_COMPONENTS.md
  - phases/PHASE_00_DESIGN_SYSTEM.md
  - handoff/PHASE_00_CROSS_INTENT_PATTERNS.md (sparkline §7, chat bubble §4)
  - 3-4 mockup HTML có molecules (intent-07-state-A-listening, intent-03B-state-0-happy)
  - 05_CODING_CONVENTIONS.md
```

**Output:**
- 9-12 molecules
- Update Registry (+12 entries)

**Update sau phiên:** Tương tự pattern.

**Git commit:** `"Phiên 6: S01-T03 Molecules — PASS"`

**Effort:** 4-6 giờ.

---

### Phiên 7 — S-01 Task 4 + 5 (Organisms)

**Mục đích:** 13-16 organisms (AppHeader, BottomNav, HeroInsightCard, ProductCard, ActionCard, ChartCard, ...).

**Có thể tách 2 phiên nếu chậm:**
- 7a: Organisms structural (AppHeader, BottomNav, StatBar, ListRow, ListCard)
- 7b: Organisms content (HeroInsightCard, ProductCard, ActionCard, ChartCard, OrderSummary)

**Files upload (~13 files):**
```
Common (4) + Task-specific (9):
  - COMPONENT_REGISTRY (atoms + molecules done)
  - reports/S-01_SEMANTIC_COMPONENTS
  - phases/PHASE_00_DESIGN_SYSTEM
  - handoff/PHASE_00_CROSS_INTENT_PATTERNS (full, vì organisms phức tạp)
  - 4-5 mockup HTML representative (Intent 01, 03, 05, 06, 07)
  - 05_CODING_CONVENTIONS
```

**Output:**
- 13-16 organisms
- Update Registry với organisms entries
- **Slice S-01 COMPLETE** (last task)

**Update sau phiên:**
- ⭐ `slices/S-01_TASKLIST.md`: All tasks ✅ DONE
- ⭐ `COMPONENT_REGISTRY.md`: Final list ~30 components
- ⭐⭐ **`MASTER_SLICE_BACKLOG.md`: S-01 status `IN_PROGRESS → ✅ DONE`**

**Git commit:** `"Phiên 7: S-01 COMPLETE — UI Foundation 30 components"`

**Effort:** 6-8 giờ.

---

### Phiên 8 — S-02 Planning (P-CAP, CDP)

**Mục đích:** Plan Runtime Foundation với CDP method.

**Files upload (~14 files):**
```
Common (4):
  - workflow, TOS, ROADMAP, BACKLOG (S-01 DONE)

Slice-specific cho S-02 (10):
  - phases/PHASE_01_INFRA.md ⭐ (primary)
  - 03_API_CONTRACTS.md
  - 06_OBSERVABILITY.md
  - 07_BEHAVIOR_LOGS.md
  - 08_FE_BE_CONTRACT.md
  - LOG_CATALOG.md
  - 02_DATA_MODEL.md
  - 00_CONTEXT.md
  - 01_ARCHITECTURE.md
  - .ai-delivery/COMPONENT_REGISTRY.md (từ S-01 — biết FE đã có gì)
```

**Prompt:**
```
ICP Workflow — Phiên 8: Slice S-02 Runtime Foundation Planning (CDP)

Context: S-01 UI ready (30 components, xem REGISTRY).
Hôm nay plan S-02 Runtime Foundation — apply CDP method.

Apply Steps 3-5:
- Step 4: Tạo slices/S-02_BRIEF.md
- Step 5: Apply CDP method:
  1. INVENTORY: Capabilities từ docs (~10-15 items)
  2. CONSUMER_MAPPING: Matrix Capability × 8 Intents
  3. TIMING_DECISION: MUST_BEFORE / CAN_INCREMENTAL / DEFER
  4. TASK_BREAKDOWN: ~5-7 tasks
  5. ACCEPTANCE_TESTS: Smoke tests cho MUST_BEFORE

Output:
- slices/S-02_BRIEF.md
- reports/S-02_CAPABILITY_MATRIX.md
- slices/S-02_TASKLIST.md
```

**Output:**
- `slices/S-02_BRIEF.md`
- `reports/S-02_CAPABILITY_MATRIX.md`
- `slices/S-02_TASKLIST.md`

**Update sau phiên:**
- ⭐ `MASTER_SLICE_BACKLOG.md`: S-02 status `TODO → IN_PROGRESS (planning)`

**Git commit:** `"Phiên 8: S-02 Planning — CDP Capability matrix"`

**Effort:** 2-3 giờ.

---

### Phiên 9-12 — S-02 Execution

**Pattern lặp lại như Phiên 4-7:**

- **Phiên 9 — S02-T01:** Project skeleton (apps/gateway, apps/ai, apps/mcp, apps/workers init)
- **Phiên 10 — S02-T02:** Communication contracts (OpenAPI codegen, error format, shared types)
- **Phiên 11 — S02-T03:** Observability (OTel SDK + structured logger + LGTM docker-compose)
- **Phiên 12 — S02-T04 + T05:** Auth foundation + AI base (JWT guard, LangGraph IcpState)

**Files upload mỗi phiên (~10 files):**
```
Common (4) + Task-specific (~6):
  - slices/S-02_BRIEF, S-02_TASKLIST
  - phases/PHASE_01_INFRA (relevant section)
  - Docs tương ứng task (vd 06_OBSERVABILITY cho T03)
  - Existing skeleton từ task trước
```

**Output mỗi phiên:**
- Code files
- Task pack, report, review
- Update tasklist

**Update sau phiên cuối (Phiên 12):**
- ⭐⭐ `MASTER_SLICE_BACKLOG.md`: S-02 status `IN_PROGRESS → ✅ DONE`

**Git commits:**
- Phiên 9: `"Phiên 9: S02-T01 Project skeleton — PASS"`
- Phiên 10: `"Phiên 10: S02-T02 Communication contracts — PASS"`
- Phiên 11: `"Phiên 11: S02-T03 Observability stack — PASS"`
- Phiên 12: `"Phiên 12: S-02 COMPLETE — Runtime Foundation"`

**Effort:** 5-6 ngày tổng (~25-30 giờ).

---

### Phiên 13 — S-03 Planning (V-SLICE, VSP)

**Mục đích:** Plan vertical slice đầu tiên (Intent 08 Login) — demo-able đầu tiên.

**Files upload (~13 files):**
```
Common (4):
  - workflow, TOS, ROADMAP, BACKLOG

Slice-specific cho S-03 (9):
  - phases/PHASE_02_AUTH_SEARCH.md ⭐ (primary — Section A)
  - 04_INTENT_SPECS.md (Intent 08 section)
  - handoff/PHASE_00_INTENT_08_MOCKUP_HANDOFF.md (nếu có)
  - 7 mockup HTML Intent 08 (state 0, A, B, C, D, E, F)
  - 02_DATA_MODEL.md (sessions table)
  - 03_API_CONTRACTS.md (auth endpoints)
  - .ai-delivery/COMPONENT_REGISTRY.md (LoginForm, Button, Input từ S-01)
  - (Output S-02 — BE skeleton + error format auto-loaded từ apps/gateway)
```

**Prompt:**
```
ICP Workflow — Phiên 13: Slice S-03 First Auth Flow Planning (VSP)

Context: S-01 UI ready, S-02 runtime ready (apps/gateway có BE skeleton).
Hôm nay plan S-03 — vertical slice đầu tiên, demo-able sau khi xong.

Apply Steps 3-5 cho S-03 (V-SLICE — apply VSP method):
- Step 4: Tạo slices/S-03_BRIEF.md
- Step 5: Apply VSP method:
  1. USER_JOURNEY: Map flow Intent 08 từ mockup
  2. LAYER_SLICING: Matrix Milestone × Layer (FE/BE/DB/Events/Logs)
  3. HAPPY_VS_EDGE: Classify MUST/SHOULD/NICE_TO_HAVE
  4. SUB_TASK_BREAKDOWN: ~5-8 sub-tasks (DB → BE → FE order)
  5. ESTIMATE_SEQUENCE: Effort + cross-slice deps

Conflict resolution (per Section 14.4.1):
- Mockup state F-logout vs PHASE_02 spec — mockup wins (Rule 6)
- Surface trong S-03_BRIEF section "Risks"

Output:
- slices/S-03_BRIEF.md
- reports/S-03_LAYER_MATRIX.md
- slices/S-03_TASKLIST.md (~5-8 sub-tasks)
```

**Output:**
- `slices/S-03_BRIEF.md`
- `reports/S-03_LAYER_MATRIX.md`
- `slices/S-03_TASKLIST.md`

**Update sau phiên:**
- ⭐ `MASTER_SLICE_BACKLOG.md`: S-03 status `TODO → IN_PROGRESS (planning)`

**Git commit:** `"Phiên 13: S-03 Planning — VSP first vertical slice"`

**Effort:** 2-3 giờ.

---

### Phiên 14-16 — S-03 Execution

**Pattern V-SLICE (dependency order DB → BE → FE):**

- **Phiên 14 — S03-T01 + T02:** DB migration sessions + shared types + BE auth skeleton
- **Phiên 15 — S03-T03 + T04:** BE login.use-case (bcrypt + JWT) + FE login page (assemble từ atoms)
- **Phiên 16 — S03-T05 + T06:** Wire FE-BE + edge cases (wrong password, network error) + logout flow

**Cuối Phiên 16: DEMO MOMENT ĐẦU TIÊN ⭐**

Demo: User mở app → /login → enter creds → success → main screen → logout.

**Update sau Phiên 16:**
- ⭐⭐ `MASTER_SLICE_BACKLOG.md`: S-03 status `IN_PROGRESS → ✅ DONE (demo-able)`

**Git commit:** `"Phiên 16: S-03 COMPLETE — First demo (Intent 08 Login)"`

**Effort:** 12 giờ total.

---

### Phiên 17-35 — Remaining Slices (S-04 đến S-11)

**Pattern lặp lại tương tự S-03:**

| Phiên | Slice | Task | Output |
|---|---|---|---|
| **17** | S-04 Search Planning | (VSP) | BRIEF + TASKLIST |
| **18-20** | S-04 Search Execution | 3 tasks | Vespa search end-to-end |
| **21** | S-05 Cart Planning | (VSP) | BRIEF + TASKLIST |
| **22-23** | S-05 Cart Execution | 2 tasks | Cart MVP |
| **24** | S-06 Payment Planning | (VSP) | BRIEF + TASKLIST |
| **25-27** | S-06 Payment Execution | 3 tasks | **Kafka choreography wow** |
| **28** | S-07 Image AI Planning | (VSP) | BRIEF + TASKLIST |
| **29-31** | S-07 Image AI Execution | 3 tasks | **Vision + Cards wow** |
| **32** | S-08 Voice AI Planning | (VSP) | BRIEF + TASKLIST |
| **33-34** | S-08 Voice AI Execution | 2 tasks | Voice buy + analyze |
| **35** | S-09 + S-10 + S-11 | Multi-slice batch | Reco + Analytics + Demo prep |

**Mỗi phiên: tương tự pattern Phiên 13-16.**

**Quan trọng:** Sau Phiên 35, slice S-11 (Demo Hardening) là Q-GATE → check toàn dự án + tạo `FINAL_HANDOFF.md` per PHASE_06_POLISH spec.

---

<a name="phần-5"></a>
## Phần 5: Template Prompts Sẵn Dùng

### 5.1 Template: Slice Planning (3 versions theo method)

#### Template 5.1.A — H-UI Planning (EBT v2)

```
ICP Workflow — Phiên [N]: Slice [S-XX] Planning (H-UI — EBT v2)

Context: [Mô tả phiên trước, vd "S-XX-1 đã DONE"].
Hôm nay plan [S-XX] [Slice Name] — H-UI slice apply EBT v2 method.

Apply Steps 3-5:
- Step 4: Tạo slices/[S-XX]_BRIEF.md
- Step 5: Apply EBT v2 method (SCAN → COUNT → SEMANTIC_NORMALIZE → CLASSIFY → BUDGET)

Apply 4 sub-rules ở SEMANTIC_NORMALIZE:
1. Component vs Utility filter
2. Compound merging
3. Variants identification
4. MOCKUP IS LAW (Rule 6)

Output:
- slices/[S-XX]_BRIEF.md
- reports/[S-XX]_FREQUENCY_REPORT.md
- reports/[S-XX]_SEMANTIC_COMPONENTS.md
- slices/[S-XX]_TASKLIST.md (~5-7 tasks)

Constraints:
- KHÔNG code yet
- MOCKUP IS LAW (Rule 6)
- Surface conflicts per Rule 7
```

#### Template 5.1.B — P-CAP Planning (CDP)

```
ICP Workflow — Phiên [N]: Slice [S-XX] Planning (P-CAP — CDP)

Context: [Previous slice status].
Hôm nay plan [S-XX] [Slice Name] — P-CAP slice apply CDP method.

Apply Steps 3-5:
- Step 4: Tạo slices/[S-XX]_BRIEF.md
- Step 5: Apply CDP method:
  1. INVENTORY: Platform capabilities từ docs
  2. CONSUMER_MAPPING: Matrix Capability × 8 Intents
  3. TIMING_DECISION: MUST_BEFORE / CAN_INCREMENTAL / DEFER
  4. TASK_BREAKDOWN: ~5-7 tasks
  5. ACCEPTANCE_TESTS: Smoke tests

Output:
- slices/[S-XX]_BRIEF.md
- reports/[S-XX]_CAPABILITY_MATRIX.md
- slices/[S-XX]_TASKLIST.md

Constraints:
- Primary reference: PHASE_01_INFRA (high fidelity)
- MUST_BEFORE phải xong trước first V-SLICE
```

#### Template 5.1.C — V-SLICE Planning (VSP)

```
ICP Workflow — Phiên [N]: Slice [S-XX] Planning (V-SLICE — VSP)

Context: [UI + Runtime ready].
Hôm nay plan [S-XX] [Slice Name] cho Intent [XX] — apply VSP method.

Apply Steps 3-5:
- Step 4: Tạo slices/[S-XX]_BRIEF.md
- Step 5: Apply VSP method:
  1. USER_JOURNEY: Map flow từ mockup Intent [XX]
  2. LAYER_SLICING: Matrix Milestone × Layer (FE/BE/DB/Events/Logs)
  3. HAPPY_VS_EDGE: Classify MUST/SHOULD/NICE_TO_HAVE
  4. SUB_TASK_BREAKDOWN: ~5-8 sub-tasks (DB → BE → FE order)
  5. ESTIMATE_SEQUENCE: Effort + cross-slice deps

Conflict resolution (per Section 14.4.1):
- Primary spec: phases/[PHASE_0X].md
- Mockup wins khi conflict (Rule 6)
- Surface trong BRIEF section "Risks"

Output:
- slices/[S-XX]_BRIEF.md
- reports/[S-XX]_LAYER_MATRIX.md
- slices/[S-XX]_TASKLIST.md (~5-8 sub-tasks)
```

### 5.2 Template: Task Execution (universal)

```
ICP Workflow — Phiên [N]: Task [SXX-TYY] [Task Name]

Context: Slice [S-XX] đã plan xong, tasklist [N] tasks.
Hôm nay execute Task [TYY].

Apply Steps 6-10:
- Step 6: Confirm [TYY] (dependency satisfied)
- Step 7: Tạo taskpacks/[SXX-TYY]_*.md với Stop Conditions per Section 4 Step 7 template
- Step 8: Implement code per scope trong task pack
- Step 9: Self-review per 9 Gates (Section 4 Step 9)
- Step 10: Update tasklist + report + review

Scope: [Cụ thể từ tasklist]
Forbidden: [Files KHÔNG được modify]

Output:
- taskpacks/[SXX-TYY]_*.md
- Code files trong scope
- reports/[SXX-TYY]_REPORT.md
- reviews/[SXX-TYY]_REVIEW.md
- Update slices/[S-XX]_TASKLIST.md
- [Update COMPONENT_REGISTRY nếu S-01 slice]

Constraints:
- Follow 7 Rules trong TASK_OPERATING_SYSTEM
- Stop Conditions if blocker
- 9 Gates check cuối
- Cross-Slice Integration Check (Gate 9)
```

---

<a name="phần-6"></a>
## Phần 6: Troubleshooting

### 6.1 Vấn đề thường gặp

#### Q1: AI không follow đúng method (vd dùng generic thay vì EBT v2)

**Nguyên nhân:** Workflow doc không upload hoặc AI skim không kỹ.

**Giải pháp:**
- Verify `ICP_WORKFLOW_FINAL.md` luôn trong upload list
- Trong prompt, nhắc rõ method: "apply EBT v2 per Section 5.2"
- Nếu AI vẫn drift → STOP, paste lại Section 5 method matrix

#### Q2: AI quên component đã build phiên trước (drift API)

**Nguyên nhân:** `COMPONENT_REGISTRY.md` không upload hoặc outdated.

**Giải pháp:**
- Mọi phiên S-01 PHẢI upload `COMPONENT_REGISTRY.md`
- Mọi phiên V-SLICE (S-03+) PHẢI upload `COMPONENT_REGISTRY.md` để wire FE
- Verify registry up-to-date sau mỗi phiên

#### Q3: AI tự decide architecture (vi phạm Rule 5)

**Nguyên nhân:** Stop Conditions không rõ trong task pack.

**Giải pháp:**
- Task pack PHẢI có section "Stop Conditions" liệt kê tình huống
- Trong prompt: "Stop and report if [list]"
- Review Phase 9 Gate "Architecture Gate" catch vi phạm

#### Q4: Conflicts không được surface (silent decision)

**Nguyên nhân:** AI skip Rule 7 Evidence Hierarchy.

**Giải pháp:**
- BRIEF PHẢI có section "Risks" hoặc "Conflicts"
- Verify cuối phiên: "Có conflict nào trong evidence không?"
- Nếu AI nói "không", check kỹ mockup vs phase spec

#### Q5: Quên update living docs sau phiên

**Nguyên nhân:** Skip Step 10.

**Giải pháp:**
- Trước khi đóng phiên, check Section 3 Checklist
- Living docs MUST update: TASKLIST, REGISTRY (nếu S-01), BACKLOG (nếu slice complete)

### 6.2 Recovery scenarios

#### Scenario A: Phiên giữa chừng bị lỗi (network, timeout)

**Recovery:**
1. Save outputs đã có (download files trong context)
2. Mở phiên mới với prompt: "Resume Task [SXX-TYY] from [last state]"
3. Upload: workflow + slice context + outputs phiên cũ + task pack
4. AI tiếp tục từ điểm dừng

#### Scenario B: Phát hiện sai sót sau khi commit Git

**Recovery:**
1. Git revert hoặc fix commit mới
2. Update tasklist: add fix task `SXX-TYY-FIX`
3. Mở phiên mới, execute fix task

#### Scenario C: Slice scope phình lớn (vd S-01 từ 25 → 40 components)

**Recovery:**
1. Tách thành 2 slices: S-01a + S-01b
2. Update MASTER_SLICE_BACKLOG (add S-01b)
3. Update timeline (mất ~1-2 ngày extra)

---

## Phần 7: Cheat Sheet — In Ra Dán Bàn

### 7.1 Đầu mỗi phiên

```
[ ] Verify Git committed Phiên trước
[ ] Đọc workflow doc Section 14 cho phiên hiện tại
[ ] List files upload (theo bảng phiên tương ứng)
[ ] Upload files đúng thứ tự (workflow doc đầu tiên)
[ ] Paste prompt với context rõ
```

### 7.2 Cuối mỗi phiên

```
[ ] Outputs đầy đủ (brief, tasklist, task pack, report, review, code)
[ ] Save files về máy đúng folder structure
[ ] Update living docs:
    [ ] TASKLIST (mark task DONE)
    [ ] REGISTRY (nếu component mới, S-01 only)
    [ ] BACKLOG (nếu slice complete, change DONE)
[ ] Git commit với message rõ ràng
[ ] Note xuống cho phiên sau (blockers, conflicts)
```

### 7.3 Khi gặp blocker

```
[ ] STOP, không tự decide
[ ] AI surface vấn đề per Rule 7
[ ] Bạn quyết định: defer, fix, hoặc rollback
[ ] Update tasklist với note
[ ] Tiếp tục task khác hoặc đóng phiên
```

---

## Phần 8: Glossary

- **Living Document:** File update theo thời gian (TASKLIST, REGISTRY, BACKLOG)
- **Static Document:** File lock 1 lần, không sửa (workflow, specs, migrations)
- **Setup Phiên:** Phiên 1, tạo workflow foundation
- **Planning Phiên:** Steps 3-5, tạo slice brief + tasklist
- **Execution Phiên:** Steps 6-10, code + report + review
- **Demo Moment:** Cuối V-SLICE đầu tiên (S-03), feature demo-able end-to-end
- **Cross-Slice Integration:** Verify slice mới không break slice cũ (Gate 9)
- **Stop Conditions:** Tình huống AI phải dừng, không tự decide (Rule 5)

---

## Phần 9: Quick Reference per Slice Type

### H-UI Slice (S-01)

| Item | Detail |
|---|---|
| Method | EBT v2 |
| Primary Phase Spec | PHASE_00_DESIGN_SYSTEM |
| Mockup needed? | YES (toàn bộ 75 HTML qua zip) |
| Code? | Frontend only |
| Output components | atoms + molecules + organisms |
| Living doc cần update | COMPONENT_REGISTRY |

### P-CAP Slice (S-02)

| Item | Detail |
|---|---|
| Method | CDP |
| Primary Phase Spec | PHASE_01_INFRA |
| Mockup needed? | NO (không có UI) |
| Code? | Backend infrastructure |
| Output | Platform capabilities (OTel, OpenAPI, idempotency, ...) |
| Living doc cần update | TASKLIST + BACKLOG |

### V-SLICE (S-03 đến S-10)

| Item | Detail |
|---|---|
| Method | VSP |
| Primary Phase Spec | PHASE_02-05 tương ứng |
| Mockup needed? | YES (mockup intent đang làm) |
| Code? | Full-stack (FE + BE + DB + events + logs) |
| Output | 1 intent demo-able end-to-end |
| Living doc cần update | TASKLIST + BACKLOG + (REGISTRY nếu thêm component) |

### Q-GATE Slice (S-00, S-11)

| Item | Detail |
|---|---|
| Method | Checklist mode |
| Primary Phase Spec | PHASE_01 (S-00 audit) hoặc PHASE_06 (S-11 polish) |
| Mockup needed? | NO |
| Code? | Audit/polish, không feature mới |
| Output | Audit report / Final handoff |
| Living doc cần update | BACKLOG |

---

**END OF SESSION GUIDE**

**Companion docs:**
- `ICP_WORKFLOW_FINAL.md` v1.3 — TRUTH SOURCE (workflow rules + methods)
- `METHODOLOGY_TASK_ANALYSIS.md` — Method details (EBT v2 / CDP / VSP)

**Workflow:**
1. Đọc `ICP_WORKFLOW_FINAL.md` trước (1 lần)
2. Mở `ICP_SESSION_GUIDE.md` này MỖI khi bắt đầu phiên mới
3. Follow checklist tương ứng phiên type
4. Commit Git, đóng phiên, chuẩn bị phiên sau

**Status:** ✅ Approved by user
**Next action:** Bắt đầu Phiên 1 — chuẩn bị mockups.zip + 30 files Tier 1-6
