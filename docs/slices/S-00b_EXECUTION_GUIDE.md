# S-00b Execution Guide — Master Document

> **Mục đích:** File này là **single source of truth** cho việc thực thi slice S-00b qua 9 phiên chat. Đã apply 15 fixes phát hiện trong rà soát + chốt quyết định C12=B (embeddings Vespa-only).
>
> **Cách dùng:**
> 1. Đọc Section 1 (decisions locked) — hiểu context
> 2. Đọc Section 2 (hành động ngay của bạn) — biết bạn cần làm gì trước khi mở Phiên 4
> 3. Mỗi khi mở phiên mới (Phiên 4-12), copy đúng Section tương ứng (Section 4.1 cho Phiên 4 T01, v.v.) — gồm input bundle list + prompt template + output expected
>
> **Generated:** 2026-05-18 Phiên 3
> **Version:** 1.0

---

## Section 1 — Decisions Locked & Conflicts Surfaced

### 1.1 Pre-approved decisions (D-01 đến D-05)

5 decisions đã chốt trong Phiên 3 conversation, locked trước khi T01 start:

| ID | Decision | Áp dụng task |
|---|---|---|
| **D-01** | Password hash: **bcrypt cost 10**, library `bcryptjs` (pure JS, no native binding — easier in CI) | T05 (seed.ts) |
| **D-02** | Docker healthcheck defaults: `interval=30s`, `timeout=5s`, `retries=3`, `start_period=10s` cho stateless services (gateway/ai/mcp/web/otel-collector); `start_period=30s` cho stateful (postgres/vespa/loki/tempo/prometheus/grafana) | T03, T07, T08 |
| **D-03** | Version pins: **Next.js 14.2.x** + **Tailwind 3.4.x** + **shadcn** (NOT `shadcn-ui` legacy) | T08 |
| **D-04** | Migration runner: bash `infra/migrations/apply.sh` (per `02_DATA_MODEL.md` lines 415-417 guidance) | T04 |
| **D-05** | TypeScript config: `tsconfig.base.json` set `"module": "esnext"` + `"moduleResolution": "bundler"` + `"target": "es2022"` + `"strict": true` + `"skipLibCheck": true`. **Gateway override** trong `apps/gateway/tsconfig.json` extends base + `"module": "commonjs"` + `"moduleResolution": "node"` (NestJS 10 requires CommonJS) | T01, T02, T03 |

### 1.2 Critical decision C12 — V001 embedding columns (NEW)

**LOCKED 2026-05-18 Phiên 3: Option B — Vespa-only, V001 KHÔNG có VECTOR columns trên Postgres**

**Rationale:**
- Embedding stored in **một nơi duy nhất** — Vespa search index (per ADR-036 CLIP 512 dim).
- Postgres `products` table giữ source-of-truth domain data (title, price, stock, attributes, image_url), **không duplicate** embedding.
- Vespa indexing pipeline (S-02+ implement) sẽ compute embedding từ Postgres data + push vào Vespa khi product được create/update.
- User prompt Phiên 3 ban đầu mention "G-12 V001 với `text_embedding VECTOR(512)` + `image_embedding VECTOR(512)`" → **đã được human override sang Option B** trong Phiên 3 conversation, thống nhất 1 nơi.

**Hệ quả cho V001:**
- V001 mirror EXACTLY `02_DATA_MODEL.md` Section 1 lines 1-165 (10 tables: users, sessions, products, events, policies, action_cards, orders, order_items, transactions, behavior_events + 3 month partitions).
- **KHÔNG** có `text_embedding` / `image_embedding` columns trong products.
- **KHÔNG** cần `CREATE EXTENSION vector;` (pgvector).
- **KHÔNG** đổi Postgres image — giữ `postgres:16-alpine` per `PHASE_01_INFRA.md` line 24.

**Hệ quả cho T06 Vespa schema:**
- Vespa `product.sd` có `text_embedding tensor<float>(x[512])` + `image_embedding tensor<float>(x[512])` (per ADR-036) — duy nhất nơi embeddings live.
- Conflict C8 (02_DATA_MODEL.md 768 vs ADR-036 512) vẫn áp dụng trong T06: dùng 512.

### 1.3 Surfaced conflicts (sẽ document trong S00b-REPORT, KHÔNG silent fix)

| ID | Conflict | Resolution path | Action |
|---|---|---|---|
| **C8** | `02_DATA_MODEL.md` Section 2 (lines 205, 217, 244, 256) spec Vespa `tensor<float>(x[768])`; ADR-036 LOCK 512 | ADR (priority 2) > general spec (priority 5) per Rule 7 → **AI viết product.sd với 512** | Docs maintainer patch `02_DATA_MODEL.md` 768 → 512 (defer, ~5-min edit, không trong scope S-00b) |
| **C9** | `MASTER_SLICE_BACKLOG.md` chưa list S-00b entry; S-01/S-02 dep edges ghi "S-00" cần update thành "S-00b" | Backlog generated pre-Phiên 2 audit, S-00b emerged from audit recommendation | Docs maintainer add row + update deps (~10-min edit, defer) |
| **C10** | `PHASE_01_INFRA.md` line 184 dùng legacy `shadcn-ui@latest init` (deprecated 2024 — renamed `shadcn`) | Per D-03: AI dùng `shadcn` mới | Docs maintainer patch line 184 (1-line edit, defer) |
| **C11** ⭐ NEW | `06_OBSERVABILITY.md` line 52 + 559 spec Grafana port `3001:3000`; `PHASE_01_INFRA.md` line 13 + 41 + DoD-6 spec port `3002`. Port 3001 cũng collide với gateway service port 3001 | PHASE_01 (priority 4) > 06_OBSERVABILITY (priority 5) per Rule 7; collision risk reinforces → **AI dùng 3002** | Docs maintainer patch `06_OBSERVABILITY.md` line 52 + 559 → 3002 (defer) |
| **C12** ⭐ NEW (RESOLVED) | User prompt Phiên 3 G-12 nói V001 có `VECTOR(512)` columns; `02_DATA_MODEL.md` Postgres section không có; ADR-036 chỉ rule Vespa | **Human chốt Option B 2026-05-18 Phiên 3 conversation:** Vespa-only, V001 không có VECTOR columns | NONE — decision locked here; future references to "V001 VECTOR" should be rejected |

### 1.4 Out-of-scope items (defer khỏi S-00b, để cho S-02)

Confirm lại từ Brief Non-goals:
- Per-service OTel SDK init code (`apps/<svc>/src/observability/`) → S-02
- `mcp_client.py` traceparent header injection → S-02
- Logger helpers (`logger.ts`, `logger.py`) → S-02
- `packages/shared-types/` content (Zod schemas + types + codegen) → S-02
- `shopee-mock-seed-worker.ts` business logic → S-02 (chỉ skeleton trong S-00b T02)
- Service real `/health` controllers (NestJS HealthController, Flask health endpoint) → S-02
- Vespa indexing pipeline (compute embeddings + push to Vespa) → S-02

---

## Section 2 — Action ngay của bạn (TRƯỚC khi mở Phiên 4)

### 2.1 Tải về 3 files Phiên 3 đã emit

Đảm bảo bạn có các file sau (download từ chat này):
1. `slices/S-00b_BRIEF.md` (đã emit Phiên 3 response đầu tiên)
2. `slices/S-00b_TASKLIST.md` (đã emit Phiên 3 response đầu tiên)
3. `S-00b_EXECUTION_GUIDE.md` (file này — chính là document đang đọc)
4. `decisions-log.md` (đính kèm cuối file này — Section 9)

### 2.2 Cập nhật `S-00b_BRIEF.md` với 2 amendments

Mở `S-00b_BRIEF.md` và edit phần Risks (cuối file):

**Amendment 1: Risk R3 update** — đổi nội dung R3 hiện tại bằng:

```markdown
**R3 — V001 strict mirror 02_DATA_MODEL.md, NO VECTOR columns (C12 LOCKED Option B 2026-05-18)**

- Human đã chốt C12 = Option B: embeddings stored Vespa-only, V001 KHÔNG có 
  text_embedding / image_embedding VECTOR columns trong Postgres products table.
- V001 mirror EXACTLY 02_DATA_MODEL.md Section 1 lines 1-165 (10 tables base 
  DDL, không thêm gì).
- KHÔNG cần pgvector extension; KHÔNG đổi Postgres image (giữ postgres:16-alpine).
- Vespa schema (T06) là nơi duy nhất có embedding fields, dim 512 per ADR-036.

**R3-bis — V001 vs V002+ ALTER chain compatibility (kept)**

[giữ nguyên nội dung R3 cũ về V001 base columns vs V002 ALTERs vs V005 vs V006]
```

**Amendment 2: thêm Risk R11**

```markdown
**R11 — Grafana port conflict C11 (Phiên 3 phát hiện)**

- `06_OBSERVABILITY.md` lines 52, 559 spec port `3001:3000` cho Grafana 
  (legacy doc); `PHASE_01_INFRA.md` line 13 + 41 + DoD-6 spec `3002`. 
  Port 3001 cũng collide gateway service.
- Resolution: T07 dùng `3002:3000` per PHASE_01 + Rule 7 (priority 4 > 5).
- Document trong T07 + S00b-REPORT bonus conflicts section.
- Docs maintainer batch with C8/C9/C10 sau S-00b done.
```

### 2.3 Chuẩn bị bundle base (tái dùng cho mọi phiên)

Tạo 1 thư mục `s00b-base/` trên máy bạn, copy vào đó các file CỐ ĐỊNH (mọi phiên cùng dùng):

```
s00b-base/
├── docs/
│   ├── 00_CONTEXT.md           ← từ bundle Phiên 3 (docs/)
│   ├── 02_DATA_MODEL.md
│   ├── 05_CODING_CONVENTIONS.md
│   ├── 06_OBSERVABILITY.md
│   ├── 07_BEHAVIOR_LOGS.md
│   ├── 09_FIELD_AUDIT.md
│   ├── DECISIONS.md            ← gồm ADR-036
│   ├── phases/
│   │   ├── PHASE_01_INFRA.md
│   │   └── PHASE_00_DESIGN_SYSTEM.md  ← cần cho T08
│   └── workflow/
│       └── ICP_WORKFLOW_FINAL.md     ← cần cho mọi phiên (Step 7-10 format)
├── ai-delivery/
│   └── TASK_OPERATING_SYSTEM.md
├── slices/
│   ├── S-00b_BRIEF.md          ← Phiên 3 emit, amended per 2.2
│   ├── S-00b_TASKLIST.md       ← Phiên 3 emit; update DONE per task qua các phiên
│   └── S-00b_EXECUTION_GUIDE.md  ← file này
├── decisions-log.md            ← Section 9 của file này, save thành standalone
├── MASTER_ROADMAP.md
├── MASTER_SLICE_BACKLOG.md
└── s00-outputs/                ← từ bundle Phiên 3, KHÔNG modify
    ├── reports/
    ├── reviews/
    ├── slices/
    └── taskpacks/
```

**Lưu ý:** Các file `docs/03_API_CONTRACTS.md`, `04_INTENT_SPECS.md`, `08_FE_BE_CONTRACT.md`, `01_ARCHITECTURE.md`, các `PHASE_02-06`, `LOG_CATALOG.md`, `handoff/`, `infra/migrations/` chỉ cần ở 1-2 phiên cụ thể — sẽ list explicit trong từng task section.

### 2.4 Mỗi phiên xong → workflow update

Quy trình sau khi Phiên N (T0X) xong:

1. **Download outputs** từ chat: task pack + report + review + code files + `S-00b_TASKLIST.md` updated + `decisions-log.md` updated (nếu có amendment mới).

2. **Save vào folder** `s00b-outputs/T0X/` trên máy bạn (cumulative):
   ```
   s00b-outputs/
   ├── T01/
   │   ├── taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md
   │   ├── reports/S00b-T01_REPORT.md
   │   ├── reviews/S00b-T01_REVIEW.md
   │   └── code/
   │       ├── package.json
   │       ├── pnpm-workspace.yaml
   │       └── ... (8 files)
   ├── T02/
   │   └── ... (sẽ thêm sau Phiên 5)
   └── ...
   ```

3. **Replace** `s00b-base/slices/S-00b_TASKLIST.md` bằng version updated từ phiên đó.

4. **Replace** `s00b-base/decisions-log.md` nếu phiên đó emit version mới (có amendment).

5. **Mở phiên tiếp theo:** Zip lại bundle theo recipe của task tiếp theo (Section 4.X dưới), upload, paste prompt.

### 2.5 Nếu phiên fail / cần redo

