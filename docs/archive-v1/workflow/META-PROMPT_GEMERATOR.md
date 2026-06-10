# Meta-Prompt — Generate Handoff Prompt for Code-Execution Session

> **Generated:** 2026-05-24 (Phiên Sx04-8a session)
> **Usage:** Paste meta-prompt block vào bất kỳ phiên review/discover nào sau khi AI đã:
> (a) review docs đầy đủ + clean tài liệu, (b) confirm architecture với human, (c) emit governance patches xong.
>
> Output sẽ là một handoff prompt `.md` file dùng để bắt đầu phiên code tiếp theo.
> AI phiên code đó sẽ KHÔNG cần re-investigate gì — chỉ emit code.

---

## META-PROMPT (paste từ đây xuống tới `END OF META-PROMPT`)

Bạn vừa hoàn thành phiên **review + discover** cho một task ICP. Bây giờ tôi yêu cầu bạn viết một **handoff prompt** chi tiết cho phiên chat tiếp theo (phiên code-execution). AI phiên sau khi nhận prompt này KHÔNG cần re-investigate gì — chỉ cần emit code theo đúng manifest.

### Mục tiêu của handoff prompt

Phiên AI tiếp theo:
1. ACK rules ngay (TASK_OPERATING_SYSTEM Rules + ER-R LAWs hiện tại)
2. Đọc cheat sheet bạn viết (KHÔNG đọc full source code)
3. DECIDE Tier 3 upload (đã có sẵn list)
4. Emit Task Pack → human ACK → emit code → smoke test → Report + Review + INDEX patches atomic

KHÔNG bị stuck ở conflict ảo, KHÔNG phải hỏi human câu hỏi đã được trả lời ở phiên này, KHÔNG phải reverse-engineer architecture.

### Cấu trúc handoff prompt phải có

Output file `<phien_id>_<task_id>_EXECUTION_handoff_prompt.md` với các section sau, theo đúng thứ tự:

#### Section 1: Header + Mục tiêu phiên

- Phiên ID + task ID + date
- 1 đoạn ngắn "Phiên này AI chỉ cần: ACK rules → đọc cheat sheet → DECIDE Tier 3 → emit Task Pack → ACK → emit code → smoke → Report + Review + INDEX"
- Output language directive (Tiếng Việt mix English technical terms per ER-R7)

#### Section 2: Architecture Cheat Sheet

Trước khi đụng code, AI cần hiểu architecture. Bạn phải capture:

**2.1. Production flow diagram (ASCII art):**

```
ComponentA              ComponentB              ComponentC              ResourceShared
─                       ──────                  ──────                  ──────────────
                                                                       key: <namespace>

[step 1 action]
  ─────────────────────► [step 2 action]
                          ────────────────────►  [step 3 action]
                                                  [line ref: file.ext line N]
                          ◄────────────────────  [response]
                         [step 4 action]
  ◄─────────────────────  [response]

[step 5 action]
  ─────────────────────► [step 6 action: subscribe/poll/etc]
                                                                       publish/write data
                                                                       ◄──────  [source]
                          ◄────────────────────────────────────────────  [consumer receives]
  ◄─────────────────────  [forward to original requester]
```

Mỗi step: cite **file path + line number** từ source code thật, không generic.

**2.2. Existing service contracts (đã có sẵn, KHÔNG sửa):**

Với mỗi endpoint/function đã ship phiên trước (T0X DONE):
- File path + line range
- Request shape JSON verbatim
- Response shape JSON verbatim
- Headers (nếu có response headers quan trọng)

**2.3. Pre-approved architecture decisions:**

List D-S04-NN LAW (hoặc cross-slice LAW) liên quan + cite slice decisions-log section + sub-decision number nếu có.

**2.4. ⚠️ Confusion warnings (Dual-mode patterns / Anti-patterns):**

Nếu phiên review này phát hiện AI agent có thể bị confused (như Phiên Sx04-8a phát hiện ER-R9 grep-jump issue), explicit warn:
- Mô tả pattern dễ nhầm
- Cite source code docstring (line range) explaining đúng intent
- Cite decisions-log entry/bullet đã codify lesson
- Reference ER-R9 LAW protocol nếu áp dụng

#### Section 3: Source Code Cheat Sheet — KEEP / REPLACE / DELETE

Đây là phần quan trọng nhất. Với MỖI file Gateway/FE/BE cần modify:

**B<N>. `<file_path>`**

