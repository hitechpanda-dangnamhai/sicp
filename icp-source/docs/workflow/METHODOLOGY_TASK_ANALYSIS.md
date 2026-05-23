# Phương Pháp Phân Tích Tasklist — Dự Án ICP Hackathon

> **Mục đích doc:** Đề xuất phương pháp phân tích tasklist đầy đủ cho dự án ICP, để
> review với chuyên gia trước khi áp dụng. Đây là output sau khi consolidate
> feedback từ chuyên gia thứ 2 (Y_Kien_chuyen_gia_02.md).
>
> **Tác giả:** AI Agent (Claude)
> **Date:** 2026-05-17
> **Status:** Draft v1 — chờ review

---

## 0. Tóm Tắt Triết Lý (TL;DR)

Dự án ICP có **3 LOẠI tính năng** với **3 PHƯƠNG PHÁP phân tích** khác nhau:

| Loại | Nội dung | Phương pháp |
|---|---|---|
| **A. Horizontal UI Foundation** | Component library FE (atoms/molecules/organisms) | **EBT v2** — Evidence-Based Task Breakdown với Semantic Normalization |
| **B. Vertical Feature** | 8 intent end-to-end (FE + BE + DB + events + logs) | **VSP** — Vertical Slice Planning |
| **C. Platform Capabilities** | Cross-cutting infrastructure (OTel, OpenAPI codegen, idempotency, error format, MCP contract...) | **CDP** — Capability-Driven Planning |

**Sequence áp dụng:**

```
Step 0: ROADMAP cấp cao (top-down từ 8 intents)
        ↓
Step 1: Phase 00 — Apply EBT v2 cho UI Foundation
        ↓
Step 2: Phase 01 — Apply CDP cho Platform Capabilities
        ↓
Step 3+: Phase 02-06 — Apply VSP cho 8 Vertical Features
```

**3 RULES BẤT BIẾN:**

1. **MOCKUP IS LAW** — Mọi pattern xuất hiện trong mockup PHẢI build, dù không nằm trong intent specs. Mockup = visual contract demo cho judge, không thể bỏ.
2. **EVIDENCE BEFORE OPINION** — Mọi quyết định extract/skip dựa trên data (frequency analysis, mockup audit), không dựa trên ý kiến cá nhân.
3. **CAPABILITY BEFORE FEATURE** — Platform capabilities (loại C) PHẢI setup trước Vertical Features (loại B). Nếu không, mỗi feature tự define error/log/event riêng → drift → broken.

---

## 1. Bối Cảnh: Vì Sao Cần Phương Pháp Riêng

### 1.1 Dự án ICP có đặc tính gì khiến cần method phức tạp?

- **Hackathon timeline gấp** (~3-4 tuần) → không thể plan tất cả ngay từ đầu, nhưng cũng không thể plan ad-hoc
- **75 mockup HTML đã có** → có evidence base để analyze, không cần đoán
- **8 intents đa dạng modality** (text + voice + image) → cross-cutting platform needs cao
- **Multi-stack** (Next.js + NestJS + Flask + LangGraph + Vespa + Kafka + Postgres + Redis) → cần governance để không bị drift
- **AI-first** (LangGraph + MCP tools + Gemini Vision) → error handling và observability quan trọng đặc biệt

### 1.2 Vì sao 1 method không đủ?

Nếu apply 1 method duy nhất cho cả 3 loại task:

- Apply **EBT** (đếm frequency) cho Phase 01-06 → vô nghĩa, feature không có "frequency"
- Apply **VSP** (user journey) cho Phase 00 → vô nghĩa, component không có user journey
- Apply **VSP** cho Platform Capabilities → bỏ sót infrastructure → drift

→ Phải có **3 method độc lập** + **rules kết nối** chúng.

---

## 2. Method EBT v2 — Evidence-Based Task Breakdown

### 2.1 Khi nào dùng

**ÁP DỤNG:** Phase 00 — UI Foundation (component library FE-only).

**KHÔNG ÁP DỤNG:** Vertical features, platform capabilities.

### 2.2 Quy trình 5 bước

```
SCAN → COUNT → SEMANTIC_NORMALIZE → CLASSIFY → BUDGET
                        ↑
                Bước thêm vào so với EBT v1
                (theo feedback chuyên gia 02)
```

#### Bước 1: SCAN — Đọc data thật

**Input:** `mockups.zip` (75 HTML files cho 8 intents)

