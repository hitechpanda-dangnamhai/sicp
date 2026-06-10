# ICP Workflow v2 — WORKING DRAFT (bản bàn luận)

> **Version:** 2.1-WORKING — KHÔNG PHẢI FINAL. Tổng hợp mọi quyết định đã chốt qua thảo luận
> 2026-06-10, chia SECTION đánh số để bàn tiếp từng phần (quy ước: mỗi turn 1 vấn đề).
> **Trạng thái per section:** ✅ ĐÃ CHỐT (đã duyệt qua thảo luận) · 🔶 CẦN BÀN (chưa chốt / chưa bàn).
> **Supersedes (khi final):** ICP_WORKFLOW_FINAL.md v1.3 (HPSD) + ICP_SESSION_GUIDE.md.
> **Sổ vấn đề mở:** xem §99 cuối file.

---

## §01 — Nguyên tắc nền: PUSH tối thiểu, PULL mặc định ✅

Tri thức triển khai ("hệ thống hoạt động thế nào") có đúng MỘT nơi ở thật: **code**.
Nó được TRUY XUẤT khi cần (PULL), không CHÉP SẴN để dành (PUSH).

**Chỉ PUSH 3 thứ code không tự nói được:**

| Thứ | Vì sao code không nói được | Nhà |
|---|---|---|
| Ý định & lý do (phương án đã loại, trade-off) | Code chỉ chứa kết quả, không chứa con đường | `decisions/ADR-0XX.md` |
| Trạng thái & kế hoạch (xong gì, kế tiếp gì) | Code không biết tương lai | `MASTER_BACKLOG.md` |
| Ảnh chụp tổng quan (đếm/liệt kê hiện trạng) | Đọc được nhưng đắt — nên chụp sẵn BẰNG MÁY | `FACTS.md` (gen-facts.sh) |

**Mọi thứ khác = PULL.** Hệ quả đã chốt: KHÔNG notes/, KHÔNG handoff log, KHÔNG bảng
ownership — không tồn tại bất kỳ "sổ sách" nào cần người duy trì. Mọi cấu trúc từng đề
xuất thuộc loại này đã bị bác vì cùng một gen bệnh: sổ lệch thực tế = docs stale (căn
bệnh gốc của dự án).

**Tiêu chí thiết kế bất biến (dùng để xét mọi đề xuất tương lai):**
ZERO trạng thái quản trị — nếu giải pháp đòi hỏi một bảng/sổ/biến đếm mà con người hoặc
AI phải nhớ cập nhật, giải pháp đó SAI, tìm cách khác.

---

## §02 — Phân vai 3 bên + cầu nối ✅

| Bên | Tầng | Làm | Cấm |
|---|---|---|---|
| **Human** | Quyết định | Chốt priority, duyệt design, review diff, là "người đưa thư" PULL | Sync docs thủ công (việc của máy) |
| **Claude Web** (Project ICP) | Plan: Roadmap→Slice→Task cut | Tranh luận, RECON/PULL request, đề xuất design, viết S-XX.md, draft ADR | Khẳng định trạng thái code không cite được context; tự quyết thay human |
| **Claude Code** (VSCode) | Execute: Task→Code | RECON/PULL trả lời, implement, test, commit chuẩn, update FACTS+BACKLOG | Tự quyết kiến trúc (Rule 5) |

**Cầu nối Web↔Code = 2 kênh:**
- **FACTS.md** (máy sinh): trạng thái tĩnh, luôn nằm trong Project knowledge.
- **PULL/RECON** (on-demand): tri thức triển khai, human paste 2 chiều, ~2 phút/vòng.

**Context pack chuẩn của 1 phiên Web** (Project knowledge): `00_CONTEXT` (đã prune) +
`FACTS.md` + `MASTER_BACKLOG.md` + `decisions/INDEX.md` ≈ 400–500 dòng — KHÔNG ĐỔI
theo quy mô dự án (50 hay 2000 slice như nhau).

---

## §03 — Luật định tuyến tri thức (Claude Web dùng nguồn nào) ✅

