# PHASE 00 — Intent 03 (Search by Text) Mockup Handoff

> **Status:** ✅ Complete · 14 mockup files (2 variants × 7 states)
> **Date:** 2026-05-17
> **Owner:** AI Agent · Phase 00 Mockup Lead
> **Next:** Phase 01 (Backend skeleton) — không cần migration mới cho intent 03

---

## 0. TL;DR

Intent 03 (Search by Text) đã được mockup đầy đủ **2 variants**:

- **Variant A — Search thuần:** kết quả từ Vespa BM25 + facet aggregation. **Không có** reason/match_score. Card width 138px như spec gốc.
- **Variant B — AI-augmented Search:** thêm LLM-generated reason chip + match_score badge per-card + semantic understanding bubble. Card width 172px (giống Intent 04 ADR).

**Migration:** 0 mới. Tổng cross-intent migration count vẫn là 5 (V001+V002+V003+V005+V006).

**Schema extension:** 1 file TypeScript ở `packages/shared-types/src/search.ts` (cho Variant B).

---

## 1. File Inventory

| # | Variant | State | File | Purpose |
|---|---------|-------|------|---------|
| 1 | A | 0 — Happy | `intent-03A-state-0-happy.html` | Search "nước tương Maggi" → 12 results, filter chips + sort, carousel 4 cards |
| 2 | A | A — Loading | `intent-03A-state-A-loading.html` | 4-phase progress (hiểu → lọc → tìm → xếp hạng) + skeleton carousel |
| 3 | A | B — Empty | `intent-03A-state-B-empty.html` | Search "nước mắm Phan Thiết 5L" → 3 fallback CTAs + suggested queries |
| 4 | A | C — Error | `intent-03A-state-C-error.html` | `E_VESPA_TIMEOUT` + retry + history fallback button |
| 5 | A | D — Filter | `intent-03A-state-D-filter.html` | Sort switched to "Bán chạy", re-ranked carousel |
| 6 | A | E — Cart | `intent-03A-state-E-cart.html` | Add-to-cart toast + cart pill overlay + bump animation |
| 7 | A | F — Refine | `intent-03A-state-F-refine.html` | User types "dưới 20.000đ" → collapsed prev + price filter chip |
| 8 | B | 0 — Happy | `intent-03B-state-0-happy.html` | "chai nước tương cho tô phở" — "Đã hiểu ý anh" card + 4 cards có reason + match badge |
| 9 | B | A — Loading | `intent-03B-state-A-loading.html` | Loading + phase "Viết lý do gợi ý cho từng món" (LLM-specific) |
| 10 | B | B — Empty | `intent-03B-state-B-empty.html` | Empty + "Em đoán ý anh là..." interpretation bubble |
| 11 | B | C — Error | `intent-03B-state-C-error.html` | `E_LLM_TIMEOUT` + "Dùng bản cơ bản" fallback (graceful degrade to Variant A) |
| 12 | B | D — Filter | `intent-03B-state-D-filter.html` | "Khớp chính xác" filter — chỉ 3 card có match_score ≥ 0.92 |
| 13 | B | E — Cart | `intent-03B-state-E-cart.html` | Add to cart + co-purchase hint card "68% khách mua kèm Chin-su tương ớt" |
| 14 | B | F — Typo | `intent-03B-state-F-typo.html` | Typo "mai gi" → confirm "Maggi?" → results với match_type=`typo_corrected` |

---

## 2. Field Audit

### Variant A — Search thuần

| UI element | Source | Status |
|---|---|---|
| User text bubble | FE state | ⚠️ DERIVED |
| AI parsed intent label | LLM intent classifier → SSE `status` | ⚠️ DERIVED BE |
| Filter chips category | Vespa facet aggregation | ⚠️ DERIVED BE |
| Result count | `products.length` | ⚠️ DERIVED FE |
| Sort dropdown | FE state, re-query | ⚠️ DERIVED FE |
| Product card 138px (all fields) | `SearchProductSchema` (V001+V002) | ✅ |
| Image fallback gradient + icon_hint | V002 | ✅ |
| Badges (hot/trending/new/sale) | BE-derived V001+V002 | ✅ |
| Stock low/out badge | FE-derived từ `stock` | ⚠️ DERIVED FE |
| Empty state | `results.length === 0` | ⚠️ DERIVED |
| Loading skeleton | SSE phase events | ⚠️ DERIVED FE |
| Error state | SSE `error` event | ⚠️ DERIVED |
| Query typo suggestion (optional) | MCP `vespa.suggest` | ❌ MISSING (optional for hackathon) |

**Verdict:** ✅ 0 migration, 0 schema extension. Có thể skip `vespa.suggest` cho hackathon (dùng substring match đơn giản).

### Variant B — AI-augmented Search

