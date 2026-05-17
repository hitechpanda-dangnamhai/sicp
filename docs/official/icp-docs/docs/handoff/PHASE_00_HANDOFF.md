# Phase 00 — Handoff (Design System & Mockups)

> **Scope:** Phase 00 = Design foundations + UI mockup cho cả 8 intents. **Mockup-only, không code production.**
> Dùng file này thay vì đọc 11 docs handoff riêng lẻ khi vào Phase 01+.
> Khi build feature ở phase sau, chỉ cần đọc `PHASE_00_HANDOFF.md` (file này) + `PHASE_00_DESIGN_SYSTEM.md` + `PHASE_00_CROSS_INTENT_PATTERNS.md` + handoff intent-specific (nếu cần chi tiết deeper).

---

## Phase summary

- **Phase:** 00 — Design System & Mockups
- **Duration thực tế:** ~7 ngày (1 ngày design tokens + 6 ngày mockup 8 intents)
- **Status:** ✅ Done
- **Date:** 2026-05-17
- **Deliverable:** 87 mockup HTML files + 8 Python builders + design system doc + cross-intent patterns + 11 intent-level handoff docs

---

## Đã làm được

### Design foundations

- [x] **Design System v3 (MoMo Premium)** locked tại `PHASE_00_DESIGN_SYSTEM.md`:
  - 6 color ramps (Pink dominant 70% + Orange accent 20% + Rose / Amber / Mint / Lilac)
  - 8 signature gradients (`--grad-hero`, `--grad-orb`, `--grad-mic`, `--grad-badge-ai`, ...)
  - Shadow palette hồng (KHÔNG đen) — `--shadow-pink-sm/md/lg/xl`
  - Typography Be Vietnam Pro + JetBrains Mono
  - Type scale mobile-optimized
  - Layout mobile-first 414×844px (iPhone 13)
  - 5 component anatomy recipes (Hero Card / Stat Bar / Hero Tile / List Card / Input Bar / Bottom Nav)
- [x] **Brand identity "Aida — AI Brain"** locked:
  - Brain SVG anatomical (concept C) với synapse lines + 5 nodes + aura pulse
  - Tagline "Hiểu — Học — Hành động"
  - Main tagline "Mỗi quyết định đều được kết nối thông minh"
  - Reusable `mini_brain(size)` function — dùng làm header avatar, loading state, success badge

### 8 Intent mockups (toàn bộ scope hackathon)

- [x] **Intent 01 — Import by Image** (v2): 11 HTML states (capture / analyzing / form prefilled với Shopee compact + Market Trend compact / 2 variants suggestions rising-falling / Shopee expanded / blur error / low confidence / success / Trend expanded)
- [x] **Intent 02 — Buy by Voice**: 8 HTML states (mic idle / listening orb / 4-phase transcribing / cart ready multi-item / clarify ambiguous / cart added + co-purchase / no match alternatives / error E_TRANSCRIBE_FAILED)
- [x] **Intent 03 — Search by Text**: 14 HTML states (2 variants × 7 states — Variant A baseline Vespa BM25 + Variant B AI-augmented với reason chip + match badge)
- [x] **Intent 04 — Recommend by Image**: 7 HTML states (happy / loading / empty / error / filter switched collab / cart added / re-upload append thread)
- [x] **Intent 05 — View Cart by Text**: 8 HTML states (happy 4 items / loading skeleton / empty brain + 3 CTAs / qty update optimistic / swipe-to-delete + undo / stock issue + AI replacement / clear confirm modal / promo applied + confetti)
- [x] **Intent 06 — Pay Order by Text**: 9 HTML states (confirm / address picker / method picker 5 options / processing brain pulse / success confetti / declined shake / network timeout với idempotency / OTP 3DS / receipt với QR)
- [x] **Intent 07 — Analyze by Voice**: 11 HTML states (mic idle / listening orb / 4-phase analyzing / chart line full grid / chart bar full axis / chart donut simplified / empty no data / drilldown expanded / action suggestion amber+green / clarify / error E_ANALYTICS_TIMEOUT)
- [x] **Intent 08 — Login/Logout by Text**: 7 HTML states (splash brain / login form / loading / wrong password shake / network error / success greeting / logout confirm)

### Cross-cutting deliverables

