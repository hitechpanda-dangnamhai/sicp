# ICP PLAYBOOK v2.2 — Sách thao tác (prompt chuẩn 5 lớp)

> **Companion của:** ICP_WORKFLOW_V2 (luật). PLAYBOOK = thao tác + prompt nguyên văn.
> **Chuẩn prompt 5 lớp** (mọi prompt trong file này tuân theo):
> ① BỐI CẢNH (agent cần biết gì) → ② VIỆC (bước đánh số) → ③ RÀNG BUỘC (cấm gì, luật nào)
> → ④ FORMAT OUTPUT (bắt buộc, để review nhanh + paste chéo surface) → ⑤ XỬ LÝ THẤT BẠI.
> Chỗ `<...>` = bạn điền. Mọi prompt copy-paste nguyên khối.

---

## BẢNG TRA NHANH

| Tình huống | Ở đâu | Công thức |
|---|---|---|
| Bắt đầu từ trạng thái stale (1 lần) | Code → Web | **R0** |
| Ý tưởng/việc mới → backlog | Web | **R1** |
| Mở slice mới | Web ⇄ Code | **R2** |
| Chạy 1 task | Code | **R3** |
| Đóng slice | Code + 30s tay | **R4** |
| Bug → hotfix | Web → Code | **R5** |
| Dọn code → refactor | Web → Code | **R6** |
| Hỏi nhanh giữa lúc plan | Web → Code → Web | **R7** |
| Audit docs định kỳ (chống stale tái phát) | Code → human duyệt | **R8** |

Nhịp dùng thực tế: R2 → (R3 lặp) → R4 là vòng chính. R5/R6 khi cần. R8 mỗi 10 slice
đóng HOẶC mỗi tháng (đến trước tính trước). R0 đúng 1 lần.

---

# R0 — BOOTSTRAP (1 lần): từ docs stale → hệ v2

Thứ tự CỨNG: **R0.1 dựng nền → R0.2 hoà tan docs → R0.3 dựng Project Web.**
Lý do thứ tự: hoà tan docs đòi verify với code → cần FACTS làm mỏ neo → FACTS phải có trước.

## R0.1 — Dựng nền (Claude Code, ~1 buổi)

> Đã làm sẵn cho bạn (kèm bộ giao file này): `scripts/gen-facts.sh` (đã chạy thử trên
> repo thật, FACTS.md đầu tiên sinh được 112 dòng) + `CLAUDE.md`. Việc còn lại:

**Prompt R0.1-a — cài nền:**
```
[BỐI CẢNH] Repo ICP đang chuyển sang Workflow v2 (docs/ICP_WORKFLOW_V2.md nếu đã có).
Tôi đã đặt sẵn: scripts/gen-facts.sh và CLAUDE.md ở root.

[VIỆC]
1. Tạo thư mục: docs/{decisions,specs,contracts,slices/archive} docs/archive-v1
2. Chạy: bash scripts/gen-facts.sh — xác nhận docs/FACTS.md sinh ra, đưa tôi xem nguyên văn.
3. Đối chiếu FACTS với hiểu biết của anh về repo (grep kiểm tra xác suất 3 mục bất kỳ).
4. Thêm GitHub Actions workflow .github/workflows/guards.yml gồm 2 job:
   a. facts-drift: chạy gen-facts.sh rồi `git diff --exit-code docs/FACTS.md`
      (bỏ qua dòng header timestamp khi diff — dùng `grep -v '^# FACTS — generated'`)
   b. commit-lint: check commit message của PR theo regex (taxonomy v3 —
      slice id cho phép prefix chữ + nhiều đoạn: S-P0-01, S-META-02, S-AUDIT):
      ^(S-[A-Z0-9]+(-[A-Z0-9]+)*\/(T\d+|HOTFIX-\d+|REFACTOR-\d+)|META): .+
5. Commit từng bước riêng: "META: facts: gen-facts script + first FACTS",
   "META: ci: facts-drift + commit-lint guards".

[RÀNG BUỘC] Không sửa code sản phẩm. Không sửa FACTS.md bằng tay.
[OUTPUT] Sau mỗi bước: lệnh đã chạy + output. Cuối: danh sách file mới + nội dung FACTS.md.
[THẤT BẠI] Cấu trúc repo lệch giả định của script (path không tồn tại) → DỪNG, báo path
nào lệch, đề xuất sửa script, CHỜ tôi duyệt mới sửa.
```

