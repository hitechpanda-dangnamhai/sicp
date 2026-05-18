# Implementation Report — S00-T03 Audit Data Layer

> **Task Type:** Q-GATE audit-only
> **Method:** Checklist Mode (PHASE_01_INFRA.md DoD-2 + DoD-9 + Day 2 vs claim greenfield)
> **Date:** 2026-05-18

## 1. Audit Performed

**Files reviewed:**
- `docs/phases/PHASE_01_INFRA.md` (DoD-2, DoD-9 lines 9, 16; lines 99-110 infra/ tree; lines 126-130 Day 2 migration + Vespa + seed; lines 246-259 mock data examples)
- `docs/02_DATA_MODEL.md` (line 416 V001 reference; lines 432-542 V008 + ADR-032)
- `docs/07_BEHAVIOR_LOGS.md` (lines 148-178 `behavior_events` DDL + partition + indexes; lines 197-198 Vespa fields)
- `docs/DECISIONS.md` ADR-032 (line 283)
- `docs/09_FIELD_AUDIT.md` lines 312-315 (V004/V007 skip rationale)
- `infra/migrations/V002__product_enrichment.sql` (committed — verified present)
- `infra/migrations/V003__insights.sql`, `V005__payment_metadata.sql`, `V006__analytics_aggregations.sql`, `V008__shopee_prices_mock.sql` (committed)
- `MASTER_SLICE_BACKLOG.md` lines 38-56
- `reports/S00-T01_REPORT.md`, `S00-T02_REPORT.md` (forward references)
- `ai-delivery/TASK_OPERATING_SYSTEM.md` (Rule 7 hierarchy)

**DoD items checked in this task:**
- DoD-2 — Migrations chạy xong (gồm `behavior_events` table), seed data load đủ
- DoD-9 — Vespa schema gồm cả `text_embedding`, `image_embedding`, behavioral signal fields (`impressions_7d`, `clicks_7d`)

**Repo state:**
- GREENFIELD per prompt for `apps/`, `packages/`, root configs, `infra/seed/`, `infra/vespa/`
- **CONFIRMED PARTIAL FALSE for `infra/migrations/`:** 5 SQL files committed (V002, V003, V005, V006, V008). V001 NOT present.
- No Postgres running → migrations not applied even though SQL files exist.

## 2. Findings

### Finding T03-F1 — V001__init.sql foundational migration MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-2 + Day 2 (line 127) — V001 contains "toàn bộ DDL từ `02_DATA_MODEL.md` + `behavior_events` table từ `07_BEHAVIOR_LOGS.md` section 5" |
| **Current state** | File `infra/migrations/V001__init.sql` does not exist |
| **Expected** | V001 should define base schema: users, products, orders, order_items, payments, behavior_events (with monthly partitions starting `behavior_events_y2026m05` per `07_BEHAVIOR_LOGS.md` line 172-178), idx_be_user_time, idx_be_type_time, idx_be_subject, idx_be_properties |
| **Gap** | Foundational migration absent — but V002+ ALTER TABLE products presupposes V001 created the table. ALTER+ALTER chain breaks without V001. |
| **Effort** | 1 day (V001 SQL is large — covers core DDL from `02_DATA_MODEL.md` + behavior_events from `07_BEHAVIOR_LOGS.md`) |
| **Slice owner** | **S-00b foundation scaffold** (foundational migration cannot be deferred — every other migration assumes V001 ran) |
| **Severity** | **P0 BLOCKER** — DoD-2 fails; behavior_events table required by S-02 tracker + every V-SLICE that emits events |

### Finding T03-F2 — `behavior_events` table presence (DoD-2 explicit)