**Action:**
1. Extract zip vào sandbox
2. Parse mỗi HTML file → extract:
   - Tất cả CSS class names (từ `class="..."` attributes)
   - Tất cả SVG inline patterns (gradient IDs, path shapes phức tạp)
   - Structural blocks (div hierarchy, repeating patterns)
   - Animation keyframes
   - Color variables sử dụng (`var(--*)`)
3. Output: raw inventory dạng JSON

```json
{
  "intent-01-state-B-prefilled.html": {
    "classes": ["phone-frame", "status-bar", "main-scroll", "ai-bubble",
                "ai-avatar", "shopee-compact", "trend-compact-card", ...],
    "svg_gradients": ["grad-hero", "grad-mic", "grad-orb"],
    "animations": ["pulseDot 1.6s", "shimmer 1.4s"],
    "structural_blocks": ["chat-thread-layout", "ai-bubble-pattern"]
  },
  ...
}
```

**Output:** `raw_inventory.json` (~75 entries)

#### Bước 2: COUNT — Đếm frequency

**Input:** `raw_inventory.json`

**Action:** Aggregate counts:

```python
class_frequency = {
    "phone-frame": 75,          # xuất hiện ở 75/75 files (100%)
    "status-bar": 75,
    "ai-bubble": 28,            # 28 files
    "ai-avatar": 31,
    "action-card": 15,
    "stat-cell": 12,
    "drill-chip": 8,
    "voice-wave": 6,
    "hero-insight-card": 4,     # ⭐ chỉ 4 nhưng MUST BUILD theo RULE
    ...
}
```

**Output:** `frequency_table.md`

#### Bước 3: SEMANTIC_NORMALIZE — Gom thành component thật ⭐

**Lý do tồn tại bước này:** (theo feedback chuyên gia 02)

> "Frequency analysis chỉ là input. Class != component. `ico` xuất hiện 514 lần không nghĩa là build 514 icon components. `shimmer`, `pulse` nên là animation utility, không phải business component."

**Input:** `frequency_table.md`

**Action:** Áp dụng 4 quy tắc semantic mapping:

**Rule 3.1 — Component vs Utility classification:**

| Pattern | Là gì | Decision |
|---|---|---|
| `phone-frame`, `ai-bubble`, `action-card` | Component (có structure rõ) | Extract component |
| `ico`, `flex-row`, `gap-4` | Utility class | KHÔNG extract, dùng Tailwind |
| `shimmer`, `pulse-ring`, `slide-up` | Animation | Extract utility CSS, KHÔNG component |
| `grad-hero`, `text-primary` | Design token | Đã có trong tokens.css |

**Rule 3.2 — Compound merging (gom related classes thành 1 component):**

```
Raw evidence:
  - ai-avatar (31) + ai-bubble (28) + user-bubble (32)
  - status-dot (12) + status-time (75) + status-icons (75)

Semantic component:
  → <ConversationBubble variant="user|ai"> + <AIAssistantAvatar>
  → <StatusBar /> với sub-parts (Time + Icons)
```

**Rule 3.3 — Variants vs Multiple components:**

Nếu 2-3 classes có cùng structure + chỉ khác màu/icon → 1 component với prop variant:

```
ac-tag-price, ac-tag-stock, ac-tag-trend, ac-tag-attribute, ac-tag-alternative
→ <ActionCardTag variant="price|stock|trend|attribute|alternative" />
(không phải 5 components riêng)
```

**Rule 3.4 — MOCKUP IS LAW filter ⭐:**

Theo RULE bất biến số 1: **Mọi visual pattern trong mockup PHẢI build.**

- Frequency thấp (< 3 files) KHÔNG phải lý do skip
- Vd: `<HeroInsightCard>` chỉ ở 4 mockup nhưng MUST BUILD vì pattern wow factor
- Vd: `<DrillChipRow>` chỉ ở Intent 07 nhưng MUST BUILD vì pattern unique

**Filter chỉ SKIP khi:**
- Là pure utility (animation, layout helper)
- Có thể inline 100% (vd: 1 lần dùng và < 10 dòng HTML)
- Đã được cover bởi component khác (vd: variant của component đã build)

**Output:** `semantic_components.md` với format:

```markdown
## <ConversationBubble>
- **Variants:** user | ai
- **Sub-parts:** <Bubble>, <Avatar>, optional <VoiceWave>, optional <ConfidenceBadge>
- **Frequency raw:** ai-bubble (28) + user-bubble (32) = 60 occurrences
- **Mockup refs:** intent-02, intent-03B, intent-04, intent-07
- **Justification:** MOCKUP IS LAW + frequency cao + cross-intent
- **Decision:** BUILD as compound component (Bubble.User, Bubble.AI)
```

