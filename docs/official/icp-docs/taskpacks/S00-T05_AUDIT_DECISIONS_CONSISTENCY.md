# Claude Code Task Pack — S00-T05

## Task Type

**Q-GATE** (Audit only, không code — cross-cutting consistency check)

## Objective

Cross-cutting audit verifying 4 recent ADRs (ADR-032 Shopee Postgres + worker / ADR-033 shadcn+Tailwind / ADR-034 animations / ADR-035 state mgmt) đã được reflect đầy đủ trong updated docs (`01_ARCHITECTURE.md`, `02_DATA_MODEL.md`, `PHASE_00_HANDOFF.md`, `PHASE_01_INFRA.md`, `MASTER_SLICE_BACKLOG.md`); verify V008 migration file thực sự exist; verify "Câu hỏi mở" section trong handoff đã updated với checkmarks; verify naming conventions documented và áp dụng nhất quán. Synthesize cross-task findings (T01-T04) for inconsistency.

## Read First (Evidence)

1. `slices/S-00_BRIEF.md` — slice context, R4 risk (ADR reflection partial possible)
2. `reports/S00-T01_REPORT.md`, `S00-T02_REPORT.md`, `S00-T03_REPORT.md`, `S00-T04_REPORT.md` — per-task findings để synthesize cross-cutting consistency
3. `docs/DECISIONS.md` — full ADR catalog:
   - ADR-008 line 55-59 (status Superseded by ADR-032)
   - ADR-032 line 283
   - ADR-033 line 320
   - ADR-034 line 363
   - ADR-035 line 410
4. `docs/01_ARCHITECTURE.md` line 205-206 — ADR-032 reflection
5. `docs/02_DATA_MODEL.md` line 432-433 (V008 + ADR-032 ref), line 542 (V008 file path + ADR-032 cross-ref)
6. `docs/handoff/PHASE_00_HANDOFF.md` line 427-433 — "Câu hỏi mở" with 3 checkmarks (component lib, animation, state mgmt)
7. `docs/phases/PHASE_01_INFRA.md` line 179-227 — Day 6 web stack LOCKED ADR-033/034/035 cross-reference
8. `infra/migrations/V008__shopee_prices_mock.sql` — verify file exists (per ADR-032)
9. `docs/05_CODING_CONVENTIONS.md` — naming conventions (verify documented)
10. `MASTER_SLICE_BACKLOG.md` — S-01 risks line 83-85 (verify ADR-033/034/035 RESOLVED markers)
11. `ai-delivery/TASK_OPERATING_SYSTEM.md` — Rules 3, 5, 7

## Scope (ALLOWED to do)

- **ADR-032 reflection check** (Shopee Postgres + worker, supersedes ADR-008):
  - `DECISIONS.md` ADR-008 marked Superseded ✓
  - `DECISIONS.md` ADR-032 entry ✓
  - `01_ARCHITECTURE.md` line 205-206 — references ADR-032
  - `02_DATA_MODEL.md` line 432-433, 541-542 — V008 migration + ADR-032 cross-ref
  - `PHASE_01_INFRA.md` mock data section — does it still mention `shopee-mock.json` per ADR-008 OR updated per ADR-032? (potential conflict surface)
  - `infra/migrations/V008__shopee_prices_mock.sql` file exists ✓
- **ADR-033 reflection check** (shadcn/ui + Tailwind v3):
  - `DECISIONS.md` ADR-033 entry ✓
  - `PHASE_01_INFRA.md` Day 6 line 183-184 references ADR-033 ✓
  - `PHASE_00_HANDOFF.md` line 431 checkmark ✓
  - `MASTER_SLICE_BACKLOG.md` S-01 risks line 83 marker ✓
- **ADR-034 reflection check** (Hybrid CSS + Framer Motion + canvas-confetti):
  - `DECISIONS.md` ADR-034 entry ✓
  - `PHASE_01_INFRA.md` Day 6 line 185 ✓
  - `PHASE_00_HANDOFF.md` line 432 ✓
  - `MASTER_SLICE_BACKLOG.md` S-01 risks line 84 ✓
- **ADR-035 reflection check** (Zustand + TanStack + react-hook-form + Context + useState):
  - `DECISIONS.md` ADR-035 entry ✓
  - `PHASE_01_INFRA.md` Day 6 line 186 ✓
  - `PHASE_00_HANDOFF.md` line 433 ✓
  - `MASTER_SLICE_BACKLOG.md` S-01 risks line 85 ✓