- [x] **`PHASE_00_CROSS_INTENT_PATTERNS.md`** — 12 patterns reusable + QA tests + appendix files-to-update map
- [x] **`PHASE_00_INTENT_01_HANDOFF_DELTA.md`** — v1 → v2 patch document (Google Trends ADR-031 + 2 bug fixes)
- [x] **`CROSS_INTENT_BUG_IMPACT_ANALYSIS.md`** — audit 2 bugs visual ảnh hưởng intents khác
- [x] **2 bugs visual phát hiện + fix:**
  - Bug 1: Bottom-bar gradient transparent → solid bg + z-index 10 + box-shadow soft
  - Bug 2: Phone-frame `height: 844px` cứng → `max-height: calc(100vh - 48px)` responsive
  - Đã apply fix cho cả 8 intents
- [x] **3 loại "trend" disambiguation** — lock trong Cross-Intent §10 (Vespa `trend_score` vs Google Trends `market_trend` vs internal `analytics.trend_history`)

### Field audits & migration roadmap

- [x] **Field audit 8 intents** — đối chiếu UI ↔ data source theo `09_FIELD_AUDIT.md` rule
- [x] **Migration roadmap LOCKED** (xem section "Database changes planned" bên dưới)
- [x] **Schema extensions (TypeScript) LOCKED** — 8 files Zod schemas chuẩn bị cho `packages/shared-types/`

### Items deferred

- [ ] **Component library React** — chưa code, chỉ có HTML reference. Phase 01 sẽ build từng atom/molecule khi cần.
- [ ] **V004 (promotions table)** — deferred sau Phase 04, có thể skip cho hackathon
- [ ] **V007 (media uploads / S3)** — deferred, dùng base64 inline cho hackathon (ADR-01-01)
- [ ] **Receipt PDF generator** — deferred sau Phase 06, FE chỉ render HTML receipt với QR

---

## File / folder đã tạo

```
docs/
  phases/
    PHASE_00_DESIGN_SYSTEM.md                    ← Design tokens v3 LOCKED
    PHASE_00_CROSS_INTENT_PATTERNS.md            ← 12 patterns reusable (LOCKED)
    PHASE_00_HANDOFF.md                          ← FILE NÀY
    PHASE_00_INTENT_01_MOCKUP_HANDOFF.md         ← Intent 01 chi tiết
    PHASE_00_INTENT_01_HANDOFF_DELTA.md          ← v1→v2 patch (Google Trends)
    PHASE_00_INTENT_02_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_03_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_04_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_05_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_06_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_07_MOCKUP_HANDOFF.md
    PHASE_00_INTENT_08_MOCKUP_HANDOFF.md
    CROSS_INTENT_BUG_IMPACT_ANALYSIS.md

docs/mockups/                                    ← khuyến nghị đặt mockup ở đây
  intent-01/   (11 HTML + build_intent_01.py)
  intent-02/   (8 HTML + build_intent_02.py)
  intent-03/   (14 HTML — 2 variants × 7 states + build_intent_03.py)
  intent-04/   (7 HTML)
  intent-05/   (8 HTML + build_intent_05.py)
  intent-06/   (9 HTML + build_intent_06.py)
  intent-07/   (11 HTML + build_intent_07.py)
  intent-08/   (7 HTML + build_intent_08.py)

Total: 75 HTML mockup files + 8 Python builders + 13 markdown docs
```

**Lưu ý:** Mỗi HTML standalone. Mở thẳng browser, không cần build pipeline. Asset embed inline (SVG icons, CSS tokens, Google Fonts từ CDN).

---

## Public interfaces exposed (cho phase sau)

### REST endpoints (Phase 01+ implement)

Tổng cộng **~25 endpoints** sẽ implement xuyên Phase 02-06. Group theo intent:

```
Intent 08 (Phase 02 — auth):
  POST   /api/v1/auth/login                      LoginRequest → LoginResponse + Set-Cookie
  POST   /api/v1/auth/logout                     (cookie) → {revoked_at}

Intent 03 (Phase 02 — search):
  POST   /api/v1/search                          (Variant A — BM25 thuần)
  POST   /api/v1/search/augmented                (Variant B — LLM-augmented)

Intent 01 (Phase 03 — import):
  POST   /api/v1/imports/analyze                 SSE stream phases
  POST   /api/v1/products                        commit prefilled draft

Intent 02 + 05 + 06 (Phase 04):
  POST   /api/v1/voice-buy/start                 SSE init
  PUT    /api/v1/voice-buy/:session/audio        chunked upload
  POST   /api/v1/voice-buy/:session/clarify
  POST   /api/v1/voice-buy/:session/commit       bulk Redis cart add
  GET    /api/v1/cart                            via cart.get MCP tool
  PATCH  /api/v1/cart/items/:product_id          qty update
  DELETE /api/v1/cart/items/:product_id
  DELETE /api/v1/cart                            clear
  POST   /api/v1/cart/promo                      apply promo code
  POST   /api/v1/orders                          create order (status=pending)
  POST   /api/v1/orders/:id/pay                  initiate payment
  POST   /api/v1/orders/:id/verify-otp           3DS submit
  GET    /api/v1/orders/:id                      fetch detail
  GET    /api/v1/orders/:id/receipt              generate receipt
  GET    /api/v1/orders/:id/stream               SSE real-time status

Intent 04 (Phase 05):
  POST   /api/v1/recommend/by-image              SSE phases

Intent 07 (Phase 05):
  POST   /api/v1/analyze/start                   SSE init
  PUT    /api/v1/analyze/:session/audio
  POST   /api/v1/analyze/:session/clarify
  POST   /api/v1/analyze/:session/drilldown
```

### MCP tools planned

Phase 03+ sẽ build các MCP tools sau (LangGraph gọi qua MCP server, không call DB trực tiếp):

```
auth.verify_jwt(token)                          → {user_id, role} | null
text.embed(text)                                → {vector: float[768]}

# Search & Vision
vespa.hybrid_search(query, filters, limit)      → {products[], facets}
vespa.suggest(prefix)                           → string[]  (optional)
vespa.recommend_by_image(image_emb, merchant)   → {products[]} blend visual+collab+trending
vision.analyze_product(image_bytes)             → VisionAnalysisResult
vision.embed(image_bytes)                       → {vector: float[768]}

# Shopee mock + Google Trends (Intent 01)
shopee.price_range(query)                       → ShopeeComparison
gtrends.interest_over_time(keyword)             → MarketTrend (fixture ~30 keywords)

# Speech (Intent 02 + 07)
speech.transcribe(audio_chunks)                 → VoiceTranscriptionResult (streaming partial)
intent.parse_bulk_buy(transcript)               → BuyIntent
intent.classify_analyze(transcript)             → {chart_type, dimensions, date_range, ...}

# Cart (Intent 05) — 7 tools
cart.get(user_id)                               → Cart
cart.update_qty(user_id, product_id, qty)       → Cart
cart.remove(user_id, product_id)                → Cart
cart.clear(user_id)                             → {cleared: true}
cart.validate_stock(user_id)                    → {updates[]}
cart.apply_promo(user_id, code)                 → Cart | {error}
cart.remove_promo(user_id)                      → Cart

# Search co-purchase hints (Intent 03)
search.copurchase_hints(query_categories)       → CopurchaseHint[]

# Analytics (Intent 07)
analytics.aggregate({merchant_id, dimension, date_range, metric})
                                                → ChartSeries[]  (query V006)
analytics.detect_anomaly(series, threshold_pct) → AnalyticsInsight[]
```

### Events planned (Kafka topics)

```
icp.users.activity        → UserLoggedIn, UserLoggedOut
icp.products.events       → ProductDraftSubmitted, ProductImported (với market_trend payload)
icp.orders.events         → OrderPlaced, OrderPaid, OrderFailed, OrderCancelled
icp.cart.events           → CartItemAdded, CartItemRemoved, CartQtyUpdated, CartCleared
icp.behavior.events       → ProductClicked, ProductViewed, RecommendationDismissed, SearchPerformed
icp.analytics.events      → InsightGenerated, InsightDismissed, InsightActionApplied
```

### Shared types planned (`packages/shared-types/`)

8 Zod schema files được lock từ mockup. Implement Phase 01+:

| File | Source intent | Schemas |
|---|---|---|
| `auth.ts` | Intent 08 | `LoginRequestSchema`, `LoginResponseSchema`, `AuthErrorCode` |
| `search.ts` | Intent 03 | `SearchProductSchema`, `AugmentedSearchProductSchema`, `SearchResponseSchema` |
| `imports.ts` | Intent 01 | `VisionAnalysisResultSchema`, `ShopeeComparisonSchema`, `MarketTrendSchema`, `ImportFormSchema` |
| `voice-buy.ts` | Intent 02 | `VoiceTranscriptionResultSchema`, `BuyItemQuerySchema`, `BuyIntentSchema`, `ItemMatchSchema`, `ClarifyQuestionSchema`, `VoiceBuyPhaseSchema`, `VoiceBuyErrorCodeSchema` |
| `recommendations.ts` | Intent 04 | `RecommendedProductSchema`, `RecommendationResponseSchema`, `RecommendationEmptyReason`, `RecommendationErrorCode` |
| `cart.ts` | Intent 05 | `CartItemSnapshotSchema`, `CartItemSchema`, `CartSchema` |
| `order.ts` | Intent 06 | `PaymentMethodEnum`, `OrderStatusEnum`, `ShippingAddressSchema`, `TransactionSchema`, `OrderSchema` |
| `analytics.ts` | Intent 07 | `AnalyticsChartSpecSchema`, `AnalyticsResponseSchema`, `AnalyticsClarifyQuestionSchema`, `AnalyzePhaseSchema`, `AnalyzeErrorCodeSchema` |

### Database changes planned (migration roadmap)

**Bắt buộc cho hackathon:**

| Migration | Cho intent | Priority | Phase | Lý do |
|---|---|---|---|---|
| **V001** (existing) | All | — | P01 | Core schema (users, sessions, products, orders, transactions, action_cards, policies) |
| **V002** (existing) | Intent 03 | P0 | P01 | Search: product_attributes + product_embeddings |
| **V003 — insights** | Intent 07 + Hero card | P0 | P02 | Persist AI insights cho dashboard |
| **V005 — payment metadata** | Intent 06 | P1 | P04 | ALTER transactions ADD payment_method, failure_reason, metadata JSONB |
| **V006 — analytics aggregations** | Intent 07 + Intent 04 co-purchase | P0 | P05 | `analytics_daily` + `analytics_daily_category` materialized views, refresh hourly |

**Optional (skip-able cho hackathon):**

| Migration | Cho intent | Note |
|---|---|---|
| V004 — promotions | Intent 05 free-gift | Skip — hardcode trong response JSON |
| V007 — media_uploads | Intent 01 | Skip — dùng base64 inline `products.image_data` (ADR-01-01) |

**Total bắt buộc:** 5 migrations (V001+V002+V003+V005+V006). Quản lý được trong hackathon timeline.

### Seed data planned

- 50 mock products trong `infra/seed/products.json` (10 categories)
- 5 users (2 merchants, 3 customers, password `demo1234`)
- 20 historical orders + 100 behavior events
- 30 days analytics fixture cho Intent 07 trong `infra/seed/analytics_30d_demo.sql` (186 orders, story arc dầu ăn -18%)
- ~30 keywords pre-baked cho Google Trends mock fixture (Intent 01)

---

## Decisions phát sinh trong phase (sẽ append vào DECISIONS.md)

Phase 00 sinh ra **~70 ADRs** tổng cộng. Group theo cross-cutting + intent:

### Cross-cutting (ảnh hưởng nhiều intents)

- **ADR-031** — Bổ sung Google Trends market signal cho Intent 01 (MCP tool `gtrends.interest_over_time`)
- **ADR-01-11** — Bottom-bar solid bg + z-index 10 (LOCKED cho mọi intent có scroll content + fixed CTA)
- **ADR-01-12** — Phone-frame responsive `max-height: calc(100vh - 48px)` (LOCKED universal)
- **ADR-01-10** — Action cards palette mở rộng mint/green + amber (extracted ra Cross-Intent §3)
- **ADR-08-01** — Brand "AI Brain" anatomical identity với Aida tagline "Hiểu — Học — Hành động"

### Intent-specific (tham khảo handoff riêng cho chi tiết)