#### Bước 4: CLASSIFY — Phân tầng Atomic Design

**Input:** `semantic_components.md`

**Action:** Phân mỗi component vào 1 trong 3 tầng:

**Atom (foundational, single-purpose):**
- Tiêu chí: Không depend component khác, ≤ 50 dòng JSX
- Vd: Button, Input, Badge, Avatar, Icon, Spinner, Skeleton
- **Build order:** TRƯỚC molecules

**Molecule (compose 2-3 atoms):**
- Tiêu chí: Depend ≥ 1 atom, vẫn focused chức năng
- Vd: ConversationBubble (Avatar + text), MetricStrip (StatCell × 3)
- **Build order:** SAU atoms

**Organism (section UI complete):**
- Tiêu chí: Depend ≥ 1 molecule, có business UI logic
- Vd: HeroInsightCard, ProductCard, ChartCard, ActionCard
- **Build order:** SAU molecules

**Utility (CSS animations, helpers):**
- Tiêu chí: Không là component, chỉ là CSS/utility
- Vd: `@keyframes shimmer`, `.slide-up`, `.glass-card`
- **Build order:** Setup ở Task 1 (tokens.css)

**Output:** `classified_components.md`

```markdown
## ATOMS (~9-12 components)
1. <Button> — 8 variants
2. <Avatar> — 4 sizes
...

## MOLECULES (~10-15 components)
1. <ConversationBubble>
2. <MetricStrip>
...

## ORGANISMS (~12-18 components)
1. <HeroInsightCard>
2. <ProductCard>
...

## UTILITIES
- @keyframes shimmer
- .glass-card class
...
```

#### Bước 5: BUDGET — Phân vào task buckets

**Input:** `classified_components.md`

**Action:** Map vào tasks theo dependency order:

```
Task 1 — Foundation (1 day)
  Setup + utilities + PhoneFrame

Task 2 — Atoms batch (1.5 days)
  9-12 components atoms

Task 3 — Molecules batch (1.5 days)
  10-15 components molecules

Task 4a — Organisms Structural (1 day)
  AppHeader, BottomNav, StatBar, ListRow/Card, etc.

Task 4b — Organisms Content (1.5 days)
  HeroInsightCard, ProductCard, ActionCard, ChartCard, ...

Task 5 — Style guide + polish (1 day, optional)
```

**Output:** `PHASE_00_TASK_BREAKDOWN.md`

### 2.3 Acceptance criteria EBT v2

Method này coi là "đủ tốt" khi:

- [ ] Mọi pattern trong 75 mockup được account (extract OR explicit skip với lý do)
- [ ] Component list final ≤ 40 components (manageable trong 5-7 ngày)
- [ ] Class != component clearly distinguished (no `<Ico>` component)
- [ ] Dependency order rõ ràng (atoms → molecules → organisms)
- [ ] Mockup IS LAW rule được tôn trọng (không skip wow patterns)

---

## 3. Method CDP — Capability-Driven Planning

### 3.1 Khi nào dùng

**ÁP DỤNG:** Phase 01 — Platform Capabilities Foundation.

**Đây là phase MỚI** chưa có trong plan cũ. Theo feedback chuyên gia 02, không có phase này → vertical features sẽ bị drift.

### 3.2 Định nghĩa Platform Capability

**Tiêu chí:** Là 1 module mà ≥ 2 intents/features sẽ dùng, và có "contract" rõ ràng (API, schema, behavior).

**Phân biệt với Atom (loại A):**
- Atom = UI primitive (Button, Input)
- Capability = Runtime/infrastructure (OTel, error format)

**Phân biệt với Feature (loại B):**
- Feature = Use case end-to-end cho user (login, search)
- Capability = Cross-feature service (auth guard, idempotency)

### 3.3 Quy trình 5 bước

```
INVENTORY → CONSUMER_MAPPING → TIMING_DECISION → TASK_BREAKDOWN → ACCEPTANCE_TESTS
```

#### Bước 1: INVENTORY — Liệt kê capabilities cần

**Input:** Đọc các docs:
- `06_OBSERVABILITY.md` (OTel, log catalog)
- `07_BEHAVIOR_LOGS.md` (behavior event SDK)
- `08_FE_BE_CONTRACT.md` (OpenAPI codegen)
- `02_DATA_MODEL.md` (event envelope)
- `03_API_CONTRACTS.md` (MCP tool contract, error format)
- `00_CONTEXT.md` Section 6 (communication patterns)

