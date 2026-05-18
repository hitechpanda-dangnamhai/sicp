# Phase 00 — Intent 01 Mockup Handoff

> **Scope:** Mockup tĩnh cho **Intent 01 — Import Products by Image**, gồm main flow + 7 edge/secondary states. Phục vụ Phase 03 implementation reference.
> **Status:** Mockup-only. Không có code React, không có endpoint, không có migration.

---

## Đã làm được

- **Field audit Intent 01** đối chiếu UI ↔ data source theo `09_FIELD_AUDIT.md`:
  - Verdict: **0 migration mới** cần thêm. Tất cả fields đã có trong V001 (products) + V002 (product_attributes + product_embeddings).
  - 4 schema extension TypeScript (transient fields cho vision analysis response + comparison + form state + phase enum).
  - Ảnh sản phẩm lưu inline base64 trong `products.image_data` (đã quyết định ở 09_FIELD_AUDIT.md Section 11) — không cần object storage cho hackathon.
- **Mockup main flow** Intent 01: Upload picker → AI analyzing 4 phases → Form prefilled với confidence badges + Shopee compact card → Commit.
- **Mockup 7 edge/secondary states**: 4-phase analyzing checklist, AI suggestions bubble (3 action cards), Shopee expanded panel (5 similars + AI reasoning), Blur error + retake CTA, Low confidence form (uncertain fields highlighted vàng), Success commit (brain check badge + product preview).
- **Decision UX locked**:
  - Capture entry là **Upload picker brand** (không phải camera live preview đen) — đồng bộ brand pink-orange xuyên 8 intent.
  - Action cards (price/attrs/alternatives) hiển thị dạng **inline AI bubble** trong chat-style stream, không phải bottom sheet.
  - Shopee compare hiển thị **compact card** mặc định trong form (Option 2-B); user tap "Mở rộng" → full panel với 5 similars + AI reasoning.
  - Loading state hiển thị **4-phase breakdown checklist** (uploading → analyzing → embedding → comparing) thay vì 1 spinner đơn lẻ — showcase AI intelligence.
- **Visual nhất quán 100%** với `golden-reference-mockup.html` và các Intent 03/04/05/06/08 đã build (cùng design system v3 MoMo-inspired, cùng tokens, cùng brain icon SVG signature, cùng phone frame 414×844px).

## Module / file đã tạo

```
docs/mockups/intent-01/                                ← khuyến nghị đặt ở đây
  ├── intent-01-state-0-capture.html                   → Entry: upload picker (golden hand-crafted)
  ├── intent-01-state-A-analyzing.html                 → 4-phase loading checklist
  ├── intent-01-state-B-prefilled.html                 → Happy path: form full + Shopee compact (golden hand-crafted)
  ├── intent-01-state-C-suggestions.html               → AI bubble action cards (price/attrs/alt)
  ├── intent-01-state-D-shopee-expanded.html           → Full Shopee panel: 5 similars + reasoning
  ├── intent-01-state-E-blur-error.html                → Blur detected, retake CTA + tips
  ├── intent-01-state-F-low-confidence.html            → Form prefilled với uncertain fields vàng
  ├── intent-01-state-G-success.html                   → Commit success: brain check badge + product preview
  └── build_intent_01.py                               → Builder script cho 6 state secondary (A, C-G)
```

Mỗi file HTML standalone, không phụ thuộc nhau, mở thẳng browser.

**Asset chia sẻ embed trong mỗi file:**
- SVG icon inline (Lucide-style stroke, không dùng webfont CDN) — gọn nhẹ, không request ngoài
- CSS tokens v3 (hồng-cam MoMo) hardcoded inline trong `<style>`
- Be Vietnam Pro + JetBrains Mono load từ Google Fonts
- Brain SVG signature (anatomical, gradient pink→orange với synapse lines + 5 nodes + aura) đồng nhất với Intent 08