Tất cả của A, **PLUS**:

| UI element | Source | Status |
|---|---|---|
| `reason` chip per-product | LLM gen per-item (transient) | ⚠️ DERIVED BE (cần schema mới) |
| `match_score` badge "98%" | Vespa rank_score normalized [0,1] | ⚠️ DERIVED BE |
| `match_type` badge icon | Vespa rank_profile metadata | ⚠️ DERIVED BE |
| "Đã hiểu ý anh: <X>" understanding card | LLM rewrite query | ⚠️ DERIVED BE |
| Co-purchase hint card (state E) | V006 materialized view `analytics_daily_category` | ✅ (category-level) |

**Verdict:** ✅ 0 migration, 1 TypeScript schema extension.

---

## 3. Schema Extension cho Variant B

File: `packages/shared-types/src/search.ts`

```typescript
import { z } from 'zod';
import { SearchProductSchema } from './product';

export const AugmentedSearchProductSchema = SearchProductSchema.extend({
  /** LLM-generated reason for ranking this product. Transient, not persisted. */
  reason: z.string().min(10).max(80).nullable(),

  /** Normalized rank score from Vespa, [0,1]. */
  match_score: z.number().min(0).max(1),

  /** Why this product matched the query. */
  match_type: z.enum(['exact', 'semantic', 'typo_corrected', 'brand_match']),
});

export const SearchResponseSchema = z.object({
  query_original: z.string(),
  query_understood: z.string().nullable(),

  detected_filters: z.object({
    brand: z.string().nullable(),
    category: z.string().nullable(),
    price_range: z.tuple([z.number(), z.number()]).nullable(),
  }),

  products: z.array(AugmentedSearchProductSchema),

  facets: z.object({
    categories: z.array(z.object({ name: z.string(), count: z.number() })),
  }),

  /** "Có phải anh tìm: ..." suggestions for typos / empty results. */
  suggested_queries: z.array(z.string()).max(3),
});

export type AugmentedSearchProduct = z.infer<typeof AugmentedSearchProductSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
```

### SSE Event Sequence (Variant B)

```
search.phase.parsing      → "Hiểu ngữ nghĩa câu hỏi" (LLM intent + filter extraction)
search.phase.querying     → "Tìm sản phẩm khớp nghĩa + tên" (Vespa retrieve)
search.phase.reasoning    → "Viết lý do gợi ý cho từng món" (LLM per-item)
search.phase.ranking      → "Xếp hạng theo độ phù hợp"
search.result             → final products array
search.empty              → empty state with suggested_queries
search.error              → fallback to Variant A
```

---

## 4. ADRs (Architecture Decision Records)

### ADR-03-01 — Two-variant search strategy

**Decision:** Triển khai 2 endpoint song song:
- `POST /api/search` (Variant A — Vespa BM25 thuần, ~150ms p50)
- `POST /api/search/augmented` (Variant B — Vespa + LLM reason, ~1.2s p50)

**Rationale:** Variant A là baseline nhanh, dùng khi user gõ từ khóa rõ ràng. Variant B chậm hơn nhưng cung cấp giải thích cho query mơ hồ. FE chọn variant dựa trên độ dài + độ phức tạp của query (heuristic: query có động từ / câu hoàn chỉnh → B, query có dấu cách ít → A).

**Tradeoff:** 2 endpoint → 2x code path. Nhưng schema chia sẻ (A = subset của B), nên đơn giản.

---

### ADR-03-02 — Card width 172px cho Variant B

**Decision:** Card carousel của Variant B rộng 172px (vs 138px của Variant A).

**Rationale:** Reason chip 2 dòng + match badge top-right cần thêm horizontal space. 138px chỉ vừa cho title + price; nhồi thêm reason vào sẽ làm chip bị clamp xuống 1 dòng và không đọc được.

**Tradeoff:** Carousel hiện ~2.4 cards thay vì ~2.8 — user phải swipe nhiều hơn. Acceptable vì AI mode → context-heavy.

---

### ADR-03-03 — Match badge visual encoding

**Decision:**
- **Position:** top-right floating pill, `rgba(255,255,255,0.95)` + `backdrop-filter:blur(4px)` + 0.5px white border.
- **Color** (by match_score):
  - `≥0.9` → `#10B981` (green)
  - `≥0.7` → `#F59E0B` (amber)
  - `<0.7` → `#9F1239` (pink-rose)
- **Icon** (by match_type):
  - `exact` → `i-target`
  - `semantic` → `i-sparkles`
  - `typo_corrected` → `i-check`
  - `brand_match` → `i-cube`

**Rationale:** Người dùng quét carousel rất nhanh. Color encoding cho score + icon cho match type tạo ra glanceable signal mà không cần đọc chữ.

---

### ADR-03-04 — Reason chip style

