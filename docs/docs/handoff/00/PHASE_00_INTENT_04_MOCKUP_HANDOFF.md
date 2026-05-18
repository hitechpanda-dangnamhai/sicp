# Phase 00 — Intent 04 Mockup Handoff

> **Scope:** Mockup tĩnh cho **Intent 04 — Recommend Products by Image**, gồm main flow + 6 edge states. Phục vụ Phase 05 implementation reference.
> **Status:** Mockup-only. Không có code React, không có endpoint, không có migration.

---

## Đã làm được

- **Field audit Intent 04** đối chiếu UI ↔ data source theo `09_FIELD_AUDIT.md`:
  - Verdict: **0 migration mới** cần thêm. Tất cả fields đã có trong V001/V002/V003/V005/V006.
  - 1 schema extension TypeScript (transient fields cho recommend response).
- **Mockup main flow** Intent 04: chat thread với user image bubble → AI detected attrs → filter chips (3 modes) → product carousel có "lý do gợi ý" inline → category-level co-purchase insight card.
- **Mockup 6 edge states**: Vision analyzing (4-phase loading), Empty results (3 fallback CTAs), Error (timeout + retry), Filter switched (collab signal — re-rank), Add to cart (toast + bump animation), Re-upload (append thread không reset).
- **Decision UX locked**: Re-upload **append**, không reset thread. Người dùng giữ context các gợi ý cũ.
- **Visual nhất quán 100%** với `golden-reference-mockup.html` (cùng design system v3 MoMo-inspired, cùng tokens).

## Module / file đã tạo

```
docs/mockups/intent-04/                            ← khuyến nghị đặt ở đây
  ├── intent-04-state-0-happy.html                 → Main flow (happy path)
  ├── intent-04-state-A-loading.html               → Vision analyzing (4 phases)
  ├── intent-04-state-B-empty.html                 → Vespa returns 0 results
  ├── intent-04-state-C-error.html                 → API error + retry
  ├── intent-04-state-D-filter.html                → Filter switched to collab
  ├── intent-04-state-E-cart.html                  → Add to cart toast + bump
  └── intent-04-state-F-reupload.html              → Re-upload (append thread)
```

Mỗi file standalone, không phụ thuộc nhau, mở thẳng browser.

**Asset chia sẻ embed trong mỗi file:**
- SVG icon sprite (~25 Tabler icons inline `<defs>` — không dùng webfont CDN)
- CSS tokens v3 (hồng-cam MoMo) hardcoded inline trong `<style>`
- Be Vietnam Pro font loaded từ Google Fonts

## Public interfaces exposed (cho phase sau import)

**TypeScript schema mới cần định nghĩa ở `packages/shared-types/src/recommendations.ts`:**

```typescript
// Extends SearchProductSchema với transient fields cho recommend response
export const RecommendedProductSchema = SearchProductSchema.extend({
  reason: z.string().min(10).max(120),                    // LLM gen per-item
  match_score: z.number().min(0).max(1),                  // Vespa rank_score normalized
  match_type: z.enum(['visual', 'collab', 'trending']),   // Source signal
});

export const RecommendationResponseSchema = z.object({
  detected: z.object({
    category: z.string(),
    colors: z.array(z.string()).max(3),                   // hex từ dominant colors
    style_tags: z.array(z.string()).max(4),
  }),
  products: z.array(RecommendedProductSchema).max(10),
  co_purchase_hint: z.object({
    source_category: z.string(),
    target_category: z.string(),
    confidence: z.number().min(0).max(1),
  }).nullable(),
});

// Edge state metadata
export const RecommendationEmptyReason = z.enum([
  'category_not_in_inventory',
  'low_confidence',
  'no_visual_match',
]);

export const RecommendationErrorCode = z.enum([
  'E_VISION_TIMEOUT',
  'E_VISION_BLUR',
  'E_EMBEDDING_FAILED',
  'E_NETWORK',
]);
```

**SSE event names** (FE subscribe `/api/v1/intent/stream`):
- `recommend.phase.uploading` → progress 0-25%
- `recommend.phase.analyzing` → progress 25-50%
- `recommend.phase.embedding` → progress 50-75%
- `recommend.phase.ranking` → progress 75-100%
- `recommend.result` (final payload với `RecommendationResponseSchema`)
- `recommend.empty` (payload có `empty_reason`)
- `recommend.error` (payload có `error_code` + `trace_id`)

**MCP tool sẽ cần (Phase 05 implementation):**
- `vespa.recommend_by_image(image_embedding, filter_merchant_id)` → blend visual + collab + trending

## Decisions thêm vào (đề xuất ghi `DECISIONS.md`)