- Phiên fail (vd AI dừng vì Rule 5 STOP, hoặc bạn không hài lòng output): KHÔNG save vào `s00b-outputs/`. Discuss với AI trong same phiên (extend conversation) hoặc đóng phiên + mở lại.
- Phiên redo: dùng same bundle + adjusted prompt. Outputs từ phiên fail bỏ.

---

## Section 3 — Common Prompt Preamble (shared cho mọi phiên T01-T08)

Dùng template này cho mỗi phiên, chỉ thay `<TASK_NUMBER>` (4-11) và `<TASK_NAME>`:

```text
Tôi mở Phiên <N> ICP, slice S-00b Foundation Scaffold, task S00b-T0<X> 
<TASK_NAME>.

## Output language

Tiếng Việt mix English technical terms (giữ y nguyên style Phiên 1-3). 
Code identifiers + library names + technical keywords giữ tiếng Anh; 
narrative + giải thích + comments cao cấp dùng tiếng Việt.

## Context state (đã chốt từ Phiên 1-3)

- Phiên 1: 4 ADRs locked (ADR-032/033/034/035).
- Phiên 2: S-00 Q-GATE audit done. 19 deliverables. 0/9 DoD met.
- Phiên 3: 
  - ADR-036 LOCKED CLIP ViT-B/32 512 dim cho Vespa text+image embeddings.
  - **C12 LOCKED Option B**: V001 KHÔNG có VECTOR columns; embeddings 
    Vespa-only.
  - S-00b BRIEF + TASKLIST locked (8 tasks linear T01→T08).
  - 5 pre-approved decisions D-01 đến D-05 (xem `decisions-log.md`).
  - 5 surfaced conflicts C8 đến C12 — KHÔNG silent fix, document trong reports.
- Phiên hiện tại = Phiên <N>, task = T0<X>.

## Bundle context

File `s00b-T0<X>-context.zip` đính kèm. Cấu trúc theo Section 4.<X> của 
`S-00b_EXECUTION_GUIDE.md`. Bao gồm:
- `s00b-base/` (docs/, ai-delivery/, slices/, decisions-log.md, MASTER_*.md, 
  s00-outputs/)
- `s00b-outputs/` (outputs các task trước T01..T0<X-1> — source of truth)
- Task-specific docs bổ sung (sẽ list trong prompt từng task)

## Read order (TUÂN THỦ ĐÚNG THỨ TỰ)

1. `slices/S-00b_EXECUTION_GUIDE.md` Section 1 (decisions + conflicts locked) 
   + Section 4.<X> (task-specific recipe)
2. `decisions-log.md` (full file — pre-approved decisions D-01 đến D-05 + 
   conflicts C8 đến C12 + amendments nếu có)
3. `slices/S-00b_BRIEF.md` (slice context — đặc biệt section Risks)
4. `slices/S-00b_TASKLIST.md` (verify task T0<X-1> marked DONE; xem row T0<X> 
   cho Output expected)
5. `s00b-outputs/T0<X-1>/...` (outputs từ task trước — treat as source of truth, 
   KHÔNG re-derive convention; nếu thấy inconsistency với current spec → 
   STOP + surface, KHÔNG silent reconcile)
6. Task-specific evidence per "Read First" trong task pack (sẽ tạo trong 
   Bước 1 dưới)

## Task scope (theo S-00b_TASKLIST row T0<X>)

[Đoạn này AI tự đọc từ tasklist row T0<X>, không cần human paste]

## Rules guidance

- **Rule 1 (AI propose, human chốt):** Task này code thật. Nếu gặp scope 
  decision không nằm trong 5 pre-approved decisions hoặc C12 resolution → 
  surface trước, KHÔNG tự decide.
- **Rule 5 STOP:** Spec ambiguity NGOÀI 5 decisions + 5 conflicts → DỪNG 
  + hỏi human. Đặc biệt:
  - Nếu T04/T06: phát hiện CLIP 512 không khả thi technical với Vespa 8.x 
    → STOP surface ADR-036, KHÔNG tự đổi dimension.
  - Nếu T04: phát hiện cần VECTOR column → REJECT (C12 đã lock Option B, 
    Vespa-only). Surface user prompt confusion nếu có.
- **Rule 7 surface, không silent fix:** Phát hiện docs inconsistency MỚI 
  (ngoài C8-C12) → ghi vào "Bonus — Conflicts Surfaced" section của report, 
  KHÔNG sửa docs/.

## Workflow execution (5 bước)

Theo `docs/workflow/ICP_WORKFLOW_FINAL.md` §Step 7-10:

**Bước 1: Task Pack** — Tạo `taskpacks/S00b-T0<X>_<NAME>.md` (10 sections 
per workflow Step 7 template). 
DỪNG hỏi human review task pack scope trước khi implement code. 
(Mục đích: catch scope drift trước khi tốn budget viết code.)

**Bước 2: Implement (sau human ack task pack)** — Code actual files. Output 
trong mirror repo structure dưới `outputs/`. Tuân thủ Allowed Changes / 
Forbidden Changes trong task pack. KHÔNG over-scope.

**Bước 3: Implementation Report** — Tạo `reports/S00b-T0<X>_REPORT.md` 
per workflow Step 8 template (Files Changed, What Implemented, Commands 
Run, Test Results, Deviations, Known Issues, Cross-Slice Integration Check, 
Recommended Next Step) + thêm "Bonus — Conflicts Surfaced" section nếu 
phát hiện inconsistency mới.

**Bước 4: Review (9 Gates)** — Tạo `reviews/S00b-T0<X>_REVIEW.md` với 9 
Gates: Scope/Source/Architecture/Contract/UI/Test/Regression/Demo/Cross-Slice. 
Mỗi gate verdict ACTIVE / N/A + justification + overall PASS/FIX/REJECT.

**Bước 5: Update tasklist** — Output `slices/S-00b_TASKLIST.md` updated 
(mark T0<X> row Status = DONE, append Status Log entry với datestamp).

**Bước 6 (conditional): Update decisions-log** — Nếu phát sinh amendment 
mới được human ack (vd ambiguity ngoài 5 pre-approved), append vào 
`decisions-log.md` section "Amendments" + emit file updated.

## Output deliverables expected

1. `taskpacks/S00b-T0<X>_<NAME>.md`
2. `reports/S00b-T0<X>_REPORT.md`
3. `reviews/S00b-T0<X>_REVIEW.md`
4. N × actual code files (per task scope — Section 4.<X> liệt kê)
5. `slices/S-00b_TASKLIST.md` updated
6. `decisions-log.md` updated (chỉ nếu có amendment)

Cuối cùng: `present_files` với file code đầu tiên (most relevant cho human 
review), sau đó các file workflow.

Bắt đầu bằng **Bước 1 (task pack)**. DỪNG sau task pack để human ack scope 
trước khi sang Bước 2.
```

---

## Section 4 — Bundle recipes + Task-specific prompts (T01 đến T08)

### Section 4.1 — Phiên 4: T01 Repo Root Scaffold

**Input bundle (`s00b-T01-context.zip`):**
```
s00b-base/                          ← TOÀN BỘ (theo Section 2.3)
└── (không cần files bổ sung — T01 only needs base)
```

Cụ thể trong `s00b-base/docs/` cần (T01 sẽ chỉ đọc 4 files này, nhưng bundle full base để consistent):
- `00_CONTEXT.md` (Section 1 repo layout + Section 2 tech stack + Section 10 critical constraints)
- `05_CODING_CONVENTIONS.md` (Section 5 env vars config pattern + Section 6 git)
- `phases/PHASE_01_INFRA.md` (Day 1 + Day 7 spec + Cấu trúc thư mục root)
- `workflow/ICP_WORKFLOW_FINAL.md` (Step 7-10 templates)

**Output expected (12 files total):**

*Code files (8 files at repo root, mirror cấu trúc PHASE_01_INFRA.md lines 58-110):*
1. `outputs/package.json` — root, declare workspaces, scripts: dev/build/lint/test/typecheck/clean/format/obs:up/obs:down (chưa có actual content, chỉ pnpm orchestrator)
2. `outputs/pnpm-workspace.yaml` — declare `apps/*`, `packages/*` patterns
3. `outputs/tsconfig.base.json` — per D-05 (module=esnext + moduleResolution=bundler + target=es2022 + strict=true + skipLibCheck=true + lib es2022/DOM/DOM.Iterable)
4. `outputs/.gitignore` — node_modules, .next, dist, *.env (NOT .env.example), .turbo, .DS_Store, .vscode (selective)
5. `outputs/.editorconfig` — UTF-8 charset + LF line endings + 2 space indent (TS/JS/JSON/YAML) + 4 space (Python)
6. `outputs/.env.example` — full env contract (xem prompt notes dưới cho list)
7. `outputs/Makefile` — targets: `up`, `down`, `seed`, `migrate`, `vespa:deploy`, `logs`, `obs:up`, `obs:down`, `clean`, `lint`, `test`, `typecheck`
8. `outputs/README.md` — quickstart `make up && make seed` + tech stack overview + link to docs/

*Workflow files (4 files):*
9. `outputs/taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md`
10. `outputs/reports/S00b-T01_REPORT.md`
11. `outputs/reviews/S00b-T01_REVIEW.md`
12. `outputs/slices/S-00b_TASKLIST.md` (T01 marked DONE)

**Prompt template:**

Sau khi paste common preamble (Section 3), thay `<N>=4`, `<X>=01`, `<TASK_NAME>=Repo Root Scaffold`, rồi append đoạn sau:

```text
## Task-specific notes T01

### Files cần emit (8 root config + 4 workflow):

8 root config files exact theo PHASE_01_INFRA.md cấu trúc thư mục root 
(lines 58-110): package.json, pnpm-workspace.yaml, tsconfig.base.json, 
.gitignore, .editorconfig, .env.example, Makefile, README.md.

### KHÔNG làm trong T01:
- KHÔNG init `packages/shared-types/` hoặc `apps/workers/` — defer T02
- KHÔNG init `apps/<service>/` files — defer T03  
- KHÔNG tạo `infra/migrations/`, `infra/seed/`, `infra/vespa/`, `infra/otel/` 
  files — defer T04-T07
- KHÔNG tạo compose files — defer T07 (obs) + T08 (app)
- KHÔNG tạo `.github/workflows/` — defer T08

### Makefile targets specific:

- `make up`: chạy MERGED 2 compose files
  ```bash
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml up -d
  ```
  Note: 2 file này CHƯA tồn tại tại thời điểm T01 (T07 + T08 sẽ tạo). Makefile 
  chỉ reference paths.
- `make down`: tear down both
- `make migrate`: gọi `bash infra/migrations/apply.sh` (file này T04 sẽ tạo)
- `make seed`: chain `make migrate` → `node infra/seed/seed.ts` (T05 sẽ tạo)
- `make vespa:deploy`: gọi `bash infra/vespa/deploy.sh` (T06 sẽ tạo)
- `make obs:up` / `make obs:down`: escape hatch chỉ obs compose
- `make logs`: `docker compose logs -f --tail=100`
- `make clean`: rm -rf node_modules apps/*/node_modules packages/*/node_modules
- `make lint` / `make test` / `make typecheck`: pnpm orchestration

### .env.example contract (complete):

Per `06_OBSERVABILITY.md` Section 16 + `05_CODING_CONVENTIONS.md` Section 5 + 
`PHASE_01_INFRA.md` Day 1-7:

```bash
# === Core infrastructure ===
DATABASE_URL=postgresql://icp:icp_dev_password@postgres:5432/icp
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=redpanda:9092

# === Auth (Phase 02 will populate, Phase 01 placeholder) ===
JWT_SECRET=change_me_in_production_use_openssl_rand_base64_32

# === OpenTelemetry (Phase 01 active) ===
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
OTEL_LOG_LEVEL=info
OTEL_TRACES_SAMPLER=parentbased_always_on

# === Per-service identity (override per service in docker-compose.yml) ===
OTEL_SERVICE_NAME=icp-default
APP_VERSION=0.0.1

# === Vespa (Phase 01 deploy script) ===
VESPA_CONFIG_SERVER=http://vespa:19071
VESPA_QUERY_URL=http://vespa:8080

# === LLM API keys (Phase 02+ active; .env real, NOT commit) ===
GEMINI_API_KEY=
OPENAI_API_KEY=