**Human verify (không bỏ qua):** mở FACTS.md, đối chiếu 3–5 con số bạn biết chắc
(6 graph? V010? 0 tenant_id? 37 MCP tool?). Khớp → R0.2. Lệch → sửa script trước.
*(Lần chạy thật đầu tiên đã bắt được 1 drift: ROADMAP ghi 8 controller, code thật = 10.)*

## R0.2 — Hoà tan docs (Claude Code) — VERIFY TRƯỚC, ROUTE SAU

> Nguyên tắc: docs cũ trộn sự thật + sự dối. KHÔNG mảnh nào vào nhà mới khi chưa qua
> cửa verify. Mỗi file 1 prompt → 1 report → bạn duyệt → mới ghi. File gốc không xoá —
> mv vào docs/archive-v1/.

**Bảng số phận (route đích cho từng loại nội dung):**

| Loại mảnh | Verify bằng | Route |
|---|---|---|
| Liệt kê hiện trạng (route/bảng/tool/version...) | — | XOÁ (FACTS/contracts gánh) |
| Status (DONE/CHƯA CODE...) | — | XOÁ (BACKLOG gánh, nguồn từ FACTS) |
| Luật/convention | grep code thật có tuân không | ĐÚNG → CLAUDE.md · SAI → ⚠️ human quyết: ép code hay nới luật |
| Lý do/quyết định | đã có trong ADR chưa | có → XOÁ · chưa + còn giá trị → draft ADR mới |
| Registry (log/event name) | grep từng entry trong code | tồn tại → LOG_CATALOG · không → ⚠️ (chết hay chưa build?) |
| Spec tính năng CHƯA build | so BACKLOG queue | giữ nguyên trong archive — thành slice file khi plan tới |
| Còn lại | — | archive |

**Prompt mẫu R0.2 (thay tên file, chạy lần lượt theo thứ tự T01→T07):**
```
[BỐI CẢNH] S-META-02: hoà tan docs cũ theo Workflow v2 — verify trước, route sau.
Mỏ neo sự thật: docs/FACTS.md (vừa generate) + chính source code. Bảng số phận route
đích: <paste bảng trên, hoặc trỏ docs/ICP_PLAYBOOK_V2.md R0.2 nếu đã commit>.
File mục tiêu lần này: docs cũ <TÊN_FILE>.

[VIỆC]
1. INVENTORY: đọc file, băm thành các mảnh claim độc lập (đánh số M1, M2, ...).
2. VERIFY từng mảnh: grep code / đối chiếu FACTS → nhãn: ĐÚNG / SAI / STALE /
   KHÔNG-KIỂM-ĐƯỢC (ý định, không phải fact).
3. ROUTE từng mảnh theo bảng số phận + nhãn verify.
4. XUẤT REPORT (format dưới) — CHƯA GHI BẤT KỲ FILE NÀO.
5. Chờ tôi duyệt → mới thực thi route + mv file gốc vào docs/archive-v1/
   + commit "META: dissolve <TÊN_FILE>".

[RÀNG BUỘC] Mảnh SAI/STALE cấm di cư lặng lẽ — chỉ được XOÁ hoặc nổi ⚠️. Cấm sửa
FACTS/contracts tay. Cấm sửa code sản phẩm trong nhiệm vụ này (mâu thuẫn luật-vs-code
chỉ BÁO, không tự fix).

[OUTPUT — bắt buộc đúng format]
### DISSOLVE REPORT — <TÊN_FILE>
| # | Mảnh (tóm ≤15 từ) | Verify (nhãn + evidence path) | Route |
...
### ⚠️ CẦN HUMAN QUYẾT
| # | Vấn đề | Phương án A / B |
### Tổng: X mảnh — Y xoá, Z → CLAUDE.md, W → ADR, V → catalog, U → archive

[THẤT BẠI] File quá dài để băm 1 lần → báo, chia 2 phần, làm phần 1 trước.
Mảnh mơ hồ không phân loại được → cho vào ⚠️, không tự quyết.
```