**Decision:**
- Background: `linear-gradient(135deg, #FFF1F5, #FCE7F3)` (pink rất nhạt).
- Border: 0.5px solid `#FBCFE8`.
- Sparkle icon prefix (#E91E63).
- 2-line max với `-webkit-line-clamp:2`.
- Min-height 26px để các card cùng row cao bằng nhau.

**Rationale:** Reason chip cần được nhận diện là **AI-generated content** (khác với UI thường). Pink gradient nhạt + sparkle icon = AI brand language. Hard cap 2 dòng + min-height = không phá vỡ grid alignment.

**Word budget:** LLM prompt phải sinh reason ≤ 80 chars (~ 14-16 từ tiếng Việt). Test: "Khớp tên + thương hiệu Maggi" (28 chars), "Độ đậm cao, khách phở hay chọn nhất" (38 chars) — pass.

---

### ADR-03-05 — Co-purchase hint dùng category-level data

**Decision:** Co-purchase card ở state E (Variant B) dùng **category-level** join từ V006 `analytics_daily_category` materialized view, **không phải** product-level `co_purchase_matrix`.

**Rationale:** Product-level cần `cross_purchase_count` precomputed cho mỗi cặp product. Với 10k products → 100M cặp → bảng quá lớn, không khả thi cho hackathon. Category-level (~50 categories → 2.5k cặp) đủ chính xác và tận dụng V006 đã có sẵn (cũng dùng cho Intent 04).

**Tradeoff:** Co-purchase suggestion sẽ là "khách mua nước tương thường lấy tương ớt" (category) thay vì "khách mua Maggi 700ml thường lấy Chin-su tương ớt 250g" (product). Một chút thiếu chính xác, nhưng vẫn hữu ích.

**Phase 02 task:** Tạo `MCP tool: search.copurchase_hints(query_categories: string[]) → CopurchaseHint[]`.

---

### ADR-03-06 — Typo correction UX

**Decision:** Khi Vespa trả về < 3 kết quả với `match_score` cao và LLM phát hiện khả năng typo:
1. AI bubble hỏi confirm: "Có phải anh đang tìm Maggi?"
2. 2 button: **[Đúng rồi]** (chuyển query → "Maggi" + re-search) và **[Không, tìm 'mai gi']** (giữ nguyên).
3. Khi confirm, results hiển thị với `match_type: 'typo_corrected'` + match_score thường ~0.85-0.95.

**Rationale:** Tránh silent rewrite — người dùng cần biết AI đã sửa gì. Pattern này quen thuộc từ Google.

**Phase 02 task:** Backend phải trả về `original_query` + `corrected_query` trong response để FE có thể show diff UI.

---

### ADR-03-07 — Graceful degradation từ B sang A khi LLM fail

**Decision:** Nếu LLM timeout (`E_LLM_TIMEOUT`) trong khi đang chạy Variant B:
- Hiển thị error card với 2 button: **[Thử lại với AI]** và **[Dùng bản cơ bản]**.
- "Dùng bản cơ bản" → chuyển route sang Variant A endpoint (không có reason/match) — vẫn có kết quả search.

**Rationale:** AI là enhancement, không phải dependency cứng. User vẫn cần search được khi AI fail. State C của Variant B mockup minh họa pattern này.

---

### ADR-03-08 — Semantic understanding card trước carousel (Variant B only)

**Decision:** Khi query có ngôn ngữ tự nhiên (ví dụ "chai nước tương cho tô phở"), Variant B hiển thị **understanding card** trước carousel:
- Header: "ĐÃ HIỂU Ý ANH" với lightbulb icon.
- Body: 2-3 câu giải thích AI đã interpret query thế nào.
- Card có border-radius `4px 18px 18px 18px` (giống AI bubble) để visually connect với AI orb avatar bên trái.

**Rationale:** Build trust — user thấy AI thực sự "hiểu" thay vì làm bừa. Cũng giúp user phát hiện hiểu sai sớm và sửa query.

---

## 5. Visual Consistency Notes

Tất cả 14 file đều dùng cùng tokens v3 inline (không CDN icon):
- **Phone frame:** 414px max-width, 844px min-height, gradient bg `#FCE7F0→#FEEEE0→#FFF8F0`, border-radius 24px, shadow `0 20px 60px rgba(233,30,99,0.18)`.
- **Header avatar:** "AN" (Anh Nam) trên orange gradient — user persona xuyên suốt.
- **AI orb avatar:** 28px radial gradient `#FFF→#FFE4E6→#FB923C` với sparkle icon `#BE185D`.
- **AI bubble:** white bg, 0.5px `#FBCFE8` border, `border-radius: 4px 18px 18px 18px`, padding 10px 14px.
- **User bubble:** pink gradient `#E91E63→#EC4899`, `border-radius: 18px 18px 4px 18px`, shadow pink 22%.
- **Primary CTA:** pink gradient `#E91E63→#F43F5E`, shadow pink 30%.
- **Bottom nav:** 4-tab (Trang chính / Trò chuyện=active / Đề xuất=badge 2 / Cửa hàng), pink gradient indicator top.
- **Input bar:** white-pink gradient, sparkle prefix icon, camera + mic buttons.

SVG icon sprite (~32 symbols) inline trong mỗi file — không phụ thuộc Tabler CDN per Intent 04 ADR.

---

## 6. Phase 02 Implementation Tasks

### Backend (NestJS)
- [ ] `POST /api/search` — Vespa BM25 + facet aggregation, returns `SearchResponseSchema` (without reason/match_score).
- [ ] `POST /api/search/augmented` — pipeline: LLM intent → Vespa rank → LLM reason gen per-item.
- [ ] SSE stream endpoint trả về phase events (`search.phase.*`) cho loading state.
- [ ] `MCP tool: search.copurchase_hints(query_categories: string[])` cho state E của Variant B.
- [ ] Error mapping: Vespa timeout → `E_VESPA_TIMEOUT`, LLM timeout → `E_LLM_TIMEOUT`.

### Frontend (Next.js)
- [ ] `components/search/SearchResultCarousel.tsx` — render 138px cards (variant A) hoặc 172px cards (variant B) tùy prop.
- [ ] `components/search/ReasonChip.tsx` — sparkle prefix + 2-line clamp.
- [ ] `components/search/MatchBadge.tsx` — color + icon by score/type.
- [ ] `components/search/UnderstandingCard.tsx` — Variant B only, lightbulb header.
- [ ] `components/search/TypoCorrection.tsx` — confirm bubble với 2 button.
- [ ] `components/search/CoPurchaseHint.tsx` — single product card 54px image + add button (Variant B state E).
- [ ] State machine: idle → parsing → querying → reasoning → ranked | empty | error.
- [ ] Heuristic chọn variant A vs B (query length, has verb, etc.) — initial cut: dùng B nếu query > 4 từ HOẶC có từ "cho", "để", "khi".

### Shared types
- [ ] Tạo `packages/shared-types/src/search.ts` với `AugmentedSearchProductSchema` + `SearchResponseSchema`.

### Vespa schema (nếu chưa có)
- [ ] Rank profile `bm25_with_metadata` trả về `match_score` (normalized) + `match_type` (computed: exact match → 'exact', vector similarity → 'semantic', edit_distance > 0 → 'typo_corrected', brand-only → 'brand_match').

---

## 7. Known Issues / Tradeoffs

1. **Reason chip có thể bị truncate ở 2 dòng** nếu LLM sinh > 80 chars. Mitigation: prompt cứng "viết tối đa 14 từ tiếng Việt".
2. **Co-purchase chỉ category-level** — không cá nhân hóa theo product cụ thể.
3. **Variant heuristic ở FE** sẽ sai một số case (query ngắn nhưng cần AI). Có thể bổ sung toggle "Dùng AI gợi ý" cho user override.
4. **Typo correction** chỉ phát hiện sai 1 từ chính (brand name). Sai trên 2 từ → fallback empty state.
5. **Loading 4-phase** có thể nhìn fake nếu BE thực tế quá nhanh (< 300ms). Mitigation: artificial delay 200ms mỗi phase để visual feel honest.

---

## 8. Visual QA Checklist

Trước khi merge sang Phase 02, designer/PM review từng file:

- [ ] Variant A: card 138px, không có reason chip, không có match badge top-right.
- [ ] Variant B: card 172px, có reason chip (gradient pink), có match badge (color theo score).
- [ ] Loading: 4 phase với icon check khi done + animated bar/ring khi in-progress.
- [ ] Empty: 3 fallback CTA (broader search / image / new item) + suggested queries.
- [ ] Error: error code rõ ràng (`E_VESPA_TIMEOUT` hoặc `E_LLM_TIMEOUT`) + retry button.
- [ ] Cart: success bubble green + undo button + cart pill overlay trên input bar.
- [ ] Filter: chip active có gradient pink/green, chip inactive white-pink border.
- [ ] Typo (B only): confirm question + 2 button trước khi show results.

---

## 9. References

- `00_CONTEXT.md` — project anchor (intents 1-8, stack)
- `09_FIELD_AUDIT.md` — locked badge derivation + SearchProductSchema
- `PHASE_00_DESIGN_SYSTEM.md` — v3 MoMo tokens
- `PHASE_00_INTENT_04_MOCKUP_HANDOFF.md` — sibling handoff (image recommend)
- `golden-reference-mockup.html` — visual baseline

---

**Handoff complete. Ready for Phase 01 backend skeleton.**
