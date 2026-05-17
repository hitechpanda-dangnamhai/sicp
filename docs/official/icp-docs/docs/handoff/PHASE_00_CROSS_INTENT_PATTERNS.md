# Phase 00 — Cross-Intent Patterns

> **Load khi:** vẽ mockup hoặc code Intent 02-08. Doc này tổng hợp **patterns rút ra từ Intent 01 v2** mà các intents kế tiếp PHẢI tuân theo để giữ consistency.
>
> **Cách dùng:** Đọc sau `PHASE_00_DESIGN_SYSTEM.md` (foundations) và TRƯỚC khi bắt đầu vẽ intent của mình. Mỗi pattern là 1 đoạn ngắn — sao chép code/CSS vào intent mới.

---

## 1. Layout Pattern: Main-Scroll + Fixed Bottom-Bar

**Khi nào dùng:** Bất kỳ screen nào có (a) vùng scroll cuộn content + (b) CTA button cố định dưới đáy. Ví dụ: form prefilled (intent 01), cart summary (intent 05), checkout (intent 06), action card list, analytics drill-down (intent 07).

### CSS template (LOCKED)

```css
.phone-frame {
  position: relative;     /* anchor cho bottom-bar absolute */
  display: flex;
  flex-direction: column;
  height: 844px;
  max-height: calc(100vh - 48px);    /* responsive viewport — xem Pattern 2 */
  overflow: hidden;
}
.main-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 18px 130px;           /* padding-bottom tối thiểu 120px, dùng 130-160px nếu content dài */
}
.bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;                       /* ⚠️ BẮT BUỘC: tránh content lộ qua khi scroll lưng chừng */
  background: #FFF8F0;               /* ⚠️ BẮT BUỘC: solid opaque, KHÔNG gradient transparent */
  box-shadow: 0 -8px 16px rgba(255,248,240,0.95),    /* shadow soft thay gradient fade */
              0 -16px 24px rgba(255,248,240,0.6);
  padding: 16px 18px 20px;
  display: flex;
  gap: 10px;
}
```

### ⚠️ CRITICAL: 2 mistakes đã gặp ở Intent 01 v1 — DON'T REPEAT

**Mistake 1 — Gradient transparent bottom-bar:**

```css
/* ❌ ANTI-PATTERN — content lộ qua khi scroll lưng chừng */
.bottom-bar {
  background: linear-gradient(180deg, 
    rgba(255,248,240,0) 0%, 
    rgba(255,248,240,0.9) 30%, 
    #FFF8F0 60%);
}
```

→ Top 30% bottom-bar trong suốt → khi user scroll content qua, nhìn thấy được xuyên qua nút button. **Dùng solid bg + box-shadow soft** thay vào đó (xem template trên).

**Mistake 2 — z-index auto:**

```css
/* ❌ ANTI-PATTERN — content có thể vẽ chồng lên bottom-bar */
.bottom-bar {
  position: absolute;
  bottom: 0;
  /* missing z-index */
}
```

→ Khi cả 2 element absolute trong cùng stacking context, element sau trong DOM ở trên. Nếu content nào đó cũng có position khác static → có thể vượt qua bottom-bar. **Luôn set `z-index: 10`**.

### Padding-bottom rule

```
padding-bottom ≥ button_height + padding_top + padding_bottom + buffer
              ≥ 52 + 16 + 20 + ~32 = 120px tối thiểu
```

- 1 button: 120px đủ
- 2 buttons (commit + draft): 130px thoải mái hơn
- Content dài có chip/badge sát đáy: 160px để không sát rim

---

## 2. Phone-Frame Responsive Viewport

**Vấn đề gặp ở Intent 01 v1:** Phone-frame `height: 844px` cứng. Trên laptop viewport <892px (= 844 frame + 48 body padding), frame tràn ra ngoài viewport → bottom-bar cảm giác "trôi giữa màn hình" thay vì dính đáy.

### CSS template (LOCKED)

```css
body {
  display: flex;
  align-items: center;               /* center phone-frame vertically */
  justify-content: center;
  padding: 24px 14px;
  min-height: 100vh;
}
.phone-frame {
  width: 100%;
  max-width: 414px;
  height: 844px;
  max-height: calc(100vh - 48px);    /* shrink khi viewport thấp */
  /* ... other styles ... */
}
@media (min-width: 1024px) {
  body { padding: 32px; }
  .phone-frame { max-height: calc(100vh - 64px); }   /* tính cả padding 32×2 */
}
```

**Tại sao 48px / 64px?** = body padding top + bottom (24+24 mobile, 32+32 desktop).

**Trade-off:** Trên viewport thấp, phone-frame mất đúng tỷ lệ iPhone 13 thật (844px). Vì mockup demo, không phải product final — acceptable.

---

## 3. Color Palette Extensions