| Field | Value |
|---|---|
| **DoD/Day** | DoD-2 explicit ("gồm `behavior_events` table") |
| **Current state** | Schema spec'd in `07_BEHAVIOR_LOGS.md` lines 148-178 (DDL + partition `_y2026m05` + 4 indexes), but V001 missing means table cannot exist |
| **Expected** | Table per `07_BEHAVIOR_LOGS.md` line 148-170: partitioned by occurred_at, indexes on user_id+time, event_type+time, subject_type+subject_id, properties GIN |
| **Gap** | Cross-references F1 |
| **Effort** | (within F1) |
| **Slice owner** | S-00b (via V001) |
| **Severity** | **P0 BLOCKER** — DoD-2 explicit + S-02 tracker capability depends |

### Finding T03-F3 — V002__product_enrichment.sql ✅ COMMITTED

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 + general schema evolution |
| **Current state** | File present at `infra/migrations/V002__product_enrichment.sql` |
| **Expected** | ALTER products ADD brand, original_price, rating_avg, rating_count, sold_count, image_gradient, icon_hint; backfill brand from attributes JSONB; index for sorted queries |
| **Gap** | None — file present. **Cannot run** until V001 + Postgres exist (chained dependency). |
| **Effort** | 0 days (already authored) |
| **Slice owner** | S-00b (apply chain when running migrations) |
| **Severity** | **P1 HIGH conditional** — file ready, awaits foundation |

### Finding T03-F4 — V003__insights.sql ✅ COMMITTED

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 |
| **Current state** | File present at `infra/migrations/V003__insights.sql` |
| **Expected** | Per filename, insights/analytics schema additions |
| **Gap** | None — file present |
| **Effort** | 0 days |
| **Slice owner** | S-00b chained apply |
| **Severity** | P1 HIGH conditional |

### Finding T03-F5 — V004 INTENTIONALLY SKIPPED

| Field | Value |
|---|---|
| **DoD/Day** | N/A — explicit skip |
| **Current state** | No V004 file (expected) |
| **Expected** | Per `docs/09_FIELD_AUDIT.md` line 312: "V004 — Promotions cut cho hackathon"; per V008 SQL line 9 inline comment: "V004 (promotions) and V007 (media_uploads) skipped per PHASE_00_HANDOFF.md 'Items deferred'" |
| **Gap** | None — documented intentional skip |
| **Effort** | 0 |
| **Slice owner** | None (cut feature) |
| **Severity** | N/A — informational; document in consolidated report so future devs don't think V004 was forgotten |

### Finding T03-F6 — V005__payment_metadata.sql ✅ COMMITTED

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 |
| **Current state** | File present |
| **Expected** | Per filename + Intent 06 pay flow, payment metadata schema |
| **Gap** | None |
| **Effort** | 0 days |
| **Slice owner** | S-00b chained apply |
| **Severity** | P1 HIGH conditional |

### Finding T03-F7 — V006__analytics_aggregations.sql ✅ COMMITTED

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 |
| **Current state** | File present |
| **Expected** | Per filename, analytics aggregation views/tables (e.g., co-purchase materialized view referenced by `MASTER_ROADMAP.md` line 108) |
| **Gap** | None |
| **Effort** | 0 days |
| **Slice owner** | S-00b chained apply |
| **Severity** | P1 HIGH conditional. **Note:** ROADMAP Stage 2 line 108 says Intent 03 Variant B "co-purchase category-level cần V006 materialized view chưa apply ở Phase 02" → consistent with apply timing being deferred |

### Finding T03-F8 — V007 INTENTIONALLY SKIPPED

| Field | Value |
|---|---|
| **DoD/Day** | N/A — explicit skip |
| **Current state** | No V007 file (expected) |
| **Expected** | Per `09_FIELD_AUDIT.md` line 315: "V007 — Image storage dùng base64 inline" — image_url stored as TEXT column inline, no separate media_uploads table |
| **Gap** | None — documented |
| **Effort** | 0 |
| **Slice owner** | None |
| **Severity** | N/A — informational |

### Finding T03-F9 — V008__shopee_prices_mock.sql ✅ COMMITTED (ADR-032 implementation)

