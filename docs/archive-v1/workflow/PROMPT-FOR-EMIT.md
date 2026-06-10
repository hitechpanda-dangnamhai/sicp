# Per-Task Prompt — ER-R10 LAW Md Emit Convention

> **Cách dùng:** Paste block này vào đầu prompt khi giao task chỉnh sửa `.md` files. Self-contained — AI đọc xong biết làm gì ngay.

---

```markdown
**Convention bắt buộc cho phiên này — TẤT CẢ file .md:**

## 1. Path

- **`.md` docs** (governance, spec, report, INDEX, Task Pack, Review) → `/home/hai-dang/Downloads/` **flat**, KHÔNG subfolder. Filename là canonical identifier (vd `S-04_decisions-log.md`, KHÔNG `slices/S-04_decisions-log.md`).
- **Code files** → `~/projects/icpp/sicp/` theo cấu trúc thư mục thực (path CARRY semantic, vd `apps/gateway/src/intent/intent.controller.ts`).

## 2. Emit format — cost-benefit "nhẹ nhàng nhất" (KHÔNG threshold máy móc)

**Mỗi `.md` file edit hỏi 3 câu:**
- (a) Có ≥ 2 anchor points unique-verifiable (substring 5-200 chars, `grep -c = 1`)?
- (b) Change footprint < 50% lines?
- (c) Patch script tiết kiệm tokens vs full re-emit?

**Cả 3 = YES → patch script** (default).

**Full file chỉ khi (4 exception cases):**
- File mới (NEW emit, không có anchor)
- Change ≥ 50% lines
- Anchor không unique-verifiable
- File < 50 LOC AND change > 30%

**File size KHÔNG phải tiêu chí chính.** File 137 LOC với 6 anchor unique + change 12% vẫn ĐI patch script — nhẹ hơn full re-emit ~9K tokens.

**State explicit reasoning per file:**
```
File X.md: 245 LOC, 4 anchors unique, change ~5% → patch script (~12K tokens saved)
File Z.md: NEW Task Pack deliverable → full emit (không có anchor)
```

## 3. Anchor design (verify-before-edit ER-R2 LAW)

**TRƯỚC khi viết anchor vào script:** dùng `grep -c "<exact anchor string>" <target_file>` → PHẢI = 1. KHÔNG ước lượng, KHÔNG copy từ memory.

**Anchor 5-200 chars.** KHÔNG mega-anchor 12K chars ôm nguyên section.

**Append pattern preferred:**
```python
# ✅ GOOD — short tail anchor + extend
old = "Effort T05 1.4d → 1.45d; T06-T07 remaining ~1.05d."
new = old + "\n- **v1.9 (Phiên Sx04-12 ...)** — ..."

# ❌ BAD — mega-anchor brittle
old = "...12K chars v1.8 entry...\n- **v1.6 (Phiên Sx04-8b)**"
new = "...same 12K chars...\n- **v1.9 NEW**\n- **v1.6 (Phiên Sx04-8b)**"
```

**Insert-between** (vd thêm row giữa table): anchor = 1 row preceding, KHÔNG nguyên section.

## 4. Patch script structure

- **Tên:** `apply-<phiên>-batch-<N>.py` (vd `apply-Sx04-12-batch-1.py`)
- **DOCS_DIR hardcoded** = `/home/hai-dang/Downloads` (KHÔNG argparse)
- **User invocation:** `python3 ~/Downloads/<script>.py` từ bất kỳ pwd
- **4-layer defensive validation:**
  1. `check_anchor()` — raises nếu `grep_count != expected`
  2. `apply_patch()` — in-memory replace + check_anchor
  3. `post_verify_count()` — bounds check sau khi tất cả patches applied
  4. `patch_file()` — backup `.bak-<phiên>` + `os.replace(tmp, path)` atomic
- **Summary cuối:** `✅ Batch N atomic patch COMPLETE` hoặc `❌ FATAL: <reason>` + `sys.exit(1)`
- **1 script cover N files** trong cùng atomic batch (KHÔNG split)

## 5. Dry-run mandatory

Trước khi báo user run script:
```bash
mkdir -p /tmp/<phiên>-test/
cp ~/Downloads/<each_target>.md /tmp/<phiên>-test/
sed 's|DOCS_DIR = Path("/home/hai-dang/Downloads")|DOCS_DIR = Path("/tmp/<phiên>-test")|' \
    <script>.py > /tmp/dry-run.py
python3 /tmp/dry-run.py
```
Verify exit code 0 + spot-check kết quả. Nếu FATAL → fix anchor, KHÔNG ép run lên file thật.

## 6. Surface-fix discipline

Trước patch governance file, audit drift:
- Section 5 Summary Table row count match Section 1+2 cumulative claims?
- Update Log v.X bullets exist for every Version header?
- INDEX vs source-of-truth file row counts match?

Drift phát hiện → bundle retroactive fix CÙNG batch hiện tại (KHÔNG defer). Document trong row text: `⭐ NEW Phiên Sx04-X (retroactive insert Phiên Sx04-Y per ER-R2 LAW <section> drift surface-fix)`.

---

**Tóm tắt 1 dòng:** Default patch script với anchor 5-200 chars + verify-before-edit + dry-run + 4-layer defensive validation + bundle surface-fix atomic. Full file chỉ khi NEW emit hoặc change ≥50%.
```

---

## Cách paste vào prompt khởi tạo task

### Format khuyến nghị

```
[paste convention block ở trên]

---

**Task Phiên <X>:**
- Goal: <task description>
- Files target: <list>
- Effort: <estimate>
- Reference: <link to handoff/brief if any>
```

### Ví dụ cụ thể

```
[paste convention block]

---

**Task Phiên Sx04-13 SLICE CLOSE:**
- Goal: T07 E2E Playwright spec 14 mockup states × 19 ACs + final governance batch close slice S-04
- Files target:
  - NEW: apps/web/tests/e2e/intent-03.spec.ts (code file ~ /home/hai-dang/projects/icpp/sicp/)
  - PATCH (5 governance files at ~/Downloads/):
    - INDEX_PROJECT_S-04.md v1.9 → v2.0 (SLICE CLOSE)
    - INDEX_SLICES_S-04.md v1.9 → v2.0
    - INDEX_DECISIONS_S-04.md v1.9 → v2.0
    - S-04_TASKLIST.md v1.10 → v2.0 (T07 row DONE + slice CLOSE marker)
    - S-04_decisions-log.md v1.11 → v2.0 (THIRTEENTH operational entry SLICE CLOSE)
  - PATCH (cross-slice): MASTER_SLICE_BACKLOG.md S-04 row CLOSED
  - NEW deliverables: S-04-T07_e2e-playwright.md + S-04-T07_REPORT.md + S-04-T07_REVIEW.md + S-04_SLICE_CLOSE_REPORT.md
- Effort: ~0.5d planned
- Reference: ~/Downloads/Sx04-13_T07_handoff_prompt.md
```

---

*End of per-task prompt — designed for paste vào đầu mỗi message khi giao task .md emit.*