| Loại câu hỏi | Nguồn | Ví dụ |
|---|---|---|
| TẠI SAO (lý do, quyết định) | ADR | "Sao chọn VNPay+Momo+ZaloPay?" → ADR-038 |
| TRẠNG THÁI (xong chưa, kế tiếp) | BACKLOG | "Payment code chưa?" |
| TỒN TẠI GÌ (đếm, liệt kê, tên) | FACTS | "Có mấy migration? Có profile `personalized` chưa?" |
| HOẠT ĐỘNG THẾ NÀO (cấu trúc, hành vi, chi tiết) | **PULL** | "Cart tính total kiểu gì, cache không?" |
| NÊN LÀM GÌ (chưa ai quyết) | Bàn trong phiên plan → chốt → ADR mới | "RLS dùng GUC hay policy per-table?" |

**Phép thử 1 câu cho Web:** "Câu trả lời có nằm NGUYÊN VĂN trong context (FACTS/BACKLOG/ADR)
không?" Có → dùng + cite dòng. Không + thuộc loại HOW → BẮT BUỘC phát PULL, CẤM suy đoán.

**2 cơ chế ép tuân thủ:**
1. **Vật lý:** context Web CHỈ chứa FACTS/BACKLOG/ADR — không có nguyên liệu để bịa.
2. **Project instructions** (custom instructions của Project ICP trên claude.ai): luật trên
   viết thành văn, mọi phiên tự mang theo. *(Nguyên văn instructions: 🔶 §99-d.)*

---

## §04 — Template PULL & RECON ✅

**PULL (hỏi–đáp, khi Web biết câu hỏi cụ thể):**
```
📥 PULL #N — paste vào Claude Code:
"Đọc-only, không sửa gì. Trả lời ≤30 dòng, kèm path file cho mỗi ý:
(a) <câu hỏi cụ thể 1>
(b) <câu hỏi cụ thể 2>
Nếu không tìm thấy: nói 'KHÔNG TÌM THẤY', không đoán."
```

**RECON (khảo sát, mở đầu MỌI phiên plan slice — giải bài toán unknown-unknowns):**
```
📥 RECON — paste vào Claude Code:
"Đọc-only. Mục tiêu slice sắp plan: <mô tả>.
Khảo sát repo + git log + migrations, báo cáo ≤60 dòng, kèm path:
1. Những gì ĐÃ TỒN TẠI liên quan mục tiêu (bảng, route, tool, graph, type)
2. Pattern/constraint đang dùng mà thiết kế mới PHẢI tuân theo
3. Liên quan nhưng thiếu / dở dang / mâu thuẫn
4. ⭐ Những điều người plan CẦN BIẾT mà có thể KHÔNG NGHĨ TỚI để hỏi
Không tìm thấy thì nói KHÔNG TÌM THẤY, cấm đoán."
```

Nguyên lý mục 4: gánh nặng "hỏi cho đủ" chuyển từ kẻ mù (Web) sang kẻ sáng mắt (Code).
RECON mở bản đồ, PULL khoan giếng. Kết quả RECON/PULL nhúng vào section Evidence của
S-XX.md = ảnh chụp evidence tại thời điểm plan (giá trị lịch sử, không cần bảo trì).

---

## §05 — Slice: định nghĩa & vòng đời ✅

- **Slice = danh tính VĨNH VIỄN của 1 tính năng** (vertical), không phải đơn vị công việc
  dùng-một-lần. Slice mở lại được suốt đời dự án.
- Công việc trên slice = **EPISODE**: `BUILD` (lần đầu) · `HOTFIX-NN` · `REFACTOR-NN`.
- **KHÔNG có lối tắt ngoài slice.** Hotfix/refactor vẫn vào qua Web → Web tạo task episode
  (nhẹ: mini-RECON nếu cần + 1 task spec vài dòng, KHÔNG cần full Pha A) → Code thực thi →
  BACKLOG ghi 1 dòng episode. Nguyên tắc: **không commit nào vô hình với Web.**
