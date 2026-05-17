# Cross-Intent Bug Impact Analysis

> **Mục đích:** Đánh giá 2 bugs phát hiện trong Intent 01 v2 có ảnh hưởng đến mockup các intent khác (02, 03, 04, 05, 06, 07, 08) không.
>
> **Context:** Bugs phát hiện:
> - Bug 1: Bottom-bar gradient transparent → content lộ qua khi scroll lưng chừng
> - Bug 2: Phone-frame `height: 844px` cứng → overflow viewport laptop thấp

---

## TL;DR

| Intent | Có mockup? | Bug 1 risk | Bug 2 risk | Action |
|---|---|---|---|---|
| 01 — Import by Image | ✅ v2 | ✅ Fixed | ✅ Fixed | Done |
| 02 — Buy by Voice | ❓ chưa có | N/A | N/A | Build mới, follow Cross-Intent Patterns |
| 03 — Search by Text | ✅ đã có (theo handoff) | ⚠️ **CẦN KIỂM** | ⚠️ **CẦN KIỂM** | Audit + fix nếu có |
| 04 — Recommend by Image | ✅ đã có | ⚠️ **CẦN KIỂM** | ⚠️ **CẦN KIỂM** | Audit + fix nếu có |
| 05 — Cart by Text | ✅ đã có | ⚠️ **HIGH RISK** | ⚠️ **CẦN KIỂM** | Audit + fix CHẮC CHẮN |
| 06 — Pay by Text | ✅ đã có | ⚠️ **HIGH RISK** | ⚠️ **CẦN KIỂM** | Audit + fix CHẮC CHẮN |
| 07 — Analyze by Voice | ❓ chưa rõ | N/A nếu chưa có | N/A nếu chưa có | Build mới, follow patterns |
| 08 — Login/Logout | ✅ đã có | ❓ Low risk | ⚠️ **CẦN KIỂM** | Quick audit |

---

## Phân tích chi tiết per intent

### Intent 02 — Buy Products by Voice

**Mockup status:** Theo handoff Intent 01 dòng 22, chỉ list "Intent 03/04/05/06/08 đã build". Intent 02 (voice) **có thể chưa có mockup**. 

**Nếu chưa có:** Build mới theo Cross-Intent Patterns (đã có bottom-bar fix + viewport fix sẵn).

**Nếu đã có:** Voice intent typically có UI:
- Waveform animation full-screen
- Bottom CTA "Đóng" hoặc "Xác nhận"

→ Bug 1 risk: **TRUNG BÌNH** (nếu có bottom-bar). Bug 2 risk: **CAO** (mọi intent đều dùng phone-frame 844px).

### Intent 03 — Search Products by Text

**Mockup status:** Đã build.

**UI predict:** Search input + product grid scroll list. Không có "fixed CTA" thông thường (user scroll list products, không có nút commit).

- **Bug 1 risk:** **THẤP**. Nếu không có `.bottom-bar` thì không gặp bug.
- **Bug 2 risk:** **TRUNG BÌNH**. Phone-frame 844px hard-coded → vẫn overflow viewport laptop thấp.

**Action:** Audit nhanh — check file mockup có `.bottom-bar` không. Apply Bug 2 fix (`max-height` cho phone-frame) **chắc chắn**.

### Intent 04 — Recommend by Image

**Mockup status:** Đã build.

**UI predict:** Image upload state → recommendations grid carousel. Có thể có CTA "Đóng" / "Xem chi tiết".

- **Bug 1 risk:** **TRUNG BÌNH**. Nếu có bottom-bar fixed cho CTA.
- **Bug 2 risk:** **TRUNG BÌNH**. Same as all intents.

**Action:** Audit + fix Bug 2 chắc chắn. Bug 1 fix nếu phát hiện có `.bottom-bar`.

### Intent 05 — Cart by Text ⚠️ HIGH RISK

**Mockup status:** Đã build.

**UI predict:** Bottom sheet pull-up với 3 snap points (15vh / 50vh / 90vh). Cart items list scroll + **checkout CTA cố định ở đáy**.

- **Bug 1 risk:** **CAO**. Pattern Intent 05 chắc chắn có `.bottom-bar` với "Thanh toán" CTA. Nếu dùng cùng gradient pattern Intent 01 v1 → có bug.
- **Bug 2 risk:** **CAO**. Same phone-frame issue.

**Action:** **PHẢI audit + fix cả 2 bugs**. Mockup Intent 05 nguy cơ cao nhất.

### Intent 06 — Pay Order by Text ⚠️ HIGH RISK

**Mockup status:** Đã build.

**UI predict:** Confirm modal với order summary + payment method selector + **"Xác nhận thanh toán" CTA cố định dưới**.

- **Bug 1 risk:** **CAO**. Pattern y hệt Intent 05.
- **Bug 2 risk:** **CAO**. Same.

**Action:** **PHẢI audit + fix cả 2 bugs**. Intent 06 cũng nguy cơ cao.

### Intent 07 — Analyze by Voice

**Mockup status:** Có thể chưa có (handoff chỉ list 03/04/05/06/08).