**Action:** List ra mọi cross-cutting concern:

```markdown
## Platform Capabilities Inventory

### Group 1: Communication Contracts
- C1. OpenAPI codegen workflow (TS types ↔ NestJS DTOs)
- C2. SSE contract chuẩn (event names, payload, error handling)
- C3. Error format chuẩn (E_* codes, trace_id, message_vi)
- C4. Idempotency middleware (Idempotency-Key header → Redis cache)

### Group 2: Event-Driven Backbone
- C5. Event envelope schema (Kafka headers, trace propagation)
- C6. Domain event publisher (write to events table + emit Kafka)
- C7. Behavior event SDK (tracker FE + worker BE)

### Group 3: AI Infrastructure
- C8. MCP tool contract (JSON-RPC 2.0 + tool registry)
- C9. LangGraph state schema (`IcpState` base)
- C10. Policy gate (DB policies + action card factory)

### Group 4: Observability
- C11. OTel tracing setup (Collector + Grafana stack)
- C12. Structured logger (per 06_OBSERVABILITY.md schema)
- C13. Log catalog enforcement (validate against LOG_CATALOG.md)

### Group 5: Security
- C14. Auth/session guard (JWT verify middleware)
- C15. Rate limiting (optional, có thể skip cho hackathon)
```

**Output:** `capabilities_inventory.md` (~10-15 capabilities)

#### Bước 2: CONSUMER_MAPPING — Map capability × intent

**Input:** `capabilities_inventory.md` + 8 intent specs

**Action:** Tạo matrix Capability × Intent:

| Capability | I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | Total |
|---|---|---|---|---|---|---|---|---|---|
| C1. OpenAPI codegen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8/8 |
| C2. SSE contract | ✓ | ✓ | - | ✓ | - | ✓ | ✓ | - | 5/8 |
| C3. Error format | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8/8 |
| C4. Idempotency | ✓ | - | - | - | ✓ | ✓ | - | - | 3/8 |
| C5. Event envelope | ✓ | ✓ | - | - | ✓ | ✓ | - | ✓ | 5/8 |
| C8. MCP contract | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | - | 6/8 |
| C10. Policy gate | ✓ | - | - | ✓ | - | - | ✓ | - | 3/8 |
| C11. OTel tracing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 8/8 |
| ... |

**Output:** `capability_consumer_matrix.md`

#### Bước 3: TIMING_DECISION — Phân loại theo thời điểm cần

**Input:** `capability_consumer_matrix.md`

**Action:** Phân vào 3 nhóm theo priority:

**MUST_BEFORE (8/8 consumers):**
Setup trước Phase 02 đầu tiên. Nếu không có → mọi intent break.
- C1. OpenAPI codegen
- C3. Error format
- C11. OTel tracing
- C12. Structured logger
- C14. Auth guard (nếu Intent 08 làm trước)

**CAN_INCREMENTAL (3-7/8 consumers):**
Setup khi intent đầu tiên cần. Mỗi intent tiếp theo extend.
- C2. SSE contract (setup lúc Intent 01 cần)
- C4. Idempotency (setup lúc Intent 05 cần)
- C5. Event envelope (setup lúc cần emit event đầu tiên)
- C8. MCP contract (setup lúc Intent 03 cần Vespa)
- C10. Policy gate (setup lúc Intent 01 cần action card)

**OPTIONAL/DEFER (1-2/8 consumers):**
Có thể bolt-on cuối, hoặc skip hackathon.
- C7. Behavior event SDK (Phase 06 nice-to-have)
- C15. Rate limiting (skip hackathon)

**Output:** `capability_timing.md`

#### Bước 4: TASK_BREAKDOWN — Chia thành tasks

**Input:** `capability_timing.md`

**Action:** Tạo task list cho Phase 01:

```markdown
## Phase 01 — Platform Foundation Tasks

### Task P1.1 — Project skeleton (1 day)
- apps/gateway (NestJS scaffold)
- apps/ai (Flask + LangGraph scaffold)
- apps/mcp (MCP server scaffold)
- Docker compose orchestration

### Task P1.2 — Communication contracts (1 day)
- C1. OpenAPI codegen workflow
- C3. Error format chuẩn
- Shared types skeleton (`packages/shared-types/`)

### Task P1.3 — Observability (1 day)
- C11. OTel tracing infrastructure
- C12. Structured logger
- LGTM stack docker-compose

### Task P1.4 — Auth foundation (0.5 day)
- C14. Auth/session guard middleware
- JWT verify util

### Task P1.5 — AI infrastructure base (0.5 day)
- C9. LangGraph IcpState schema
- C8. MCP tool contract skeleton

### Task P1.6 — Event-driven base (1 day, can incremental)
- C5. Event envelope schema
- C6. Domain event publisher
- Kafka topic registry
```

