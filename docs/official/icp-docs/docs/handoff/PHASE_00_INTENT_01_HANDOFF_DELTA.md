# Phase 00 — Intent 01 Mockup Handoff · DELTA v1 → v2

> **Scope:** Patch document cho `PHASE_00_INTENT_01_MOCKUP_HANDOFF.md`. Liệt kê toàn bộ thay đổi sau khi tích hợp Google Trends (ADR-031) + fix 2 bugs visual phát hiện trong QA.
> **Status:** Mockup-only. Đọc kèm handoff gốc, override quyết định nếu conflict.
> **Khi nào dùng doc này:**
> - Reviewer/dev mới đọc Intent 01 → đọc handoff gốc TRƯỚC, sau đó đọc delta này để biết "v2 khác gì v1"
> - Khi build intent khác (02-08) → đọc thêm `PHASE_00_CROSS_INTENT_PATTERNS.md` cho patterns reusable

---

## Tóm tắt thay đổi v2

**Nguyên nhân v2 ra đời:**

1. **Audit phát hiện gap chức năng**: Intent 01 v1 chỉ có Shopee price signal, thiếu **market demand signal** (Google Trends) để merchant quyết định nhập hàng dựa trên cả nhu cầu thị trường, không chỉ giá. Quyết định bổ sung tại ADR-031.
2. **QA phát hiện 2 bugs visual** mà v1 không bắt được:
   - Bottom-bar gradient transparent ở top → content scroll lưng chừng nhìn xuyên qua nút "Lưu sản phẩm"
   - Phone-frame `height: 844px` cứng → laptop viewport thấp (<892px) bị tràn frame, bottom-bar "trôi giữa màn hình"

---

## 1. Mockup files: thay đổi & file mới

### File list v2

| File | v1 | v2 | Thay đổi |
|---|---|---|---|
| `intent-01-state-0-capture.html` | ✅ hand-crafted | ⚠️ minor edit | Cập nhật CSS responsive viewport (xem Bug 2 fix) |
| `intent-01-state-A-analyzing.html` | ✅ | ⚠️ edited | Phase 4 đổi tên "So sánh giá Shopee" → "Phân tích thị trường" với meta "Shopee + Google Trends" (gom 2 external signal thành 1 loading phase) |
| `intent-01-state-B-prefilled.html` | ✅ hand-crafted | ⚠️ edited | Thêm `.trend-card` CSS (mint/green palette) + Market Trend compact card stacked **dưới** Shopee compact card; bottom-bar fix solid bg + z-index 10 |
| `intent-01-state-C-suggestions.html` | ✅ | ❌ deleted | Tách thành 2 variants ↓ |
| `intent-01-state-C-suggestions-rising.html` | — | 🆕 new | Cards: PRICE + ATTRS + `SUGGEST_STOCK_UP` (mint, khi rising > 30%) |
| `intent-01-state-C-suggestions-falling.html` | — | 🆕 new | Cards: PRICE + ATTRS + `SUGGEST_WAIT_OR_REDUCE` (amber, khi falling < -20%) |
| `intent-01-state-D-shopee-expanded.html` | ✅ | ✅ no change | Shopee panel mở rộng giữ nguyên |
| `intent-01-state-E-blur-error.html` | ✅ | ✅ no change | Blur error giữ nguyên |
| `intent-01-state-F-low-confidence.html` | ✅ | ✅ no change (xem note) | **Decision**: KHÔNG thêm Market Trend ở State F để giữ focus của state vào uncertain vision fields. Có thể thêm sau nếu cần consistency |
| `intent-01-state-G-success.html` | ✅ | ⚠️ minor edit | Bottom-bar fix solid bg + z-index 10 |
| `intent-01-state-H-trend-expanded.html` | — | 🆕 new | Google Trends panel expanded, đối xứng State D. Reached khi user tap "Mở rộng" trên Trend compact card ở State B |

### Build script (`build_intent_01.py`)

- `build_state_C()` → `build_state_C(scenario: str)` với `scenario ∈ {"rising", "falling"}`
- Thêm `build_state_H()` mới (Market Trend Expanded)
- Dict `builders` updated: 6 keys → 8 keys (2 keys cho C variants + 1 cho H)
- `BASE_CSS` cập nhật: `body.align-items: center`, `.phone-frame.max-height: calc(100vh - 48px)`, `.bottom-bar` solid bg + z-index 10

---

## 2. Schema updates (cross-reference 8 docs)

Cập nhật tổng hợp sau ADR-031. Mỗi file đã được sửa độc lập.