## Public interfaces exposed (cho phase sau import)

**TypeScript schema mới cần định nghĩa ở `packages/shared-types/src/imports.ts`:**

```typescript
import { z } from 'zod';

// 1. Gemini Vision LLM output
export const VisionAnalysisResultSchema = z.object({
  title: z.string().min(1).max(200),
  brand: z.string().max(80).optional(),
  category: z.string().max(60),
  attributes: z.array(z.object({
    key: z.string().max(40),               // 'Dung tích', 'Xuất xứ', etc.
    value: z.string().max(80),
  })).max(10),
  description: z.string().max(500).optional(),
  confidence_map: z.record(z.string(), z.number().min(0).max(1)),  // per-field 0..1
  raw_text_detected: z.string().max(2000).optional(),  // OCR backup
});

// 2. Shopee mock comparison
export const ShopeeComparisonSchema = z.object({
  min_price: z.number().int().min(0),
  avg_price: z.number().int().min(0),
  max_price: z.number().int().min(0),
  user_price_percentile: z.number().min(0).max(1),    // 0.6 = top 40%
  similar_products: z.array(z.object({
    name: z.string().max(200),
    price: z.number().int().min(0),
    shop: z.string().max(80),
    rating: z.number().min(0).max(5).optional(),
    sold_count: z.number().int().min(0).optional(),
  })).max(5),
  ai_reasoning: z.string().max(300),
  fetched_at: z.string().datetime(),
});

// 2-bis. Google Trends market demand
export const MarketTrendSchema = z.object({
  current_score: z.number().int().min(0).max(100),
  delta_pct: z.number(),
  trajectory: z.enum(['rising', 'stable', 'falling']),
  series: z.array(z.object({
    date: z.string(),
    value: z.number().int().min(0).max(100),
  })).max(90),
  related_rising: z.array(z.string()).max(5),
  fetched_at: z.string().datetime(),
});

// 3. Form state (prefilled + user-editable)
export const ImportFormSchema = z.object({
  image_data: z.string(),                  // base64 inline
  vision: VisionAnalysisResultSchema,
  comparison: ShopeeComparisonSchema.optional(),
  market_trend: MarketTrendSchema.optional(),  // non-blocking, song song shopee
  user_overrides: z.object({               // user edits diff from vision output
    title: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    price: z.number().int().min(0),        // ALWAYS user-supplied (vision không đề xuất giá final)
    stock: z.number().int().min(0),
    sku: z.string().max(40).optional(),
    attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  }),
});



// 4. SSE phase enum
export const ImportPhaseSchema = z.enum([
  'idle',
  'capturing',
  'uploading',
  'analyzing',
  'embedding',
  'comparing',
  'ready',
  'committing',
  'committed',
  'error',
]);

// 5. Error codes
export const ImportErrorCodeSchema = z.enum([
  'E_VISION_BLUR',              // Image quality too low
  'E_NO_PRODUCT_DETECTED',      // Vision returned no usable content
  'E_LOW_CONFIDENCE',           // Confidence < 0.6 on critical fields
  'E_VISION_TIMEOUT',           // Gemini > 8s
  'E_EMBEDDING_FAILED',         // pgvector embedding error
  'E_SHOPEE_UNAVAILABLE',       // MCP shopee.price_range failed (non-blocking)
  'E_GTRENDS_UNAVAILABLE', //  MCP google trend failed (non-blocking)
  'E_NETWORK',                  // Generic network
]);
```

## SSE / API contract (Phase 03 sẽ implement)

**SSE events** (server-sent từ `/api/v1/imports/sse`):

```
event: import.phase
data: { phase: 'uploading' | 'analyzing' | 'embedding' | 'comparing', progress: 0..1 }

event: import.vision_result
data: { vision: VisionAnalysisResult }

event: import.comparison_result
data: { comparison: ShopeeComparison }

event: import.empty
data: { reason: 'no_product_detected' | 'unclear' }

event: import.error
data: { code: ImportErrorCode, message_vi: string, retry_hint?: string, trace_id: string }

event: import.done
data: { session_id: string }
```