**Thứ tự chạy:** T01 `DECISIONS.md` (tách → decisions/ + gỡ dòng status khỏi ADR-040..044)
→ T02 gộp `MASTER_ROADMAP + MASTER_SLICE_BACKLOG` → `docs/MASTER_BACKLOG.md` 4 section
(mọi status đối chiếu FACTS, FACTS thắng; đăng ký 11 slice lịch sử vào §2/§4 — KHÔNG viết
lại brief cũ) → T03 `05_CODING_CONVENTIONS` (→CLAUDE.md) → T04 `06/07/08` → T05
`00_CONTEXT + 01_ARCHITECTURE` (gộp thành 1 file hiến-pháp-kèm-bản-đồ ≤250 dòng)
→ T06 `phases/` 7 file (→archive, Phase chỉ còn là nhãn trong BACKLOG §1) → T07
`02/03/04` (09_FIELD_AUDIT để dành — hoà tan dần thành comment khi code chạm tới).

## R0.3 — Dựng Project trên claude.ai (tay, 10 phút)

1. Tạo Project "ICP" → Knowledge: upload 4 file `00_CONTEXT.md` (bản mới sau T05),
   `FACTS.md`, `MASTER_BACKLOG.md`, `decisions/INDEX.md`.
2. Project instructions — paste nguyên khối:
```
Bạn là planner của dự án ICP theo Workflow v2 (dual-surface: Web plan / Code execute).
LUẬT CỨNG:
1. Mọi khẳng định về hệ thống phải cite được FACTS/BACKLOG/ADR INDEX trong knowledge
   (ghi rõ section/dòng). Không cite được = không được khẳng định.
2. Cần tri thức triển khai ("code hoạt động thế nào") → DỪNG, xuất khối 📥 PULL hoặc
   📥 RECON theo template dưới, chờ human paste kết quả. CẤM suy đoán hiện trạng code.
3. Mở đầu MỌI phiên plan slice = phát 📥 RECON.
4. Trình tự plan: RECON → DESIGN 1-3 phương án + trade-off (sinh TỪ evidence RECON) →
   CHỜ human duyệt phương án → mới cắt task. Chuẩn cắt: 3-5 big task; T01 =
   contract-as-code (migration + OpenAPI + types + stub chạy được); task sau = lát dọc
   con end-to-end CHẠY ĐƯỢC khi đóng, test nhúng; CẤM cắt theo tầng hạ-tầng/BE/FE/test;
   CẤM task "test" riêng.
5. Output cuối phiên plan: nội dung file docs/slices/S-XX.md (template trong knowledge
   /workflow) + 1 dòng BACKLOG §2 — cả hai dạng khối copy được.
6. Hotfix: định tuyến theo TRIỆU CHỨNG về slice gốc, tạo task spec ≤10 dòng.
7. Human owns priority — đề xuất, không tự quyết. Mỗi lần hỏi human đúng 1 câu.
8. Template RECON: 'Đọc-only. Mục tiêu slice: <X>. Khảo sát repo+git log+migrations,
   báo cáo ≤60 dòng kèm path: 1.đã tồn tại gì liên quan 2.pattern/constraint phải theo
   3.thiếu/dở dang/mâu thuẫn 4.⭐điều người plan cần biết mà không nghĩ tới hỏi.
   Không thấy nói KHÔNG TÌM THẤY, cấm đoán.'
   Template PULL: 'Đọc-only. Trả lời ≤30 dòng kèm path: (a)... (b)...
   Không thấy nói KHÔNG TÌM THẤY, cấm đoán.'
```

**R0 XONG → slice thật đầu tiên: S-P0-01 Multi-tenant (R2).**

---

# R1 — THÊM VIỆC VÀO BACKLOG (Web, 2 phút)

```
[VIỆC] Thêm vào backlog: <mô tả, vd "shop export báo cáo PDF">.
[OUTPUT] (1) Đề xuất ưu tiên P0/P1/P2 + nhãn phase + ADR liên quan nếu có, kèm 1 câu
lý do; (2) 1 dòng đúng format BACKLOG §3 để tôi paste.
[RÀNG BUỘC] Nếu item trùng/giẫm item có sẵn trong BACKLOG → chỉ ra, đề xuất gộp.
Nếu item lớn cỡ nhiều slice → đề xuất tách, vẫn cho từng dòng.
```
→ dán dòng vào `MASTER_BACKLOG.md §3` → commit `META: backlog: add <tên>`.

# R2 — MỞ SLICE (Pha A: Web ⇄ Code, ~30–60 phút)

