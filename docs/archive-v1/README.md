# Archive v1 — bản đồ hoà tan

> Docs v1 nguyên vẹn, đã hoà tan theo Workflow v2 (ADR-045). Bảng này là INPUT cho
> T08 (chuẩn hoá tham chiếu toàn hệ).

| File cũ | Hoà tan đi đâu | Ngày |
|---|---|---|
| DECISIONS.md | docs/decisions/ (39 ADR + INDEX) | 2026-06-10 |
| MASTER_ROADMAP.md + MASTER_SLICE_BACKLOG.md | docs/MASTER_BACKLOG.md | 2026-06-10 |
| 05_CODING_CONVENTIONS.md | CLAUDE.md §11 | 2026-06-11 |
| 06_OBSERVABILITY.md | CLAUDE.md §11 (Observability) + docs/LOG_CATALOG.md | 2026-06-11 |
| 07_BEHAVIOR_LOGS.md | docs/LOG_CATALOG.md §B + CLAUDE.md §11 | 2026-06-11 |
| 08_FE_BE_CONTRACT.md | CLAUDE.md §11 (Shared types/codegen bổ sung) | 2026-06-11 |
| LOG_CATALOG.md | docs/LOG_CATALOG.md (promoted, không archive) | 2026-06-11 |
| 00_CONTEXT.md ⚠️ trùng tên | docs/00_CONTEXT.md v3 (mới, file sống ở docs/) | 2026-06-11 |
| 01_ARCHITECTURE.md | docs/00_CONTEXT.md v3 §2 (bản đồ kiến trúc) | 2026-06-11 |

> ⚠️ **Ca trùng tên `00_CONTEXT.md`:** docs/00_CONTEXT.md là v3 mới (Workflow v2,
> hiến pháp + bản đồ). Bản v1 ở docs/archive-v1/00_CONTEXT.md là fossil. Mọi
> reference cũ tới `00_CONTEXT.md` viết TRƯỚC 2026-06-10 trỏ về v1 (đọc bản
> archive-v1/); reference viết sau ngày này (gồm trong ADR-045/046, CLAUDE.md,
> MASTER_BACKLOG) trỏ về v3.

> Tra commit hoà tan: `git log --oneline --diff-filter=A -- docs/archive-v1/<file>` —
> git là nguồn, không chép tay hash (hash chép tay = bản sao có thể sai — đã bắt 1
> lỗi đúng kiểu này ở T02; fact máy ghi được thì zero-administration).

## Luật cho task T0X tiếp theo (T04–T07)

Mỗi task khi `mv` file vào archive-v1/ phải **append 1 dòng vào bảng trên trong cùng
commit** — không tách commit riêng. Mục tiêu: bảng luôn complete tại HEAD, T08 chỉ
đọc bảng + grep là đủ.

## Chính sách chuẩn hoá tham chiếu (đăng ký T08 — chạy cuối, sau T07)

**Quyết định human:** việc chuẩn hoá tham chiếu trong `docs/decisions/ADR-001..044` +
mọi file sống khác (`CLAUDE.md`, `00_CONTEXT.md` mới sau T05, `workflow/`, `playbook`,
queue items trong `MASTER_BACKLOG.md`) **chỉ làm 1 lần duy nhất ở T08**, không vá lẻ tẻ
trong các task T03–T07.

**Phạm vi sửa trong ADR:** DUY NHẤT dòng `Reference:` / path nhắc tới file đã hoà tan.
**CẤM TUYỆT ĐỐI** sửa Context / Decision / Rationale / Trade-offs / Consequences /
Status / Date — kể cả khi thấy nội dung có vẻ stale. ADR là append-only; thay đổi nội
dung quyết định phải qua ADR mới supersede.

**Trước T08:** không sửa reference nào cả. Mọi reference cũ vẫn trỏ sang docs đã mv
sang archive-v1/ — chấp nhận temporary breakage, T08 sẽ dọn.

## T08 — quy trình thực thi (đăng ký sẵn)

1. Build bảng mapping từ bảng "File cũ → Hoà tan đi đâu" ở trên + đọc thêm các commit
   `META: docs: dissolve *` để bổ sung nếu cần.
2. Grep toàn bộ file SỐNG (NOT `docs/archive-v1/`, NOT `docs/legacy/`):
   - `docs/decisions/*.md`
   - `docs/00_CONTEXT.md` (sau T05)
   - `CLAUDE.md`
   - `docs/workflow/`, `docs/playbook` hoặc `docs/ICP_PLAYBOOK_V2.2.md`, `docs/ICP_WORKFLOW_V2_WORKING.md`
   - `docs/MASTER_BACKLOG.md`
3. Tìm mọi mention path/tên file đã hoà tan (vd `DECISIONS.md`, `MASTER_ROADMAP.md`,
   `MASTER_SLICE_BACKLOG.md`, `05_CODING_CONVENTIONS.md`…).
4. Xuất REPORT: `[file:dòng | reference cũ | reference mới đề xuất]` cho từng dòng.
5. Quy tắc mapping:
   - Nội dung có nhà mới rõ ràng → trỏ nhà mới (vd `DECISIONS.md` → `docs/decisions/ADR-NNN.md` nếu nhắc đích danh ADR; nếu chỉ nhắc chung → `docs/decisions/INDEX.md`).
   - Không có tương đương trong hệ mới → trỏ tường minh `docs/archive-v1/<file>` —
     **không để con trỏ mồ côi nào** (link gãy ngầm = nợ T9).
6. Chờ duyệt từng phần (hoặc bulk) → áp → commit
   `META: docs: T08 normalize references -> v2 homes`.

## Không vào archive-v1 từ context Claude

Archive-v1/ là fossil, **KHÔNG bao giờ** load vào context của Claude khi plan/execute
slice production. Đọc chỉ khi: (a) đang chạy T08, (b) audit lịch sử quyết định.