- **Current state (era nào):** Mô tả ngắn baseline đã ship phiên nào, expected behavior
- **What to KEEP:** Liệt kê lines/functions không sửa
- **What to DELETE:** Liệt kê lines/functions xóa
- **What to REPLACE:** Liệt kê lines/functions thay thế + paste old code + new code side-by-side
- **What to ADD (mới):** Code mới, đầy đủ luôn

Format paste code phải syntax-valid TypeScript/Python/whatever — AI phiên sau copy-paste làm khung được luôn.

#### Section 4: Tier attachments lists

**Tier 1 (8 files mandatory):** Master INDEX trio + MASTER_ROADMAP + MASTER_SLICE_BACKLOG + TASK_OPERATING_SYSTEM version mới nhất + bất kỳ TaskPack hiện hành.

**Tier 2 (slice context):** Slice BRIEF + TASKLIST + decisions-log version mới nhất (nếu vừa bump phiên này) + previous task Report (handoff section).

**Tier 3 (source code):** Liệt kê tường tận file paths cần extract từ icp-source.zip. Format:

```
**<Group name> (<N> files):**
- `path/to/file1.ext` (<X> lines)
- `path/to/file2.ext` (<Y> lines)

**Reference only (đọc, không sửa):**
- `path/to/reference.ext` lines X-Y (docstring), Z-W (function impl)
```

**Total: X files emit/modify + Y reference. ~Z LOC inspect.**

#### Section 5: Workflow Phase 2 — 8 Bước

Reuse 8-step Phase 2 Task Execute workflow nhưng customize cho task hiện tại:

**Bước 1 — DISCOVER + DECIDE Tier 3 upload:**
- ACK rules per TASK_OPERATING_SYSTEM acknowledgment workflow
- Đọc Tier 2 decisions-log bullet/sub-decision relevant
- Đọc Tier 2 previous Report handoff section line refs
- DECIDE Tier 3 list (đã có sẵn ở Section 4)

**Bước 2 — Emit Task Pack:**
- File path target: `taskpacks/<task_id>_<short-name>.md`
- **Acceptance Criteria list (AC1, AC2, ...):** Mỗi AC một dòng cụ thể với observable behavior (KHÔNG vague — phải đo được)
- **Files emit manifest:** NEW (n files) + MODIFY (m files), reference Section 3 cheat sheet
- **Stop conditions:** List explicit scenarios khi nào AI phải STOP per Rule 5

**Bước 3 — Code execution (dependency-first order):**
- Order emit: 1. dependency-most → ... → final.
- ER-R1 1:1 cycle reminder

**Bước 4 — Smoke test:**
- Setup commands (docker compose up, etc.)
- Smoke command per AC với expected output verbatim
- Expected output paste verbatim từ previous Report Section 4 (smoke evidence) nếu có
- Log verification commands

**Bước 5 — Implementation Report:**
- File path: `reports/<task_id>_REPORT.md`
- Reference template: previous task Report (cite version)

**Bước 6 — INDEX + decisions-log + TASKLIST sync ATOMIC (Rule 8 LAW):**
- Liệt kê 3-5 INDEX patches cụ thể với version bump (vX → vX+1) + brief change summary
- Conditional: chỉ patch INDEX_DECISIONS nếu có C-S04-NN mới, etc.

**Bước 7 — Review (9 Gates):**
- File path: `reviews/<task_id>_REVIEW.md`

**Bước 8 — Verify 2-chiều (Rule 8.5):**
- Grep commands sanity check
- Expected counts (D-S04-NN, C-S04-NN cumulative)

#### Section 6: Phiên split plan

Nếu task lớn (>5 code files emit), propose chia thành 2-3 sub-phiên với handoff prompts.

#### Section 7: Rules summary

Liệt kê các Rules + ER-R relevant cho task (Rule 1, Rule 4, Rule 5, Rule 7, Rule 8, ER-R1, ER-R2, ER-R3, ER-R9 if applicable).

#### Section 8: Repo info + Final directives

- Repo path
- Latest TASK_OPERATING_SYSTEM version
- Service ports + image versions (nếu liên quan)
- Final line: "Bắt đầu Bước 1 — ACK [latest ER-R] LAW trước. KHÔNG hỏi câu hỏi về [topic đã clarified]. Nếu vẫn confused, đọc [pointer to specific bullet/section in decisions-log]."

---

### Strict requirements cho output handoff prompt

1. **NO suy luận** — mọi line ref, code snippet, AC criteria phải được verify từ source code thật bằng view/grep tool trong phiên này. Nếu chưa verify, STOP + verify trước khi viết.

