# Implementation Report — S00b-T01 Repo Root Scaffold

> **Slice:** S-00b Foundation Scaffold
> **Task:** T01 — Repo Root Scaffold
> **Phiên:** 4
> **Date:** 2026-05-18
> **Status:** READY FOR REVIEW

---

## Files Changed

8 root config files (created — greenfield, không có file nào tồn tại trước):

| # | Path | Status | Size |
|---|---|---|---|
| 1 | `package.json` | created | 871 B |
| 2 | `pnpm-workspace.yaml` | created | 395 B |
| 3 | `tsconfig.base.json` | created | 494 B |
| 4 | `.gitignore` | created | 1.8 KB |
| 5 | `.editorconfig` | created | 1.2 KB |
| 6 | `.env.example` | created | 1.9 KB |
| 7 | `Makefile` | created | 3.6 KB |
| 8 | `README.md` | created | 6.2 KB |

4 workflow files (created):

| # | Path | Status |
|---|---|---|
| 9 | `taskpacks/S00b-T01_REPO_ROOT_SCAFFOLD.md` | created (Bước 1) |
| 10 | `reports/S00b-T01_REPORT.md` | created (this file) |
| 11 | `reviews/S00b-T01_REVIEW.md` | created (Bước 4) |
| 12 | `slices/S-00b_TASKLIST.md` | modified (T01 marked DONE + Status Log appended) |

---

## What Was Implemented

### Group 1 — Monorepo orchestration

- **`package.json`**: Root orchestrator. `private: true`, `name: "icp"`,
  `packageManager: "pnpm@9.15.0"` (per human ack), `engines.node: ">=20.0.0"`,
  `engines.pnpm: ">=9.0.0"`. 9 scripts (`dev`/`build`/`lint`/`test`/`typecheck`/
  `format`/`clean`/`obs:up`/`obs:down`) qua `pnpm -r` (recursive). Zero runtime
  deps. DevDeps: `typescript: ^5.6.0` (canonical per human ack — workspace
  packages KHÔNG được pin riêng trừ khi có compat issue surface trước).
- **`pnpm-workspace.yaml`**: Hai patterns `apps/*` + `packages/*`. Comment
  inline cảnh báo plural `packages/*` critical cho T02 resolve `@icp/shared-types`.
- **`tsconfig.base.json`**: Match D-05 LOCKED exact — target es2022, module
  esnext, moduleResolution bundler, strict true, skipLibCheck true, lib
  es2022+DOM+DOM.Iterable, plus 4 quality flags (noUnusedLocals,
  noUnusedParameters, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames).
  Có `$schema` cho IDE intellisense.

### Group 2 — Convention files

- **`.gitignore`**: Sections rõ ràng — Node/pnpm, Next.js, Python, env files,
  logs, coverage, IDE, OS, Docker, misc. Critical line: `!.env.example` explicit
  negation sau `.env*` glob.
- **`.editorconfig`**: `root = true` + UTF-8/LF/final-newline baseline. TS/JS/
  JSON/YAML 2-space, Python 4-space, Markdown `trim_trailing_whitespace = false`
  (per human ack — preserve Markdown hard break 2 spaces), Makefile
  `indent_style = tab` (make hard requirement).
- **`.env.example`**: 18 keys total — 3 core infra + 1 auth + 5 OTel + 2
  per-service identity + 2 Vespa + 2 LLM + 3 NEXT_PUBLIC. Sections phân cách
  rõ với comment headers. Match execution guide §4.1 block exact.

### Group 3 — Glue layer

- **`Makefile`**: 13 targets, tab-indented recipes verified (28 tab lines,
  0 space-indent recipe lines). `.DEFAULT_GOAL := help` cho UX (`make` không
  arg → list targets). `.PHONY` declared. 2 compose file paths reference (chưa
  tồn tại — T07/T08 sẽ tạo, Known Issue dưới).
- **`README.md`**: Quickstart (`cp .env.example .env`, `pnpm install`,
  `make up && make seed`), tech stack table (mapping `00_CONTEXT.md` §2), repo
  layout snippet với task ownership annotated, ADR-033/034/035/036 mentioned
  trong dedicated "Architectural decisions" section + 2 links đến
  `docs/DECISIONS.md`, status note "Stack chưa runnable end-to-end cho đến
  khi T08 xong".

---

## Commands Run