**REST endpoints:**

```
POST  /api/v1/imports/analyze       → starts SSE stream, returns session_id
                                       body: { image_data: base64, mime: 'image/jpeg' }

POST  /api/v1/imports/:session/commit
                                       body: ImportFormSchema['user_overrides']
                                       → returns { product_id: UUID }

POST  /api/v1/imports/:session/cancel  (cleanup transient embedding)
```

**MCP tools required (Phase 03):**

- `vision.analyze_product` — wraps Gemini 1.5 Flash Vision với prompt template tiếng Việt
- `shopee.price_range` — mock data trả về 5 similar + price stats (hackathon dùng fixture, prod replace bằng scraper)
- `vespa.compare_similar` — query Vespa với embedding → top-5 similar products in marketplace (cho action card "Khách thường mua kèm")
- `policy.suggest_actions` — engine chấm điểm để emit 0-3 action cards (SUGGEST_PRICE / SUGGEST_ATTRS / SUGGEST_ALTERNATIVES) dựa trên signals

## ADRs (Architecture Decision Records)

### ADR-01-01 — Image storage: inline base64 in DB

- **Quyết định:** Lưu ảnh sản phẩm dạng base64 string trong `products.image_data` (TEXT column), không dùng S3/object storage.
- **Lý do:** Hackathon scope, < 1000 products dự kiến, mỗi ảnh ~200KB-2MB. Sub-1GB total. Trade-off đơn giản hơn rất nhiều cho infra setup. Đã chốt ở `09_FIELD_AUDIT.md` Section 11.
- **Trade-off:** Bandwidth higher khi list products. Acceptable vì list view dùng thumb 64px (CSS scale down). Sau hackathon nếu scale, migrate sang Cloudflare R2.

### ADR-01-02 — Capture entry: upload picker (không live camera)

- **Quyết định:** State 0 là full-screen pink-orange brand background với 2 CTA "Chụp ảnh" + "Chọn từ thư viện", KHÔNG phải camera live preview đen.
- **Lý do:** Đồng bộ brand Aida xuyên 8 intent (không intent nào dùng nền đen). Camera native sẽ mở qua `<input type="file" accept="image/*" capture="environment">` — OS chrome, không cần custom UI. State 0 thực chất là onboarding moment để giải thích "feature làm gì + tips chụp đẹp".
- **Trade-off:** 1 extra tap so với live camera. Acceptable cho merchant lần đầu — họ cần guidance.

### ADR-01-03 — Loading state: 4-phase breakdown checklist

- **Quyết định:** State A hiển thị 4 phase vertical (✓ uploaded → ✓ analyzed → ⏳ embedding → ⏸ comparing) với spinner trên phase active, KHÔNG phải 1 spinner đơn.
- **Lý do:** Showcase AI intelligence "Hiểu — Học — Hành động" (brand tagline). Merchant thấy AI đang "suy nghĩ nhiều bước" thay vì "loading 3 giây". Đồng bộ với Intent 04 (Recommend) đã có pattern tương tự.
- **Trade-off:** UI phức tạp hơn. Acceptable — hackathon demo cần wow factor.

### ADR-01-04 — Action cards: inline AI bubble (chat-style)

- **Quyết định:** Gợi ý SUGGEST_PRICE / SUGGEST_ATTRS / SUGGEST_ALTERNATIVES hiển thị như chat AI bubble (avatar + bubble + border-left tone), KHÔNG phải bottom sheet hay sidebar.
- **Lý do:** Mạch chuyện chat-flow đồng nhất với Aida brand. Merchant scroll thấy gợi ý xuất hiện dần (animation stagger 0.2s), feel conversational. Phù hợp với Intent 03 đã establish chat pattern.
- **Trade-off:** Action cards chiếm space dọc (vs sheet popover). Acceptable — user có thể dismiss từng cái, không bị spam.