Bổ sung vào palette gốc ở `PHASE_00_DESIGN_SYSTEM.md`. Mỗi nhóm có ý nghĩa semantic riêng:

### 3.1. Mint/Green — "Positive market signal", "rising trend", "stock up"

```css
--trend-green-50:  #ECFDF5;   /* card bg subtle */
--trend-green-100: #D1FAE5;   /* hero gradient stop */
--trend-green-200: #A7F3D0;   /* border */
--trend-green-500: #10B981;   /* primary accent, arrow ↑ */
--trend-green-600: #059669;   /* gradient stop end */
--trend-green-700: #047857;   /* secondary text */
--trend-green-900: #065F46;   /* primary text */
```

**Use cases:**
- Intent 01: Market Trend compact card (State B), `SUGGEST_STOCK_UP` card (State C-rising), State H expanded
- Intent 04 (Recommend): "trending up" badge trên co-purchase items
- Intent 07 (Analytics): "revenue up" charts, positive deltas
- Generic: success states, "đang tăng", positive arrows

### 3.2. Amber — "Wait", "demand falling", "caution non-critical"

```css
--trend-amber-500: #F59E0B;
--trend-amber-600: #D97706;
--trend-amber-700: #92400E;
```

**Use cases:**
- Intent 01: `SUGGEST_WAIT_OR_REDUCE` card (State C-falling)
- Intent 07: "revenue down" charts khi cần action
- Intent 05 (Cart): "Còn ít hàng" badge stock < 10
- Generic: warnings không critical (không phải error đỏ)

**⚠️ Naming clash note:** Đừng nhầm amber này với SALE badge palette (cũng amber). SALE = commercial urgency. AMBER ở đây = caution informational. Same color, different semantic.

---

## 4. Action Card Pattern (`.action-card`)

**Khi nào dùng:** Mọi UI cần show AI suggestion với "Accept / Dismiss" pattern. Đã standardize ở Intent 01, sẽ reuse cho:
- Intent 03 (Search): "Mở rộng tìm kiếm này?" cards
- Intent 04 (Recommend): "Khách thường mua kèm" cards
- Intent 07 (Analytics): "Insights → Action" cards
- Intent 05 (Cart): "Combo này được tặng quà" cards

### CSS skeleton

```css
.action-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #FEF3F8 100%);
  border-radius: 14px;
  padding: 12px;
  border-left: 3px solid;   /* color tùy variant */
  box-shadow: 0 2px 8px rgba(233,30,99,0.06);
}
/* Variants — extend khi cần thêm action_type mới */
.ac-price     { border-left-color: #FB923C; }   /* SUGGEST_PRICE */
.ac-attrs     { border-left-color: #E91E63; }   /* SUGGEST_ATTRS */
.ac-alt       { border-left-color: #F43F5E; }   /* SUGGEST_ALTERNATIVES */
.ac-stock-up  { border-left-color: #10B981; }   /* SUGGEST_STOCK_UP — Intent 01 v2 */
.ac-wait      { border-left-color: #F59E0B; }   /* SUGGEST_WAIT_OR_REDUCE — Intent 01 v2 */
```

**Rule khi thêm variant mới:**

1. Pick 1 màu primary từ palette đã có (đừng tạo màu mới)
2. Update `.ac-<variant>` cho border-left + `.ac-<variant> .ac-icon` cho icon bg + `.ac-<variant> .ac-tag` cho tag bg/color
3. Register `action_type` enum trong `02_DATA_MODEL.md` policies table
4. Update doc handoff intent đó

### Markup template

```html
<div class="action-card ac-<variant>">
  <div class="ac-header">
    <div class="ac-icon"><svg.../></div>
    <div class="ac-title-block">
      <span class="ac-tag">🏷️ <UPPERCASE LABEL></span>
      <div class="ac-title"><Short headline></div>
    </div>
  </div>
  <div class="ac-body">
    <Explanation>, with <strong>key</strong> phrases bolded and <span class="ac-highlight"><number></span> highlighted.
  </div>
  <div class="ac-actions">
    <button class="ac-btn-apply"><Primary CTA></button>
    <button class="ac-btn-dismiss"><Secondary></button>
  </div>
</div>
```

---

## 5. Scenario Variants Pattern (Build Script)

**Khi nào dùng:** Một state render khác nhau tùy điều kiện (rising/falling, success/fail, có data / cold start). Tránh tạo nhiều file HTML riêng copy-paste.

**Pattern Python:**

