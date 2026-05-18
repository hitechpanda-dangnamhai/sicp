# Claude Code Task Pack — S00-T03

## Task Type

**Q-GATE** (Audit only, không code)

## Objective

Audit data layer artifacts: Postgres migrations (V001 foundational + V002/V003/V005/V006/V008 incremental), seed data (users.json, products.json, policies.json, shopee-mock.json, seed.ts), Vespa schema (`infra/vespa/services.xml` + `schemas/product.sd` với text_embedding, image_embedding, behavioral signal fields), `behavior_events` table presence. So sánh hiện trạng vs PHASE_01_INFRA.md DoD-2 + DoD-9 + Day 2 + `07_BEHAVIOR_LOGS.md` Section 5-6.1 expectations. Surface migration numbering anomaly V001 missing vs V002+ committed.

## Read First (Evidence)

1. `slices/S-00_BRIEF.md` — slice context (especially R1 risk + R5 migration numbering note)
2. `reports/S00-T01_REPORT.md` — T01 baseline (depends_on)
3. `docs/phases/PHASE_01_INFRA.md` lines 8-16 (DoD-2, DoD-9), lines 99-110 (infra/ tree), lines 126-130 (Day 2 migration + Vespa + seed tasks), lines 246-259 (mock data seed JSON examples)
4. `docs/02_DATA_MODEL.md` lines 416 (V001 reference), lines 432-542 (V008 spec, ADR-032 reference, `shopee_prices_mock` DDL + indexes + ADR cross-ref)
5. `docs/07_BEHAVIOR_LOGS.md` lines 148-178 (`behavior_events` table DDL + partition + indexes), lines 197-198 (Vespa fields `impressions_7d`, `clicks_7d`), line 269 (event property examples)
6. `docs/DECISIONS.md` ADR-032 (line 283) — Shopee Postgres + worker, supersedes ADR-008
7. `docs/09_FIELD_AUDIT.md` line 312-315 — V004/V007 intentionally skipped rationale
8. `infra/migrations/V002__product_enrichment.sql` — actual committed file (read-only inspect to confirm presence)
9. `infra/migrations/V003__insights.sql`, `V005__payment_metadata.sql`, `V006__analytics_aggregations.sql`, `V008__shopee_prices_mock.sql` — actual files
10. `MASTER_SLICE_BACKLOG.md` line 38-56 — S-00 spec (audit migrations expectation)
11. `ai-delivery/TASK_OPERATING_SYSTEM.md` — Rule 3 evidence, Rule 7 hierarchy

## Scope (ALLOWED to do)

- Audit migrations directory state:
  - V001__init.sql — foundational, spec'd in `02_DATA_MODEL.md` line 416 + PHASE_01 Day 2 line 127 ("toàn bộ DDL từ `02_DATA_MODEL.md` + `behavior_events` table từ `07_BEHAVIOR_LOGS.md`")
  - V002/V003/V005/V006/V008 — committed status
  - V004 (promotions), V007 (media_uploads) — verify intentional skip per `09_FIELD_AUDIT.md`
- Audit `behavior_events` table presence (per DoD-2 explicit requirement)
- Audit Vespa artifacts:
  - `infra/vespa/services.xml`
  - `infra/vespa/schemas/product.sd` — verify spec for `text_embedding`, `image_embedding`, behavioral signal fields (`impressions_7d`, `clicks_7d`)
- Audit seed data:
  - `infra/seed/users.json` (5 users per spec line 247)
  - `infra/seed/products.json` (50 products, 10 cat × 5)
  - `infra/seed/policies.json`
  - `infra/seed/shopee-mock.json` — note per ADR-032 superseded by Postgres table + worker, but spec PHASE_01 line 105 still references; surface conflict
  - `infra/seed/seed.ts` or `seed.py`
- Assess DoD-2 (migrations + seed + `behavior_events`) feasibility
- Assess DoD-9 (Vespa schema includes 4 critical field families) feasibility
- Classify severity, identify slice owner (S-00b foundation scaffold for V001 + Vespa init? Or S-02 absorbs?)
- Estimate effort per Day 2 mapping

## Non-goals (NOT doing in this task)

- KHÔNG audit migration content correctness (V002-V008 SQL syntax) — surface existence only
- KHÔNG validate seed data quality (data accuracy in JSON files) — surface presence only
- KHÔNG audit Postgres/Redis/Vespa runtime config (docker-compose volumes, healthchecks) — defer to S00-T01 (root compose) + S00-T04 (otel-collector connection to Postgres metrics)
- KHÔNG audit Kafka topics (`icp.orders.*` Phase 04 territory per PHASE_01 line 242-243)
- KHÔNG decide V001 foundational scope (which DDL goes in V001 vs deferred to V0XX) — Rule 5 stop if needed
- KHÔNG re-litigate ADR-032 (LOCKED supersedes ADR-008)
- KHÔNG audit shopee-mock-seed-worker code (TS worker in `apps/workers/` — that's T02 services scope + future S-02)

## Allowed Changes

- Create: `taskpacks/S00-T03_AUDIT_DATA_LAYER.md` (this file)
- Create: `reports/S00-T03_REPORT.md`
- Create: `reviews/S00-T03_REVIEW.md`

## Forbidden Changes

- KHÔNG touch `infra/migrations/*.sql` (read-only, do not modify committed migrations)
- KHÔNG create stub `infra/vespa/` or `infra/seed/` files — audit only
- KHÔNG touch `docs/` or `ai-delivery/`
- KHÔNG modify ADR-032 (LOCKED)
- KHÔNG propose V001 SQL content — Rule 5 stop, defer to S-02 or S-00b

## Acceptance Criteria

- [ ] Per-migration finding: V001 / V002 / V003 / V004 / V005 / V006 / V007 / V008 — committed yes/no, intentional skip yes/no, severity if missing
- [ ] DoD-2 verdict: behavior_events presence, migrations chain runnable, seed load feasibility
- [ ] DoD-9 verdict: Vespa schema fields coverage (text_embedding + image_embedding + impressions_7d + clicks_7d)
- [ ] Conflict surfaced (Rule 7): `infra/seed/shopee-mock.json` referenced in PHASE_01 line 105 vs ADR-032 supersedes JSON file → ADR-032 winning, doc PHASE_01 Day 2 needs minor update note (NOT a slice block, just consistency check for T05 + slice owner future patch)
- [ ] Effort per Day 2 mapping; slice owner identified (likely S-00b OR S-02 absorb)
- [ ] No drift into T02 (services skeleton) or T04 (obs)
- [ ] Output report cites file path + line per Rule 3

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- Evidence conflict per Rule 7 unresolved — e.g., V001 content scope unclear (does `behavior_events` partition go in V001 or separate?)
- ADR mới cần thiết — vd partition strategy `behavior_events_y2026m05` rolling vs declarative
- Cần human decide — vd seed.ts vs seed.py choice (PHASE_01 line 106 lists both with "or" — Rule 5 needs explicit lock)
- Discover requirement chưa có specs — vd Vespa `image_embedding` dimension number không có trong `07_BEHAVIOR_LOGS.md` line 197-198 context
- Greenfield assumption partial false at data layer — **confirmed surfacing:** 5 migration files (V002/V003/V005/V006/V008) committed despite "greenfield" claim. Resolution: treat committed files as "spec artifacts" (since no Postgres running to apply them); document in report. Não block task, surface only.

## Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice, không có previous slice để regression check.**

Forward-looking note:
- T03 findings inform potential S-00b foundation scaffold task (create V001 + Vespa init) and S-02 P-CAP runtime tasks (seed.ts script + shopee-mock-seed-worker).