| Field | Value |
|---|---|
| **DoD/Day** | ADR-032 (LOCKED 2026-05-18) — supersedes ADR-008 JSON file approach |
| **Current state** | File present at `infra/migrations/V008__shopee_prices_mock.sql`. Inline comments confirm ADR-032 cross-reference, mention V004/V007 skip, declare worker seed mechanism (`apps/workers/src/shopee-mock-seed-worker.ts` at startup, idempotent) |
| **Expected** | Per `02_DATA_MODEL.md` lines 432-542: CREATE TABLE `shopee_prices_mock` with category/attributes/price columns; indexes `idx_shopee_category`, `idx_shopee_attrs` GIN on attributes; sample query stubs |
| **Gap** | File ready. **Cannot run** until V001 chain + Postgres exist. **Worker missing** (per T02-F5) — apps/workers/src/shopee-mock-seed-worker.ts referenced but doesn't exist. |
| **Effort** | 0 days SQL; 0.5 day worker (T02-F5) |
| **Slice owner** | SQL: S-00b chained apply. Worker: S-02 (or S-00b extension if Intent 01 demo timing forces it earlier) |
| **Severity** | P1 HIGH conditional |

### Finding T03-F10 — Vespa schema (`product.sd`) MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-9 + Day 2 (line 128) |
| **Current state** | `infra/vespa/schemas/product.sd` does not exist; `infra/vespa/services.xml` does not exist |
| **Expected** | Per PHASE_01 line 128 + `07_BEHAVIOR_LOGS.md` line 197-198: schema includes `text_embedding`, `image_embedding`, behavioral signal fields (`impressions_7d`, `clicks_7d`, possibly `purchases_7d` for cvr computation per line 251) |
| **Gap** | Entire Vespa schema package absent. `services.xml` also absent (defines container + content cluster, indexing chain). |
| **Effort** | 1 day (schema + services.xml + deploy script `scripts/vespa-init.sh` per Phase 01 risk mitigation line 264) |
| **Slice owner** | S-00b foundation scaffold (Vespa schema is Day 2 spec — foundational) |
| **Severity** | **P0 BLOCKER** — DoD-9 explicit; blocks S-04 (Intent 03 search) which requires Vespa hybrid_search |

### Finding T03-F11 — Vespa `image_embedding` field dimension unspecified

| Field | Value |
|---|---|
| **DoD/Day** | DoD-9 mentions `image_embedding` but dimension not in `07_BEHAVIOR_LOGS.md` line 197-198 context or `02_DATA_MODEL.md` |
| **Current state** | Doc gap (per Rule 3 evidence priority — no source defines dimension) |
| **Expected** | Embedding dimension number (likely 512 or 768 depending on model — possibly CLIP for image, sentence-transformers for text per `01_ARCHITECTURE.md`) |
| **Gap** | Spec ambiguity |
| **Effort** | Rule 5 STOP — needs human decide model + dimension before V001 or product.sd can be authored |
| **Slice owner** | Human decision pending, then S-00b applies |
| **Severity** | **P1 HIGH** — surface immediately; minor delay if human signs off quickly |

### Finding T03-F12 — `infra/seed/` data files MISSING

| Field | Value |
|---|---|
| **DoD/Day** | DoD-2 ("seed data load đủ") + Day 2 (line 129) — JSON files + seed.ts/seed.py |
| **Current state** | `infra/seed/` directory does not exist |
| **Expected** | Per PHASE_01 line 101-110 + 246-259:<br>• `users.json` (5 users: 2 merchants + 2 customers + 1 admin, per spec line 247-254)<br>• `products.json` (50 products, 10 categories × 5: nuoc_tuong, dau_an, mi_tom, sua, banh_keo, gia_vi, nuoc_giai_khat, do_dong_hop, gao, banh_mi)<br>• `policies.json`<br>• `shopee-mock.json` — **CONFLICT WITH ADR-032: see F13**<br>• `seed.ts` or `seed.py` script |
| **Gap** | All seed files absent |
| **Effort** | 0.5-0.75 day (users.json simple; products.json larger — 50 entries; seed.ts script orchestrates Postgres insert + Vespa feed) |
| **Slice owner** | S-00b foundation scaffold + chained `make seed` target |
| **Severity** | **P0 BLOCKER** — DoD-2 explicit |