**B1 (Web):** `Plan slice cho item: <tên trong BACKLOG §3>. Bắt đầu bằng RECON.`
→ Web xuất khối `📥 RECON`.

**B2 (Code):** paste nguyên khối RECON → nhận báo cáo ≤60 dòng kèm path.

**B3 (Web):** paste báo cáo + `Đây là kết quả RECON. Đề xuất design.`
→ Web đưa 1–3 phương án + trade-off. Web cần khoét sâu → nó xuất `📥 PULL #N` → bạn lặp B2.

**B3+ (Web, trước khi cut task):** với MỖI quyết định kiến trúc trong design,
SEARCH `docs/decisions/INDEX.md` + ADR ruột liên quan. Có ADR phủ → dùng lại
hoặc amend (append-only note). Không phủ → kiểm **4 tiêu chí** (chọn 2+ phương án
có trade-off / lock cross-task / WHY cần lưu sau 3 tháng / security-data-tenant
boundary). Đáp ≥1 tiêu chí → sinh ADR mới (≤30 dòng) **TRƯỚC B5**. Không đáp →
comment trong code/migration, KHÔNG sinh ADR.

**B4 (Human — cổng cứng):** `Duyệt phương án <N>` (hoặc `phương án <N> nhưng <chỉnh>`).
Web KHÔNG được cắt task khi chưa có câu này.

**B5 (Web):** Web xuất 2 khối: (i) nội dung `S-XX.md` đầy đủ — goal / design đã duyệt /
evidence (RECON+PULL nhúng nguyên văn) / 3–5 task / stop conditions riêng; (ii) 1 dòng
BACKLOG §2.

**B6 (tay, 1 phút):** save `docs/slices/S-XX.md` + dán dòng BACKLOG + commit
`META: plan S-XX`.

**R2-INV — invariant cross-cutting:** slice chạm invariant xuyên hệ (tenant,
authz, idempotency, logging/trace) → RECON bắt buộc kiểu INVENTORY trước khi
cắt task: đếm đóng mọi đường đi của invariant (mọi caller của boundary, mọi
key/channel, mọi connect-site), mỗi mục kèm path. Slice file phải chứa tuyên
bố đóng inventory + evidence. Cắt task = mỗi bề mặt propagate 1 task, enforce
= task cuối, prereq = inventory đã đóng. Mặc định: cross-cutting cỡ slice,
không phải task.

# R3 — CHẠY TASK (Code)

```
[BỐI CẢNH] Slice active: docs/slices/S-XX.md.
[VIỆC] Đọc CLAUDE.md → nghi thức MỞ TASK (CLAUDE.md §2) → thực hiện T0N.
[RÀNG BUỘC] DoD CLAUDE.md §5. Stop Conditions §4 — chạm là DỪNG hỏi tôi, không tự xử.
[OUTPUT] REPORT đúng format CLAUDE.md §7.
[THẤT BẠI] Test fail không tự giải thích được sau 2 lần thử → dừng, báo nguyên trạng,
không che known issues.
```
Bạn review diff theo 4 câu: *test xanh? known issues chấp nhận được? có lén đổi
contract/file chung không? đúng acceptance?* → `Duyệt, đóng task` → agent squash commit
chuẩn → task kế tiếp lặp R3.

# R4 — ĐÓNG SLICE (Code + Pha D tay)

```
Slice S-XX xong task cuối. Thực hiện nghi thức đóng slice (CLAUDE.md §8).
[OUTPUT] FACTS diff gì · dòng BACKLOG mới nguyên văn · ADR nào tạo · nhắc tôi sync
Project knowledge.
```
**Pha D (30 giây, KHÔNG ĐƯỢC QUÊN):** thay `FACTS.md` + `MASTER_BACKLOG.md` trong
Project knowledge. Quên = phiên plan sau dùng sự thật cũ.

# R5 — HOTFIX (episode)

**B1 (Web):**
```
Bug: <TRIỆU CHỨNG đúng như bạn thấy, vd "voice buy: nói 2 món, món 2 không vào giỏ">.
Định tuyến slice theo triệu chứng (cite BACKLOG), phát PULL khoanh vùng nếu cần,
rồi tạo task spec hotfix.
[OUTPUT] Task spec ≤10 dòng: slice đích · triệu chứng · vùng nghi (path) · acceptance
(hết bug + test chống tái phát) · stop conditions; + 1 dòng episode cho BACKLOG §2.
```
**B2 (Code):** paste task spec + `Thực hiện hotfix theo CLAUDE.md.` → squash commit
`S-XX/HOTFIX-NN: <triệu chứng> — <nguyên nhân gốc>`.
**B3 (tay):** dán dòng episode vào BACKLOG §2; FACTS đổi thì sync knowledge.