```python
def build_state_X(scenario: str = "default"):
    """
    scenario:
      - 'rising'   → ...
      - 'falling'  → ...
    """
    if scenario == "rising":
        title_attr = "Intent NN — State X (Rising)"
        variant_html = """..."""
    elif scenario == "falling":
        title_attr = "Intent NN — State X (Falling)"
        variant_html = """..."""

    body = f"""
      <!-- chung -->
      ...
      {variant_html}
      ...
    """
    return page_shell(title_attr, head, body)


# Register trong builders dict:
builders = {
  "intent-NN-state-X-rising.html":  lambda: build_state_X("rising"),
  "intent-NN-state-X-falling.html": lambda: build_state_X("falling"),
}
```

**File naming convention:** `intent-NN-state-X-<scenario>.html` (lowercase, kebab-case scenario name).

**⚠️ Caution với f-string:** Body f-string KHÔNG được chứa `{` hoặc `}` chưa escape. Nếu body có inline CSS dùng `{}` (vd `style="display: {flex}"`), hoặc escape thành `{{` `}}`, hoặc move CSS lên `head` string (recommend).

---

## 6. Compact Card với Expand Pattern

**Khi nào dùng:** Hiển thị data summary trong list view, cho phép user tap để xem full detail trên màn hình riêng.

**Đã có ở Intent 01 v2:**
- `.shopee-card` (compact) State B → tap "Mở rộng" → State D (expanded)
- `.trend-card` (compact) State B → tap "Mở rộng" → State H (expanded)

**Khả năng reuse:**
- Intent 04: Co-purchase compact → expanded
- Intent 07: Chart compact preview → drill-down expanded
- Intent 05: Cart item compact → product detail

### CSS skeleton

```css
.<X>-card {
  background: linear-gradient(160deg, #FFFFFF 0%, <subtle-tint> 100%);
  border-radius: 18px;
  padding: 14px;
  border: 0.5px solid <palette-200>;
  box-shadow: 0 6px 16px rgba(<palette-rgb>, 0.12-0.15);
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}
.<X>-card::before {
  /* radial gradient decoration top-right */
  content: '';
  position: absolute;
  top: -20px; right: -20px;
  width: 90px; height: 90px;
  background: radial-gradient(circle, rgba(<palette-rgb>, 0.18) 0%, transparent 70%);
  border-radius: 50%;
}
.<X>-header { /* flex with title + expand button */ }
.<X>-expand {
  background: rgba(255,255,255,0.7);
  border: 0.5px solid <palette-200>;
  padding: 5px 10px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  /* + chevron icon */
}
```

**Rule:** Compact card height 130-180px (fit nhiều cards trên form). Expand card full-page.

---

## 7. Sparkline / Mini Chart Pattern

**Khi nào dùng:** Show trend over time mà không cần full chart library. Đã dùng ở Intent 01 State B (mini 38px) và State H (medium 64px).

**SVG inline pattern:**

```html
<svg viewBox="0 0 200 38" preserveAspectRatio="none" style="width:100%; height:38px;">
  <defs>
    <linearGradient id="spark-<X>" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="<accent>" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="<accent>" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- area fill -->
  <path d="M0,30 L20,28 ... L200,4 L200,38 L0,38 Z" fill="url(#spark-<X>)"/>
  <!-- line stroke -->
  <path d="M0,30 L20,28 ... L200,4" stroke="<accent>" stroke-width="1.8" fill="none"/>
  <!-- end point dot -->
  <circle cx="200" cy="4" r="2.5" fill="<accent>"/>
</svg>
```

**⚠️ Constraint:** mỗi sparkline có ID gradient unique (`spark-trend-1`, `spark-revenue-1`...) để tránh conflict khi nhiều cùng page.

**Use cases:**
- Intent 01: market trend 90-day sparkline ✅ (đã làm)
- Intent 07: revenue mini chart trong stat cells
- Intent 04: co-purchase frequency mini sparkline

---

## 8. SSE Event Naming Convention (Reminder)

Pattern đã LOCKED ở Intent 01, áp dụng cho mọi intent khác:

- **Lifecycle events:** `status: <phase>` (classifying, analyzing, searching, synthesizing, awaiting_user_input, done)
- **Tool events (parallel batch OK):** `tool_call: <tool_name>` ngay sau khi gọi; `tool_result: <tool_name>` khi nhận về. Parallel batch xếp tool_call liên tiếp, sau đó tool_result liên tiếp.
- **Data payload events:** `[<UPPER_SNAKE_CASE> custom event: data: {...}]` — ví dụ `FORM_PREFILL`, `MARKET_TREND`, `CHART_DATA`, `CART_UPDATED`.
- **Terminal events:** `final: {...}` hoặc `error: {code, message, retriable}`.

→ Khi thiết kế SSE flow cho intent mới, follow đúng pattern này. Đăng ký event names vào `04_INTENT_SPECS.md` của intent đó.

---

## 9. Mockup Skip vs Reuse Decisions