**Output:** `PHASE_01_TASK_BREAKDOWN.md` (~6 tasks, ~5 ngày)

#### Bước 5: ACCEPTANCE_TESTS — Định nghĩa "done"

Mỗi capability có **smoke test** verify integration:

```markdown
### C1. OpenAPI codegen — Acceptance
- [ ] BE controller decorator có swagger
- [ ] `pnpm openapi:sync` generate TS client
- [ ] FE import client từ `@icp/shared-types/api` chạy được
- [ ] CI fail nếu drift

### C3. Error format — Acceptance
- [ ] Error response luôn có `{ code: E_*, message_vi, trace_id }`
- [ ] FE error handler 1 chỗ catch hết
- [ ] Test 3 error cases: 401, 500, validation

### C11. OTel tracing — Acceptance
- [ ] FE → BE → DB request có trace_id propagated
- [ ] Grafana Tempo hiển thị trace
- [ ] Log message có trace_id field
```

**Output:** `phase_01_acceptance_criteria.md`

### 3.4 Acceptance criteria CDP

Method này coi là "đủ tốt" khi:

- [ ] Mọi capability có rationale (≥ 2 consumers hoặc explicit "deferred")
- [ ] Timing decision rõ (MUST_BEFORE vs CAN_INCREMENTAL vs DEFER)
- [ ] Acceptance test smoke test cho mỗi MUST_BEFORE capability
- [ ] Task list ≤ 8 tasks, total ≤ 6 ngày

---

## 4. Method VSP — Vertical Slice Planning

### 4.1 Khi nào dùng

**ÁP DỤNG:** Phase 02-06 — 8 Vertical Features (intents end-to-end).

**Tiền điều kiện:** Phase 00 + Phase 01 đã xong (UI components + platform capabilities ready).

### 4.2 Quy trình 5 bước (per intent)

```
USER_JOURNEY → LAYER_SLICING → HAPPY_VS_EDGE → SUB_TASK_BREAKDOWN → ESTIMATE_SEQUENCE
```

#### Bước 1: USER_JOURNEY — Map user flow

**Input:**
- `PHASE_00_INTENT_XX_MOCKUP_HANDOFF.md` (intent đang plan)
- Section "Demo Flow" trong handoff
- Mockup HTML các states

**Action:** Vẽ sequence diagram đơn giản:

```
User action → System response → State change → Next action

VD Intent 08 Login:
  User: Open app → State 0 splash
  User: Tap "Bắt đầu" → State A login form
  User: Type email + password → FE validate
  User: Tap "Đăng nhập" → FE POST /auth/login + State B loading
  System: BE verify password
  System (success): Issue JWT + return user → State E success greeting
  System (wrong pwd): Return 401 → State C shake error
  System (network): Timeout → State D network error
```

**Output:** `intent_xx_user_journey.md`

#### Bước 2: LAYER_SLICING — Map từng milestone × layer

**Input:** `intent_xx_user_journey.md`

**Action:** Tạo matrix Milestone × Layer:

| Milestone | FE | BE | DB | Events | Logs |
|---|---|---|---|---|---|
| Login form display | `app/(auth)/login/page.tsx` + `<LoginForm>` | — | — | — | — |
| Submit credentials | `useAuth.login()` hook + state machine | `POST /auth/login` → `AuthController` → `login.use-case.ts` | INSERT `sessions` | Emit `UserLoggedIn` to `icp.users.activity` | log `auth.login.attempt`, `auth.login.success` |
| Wrong password | `<LoginForm>` shake animation + error display | 401 response with `E_INVALID_CREDENTIALS` | — | — | log `auth.login.failed` (warn) |
| Network error | `<NetworkErrorState>` | — | — | — | log `network.timeout` (FE-side) |
| Success greeting | `<SuccessState>` + redirect after 2s | Set-Cookie JWT | — | — | log `auth.session.created` |

**Output:** `intent_xx_layer_matrix.md`

#### Bước 3: HAPPY_VS_EDGE — Quyết định scope edge cases

**Input:** `intent_xx_layer_matrix.md` + mockup edge states

**Action:** Classify mỗi state:

**MUST (happy path + critical edge):**
- State 0, A, E (happy: form → loading → success)
- State C (wrong password — common case)