- Hạ tầng/nền tảng cũng là slice (đã có sẵn: S-01 UI Foundation, S-02 Runtime Foundation…)
  — không cần phân loại đặc biệt (xem §06).

## §06 — Slice sở hữu Ý ĐỊNH, không sở hữu FILE ✅

Quan hệ file↔slice vốn là NHIỀU-NHIỀU — không ép về một-một, không lập bảng chủ quyền.

1. **File thuộc repo.** Slice nào cũng được sửa file chung NẾU thêm trong khuôn contract
   sẵn có (thêm event type, thêm log entry, thêm route theo pattern). Không xin phép,
   không tag đặc biệt — commit chuẩn (§09) là đủ dấu vết.
2. **Đổi contract/schema/behavior vùng chung = Rule 5 STOP** → báo human → Web quyết
   (thường = episode phối hợp, plan riêng).
3. **Máy gác biên, không phải bản đồ:** test + CI + generated types chặn vỡ chéo tại PR.
   Sửa file chung làm đỏ test slice khác → CI chặn → người sửa tự xử trước khi merge.
4. **Bug định tuyến theo TRIỆU CHỨNG, không theo file:** "voice buy lỗi" → episode S-08,
   bất kể bản vá nằm ở file chung nào. Bug thuần hạ tầng → episode của slice khai sinh
   (git log --diff-filter=A trả lời "ai khai sinh" trong 1 giây).
5. **Entropy file chung:** khi RECON báo tín hiệu lộn xộn ("8 slice từng đắp file này") →
   Web đề xuất REFACTOR episode, human duyệt. Phản ứng theo tín hiệu, không tuần tra.

**Khuyết điểm đã nhìn nhận + giảm nhẹ:**
- ① Mô hình đứng trên chất lượng TEST; vùng code cũ (hackathon) lưới mỏng → rủi ro vỡ âm
  thầm giai đoạn đầu, teo dần nhờ DoD ép test mọi task mới. *(Biện pháp đỡ riêng: 🔶 §99-c.)*
- ② Không ai "chăm" file chung → entropy; đỡ bằng REFACTOR episode (độ trễ chấp nhận được).
- ③ Ranh giới "thêm trong khuôn" vs "đổi contract" cần phán đoán; lọt phải chui qua 3 lớp
  (openapi:sync + types compile + human review).

---

## §07 — Pha A: PLAN (Claude Web) — RECON → DESIGN → TASK CUT ✅

```
A0 — RECON: Web phát lệnh khảo sát (§04) → Code báo cáo → Web đứng trên evidence
A1 — DESIGN: Web đề xuất kiến trúc / application workflow (1–3 phương án + trade-off,
     sinh TỪ evidence A0, không từ chân không) → ★ HUMAN DUYỆT — cổng cứng.
     (Human không biết làm → Web phải đưa gợi ý chuẩn — chuẩn VÌ có A0.)
A2 — TASK CUT: chỉ sau khi design duyệt → cắt task theo §08
A3 — Output: slices/S-XX.md (template §11) — goal + design ĐÃ DUYỆT + evidence + tasks
     → human save vào repo, commit "META: plan S-XX"
```
*(Template format cho DESIGN proposal A1: 🔶 §99-e.)*

## §08 — Pha B: EXECUTE — chuẩn cắt & chạy task ✅

**Chuẩn big task:** 3–5 task/slice; task = 1 lát dọc con có nghĩa; kết thúc ở trạng thái
review được 1 lần ngồi (test xanh, diff đọc nổi; ước >~1.500 dòng diff → cắt đôi).

**3 quy tắc cắt task (chống "task sau không ráp được task trước"):**
1. **T01 = contract-as-code:** migration + OpenAPI paths + generated types + endpoint stub
   chạy được. Contract là thứ compiler nhìn thấy từ commit đầu — FE code trên client
   generate từ openapi.json THẬT; lệch contract = lỗi compile, không phải bất ngờ runtime.