- **"Câu hỏi mở" status check** in `PHASE_00_HANDOFF.md` line 427-433 — all 3 questions checked off
- **Naming conventions check** in `05_CODING_CONVENTIONS.md` — verify documented and applied
- **Cross-task synthesis** — pull conflicts surfaced by T01-T04 (vd shopee-mock.json in PHASE_01 line 105 vs ADR-032 supersede) and propose docs patches (NOT apply — just propose for consolidated report)

## Non-goals (NOT doing in this task)

- KHÔNG audit ADRs trước ADR-032 (LOCKED history; not in scope of 4-ADR consistency batch)
- KHÔNG decide architecture changes; only flag inconsistencies per Rule 5
- KHÔNG patch docs in this slice (Rule 5 stop; document propose-only)
- KHÔNG re-litigate any of 4 ADRs (LOCKED)
- KHÔNG audit log catalog (`docs/LOG_CATALOG.md`) for new ADR impact — that's polish later
- KHÔNG audit `INTENT_AUDIT_REPORT.md` for migration field references (V004/V007 — already documented intentional skip per T03)

## Allowed Changes

- Create: `taskpacks/S00-T05_AUDIT_DECISIONS_CONSISTENCY.md` (this file)
- Create: `reports/S00-T05_REPORT.md`
- Create: `reviews/S00-T05_REVIEW.md`

## Forbidden Changes

- KHÔNG touch `docs/DECISIONS.md` (LOCKED ADR registry)
- KHÔNG touch any updated doc patched in Phiên 1 (`01_ARCHITECTURE.md`, `02_DATA_MODEL.md`, `PHASE_00_HANDOFF.md`, `PHASE_01_INFRA.md`, `MASTER_SLICE_BACKLOG.md`)
- KHÔNG touch `infra/migrations/V008__shopee_prices_mock.sql`
- KHÔNG modify `ai-delivery/TASK_OPERATING_SYSTEM.md`
- KHÔNG propose new ADR — Rule 5 stop, surface to human

## Acceptance Criteria

- [ ] Each of 4 ADRs has explicit reflection-check table: reflected ✅ / ❌ per doc location
- [ ] V008 file existence confirmed (boolean)
- [ ] "Câu hỏi mở" 3 checkmarks confirmed (boolean each)
- [ ] Naming conventions: documented yes/no in `05_CODING_CONVENTIONS.md`; applied consistently in V008 column names + behavior_events fields (sample check)
- [ ] Conflicts surfaced (Rule 7) — list inconsistencies between docs (vd shopee-mock.json reference in PHASE_01 line 105 vs ADR-032 supersede)
- [ ] Cross-task synthesis — pull T01-T04 findings, flag if any docs internal consistency issue not yet captured
- [ ] Effort estimate for docs patches (NOT done here; propose to slice owner — likely "docs-only patch" inside future slice or standalone polish)
- [ ] Severity P0/P1/P2 per finding
- [ ] Slice owner per finding (mostly "docs patch — minor — can absorb in S-02 or polish")
- [ ] Output report cites file path + line per Rule 3

## Stop Conditions ⭐

Stop and report (NOT proceed) if:

- Evidence conflict per Rule 7 — vd one ADR contradicts another (vd ADR-033 says Tailwind v3 but ADR-034 implicitly assumes Tailwind v4 features)
- ADR mới cần thiết để resolve gap — vd discover docs mention "Storybook" without ADR documenting decision
- Cần human decide — vd if shopee-mock.json reference in PHASE_01 line 105 still needed (deprecate vs keep for some other purpose) — surface, không decide
- Discover requirement chưa có specs — vd naming convention for Zustand store file names (`useAuthStore.ts` vs `auth.store.ts`) not in `05_CODING_CONVENTIONS.md`
- ADR-032 superseded ADR-008 nhưng implementation references still mention JSON file in critical path

## Cross-Slice Integration Check ⭐

**N/A — S-00 là first slice, không có previous slice để regression check.**

Cross-task synthesis (not regression — internal to S-00):
- T05 synthesizes findings from T01-T04 to produce consolidated docs patch list. If conflicts > 3 items, flag in consolidated `S00-REPORT.md` for explicit human attention.