# === Frontend public (Next.js exposes these to client) ===
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_VERSION=0.0.1
NEXT_PUBLIC_SSE_URL=http://localhost:3001/api/v1/intent/stream
```

### tsconfig.base.json specifics (D-05):

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Note: NestJS gateway sẽ override `module: commonjs` + `moduleResolution: node` 
trong `apps/gateway/tsconfig.json` extends base (T03 task).

### Emit order (3 groups):

Group 1: `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json`
Group 2: `.gitignore` + `.editorconfig` + `.env.example`
Group 3: `Makefile` + `README.md`

Sau mỗi group, có thể pause cho human spot-check. Workflow files (task pack, 
report, review, tasklist) emit cuối.

### Cross-check trước khi finalize:

- pnpm-workspace.yaml pattern `packages/*` (NOT `package/*`) — critical cho 
  T02 resolve `@icp/shared-types`
- Makefile references files chưa tồn tại (apply.sh, deploy.sh, compose files) 
  — đây OK, T04-T08 sẽ tạo, document trong report Known Issues
- README.md mention 4 ADR-033/034/035/036 + link DECISIONS.md
```

---

### Section 4.2 — Phiên 5: T02 Shared Packages & Workers Skeleton

**Input bundle (`s00b-T02-context.zip`):**
```
s00b-base/                          ← TOÀN BỘ
s00b-outputs/
└── T01/                            ← outputs từ Phiên 4
    ├── code/
    │   ├── package.json
    │   ├── pnpm-workspace.yaml
    │   ├── tsconfig.base.json
    │   └── ... (5 file khác)
    ├── taskpacks/S00b-T01_*.md
    ├── reports/S00b-T01_REPORT.md
    └── reviews/S00b-T01_REVIEW.md
```

Cụ thể docs bổ sung trong `s00b-base/docs/` cần cho T02:
- `08_FE_BE_CONTRACT.md` (Section 3 — shared-types directory structure target — dù T02 chỉ scaffold empty, layout pattern đúng từ đầu)

**Output expected (10 files):**

*Code files (6 files):*
1. `outputs/packages/shared-types/package.json` (name `@icp/shared-types`, version `0.0.1`, type `module`, main `dist/index.js`, types `dist/index.d.ts`, scripts build/dev/typecheck, devDeps: typescript)
2. `outputs/packages/shared-types/tsconfig.json` (extends `../../tsconfig.base.json`, include `src/**/*`, outDir `dist`)
3. `outputs/packages/shared-types/src/index.ts` (empty barrel: `export {};` + comment "Populated by S-02 codegen — see 08_FE_BE_CONTRACT.md")
4. `outputs/apps/workers/package.json` (name `@icp/workers`, version `0.0.1`, scripts dev/start/build, deps minimal)
5. `outputs/apps/workers/src/index.ts` (stub: `console.log('ICP workers package — not started yet (per S-00b T02)'); process.exit(0);`)
6. `outputs/apps/workers/tsconfig.json` (extends base)

*Workflow files (4 files):*
7-10. taskpack/report/review/updated tasklist

**Prompt template:**

Common preamble với `<N>=5`, `<X>=02`, `<TASK_NAME>=Shared Packages & Workers Skeleton`, rồi append:

```text
## Task-specific notes T02

### Pre-flight verification (BẮT BUỘC):

Đọc `s00b-outputs/T01/code/pnpm-workspace.yaml` trước khi implement. Confirm:
- Có pattern `packages/*` (KHÔNG `package/*` typo)
- Có pattern `apps/*`

Nếu sai → STOP + report inconsistency, ask human (KHÔNG silent fix T01 output 
— đó là T01 review responsibility).

### Files cần emit (6 code + 4 workflow):

`packages/shared-types/` (3 files): package.json + tsconfig.json + src/index.ts
`apps/workers/` (3 files): package.json + src/index.ts + tsconfig.json

### KHÔNG làm trong T02:

- KHÔNG populate type definitions trong shared-types/src/ — defer S-02 codegen 
  pipeline (Zod schemas + DTO + domain types + behavior events PropertiesMap 
  + SSE event types per `08_FE_BE_CONTRACT.md` Section 3)
- KHÔNG implement codegen scripts (`pnpm openapi:sync` workflow) — defer S-02
- KHÔNG implement shopee-mock-seed-worker.ts business logic — defer S-02
- KHÔNG tạo file workers/src/shopee-mock-seed-worker.ts — chỉ index.ts stub
- KHÔNG implement workers other than skeleton (payment, inventory, notification, 
  card-generator, behavior-aggregator, outbox — tất cả Phase 04+)

### shared-types details:

package.json:
```json
{
  "name": "@icp/shared-types",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

src/index.ts:
```typescript
/**
 * @icp/shared-types
 * 
 * Single source of truth cho TypeScript types dùng chung giữa FE-BE.
 * Bao gồm: Zod schemas, DTOs, domain entities, SSE events, behavior 
 * PropertiesMap, auto-generated OpenAPI client (gitignored).
 * 
 * **Status:** Empty scaffold (S-00b T02). Types + codegen sẽ được populate 
 * trong S-02 P-CAP Runtime Foundation per `docs/08_FE_BE_CONTRACT.md` 
 * Section 3.
 * 
 * @see docs/08_FE_BE_CONTRACT.md
 */
export {};
```

### workers details:

package.json:
```json
{
  "name": "@icp/workers",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsc --watch & node --watch dist/index.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

src/index.ts:
```typescript
/**
 * @icp/workers
 * 
 * Kafka consumer workers cho ICP (payment, inventory, notification, 
 * card-generator, behavior-aggregator, outbox, shopee-mock-seed).
 * 
 * **Status:** Skeleton (S-00b T02). Workers actual logic sẽ được implement 
 * trong Phase 04+ (S-05 cart/payment workers) hoặc earlier nếu Intent 01 
 * demo timing requires shopee-mock-seed-worker (per Brief Non-goals).
 */
console.log('ICP workers package — not started yet (per S-00b T02)');
process.exit(0);
```

### Test scenario (mention in report):

- `pnpm install` ở root: cả 2 workspace packages được resolve
- `pnpm --filter @icp/shared-types build`: exit 0, tạo `dist/index.js` 
  + `dist/index.d.ts`
- `pnpm --filter @icp/workers build`: exit 0
- `pnpm --filter @icp/workers start`: exit 0 với message stub
```

---

### Section 4.3 — Phiên 6: T03 Service Dockerfile Stubs

**Input bundle (`s00b-T03-context.zip`):**
```
s00b-base/
s00b-outputs/T01/
s00b-outputs/T02/
```

Docs bổ sung trong `s00b-base/docs/` cần cho T03:
- `06_OBSERVABILITY.md` ⭐ (Section 12 — /health endpoint format) — **FIX #1 applied**

**Output expected (12 files):**

*Code files (8 files — 2 per service × 4 services):*
1. `outputs/apps/gateway/Dockerfile` (Node 20 alpine, stub HTTP server, HEALTHCHECK on /health, port 3001)
2. `outputs/apps/gateway/package.json` (minimal stub: name `@icp/gateway`, scripts placeholder)
3. `outputs/apps/ai/Dockerfile` (Python 3.11 slim, stub HTTP server, HEALTHCHECK on /health, port 5001)
4. `outputs/apps/ai/pyproject.toml` (minimal stub: name `icp-ai`, dependencies placeholder)
5. `outputs/apps/mcp/Dockerfile` (Python 3.11 slim, stub HTTP server, HEALTHCHECK on /health, port 5050)
6. `outputs/apps/mcp/pyproject.toml` (minimal stub: name `icp-mcp`)
7. `outputs/apps/web/Dockerfile` (Node 20 alpine, **placeholder** — T08 sẽ overwrite với Next.js multi-stage build)
8. `outputs/apps/web/package.json` (T03: minimal stub for build context; T08 sẽ overwrite với full Next.js stack)

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=6`, `<X>=03`, `<TASK_NAME>=Service Dockerfile Stubs`, rồi append:

```text
## Task-specific notes T03

### Pre-flight verification:

- Đọc `s00b-outputs/T01/code/.env.example`: verify ports + service names 
  align với plan.
- Đọc `06_OBSERVABILITY.md` Section 12 (lines 496-501): /health endpoint 
  format chuẩn (`GET /health → 200 { status: 'ok' }`).

### Files cần emit (8 code: 2 per service × 4 services):

KHÔNG có business logic. KHÔNG có OTel SDK. KHÔNG có real controllers. 
Mỗi service chỉ có:
1. Dockerfile minimal (FROM base + COPY package.json/pyproject.toml + CMD stub HTTP server + HEALTHCHECK)
2. package.json hoặc pyproject.toml minimal stub (để Docker build context resolve)

### Stub HTTP server pattern (CRITICAL — phải respond `/health` đúng spec):

**Node services (gateway, web):**
```dockerfile
CMD ["node", "-e", "require('http').createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',stub:true}));}else{res.writeHead(404);res.end();}}).listen(<PORT>);console.log('stub on <PORT>')"]
```

**Python services (ai, mcp):**
```dockerfile
CMD ["python", "-c", "import http.server,json; \\
class H(http.server.BaseHTTPRequestHandler):\\
  def do_GET(self):\\
    if self.path=='/health':\\
      self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers();\\
      self.wfile.write(json.dumps({'status':'ok','stub':True}).encode())\\
    else: self.send_response(404); self.end_headers()\\
http.server.HTTPServer(('',<PORT>),H).serve_forever()"]
```

(Có thể inline OR copy ra `/tmp/stub.py` rồi `CMD python /tmp/stub.py` — 
chọn cách clean hơn cho Dockerfile syntax.)

### HEALTHCHECK directive (per D-02):

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O- http://localhost:<PORT>/health || exit 1
```

Note: alpine images cần `wget` (built-in) hoặc cài `curl` separately. Node 
alpine có wget built-in; Python slim image cần `RUN apt-get install -y wget` 
OR dùng `curl`. **Decision:** Node images dùng `wget`; Python slim cài 
`curl` cho consistency với production patterns.

### Port assignments per PHASE_01_INFRA.md lines 22-32:

- gateway: 3001
- ai: 5001  
- mcp: 5050
- web: 3000

(Note C11 conflict: Grafana sẽ dùng 3002 NOT 3001 trong T07 — verified.)

### apps/web/Dockerfile T03 = PLACEHOLDER:

T08 sẽ overwrite Dockerfile này hoàn toàn với Next.js multi-stage build 
(builder + runner stages, output: standalone). T03 chỉ tạo stub đủ để 
compose `web` service resolve build context tại thời điểm T08 stitch 
compose file.

Document explicit trong T03 report Known Issues: "apps/web/Dockerfile + 
apps/web/package.json là T03 stub placeholders, T08 sẽ overwrite. Đây 
là intentional sequencing — T08 cần web source code trước khi viết 
production Dockerfile."

### KHÔNG làm trong T03:

- KHÔNG implement NestJS controllers / Flask routes / MCP tool registry
- KHÔNG add OTel SDK dependencies
- KHÔNG add logger packages
- KHÔNG create src/ directories beyond minimum needed
- KHÔNG init Nest CLI / Next.js — defer T08 cho web; defer S-02 cho 
  gateway/ai/mcp full structure

### Test scenario (mention report):

- `docker build -f apps/gateway/Dockerfile -t icp-gateway-stub .` succeeds
- `docker run -p 3001:3001 icp-gateway-stub` boots
- `curl http://localhost:3001/health` returns `{"status":"ok","stub":true}`
- Repeat cho ai (5001), mcp (5050)
- web (3000): T03 stub respond same; T08 thay thế

### DoD-3 verdict trong S00b consolidated:

PARTIAL — stubs respond /health literal per DoD-3 wording, nhưng:
- KHÔNG có /health/ready với dep status (per 06_OBSERVABILITY Section 12)
- KHÔNG có real business logic
- S-02 will replace with NestJS HealthController + Flask health module + 
  MCP HTTP server với JSON-RPC + /health.

Document explicit trong T03 report.
```

---

### Section 4.4 — Phiên 7: T04 V001 Migrations + apply.sh

**Input bundle (`s00b-T04-context.zip`):**
```
s00b-base/
s00b-outputs/T01/
infra/migrations/                   ← TASK-SPECIFIC: 5 SQL files Phiên 1 commit
├── V002__product_enrichment.sql
├── V003__insights.sql
├── V005__payment_metadata.sql
├── V006__analytics_aggregations.sql
└── V008__shopee_prices_mock.sql
```

Docs bổ sung trong `s00b-base/docs/` cần cho T04 (đã trong base, list để biết):
- `02_DATA_MODEL.md` ⭐ (Section 1 lines 1-165 base DDL — V001 source of truth)
- `07_BEHAVIOR_LOGS.md` (Section 5 behavior_events DDL cross-check)
- `09_FIELD_AUDIT.md` (V004/V007 skip rationale + image storage base64 inline decision)
- `DECISIONS.md` (ADR-036 — note ADR-036 NOT applied to V001 per C12=B)

**Output expected (6 files):**

*Code files (2 files):*
1. `outputs/infra/migrations/V001__init.sql` (~250-300 lines: 10 tables base DDL exactly mirror `02_DATA_MODEL.md` Section 1 + behavior_events partitioned + 3 month partitions + indexes + extensions uuid-ossp/pgcrypto + schema_migrations metadata table)
2. `outputs/infra/migrations/apply.sh` (bash runner — idempotent, walks V*.sql, records to schema_migrations)

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=7`, `<X>=04`, `<TASK_NAME>=Database Migrations V001 + apply.sh`, rồi append:

```text
## Task-specific notes T04 — CRITICAL TASK

### ⚠️ C12 LOCKED Option B reminder (HARD CONSTRAINT):

V001 KHÔNG CÓ:
- `text_embedding VECTOR(512)` column
- `image_embedding VECTOR(512)` column  
- `CREATE EXTENSION vector;`
- pgvector references

Embeddings stored ONLY trong Vespa (T06 task). Postgres `products` table 
giữ source-of-truth domain data, KHÔNG duplicate embedding.

Nếu nội dung nào trong context (user prompt cũ, S00-REPORT, etc) ghi 
"V001 with VECTOR columns" → REJECT theo C12 LOCKED. Surface in T04 
report "Bonus — Conflicts Surfaced" với citation S-00b_EXECUTION_GUIDE 
Section 1.2.

### Pre-flight verification (BẮT BUỘC):

1. Đọc `infra/migrations/V002__product_enrichment.sql` (bundle) — note 
   những columns V002 ADD vào products: brand, original_price, rating_avg, 
   rating_count, sold_count, image_gradient, icon_hint. V001 KHÔNG include.

2. Đọc `infra/migrations/V003__insights.sql` — note V003 CREATE TABLE 
   insights với FK đến users(id). V001 phải tạo users TRƯỚC.

3. Đọc `infra/migrations/V005__payment_metadata.sql` — note V005 ALTER 
   transactions ADD: payment_method, failure_reason, metadata, 
   provider_txn_id, completed_at. V001 KHÔNG include.

4. Đọc `infra/migrations/V006__analytics_aggregations.sql` — note V006 
   tạo MATERIALIZED VIEW analytics_daily JOIN orders + order_items. V001 
   tạo orders + order_items base table, KHÔNG include MV.

5. Đọc `infra/migrations/V008__shopee_prices_mock.sql` — note V008 tạo 
   shopee_prices_mock table standalone (no FK). V001 KHÔNG include.

6. Đọc `docs/02_DATA_MODEL.md` Section 1 lines 1-165 — V001 mirror EXACTLY 
   những tables này:
   - users (line 8-16)
   - sessions (line 18-26)
   - products (line 29-49, 11 base columns)
   - events (line 51-65)
   - policies (line 67-76)
   - action_cards (line 78-93)
   - orders (line 95-106)
   - order_items (line 108-117)
   - transactions (line 119-128, base columns — KHÔNG V005 additions)
   - behavior_events partitioned (line 130-160) + 3 month partitions 
     (y2026m05, y2026m06, y2026m07) + 4 indexes

7. Đọc `docs/09_FIELD_AUDIT.md` lines 305-320 — confirm V004 (promotions) 
   + V007 (media_uploads) intentionally skipped per hackathon scope. V001 
   reflect base schema only, không có promotions table, image storage là 
   base64 inline trong products.image_url (TEXT/VARCHAR(500) per 
   02_DATA_MODEL line 39).

### V001 file structure:

```sql
-- V001__init.sql
-- Foundational migration cho ICP — base schema cho Phase 01.
-- Source of truth: docs/02_DATA_MODEL.md Section 1 (lines 1-165).
-- 
-- Decision C12 (Phiên 3 LOCKED 2026-05-18 Option B): Embeddings Vespa-only.
-- V001 KHÔNG include text_embedding/image_embedding VECTOR columns trong 
-- products. Embeddings stored exclusively trong Vespa search index per 
-- ADR-036 (CLIP ViT-B/32 512 dim).
-- 
-- Migration chain: V001 (this) → V002 → V003 → V005 → V006 → V008.
-- V004 (promotions) + V007 (media_uploads) intentionally skipped per 
-- docs/09_FIELD_AUDIT.md lines 312-315.

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- cho gen_random_uuid() 
                                              -- (actually pgcrypto, see below)
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid() native

-- ============================================================================
-- 1. SCHEMA_MIGRATIONS METADATA (used by apply.sh)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)
);