2. **Task sau = lát dọc con end-to-end, CHẠY ĐƯỢC khi đóng** (BE thật + FE wire +
   integration test của luồng đó). KHÔNG cắt theo tầng (hạ tầng/BE/FE/test) — cắt tầng =
   điểm ráp nối không thuộc task nào = rủi ro dồn về cuối.
3. **Test KHÔNG phải task riêng** — test là 1 dòng DoD của MỌI task. "Task test cuối slice"
   = thú nhận các task trước được phép không-chạy-được.

**Nghi thức chạy task (Claude Code):**
```
B1. MỞ TASK: git log --oneline (slice) + đọc diff các task trước + đọc lại acceptance
    S-XX.md — "đã có gì" lấy từ REPO tại giây đó, không từ doc/trí nhớ
B2. Implement (commit nháp tuỳ ý)
B3. Report bắt buộc: files changed + command output + test + known issues
    Gặp Stop Condition (Rule 5) → DỪNG, báo human
B4. Human review diff → duyệt → SQUASH về 1 commit chuẩn (§09) → merge
```
*(Chi tiết human review B4 — checklist, độ sâu: 🔶 §99-f. Branch/PR strategy: 🔶 §99-g.)*

## §09 — Luật commit ✅

**Nguyên tắc hạt: 1 commit = 1 ý định trọn vẹn = 1 task** (squash khi đóng task — máy làm,
không ai đếm). 10 lần sửa 1 file trong 1 task → tự dồn 1 commit; 10 lần qua 10 slice →
10 commit, và thế là ĐÚNG (10 ý định khác nhau, dồn = mất thông tin).
"File hiện trọn vẹn là gì" → đọc FILE (bản dồn hoàn hảo, git duy trì). "Dòng này vì sao
tồn tại" → git blame → commit message → slice ID → ADR.

**Taxonomy 4 loại (đóng):**
```
S-XX/T0N: <làm gì, 1 dòng>                          ← đóng task (sau squash)
  body: quyết định ngầm · ADR-0XX ref · breaking? KHÔNG/CÓ+lý do
S-XX/HOTFIX-NN: <triệu chứng> — <nguyên nhân gốc>
S-XX/REFACTOR-NN: <phạm vi> — behavior KHÔNG đổi
META: <docs|workflow|facts|ci>: <gì>
```

**Ép bằng máy:** luật trong CLAUDE.md (Code đọc trước mọi task) + commit-lint CI
(regex prefix, sai định dạng = fail).

**Trầm tích cho RECON (3 lớp, đóng task/slice phải để lại):**
1. Commit message chuẩn (chỉ mục thời gian git grep được)
2. Comment tại chỗ cho quyết định KHÔNG hiển nhiên (vd `// không cache — giá realtime, ADR-0XX`)
3. ADR cho quyết định cấp kiến trúc

## §10 — Pha C: CLOSE + Pha D: SYNC ✅

```
C1. bash scripts/gen-facts.sh → FACTS.md mới
C2. Sửa MASTER_BACKLOG.md: 1 dòng status (+1 dòng episode nếu hotfix/refactor)
C3. Draft ADR (nếu có) → decisions/ + cập nhật INDEX.md
C4. mv slices/S-XX.md → slices/archive/   (BUILD episode; hotfix không có file riêng)
C5. Commit "META: close S-XX" → push
D1. Human thay FACTS + BACKLOG trong Project knowledge (30 giây) → phiên plan sau tự có
```

---

## §11 — Single Home map & cấu trúc repo ✅