### Finding T03-F13 — Conflict surfaced (Rule 7): `shopee-mock.json` ADR-008 ⚠️ vs ADR-032 supersede

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 (line 105: `shopee-mock.json` listed in infra/seed/) + ADR-032 supersedes ADR-008 |
| **Current state** | PHASE_01 spec line 105 still lists `infra/seed/shopee-mock.json` as part of seed folder, but ADR-032 (LOCKED 2026-05-18, supersedes ADR-008) replaces JSON file approach with Postgres `shopee_prices_mock` table seeded by worker |
| **Expected per ADR-032 (priority 2 per Rule 7)** | NO `shopee-mock.json` in seed/; instead `apps/workers/src/shopee-mock-seed-worker.ts` reads inline mock data and inserts into Postgres |
| **Gap** | **Docs internal inconsistency** — PHASE_01 doc not patched for ADR-032 |
| **Effort** | 5 min docs patch (remove shopee-mock.json line in PHASE_01 line 105, add brief note pointing to ADR-032) |
| **Slice owner** | Docs-only patch — propose during S-00b foundation work or independent quick fix |
| **Severity** | **P2 MEDIUM** docs consistency — does not block code (clear ADR wins per Rule 7 priority 2) but should patch for future-reader clarity |
| **Action** | **Surface to consolidated report (T05 synthesis) per Rule 7 step 4 — do not silently pick** |

### Finding T03-F14 — Mock product data quality vs Intent 01 needs

| Field | Value |
|---|---|
| **DoD/Day** | Day 2 + Intent 01 (import image) requirements |
| **Current state** | products.json spec calls for 10 categories × 5 = 50 products with simple structure |
| **Expected** | V002 added enrichment columns (brand, original_price, rating_avg, rating_count, sold_count, image_gradient, icon_hint). Seed must populate these. ADR-032 expanded "sample data structured (5 sample products với title/store/rating/sold_count)" for state D expanded panel per ADR-032 rationale. |
| **Gap** | Seed quality requirements not explicit in PHASE_01 spec — may underrepresent Intent 01 demo needs |
| **Effort** | 0.25 day extra to enrich seed beyond minimal 50 entries |
| **Slice owner** | S-00b (seed.ts owner) or polish during Intent 01 V-SLICE (S-07 image) |
| **Severity** | **P2 MEDIUM** — DoD-2 passes with minimal seed; Intent 01 demo may need richer seed later |

### Summary Table — T03 Findings

| Finding | DoD/Day | Severity | Effort (days) | Owner candidate |
|---|---|---|---|---|
| F1 V001__init.sql foundational | DoD-2 / Day 2 | P0 | 1.0 | S-00b |
| F2 behavior_events table | DoD-2 explicit | P0 | (in F1) | S-00b |
| F3 V002 product_enrichment | committed | P1 conditional | 0 | S-00b apply |
| F4 V003 insights | committed | P1 cond | 0 | S-00b apply |
| F5 V004 promotions SKIPPED | doc'd | N/A | 0 | none |
| F6 V005 payment_metadata | committed | P1 cond | 0 | S-00b apply |
| F7 V006 analytics_aggregations | committed | P1 cond | 0 | S-00b apply (re-materialize Stage 2+) |
| F8 V007 media SKIPPED | doc'd | N/A | 0 | none |
| F9 V008 shopee_prices_mock (ADR-032) | committed | P1 cond | 0 SQL; 0.5 worker | S-00b SQL; S-02 worker |
| F10 Vespa product.sd + services.xml | DoD-9 / Day 2 | P0 | 1.0 | S-00b |
| F11 image_embedding dimension unspecified | DoD-9 ambiguity | P1 | (Rule 5 STOP) | Human decide, then S-00b |
| F12 infra/seed/ files | DoD-2 / Day 2 | P0 | 0.5-0.75 | S-00b |
| F13 Conflict: shopee-mock.json (ADR-008 vs ADR-032) | Rule 7 | P2 | 5 min docs | Docs patch |
| F14 Seed data quality Intent 01 | quality | P2 | 0.25 | S-00b or S-07 polish |
| **Total T03 scope (new code)** | | | **~3 days** | |