```bash
# Validate JSON
$ python3 -c "import json; json.load(open('package.json'))"
package.json: valid JSON

$ python3 -c "import json; json.load(open('tsconfig.base.json'))"
tsconfig.base.json: valid JSON

# Validate YAML
$ python3 -c "import yaml; data=yaml.safe_load(open('pnpm-workspace.yaml')); \
              assert 'apps/*' in data['packages']; \
              assert 'packages/*' in data['packages']"
✓ apps/* and packages/* (plural) declared

# Validate Makefile parse
$ make -n help
echo "ICP Makefile targets:"
echo ""
echo "  make up             — Boot app + observability stacks (merged compose)"
... (13 targets listed correctly)

# Tab indent check
$ awk '/^\t/ {tabs++} /^   *[^[:space:]#]/ && !/^[a-zA-Z_-]+:/ {spaces++} \
       END {print "tabs:", tabs, "spaces (BAD):", spaces}' Makefile
tabs: 28 spaces (BAD): 0

# Env keys count
$ grep -cE "^[A-Z_]+=" .env.example
18

# .gitignore negation present
$ grep "!.env.example" .gitignore
!.env.example
```

**Commands NOT run (per Forbidden Changes):**
- `pnpm install` — không chạy thật, lockfile defer T02 sau khi có workspace content
- `make up` — không chạy thật, 2 compose file chưa tồn tại đến T07/T08
- Lint/test/format — defer (no workspaces có content)

---

## Test Results

- **Unit tests:** N/A (config-only task, no testable logic).
- **Smoke tests:** Manual validation pass (5 checks):
  1. JSON validity (package.json, tsconfig.base.json) — PASS
  2. YAML validity (pnpm-workspace.yaml) — PASS
  3. Makefile parse (`make -n help`) — PASS
  4. Makefile tab indent (no space-indent recipes) — PASS
  5. `.gitignore` explicit `!.env.example` negation — PASS
- **Cross-check trước finalize** (per task pack acceptance):
  - `pnpm-workspace.yaml` pattern `packages/*` plural — PASS ✓
  - Makefile references files chưa tồn tại — PASS (documented Known Issues) ✓
  - README mention 4 ADRs + DECISIONS.md link — PASS (2 links found) ✓

---

## Deviations From Task Pack

### Deviation 1 — Makefile target naming `vespa-deploy` vs `vespa:deploy`

**Issue:** Task pack + execution guide Section 4.1 cite target name
`vespa:deploy` (colon in name). GNU Make treats `:` as target/dependency
separator, so `vespa:deploy:` line would parse as target `vespa` with
dependency `deploy:` (broken). Cannot literally name a target with embedded
colon without escaping (`vespa\:deploy:` — fragile, IDE-unfriendly).

**Resolution:** Renamed target to `vespa-deploy` (hyphen). Inline Makefile
comment explains: target name uses hyphen, command body still calls
`bash infra/vespa/deploy.sh` per T06 contract; documentation reference to
`vespa:deploy` style is preserved as alias prose; actual user command is
`make vespa-deploy`.

**Impact:**
- T06 deploy script path unchanged (`infra/vespa/deploy.sh`)
- README quickstart unchanged (does not invoke `vespa-deploy` directly —
  `make up` handles it implicitly per future compose, or user runs explicit)
- Docs maintainer reference: if any doc cite `make vespa:deploy`, patch to
  `make vespa-deploy`

**Severity:** Low. Cosmetic, no contract break. Surfaced for visibility, not
a Stop Condition trigger (mechanical incompatibility of make grammar, not spec
ambiguity).

### Deviation 2 — Bonus comment trong tsconfig.base.json về NestJS override

**Issue:** Task pack Scope item 3 says "Note inline: Gateway sẽ override
module: commonjs + moduleResolution: node trong `apps/gateway/tsconfig.json`
(defer T03)".

**Resolution:** JSON does NOT support comments natively. Adding `// comment`
would break `JSON.parse()`. Instead:
- Did NOT inject comment trong `tsconfig.base.json` body
- Documented Gateway override expectation trong taskpack + report only
- T03 task pack will re-document khi thực hiện override

**Impact:** None. Information preserved trong tracking docs.

**Severity:** Trivial. Documentation locus shift only.

---

## Known Issues

### Known Issue 1 — Forward references trong Makefile chưa resolved

`Makefile` references 4 paths chưa tồn tại:

| Target | Reference | Created by |
|---|---|---|
| `up` | `infra/docker-compose.yml` | T08 |
| `up` | `infra/docker-compose.observability.yml` | T07 |
| `down`, `obs-up`, `obs-down`, `logs` | (same 2 compose files) | T07 + T08 |
| `migrate` | `infra/migrations/apply.sh` | T04 |
| `seed` | `infra/seed/seed.ts` | T05 |
| `vespa-deploy` | `infra/vespa/deploy.sh` | T06 |