**SHOULD (defensive):**
- State D (network error — user expectation)

**NICE_TO_HAVE (polish):**
- State F (logout flow — không block login MVP)

**Decision:**
- Hackathon timeline tight → build MUST + SHOULD, defer NICE_TO_HAVE
- Production timeline ample → build all

**Output:** `intent_xx_scope.md`

#### Bước 4: SUB_TASK_BREAKDOWN — Chia thành sub-tasks

**Input:** `intent_xx_layer_matrix.md` + `intent_xx_scope.md`

**Action:** Chia theo dependency order (DB → BE → FE):

```markdown
## Intent 08 Sub-tasks

### Sub-task 8.1 — Schema + types (0.5 day)
- shared-types/auth.ts (LoginRequest, LoginResponse, AuthErrorCode)
- Zod schemas
- OpenAPI codegen verify

### Sub-task 8.2 — BE login flow (1 day)
- AuthController + login.use-case
- Bcrypt verify password
- JWT issue with jose
- Insert sessions row
- Emit UserLoggedIn event
- Error handling 401 + 5xx

### Sub-task 8.3 — FE login form (1 day)
- /login page với <BrainIcon> splash + <LoginForm>
- react-hook-form + zod validation
- State machine (idle/submitting/success/error_*)
- Demo account hint card

### Sub-task 8.4 — FE-BE wire + edge cases (0.5 day)
- useAuth hook
- Network error detection (navigator.onLine)
- Shake animation 401
- Success countdown 2s → redirect
- Logs FE-side

### Sub-task 8.5 — Logout + polish (0.5 day)
- Profile page với logout confirm
- POST /auth/logout
- AlertDialog from shadcn
```

**Output:** `phase_02_intent_08_tasks.md` (~5 sub-tasks per intent)

#### Bước 5: ESTIMATE_SEQUENCE — Schedule + dependency

**Input:** Tất cả `phase_xx_intent_yy_tasks.md`

**Action:**

**5.1 — Estimate effort:**
- S = 0.5 ngày
- M = 1 ngày
- L = 2 ngày

**5.2 — Cross-intent dependency:**
```
I08 Login (Phase 02)
   ↓ (auth guard needed)
I03 Search (Phase 02)
   ↓ (cart pill UI link)
I05 Cart (Phase 04)
   ↓ (cart data needed)
I06 Pay (Phase 04)

I01 Import (Phase 03) — no dependency, can parallel
I02 Buy Voice (Phase 04) — needs I05 cart
I04 Recommend (Phase 05) — needs I03 search infrastructure
I07 Analyze (Phase 05) — needs I06 orders data
```

**5.3 — Sequence intents:**

```
Phase 02 (text-first):
  Week 1: I08 Login → I03 Search

Phase 03 (image upload):
  Week 1.5: I01 Import

Phase 04 (commerce loop):
  Week 2: I05 Cart → I06 Pay → I02 Buy Voice

Phase 05 (AI advanced):
  Week 3: I04 Recommend → I07 Analyze

Phase 06 (polish):
  Week 3.5: Receipt PDF, wishlist, edge case backfill
```

**Output:** `PHASE_02_TO_06_ROADMAP.md`

### 4.3 Acceptance criteria VSP

Per intent, coi là "đủ tốt" khi:

- [ ] Mọi mockup state được cover (build OR defer với lý do)
- [ ] Mọi layer mapped (không miss BE/DB/event)
- [ ] Cross-intent dependency identified
- [ ] Demo-able sau khi finish (1 intent = 1 demo moment)

Per phase, coi là "đủ tốt" khi:

- [ ] Roadmap có timeline realistic
- [ ] Acceptance test per intent
- [ ] Integration test cross-intent (vd: login → search → cart flow)

---

## 5. Cross-Method Rules (3 RULES BẤT BIẾN)

### Rule 1: MOCKUP IS LAW ⭐

**Tuyên bố:** Mọi pattern xuất hiện trong mockup PHẢI được build, dù không nằm trong intent specs.

**Lý do:** Mockup = visual contract demo cho judge hackathon. Bỏ pattern = mất wow factor.

**Áp dụng:**
- Bước 3 EBT v2 (Semantic Normalize): KHÔNG được skip pattern vì frequency thấp
- Vd cụ thể: `<HeroInsightCard>` chỉ 4 mockup → vẫn build
- Vd cụ thể: `<DrillChipRow>` chỉ Intent 07 → vẫn build

**Exception duy nhất:** Pure utility (animation, layout helper) không phải component → CSS only.