-- ============================================================================
-- 2. USERS
-- ============================================================================

[copy EXACT từ 02_DATA_MODEL.md lines 8-16]

-- ============================================================================
-- 3. SESSIONS
-- ============================================================================

[copy EXACT từ 02_DATA_MODEL.md lines 18-27 — bao gồm idx_sessions_jti]

-- ... continue for all 10 tables ...

-- ============================================================================
-- 11. BEHAVIOR_EVENTS (partitioned by occurred_at)
-- ============================================================================

[copy EXACT từ 02_DATA_MODEL.md lines 132-160]

-- 3 month partitions per 02_DATA_MODEL line 150-155:
CREATE TABLE behavior_events_y2026m05 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE behavior_events_y2026m06 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE behavior_events_y2026m07 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 4 indexes per 02_DATA_MODEL lines 157-160
[copy nguyên]
```

### apply.sh per D-04:

```bash
#!/usr/bin/env bash
# apply.sh — idempotent migration runner cho ICP
# Walks infra/migrations/V*.sql alphabetically, applies pending ones, 
# records in schema_migrations.
# 
# Usage: DATABASE_URL=postgresql://... ./apply.sh
# Or: cd infra/migrations && ./apply.sh (reads ../../.env)

set -euo pipefail

# === Resolve DATABASE_URL ===
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "../../.env" ]; then
    export $(grep -v '^#' ../../.env | grep DATABASE_URL | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Source .env or pass explicitly." >&2
  exit 1
fi

# === Bootstrap schema_migrations if not exists ===
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)
);
EOF

# === Walk migrations alphabetically ===
MIGRATION_DIR="$(dirname "$0")"
APPLIED_COUNT=0
SKIPPED_COUNT=0

for file in "$MIGRATION_DIR"/V*.sql; do
  filename=$(basename "$file")
  
  # Check if already applied
  already_applied=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT 1 FROM schema_migrations WHERE filename = '$filename';")
  
  if [ "$already_applied" = "1" ]; then
    echo "SKIP $filename (already applied)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi
  
  echo "APPLY $filename..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  
  # Record success
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
  
  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done

echo ""
echo "=== Migration summary ==="
echo "Applied: $APPLIED_COUNT"
echo "Skipped: $SKIPPED_COUNT (already applied)"
echo "Done."
```

Make executable: `chmod +x apply.sh` (mention in report).

### Test scenario (mention report):

- Clean DB: `make up` brings up postgres; `make migrate` applies V001..V008 
  (skip V004/V007 naturally — no file)
- Verify: `psql -c "\dt"` shows expected 14 tables (10 V001 base + V002 
  product_reviews + V003 insights + V008 shopee_prices_mock) + V006 
  materialized view
- Verify partitions: `psql -c "\dt behavior_events*"` shows parent + 
  3 partitions
- Verify schema_migrations: `psql -c "SELECT * FROM schema_migrations 
  ORDER BY filename"` shows 6 rows (V001, V002, V003, V005, V006, V008)
- Re-run idempotency: `make migrate` again → all skipped

### Conflict C12 explicit document trong T04 report:

Bonus section "Conflicts Surfaced" liệt kê C12 với resolution: Option B 
LOCKED Phiên 3. V001 strictly matches 02_DATA_MODEL.md Section 1, no 
VECTOR columns. Cross-ref `S-00b_EXECUTION_GUIDE.md` Section 1.2.

### Conflict C8 minor mention:

T04 không touch Vespa schema. C8 (768 vs 512) là T06 responsibility. 
T04 chỉ informational mention.
```

---

### Section 4.5 — Phiên 8: T05 Seed Data

**Input bundle (`s00b-T05-context.zip`):**
```
s00b-base/
s00b-outputs/T01/
s00b-outputs/T04/                   ← cần V001 schema reference
```

Docs trong base đã đủ (`00_CONTEXT.md` Section 9 + `02_DATA_MODEL.md`).

**Output expected (10 files):**

*Code files (6 files):*
1. `outputs/infra/seed/users.json` (5 users plain password "demo1234" + role)
2. `outputs/infra/seed/products.json` (50 products: 10 categories × 5 products)
3. `outputs/infra/seed/policies.json` (2-3 mock policies)
4. `outputs/infra/seed/seed.ts` (TypeScript script: bcrypt hash, idempotent insert, log)
5. `outputs/infra/seed/package.json` (deps: pg, bcryptjs, dotenv, devDeps: tsx, typescript, @types/pg, @types/bcryptjs)
6. `outputs/infra/seed/tsconfig.json` (extends base)

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=8`, `<X>=05`, `<TASK_NAME>=Seed Data Scaffold`, rồi append:

```text
## Task-specific notes T05

### Pre-flight verification:

1. Đọc `s00b-outputs/T04/code/V001__init.sql` — verify exact column list 
   của tables users, products, policies. Seed insert phải match base 
   columns (V002+ columns sẽ có DEFAULT, không cần seed populate trừ khi 
   want demo data).

2. Đọc `00_CONTEXT.md` Section 9 (lines 132-138):
   - 50 products, 10 categories: nuoc_tuong, dau_an, mi_tom, sua, banh_keo, 
     gia_vi, nuoc_giai_khat, do_dong_hop, gao, banh_mi
   - 5 users: 2 merchants + 2 customers + 1 admin
   - All passwords plain "demo1234" → seed.ts bcrypt hash với cost 10 (D-01)

### users.json structure:

```json
[
  {
    "email": "merchant1@demo.icp",
    "password": "demo1234",
    "role": "merchant",
    "display_name": "Anh Nam"
  },
  {
    "email": "merchant2@demo.icp",
    "password": "demo1234",
    "role": "merchant",
    "display_name": "Chị Lan"
  },
  {
    "email": "customer1@demo.icp",
    "password": "demo1234",
    "role": "customer",
    "display_name": "Khách 1"
  },
  {
    "email": "customer2@demo.icp",
    "password": "demo1234",
    "role": "customer",
    "display_name": "Khách 2"
  },
  {
    "email": "admin@demo.icp",
    "password": "demo1234",
    "role": "admin",
    "display_name": "Admin"
  }
]
```

### products.json structure (5 sample, full 50 follow pattern):

```json
[
  {
    "title": "Nước tương Maggi 200ml",
    "description": "Nước tương đậm đà truyền thống",
    "category": "nuoc_tuong",
    "attributes": {"brand": "Maggi", "size": "200ml"},
    "price": 25000,
    "stock": 100,
    "image_url": "",
    "trend_score": 0.75,
    "merchant_email": "merchant1@demo.icp"
  },
  ...
]
```

Note: `merchant_email` là JSON-side reference; seed.ts sẽ resolve sang 
`merchant_id UUID` qua SELECT users.id WHERE email = $1.

### policies.json structure (2-3 mock):

Per `02_DATA_MODEL.md` Section 4 (mock policies seed data) — chỉ 2-3 policy 
codes minimal cho demo trigger sau:

```json
[
  {
    "code": "PRICE_TOO_HIGH_v1",
    "description": "Detect khi merchant set price cao hơn 30% so với median market.",
    "rule_dsl": {
      "trigger": "ProductCreated",
      "condition": {"field": "price_vs_median_pct", "op": ">", "value": 30},
      "action": {"type": "SUGGEST_PRICE", "template": "price_outlier_warn"}
    },
    "priority": 100,
    "enabled": true
  },
  {
    "code": "STOCK_LOW_v1",
    "description": "Cảnh báo khi stock < 10.",
    "rule_dsl": {
      "trigger": "ProductUpdated",
      "condition": {"field": "stock", "op": "<", "value": 10},
      "action": {"type": "SUGGEST_RESTOCK", "template": "stock_low_warn"}
    },
    "priority": 90,
    "enabled": true
  }
]
```

### seed.ts structure (key sections):

```typescript
#!/usr/bin/env tsx
/**
 * seed.ts — ICP development seed runner.
 * 
 * Loads users.json, products.json, policies.json; bcrypt-hashes passwords; 
 * inserts to Postgres idempotently (ON CONFLICT DO NOTHING).
 * 
 * Usage: DATABASE_URL=... tsx infra/seed/seed.ts
 *   OR: make seed (chains make migrate first)
 * 
 * Decision D-01: bcrypt cost 10 (bcryptjs library).
 */

import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