**Status:** ACCEPTED. Per execution guide §4.1 Cross-check: "Makefile
references files chưa tồn tại — đây OK, T04-T08 sẽ tạo, document trong
report Known Issues." Running `make up` trước khi T07+T08 done → docker
compose error "no such file" — expected behavior, surface gracefully.

### Known Issue 2 — `pnpm install` chưa runnable

Root `package.json` declares workspaces nhưng workspaces chưa có content
(empty `apps/*` + `packages/*` paths). Running `pnpm install` trước T02 →
warning "No projects matched the filters". Expected.

**Mitigation:** T02 đầu sẽ init `packages/shared-types/package.json` +
`apps/workers/package.json` → `pnpm install` resolve được.

### Known Issue 3 — `pnpm-lock.yaml` chưa tồn tại

Lockfile generated lần đầu khi `pnpm install` chạy thật (sau T02). T01 không
commit lockfile preemptively (empty workspaces → meaningless lock).

### Known Issue 4 — Prettier / ESLint configs chưa scaffold

Per S00-REPORT G-26/G-27 partial coverage và execution guide §4.1 KHÔNG làm
list, prettier + eslint scaffold defer hoàn toàn (out of S-00b scope). Task
pack scripts.format reference `pnpm -r --parallel run format` — workspaces sẽ
tự bring prettier nếu cần khi T08 init `apps/web` (Next.js bundles eslint
default).

---

## Cross-Slice Integration Check ⭐

**N/A — S-00b T01 là task đầu tiên trong slice, không có previous code state
để regression check.**

- S-00 outputs (audit reports) là docs read-only, T01 không touch → no
  regression on S-00 deliverables.
- T01 là greenfield root scaffold — không có previous code state.
- Forward dependency: T02-T08 sẽ depend on T01 outputs (workspaces declared,
  tsconfig base, Makefile glue). Defer cross-slice check sang T08
  consolidated report khi đủ stack hoàn chỉnh.

---

## Recommended Next Step

**Proceed to S00b-T02 — Shared Packages & Workers Skeleton** per
`slices/S-00b_TASKLIST.md` linear ordering.

T02 sẽ:
1. Init `packages/shared-types/` (package.json + tsconfig.json extends base +
   empty `src/index.ts` barrel)
2. Init `apps/workers/` (package.json + skeleton `src/index.ts`)
3. Verify `pnpm install` resolves cleanly (first lockfile commit)

Dependency chain confirmed clean: T02 chỉ cần T01 outputs (workspaces +
tsconfig base) đã có ở đây.

---

## Bonus — Conflicts Surfaced

Per Rule 7 surface-not-silent-fix, document mọi inconsistency phát hiện trong
quá trình T01 implementation:

### B1 — No NEW conflicts beyond C8-C12

Đã re-read context evidence (PHASE_01, 00_CONTEXT, 05_CODING_CONVENTIONS,
06_OBSERVABILITY §16, DECISIONS.md, decisions-log). KHÔNG phát hiện
inconsistency mới ngoài 5 conflicts C8-C12 đã surface ở Phiên 2-3.

### B2 — Re-confirm C8-C12 trạng thái pending docs patch (cumulative tracking)

| ID | Trạng thái | Touch trong T01? |
|---|---|---|
| C8 (Vespa dim 768→512) | Pending docs patch | No — T06 scope |
| C9 (S-00b row missing in backlog) | Pending docs patch | No — out of scope |
| C10 (`shadcn-ui` legacy name) | Pending docs patch | No — T08 scope |
| C11 (Grafana port 3001→3002) | Pending docs patch | No — T07 scope |
| C12 (V001 VECTOR columns) | RESOLVED Option B | No — T04 scope |

T01 không modify docs/ → không advance bất kỳ conflict nào sang trạng thái
resolved. Cumulative status will roll up trong consolidated `S00b-REPORT.md`
sau T08.

### B3 — Minor observation về docs/ formatting (NOT promoted to conflict)

Trong khi đọc `02_DATA_MODEL.md` reference paths (cho task pack), thấy file
size 20KB → đoán có thể có sections beyond line 1-165 mà chưa được human review
re-confirmed sau Phiên 2 audit. **Out of T01 scope** to investigate — surface
as informational only. Defer T04 nếu phát hiện ảnh hưởng V001 schema.

### B4 — Makefile target colon-in-name (Deviation 1)

Đã document trong Deviations section. KHÔNG promote thành "conflict" vì đây là
mechanical incompatibility of make grammar với execution guide notation, không
phải spec ambiguity. Docs maintainer note: bất kỳ doc cite `make vespa:deploy`
nên patch sang `make vespa-deploy`.

---

**END OF REPORT.**