### Rule 2: EVIDENCE BEFORE OPINION

**Tuyên bố:** Quyết định extract/skip/scope DỰA TRÊN data (mockup audit, frequency table, capability matrix), KHÔNG dựa trên opinion.

**Lý do:** Loại bỏ bias, justify quyết định với team/judge.

**Áp dụng:**
- EBT v2 Bước 2 (COUNT): output frequency table cụ thể
- CDP Bước 2 (CONSUMER_MAPPING): output matrix có số 8/8, 5/8, etc.
- VSP Bước 1 (USER_JOURNEY): output từ mockup states, không tự bịa

**Exception:** Khi không có data (vd: chọn library v3 vs v4), dùng community standard.

### Rule 3: CAPABILITY BEFORE FEATURE

**Tuyên bố:** Platform capabilities MUST_BEFORE (loại C) phải setup TRƯỚC vertical features (loại B).

**Lý do:** Theo chuyên gia 02: "Nếu không, mỗi intent tự define event riêng, mỗi screen tự xử lý loading/error riêng, mỗi endpoint trả error format khác nhau → production quality bị vỡ."

**Áp dụng:**
- Phase 01 (CDP) PHẢI complete MUST_BEFORE capabilities trước Phase 02 đầu tiên
- Phase 00 (EBT) có thể chạy song song hoặc trước Phase 01

**Exception:** CAN_INCREMENTAL capabilities có thể setup khi intent đầu tiên cần (vd: SSE contract setup lúc làm Intent 01 vì là intent SSE đầu tiên).

---

## 6. Sequence Áp Dụng 3 Methods

### 6.1 Timeline tổng thể

```
Step 0 — ROADMAP CẤP CAO (BƯỚC THIẾU TRƯỚC ĐÂY) ⭐
  Conversation: Vertical Roadmap Planning
  Method: Top-down từ 8 intents
  Input: Intent specs + intent handoffs
  Output: ROADMAP_OVERVIEW.md
    - 8 intents sequence
    - Cross-intent dependencies
    - Identify platform capabilities needed
    - Identify components needed (rough list)
  Effort: 1 conversation, ~30-45 phút
        ↓
Step 1 — PHASE 00 UI FOUNDATION
  Conversation: Phase 00 Planning (apply EBT v2)
  Method: EBT v2 (SCAN → COUNT → SEMANTIC_NORMALIZE → CLASSIFY → BUDGET)
  Input: mockups.zip + design system + handoffs
  Output: PHASE_00_TASK_BREAKDOWN.md
  Effort: 1 conversation planning + 5-6 conversations implement
  Time: ~5-7 ngày work
        ↓
Step 2 — PHASE 01 PLATFORM CAPABILITIES ⭐
  Conversation: Phase 01 Planning (apply CDP)
  Method: CDP (INVENTORY → CONSUMER_MAPPING → TIMING → TASK → ACCEPTANCE)
  Input: 06_OBSERVABILITY + 07_BEHAVIOR + 08_FE_BE + 02_DATA_MODEL + 03_API
  Output: PHASE_01_TASK_BREAKDOWN.md
  Effort: 1 conversation planning + 5-6 conversations implement
  Time: ~5-6 ngày work
        ↓
Step 3+ — PHASE 02-06 VERTICAL FEATURES
  Conversation per intent: Apply VSP
  Method: VSP (USER_JOURNEY → LAYER_SLICING → HAPPY/EDGE → SUB_TASKS → ESTIMATE)
  Input: 02_DATA_MODEL + 03_API + 04_INTENT_SPECS + COMPONENT_REGISTRY (from Phase 00)
       + intent handoff cụ thể
  Output: Mỗi intent demo end-to-end
  Effort: ~3-5 sub-tasks per intent × 8 intents = 25-40 conversations
  Time: ~15-20 ngày work
```

### 6.2 Tổng effort estimate

| Phase | Planning | Implementation | Total |
|---|---|---|---|
| Step 0 — Roadmap | 0.5h | — | 0.5h |
| Step 1 — Phase 00 | 2h | 5-7d | ~6d |
| Step 2 — Phase 01 | 2h | 5-6d | ~6d |
| Step 3 — Phase 02-06 | 1h/intent × 8 | 2-3d/intent × 8 | ~20d |
| **Total** | **~12h** | **~30d** | **~32d** |

**Cho hackathon 3-4 tuần (21-28 ngày):**
- Cần optimize: skip Ladle stories, skip unit tests, parallel team
- Realistic scope: 6/8 intents end-to-end, 2/8 demo-only (mockup)