- **Intent 01 (ADR-01-01 → 01-12):** Base64 inline image storage / upload picker (không live camera) / 4-phase loading checklist / inline AI bubble cho action cards / Shopee compact-expandable / low confidence yellow border / brain check badge success
- **Intent 02 (ADR-02-01 → 02-08):** Multi-item bulk parsing LLM array / inline chip clarify (không bottom sheet) / orb pulsing waveform (không 24-bar classic) / big mic CTA + tips entry / STT + Vespa confidence separation / partial success 1/3 matched / just-in-time mic permission / bulk Redis cart commit
- **Intent 03 (ADR-03-01 → 03-08):** Two-variant search (A baseline + B AI-augmented) / card width 172px cho Variant B / match badge color encoding by score / reason chip pink gradient + sparkle icon / co-purchase category-level (không product-level) / typo correction confirm UX / graceful degrade B→A / semantic understanding card
- **Intent 04 (~4 ADRs):** Skip product-level co-purchase matrix (dùng category-level V006) / re-upload append thread (không reset) / product card 172px cho recommend / SVG sprite inline (không CDN webfont)
- **Intent 05 (ADR-05-01 → 05-08):** Full-screen page (không bottom sheet) / product snapshot trong cart entry (không JOIN live) / optimistic UI qty stepper / swipe-to-delete + undo toast 3s / stock issue AI replacement / modal confirm clear với AI advice / confetti promo applied / free-ship progress
- **Intent 06 (ADR-06-01 → 06-10):** Order created trước payment gateway call / order code `#ORD-YYMMDD-XXXX` / idempotency key cho retry safety / brain identity reuse cho AI moments / confetti success / auto-retry exponential backoff timeout / 3DS OTP UX 6-cell / "Step 2/3" stepper / method bonus (MoMo −2%, COD +15k) / receipt QR + watermark
- **Intent 07 (ADR-07-01 → 07-11):** Reuse Intent 02 voice 100% / chart rendering Mix style (line+bar full, donut simplified) / 4-phase loading STT→intent→SQL→synthesis / persona Anh Nam + story dầu ăn -18% / drill-down full-screen (không inline modal) / action cards amber caution + green opportunity / mini sparkline trong action card / clarify inline AI bubble / empty state 3 CTAs / V006 fixture 30d / 3-loại-trend disambiguation
- **Intent 08 (ADR-08-01 → 08-07):** Brand AI Brain identity / Vietnamese tagline 3 verbs / login form layout 0.5px border pink / error encoding client vs system khác nhau / success brain animation green check / logout confirm card không button đơn / status bar mock 9:41

---

## Bugs / nợ kỹ thuật (sẽ giải quyết Phase 01+)

### Visual bugs đã fix trong Phase 00

- ✅ Bottom-bar gradient transparent → fixed (apply across 8 intents)
- ✅ Phone-frame overflow viewport laptop thấp → fixed (apply across 8 intents)

### Nợ kỹ thuật chuyển sang phase sau

- ⚠️ **Mockup HTML không có build pipeline** — sửa visual tokens (vd: đổi `#E91E63`) phải sửa thủ công ~75 file HTML + 8 Python builders. Phase 01 ưu tiên: build React component library từ tokens duy nhất tại `packages/shared-design-tokens/`.
- ⚠️ **Accessibility chưa audit** — ARIA labels chỉ làm cho button cơ bản, chưa test screen reader. Skip cho hackathon nhưng note lại.
- ⚠️ **Animation chưa wrap `@media (prefers-reduced-motion)`** ở mọi mockup. Phase 01+ khi component hóa, mỗi component PHẢI có guard này (đặc biệt orb pulse, brain breathe, confetti, brain shake).
- ⚠️ **Brand brain SVG path không scale tốt < 40px** — chi tiết synapse + nodes biến mất. Mitigation Phase 02: dùng simplified brain (chỉ shape + aura) cho size nhỏ trong header avatar.
- ⚠️ **SVG path hard-coded 30 data points** trong Intent 07 chart line/bar — nếu V006 trả về khác số ngày, path sẽ lệch. Phase 05 component `<LineChart>` PHẢI dynamic generate path từ `series.data[]`, không hard-code.
- ⚠️ **Donut segments cứng 5 categories** trong mockup Intent 07 — production có thể 6-10 categories. UI cần auto-merge "Khác" cho top-5 + 1 bucket.
- ⚠️ **"62% khách mua X cũng mua Y" co-purchase signal** cần ít nhất 50 orders trong DB để confidence đủ. Hackathon mới start → fake data fixture cho đến khi có traffic.
- ⚠️ **Demo account hint** lộ credentials trên Intent 08 login → chỉ cho dev/staging. Production: feature flag `SHOW_DEMO_ACCOUNT=false`.
- ⚠️ **Action card "Tạo khuyến mãi"** ở Intent 07 chưa wire vào flow — Phase 06 cần link sang Intent quản lý promotion (nếu có) hoặc just mock toast "Đã tạo".
- ⚠️ **OTP autofill chưa support trên web** — iOS native autofill từ SMS chỉ work cho `input[autocomplete="one-time-code"]`. Phase 04 verify hoạt động trên Safari iOS.
- ⚠️ **Mat view refresh lag** Intent 07 — nếu user vừa tạo đơn 10 phút trước, query có thể chưa thấy. Phase 05 cần fallback raw query khi data < 1h.
- ⚠️ **LLM intent classifier accuracy chưa tune** — câu "so sánh" không có ngữ cảnh có thể trigger nhiều cách. 3 chip clarify options chỉ cover ~70% cases. Cần fine-tune fewshot Phase 05.