```
icp/
  CLAUDE.md                  ← luật cho Claude Code (🔶 nội dung đầy đủ: §99-d)
  docs/
    00_CONTEXT.md            ← hiến pháp, đã prune (~150 dòng)
    FACTS.md                 ← ★ MÁY SINH — cấm sửa tay
    MASTER_BACKLOG.md        ← ★ GỘP roadmap+backlog (quyết định #3):
                               §1 Direction (~40 dòng: 7 phase + dependency + critical path)
                               §2 Active slices (ID|tên|phase|status|episode log)
                               §3 Queue P0→P1→P2 (1 dòng/item + ADR ref)
                               §4 Done gần đây | cũ → BACKLOG_ARCHIVE.md
    decisions/INDEX.md + ADR-0XX.md   ← mỗi ADR 1 file; ADR KHÔNG chứa status triển khai
    specs/                   ← WHY còn lại của 01–09 (sau khi di cư: liệt kê→FACTS/contracts,
                               status→BACKLOG) (🔶 phạm vi prune chi tiết: §99-h)
    contracts/               ← openapi.json + generated — cấm sửa tay
    slices/S-XX.md + archive/
  scripts/gen-facts.sh
```

| Fact | Nhà duy nhất |
|---|---|
| Status + episode log | MASTER_BACKLOG.md |
| Hiện trạng code/DB | FACTS.md |
| Quyết định + lý do | decisions/ADR-0XX.md |
| Contract | contracts/ (generated) |
| Tri thức triển khai | **CODE** (truy xuất qua PULL/RECON) |
| MASTER_ROADMAP.md cũ | ☠ khai tử trong S-META-02 (di cư 3 hướng như trên) |

## §12 — FACTS.md spec ✅

Sinh bởi `scripts/gen-facts.sh` (~2 giây), commit vào repo, ~100–150 dòng.
Nội dung tối thiểu: migrations (ls) · routes per controller (grep decorator) · graphs (ls)
· MCP tools (grep register) · DB tables/matviews/cột tenant_id (information_schema; DB tắt
→ fallback parse migrations, đánh dấu nguồn) · Vespa rank-profiles (grep product.sd) ·
workers (ls) · Kafka wire (grep import).
3 vai trò: context Web · CI drift gate (diff với bản committed, lệch = FAIL) · evidence gốc.

## §13 — Production DoD ("PRODUCTION DoD IS LAW") ✅

Mọi task chạm code phải pass (N/A ghi rõ lý do):
- [ ] Tenant-scoped (sau V011): tenant_id/RLS + isolation test nếu đụng data path
- [ ] I/O ngoài có timeout; retry/breaker nơi gọi VNPay/Momo/Vespa/LLM
- [ ] OTel span + log đúng LOG_CATALOG (entry mới nếu phát sinh)
- [ ] Test: unit cho logic + ≥1 integration cho luồng — NHÚNG trong task (§08)
- [ ] Migration forward-only + rollback note + số kế tiếp theo FACTS
- [ ] Không log PII; secret qua env; input validate
- [ ] Idempotency nơi side-effect lặp được (IPN, webhook, consumer)
- [ ] Docs: chỉ sửa đúng Single Home (BACKLOG 1 dòng + ADR nếu có quyết định)

## §14 — Bảy Rules v2 ✅ (đã cập nhật theo mọi quyết định)

1. **Human owns priority** — AI propose, human approve (cổng A1 + B4).
2. **Single Home + Zero Administration** — mỗi fact 1 nhà; cấm mọi sổ sách cần người duy trì.
3. **Evidence phải cite được** — Web: cite FACTS/BACKLOG/ADR hoặc phát PULL, cấm đoán.
   Code: grep trước khi khẳng định, cấm tin doc.
4. **Every task reviewable** — files + output + test + known issues; squash 1 commit chuẩn.
5. **STOP conditions** — đổi schema ngoài scope / dependency mới / đổi contract vùng chung
   / đổi pattern LOCKED → DỪNG, báo human.
6. **PRODUCTION DoD IS LAW** (§13) — thay MOCKUP IS LAW.
7. **Evidence hierarchy:** (1) DB/code đang chạy = FACT → (2) ADR mới nhất = INTENT →
   (3) contracts generated → (4) specs → (5) mockup = tham khảo UX.
   FACT ≠ INTENT không phải conflict — là work item.

## §15 — CI gates ✅
1. gen-facts.sh → diff FACTS.md → lệch = FAIL
2. openapi:sync drift check
3. commit-lint (taxonomy §09)
4. lint --max-warnings 0 + tsc --noEmit
5. test suite (+ coverage threshold về sau)