### DoD verdict from T03 perspective
- **DoD-2** (migrations + seed + behavior_events): ❌ TODO (V001 missing, seed dir missing — V002-V008 ready to chain when V001 lands)
- **DoD-9** (Vespa schema with embedding + behavioral fields): ❌ TODO (Vespa schema dir absent + dimension ambiguity)

## 3. Commands Run

**N/A: audit không chạy bash.**

## 4. Test Results

**N/A: audit không có test code.**

## 5. Deviations From Task Pack

None. T03 scope adhered. Did not validate SQL syntax of committed V002-V008 (per Non-goals — "audit migration content correctness deferred"). Did not propose V001 SQL content (Rule 5 stop). F11 image_embedding dimension flagged as Rule 5 STOP — surfaced for human decide, did not pick.

## 6. Known Issues

- **F11 image_embedding dimension** is a genuine spec gap requiring human input. Until resolved, V001 + product.sd cannot be authored. Should be raised in consolidated report as top-priority docs/decision item.
- **F13 docs patch** is trivial but should be done before/during S-00b so foundation work doesn't re-introduce the inconsistency by following stale spec.
- **Greenfield assumption — partial false confirmed:** 5 SQL files committed in `infra/migrations/`. Treated as "spec artifacts authored ahead of running infra" — they're code-ready but cannot apply without V001 + Postgres. This is consistent with the prompt: "V001__init.sql migration applied (chỉ có spec ở docs, chưa tạo file)" — but actual V001 file is NOT in zip even as spec file. The spec lives only inline in `02_DATA_MODEL.md` (DDL prose). This is the gap.
- **F14 seed quality** is medium priority but worth surfacing because hackathon demo richness depends on visible product data. May warrant explicit task in S-07 (Intent 01 image V-SLICE) to enrich seed if S-00b ships minimal.

## 7. Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice.**

## 8. Recommended Next Step

Proceed to **S00-T04 Audit Observability**. F11 (image_embedding dimension) forwarded to consolidated report as "Open Decision" item. F13 (shopee-mock.json ADR-032 inconsistency) forwarded to T05 docs consistency synthesis.

## Bonus — Conflicts Surfaced (Rule 7)

**1 docs internal inconsistency surfaced:**

- **F13:** `infra/seed/shopee-mock.json` referenced in `PHASE_01_INFRA.md` line 105 conflicts with ADR-032 (supersedes ADR-008 JSON file approach). Resolution per Rule 7 priority hierarchy: ADR-032 wins (priority 2) over PHASE_01 prospective spec (priority 4). PHASE_01 doc needs minor patch.

**1 spec ambiguity (not conflict — gap):**

- **F11:** `image_embedding` field dimension not specified in `07_BEHAVIOR_LOGS.md` line 197-198 or `02_DATA_MODEL.md` or `01_ARCHITECTURE.md`. Needs human decide (Rule 5 stop). Not a Rule 7 conflict since no two sources disagree — but blocks Vespa schema authoring.

**1 cross-task forward reference confirmed:**

- T02-F5 (apps/workers/src/shopee-mock-seed-worker.ts missing) is required for T03-F9 (V008 ADR-032 seeding mechanism). Sequence implication forwarded to consolidated report.
