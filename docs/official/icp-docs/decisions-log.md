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