## §16 — Bootstrap ✅ (thứ tự cố ý: phải có FACTS trước khi đụng docs)

- **S-META-01 — Workflow & FACTS bootstrap:** gen-facts.sh + FACTS đầu tiên (verify mắt)
  + CLAUDE.md + cấu trúc thư mục §11 + CI gates + Project ICP trên claude.ai (knowledge
  + instructions). Lock workflow này khi các 🔶 đã chốt → ADR-045.
- **S-META-02 — Docs normalization:** tách DECISIONS.md → decisions/; gỡ "trạng thái triển
  khai" khỏi ADR-040..044 (→BACKLOG); khai tử MASTER_ROADMAP (di cư 3 hướng); prune
  00_CONTEXT; phase docs gỡ status; archive workflow v1.3 + SESSION_GUIDE.
- Sau đó: **S-P0-01 Multi-tenant** (V011 — đã chốt đi TRƯỚC Payment).

---

## §99 — SỔ VẤN ĐỀ MỞ 🔶 (bàn từng turn, đánh dấu khi chốt)

**ĐÃ CHỐT trong phiên 2026-06-10 (chuyển lên thân doc / playbook v2.2):**
- ~~d~~ ✅ Nguyên văn CLAUDE.md (file thật ở root repo) + Project instructions (PLAYBOOK R0.3)
- ~~h~~ ✅ Hoà tan docs: bảng số phận + quy trình VERIFY-TRƯỚC-ROUTE-SAU (PLAYBOOK R0.2). Kết quả: 3 file viết-tay (CONTEXT+MAP ≤250 dòng, LOG_CATALOG, CLAUDE.md) + máy sinh + ADR + BACKLOG
- ~~i~~ ✅ Phase = nhãn nhóm trong BACKLOG §1, phases/ archive sau hoà tan
- **MỚI ✅ §17 S-AUDIT:** slice vĩnh viễn audit docs, nhịp 10-slice-đóng hoặc 1 tháng; gác claim văn xuôi mà CI không gác được (PLAYBOOK R8)
- **MỚI ✅ §18 Slice lịch sử:** KHÔNG viết lại brief/tasklist cho slice hackathon cũ — chỉ đăng ký danh tính vào BACKLOG; tri thức tái dựng qua RECON on-demand khi slice được đụng tới
- (c) một nửa: characterization test BẮT BUỘC trước khi refactor vùng chưa có test (PLAYBOOK R6)

| # | Vấn đề CÒN MỞ | Ghi chú |
|---|---|---|
| a | **Hotfix khẩn cấp** | Đề xuất "fix thẳng trên Code + đăng ký hồi tố 24h" nhúng ở PLAYBOOK R5 — chờ duyệt |
| b | **Contract-as-code cho thứ KHÔNG phải REST** | MCP tools, Kafka events, LangGraph state, Vespa schema — T01 "contract trước" áp thế nào |
| c | **Chiến lược test chủ động cho code cũ** | Ngoài characterization-khi-refactor: có cần chiến dịch phủ lưới P0-path trước go-live không |
| e | **Template DESIGN proposal (A1)** | Format 1–3 phương án + trade-off + cách human duyệt nhanh |
| f | **Human review B4** | Checklist review diff; review sâu tới đâu khi diff lớn |
| g | **Branch/PR strategy** | Trunk-based hay branch per task/slice; squash-merge mechanics |
| j | **Multi-dev tương lai** | Thêm dev thứ 2 thì vai trò/quyền đổi gì |
| k | **Failure modes** | Code làm sai giữa task; RECON sai; FACTS gate đỏ liên tục — quy trình phục hồi |

---
**END WORKING DRAFT v2.1** — bàn tiếp theo §99, mỗi turn 1 mục. Khi §99 rỗng (hoặc các mục
còn lại được chấp nhận hoãn) → đổi FINAL + ADR-045 + bắt đầu S-META-01.
