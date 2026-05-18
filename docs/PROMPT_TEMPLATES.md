# PROMPT TEMPLATES

> File này không phải doc dự án — chỉ là **template prompt** bạn copy-paste khi mở conversation mới với AI.

---

## Template 1 — Bắt đầu phase mới

```
Tôi là human owner của dự án ICP. Hôm nay tôi muốn bắt đầu PHASE XX.

Đây là context dự án (đọc kỹ trước khi làm gì):

=== docs/00_CONTEXT.md ===
<paste full content>
=== END docs/00_CONTEXT.md ===

=== docs/phases/PHASE_XX_<name>.md ===
<paste full content>
=== END phase doc ===

=== docs/phases/PHASE_(XX-1)_HANDOFF.md ===  (nếu có)
<paste full content>
=== END handoff ===

Vai trò của bạn:
- Tuân thủ tuyệt đối docs và DECISIONS.md
- Không tự ý đổi conventions
- Khi có quyết định mới → đề xuất rồi đợi tôi confirm trước khi code
- Code phải khớp specs trong docs

Bước đầu tiên: tóm tắt lại bạn hiểu phase này gồm gì, scope đến đâu, có chỗ nào không rõ. KHÔNG code gì cho đến khi tôi nói "go".
```

---

## Template 2 — Code 1 file cụ thể trong phase đang làm

```
Tiếp tục Phase XX. Hôm nay code module: <module name>

Refs cần đọc:
=== docs/03_API_CONTRACTS.md (section liên quan) ===
<paste relevant section only>

=== docs/05_CODING_CONVENTIONS.md ===
<paste full>

File liên quan đã có trong repo (paste source nếu cần edit):
=== apps/gateway/src/auth/auth.module.ts ===
<paste>

Task: <mô tả task cụ thể>

Yêu cầu:
- Code đầy đủ file (không dùng "..." placeholder)
- Unit test kèm theo
- Liệt kê file mới + file edit ở cuối
```

---

## Template 3 — Đề xuất quyết định mới

Khi AI suggest 1 cách làm khác doc:
```
Đề xuất hay. Trước khi code, ghi vào DECISIONS.md format ADR:

## ADR-NNN — <title>
- Status: Proposed
- Date: <today>
- Context: <vấn đề>
- Decision: <quyết định>
- Rationale: <vì sao>
- Trade-offs: <hy sinh gì>
- Alternatives considered: <option khác>

Tôi review sẽ đổi sang Accepted.
```

---

## Template 4 — Kết thúc phase

```
Phase XX gần xong. Tạo PHASE_XX_HANDOFF.md theo template ở _HANDOFF_TEMPLATE.md.

Đảm bảo điền đầy đủ:
- Đã làm + chưa làm
- File tạo/edit
- Public interfaces
- Decisions phát sinh
- Bugs/nợ kỹ thuật
- Lưu ý cho phase sau

Output: full content của file để tôi copy về repo.
```

---

## Template 5 — Mất context giữa chừng

Khi AI bắt đầu trả lời chậm, lan man, hoặc quên rule:
```
Bạn đang mất context. Hãy đọc lại:

=== docs/00_CONTEXT.md ===
<paste again>

=== docs/phases/PHASE_XX_<name>.md ===
<paste again>

Sau đó xác nhận: rule số 5 trong section 10 của 00_CONTEXT là gì? Repeat lại.
Rồi tiếp tục task: <task hiện tại>
```

---

## Template 6 — Debug bug giữa phase

```
Tôi gặp bug trong code Phase XX. 

Refs:
=== docs/04_INTENT_SPECS.md (Intent NN section) ===
<paste>

Code hiện tại:
=== <file path> ===
<paste source>

Error / Behavior:
- Expected: ...
- Actual: ...
- Log: ...

Yêu cầu: chẩn đoán root cause, KHÔNG sửa code ngay. Cho 2-3 giả thuyết, xếp theo likelihood.
```

---

## Mẹo dùng tốt

1. **Mỗi conversation chỉ làm 1 việc.** Không trộn "code AuthModule" với "design Vespa schema" trong 1 chat.
2. **Refresh context khi cần.** Nếu conversation > 30 turns, mở chat mới với fresh context.
3. **Lưu HANDOFF.md vào repo** ngay sau khi AI sinh ra — đừng đợi.
4. **Đừng dán cả repo.** Chỉ dán file/section cần thiết.
5. **Khi AI lan man** → quote rule cụ thể từ docs, force back on track.

---

## Sizing reference (paste khoảng bao nhiêu là OK)

| Doc | Tokens xấp xỉ |
|---|---|
| 00_CONTEXT.md | ~2500 |
| 01_ARCHITECTURE.md | ~3500 |
| 02_DATA_MODEL.md | ~3000 |
| 03_API_CONTRACTS.md | ~3500 |
| 04_INTENT_SPECS.md | ~4000 |
| 05_CODING_CONVENTIONS.md | ~2000 |
| 1 phase doc | ~1500-2500 |
| 1 handoff doc | ~1000 |
| Source 1 module (avg) | ~500-1500 |

**Conversation Claude tier:** ~200K tokens context. An toàn dùng 50-80K cho input. Tương đương:
- Anchor (00 + 01 + 03 + 05): ~11K
- Phase + handoff: ~3K
- Source code 5-10 files: ~10K
- Tổng < 25K → còn ~150K cho conversation/work → rất an toàn

Khi vượt ngưỡng, refresh chat.