**UI predict:** Voice recording → chart inline trong chat thread + drill-down chips.

- Nếu chưa build: build mới follow patterns.
- Nếu đã build: audit standard.

### Intent 08 — Login/Logout by Text

**Mockup status:** Đã build.

**UI predict:** Login modal với email/password form + "Đăng nhập" CTA.

- **Bug 1 risk:** **THẤP**. Modal thường không có scroll dài, ít khả năng gặp bug.
- **Bug 2 risk:** **TRUNG BÌNH**. Nếu dùng phone-frame thì có risk.

**Action:** Quick audit. Apply Bug 2 fix chắc chắn.

---

## Quy trình audit cho từng intent

Khi nhận mockup pack của 1 intent khác (vd Intent 05), follow checklist:

### Bước 1: Check Bug 1 (bottom-bar transparent)

```bash
grep -A 5 "\.bottom-bar {" intent-NN-state-*.html | grep "linear-gradient.*rgba.*0%"
```

**Nếu tìm thấy** match (có gradient transparent ở 0%) → có bug, cần fix.

### Bước 2: Check Bug 2 (phone-frame overflow)

```bash
grep "\.phone-frame {" intent-NN-state-*.html
# Check xem có "max-height: calc(100vh" không
```

**Nếu KHÔNG có** `max-height: calc(100vh...)` → có bug, cần fix.

### Bước 3: Apply fixes

**Fix Bug 1** — Replace bottom-bar CSS:

```css
/* CŨ */
.bottom-bar {
  background: linear-gradient(180deg, rgba(255,248,240,0) 0%, ...);
}

/* MỚI */
.bottom-bar {
  z-index: 10;
  background: #FFF8F0;   /* solid, dùng đúng bg color của state */
  box-shadow: 0 -8px 16px rgba(255,248,240,0.95), 
              0 -16px 24px rgba(255,248,240,0.6);
}
```

**Fix Bug 2** — Add max-height:

```css
body {
  align-items: center;   /* sửa từ flex-start */
}
.phone-frame {
  height: 844px;
  max-height: calc(100vh - 48px);   /* THÊM dòng này */
}
@media (min-width: 1024px) {
  .phone-frame { 
    box-shadow: 0 32px 80px rgba(233,30,99,0.24); 
    max-height: calc(100vh - 64px);   /* THÊM dòng này */
  }
}
```

### Bước 4: Verify

Test cả 2 scenarios cho mỗi state có scroll content:
- Scroll lưng chừng (positions 200, 300, 500px) — không lộ content qua bottom-bar
- Viewport height 700-820px — phone-frame shrink, không overflow

---

## Câu 2: Handoff các intent khác có cần sửa không?

**Trả lời ngắn:** **CÓ, nhưng minimal.**

Mỗi handoff intent (03, 04, 05, 06, 08) chỉ cần thêm **1 paragraph note** ở đầu file:

```markdown
> **⚠️ v2 update notice:** Sau khi build Intent 01 v2, phát hiện 2 bugs visual 
> ảnh hưởng mọi intent. Đã apply fix patterns vào mockup intent này.
> Xem chi tiết:
> - `PHASE_00_CROSS_INTENT_PATTERNS.md` Section 1 (bottom-bar pattern)
> - `PHASE_00_CROSS_INTENT_PATTERNS.md` Section 2 (phone-frame responsive)
> - `PHASE_00_INTENT_01_HANDOFF_DELTA.md` Section 3 (root cause analysis)
```

**KHÔNG CẦN** rewrite cả handoff. Chỉ pointer đến doc chung.

---

## Câu 3: Cần làm gì TIẾP THEO?

### Phase 1 (URGENT — 30 phút): Audit Intent 05 và 06

Đây là 2 intents nguy cơ cao nhất (có bottom-bar CTA chắc chắn). Bạn:
1. Gửi mockup files Intent 05 và 06 cho tôi
2. Tôi audit + apply 2 fixes nếu cần
3. Re-deliver zip

### Phase 2 (HIGH PRIORITY — 30 phút): Audit Intent 03, 04, 08

Risk thấp hơn nhưng vẫn cần check. Tôi audit nhanh + fix.

### Phase 3 (FUTURE — khi build Intent 02, 07): Apply patterns ngay từ đầu

Khi vẽ mockup mới, đọc `PHASE_00_CROSS_INTENT_PATTERNS.md` TRƯỚC, copy CSS template Section 1 + 2 — sẽ không gặp bugs này.

### Phase 4 (NICE-TO-HAVE): Update handoff notes

Sau khi audit + fix mọi intent, thêm note "v2 update notice" vào đầu mỗi handoff file để traceability.

---

## Lý do tôi không thể tự audit ngay

Tôi không có files mockup Intent 03, 04, 05, 06, 08 trong context. Bạn cần upload zip / files để tôi audit cụ thể. Hoặc bạn tự follow quy trình audit ở Section "Quy trình audit" trên.

Nếu file ít, paste content vào chat cũng được — tôi check ngay.

---

**END OF IMPACT ANALYSIS.**