| Khi nào tạo state mới | Khi nào reuse / skip |
|---|---|
| Branch có UI khác biệt lớn (form vs. expanded panel) | Variant nhẹ (rising vs falling cùng layout) — dùng `scenario` parameter (Pattern 5) |
| Error path cần guide user (blur error, low confidence) | Trivial loading dots state — gộp vào main state với class condition |
| Cold start vs có data (empty cart vs có items) | Optional features (wishlist) — skip cho hackathon |

**Quy tắc trung bình:** mỗi intent có 4-8 mockup states. Ít hơn = thiếu coverage edge cases. Nhiều hơn = overengineering, presenter sẽ skip nhiều.

---

## 10. Cross-Intent Concept: "Trend"

⚠️ **Confusion alert** — Có **3 loại "trend"** trong project, đừng nhầm:

| Loại | Source | Scope | UI |
|---|---|---|---|
| `trend_score` (first-party) | Vespa behavior aggregator | Internal — sold/clicks trên shop của merchant | ProductCard badge "↑ TREND" (Intent 03 search) |
| `analytics.trend_history` | Postgres materialized view | Internal — sales history per merchant | Intent 07 chart "doanh thu theo tháng" |
| `market_trend` (Google Trends) | MCP `gtrends.interest_over_time` | **External** — toàn thị trường VN | Intent 01 Market Trend card (State B + H) |

**Rule khi vẽ UI:** Mỗi trend loại sống ở intent riêng, **KHÔNG mix** trên cùng 1 card. Anti-pattern: hiển thị cả "trend nội bộ" và "trend Google" trên ProductCard sẽ confuse merchant ("trend nào quan trọng?").

---

## 11. Decision Log References

Khi thiết kế intent mới mà phát hiện cần concept mới (signal source, action card type, color palette extension), follow workflow:

1. **Propose** trong `DECISIONS.md` dạng ADR
2. **Update** docs liên quan: data model + API contracts + log catalog + field audit + intent specs
3. **Implement** mockup theo design tokens
4. **Patch** cross-intent patterns này nếu có rule mới reusable
5. **Verify** không break existing intents (check 8 files docs + render mockup mọi intent)

Reference flow chuẩn: ADR-031 (Google Trends) — xem `DECISIONS.md` để học cách 1 feature được lan toả qua 8 files docs.

---

## 12. QA Patterns (Từ Bug Fixes Intent 01 v2)

Mọi mockup intent mới PHẢI verify các test case sau:

### 12.1. Bottom-bar scroll lưng chừng test

Scroll `main-scroll` đến các vị trí intermediate (200, 300, 500, 800px). Kiểm tra:
- KHÔNG có content nào lộ qua bottom-bar
- Bottom-bar luôn solid opaque ở vùng button
- Shadow soft mượt mà không cứng

### 12.2. Viewport responsive test

Resize browser height: 700px, 820px, 900px, 1080px. Kiểm tra:
- Phone-frame luôn vừa viewport (không tràn)
- Bottom-bar luôn dính dáy phone-frame (không "trôi" giữa)
- Content trong main-scroll cuộn được đầy đủ

### 12.3. Multi-state navigation test

Mọi link "Mở rộng / Quay lại / Tap chip" giữa các states phải có target rõ ràng (dù mockup tĩnh không thật sự navigate). Note trong handoff file nào link với file nào.

### 12.4. f-string escape test (Python build script)

Nếu dùng f-string trong body, run script + verify no `KeyError` về missing variables (do `{...}` chưa escape).

---

## Appendix A — Quick Reference: Files to Update per Concept Type

| Loại concept | Docs cần update |
|---|---|
| New domain event | `02_DATA_MODEL.md` (payload schema) + `LOG_CATALOG.md` (publish/consume log) + `04_INTENT_SPECS.md` (Events emitted của intent) |
| New MCP tool | `03_API_CONTRACTS.md` (Section 5 tool spec) + `01_ARCHITECTURE.md` (Section 6 tool list) + `LOG_CATALOG.md` (tool call/result log) |
| New action_type | `02_DATA_MODEL.md` (policies table row + action_cards.action_type list nếu có) + intent handoff (UI variant) + this doc (CSS class) |
| New policy rule | `02_DATA_MODEL.md` (policies table row) |
| New behavior event | `07_BEHAVIOR_LOGS.md` (event_type table) + `LOG_CATALOG.md` Section B |
| New ops log message | `LOG_CATALOG.md` Section A |
| New UI field hiển thị | `09_FIELD_AUDIT.md` (audit row) + nếu cần migration, plus `INTENT_AUDIT_REPORT.md` updates |
| New design token (color/spacing/font) | `PHASE_00_DESIGN_SYSTEM.md` + this doc |
| New visual bug fix discovered | This doc Section 12 (QA Patterns) + handoff delta của intent phát hiện |

---

**END OF CROSS-INTENT PATTERNS DOC.** Update doc này khi build mỗi intent mới và phát hiện pattern reusable.