2. **NO generic placeholder** — tránh "X", "Y", "the appropriate function". Phải cite file path + line cụ thể.

3. **NO copy từ outdated previous Task Pack** — Task Pack phiên trước có thể stale; phải re-derive AC từ current state docs.

4. **Code snippets phải syntax-valid** — AI phiên sau copy-paste ra IDE phải compile được hoặc gần được.

5. **Length budget:** Output file khoảng 600-1500 lines markdown. Quá ngắn = thiếu detail; quá dài = AI phiên sau overflow context. Aim 800-1000 lines.

6. **Filename pattern:** `<phien_id>_<task_id>_<phase>_handoff_prompt.md` 
   - Ví dụ: `Sx04-8b_T03_EXECUTION_handoff_prompt.md`, `Sx05-2_T01_DISCOVER_handoff_prompt.md`

7. **Output via create_file tool** vào `/mnt/user-data/outputs/`. NOT inline trong message.

### Pre-flight checklist trước khi viết handoff prompt

Trước khi gọi create_file tool, verify đã có đủ thông tin:

- [ ] Architecture diagram đã có line refs cụ thể từ source code (đã chạy view/grep)
- [ ] Service contracts request/response JSON shapes đã verify từ source (không suy luận)
- [ ] Pre-approved decisions list đã cite section + sub-decision number trong decisions-log
- [ ] Confusion warnings (nếu có) cite cụ thể docstring lines + bullet ở decisions-log
- [ ] Source code cheat sheet KEEP/DELETE/REPLACE đã chỉ rõ line numbers + functions
- [ ] AC criteria đã cụ thể (observable, measurable) — KHÔNG vague
- [ ] Smoke commands đã verify chạy được (hoặc copy từ previous Report)
- [ ] Expected smoke output đã paste verbatim
- [ ] Files emit manifest đã đếm cụ thể NEW + MODIFY count
- [ ] Tier 3 list đã có line counts cho từng file (để AI phiên sau ước lượng upload size)
- [ ] Rules summary chỉ reference các Rules thực sự áp dụng (không spam)

Nếu BẤT KỲ checkbox nào chưa tick, STOP và đi chạy view/grep verify trước.

### Bắt đầu

Khi tôi tag "**OK, viết handoff prompt cho phiên sau**", bạn:

1. Liệt kê pre-flight checklist + tick status từng item
2. Nếu có item chưa tick: chạy view/grep tool verify từng item missing
3. Khi đủ checklist: gọi create_file emit handoff prompt theo cấu trúc 8 sections trên
4. Cuối cùng: present_files + brief summary (file path + line count + 1-2 dòng tóm tắt)

KHÔNG hỏi clarification trừ khi thật sự cần (vd: task ID, phiên ID kế tiếp). Architecture + decisions đã được clarified ở phiên này, dùng context đã có.

### END OF META-PROMPT

---

## Sử dụng meta-prompt này

### Bước 1: Cuối phiên review/discover (như phiên Sx04-8a hiện tại)

Sau khi AI đã:
- Audit docs đầy đủ
- Phát hiện + resolve conflicts với human 1:1
- Emit governance patches (decisions-log + TASK_OPERATING_SYSTEM + INDEX patches)

Paste block "META-PROMPT" ở trên (từ "Bạn vừa hoàn thành" tới "END OF META-PROMPT") vào chat.

### Bước 2: Tag "OK, viết handoff prompt cho phiên sau"

AI sẽ:
1. Run pre-flight checklist
2. Verify missing items bằng view/grep
3. Emit handoff prompt file via create_file
4. present_files

### Bước 3: Save file + dùng cho phiên code

- Download handoff prompt từ outputs
- Mở chat phiên mới
- Paste handoff prompt + upload Tier 1 + Tier 2 attachments
- AI phiên code bắt đầu Bước 1 với architecture đã clarified

---

## Ví dụ usage thực tế (từ Phiên Sx04-8a)

**Context:** Phiên Sx04-8a vừa emit 2 governance patches (TASK_OPERATING_SYSTEM v3.1 + decisions-log v1.8). T03 EXECUTION sẽ là phiên Sx04-8b.

**User input:** Paste meta-prompt → tag "OK, viết handoff prompt cho phiên Sx04-8b T03 EXECUTION"