| Doc | Section | Change |
|---|---|---|
| `02_DATA_MODEL.md` | Section 7 — Event Payload Schemas | `ProductDraftSubmitted` thêm field `market_trend: {current_score, delta_pct, trajectory, related_rising} \| null`; tương tự cho `ProductImported` |
| `02_DATA_MODEL.md` | Section policies table | Thêm 2 rows `MARKET_RISING_v1`, `MARKET_FALLING_v1` |
| `03_API_CONTRACTS.md` | Section 5 — MCP Tool Specs | Thêm tool spec `gtrends.interest_over_time` |
| `04_INTENT_SPECS.md` | Intent 01 — SSE Output sequence | Thêm 3 events: `tool_call: gtrends.interest_over_time`, `tool_result: gtrends.interest_over_time`, `[MARKET_TREND custom event]` |
| `09_FIELD_AUDIT.md` | Section 7.5 (new) | Audit 7 fields của Market Trend UI, all DERIVED transient, 0 migration |
| `LOG_CATALOG.md` | A. Vision / Speech / LLM | Thêm 4 ops log: `gtrends.fetched`, `gtrends.cache_hit`, `gtrends.unavailable`, `gtrends.rate_limited` |
| `DECISIONS.md` | (top of file) | ADR-031 — quyết định bổ sung Google Trends signal |
| `INTENT_AUDIT_REPORT.md` | Intent 01 section + Roadmap | Update field audit (6 rows mới) + dependency note (0 migration; 1 MCP tool + 1 event payload extension) |
| `PHASE_00_INTENT_01_MOCKUP_HANDOFF.md` | Section 3 — Public interfaces | Thêm `MarketTrendSchema`, extend `ImportFormSchema` với `market_trend?` (đã làm) |

---

## 3. Bug fixes phát hiện trong v2

### Bug 1: Bottom-bar gradient transparent — content lộ qua khi scroll lưng chừng

**Triệu chứng:** Khi user scroll `main-scroll` đến vị trí lưng chừng (~300-600px), 3 thumbnail Shopee hoặc Market Trend chips **nhìn thấy được xuyên qua** nút "Lưu sản phẩm" cố định ở đáy.

**Root cause:**
- Bottom-bar `background: linear-gradient(180deg, rgba(255,248,240,0) 0%, rgba(255,248,240,0.9) 30%, #FFF8F0 60%)`
- Top 30% (= ~26px của bottom-bar height 88px) **trong suốt hoàn toàn**
- Bottom-bar `z-index: auto` không cao hơn content scroll
- → Content trượt qua vùng top transparent của bottom-bar → lộ qua

**Fix:**

```css
.bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;                       /* mới: ưu tiên stacking */
  background: #FFF8F0;               /* mới: solid opaque, không gradient */
  box-shadow: 0 -8px 16px rgba(255,248,240,0.95),    /* mới: shadow soft thay gradient fade */
              0 -16px 24px rgba(255,248,240,0.6);
  padding: 16px 18px 20px;
  display: flex;
  gap: 10px;
}
```

**Applied to:** state B, C-rising, C-falling, G, H (mọi state có `.bottom-bar`).

### Bug 2: Phone-frame overflow trên laptop viewport thấp

**Triệu chứng:** Trên màn hình laptop có viewport height < 892px (= 844 frame + 48 body padding), phone-frame bị tràn ra ngoài viewport, body có scroll riêng → bottom-bar cảm giác "trôi giữa màn hình" thay vì dính dáy phone-frame.

**Root cause:** `.phone-frame { height: 844px }` cứng (chiều cao iPhone 13 thật).

**Fix:**

```css
body {
  align-items: center;               /* sửa: từ flex-start → center */
}
.phone-frame {
  height: 844px;
  max-height: calc(100vh - 48px);    /* mới: shrink khi viewport thấp */
}
@media (min-width: 1024px) {
  .phone-frame { max-height: calc(100vh - 64px); }   /* mới: tính cả padding 32px desktop */
}
```

**Applied to:** state 0 (hand-crafted), state B (hand-crafted), `BASE_CSS` trong `build_intent_01.py` (auto-apply cho A, C, D, E, F, G, H).

---

## 4. ADRs mới (extend handoff gốc Section 5)

### ADR-01-09 — Google Trends market demand signal

- **Quyết định:** Thêm MCP tool `gtrends.interest_over_time` (mock với fixture cho hackathon) làm market demand signal song song Shopee price signal.
- **Lý do:** Shopee cho biết "giá thị trường", không cho biết "nhu cầu thị trường". Merchant cần cả 2 để quyết định nhập hàng có cơ sở.
- **Trade-off:** Thêm 1 external dependency. Hackathon dùng fixture (~30 keywords pre-baked). Production replace bằng pytrends hoặc SerpAPI.
- **Reference:** `DECISIONS.md` ADR-031.