> **Khẩn cấp (đang cháy):** đảo thứ tự — fix thẳng trên Code, commit chuẩn HOTFIX,
> đăng ký hồi tố với Web trong 24h. *(Đề xuất §99-a, chờ duyệt.)*

# R6 — REFACTOR (episode, behavior KHÔNG đổi)

Kích hoạt: RECON than phiền hoặc bạn khó chịu khi đọc code.
**Web:** `Refactor: <vùng + lý do>. RECON vùng này, đề xuất phạm vi (behavior KHÔNG đổi), tạo task spec.`
**Code:** như R5; commit `S-XX/REFACTOR-NN: <phạm vi> — behavior KHÔNG đổi`.
**Lưới:** test hiện có xanh trước VÀ sau; vùng chưa có test → viết **characterization
test TRƯỚC** (chụp behavior hiện tại làm chuẩn) rồi mới đụng.

# R7 — HỎI NHANH GIỮA LÚC PLAN

Web tự xuất `📥 PULL #N` khi chạm loại câu "hoạt động thế nào" (luật routing). Nó quên →
ép: `Phát PULL cho câu này, đừng đoán.` Paste 2 chiều, ~2 phút/vòng. Kết quả nhúng vào
Evidence của S-XX.md.

# R8 — DOCS AUDIT định kỳ (slice vĩnh viễn S-AUDIT)

> Nhịp: mỗi 10 slice đóng HOẶC mỗi tháng. Gác phần máy không gác được: claim văn xuôi
> trong CONTEXT / BACKLOG §1 Direction / tóm tắt 1 dòng trong decisions/INDEX.

```
[BỐI CẢNH] Episode S-AUDIT theo Workflow v2. Mỏ neo: docs/FACTS.md (chạy lại
gen-facts.sh trước cho tươi) + source code.
[VIỆC]
1. bash scripts/gen-facts.sh
2. Đọc lần lượt: docs/00_CONTEXT.md · MASTER_BACKLOG.md §1+§2 · decisions/INDEX.md
   (cột tóm tắt). Với MỖI câu khẳng định về hệ thống → grep code/FACTS đối chiếu.
3. XUẤT REPORT — CHƯA SỬA GÌ.
[OUTPUT]
### AUDIT REPORT <date>
| # | File:dòng | Claim | Thực tế (evidence path) | Verdict ĐÚNG/SAI/STALE | Đề xuất sửa |
### Tổng: X claim — Y đúng, Z lệch
[RÀNG BUỘC] Chỉ đọc + report. Sửa sau khi tôi duyệt từng dòng.
[THẤT BẠI] Claim không kiểm được bằng code (ý định thuần) → verdict "N/A-INTENT", bỏ qua.
```
→ bạn duyệt → agent sửa → commit `S-AUDIT/T0N: reconcile <files>` → sync knowledge.

---

## PHỤ LỤC — Cây file & quyền

```
icp/
  CLAUDE.md                  Code đọc mọi task · human sửa khi đổi luật
  scripts/gen-facts.sh       sửa khi FACTS cần section mới
  docs/
    00_CONTEXT.md            hiến pháp + bản đồ (≤250 dòng) — sửa = có ADR
    FACTS.md                 ★ chỉ gen-facts.sh ghi
    MASTER_BACKLOG.md        Web đề xuất dòng · human paste · Code sửa Pha C
    LOG_CATALOG.md           registry log/event — append khi DoD đòi
    decisions/               append-only · Code ghi Pha C · KHÔNG chứa status
    contracts/               ★ máy sinh (openapi pipeline)
    slices/ + archive/       Web sinh (R2) · Code đọc (R3) · Code archive (R4)
    archive-v1/              xác docs cũ sau hoà tan — không bao giờ vào context
Project claude.ai: knowledge = CONTEXT + FACTS + BACKLOG + decisions/INDEX (sync Pha D)
```

**END PLAYBOOK v2.2**