---

## Cần lưu ý cho Phase tiếp theo

### Cross-cutting rules (PHẢI follow)

1. **`PHASE_00_CROSS_INTENT_PATTERNS.md` là LAW.** Trước khi vẽ UI hoặc build component cho bất kỳ intent nào, **PHẢI** đọc file này. Đặc biệt:
   - §1 **Bottom-bar pattern** — solid bg `#FFF8F0` + `z-index: 10` + box-shadow soft. **KHÔNG dùng gradient transparent.**
   - §2 **Phone-frame responsive** — `max-height: calc(100vh - 48px)` luôn có.
   - §3 **Palette mint/green + amber** — semantic LOCKED (positive trend / caution non-critical).
   - §4 **Action card variants** — extend bằng cách thêm `.ac-<variant>` CSS class, không tạo component mới.
   - §7 **Sparkline SVG pattern** — mỗi sparkline ID unique để tránh conflict.
   - §10 **3-loại "trend" disambiguation** — KHÔNG mix `trend_score` (Vespa) / `market_trend` (Google) / `analytics.trend_history` (internal) trên cùng card.

2. **Design tokens là source-of-truth duy nhất.** Phase 01 build `packages/shared-design-tokens/` từ `PHASE_00_DESIGN_SYSTEM.md` Section 1. KHÔNG hardcode `#E91E63` ở component code — luôn dùng CSS variable hoặc Tailwind class.

3. **75 mockup HTML là visual contract.** Khi build React component, follow spacing/colors/shadows EXACT từ HTML. KHÔNG "improve" visual mà không update mockup tương ứng + Cross-Intent patterns.

4. **Brand identity "Aida AI Brain" LOCKED.** Brain SVG anatomical, tagline "Hiểu — Học — Hành động", main tagline "Mỗi quyết định đều được kết nối thông minh". Reuse `<BrainIcon size={N} />` component xuyên 8 intents. KHÔNG redesign brand.

5. **Mọi field hiển thị UI PHẢI qua audit** theo `09_FIELD_AUDIT.md` rule. 8 intent đã audit xong (verdict ở mỗi handoff). Phase 01+ nếu phát hiện cần field mới → propose migration trước, vẽ UI sau.

### Component extraction priorities

Khi build React component library ở Phase 01-02, ưu tiên extract theo thứ tự (dependency-based):

**Atoms (Phase 01 — design system foundation):**
- `<StatusBar>` (mock 9:41 + signal/wifi/battery) — reuse 100% 8 intents
- `<BrainIcon size={N} />` — anatomical brain SVG với prop size
- `<PhoneFrame>` — wrapper 414×844 với responsive max-height
- `<MainScroll>` — flex:1 overflow-y với padding-bottom 110-130px
- `<BottomBar>` — solid bg + z-index 10 (locked pattern)

**Molecules (Phase 02):**
- `<UserBubble>` (text + voice variant với voice-wave + confidence badge)
- `<AIBubble>` (avatar orb + bubble với border-radius 4px 18px 18px 18px)
- `<MicButton>` (130px gradient pink-orange + 3 pulse rings)
- `<OrbPulse>` (180px radial gradient + 3 ring expand + breathe)
- `<LivePartialTranscript>` (text + cursor blink)
- `<PhasesCard>` (4-phase progress checklist với spinner)
- `<ActionCard variant="pink|amber|green|orange" />`
- `<MiniSparkline data={number[]} accent />`
- `<ProductCard width={138|172} />` (2 widths)
- `<DrillChipRow chips={...} />`