const BCRYPT_COST = 10;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  try {
    // === 1. USERS ===
    const users = JSON.parse(
      readFileSync(join(__dirname, 'users.json'), 'utf-8')
    );
    let usersInserted = 0;
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, BCRYPT_COST);
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role, display_name) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (email) DO NOTHING 
         RETURNING id`,
        [u.email, hash, u.role, u.display_name]
      );
      if (res.rowCount === 1) usersInserted++;
    }
    console.log(`Users: inserted ${usersInserted}, skipped ${users.length - usersInserted}`);
    
    // === 2. PRODUCTS ===
    const products = JSON.parse(
      readFileSync(join(__dirname, 'products.json'), 'utf-8')
    );
    let productsInserted = 0;
    for (const p of products) {
      // Resolve merchant_id
      const merchantRes = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [p.merchant_email]
      );
      if (merchantRes.rowCount === 0) {
        console.warn(`Skip product "${p.title}" — merchant ${p.merchant_email} not found`);
        continue;
      }
      const merchantId = merchantRes.rows[0].id;
      
      const res = await client.query(
        `INSERT INTO products 
         (merchant_id, title, description, category, attributes, price, stock, image_url, trend_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          merchantId,
          p.title,
          p.description,
          p.category,
          JSON.stringify(p.attributes),
          p.price,
          p.stock,
          p.image_url || null,
          p.trend_score || 0,
        ]
      );
      if (res.rowCount === 1) productsInserted++;
    }
    console.log(`Products: inserted ${productsInserted}, skipped ${products.length - productsInserted}`);
    
    // === 3. POLICIES ===
    const policies = JSON.parse(
      readFileSync(join(__dirname, 'policies.json'), 'utf-8')
    );
    let policiesInserted = 0;
    for (const pol of policies) {
      const res = await client.query(
        `INSERT INTO policies (code, description, rule_dsl, priority, enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING
         RETURNING id`,
        [pol.code, pol.description, JSON.stringify(pol.rule_dsl), pol.priority, pol.enabled]
      );
      if (res.rowCount === 1) policiesInserted++;
    }
    console.log(`Policies: inserted ${policiesInserted}, skipped ${policies.length - policiesInserted}`);
    
    console.log('Seed complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

### package.json (seed):

```json
{
  "name": "@icp/seed",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "seed": "tsx seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "@types/pg": "^8.11.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.0.0"
  }
}
```

### Notes về V002+ columns trong products:

V002 ALTERs add brand/original_price/rating_avg/rating_count/sold_count/
image_gradient/icon_hint. Khi `make migrate && make seed` chạy: V002 ALTERs 
applied TRƯỚC seed.ts insert, nên columns này tồn tại.

seed.ts insert chỉ base columns (V001 set). V002 columns sẽ là NULL hoặc 
DEFAULT (per V002 DDL). Acceptable cho hackathon seed data.

Optional enhancement: nếu products.json có "brand" trong attributes, có 
thể thêm UPDATE statement sau insert để backfill products.brand. V002 đã 
có UPDATE backfill từ attributes->>'brand' (lines 18-20 V002 file), nên 
KHÔNG cần làm lại trong seed.ts (idempotent — backfill chạy 1 lần khi 
V002 apply).

### Test scenario (mention report):

- Lần 1: `make seed` → 5 users + 50 products + 2 policies inserted
- Lần 2: `make seed` → 0 inserted, all skipped (idempotent)
- Verify: `psql -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM products; 
  SELECT COUNT(*) FROM policies;"` returns 5, 50, 2.
- Verify password hash: `psql -c "SELECT email, LENGTH(password_hash) FROM 
  users LIMIT 1;"` returns LENGTH=60 (bcrypt format `$2a$10$...`).
```

---

### Section 4.6 — Phiên 9: T06 Vespa Schema

**Input bundle (`s00b-T06-context.zip`):**
```
s00b-base/
s00b-outputs/T01/                   ← Makefile reference deploy.sh
```

Docs trong base đã đủ (`02_DATA_MODEL.md` Section 2 + `07_BEHAVIOR_LOGS.md` Section 6 + `DECISIONS.md` ADR-036 + ADR-024).

**Output expected (7 files):**

*Code files (3 files):*
1. `outputs/infra/vespa/schemas/product.sd` (CLIP 512 per C8 resolution + 11 behavioral fields + 9 summary fields per ADR-024 + 2 rank-profiles hybrid/image_similarity)
2. `outputs/infra/vespa/services.xml` (single-container dev cluster)
3. `outputs/infra/vespa/deploy.sh` (bash: build app package zip, deploy via REST API to :19071)

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=9`, `<X>=06`, `<TASK_NAME>=Vespa Schema`, rồi append:

```text
## Task-specific notes T06 — CRITICAL TASK

### ⚠️ C8 conflict resolution (HARD CONSTRAINT):

ADR-036 CLIP ViT-B/32 512 dim WINS over `02_DATA_MODEL.md` lines 205, 217, 
244, 256 (spec 768). Per Rule 7 hierarchy: ADR (priority 2) > general spec 
(priority 5). T06 áp dụng 512 mọi nơi.

product.sd phải dùng:
- `field text_embedding type tensor<float>(x[512])`
- `field image_embedding type tensor<float>(x[512])`
- Rank-profile inputs: `query(text_query) tensor<float>(x[512])`
- Rank-profile inputs: `query(img_query) tensor<float>(x[512])`

⚠️ Rule 5 STOP check: nếu Vespa 8.x KHÔNG support `tensor<float>(x[512])` 
syntax (rất unlikely — Vespa support arbitrary tensor dim) hoặc HNSW config 
incompatible → STOP, surface, hỏi human re-evaluate ADR-036. KHÔNG tự đổi 
dimension về 768.

### C12 reminder (cross-cutting):

C12 LOCKED Option B: embeddings Vespa-only. T06 là nơi duy nhất create 
embedding storage. T04 V001 KHÔNG có embedding columns. Coherent.

### product.sd structure (target ~120 lines):

```
schema product {

  document product {
    
    # === Core identity ===
    field id type string {
      indexing: attribute | summary
    }
    field merchant_id type string {
      indexing: attribute
    }
    
    # === Searchable text (BM25 + embedding) ===
    field title type string {
      indexing: index | summary
      index: enable-bm25
    }
    field description type string {
      indexing: index | summary
      index: enable-bm25
    }
    
    # === Category + structured attrs ===
    field category type string {
      indexing: attribute | summary
      attribute: fast-search
    }
    field price type long {
      indexing: attribute | summary
    }
    field stock type int {
      indexing: attribute | summary
    }
    field attributes type map<string, string> {
      indexing: summary
    }
    
    # === Display fields (denormalized per ADR-024) ===
    # Avoid FE JOIN to Postgres after search.
    field brand type string {
      indexing: attribute | summary
    }
    field image_url type string {
      indexing: summary
    }
    field original_price type long {
      indexing: attribute | summary
    }
    field rating_avg type float {
      indexing: attribute | summary
    }
    field rating_count type int {
      indexing: attribute | summary
    }
    field sold_count type int {
      indexing: attribute | summary
    }
    field image_gradient type string {
      indexing: summary
    }
    field icon_hint type string {
      indexing: summary
    }
    field status type string {
      indexing: attribute
    }
    
    # === Embeddings (CLIP ViT-B/32 512 dim per ADR-036) ===
    # C8 resolution: ADR-036 overrides 02_DATA_MODEL.md 768. 
    # Embeddings Vespa-only per C12 Option B.
    field text_embedding type tensor<float>(x[512]) {
      indexing: attribute | index
      attribute {
        distance-metric: angular
      }
      index {
        hnsw {
          max-links-per-node: 16
          neighbors-to-explore-at-insert: 200
        }
      }
    }
    field image_embedding type tensor<float>(x[512]) {
      indexing: attribute | index
      attribute {
        distance-metric: angular
      }
      index {
        hnsw {
          max-links-per-node: 16
          neighbors-to-explore-at-insert: 200
        }
      }
    }
    
    # === Trend + temporal ===
    field trend_score type float {
      indexing: attribute | summary
    }
    field created_at type long {
      indexing: attribute
    }
    
    # === Behavioral signals (per 07_BEHAVIOR_LOGS Section 6.1) ===
    # Updated by aggregator worker every 5min (Phase 05); partial-update 
    # on purchase real-time (Phase 04).
    field impressions_7d type long {
      indexing: attribute | summary
    }
    field clicks_7d type long {
      indexing: attribute | summary
    }
    field add_to_cart_7d type long {
      indexing: attribute | summary
    }
    field purchases_7d type long {
      indexing: attribute | summary
    }
    field dismissals_7d type long {
      indexing: attribute | summary
    }
    field impressions_30d type long {
      indexing: attribute | summary
    }
    field clicks_30d type long {
      indexing: attribute | summary
    }
    field purchases_30d type long {
      indexing: attribute | summary
    }
    field ctr_7d type float {
      indexing: attribute
    }
    field cvr_7d type float {
      indexing: attribute
    }
    field velocity_score type float {
      indexing: attribute
    }
  }
  
  # === Rank profiles ===
  
  rank-profile hybrid {
    inputs {
      query(text_query) tensor<float>(x[512])
    }
    first-phase {
      expression: bm25(title) + bm25(description)
    }
    second-phase {
      expression: 0.5 * firstPhase + 0.3 * closeness(field, text_embedding) + 0.2 * attribute(trend_score)
    }
  }
  
  rank-profile image_similarity {
    inputs {
      query(img_query) tensor<float>(x[512])
    }
    first-phase {
      expression: closeness(field, image_embedding)
    }
  }
}
```

### services.xml structure (single-container dev):

```xml
<?xml version="1.0" encoding="utf-8" ?>
<services version="1.0">
  <container id="default" version="1.0">
    <document-api/>
    <search/>
    <nodes>
      <node hostalias="node0"/>
    </nodes>
  </container>
  <content id="products" version="1.0">
    <redundancy>1</redundancy>
    <documents>
      <document type="product" mode="index"/>
    </documents>
    <nodes>
      <node hostalias="node0" distribution-key="0"/>
    </nodes>
  </content>
  <admin version="2.0">
    <adminserver hostalias="node0"/>
  </admin>
</services>
```

Note: `hosts.xml` minimal cũng cần — single node với hostalias `node0`. 
Vespa CLI sẽ auto-generate nếu absent, hoặc T06 emit thêm `hosts.xml`. 
Surface trong report.

### deploy.sh structure:

```bash
#!/usr/bin/env bash
# deploy.sh — Vespa application package deploy script.
# 
# Builds zip of infra/vespa/ contents, POSTs to Vespa config server at 
# :19071 (per VESPA_CONFIG_SERVER env, default http://vespa:19071).
# Idempotent — Vespa handles versioning.
# 
# Usage: VESPA_CONFIG_SERVER=http://localhost:19071 ./deploy.sh

set -euo pipefail

VESPA_DIR="$(dirname "$0")"
VESPA_CONFIG_SERVER="${VESPA_CONFIG_SERVER:-http://vespa:19071}"
APP_ZIP="/tmp/icp-vespa-app.zip"

echo "Building Vespa app package..."
cd "$VESPA_DIR"
rm -f "$APP_ZIP"
zip -r "$APP_ZIP" schemas/ services.xml ${HOSTS_XML:+hosts.xml} 2>&1 | tail -5

echo "Waiting for Vespa config server..."
for i in $(seq 1 60); do
  if curl -sf "$VESPA_CONFIG_SERVER/state/v1/health" >/dev/null 2>&1; then
    echo "Vespa config server ready."
    break
  fi
  sleep 2
done

echo "Deploying to $VESPA_CONFIG_SERVER..."
curl -X POST -H "Content-Type: application/zip" \
  --data-binary "@$APP_ZIP" \
  "$VESPA_CONFIG_SERVER/application/v2/tenant/default/prepareandactivate" \
  | tee /tmp/vespa-deploy-response.json

if grep -q '"session-id"' /tmp/vespa-deploy-response.json; then
  echo "Deploy succeeded."
else
  echo "Deploy may have failed. Check response:"
  cat /tmp/vespa-deploy-response.json
  exit 1
fi
```

Make executable.

### Test scenario (mention report):

- `make up` brings up vespa
- `make vespa:deploy` runs deploy.sh → POST app package → activates
- Verify: `curl http://localhost:8080/ApplicationStatus` returns 200 with 
  application info
- Verify schema: `vespa query 'select * from product where true' --hits 0` 
  returns empty result (no docs yet, expected) but schema valid

### Conflict C8 explicit document T06 report:

Bonus "Conflicts Surfaced":
- Source: `docs/02_DATA_MODEL.md` lines 205, 217, 244, 256 spec 
  `tensor<float>(x[768])`.
- ADR-036 (`docs/DECISIONS.md` line 472) LOCK CLIP 512.
- Resolution per Rule 7: ADR (priority 2) > general spec (priority 5). 
  T06 applied 512.
- Recommend docs maintainer patch `02_DATA_MODEL.md` 768 → 512 batch sau 
  S-00b done (defer per Phiên 3 scope discipline).
```

---

### Section 4.7 — Phiên 10: T07 Observability Stack Configs

**Input bundle (`s00b-T07-context.zip`):**
```
s00b-base/
s00b-outputs/T01/
```

Docs bổ sung trong base đã đủ (`06_OBSERVABILITY.md` toàn bộ Section 2 + 4 + 8 + 9 + 12 + 16).

**Output expected (11 files):**

*Code files (7 files):*
1. `outputs/infra/docker-compose.observability.yml` (5 services: otel-collector, loki, tempo, prometheus, grafana — port `3002:3000` cho Grafana per C11 resolution)
2. `outputs/infra/otel/collector-config.yaml`
3. `outputs/infra/otel/grafana-datasources.yml`
4. `outputs/infra/otel/prometheus.yml`
5. `outputs/infra/otel/tempo.yaml`
6. `outputs/infra/otel/loki-config.yaml`
7. `outputs/infra/otel/grafana-dashboards/.gitkeep` (empty placeholder)

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=10`, `<X>=07`, `<TASK_NAME>=Observability Stack Configs`, rồi append:

```text
## Task-specific notes T07

### ⚠️ C11 conflict resolution (HARD CONSTRAINT):

Grafana port: dùng `3002:3000` per `PHASE_01_INFRA.md` line 13 + 41 + DoD-6.

KHÔNG dùng `3001:3000` (mà `06_OBSERVABILITY.md` Section 2 line 52 + 
Section 17 line 559 sai spec). Lý do:
- PHASE_01 (priority 4) > 06_OBSERVABILITY (priority 5) per Rule 7.
- Port 3001 collide gateway service (PHASE_01 line 28).
- DoD-6 explicit "Grafana :3002".

Document C11 explicit trong T07 report "Bonus — Conflicts Surfaced".

### Pre-flight verification:

- Đọc `s00b-outputs/T01/code/.env.example` — verify `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` 
  align với compose service name + port.
- Đọc `s00b-outputs/T01/code/Makefile` — verify `make up` reference 
  `infra/docker-compose.observability.yml` path đúng (T07 sẽ tạo file 
  này tại đó).

### Files cần emit:

7 code files + 4 workflow files (taskpack/report/review/tasklist).

### docker-compose.observability.yml structure:

```yaml
version: '3.9'

# Note: 'icp' network declared external so app compose (T08) shares it.

services:
  
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0
    container_name: icp-otel-collector
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./otel/collector-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - "4317:4317"     # OTLP gRPC
      - "4318:4318"     # OTLP HTTP
      - "8888:8888"     # Self-metrics for Prometheus scrape
    networks: [icp]
    depends_on:
      - loki
      - tempo
      - prometheus
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:13133/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
  
  loki:
    image: grafana/loki:2.9.4
    container_name: icp-loki
    command: ["-config.file=/etc/loki/config.yml"]
    volumes:
      - ./otel/loki-config.yaml:/etc/loki/config.yml:ro
      - loki_data:/loki
    ports: ["3100:3100"]
    networks: [icp]
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:3100/ready || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
  
  tempo:
    image: grafana/tempo:2.4.1
    container_name: icp-tempo
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./otel/tempo.yaml:/etc/tempo.yaml:ro
      - tempo_data:/var/tempo
    ports: 
      - "3200:3200"     # HTTP query API
      - "9095:9095"     # gRPC
      - "4327:4317"     # Internal OTLP receiver (mapped to host 4327 to avoid clash with collector 4317)
    networks: [icp]
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:3200/ready || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
  
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: icp-prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--web.enable-remote-write-receiver"
    volumes:
      - ./otel/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports: ["9090:9090"]
    networks: [icp]
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:9090/-/ready || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
  
  grafana:
    image: grafana/grafana:10.4.0
    container_name: icp-grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
      GF_USERS_DEFAULT_THEME: light
    volumes:
      - ./otel/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
      - ./otel/grafana-dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports: ["3002:3000"]   # C11: 3002 NOT 3001 per PHASE_01 + DoD-6
    networks: [icp]
    depends_on:
      - loki
      - tempo
      - prometheus
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

networks:
  icp:
    external: true
    name: icp

volumes:
  loki_data:
  tempo_data:
  prometheus_data:
  grafana_data:
```

Note: `icp` network declared `external: true`. Cần `docker network create icp` 
chạy ngoài compose (Makefile T01 hoặc một-time setup). Document trong T07 
report Known Issues hoặc add to T08 README.

### collector-config.yaml structure (per 06_OBSERVABILITY Section 2-3-4):

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 8192
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

exporters:
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
    default_labels_enabled:
      exporter: false
      job: true
  
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
    tls:
      insecure: true

extensions:
  health_check:
    endpoint: 0.0.0.0:13133

service:
  extensions: [health_check]
  pipelines:
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [loki]
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
  telemetry:
    logs:
      level: info
    metrics:
      address: 0.0.0.0:8888
```

### grafana-datasources.yml:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
    
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: false
    editable: true
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        tags: ['service']
      lokiSearch:
        datasourceUid: loki
    
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

### prometheus.yml:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Self-monitor
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  # OTel collector self-metrics
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8888']
  
  # Future: service /metrics endpoints (S-02 add)
  # - job_name: 'gateway'
  #   metrics_path: /metrics
  #   static_configs:
  #     - targets: ['gateway:3001']
```

### tempo.yaml (minimal single-binary):

```yaml
server:
  http_listen_port: 3200
  grpc_listen_port: 9095

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

ingester:
  trace_idle_period: 10s
  max_block_duration: 5m

compactor:
  compaction:
    block_retention: 24h   # 1 day retention for hackathon

storage:
  trace:
    backend: local
    wal:
      path: /var/tempo/wal
    local:
      path: /var/tempo/blocks
```

### loki-config.yaml (minimal single-binary):

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  allow_structured_metadata: true
```

### grafana-dashboards/.gitkeep:

Empty file (just to track empty dir in git). Phase 06 will fill với RED 
dashboards.

### Test scenario (mention report):

- `docker network create icp` (one-time)
- `make obs:up` brings up 5 services
- `curl http://localhost:3002/api/health` returns Grafana health
- `curl http://localhost:3002/api/datasources` returns 3 datasources 
  auto-provisioned
- `curl http://localhost:9090/-/ready` returns Prometheus ready
- `curl http://localhost:3100/ready` returns Loki ready
- `curl http://localhost:3200/ready` returns Tempo ready
- DoD-6 PASS

### Conflict C11 explicit document T07 report:

Bonus "Conflicts Surfaced":
- Source: `06_OBSERVABILITY.md` line 52 `ports: ["3001:3000"]`, line 559 
  `open http://localhost:3001`.
- vs `PHASE_01_INFRA.md` line 13, 41 spec port 3002 + DoD-6 "Grafana :3002".
- Resolution per Rule 7: PHASE_01 (priority 4) > 06_OBSERVABILITY (priority 5).
- Plus: 3001 collides với gateway service port (PHASE_01 line 28).
- T07 applied 3002. Docs maintainer patch 06_OBSERVABILITY lines 52, 559 
  → 3002 batch sau S-00b done.
```

---

### Section 4.8 — Phiên 11: T08 App Compose + Web Placeholder + CI

**Input bundle (`s00b-T08-context.zip`):**
```
s00b-base/
s00b-outputs/T01/                   ← Makefile, .env.example
s00b-outputs/T02/                   ← packages/shared-types reference
s00b-outputs/T03/                   ← Dockerfiles cho gateway/ai/mcp
s00b-outputs/T04/                   ← V001 schema cho healthcheck depends_on
s00b-outputs/T05/                   ← seed cần postgres alive
s00b-outputs/T06/                   ← deploy.sh cho vespa orchestration
s00b-outputs/T07/                   ← obs compose để stitch network
```

Docs bổ sung cần explicit (cộng dồn vào base):
- `docs/04_INTENT_SPECS.md` — **FIX #8 applied** (8 intents target cho PhoneFrame design intent)

Docs trong base đã có: `phases/PHASE_00_DESIGN_SYSTEM.md` (Section 1 MoMo color tokens) + `phases/PHASE_01_INFRA.md` (Day 6 web spec C2/C3 patched + Day 2 compose) + `DECISIONS.md` (ADR-033/034/035) + `06_OBSERVABILITY.md` (env vars cho web — **FIX #9 applied**).

**Output expected (15+ files):**

*Code files (11+ files):*
1. `outputs/infra/docker-compose.yml` (app stack: postgres, redis, redpanda, vespa, gateway, ai, mcp, web)
2. `outputs/apps/web/package.json` (Next.js 14.2 + full ADR-033/034/035 stack)
3. `outputs/apps/web/next.config.js`
4. `outputs/apps/web/tsconfig.json`
5. `outputs/apps/web/tailwind.config.ts`
6. `outputs/apps/web/postcss.config.js`
7. `outputs/apps/web/components.json` (shadcn config)
8. `outputs/apps/web/app/layout.tsx`
9. `outputs/apps/web/app/page.tsx`
10. `outputs/apps/web/app/globals.css` (MoMo tokens)
11. `outputs/apps/web/components/icp/PhoneFrame.tsx`
12. `outputs/apps/web/Dockerfile` (OVERWRITES T03 stub)
13. `outputs/apps/web/src/mocks/handlers.ts` (MSW stub empty)
14. `outputs/.github/workflows/ci.yml`

*Workflow files (4):* taskpack/report/review/tasklist

**Prompt template:**

Common preamble với `<N>=11`, `<X>=08`, `<TASK_NAME>=App Compose + Web Placeholder + CI`, rồi append:

```text
## Task-specific notes T08 — LARGEST TASK

### Pre-flight verification (BẮT BUỘC):

1. Đọc `s00b-outputs/T03/code/apps/web/Dockerfile` — verify đây là stub 
   (Node alpine + http stub). T08 sẽ OVERWRITE hoàn toàn với Next.js 
   multi-stage build.

2. Đọc `s00b-outputs/T07/code/docker-compose.observability.yml` — verify 
   network `icp` declared external. T08 app compose phải share same 
   external network.

3. Đọc `s00b-outputs/T01/code/.env.example` — verify env vars NEXT_PUBLIC_*  
   được declare.

### ⚠️ Constraints áp dụng:

- D-02 healthcheck intervals cho tất cả services trong compose
- D-03 version pins: Next.js 14.2.x, Tailwind 3.4.x, shadcn (NOT shadcn-ui)
- C10: dùng `shadcn` mới (KHÔNG `shadcn-ui` legacy per PHASE_01 line 184 — 
  surface trong T08 report)
- C11: Grafana port reference 3002 (already in T07 compose, T08 KHÔNG touch)

### Compose dependencies chain (per PHASE_01 lines 22-32):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: icp
      POSTGRES_PASSWORD: icp_dev_password
      POSTGRES_DB: icp
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports: ["5432:5432"]
    networks: [icp]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U icp"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
  
  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
    ports: ["6379:6379"]
    networks: [icp]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
  
  redpanda:
    image: redpandadata/redpanda:v23.3.10
    command:
      - redpanda
      - start
      - --smp 1
      - --memory 1G
      - --reserve-memory 0M
      - --overprovisioned
      - --node-id 0
      - --check=false
      - --kafka-addr=PLAINTEXT://0.0.0.0:9092
      - --advertise-kafka-addr=PLAINTEXT://redpanda:9092
    ports:
      - "9092:9092"
      - "9644:9644"
    networks: [icp]
    healthcheck:
      test: ["CMD", "rpk", "cluster", "health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
  
  vespa:
    image: vespaengine/vespa:8.350.0
    ports:
      - "8080:8080"      # Query + document API
      - "19071:19071"    # Config server
    volumes: [vespa_data:/opt/vespa/var]
    networks: [icp]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:19071/state/v1/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 60s   # Vespa slow boot
  
  gateway:
    build:
      context: ../apps/gateway
      dockerfile: Dockerfile
    image: icp/gateway:dev
    env_file: ../.env
    environment:
      OTEL_SERVICE_NAME: gateway
    ports: ["3001:3001"]
    networks: [icp]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
      redpanda: { condition: service_healthy }
      otel-collector: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:3001/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
  
  ai:
    build:
      context: ../apps/ai
      dockerfile: Dockerfile
    image: icp/ai:dev
    env_file: ../.env
    environment:
      OTEL_SERVICE_NAME: ai
    ports: ["5001:5001"]
    networks: [icp]
    depends_on:
      redpanda: { condition: service_healthy }
      mcp: { condition: service_started }   # MCP stub không có /health/ready complex
      otel-collector: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:5001/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
  
  mcp:
    build:
      context: ../apps/mcp
      dockerfile: Dockerfile
    image: icp/mcp:dev
    env_file: ../.env
    environment:
      OTEL_SERVICE_NAME: mcp
    ports: ["5050:5050"]
    networks: [icp]
    depends_on:
      postgres: { condition: service_healthy }
      vespa: { condition: service_healthy }
      otel-collector: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:5050/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
  
  web:
    build:
      context: ../apps/web
      dockerfile: Dockerfile
    image: icp/web:dev
    env_file: ../.env
    environment:
      OTEL_SERVICE_NAME: web
    ports: ["3000:3000"]
    networks: [icp]
    depends_on:
      gateway: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

networks:
  icp:
    external: true
    name: icp

volumes:
  pg_data:
  vespa_data:
  redis_data:
```

### apps/web/package.json (full ADR-033/034/035 stack):

```json
{
  "name": "@icp/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^11.11.0",
    "canvas-confetti": "^1.9.3",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.59.0",
    "react-hook-form": "^7.53.0",
    "@icp/shared-types": "workspace:*",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.453.0"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/canvas-confetti": "^1.6.4",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.18",
    "msw": "^2.4.0"
  }
}
```

### apps/web/tailwind.config.ts:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // MoMo Premium tokens — full set sẽ trong globals.css CSS vars
        // Tailwind reference via var(--token-name)
        'icp-pink': {
          50: 'var(--pink-50)',
          100: 'var(--pink-100)',
          // ... maps to globals.css vars per PHASE_00_DESIGN_SYSTEM Section 1
          600: 'var(--pink-600)',
        },
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

### apps/web/app/globals.css (Section 1 MoMo color tokens):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* === Surface (per PHASE_00_DESIGN_SYSTEM Section 1.1) === */
  --bg-page-from: #FCE7F0;
  --bg-page-mid:  #FEEEE0;
  --bg-page-to:   #FFF8F0;
  --bg-page: linear-gradient(180deg, var(--bg-page-from) 0%, var(--bg-page-mid) 40%, var(--bg-page-to) 100%);
  --bg-page-frame: #FDF2F4;
  --bg-surface: #FFFFFF;
  --bg-tinted: #FEF3F8;
  
  --border-subtle:  #F9D8E4;
  --border-pink:    #FBCFE8;
  --border-orange:  #FED7AA;
  --border-divider: #FCE7F3;
  
  /* === Text (Section 1.2 — KHÔNG dùng đen) === */
  --text-primary:   #831447;
  --text-secondary: #9F1239;
  --text-tertiary:  #BE185D;
  --text-muted:     #7C7591;
  --text-on-color:  #FFFFFF;
  --text-on-light:  #1F1147;
  
  /* === Pink Ramp (Section 1.3 — PRIMARY 70%) === */
  --pink-50:  #FFF1F5;
  --pink-100: #FCE7F3;
  --pink-200: #FBCFE8;
  --pink-300: #F9A8D4;
  --pink-400: #F472B6;
  --pink-500: #EC4899;
  --pink-600: #E91E63;  /* MOMO SIGNATURE */
  --pink-700: #BE185D;
  --pink-800: #831447;
  --pink-900: #500724;
  
  /* === Rose / Orange / Amber / etc Ramps === */
  /* (Copy phần còn lại từ PHASE_00_DESIGN_SYSTEM.md Section 1.4-1.6) */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

body {
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-be-vietnam, system-ui), sans-serif;
}
```

### apps/web/components/icp/PhoneFrame.tsx:

```tsx
/**
 * PhoneFrame — Mobile-first wrapper, viewport 390px iPhone 13 target.
 * Per ADR-022 (phone frame wrapper for desktop) + 00_CONTEXT.md Section 3.9.
 * 
 * Desktop: centered 390px frame với surrounding background.
 * Mobile (< 480px): full-width, no frame visual.
 * 
 * **Status:** Minimal scaffold (S-00b T08). Full styling + animations 
 * defer S-01 H-UI component library.
 */
'use client';

import { ReactNode } from 'react';

export interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page-frame)' }}>
      <div className="w-full max-w-[390px] min-h-[640px] bg-white shadow-xl rounded-3xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        {children}
      </div>
    </div>
  );
}
```

### apps/web/app/page.tsx:

```tsx
import { PhoneFrame } from '@/components/icp/PhoneFrame';

export default function HomePage() {
  return (
    <PhoneFrame>
      <main className="p-8 flex items-center justify-center min-h-[640px]">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ICP loaded
        </h1>
      </main>
    </PhoneFrame>
  );
}
```

### apps/web/app/layout.tsx (minimal — S-02 sẽ wrap TanStack QueryProvider):

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICP — Intelligent Commerce Platform',
  description: 'AI-powered shop assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
```

### apps/web/Dockerfile (OVERWRITES T03 stub):

```dockerfile
# Multi-stage Next.js production build per Next.js standalone output mode.

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN pnpm --filter @icp/shared-types build
RUN pnpm --filter @icp/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q -O- http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
```

Note: Next.js standalone output requires `output: 'standalone'` trong 
`next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};
module.exports = nextConfig;
```

### apps/web/components.json (shadcn config — KHÔNG run CLI thật):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

T08 KHÔNG copy ANY shadcn component (Button, Dialog, etc) — defer S-01 H-UI 
sẽ run `npx shadcn@latest add <component>` để generate vào `components/ui/`.

### apps/web/src/mocks/handlers.ts (MSW stub):

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // MSW handlers populated by S-02 P-CAP (per docs/08_FE_BE_CONTRACT.md Section 8.2).
  // S-00b T08: empty array stub.
];
```