### ADR-01-10 — Action cards palette mở rộng

- **Quyết định:** Thêm 2 màu cho action cards: mint/green (`#10B981`) cho "positive market signal" và amber (`#F59E0B`) cho "caution non-critical".
- **Lý do:** 2 màu hiện có (rose, orange) không express được semantic "rising trend" và "wait/caution".
- **Reusable scope:** Palette này được extract ra `PHASE_00_CROSS_INTENT_PATTERNS.md` để Intent 04 (Recommend), Intent 07 (Analytics) reuse khi cần.

### ADR-01-11 — Bottom-bar solid background + z-index

- **Quyết định:** `.bottom-bar` dùng solid bg + box-shadow soft + z-index 10 thay vì gradient transparent.
- **Lý do:** Gradient transparent gây visual bug khi user scroll lưng chừng. Solid bg đảm bảo content scroll không "lộ" qua nút.
- **Trade-off:** Mất visual effect "fade smooth" của gradient. Bù lại bằng box-shadow soft tạo cảm giác layered tự nhiên.
- **Pattern extracted to:** `PHASE_00_CROSS_INTENT_PATTERNS.md` (mọi intent khác có pattern `main-scroll + fixed bottom-bar` PHẢI follow).

### ADR-01-12 — Phone-frame responsive height cho viewport thấp