**AI output:** Tạo file `/mnt/user-data/outputs/Sx04-8b_T03_EXECUTION_handoff_prompt.md` với:
- Section 1: Sx04-8b T03 header
- Section 2: ASCII diagram FE↔Gateway↔AI↔Redis với line refs `apps/ai/src/main.py` line 410/450/466-475/473
- Section 3: 11 file Gateway KEEP/DELETE/REPLACE specs với TypeScript snippets
- Section 4: Tier 1+2+3 attachments (8 + 4 + 11 files)
- Section 5: 8 Bước Phase 2 customize cho T03
- Section 6: 3-phiên split plan nếu overflow
- Section 7: Rules summary
- Section 8: Repo info + final directive

Length: ~1100 lines markdown.

---

## Lưu ý quan trọng

- Meta-prompt này **không tied to S-04** — dùng được cho mọi slice + task tương lai (S-05 T03, S-07 T02, etc.)
- Mỗi lần dùng, AI sẽ re-verify từ source code thực tế — KHÔNG copy mù từ phiên trước
- Quality của handoff prompt phụ thuộc vào quality của phiên review trước đó — nếu phiên review chưa clarify đủ, handoff prompt sẽ thiếu thông tin
- Khi nâng cấp workflow (vd thêm Bước 9, đổi Tier scheme), update meta-prompt này ở chỗ template tương ứng


## Phiên context — File system layout LAW (anh strict-enforce)

**Convention bắt buộc cho mọi turn của phiên này và chỉ áp dụng với tất cả các file .md:**

1. **`.md` docs (governance + spec + report + INDEX)** ALL ở `~/Downloads/` flat — KHÔNG subfolder. Path không carry semantic; **chỉ filename là canonical identifier**. Ví dụ:
   - `S-04_decisions-log.md`, `S-04_TASKLIST.md`, `INDEX_DECISIONS_S-04.md`, `03_API_CONTRACTS.md`, `LOG_CATALOG.md` ... ALL live ở `/home/hai-dang/Downloads/<filename>.md`
   - Đừng emit code with `slices/S-04_decisions-log.md` hay `docs/03_API_CONTRACTS.md` — đó là **suy luận sai về path**

2. **Code files** (apps/, packages/, infra/) → `~/projects/icpp/sicp/` THEO ĐÚNG cấu trúc thư mục — path subfolder CARRY semantic. Ví dụ:
   - `~/projects/icpp/sicp/apps/gateway/src/intent/intent.controller.ts`
   - `~/projects/icpp/sicp/packages/shared-types/src/sse/intent-stream.ts`
   - Đừng nhầm code file với .md doc

3. **Emit format quyết định theo file size + change footprint:**
   - **File ≤ 200 LOC** hoặc **≥ 30% lines change** → emit full file (download + copy/paste workflow)
   - **File ≥ 200 LOC** AND **< 30% lines change** AND **≥ 2 anchor points unique-verifiable** → emit Python **patch script** với defensive validation:
     - Đọc file → validate every anchor exists + is unique
     - Apply patches in-memory
     - Post-verify grep counts (min/max bounds)
     - Backup original to `.bak-<phiên>` extension
     - Atomic write (only if all checks PASS); exit code 1 + stderr nếu bất kỳ check nào fail
   - Quyết định emit format phải state explicit reasoning ở turn của Claude (vd: "File 1639 LOC, change ~12%, 7 anchor points all unique → emit patch script tiết kiệm ~40K tokens")

4. **Verify-before-edit (ER-R2 LAW áp dụng nghiêm)**: Mọi patch script bắt buộc:
   - Trước emit script: dùng `view`/`grep`/`sed -n` để đọc EXACT anchor strings hiện có trong file target
   - Tuyệt đối KHÔNG copy anchor string từ memory hay từ phiên trước — phải re-verify mỗi phiên
   - Script phải dry-run được trên file copy trước khi apply lên file thật

5. **Output emit cho patch script workflow:**
   - Tên file: `apply-<phiên>-batch-<N>.py` (vd `apply-batch-1.py`)
   - Mặc định DOCS_DIR hardcoded = `/home/hai-dang/Downloads` (KHÔNG path biến); user chỉ cần `python3 ~/Downloads/<script-name>.py` chạy từ bất kỳ pwd
   - Đầu script comment block ghi rõ Phiên + Files target + Number of sub-patches per file
   - Script tự emit summary cuối: "✅ Batch N atomic patch COMPLETE" hoặc "❌ FATAL: <reason>"

**Anh kỳ vọng Claude phiên này tuân thủ ER-R10 LAW (xem TASK_OPERATING_SYSTEM v3.2 nếu đã apply).**