### ADR-01-05 — Shopee compare: expandable card

- **Quyết định:** State B (form prefilled) hiển thị Shopee dạng compact card (price range bar 60px + 3 mini thumbs). Tap "Mở rộng" → State D với full panel (stats 3 ô + range bar to + 5 product cards + AI reasoning strip).
- **Lý do:** Form đã dài (12 fields). Compact card cho overview "giá bạn ổn không?" trong 1 second. User nào muốn deep dive → expand.
- **Trade-off:** 2 state để maintain. Acceptable — Python builder generate cả 2 từ shared template.

### ADR-01-06 — Low confidence UI: yellow border + alt-suggestion chips

- **Quyết định:** Fields có confidence < 60% hiển thị: viền vàng amber (1.5px), background gradient vàng nhạt, badge "X%" amber. Dưới field có chip suggest 2-3 alternative values từ Vision multi-candidate output. Commit button DISABLED đến khi user xác nhận tất cả.
- **Lý do:** Merchant biết ngay "AI không chắc — bạn xác nhận giúp". Alt chips giảm work (tap 1 chip thay vì gõ). Disable commit ngăn dữ liệu rác vào DB.
- **Trade-off:** UX hơi block. Acceptable — data quality > convenience cho catalog import.

### ADR-01-07 — Success state: brain icon + green check badge animation

- **Quyết định:** State G dùng brain icon size 140px với green check badge bottom-right (42px), badge có animation `elastic-pop` (scale 0 → 1.2 → 1 với cubic-bezier spring).
- **Lý do:** Moment celebration. Brain = Aida identity, check = task done. Animation spring tạo "satisfying click" feeling.
- **Trade-off:** None. Pattern này có thể reuse cho các Intent commit-success khác.

### ADR-01-08 — Mock data for hackathon

- **Quyết định:** Shopee comparison dùng fixture (5 similars hard-coded cho ~20 sample products). Vision dùng real Gemini 1.5 Flash API.
- **Lý do:** Shopee không có public price API. Scraper sẽ cần thời gian + có thể bị block. Vision quan trọng hơn cho demo nên dùng API thật.
- **Trade-off:** Demo phải dùng products có sẵn trong fixture. Document rõ list 20 products supported.

## Phase 03 implementation tasks

### Backend (`apps/api`)

- [ ] Endpoint `POST /api/v1/imports/analyze` với SSE response stream
- [ ] MCP tool `vision.analyze_product` — Gemini 1.5 Flash Vision wrapper với Vietnamese system prompt + JSON output schema
- [ ] MCP tool `shopee.price_range` — fixture loader từ `apps/api/fixtures/shopee_mock.json` (20 sample products)
- [ ] MCP tool `vespa.compare_similar` — query Vespa embedding cluster cho action card "Khách thường mua kèm"
- [ ] Policy engine `policy.suggest_actions` — input vision + comparison + user shop state → output 0-3 action cards với scoring rule
- [ ] Endpoint `POST /api/v1/imports/:session/commit` — validate ImportFormSchema, insert vào `products` + `product_attributes` + `product_embeddings`
- [ ] Error handling cho 7 error codes với Vietnamese message_vi

### Frontend (`apps/web/src/features/imports/`)

- [ ] Route `/import` → State 0 component (upload picker)
- [ ] File input hidden + camera trigger (`capture="environment"`)
- [ ] Image compression client-side (max 2MB, resize 1080px max edge) trước khi upload
- [ ] SSE consumer hook `useImportStream(sessionId)` → state machine xử lý 7 phases
- [ ] Component `<AnalyzingPhases />` cho State A với 4-phase animated checklist
- [ ] Component `<PrefilledForm />` cho State B với React Hook Form + Zod validation
- [ ] Component `<ShopeeCompareCard variant="compact|expanded" />` reuse cho State B & D
- [ ] Component `<AIActionBubble type="PRICE|ATTRS|ALT" />` reuse cho State C
- [ ] Component `<FieldConfidenceBadge confidence={0..1} />` — auto pick conf-high / conf-low style
- [ ] Component `<UncertainFieldInput suggestions={[]} />` cho State F
- [ ] Error toast với retry CTA cho State E