- **Quyết định:** `.phone-frame` thêm `max-height: calc(100vh - 48px)` để shrink khi viewport laptop nhỏ.
- **Lý do:** Original 844px cứng vượt viewport laptop phổ biến (Dell/Mac 13" ~800px usable).
- **Trade-off:** Trên viewport thấp, phone-frame không đúng tỷ lệ iPhone 13 thật. Acceptable vì là mockup demo, không phải product final.
- **Pattern extracted to:** `PHASE_00_CROSS_INTENT_PATTERNS.md`.

---

## 5. Phase 03 implementation tasks (delta vs v1)

### Backend (`apps/api`)

Thêm vào danh sách Phase 03 tasks v1:

- [ ] MCP tool `gtrends.interest_over_time` — fixture loader từ `apps/mcp/fixtures/gtrends_mock.json` (~30 keywords)
- [ ] Redis cache layer cho Google Trends — TTL 1h, log `gtrends.cache_hit` khi hit
- [ ] Event handler `ProductDraftSubmitted` extend với `market_trend` field
- [ ] Policy engine evaluate 2 new rules `MARKET_RISING_v1`, `MARKET_FALLING_v1`
- [ ] Action card factory thêm 2 templates `SUGGEST_STOCK_UP`, `SUGGEST_WAIT_OR_REDUCE`

### Frontend (`apps/web/src/features/imports/`)

- [ ] Component `<TrendCompactCard variant="compact" />` cho State B
- [ ] Component `<TrendExpandedView />` cho State H mới
- [ ] Route mới `/import/trend-expanded` cho State H (hoặc modal pattern tùy nhóm)
- [ ] Sparkline SVG component (reuse cho cả compact 38px và expanded 64px)
- [ ] SSE event handler `MARKET_TREND` set state `marketTrend` trong form context

### MCP / Infrastructure

- [ ] Fixture file `apps/mcp/fixtures/gtrends_mock.json` — ~30 keywords cho ~20 sample products
- [ ] Module `apps/mcp/tools/gtrends.py` implement tool + cache + logging

---

## 6. Known issues / trade-offs v2

Bổ sung vào danh sách v1:

- **Google Trends fixture limit:** chỉ 30 keywords pre-baked. Nếu vision detect keyword không có trong fixture, fallback path? → Tạm thời return `null`, FE handle gracefully bằng cách ẩn Trend card. Tạo ADR ở Phase 03 nếu cần xử lý phức tạp hơn.
- **State F không có Market Trend:** Inconsistency có chủ đích để giữ focus state. Reviewer có thể thấy lạ — note rõ trong demo presenter brief.
- **2 variants State C rising/falling:** Cần đảm bảo policy engine quyết định đúng variant ở runtime. Nếu policy match cả 2 (edge case — score nằm trong ngưỡng giữa), ưu tiên RISING (story tích cực hơn).

---

## 7. QA checklist update v2

Thêm vào checklist v1:

- [ ] State B: tap "Mở rộng" Trend compact → navigate state H (link wiring trong dev mode)
- [ ] State H: tap chip rising → back state B với attribute added
- [ ] State C-rising vs C-falling: chỉ khác card thứ 3, palette nhất quán
- [ ] **Bottom bar test scroll lưng chừng**: scroll `main-scroll` đến positions 200, 300, 500, 800px — kiểm tra KHÔNG có content lộ qua nút "Lưu sản phẩm" / "Quay lại form" / "Hoàn tất"
- [ ] **Viewport thấp test**: resize browser height xuống 700-820px — phone-frame phải shrink, bottom-bar vẫn dính dáy phone-frame
- [ ] Cross-ref check: `MarketTrendSchema` ở handoff Section 3 khớp `market_trend` ở `02_DATA_MODEL.md` Section 7

---

## 8. Demo flow v2 (updated)

```
State 0 (capture)
  └─► State A (analyzing, 4 phases gồm "Phân tích thị trường")
        └─► State B (form prefilled + Shopee compact + Market Trend compact stacked)
              ├─► tap "Mở rộng" Trend → State H (Trend expanded với 5 chips + AI reasoning)
              │     └─► tap chip "không đường" → back State B với attribute added
              ├─► tap "Mở rộng" Shopee → State D (Shopee expanded)
              │     └─► back State B
              └─► tap "Lưu sản phẩm" → policy engine evaluate market_trend
                    ├─► [delta_pct > 30] → State C-rising (3 cards incl. STOCK_UP)
                    └─► [delta_pct < -20] → State C-falling (3 cards incl. WAIT)
                          └─► user accepts cards → State G (success)
```

**Demo presenter tip:** Pick scenario **rising** cho main flow (story tích cực: AI giúp merchant nắm cơ hội). Falling chỉ show khi demo capability "AI biết cả tin xấu lẫn tin tốt" + giải thích vì sao state có 2 variants.

---

## 9. Cách patch handoff gốc

Bạn có 2 lựa chọn:

### Option A — Giữ 2 file song song (recommend cho hackathon)

- Giữ `PHASE_00_INTENT_01_MOCKUP_HANDOFF.md` (v1) nguyên vẹn như snapshot
- Thêm `PHASE_00_INTENT_01_HANDOFF_DELTA.md` (file này) cạnh nó
- Thêm 1 note đầu file gốc, ngay sau frontmatter:

```markdown
> **⚠️ v2 update notice:** Sau ADR-031, có nhiều thay đổi.
> Đọc kèm `PHASE_00_INTENT_01_HANDOFF_DELTA.md` để biết v2 khác gì.
> Cross-cutting patterns: `PHASE_00_CROSS_INTENT_PATTERNS.md`.
```

### Option B — Merge vào file gốc

- Copy nội dung delta này vào các section tương ứng của handoff gốc
- Xóa file delta sau khi merge xong
- Update version note ở đầu: `> Version: v2 (sau ADR-031)`

→ **Recommend Option A** vì traceability quan trọng hơn neatness trong hackathon. Sau hackathon có thể merge.

### Update `00_CONTEXT.md`

Thêm 2 dòng vào tree `repo layout`:

```
docs/
  phases/
    PHASE_00_DESIGN_SYSTEM.md
    PHASE_00_CROSS_INTENT_PATTERNS.md       ← MỚI
    PHASE_00_INTENT_01_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_01_HANDOFF_DELTA.md     ← MỚI
    PHASE_01_*.md
```

Và thêm rule 18 vào Section 10 — Critical Constraints:

```
18. KHI vẽ intent 02-08 mockup, LUÔN đọc `PHASE_00_CROSS_INTENT_PATTERNS.md`
    TRƯỚC. File này lock các patterns reusable (bottom-bar solid bg + z-index, 
    phone-frame responsive viewport, palette mint/amber, action cards CSS, 
    scenario variants build pattern, sparkline SVG). KHÔNG tự sáng tạo lại 
    nếu đã có sẵn ở doc này.
```

### Update `DECISIONS.md`

Trong ADR-031 (đã có), thêm dòng References cuối:

```markdown
### References
- Handoff updates: `PHASE_00_INTENT_01_HANDOFF_DELTA.md`
- Reusable patterns: `PHASE_00_CROSS_INTENT_PATTERNS.md`
- Mockup deliverable: `intent-01-v5-bottombar-opaque.zip`
```

---

**END OF DELTA HANDOFF.** Đọc cùng `PHASE_00_INTENT_01_MOCKUP_HANDOFF.md` (v1) để có full picture của Intent 01.