**Organisms (Phase 03+):**
- `<ChatThreadLayout>` (header + chat-area + bottom-bar) — Intent 02/03/04/07 reuse
- `<AnalyticsChartCard chart={ChartSpec}>` — switch render line/bar/donut theo type
- `<LineChart>` / `<BarChart>` / `<DonutChart>` SVG components (dynamic from data, KHÔNG hard-code path)
- `<CartItemRow>` với qty stepper + swipe-to-delete
- `<PaymentMethodPicker>` bottom sheet 5 methods
- `<OrderSummary>` sticky footer
- `<EmptyState>` với 3 CTAs configurable

### Phase-specific notes

**Phase 01 (foundation setup):**
- Build `packages/shared-design-tokens/` từ Design System v3
- Build `packages/shared-types/` với 8 Zod schema files (đã spec ở mockup handoffs)
- Setup OpenAPI codegen workflow (`pnpm openapi:sync`) — xem `08_FE_BE_CONTRACT.md`
- Setup OpenTelemetry collector + LGTM stack
- KHÔNG build feature code, chỉ skeleton + infrastructure

**Phase 02 (text intents — auth + search):**
- Implement Intent 08 (login/logout) — schema V001 đã đủ, 0 migration
- Implement Intent 03 Search (2 variants A + B) — schema V002 đã có
- Migration V003 (insights) BẮT BUỘC nếu muốn hero AI card hoạt động
- Extract `<BrainIcon>` + `<StatusBar>` + `<PhoneFrame>` atoms

**Phase 03 (Intent 01 — Import by Image):**
- Setup vision pipeline (Gemini Vision API + image embedding via MCP)
- MCP tool `gtrends.interest_over_time` với fixture ~30 keywords
- Image storage decision: base64 inline `products.image_data` (ADR-01-01, không cần V007)
- Policy engine với 2 new rules `MARKET_RISING_v1`, `MARKET_FALLING_v1`
- Action card factory thêm 2 templates `SUGGEST_STOCK_UP`, `SUGGEST_WAIT_OR_REDUCE`

**Phase 04 (voice + commerce — Intent 02 + 05 + 06):**
- Gemini STT streaming integration
- MediaRecorder + chunked audio upload
- Redis cart implementation với product snapshot strategy (ADR-05-02)
- Migration V005 BẮT BUỘC trước Intent 06 (đã apply theo INTENT_AUDIT_REPORT)
- Idempotency middleware cho payment endpoints
- 5 payment provider strategies (MoMo primary, VNPay/Bank/COD/Mock)
- Webhook receivers cho MoMo/VNPay callbacks
- Component `<OrbPulse>` + `<MicButton>` extract — Intent 07 sẽ reuse 100%