### MCP / Infrastructure

- [ ] Gemini API key trong `.env.local` + rate limit handling
- [ ] Vespa schema cho `product_embeddings` (đã có ở V002, verify dim=1024)
- [ ] Action card config trong `apps/api/config/action_cards.yaml` — rule thresholds

## Known issues / trade-offs

1. **Brain SVG repeats trong mỗi file** — 8 files mỗi file embed lại brain SVG (~600 bytes). Tổng ~5KB duplicate. Acceptable cho mockup; Phase 03 sẽ extract thành `<BrainIcon />` component.
2. **Stat counter "98% độ chính xác"** trong State 0 là **claim cho marketing**, không phải metric real. Phase 03 cần đo accuracy thực tế trên test set 100 ảnh và update con số.
3. **Mock IMG_20260517_094132.jpg filename** — placeholder, không phải real file. Phase 03 sẽ generate filename từ timestamp client-side.
4. **Confidence threshold 60%** chia high/low chưa được tune trên data thật. Phase 03 cần grid search trên test set.
5. **Action card priority** chưa có scoring formula cụ thể. Hiện State C show 3 cards cùng lúc; thực tế policy engine có thể chỉ emit 0-1 card phù hợp. Mockup show worst case.
6. **Shopee fixture chỉ 20 sản phẩm** — nếu Vision detect sản phẩm không có trong fixture, fallback path? Cần ADR thêm ở Phase 03.

## QA checklist (cho Phase 03 demo)

- [ ] State 0: nhấn "Chụp ảnh" mở camera native; nhấn "Chọn từ thư viện" mở gallery picker
- [ ] State A: 4 phase progress đúng thứ tự, spinner xoay phase active, check xanh phase done
- [ ] State A: nếu Gemini > 8s → tự chuyển State E với code `E_VISION_TIMEOUT`
- [ ] State B: 12 fields prefilled đúng từ Vision output; price empty (user phải nhập)
- [ ] State B: Shopee compact card hiển thị range bar đúng vị trí user price (% relative)
- [ ] State B: tap Shopee card → navigate State D
- [ ] State C: 3 action cards stagger animation (0.1s, 0.3s, 0.5s delay)
- [ ] State C: tap "Áp dụng 27.000₫" → field price update real-time, card collapse
- [ ] State D: 5 similar products sorted by price asc; user product highlighted với border pink
- [ ] State E: blur detected via Laplacian variance < threshold; retake button reopens camera
- [ ] State F: commit button disabled đến khi tất cả uncertain fields được resolve
- [ ] State F: tap alt-chip → fill field + remove yellow border
- [ ] State G: brain check badge animation elastic-pop visible
- [ ] State G: "Nhập sản phẩm tiếp theo" → reset state, back về State 0
- [ ] All states: phone frame 414×844px, render đúng trên Safari iOS 17+, Chrome Android 12+

## Liên kết tới Phase 03 (Implementation)

- Reference doc này khi build feature folder `apps/web/src/features/imports/`
- Tất cả CSS variables đã align với `apps/web/src/styles/tokens.css` (sẽ tạo ở Phase 00 cuối)
- Brain SVG signature cần extract thành `apps/web/src/components/decor/BrainIcon.tsx` để reuse Intent 04 + Intent 08

---

**Generated:** 2026-05-17
**Mockup count:** 8 states (2 hand-crafted golden + 6 generated)
**Total HTML size:** ~140KB (standalone, no external assets except fonts)
**Next intents to mockup:** Intent 02, Intent 07