### .github/workflows/ci.yml:

```yaml
name: CI

on:
  push:
    branches: [main, 'feat/**', 'fix/**']
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint || echo "No lint script yet (S-00b foundation — populated in S-02)"
  
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test || echo "No tests yet (S-00b foundation — test rỗng cũng OK per DoD-4)"
  
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck || echo "Typecheck not configured yet"
```

### KHÔNG implement trong T08 (defer S-01/S-02):

- TanStack QueryProvider full wiring trong layout.tsx (chỉ skeleton — S-02)
- Zustand stores per ADR-035 → S-02
- `lib/api-client.ts` (depends shared-types codegen) → S-02
- `lib/sse-client.ts` → S-02
- `lib/tracker.ts` (behavior events) → S-02
- MSW handlers content → S-02
- Shadcn components (Button, Dialog, etc) → S-01 H-UI
- 5 component directories ngoài icp/PhoneFrame.tsx → S-01 H-UI
- AuthContext provider → S-02
- Toaster (notifications) → S-01 H-UI
- next.config.js production tuning beyond standalone → defer

### Test scenario (mention report):

- `docker network create icp` (one-time setup, document in README)
- `make obs:up` brings up obs stack (T07 reference)
- `make up` brings up app stack (merging app compose + obs compose 13 services)
- Verify all 13 services healthy via `docker compose ps`
- `make migrate && make seed` apply V001-V008 + seed users/products/policies
- `make vespa:deploy` deploys product.sd schema
- `curl http://localhost:3000` returns HTML containing "ICP loaded"
- `curl http://localhost:3000/api/health` returns Next.js health check
- `curl http://localhost:3002/api/datasources` returns 3 datasources
- `git push` triggers CI workflow → lint + test + typecheck jobs green