**Phase 05 (image + analytics — Intent 04 + 07):**
- Migration V006 BẮT BUỘC (analytics_daily + analytics_daily_category mat views)
- Worker `worker-analytics` refresh V006 hourly với `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Component `<AnalyticsChartCard>` với 3 chart subcomponents (line/bar/donut)
- Fixture file `analytics_30d_demo.sql` (186 orders, story arc dầu ăn -18%)
- Reuse Intent 02 voice components 100% cho Intent 07
- Insight detector: delta < -15% / 7d → `severity:'caution'`; > +10% AND stock < 7d → `severity:'opportunity'`

**Phase 06 (polish + nice-to-have):**
- Receipt PDF generation
- Free-ship promo features
- Wishlist (heart icon) — đã skip ở Intent 03/04
- Production-grade observability dashboards

### Naming conventions (PHẢI follow)

Đã LOCKED từ `00_CONTEXT.md` Section 5. Lưu ý đặc biệt từ mockup handoff:

- **CSS class names**: `kebab-case` (`.bottom-bar`, `.ai-bubble`, `.chart-card`)
- **CSS variables**: `--kebab-case` với prefix theo group (`--grad-*`, `--shadow-*`, `--text-*`)
- **State naming files**: `intent-NN-state-X-<scenario>.html` (lowercase, kebab scenario)
- **Action card variants**: `.ac-<variant>` (`.ac-price`, `.ac-stock-up`, `.ac-wait`)
- **SSE event names**: `<intent>.phase.<phase>` / `<intent>.result` / `<intent>.error`
- **Error codes**: `E_<UPPER_SNAKE>` (`E_TRANSCRIBE_FAILED`, `E_ANALYTICS_TIMEOUT`, `E_INSUFFICIENT_BALANCE`)

### Critical constraints (sẽ thêm vào `00_CONTEXT.md` Section 10)

Phase 00 đã đề xuất 2 rules mới (15, 16, 17, 18 ở handoff Intent 01 v2 delta). Tổng hợp:

- **Rule 15** (đã có): KHÔNG vẽ UI element nào mà chưa được audit field trong `09_FIELD_AUDIT.md`.
- **Rule 18** (đề xuất): KHI vẽ intent 02-08 mockup hoặc build feature code, LUÔN đọc `PHASE_00_CROSS_INTENT_PATTERNS.md` TRƯỚC. File này lock các patterns reusable.
- **Rule 19** (đề xuất mới): KHÔNG hardcode SVG path data points hoặc segment counts. Dynamic generate từ data response, prepare cho variable input.
- **Rule 20** (đề xuất mới): Mọi animation phải có `@media (prefers-reduced-motion)` guard. Default disable: orb breathe, brain shake, confetti, pulse rings, ring expand.

---

## Câu hỏi mở (cần human quyết định trước Phase 01)

- [ ] **Component library framework:** shadcn/ui (Radix + Tailwind, copy-paste) vs Mantine (full library) vs build từ đầu với Tailwind thuần? Mockup hiện dùng CSS thuần — Phase 01 PHẢI quyết định trước khi build atoms.
- [ ] **Animation library:** Framer Motion (heavy ~30kb) vs CSS-only keyframes (đủ cho 80% mockup hiện tại) vs Motion One (lighter ~5kb)?
- [ ] **State management:** Zustand vs Redux Toolkit vs React Context? Có 8 intents, mỗi intent có state machine 7-11 states → cần solution scale tốt.
- [ ] **SSE client implementation:** native EventSource vs `@microsoft/fetch-event-source` (hỗ trợ POST body)? Nhiều endpoint cần POST + SSE (vision upload, voice audio chunks).
- [ ] **Brain icon size strategy:** simplified version cho < 40px (đã note ở debt) — Phase 02 cần quyết định nay hay later.
- [ ] **Mock data refresh strategy:** seed file Postgres + manual reset, hay auto-regenerate mỗi N giờ via worker?
- [ ] **Demo presenter mode:** có cần page `/demo-presenter` với keyboard shortcuts navigate giữa 75 mockup states không? Useful cho hackathon judging.
- [ ] **Cross-intent navigation:** lúc nào dùng `router.push` vs in-page state change? Mockup hiện chỉ là tĩnh — Phase 01+ cần lock navigation pattern (vd Intent 05 → 06 = full route, Intent 03 → cart = pill overlay).
- [ ] **i18n strategy:** Hardcode VN copy bây giờ + extract sau, hay setup i18next ngay từ Phase 01? Mockup hiện đều tiếng Việt cứng.

---

## Khi load Phase 01+, AI chỉ cần thêm file này

Cùng với `00_CONTEXT.md` + `PHASE_01.md` (spec), file `PHASE_00_HANDOFF.md` này **thay thế** việc đọc tất cả 11 handoff intent docs.

**Khi nào cần đọc handoff intent-specific:**

- Khi build component cho 1 intent cụ thể → đọc handoff intent đó để có chi tiết ADRs + schema + Phase X implementation tasks
- Khi gặp visual ambiguity → đọc handoff để xem ADR justify decision

**Khi nào KHÔNG cần đọc handoff intent-specific:**

- Lập kế hoạch tổng thể Phase 01-06 — `PHASE_00_HANDOFF.md` đủ
- Setup foundation (tokens, types, OpenAPI codegen) — đọc `PHASE_00_DESIGN_SYSTEM.md` là chính
- Debug visual bug — đọc `PHASE_00_CROSS_INTENT_PATTERNS.md` Section 12 (QA Patterns)

---

**END OF PHASE 00 HANDOFF.**

**Generated:** 2026-05-17
**Total deliverable size:** ~75 HTML files (≈1.5MB standalone) + 8 Python builders + 13 markdown docs (~120 pages)
**Ready for:** Phase 01 (foundation setup) — không có blocker.