- **ADR-XXX (Mockup tooling):** Inline SVG sprite cho icons trong mọi mockup HTML, **KHÔNG** dùng `@tabler/icons-webfont` CDN. Lý do: webfont CDN bị artifact viewer / mạng yếu chặn → icon trống tròn rỗng. Production app có thể dùng external sprite file `/public/icons-sprite.svg` (cache được), nhưng mockup standalone phải inline.
- **ADR-XXX (Intent 04 co-purchase):** Skip product-level co-purchase matrix (proposed table `co_purchase_matrix` trong ADR-013). Dùng **category-level co-purchase** từ V006 materialized view `analytics_daily_category` đã có. Đủ tốt cho hackathon, tiết kiệm 1 migration.
- **ADR-XXX (Intent 04 re-upload UX):** Khi user upload ảnh thứ 2 trong cùng session chat, **append vào thread** (collapse câu hỏi cũ thành chip ở top), **không reset**. Lý do: thread = session với AI, người dùng cần giữ context.
- **ADR-XXX (Recommend card width):** Product card trong recommend carousel rộng **172px** (vs 138px standard ở Intent 03 Search). Lý do: cần thêm slot "lý do gợi ý" chip 2 dòng + match badge "98%". Đề xuất thêm token `--w-product-recommend: 172px` vào design system.

> Note: số ADR cụ thể chọn theo `DECISIONS.md` hiện có, đừng overlap.

## Known issues / nợ kỹ thuật

- **Mockup chưa cover các state phụ phụ:** offline state (mất mạng giữa SSE), quota exceeded (vision API hết credit), slow network (>10s timeout warning UI). Phase 05 phát hiện thêm thì bổ sung.
- **Icon `match_type` badge** dùng `eye` (visual) / `users` (collab) — chưa có icon riêng cho `trending` ở match badge (chỉ ở filter chip). Cần quyết định: dùng `trending-up` icon cùng style hay khác?
- **Co-purchase confidence threshold** chưa lock — mockup hiển thị "73% khách mua mì kèm" và "81%" nhưng chưa có rule "min confidence để show". Phase 05 worker-analytics cần define.
- **Mockup HTML không có build pipeline** — sửa visual tokens (vd: đổi `#E91E63`) phải sửa thủ công 7 file. Tương lai có thể viết script generate từ template chung.
- **Accessibility chưa audit** — ARIA labels chỉ làm cho button cơ bản, chưa test với screen reader. Skip cho hackathon nhưng note lại.
- **Animation chưa wrap `@media (prefers-reduced-motion)`** — sẽ làm khi component hóa Phase 05.

## Phase sau (Phase 05) cần lưu ý

- **Visual contract:** 7 file HTML này là source-of-truth. Khi build React component, follow đúng spacing/colors/shadows. KHÔNG tự ý đổi.
- **Component reuse:** 5 trong 7 file dùng chung pattern — extract thành:
  - `<ChatThreadLayout>` (header + chat-area + input-bar)
  - `<UserImageBubble>` (image preview + caption)
  - `<AIBubble>` (avatar orb + bubble với border-radius 4px 18px 18px 18px)
  - `<RecommendProductCard>` (172px width, có reason chip + match badge)
  - `<EmptyStateCard>`, `<ErrorStateCard>`, `<LoadingPhases>` (3 organism mới cho edge states)
- **Field audit đã done** — không cần audit lại Intent 04. Migration count vẫn là 5 (V001+V002+V003+V005+V006).
- **Schema cần code đầu Phase 05:** 4 Zod schemas ở section "Public interfaces" trên. Codegen ra OpenAPI theo workflow `08_FE_BE_CONTRACT.md`.
- **MCP tool `vespa.recommend_by_image`** cần blend formula:
  - visual_score × 0.5 + collab_score × 0.3 + trending_score × 0.2 (mặc định)
  - Khi user tap filter chip "Khách hay mua" → weight đổi: collab × 0.7
  - Khi user tap "Đang trending" → trending × 0.7
- **LLM prompt sinh `reason`** per-item cần lock template. Đề xuất: `"Tóm tắt 1 câu lý do {product.title} phù hợp với ảnh {detected.category} {detected.style_tags}. Tối đa 50 ký tự, giọng văn thân thiện, không liệt kê thông số."`
- **Intent 03 Search có thể reuse** `<ChatThreadLayout>` + `<ProductCard>` từ Intent 04 — chỉ bỏ reason chip + match badge. Vẽ mockup Intent 03 ở conversation tiếp theo follow pattern này.

---

**Updated:** [ngày bạn merge]
**Author:** mockup từ pair-design session với AI
**Reviewers:** [tên team member]