### DoD verdict expected after T08:

- DoD-1: PASS (`make up` 13 services healthy)
- DoD-2: PASS (migrations + seed + behavior_events table)
- DoD-3: PARTIAL (stubs respond /health, S-02 full impl)
- DoD-4: PASS (CI green với empty test, per DoD-4 literal)
- DoD-5: PASS ("ICP loaded" page)
- DoD-6: PASS (Grafana :3002 + 3 datasources)
- DoD-7: TODO (per-service OTel SDK defer S-02)
- DoD-8: TODO (logger helpers defer S-02)
- DoD-9: PASS (Vespa schema deployed với CLIP 512 + behavioral fields)

→ **6/9 PASS, 1 PARTIAL, 2 TODO** sau S-00b done.

### Conflicts surface trong T08 report:

- C10 (shadcn rename — already mentioned, T08 applied)
- Any new conflict if discovered (compose volume permissions, network 
  issues, etc) → document Bonus section
```

---

### Section 4.9 — Phiên 12: Consolidated S00b-REPORT + Review

**Input bundle (`s00b-consolidate-context.zip`):**
```
s00b-base/
s00b-outputs/                       ← TẤT CẢ T01..T08 (cumulative)
└── T01/
    ├── code/
    ├── taskpacks/
    ├── reports/
    └── reviews/
... (T02..T08 tương tự)
```

Docs trong base đủ. Bổ sung:
- `s00b-base/s00-outputs/` toàn bộ (Phiên 2 outputs — gap list reference + consolidated format reference) — **FIX #6 applied**

**Output expected (2 files):**

1. `outputs/reports/S00b-REPORT.md` — consolidated executive report
2. `outputs/reviews/S00b_REVIEW.md` — meta review của consolidated report

**Prompt template:**

```text
Tôi mở Phiên 12 ICP, slice S-00b Foundation Scaffold, consolidate phase 
(Phase 4 — Synthesis).

## Output language

Tiếng Việt mix English technical terms (giữ y nguyên style Phiên 1-11).

## Context state

S-00b 8 tasks T01-T08 đã DONE qua Phiên 4-11. Phiên 12 này synthesize.

## Bundle context

`s00b-consolidate-context.zip` đính kèm, bao gồm:
- `s00b-base/` (docs, decisions-log, brief, tasklist final, MASTER_*, 
  s00-outputs Phiên 2 reference)
- `s00b-outputs/T01..T08/` — TẤT CẢ outputs 8 task (code + taskpack + 
  report + review)

## Read order

1. `slices/S-00b_EXECUTION_GUIDE.md` Section 1 (decisions + conflicts 
   locked) + Section 4.9 (this consolidate task)
2. `slices/S-00b_BRIEF.md` (Done Means criteria)
3. `slices/S-00b_TASKLIST.md` (verify all 8 tasks DONE)
4. `decisions-log.md` (final amendments)
5. `s00b-outputs/T0X/reports/S00b-T0X_REPORT.md` (X=1..8) — đọc tất cả 8 reports
6. `s00b-outputs/T0X/reviews/S00b-T0X_REVIEW.md` — verify all PASS hoặc 
   FIX-then-RESOLVED
7. `s00-outputs/reports/S00-REPORT.md` (Phiên 2 gap list — for closure 
   tracking) + `s00-outputs/reports/S00-REPORT.md` style/format reference

## Workflow

Phase 4 Final Synthesis per workflow doc:

**Bước 1:** Tạo `reports/S00b-REPORT.md` per format S00-REPORT.md (Phiên 2 
reference). Sections:

- Executive Summary (slice goal vs actual, DoD verdict 6/1/2 split, 
  effort actual vs estimate)
- Per-DoD Findings (9 items với status MET/PARTIAL/TODO + evidence từ 
  per-task reports + slice owner if not MET)
- Gap Closure List (G-01 → G-29 từ S00-REPORT.md status: CLOSED / 
  DEFERRED-TO-S-02 / DEFERRED-TO-PHASE-06)
- Conflicts Surfaced Final (C8/C9/C10/C11/C12 + any new từ T01-T08 reports)
- Decisions Audit (5 pre-approved D-01 đến D-05 + C12 resolution applied 
  correctly across tasks? Cite per-task report sections.)
- Task Pack Synthesis (T01-T08 — 1 paragraph each: scope, deliverables, 
  review verdict, any deviations)
- Recommended Next Slice (S-01 H-UI vs S-02 P-CAP — parallel feasibility, 
  dependency, AI propose)
- Reference Trail (8 task packs + 8 reports + 8 reviews + code outputs paths)
- Action Items For Human (docs maintainer batch — C8/C9/C10/C11 patches)

**Bước 2:** Tạo `reviews/S00b_REVIEW.md` meta review:

- Review consolidated report quality (clarity, completeness, evidence 
  citation)
- Verify alignment với Brief Done Means
- 9 Gates verdict cho consolidated report itself
- Recommend revisions if any

**Bước 3:** `present_files` với S00b-REPORT.md đầu tiên (most relevant 
cho human review).

## Output deliverables

- `outputs/reports/S00b-REPORT.md`
- `outputs/reviews/S00b_REVIEW.md`
- (Không update tasklist trong Phiên 12 — đã done qua per-task phiên)

