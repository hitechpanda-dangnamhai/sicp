# ICP — Luật cho Claude Code (đọc trước MỌI task)

> Workflow gốc: `docs/ICP_WORKFLOW_V2.md` · Thao tác: `docs/ICP_PLAYBOOK_V2.md`.
> File này là bản rút gọn THỰC THI — khi mâu thuẫn, WORKFLOW thắng.

## 1. Định hướng
- Slice đang active: `docs/slices/S-*.md` — ĐỌC TRƯỚC khi code bất kỳ task nào.
- Mọi việc thuộc về một slice. Không có commit "vô danh".

## 2. Nghi thức MỞ TASK (bắt buộc, trước dòng code đầu tiên)
1. `git log --oneline -20` — xem các task/slice gần nhất.
2. Đọc diff các task trước trong cùng slice (nếu có).
3. Đọc lại section Acceptance + Stop Conditions của slice file.
> "Đã có gì" = REPO tại giây này. Không phải doc. Không phải trí nhớ.

## 3. Sự thật
- CẤM tin docs về hiện trạng code. Grep/đọc code trước khi khẳng định bất kỳ điều gì.
- Khi nhận lệnh `📥 PULL` / `📥 RECON`: chế độ ĐỌC-ONLY, trả lời kèm path cho mỗi ý,
  không tìm thấy → nói "KHÔNG TÌM THẤY", cấm đoán, cấm sửa file.

## 4. STOP CONDITIONS — dừng và báo human khi cần:
- Đổi DB schema ngoài scope task đang làm
- Thêm dependency mới chưa approve
- Đổi CONTRACT hoặc BEHAVIOR của code dùng chung (file nhiều slice cùng đụng)
  — thêm-trong-khuôn (event type mới, log entry mới, route theo pattern sẵn) thì OK
- Đổi pattern đã LOCKED trong ADR (`docs/decisions/`)

## 5. DoD mọi task (mục nào N/A phải ghi rõ lý do trong report)
- [ ] Test NHÚNG trong task: unit cho logic + ≥1 integration cho luồng (không có "task test riêng")
- [ ] Timeout cho mọi I/O ngoài; retry/circuit-breaker nơi gọi payment/Vespa/LLM
- [ ] OTel span + log đúng `docs/LOG_CATALOG.md` (phát sinh entry mới → thêm vào catalog)
- [ ] Không log PII; secret qua env; validate input
- [ ] Idempotency nơi side-effect lặp được (IPN, webhook, consumer)
- [ ] Migration: forward-only, số kế tiếp theo FACTS, kèm rollback note trong commit body
- [ ] Sau V011: mọi query data path có tenant scope (RLS/tenant_id) + isolation test

## 6. COMMIT
- Trong task: commit nháp tuỳ ý. ĐÓNG TASK: **squash về đúng 1 commit**.
- Format (commit-lint enforce):
  - `S-XX/T0N: <làm gì, 1 dòng>` — body: quyết định ngầm · ADR ref · `breaking: KHÔNG|CÓ + lý do`
  - `S-XX/HOTFIX-NN: <triệu chứng> — <nguyên nhân gốc>`
  - `S-XX/REFACTOR-NN: <phạm vi> — behavior KHÔNG đổi`
  - `META: <docs|workflow|facts|ci>: <gì>`
- Comment tại chỗ cho quyết định KHÔNG hiển nhiên từ code
  (vd `// total tính lại mỗi lần, KHÔNG cache — giá realtime, ADR-0XX`).

## 7. ĐÓNG TASK — report bắt buộc, đúng format:
```
### REPORT S-XX/T0N
Files changed: <list>
Commands run + output chính: <build/test>
Tests: <pass/fail, tên test mới>
DoD: <từng mục ✓ hoặc N/A+lý do>
Known issues: <tự khai, kể cả nghi ngờ>
Đề xuất commit message: <theo format §6>
```

## 8. ĐÓNG SLICE (khi human xác nhận task cuối xong)
1. `bash scripts/gen-facts.sh` → FACTS.md mới
2. Sửa `docs/MASTER_BACKLOG.md`: 1 dòng status (+1 dòng episode nếu HOTFIX/REFACTOR)
3. Quyết định lớn phát sinh → draft ADR vào `docs/decisions/` + cập nhật `INDEX.md`
4. `mv docs/slices/S-XX.md docs/slices/archive/`
5. Commit `META: close S-XX` — nhắc human sync Project knowledge (FACTS + BACKLOG)

## 9. Single Home — sửa đúng nhà, cấm sửa nhà máy sinh
| Fact | Nhà | Được sửa? |
|---|---|---|
| Status/episode | `docs/MASTER_BACKLOG.md` | ✔ (Pha C) |
| Hiện trạng code/DB | `docs/FACTS.md` | ✖ tay — chỉ gen-facts.sh |
| Quyết định + lý do | `docs/decisions/ADR-*.md` | ✔ append-only, KHÔNG chứa status |
| Contract | `docs/contracts/` + openapi pipeline | ✖ tay — chỉ codegen |
| Tri thức triển khai | CODE | ✔ — và đây là nhà duy nhất của nó |

## 10. Lệnh thường dùng
- Facts: `bash scripts/gen-facts.sh`
- Test: `<điền lệnh test của repo>`  · Migrate: `<điền>`  · OpenAPI sync: `<điền — npm run openapi:sync>`