---

## 7. Risks & Mitigations

### Risk 1: Plan quá chi tiết → over-planning

**Mitigation:** Mỗi method có 5 bước rõ, không cố gắng plan thêm. Step 0 chỉ là cấp cao, không deep.

### Risk 2: Component build xong không match Phase 02+ feature needs

**Mitigation:** Rule "MOCKUP IS LAW" + Step 0 roadmap cấp cao đảm bảo component align với features.

### Risk 3: Platform capability setup quá ambitious

**Mitigation:** CDP có 3 nhóm timing (MUST_BEFORE / CAN_INCREMENTAL / DEFER). Skip DEFER cho hackathon.

### Risk 4: AI agent quên Rules bất biến

**Mitigation:** Mỗi conversation prompt include 3 rules. Living Registry file enforce continuity.

### Risk 5: Method này phức tạp, team không follow được

**Mitigation:** Mỗi method có cheat sheet 1 trang. Methods chỉ là guide, not rigid.

---

## 8. Câu Hỏi Cho Chuyên Gia Review

Khi review doc này, mong chuyên gia trả lời:

### 8.1 Về 3 loại task

- [ ] Phân loại A/B/C có đúng và đủ không? Có loại task nào khác bị miss không?
- [ ] Rule MOCKUP IS LAW có hợp lý không? Có exception nào nên thêm không?

### 8.2 Về EBT v2

- [ ] Bước SEMANTIC_NORMALIZE có đủ rigorous không?
- [ ] 4 rules trong bước 3 (Component vs Utility, Compound merging, Variants, MOCKUP IS LAW filter) có cover hết edge cases?
- [ ] Frequency thresholds (atom ≥ 30, molecule 10-29, organism 3-9) có hợp lý không?

### 8.3 Về CDP

- [ ] Capability list (C1-C15) có miss capability nào không?
- [ ] Timing classification (MUST_BEFORE / CAN_INCREMENTAL / DEFER) có chính xác?
- [ ] Acceptance test có đủ smoke test không?

### 8.4 Về VSP

- [ ] 5 bước per intent có quá nhiều/quá ít?
- [ ] Layer matrix (Milestone × Layer) có cover hết FE+BE+DB+Events+Logs không?
- [ ] Cross-intent dependency analysis có đủ?

### 8.5 Về Sequence

- [ ] Step 0 (Roadmap cấp cao) có thực sự cần không?
- [ ] Phase 00 + Phase 01 song song được không, hay phải tuần tự?
- [ ] Hackathon 3-4 tuần có realistic không? Cần cut scope gì?

### 8.6 Về Rules

- [ ] 3 rules bất biến có đủ không?
- [ ] Có rule nào quá strict gây bottleneck không?

---

## 9. Comparison với Đề Xuất Trước

| Khía cạnh | Plan cũ (1 method) | Plan mới (3 methods + Step 0) |
|---|---|---|
| Số method | 1 (EBT v1) | 3 (EBT v2 + CDP + VSP) + Step 0 |
| Phase | 2 (Phase 00 + 01-06) | 4 (Step 0 + Phase 00 + 01 + 02-06) |
| Roadmap cấp cao | Không có | Có (Step 0) |
| Platform capabilities | Bị miss | Có Phase 01 riêng |
| Semantic normalize | Bị miss | Có trong EBT v2 |
| Mockup IS LAW rule | Không phát biểu | Phát biểu rõ Rule 1 |
| Evidence-based | Implicit | Phát biểu rõ Rule 2 |
| Capability before feature | Không enforce | Phát biểu rõ Rule 3 |

---

## 10. Lời Kết

Doc này là **revision sau feedback chuyên gia 02**. Tôi đã sai 3 chỗ:

1. Không có Step 0 roadmap cấp cao → fix bằng cách thêm Step 0
2. EBT v1 thiếu Semantic Normalize → fix bằng EBT v2
3. Miss loại C (Platform Capabilities) → fix bằng CDP method + Phase 01

**Tôi sẵn sàng nhận thêm feedback** từ chuyên gia khác để tiếp tục refine. Doc này KHÔNG phải final — là draft v1 cần review.

**Sau khi chuyên gia review xong:**
- Nếu approve → bắt đầu Step 0 (Roadmap cấp cao) trong conversation mới
- Nếu cần fix → revise doc theo feedback

---

**END OF METHODOLOGY DOC.**

**Generated by:** AI Agent (Claude)
**Reviewed by:** [ chờ chuyên gia ]
**Next action:** User review with expert → approve hoặc request changes