Bắt đầu Bước 1.
```

---

## Section 5 — Output convention summary (quick reference)

Mỗi phiên emit theo cấu trúc folder consistent:

```
outputs/
├── taskpacks/
│   └── S00b-T0X_<NAME>.md
├── reports/
│   └── S00b-T0X_REPORT.md
├── reviews/
│   └── S00b-T0X_REVIEW.md
├── slices/
│   └── S-00b_TASKLIST.md           ← updated each session
└── <mirror repo structure>
    ├── package.json                 ← T01
    ├── pnpm-workspace.yaml          ← T01
    ├── packages/shared-types/       ← T02
    ├── apps/                        ← T03 stubs, T08 web full
    ├── infra/
    │   ├── migrations/              ← T04
    │   ├── seed/                    ← T05
    │   ├── vespa/                   ← T06
    │   ├── otel/                    ← T07
    │   ├── docker-compose.yml       ← T08
    │   └── docker-compose.observability.yml  ← T07
    └── .github/workflows/           ← T08
```

---

## Section 6 — 15 fixes applied (audit trail)

| # | Fix | Section áp dụng |
|---|---|---|
| 1 | T03 input thêm `06_OBSERVABILITY.md` (cho /health format) | Section 4.3 |
| 2 | C11 documented (Grafana 3001 vs 3002) | Section 1.3, 4.7 |
| 3 | T02 verify `pnpm-workspace.yaml` pattern trước implement | Section 4.2 |
| 4 | C12 RESOLVED Option B (Vespa-only, V001 không có VECTOR) | Section 1.2 |
| 5 | NOT applied (C12=B nên không cần pgvector image) | N/A |
| 6 | Phiên 12 input thêm `s00-outputs/` folder | Section 4.9 |
| 7 | `MASTER_SLICE_BACKLOG.md` thêm vào base mọi phiên | Section 2.3 |
| 8 | T08 input thêm `04_INTENT_SPECS.md` | Section 4.8 |
| 9 | T08 input thêm `06_OBSERVABILITY.md` | Section 4.8 (đã trong base) |
| 10 | `decisions-log.md` emit ngay trong Phiên 3 | Section 9 below |
| 11 | `ICP_WORKFLOW_FINAL.md` thêm vào base mọi phiên | Section 2.3 |
| 12 | "Phiên 3 LOCKED" marker trong decisions-log | Section 9 below |
| 13 | `MASTER_ROADMAP.md` thêm vào base mọi phiên | Section 2.3 |
| 14 | (optimization, optional) skip `infra/migrations/` SQL files trong phiên T01/T02/T03/T06/T07/T08 | Per-section listed |
| 15 | T01 emit files theo 3 groups | Section 4.1 |

---

## Section 7 — Risk reminders cross-task

### R-A: Context drift across sessions
Mitigation: Mọi phiên load `decisions-log.md` đầu tiên + `S-00b_BRIEF.md`. Output prior tasks là source of truth — KHÔNG re-derive.

### R-B: Tasklist status sync
Mitigation: Mỗi phiên emit `S-00b_TASKLIST.md` updated. Human replace file cũ trước khi mở phiên sau.

### R-C: Conflict accumulation
Mitigation: Mỗi report có "Bonus — Conflicts Surfaced" section. Phiên 12 consolidate aggregates tất cả.

### R-D (mới): Rule 5 STOP mid-task
Nếu phiên T04 hoặc T06 phát hiện ambiguity ngoài 5 decisions + 5 conflicts → AI STOP. Bạn có 2 lựa chọn:
- Extend same conversation (đỡ tốn bundle reload time)
- Close + reopen với amendment thêm vào decisions-log

### R-E (mới): Container budget mid-task
Nếu phiên T08 (largest task) gần đầy context: AI sẽ emit incremental files + report partial; bạn close + reopen với "T08 continuation" prompt + bundle gồm partial outputs.

---

## Section 8 — Action checklist cho bạn

Trước khi mở Phiên 4:
- [ ] Download `S-00b_BRIEF.md`, `S-00b_TASKLIST.md` từ Phiên 3 response đầu
- [ ] Download `S-00b_EXECUTION_GUIDE.md` (file này)
- [ ] Apply 2 amendments vào `S-00b_BRIEF.md` (Section 2.2)
- [ ] Tạo `decisions-log.md` từ Section 9 của file này (copy-paste)
- [ ] Tạo folder structure `s00b-base/` theo Section 2.3
- [ ] Copy files docs/ + ai-delivery/ + MASTER_* + s00-outputs/ từ bundle Phiên 3 vào s00b-base/
- [ ] Tạo folder `s00b-outputs/` empty (sẽ fill sau mỗi phiên)
- [ ] Zip `s00b-base/` + thư mục bổ sung theo Section 4.1 → upload vào Phiên 4
- [ ] Paste prompt T01 (common preamble Section 3 + task-specific Section 4.1)

Sau mỗi phiên T0X xong:
- [ ] Download tất cả outputs (workflow files + code files)
- [ ] Save vào `s00b-outputs/T0X/`
- [ ] Replace `s00b-base/slices/S-00b_TASKLIST.md` với version updated
- [ ] Replace `s00b-base/decisions-log.md` nếu phiên emit version mới
- [ ] Zip bundle cho phiên tiếp theo theo Section 4.<X+1>

---

## Section 9 — `decisions-log.md` initial content

Copy phần dưới sang file `decisions-log.md` standalone trong `s00b-base/`:

```markdown
# S-00b Decisions Log

> **Mục đích:** Track tất cả decisions locked + conflicts surfaced cho slice 
> S-00b. Cumulative cross-session — mỗi phiên đọc đầu + append amendments cuối.
>
> **Status:** ACTIVE
> **Created:** 2026-05-18 Phiên 3
> **Last updated:** 2026-05-18 Phiên 3 (initial)

---

## Phiên 3 LOCKED 2026-05-18

S-00b BRIEF + TASKLIST + 5 decisions + 5 conflicts surfaced. Ready cho 
Phiên 4 T01 kickoff.

---

## Pre-approved decisions (locked trước T01 starts)

### D-01 — Password hash

- **Algorithm:** bcrypt cost 10
- **Library:** `bcryptjs` (pure JS, no native binding — easier CI)
- **Áp dụng:** T05 (seed.ts)
- **Override risk:** Low. S-02 auth service có thể migrate sang argon2id 
  via re-hash on next login.

### D-02 — Docker healthcheck intervals

- **Stateless services** (gateway/ai/mcp/web/otel-collector):
  `interval=30s timeout=5s retries=3 start_period=10s`
- **Stateful services** (postgres/vespa/loki/tempo/prometheus/grafana):
  `start_period=30s` (slower boot), rest same.
- **Áp dụng:** T03, T07, T08
- **Override risk:** Low. Tweakable in compose without code change.

### D-03 — Version pins

- **Next.js:** 14.2.x (latest 14 LTS, stay before 15 + React 19 breaking 
  changes)
- **Tailwind:** 3.4.x (current stable)
- **shadcn:** `shadcn` package (NOT legacy `shadcn-ui` deprecated 2024)
- **Pnpm:** 9.x (latest stable)
- **Node:** 20-alpine (LTS)
- **Python:** 3.11-slim
- **Áp dụng:** T01, T02, T03, T08

### D-04 — Migration runner

- **Method:** Bash `infra/migrations/apply.sh` (per `02_DATA_MODEL.md` 
  lines 415-417 guidance)
- **NOT:** Flyway image (overkill cho hackathon)
- **Idempotent:** Records to `schema_migrations` table; re-run skips applied
- **Áp dụng:** T01 Makefile reference, T04 implement
- **Override risk:** Low. Spec explicitly endorses bash.

### D-05 — TypeScript module system

- **tsconfig.base.json:**
  - `"module": "esnext"`
  - `"moduleResolution": "bundler"`
  - `"target": "es2022"`
  - `"strict": true`
  - `"skipLibCheck": true`
- **Gateway override** (`apps/gateway/tsconfig.json` extends base):
  - `"module": "commonjs"`
  - `"moduleResolution": "node"`
  (NestJS 10 requires CommonJS)
- **Shared-types + web + workers + seed:** inherit base esnext
- **Áp dụng:** T01, T02, T03 (gateway), T05 (seed), T08 (web)

---

## Critical decision (RESOLVED mid-Phiên 3 by human)

### C12 — V001 embedding columns

- **Status:** RESOLVED Option B 2026-05-18 Phiên 3
- **Decision:** **V001 KHÔNG có VECTOR columns. Embeddings stored Vespa-only.**
- **Rationale:** Human chốt thống nhất 1 nơi duy nhất — Vespa search index. 
  Postgres products giữ source-of-truth domain data, KHÔNG duplicate 
  embedding.
- **Áp dụng:**
  - T04 V001: mirror EXACTLY `02_DATA_MODEL.md` Section 1 lines 1-165. 
    Không thêm `text_embedding VECTOR(512)` / `image_embedding VECTOR(512)` 
    columns. Không cần `CREATE EXTENSION vector;`. Giữ Postgres image 
    `postgres:16-alpine`.
  - T06 Vespa: là nơi duy nhất có embedding fields, dim 512 per ADR-036 
    (C8 resolution).
- **Conflict source:** User prompt Phiên 3 (mở slice) ghi "G-12 V001 với 
  text_embedding VECTOR(512) + image_embedding VECTOR(512)". Human override 
  sang Option B sau khi AI surface C12 cause inconsistency vs 02_DATA_MODEL 
  + multi-storage problem.
- **Reject pattern:** Bất kỳ reference nào nói "V001 with VECTOR columns" 
  trong context tasks T04-T08 → REJECT theo C12 LOCKED. Surface inconsistency 
  trong report.

---

## Surfaced conflicts (sẽ document trong S00b-REPORT, KHÔNG silent fix docs/)

### C8 — Vespa embedding dim 768 vs ADR-036 512

- **Source A (winning):** ADR-036 (DECISIONS.md line 472) — CLIP 512 LOCKED 
  (priority 2).
- **Source B (losing):** `02_DATA_MODEL.md` Section 2 lines 205, 217, 244, 
  256 — spec `tensor<float>(x[768])` (priority 5).
- **Resolution:** Rule 7 ADR > general spec. T06 dùng 512.
- **Defer:** Docs maintainer patch `02_DATA_MODEL.md` 768 → 512 sau S-00b 
  done.
- **Surfaced where:** T06 report Bonus, S00b-REPORT consolidated.

### C9 — MASTER_SLICE_BACKLOG.md chưa list S-00b

- **Source:** `MASTER_SLICE_BACKLOG.md` (committed pre-Phiên 2 audit). Chỉ 
  list S-00 → S-11, không có S-00b entry. S-01/S-02 dep edges ghi "Depends 
  on S-00".
- **Reality:** Phiên 2 audit recommend Option B → S-00b inserted between 
  S-00 và S-01/S-02 (LOCKED Phiên 3).
- **Resolution:** Backlog generated pre-audit, expected stale.
- **Defer:** Docs maintainer add S-00b row + update S-01/S-02 deps "S-00b 
  foundation scaffold" sau S-00b done.
- **Surfaced where:** S00b-REPORT consolidated.

### C10 — PHASE_01 line 184 shadcn-ui legacy package name

- **Source:** `PHASE_01_INFRA.md` line 184: `npx shadcn-ui@latest init`
- **Reality:** Package renamed `shadcn-ui` → `shadcn` (late 2024). Legacy 
  package deprecated, emit warning.
- **Resolution:** Per D-03, T08 dùng `shadcn` mới.
- **Defer:** Docs maintainer patch PHASE_01 line 184 (1-line edit) sau S-00b.
- **Surfaced where:** T08 report Bonus, S00b-REPORT consolidated.

### C11 — Grafana port 3001 vs 3002

- **Source A (winning):** `PHASE_01_INFRA.md` line 13 + 41 + DoD-6 — Grafana 
  port `3002` (priority 4).
- **Source B (losing):** `06_OBSERVABILITY.md` line 52 + 559 — Grafana port 
  `3001:3000` (priority 5).
- **Plus:** Port 3001 collides gateway service (PHASE_01 line 28).
- **Resolution:** Rule 7 PHASE_01 > 06_OBSERVABILITY + collision risk. T07 
  dùng `3002:3000`.
- **Defer:** Docs maintainer patch `06_OBSERVABILITY.md` lines 52, 559 → 
  3002 sau S-00b done.
- **Surfaced where:** T07 report Bonus, S00b-REPORT consolidated.

---

## Amendments (append below — đó là nơi phiên T01-T08 sẽ thêm decisions 
phát sinh ack'd bởi human mid-execution)

(empty — no amendments yet)
```

---

**END OF EXECUTION GUIDE.**

**Để tiếp tục:** ack file này + apply 2 amendments cho `S-00b_BRIEF.md` (Section 2.2) → tôi present_files để bạn download `decisions-log.md` standalone + amended `S-00b_BRIEF.md` → bạn zip bundle theo Section 4.1 → mở Phiên 4 với prompt T01.

**File này (`S-00b_EXECUTION_GUIDE.md`) là single source of truth cho slice S-00b. Lưu cẩn thận, lặp lại trong mọi bundle phiên 4-12.**
