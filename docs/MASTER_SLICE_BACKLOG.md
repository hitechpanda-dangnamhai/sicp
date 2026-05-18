# Master Slice Backlog — ICP

> **Version:** 1.0 (Step 2 output)
> **Date:** 2026-05-18
> **Status:** ⭐ ACTIVE
> **Source:** ICP Workflow v1.3 (`docs/workflow/ICP_WORKFLOW_FINAL.md` Section 4 Step 2 + Section 14.4.1 Slice ↔ Phase Spec Mapping)
>
> **Mục đích:** Chia roadmap thành các slice lớn, mỗi slice có thể tạo output thật. Per
> Rule 2, file này CHỈ list slice ID + name + goal + type + priority — KHÔNG breakdown
> sub-tasks (đó là Step 5 `slices/S-XX_TASKLIST.md`).
>
> **Total:** 12 slices (S-00 → S-11), tách Intent 02 (S-08) và Intent 07 (S-10) thành
> 2 slices riêng per human decision 2026-05-18.

---

## Slice Backlog Table

| Slice ID | Slice Name | Goal (1 câu) | Type | Stage | Priority | Status |
|---|---|---|---|---|---|---|
| **S-00** | Repo Reality Check | Audit current repo state vs PHASE_01 DoD checklist | Q-GATE | Stage 1 | P0 | TODO |
| **S-01** | UI Foundation | Build React component library (atoms+molecules+organisms) từ 75 mockup HTML + design tokens v3 | H-UI | Stage 1 | P0 | TODO |
| **S-02** | Runtime Foundation | OTel + OpenAPI codegen + Idempotency + Behavior tracker + LangGraph router skeleton | P-CAP | Stage 1 | P0 | TODO |
| **S-03** | First Auth Flow | User login/logout end-to-end (Intent 08) qua Gateway, JWT + Bcrypt + session Redis | V-SLICE | Stage 2 | P0 | TODO |
| **S-04** | First Product Discovery | User search products by text (Intent 03), 2 variants A baseline + B AI-augmented | V-SLICE | Stage 2 | P0 | TODO |
| **S-05** | First Cart/Order Flow | User add/update/remove cart items + free-ship promo (Intent 05), full-screen page | V-SLICE | Stage 3 | P1 | TODO |
| **S-06** | First Payment Flow | User complete checkout (Intent 06) với Kafka choreography + OTP 3DS + receipt QR | V-SLICE | Stage 3 | P1 | TODO |
| **S-07** | First Image AI Flow | Merchant import product by image (Intent 01) — vision + Shopee compare + Google Trends + 5 action card variants | V-SLICE | Stage 4 | P1 | TODO |
| **S-08** | First Voice Buy Flow | Customer voice "mua nước tương Maggi" (Intent 02) — STT + bulk parse + clarify + cart add | V-SLICE | Stage 4 | P1 | TODO |
| **S-09** | Recommendation Flow | Customer upload image → 10 similar products kèm reason (Intent 04) | V-SLICE | Stage 4 | P2 | TODO |
| **S-10** | Analytics Voice Flow | Merchant voice "phân tích doanh thu nước tương 6 tháng" (Intent 07) — chart line/bar/donut + narrative | V-SLICE | Stage 5 | P2 | TODO |
| **S-11** | Demo Hardening | Polish + demo script 8min + pitch deck 10 slides + fallback scripts + Grafana Live Demo dashboard | Q-GATE | Stage 5 | P0-final | TODO |

---

## Per-Slice Detail (Step 2 level — no sub-tasks)

### S-00 — Repo Reality Check

| Field | Value |
|---|---|
| **Goal** | Audit hiện trạng repo so với PHASE_01_INFRA DoD. Identify gap, list những gì đã có / chưa có. |
| **Type** | Q-GATE (checklist mode, không code feature) |
| **Method** | Checklist Mode (per workflow §5.1 method matrix) |
| **Primary phase spec** | `PHASE_01_INFRA.md` (DoD section) |
| **Conflict resolution notes** | Check repo state vs PHASE_01 DoD checklist 9 items. Surface gap. |
| **Depends on** | (none — first slice) |
| **Blocks** | S-01, S-02 |
| **Output expected** | `slices/S-00_BRIEF.md` + `slices/S-00_TASKLIST.md` (checklist), `reports/S-00_AUDIT_REPORT.md` |
| **Priority rationale** | P0 vì nếu repo state khác PHASE_01 DoD đáng kể, có thể cần thêm slice S-00b để fill gap trước Stage 1 |
| **Estimated effort** | 1 day (audit only) |

**Risks (Rule 7 surface):**
- Phase 00 mockup đã có nhưng React component library chưa code (per `PHASE_00_HANDOFF.md` "Items deferred") → S-01 sẽ build, nhưng S-00 cần verify Next.js skeleton đã setup chưa
- Vespa container có thể đã có nhưng schema chưa deploy → audit

---

### S-01 — UI Foundation

| Field | Value |
|---|---|
| **Goal** | Build React component library reusable (atoms + molecules + organisms) từ 75 HTML mockups + design tokens v3 MoMo Premium, với `<PhoneFrame>` + `<BottomBar>` + `<MainScroll>` có 2 bugs fix locked. |
| **Type** | H-UI (Horizontal UI, component library FE-only) |
| **Method** | **EBT v2** (SCAN → COUNT → SEMANTIC_NORMALIZE → CLASSIFY → BUDGET) per workflow §5.2 |
| **Primary phase spec** | `PHASE_00_DESIGN_SYSTEM.md` |
| **Conflict resolution notes** | Mockup wins over spec for visual decisions (per Rule 6) |
| **Depends on** | S-00 (Next.js setup verified) |
| **Blocks** | S-03 → S-10 (mọi V-SLICE cần component library) |
| **Output expected** | `slices/S-01_BRIEF.md` + `slices/S-01_TASKLIST.md`, `.ai-delivery/COMPONENT_REGISTRY.md`, `apps/web/components/` populated |
| **Priority rationale** | P0 — nếu skip, Stage 2-5 sẽ tạo ad-hoc components dẫn đến bug 1 + bug 2 reproduce (per `PHASE_03_FRONTEND_KICKOFF.md` Q&A) |
| **Estimated effort** | 5-7 days (atoms + molecules + organisms theo `PHASE_00_HANDOFF.md` Section "Component extraction priorities") |

**Components priority order (per `PHASE_00_HANDOFF.md` + mockup frequency analysis):**

| Priority | Components | Evidence |
|---|---|---|
| **Atoms** | `<StatusBar>`, `<BrainIcon>`, `<PhoneFrame>`, `<MainScroll>`, `<BottomBar>` | `phone-frame` 76 freq across 8/8 intents; bottom-bar 2 bugs LOCKED |
| **Molecules** | `<UserBubble>`, `<AIBubble>`, `<MicButton>`, `<OrbPulse>`, `<LivePartialTranscript>`, `<PhasesCard>`, `<ActionCard variant>`, `<MiniSparkline>`, `<ProductCard width={138\|172}>`, `<DrillChipRow>` | Mockup analysis: orb-pulse 7/8 intents, action-card 2 intents, drill-chip Intent 07 only (Rule 6 vẫn build) |
| **Organisms** | `<ChatThreadLayout>`, `<AnalyticsChartCard>`, `<LineChart>/<BarChart>/<DonutChart>`, `<CartItemRow>`, `<PaymentMethodPicker>`, `<OrderSummary>`, `<EmptyState>` | Intent 02/03/04/07 reuse chat layout; Intent 07 3 chart types confirmed |

**Risks (Rule 7 surface):**
- ✅ Component library framework — RESOLVED via **ADR-033** (shadcn/ui + Tailwind v3)
- ✅ Animation library — RESOLVED via **ADR-034** (Hybrid CSS-only + Framer Motion + canvas-confetti)
- ✅ State management — RESOLVED via **ADR-035** (Zustand for cross-component shared)
- 75 HTML mockup có inline CSS thuần — extract thành React + design tokens là effort lớn → budget 5-7 days cần monitor scope creep
- Brain icon size strategy < 40px chưa quyết (handoff debt) → resolve ở S-01 brief
- Cross-intent navigation pattern (router.push vs in-page state) chưa lock → resolve ở S-01 brief
- i18n strategy (hardcode VN vs i18next) — defer hoặc resolve ở S-01 brief

---

### S-02 — Runtime Foundation

| Field | Value |
|---|---|
| **Goal** | Setup runtime capabilities cross-cutting: OTel SDK (LGTM stack) + OpenAPI codegen + Idempotency middleware + Behavior tracker SDK + LangGraph router skeleton + MCP client. |
| **Type** | P-CAP (Platform Capability, cross-cutting infrastructure) |
| **Method** | **CDP** (INVENTORY → CONSUMER_MAPPING → TIMING_DECISION → TASK_BREAKDOWN → ACCEPTANCE_TESTS) per workflow §5.3 |
| **Primary phase spec** | `PHASE_01_INFRA.md` (full) |
| **Conflict resolution notes** | High fidelity spec, follow ngay |
| **Depends on** | S-00 (audit), S-01 (design tokens accessible) |
| **Blocks** | S-03 → S-10 (mọi V-SLICE cần OTel + idempotency + tracker) |
| **Output expected** | `slices/S-02_BRIEF.md` + `slices/S-02_TASKLIST.md`, `apps/{web,gateway,ai,mcp}/observability/`, `apps/gateway/src/common/idempotency.middleware.ts`, `apps/web/lib/tracker.ts`, `packages/shared-types/` with codegen pipeline |
| **Priority rationale** | P0 — `auth.signed_in` (S-03) cần tracker + OTel + idempotency; mọi V-SLICE downstream cần OpenAPI generated types |
| **Estimated effort** | 5-7 days |

**Capabilities MUST_BEFORE (per CDP TIMING_DECISION — 8/8 consumers cần):**
- Error format standardized (JSON `{code, message, retriable}`)
- OTel SDK init (logs/metrics/traces ship qua collector)
- OpenAPI codegen pipeline (`pnpm openapi:sync` working, CI verify drift)
- Auth guard middleware (`JwtAuthGuard`)
- Idempotency middleware (`IdempotencyMiddleware` Redis SETNX)
- LangGraph router skeleton (`router_graph.py` classify intent)
- MCP client wrapper với trace context propagation

**Capabilities CAN_INCREMENTAL (3-7/8 consumers):**
- SSE contract typed wrapper
- Event envelope schema
- MCP tool registration pattern

**Capabilities DEFER (1-2/8 consumers):**
- Behavior SDK advanced (sampling, retry)
- Rate limiting

**Risks (Rule 7 surface):**
- Vespa schema deployment + behavioral signal fields cần locked TRƯỚC khi build feature → verify `infra/vespa/schemas/product.sd` đầy đủ
- ADR-019 SSE auth qua cookie httpOnly — verify EventSource API hỗ trợ `withCredentials`
- OTel collector config phức tạp — pair-program 1 buổi (per `PHASE_01_INFRA.md` risks)

---

### S-03 — First Auth Flow

| Field | Value |
|---|---|
| **Goal** | Intent 08 end-to-end: user login form → JWT + session Redis → `/auth/me` → logout invalidate. 7 mockup states full coverage. |
| **Type** | V-SLICE (Vertical Slice full end-to-end, 1 intent) |
| **Method** | **VSP (full)** (USER_JOURNEY → LAYER_SLICING → HAPPY_VS_EDGE → SUB_TASK_BREAKDOWN → ESTIMATE_SEQUENCE) per workflow §5.4 |
| **Primary phase spec** | `PHASE_02_AUTH_SEARCH.md` (Section A) |
| **Conflict resolution notes** | Mockup state F-logout có thể conflict với spec; mockup wins |
| **Depends on** | S-01 (LoginForm, BrainIcon, PhoneFrame), S-02 (auth middleware, OTel, tracker) |
| **Blocks** | S-04 → S-10 (mọi intent cần authenticated user) |
| **Output expected** | `slices/S-03_BRIEF.md` + `slices/S-03_TASKLIST.md`, `apps/gateway/src/auth/`, `apps/web/src/features/auth/` |
| **Priority rationale** | P0 — Idempotency middleware cần `userId` từ JWT, mọi intent downstream cần |
| **Estimated effort** | 3-4 days |

**Mockup states cover (Rule 6):**
- state-0-splash (brain SVG animation)
- state-A-login (form layout 0.5px border pink)
- state-B-loading
- state-C-wrong-password (shake animation)
- state-D-network-error
- state-E-success (brain animation green check)
- state-F-logout (confirm card without single button — ADR-08-07)

**Tech config LOCKED (per PHASE_02):**
- Bcrypt cost 10
- JWT HS256, exp 24h, secret từ env
- Refresh token random UUID, sessions table, exp 30d
- SET Redis `session:{jti}` (TTL = exp)
- Logout: DEL Redis + UPDATE PG `revoked_at = NOW()`
- Behavior events: `session.started` (page load), `auth.signed_in` (server-side post-login)

**Risks (Rule 7 surface):**
- Mockup KHÔNG có "Forgot password" link — verify PHASE_02 spec align (no conflict)
- Demo account credentials hint lộ ở mockup — feature flag `SHOW_DEMO_ACCOUNT=true` chỉ cho dev
- ADR-019 cookie httpOnly cho SSE — verify hoạt động cross-domain dev (localhost:3000 → :3001)

---

### S-04 — First Product Discovery

| Field | Value |
|---|---|
| **Goal** | Intent 03 end-to-end: text query → LangGraph parse filters → MCP `text.embed` + `vespa.hybrid_search` → 5+ products, 2 variants (A baseline 138px + B AI-augmented 172px với match badge + reason chip + co-purchase hint category-level). |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_02_AUTH_SEARCH.md` (Section C, E) |
| **Conflict resolution notes** | Variant A vs B (mockup) chưa có trong spec section C; surface conflict, expand spec |
| **Depends on** | S-03 (authenticated user), S-02 (LangGraph router + Vespa indexed) |
| **Blocks** | S-08 (voice buy reuse `vespa.hybrid_search`) |
| **Output expected** | `apps/ai/src/graphs/intents/searching_by_text.py`, `apps/web/src/features/search/`, Vespa schema deployed + 50 products indexed |
| **Priority rationale** | P0 — test pipeline LangGraph + MCP + Vespa cơ bản trước khi tackle multimodal |
| **Estimated effort** | 3-4 days |

**Mockup states cover (Rule 6):**
- 2 variants × 7 states = 14 mockup files
- Variant A (baseline): happy / loading / empty / error / filter / cart-added / refine
- Variant B (AI-augmented): happy / loading / empty / error / filter / cart-added / typo-correction

**Variant B unique components (Rule 6 MOCKUP IS LAW):**
- Match badge color encoding by score
- Reason chip pink gradient + sparkle icon
- Co-purchase category-level hint card (per ADR-03-05, NOT product-level)
- Typo correction confirm UX
- Semantic understanding card
- Graceful degrade B→A khi LLM fail

**Risks (Rule 7 surface):**
- **Conflict surfaced:** Variant B co-purchase category-level cần V006 materialized view chưa apply ở Phase 02 → fixture tạm trong S-04, real V006 apply ở S-10
- Vespa rank profile cho Variant B chưa định nghĩa — design ở S-04 brief, sẽ override ở S-10 với behavior signals
- Demo "asdfgh" empty state → helpful message + suggest widen query

---

### S-05 — First Cart/Order Flow

| Field | Value |
|---|---|
| **Goal** | Intent 05 cart by text end-to-end: full-screen page (mockup wins over spec sidebar) với add/update qty/remove/clear/promo apply, stock issue AI replacement, free-ship progress, swipe-to-delete + undo 3s. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_04_BUY_CART_PAY.md` (Section B, F) |
| **Conflict resolution notes** | **Cart UI conflict:** spec là sidebar always visible, mockup là full-screen page. Mockup wins per Rule 6 (ADR-05-01). |
| **Depends on** | S-03 (auth), S-02 (idempotency, MCP), S-04 (cart từ search result thường) |
| **Blocks** | S-06 (payment cần cart data), S-08 (voice buy cũng add to cart, share `<CartItemRow>` + `<OrderSummary>` từ S-05) |
| **Output expected** | `apps/ai/src/graphs/intents/cart_by_text.py`, `apps/web/src/features/cart/`, 7 MCP cart tools |
| **Priority rationale** | P1 — Stage 3 commerce flow, không block Stage 4 nhưng cần cho S-06 + S-08 |
| **Estimated effort** | 4-5 days |

**Mockup states cover (Rule 6):**
- state-0-happy (4 items)
- state-A-loading skeleton
- state-B-empty (brain icon + 3 CTAs configurable)
- state-C-update-qty (optimistic UI qty stepper)
- state-D-remove (swipe-to-delete + undo toast 3s)
- state-E-stock-issue (AI replacement card)
- state-F-clear-confirm (modal + AI advice)
- state-G-promo-applied (confetti animation + free-ship progress)

**Tech decisions LOCKED:**
- Product snapshot trong cart entry (NOT JOIN live) — ADR-05-02 → schema Cart structure cần `snapshot` JSONB
- Cart Redis pattern (NOT Postgres) per `PHASE_04` Section B
- Confetti animation library: canvas-confetti vs CSS keyframes → human chốt ở S-05 brief

**Risks (Rule 7 surface):**
- **Conflict surfaced:** PHASE_04 spec viết "Cart sidebar (always visible, hide when empty)", mockup là full-screen page → mockup wins, expand spec
- 7 MCP cart tools (cart.get / upsert / remove / clear / validate_stock / apply_promo / remove_promo) — kiểm tra MCP server đã có scaffold ở S-02
- Promo code V004 deferred — hardcode promo response JSON cho hackathon

---

### S-06 — First Payment Flow

| Field | Value |
|---|---|
| **Goal** | Intent 06 payment by text end-to-end: order create (idempotent) → publish Kafka `OrderPlaced` → 3 workers choreography (payment 80% success / inventory reserve + compensate / notification) → SSE order status real-time → 9 mockup states full coverage. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_04_BUY_CART_PAY.md` (Section C-G) |
| **Conflict resolution notes** | OTP 3DS state G (mockup) chưa trong spec; expand spec |
| **Depends on** | S-05 (cart data), S-03 (auth), S-02 (idempotency, Kafka tracing pattern) |
| **Blocks** | S-10 (analytics input data từ orders), S-11 (demo highlight choreography compensation) |
| **Output expected** | `apps/workers/src/{payment,inventory,notification}-consumer.ts`, `apps/gateway/src/orders/`, `apps/web/src/features/checkout/`, V005 migration applied |
| **Priority rationale** | P1 — showcase choreography + compensation = WOW factor cho ban giám khảo kỹ thuật |
| **Estimated effort** | 5-6 days |

**Mockup states cover (Rule 6):**
- state-0-confirm
- state-A-address (address picker)
- state-B-method (5 options: MoMo −2% / VNPay / Bank Transfer / COD +15k fee / Mock — ADR-06-09)
- state-C-processing (brain pulse animation)
- state-D-success (confetti)
- state-E-declined (shake animation)
- state-F-timeout (idempotent retry exponential backoff)
- state-G-otp (6-cell OTP 3DS — **mockup wins, expand spec**)
- state-H-receipt (QR code + watermark)

**Tech decisions LOCKED:**
- Order code format `#ORD-YYMMDD-XXXX` (ADR-06-02)
- Idempotency key cho retry safety (ADR-06-03)
- Payment 80% success mock per ADR-PAYMENT-MOCK (in PHASE_04)
- Compensation: PaymentFailed → inventory-consumer subscribe → StockReleased
- Kafka tracing: producer inject `traceparent` header, consumer extract → 1 trace span

**Risks (Rule 7 surface):**
- **Conflict surfaced:** OTP 3DS state G mockup chưa có handler design trong PHASE_04 spec → expand spec ở S-06 brief
- OTP autofill `input[autocomplete="one-time-code"]` chưa support Safari iOS — manual input fallback
- 3 workers x Kafka trace context propagation = điểm dễ vỡ nhất Stage 3 — verify 1 trace duy nhất
- V005 migration BẮT BUỘC trước S-06 — verify migration đã apply

---

### S-07 — First Image AI Flow

| Field | Value |
|---|---|
| **Goal** | Intent 01 import by image end-to-end: merchant chụp ảnh → Gemini vision analyze → enrich parallel (Shopee Postgres compare + Google Trends + Vespa search_trend) → form prefilled với 2 compact cards (Shopee + Market Trend) → submit → 2 variants suggestions (rising mint / falling amber) → commit Product + Vespa index. 11 mockup states full coverage. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_03_IMPORT.md` (full) |
| **Conflict resolution notes** | (a) Google Trends (ADR-031) chưa trong spec; ADR wins per priority 2 — expand spec at S-07 brief. (b) **Shopee price source: ✅ RESOLVED — ADR-032 ACCEPTED 2026-05-18 overriding ADR-008. Postgres table `shopee_prices_mock` (V008 migration applied) + worker seed. Real crawler OUT OF SCOPE.** |
| **Depends on** | S-02 (MCP framework, LangGraph interrupt pattern), S-01 (5 action card variants component), S-04 (Vespa indexing pipeline) |
| **Blocks** | S-11 (flagship demo) |
| **Output expected** | `apps/ai/src/graphs/intents/importing_by_images.py`, `apps/mcp/src/tools/{vision,gtrends,shopee_mock}.py`, `apps/workers/src/shopee-mock-seed-worker.ts`, **new migration V008__shopee_prices_mock.sql** (subject to ADR-032 approval), Policy DSL evaluator, 5 policies + 2 new |
| **Priority rationale** | P1 — flagship demo wow (vision + multi-tool + Event → Action Card + form prefill UX) |
| **Estimated effort** | 6-7 days (complex multimodal flow) |

**Mockup states cover (Rule 6 — Intent 01 v2 đã ráp 2 visual bugs fix):**
- state-0-capture (upload picker, NOT live camera — ADR-01-02)
- state-A-analyzing (4-phase loading: vision → market analysis → similar products → finalize)
- state-B-prefilled (form + Shopee compact card + Market Trend compact card stacked)
- state-C-suggestions-rising (mint border `SUGGEST_STOCK_UP` card, when trend > +30%)
- state-C-suggestions-falling (amber border `SUGGEST_WAIT_OR_REDUCE` card, when trend < -20%)
- state-D-shopee-expanded (compact → expanded panel)
- state-E-blur-error (image blur detection)
- state-F-low-confidence (yellow border, vision confidence < 0.3)
- state-G-success (brain check badge)
- state-H-trend-expanded (Google Trends panel expanded)

**Tech decisions LOCKED:**
- Image storage base64 inline `products.image_data` (ADR-01-01) — NOT V007 / S3
- Inline AI bubble cho action cards (ADR-01-08)
- Action card variants extend với `.ac-stock-up` mint + `.ac-wait` amber (ADR-01-10)
- LangGraph interrupt pattern → state save Redis, resume từ `/intent/{rid}/action`
- 4 phase analyzing loading checklist (gom Shopee + Google Trends thành 1 phase "Phân tích thị trường")

**Risks (Rule 7 surface):**
- **CONFLICT #1 pending:** ADR-031 (Google Trends) + mockup `gtrends.interest_over_time` MCP tool vs `PHASE_03_IMPORT.md` Section A chỉ list 4 tools cũ (vision, search_trend, price_range, text.embed). → **ADR + mockup win priorities 1+2**. Action: expand phase spec at S-07 brief (Step 4) — add Section A.5 for `gtrends.interest_over_time` tool spec.
- **CONFLICT #2 ✅ RESOLVED (2026-05-18):** ADR-032 Accepted, supersedes ADR-008.
  - ✅ Migration V008 created (`infra/migrations/V008__shopee_prices_mock.sql`) — schema `shopee_prices_mock` table với aggregates + samples JSONB (Option 2 design)
  - ✅ Schema doc updated `02_DATA_MODEL.md`
  - ✅ MCP tool spec updated `01_ARCHITECTURE.md` Section 6
  - ✅ Migration roadmap updated `PHASE_00_HANDOFF.md`
  - ⏳ Implementation pending S-07: build `apps/workers/src/shopee-mock-seed-worker.ts` (Step 5/7 task pack)
  - ⏳ Implementation pending S-07: MCP `shopee.price_range` query Postgres table (Step 5/7 task pack)
- Gemini API rate limit cho vision.analyze — pre-warm cache embedding (Redis SHA256 input)
- Policy DSL evaluator JSONPath subset implementation — 10 unit tests bắt buộc
- Idempotent commit: re-click "Nhập hàng" không tạo duplicate (`IMP-04` test scenario)
- Shopee samples JSONB schema — validate ở seed worker code (TypeScript Zod) since không có DB CHECK; document Zod schema trong `packages/shared-types/src/shopee.ts`

---

### S-08 — First Voice Buy Flow

| Field | Value |
|---|---|
| **Goal** | Intent 02 buy by voice end-to-end: mic tap → MediaRecorder chunked upload → Gemini STT → bulk parse intent LLM → search → clarify ambiguous (chip-row inline, NOT bottom sheet) → add to cart bulk Redis. 8 mockup states. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_04_BUY_CART_PAY.md` (Section A — Speech tool + buying_by_voices subgraph) |
| **Conflict resolution notes** | (Aligned — Intent 02 voice spec rõ trong PHASE_04 Section A) |
| **Depends on** | S-05 (cart MCP + `<CartItemRow>`), S-04 (vespa.hybrid_search), S-02 (LangGraph interrupt pattern reuse từ S-07) |
| **Blocks** | S-10 (Intent 07 reuse voice infrastructure 100%: `<MicButton>`, `<OrbPulse>`, `<LivePartialTranscript>`, `<PhasesCard>`, `<AIBubble>`) |
| **Output expected** | `apps/ai/src/graphs/intents/buying_by_voices.py`, MCP `speech.transcribe` + `intent.parse_bulk_buy`, `apps/web/src/features/voice-buy/` |
| **Priority rationale** | P1 — Intent 02 + Intent 07 share voice infrastructure, S-08 build foundation cho S-10 reuse |
| **Estimated effort** | 4-5 days |

**Mockup states cover (Rule 6):**
- state-0-mic-idle
- state-A-listening (orb pulse 180px radial gradient + 3 ring expand + breathe)
- state-B-transcribing (4-phase loading)
- state-C-cart-ready (multi-item bulk parsing LLM array — ADR-02-01)
- state-D-clarify (chip-row inline, NOT bottom sheet — ADR-02-02)
- state-E-cart-added + co-purchase hint
- state-F-no-match (partial success 1/3 matched alternatives — ADR-02-05)
- state-G-error E_TRANSCRIBE_FAILED

**Tech decisions LOCKED:**
- Gemini 2.0 Flash for STT (ADR-05) — `speech.transcribe(audio_b64, lang='vi')` return text + confidence
- STT confidence < 0.5 → ask repeat
- Multi-item bulk: LLM extract array `[{name, qty}, ...]` rồi loop search Vespa
- Just-in-time mic permission request (ADR-02-07)
- Bulk Redis cart commit (single transaction batch upsert — ADR-02-08)
- Session memory Redis key `intent:{userId}:{sessionId}` cho resolve "cái thứ 2" → SKU

**Risks (Rule 7 surface):**
- Voice transcribe latency target < 3s cho audio 5s — pre-warm Gemini client
- Multiple ambiguous matches sau 2 clarifications → fallback to text mode (acceptable degradation)
- Mic permission UX — vi phạm browser security có thể block, test cross-browser
- MediaRecorder chunked upload pattern — tested format mp4/webm cho cross-browser

---

### S-09 — Recommendation Flow

| Field | Value |
|---|---|
| **Goal** | Intent 04 recommendation by image: upload ảnh → MCP `vision.embed` + `vision.analyze` → parallel (`vespa.nearest_neighbor` visual + `analytics.co_purchased` category-level collab) → blend rank → top 10 products + LLM reason per item. 7 mockup states. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_05_RECO_ANALYTICS.md` (Section A-C, H — Image embedding + Intent 04 subgraph + Co-purchased SQL + Behavior aggregator preview) |
| **Conflict resolution notes** | Behavior aggregator critical (worker schedule 5 phút) |
| **Depends on** | S-07 (vision pipeline foundation), S-04 (Vespa search), S-02 (worker scaffolding) |
| **Blocks** | S-10 (S-09 backfill image embedding + co_purchase_matrix mat view = input cho S-10 analytics) |
| **Output expected** | `apps/ai/src/graphs/intents/recommend_by_images.py`, MCP `vision.embed` + `analytics.co_purchased`, backfill script 50 products image embedding, V006 partial apply (co_purchase_matrix mat view) |
| **Priority rationale** | P2 — wow factor visual similarity, có thể defer nếu Stage 4 over time |
| **Estimated effort** | 4-5 days |

**Mockup states cover (Rule 6):**
- state-0-happy (10 recommendations with reason)
- state-A-loading
- state-B-empty
- state-C-error
- state-D-filter (switched collab)
- state-E-cart (add reco product to cart)
- state-F-reupload (append thread, NOT reset — ADR-04-02)

**Tech decisions LOCKED:**
- Image embedding Option A (Gemini multimodal proxy → text embed kết quả) per PHASE_05 §A — simpler hackathon
- Co-purchase category-level NOT product-level (ADR-04-01) — dùng V006 mat view
- Blend score: `composite = 0.5 * visual_sim + 0.3 * co_purchase_count + 0.2 * trend_score`
- Product card width 172px cho recommend (consistent với Intent 03 Variant B)
- LLM 1-shot reason: "Tại sao similar?" track tokens

**Risks (Rule 7 surface):**
- Cold start: 0 co-purchased data → fallback pure visual similarity
- Image embedding accuracy low vs CLIP — acceptable demo, document limitation
- V006 mat view chưa apply ở Stage 4 → S-09 cần partial apply (chỉ co_purchase_matrix), V006 full apply ở S-10

---

### S-10 — Analytics Voice Flow

| Field | Value |
|---|---|
| **Goal** | Intent 07 analytics by voice: voice "phân tích doanh thu nước tương 6 tháng" → STT + classify analytics intent → parallel queries (sales_by_month, trend_history, stock_snapshot) → synthesize narrative + build chart spec → render line/bar/donut chart + drilldown + 2 action card types (amber caution / green opportunity). 11 mockup states. |
| **Type** | V-SLICE |
| **Method** | **VSP (full)** |
| **Primary phase spec** | `PHASE_05_RECO_ANALYTICS.md` (Section D-F) |
| **Conflict resolution notes** | Chart spec từ mockup (3 types) vs spec; verify alignment |
| **Depends on** | S-08 (voice infrastructure 100% reuse), S-06 (order data input), S-02 (worker scaffolding for behavior-aggregator) |
| **Blocks** | S-11 (final demo wow showcase) |
| **Output expected** | `apps/ai/src/graphs/intents/analyzing_by_voices.py`, MCP `analytics.{sales_by_month, trend_history, stock_snapshot, co_purchased, detect_anomaly}`, V006 full apply, `apps/workers/src/{worker-analytics, behavior-aggregator}.ts`, seed `analytics_30d_demo.sql` |
| **Priority rationale** | P2 — last intent for full 8-intent coverage, demo wow narrative + chart |
| **Estimated effort** | 5-6 days |

**Mockup states cover (Rule 6 — 3 chart types confirmed):**
- state-0-mic-idle (reuse Intent 02)
- state-A-listening (reuse orb pulse Intent 02)
- state-B-analyzing (4-phase: STT → intent → SQL → synthesis)
- state-C-chart-line (full grid 30 days — dynamic SVG, NOT hard-code 30 points per debt note)
- state-D-chart-bar (full axis)
- state-E-chart-donut (simplified 5 categories + auto-merge "Khác" top-5 + 1 bucket per debt note)
- state-F-empty-no-data
- state-G-drilldown-expanded (full-screen, NOT inline modal — ADR-07-05)
- state-H-action-suggestion (amber caution + green opportunity — ADR-07-06)
- state-I-clarify (inline AI bubble)
- state-J-error E_ANALYTICS_TIMEOUT

**Tech decisions LOCKED:**
- Reuse Intent 02 voice components 100% (ADR-07-01)
- Behavior aggregator schedule 5 phút → Vespa partial update: `impressions_7d`, `clicks_7d`, `purchases_7d`, `ctr_7d`, `velocity_score`, `trend_score`
- Vespa rank profile switch `hybrid` → `hybrid_with_behavior` sau S-10 deploy
- 25K behavior events seed (5K search.performed, 12K impressions, 3K clicks, 4K views, 1K add_to_cart, 200 checkout.completed) — `PHASE_05` §G
- 3 loại "trend" disambiguation: `trend_score` (Vespa first-party) / `analytics.trend_history` (Postgres mat view) / `market_trend` (Google) — NEVER mix on same card (Pattern §10)
- Persona Anh Nam + story arc dầu ăn -18% (V006 fixture 186 orders)
- Insight detector: delta < -15% / 7d → severity caution; > +10% AND stock < 7d → opportunity

**Risks (Rule 7 surface):**
- **Conflict surfaced:** mockup 3 chart types (line/bar/donut) — verify chart_spec JSON schema cho cả 3 ở S-10 brief
- Mat view refresh lag — fallback raw query khi data < 1h
- SVG path hard-coded 30 points trong mockup — `<LineChart>` MUST dynamic from `series.data[]` (Rule 19 đề xuất)
- Donut segments cứng 5 — auto-merge "Khác" top-5 + 1 bucket
- LLM intent classifier cho "phân tích/so sánh" chưa tune — 3 chip clarify cover 70% cases
- Action card "Tạo khuyến mãi" chưa wire vào flow → mock toast "Đã tạo" cho S-10, full wire ở S-11

---

### S-11 — Demo Hardening

| Field | Value |
|---|---|
| **Goal** | Polish UI/UX, demo script 8 phút, pitch deck 10 slides, fallback plans cho Wi-Fi/API down, Grafana "Live Demo" dashboard 1 màn hình, recording backup video 30s đoạn rủi ro, README + gif demo + license MIT. |
| **Type** | Q-GATE (Checklist mode) |
| **Method** | Checklist Mode |
| **Primary phase spec** | `PHASE_06_POLISH.md` (full) |
| **Conflict resolution notes** | Demo script + pitch deck |
| **Depends on** | S-03 through S-10 (all 8 intents working) |
| **Blocks** | (none — final ship) |
| **Output expected** | `slices/S-11_BRIEF.md` + `slices/S-11_TASKLIST.md`, demo script doc, pitch deck PDF, demo video, README final, Grafana dashboard "Live Demo", `make demo:freeze` script |
| **Priority rationale** | P0-final — hackathon submission deliverable |
| **Estimated effort** | 7 days (UI polish 1d + script + rehearsal #1 + bug fix + pitch deck + rehearsal #2 + performance audit + recording + rehearsal #3 + buffer) |

**Polish tasks (per PHASE_06):**
- Loading skeleton + spinner cho mọi async
- Empty states cho cart / results / cards
- Error toasts (sonner / shadcn toast)
- Streaming text typewriter effect (cosmetic wow)
- Dark mode toggle (optional, lower priority cho mockup light-only)
- Sounds optional: subtle "ding" khi card xuất hiện
- All animations wrap `@media (prefers-reduced-motion)` guard (Rule 20 đề xuất)

**Observability wow (A2):**
- Grafana "Live Demo" 1 màn hình: service map RED metrics + intent latency p95 by intent + LLM tokens/cost realtime + Kafka consumer lag + behavior funnel conversion
- Trace samples panel
- Alert rules (console/Slack only): p95 intent > 5s, payment success < 70%, aggregator lag > 10min

**Demo reliability:**
- Pre-load demo session: login sẵn, cart trống, seed data fresh
- `ICP_DEMO_MODE=true` flag: disable verbose logs, force payment 100% success, deterministic analytics numbers
- Backup hardware: 2 laptop, 1 mobile pre-record
- Backup mode: pre-recorded video 30s đoạn rủi ro

**Performance audit targets:**
- Bundle size Next.js < 500KB
- First SSE event < 1s
- Voice transcribe < 3s cho audio 5s
- Vision analyze < 4s
- Vespa search < 200ms

**Risks (Rule 7 surface):**
- Internet down at venue → hotspot backup
- Gemini API rate limit → pre-warm + 2nd API key
- Vespa container crash → `docker-compose restart` trước demo
- Voice noise → mic gần miệng + headset
- Camera blur → pre-shot ảnh sản phẩm + button "Use demo image"

---

## Cross-Slice Dependency Graph

```
Phase 00 ✅ DONE
    ↓
S-00 (Q-GATE audit)
    ↓
    ├──→ S-01 (H-UI component library)
    │       ↓
    └──→ S-02 (P-CAP runtime foundation)
            ↓
            ├──→ S-03 (V-SLICE Auth)
            │       ↓
            │       └──→ S-04 (V-SLICE Search)
            │               ↓
            │               ├──→ S-05 (V-SLICE Cart)
            │               │       ↓
            │               │       └──→ S-06 (V-SLICE Pay)
            │               │               ↓
            │               │               └──→ (input to S-10 analytics)
            │               │
            │               └──→ S-07 (V-SLICE Image AI / Intent 01)
            │                       ↓
            │                       └──→ S-09 (V-SLICE Recommend / Intent 04)
            │                               ↓
            │                               └──→ (input to S-10)
            │
            └──→ S-08 (V-SLICE Voice Buy / Intent 02 — needs S-05 cart)
                    ↓
                    └──→ S-10 (V-SLICE Voice Analytics / Intent 07 — reuses S-08 voice 100%)
                            ↓
                            └──→ S-11 (Q-GATE Demo Hardening)
                                    ↓
                                  SHIP 🚀
```

---

## Known Conflicts Flagged (per Rule 7)

**Status legend:**
- 🔴 **Pending** — Chưa resolve, sẽ surface ở Slice Brief khi tới slice tương ứng
- 🟢 **Resolved** — Decision đã chốt, docs đã sync

| # | Conflict | Status | Slice owner | Resolution | Reference |
|---|---|---|---|---|---|
| 1 | Cart UI layout (mockup full-screen vs spec sidebar) | 🟢 Resolved | S-05 | Mockup wins (priority 1) — ADR-05-01 already documented | `DECISIONS.md` ADR-05-01 |
| 2 | Google Trends in PHASE_03 spec | 🔴 Pending | S-07 | ADR-031 + mockup win (priorities 1+2) — expand PHASE_03 spec at S-07 brief | ADR-031, `PHASE_03_IMPORT.md` (expand) |
| 3 | OTP 3DS state G handler | 🔴 Pending | S-06 | Mockup wins (priority 1) — design OTP handler at S-06 brief; expand PHASE_04 spec | Mockup `intent-06-state-G-otp.html`, `PHASE_04` (expand) |
| 4 | Intent 07 3 chart types schema | 🔴 Pending | S-10 | Mockup wins — verify chart_spec JSON schema at S-10 brief | Mockup `intent-07-state-C/D/E`, `03_API_CONTRACTS.md` (expand) |
| 5 | Shopee price source (Postgres vs JSON) | 🟢 **Resolved 2026-05-18** | S-07 | **ADR-032 Accepted** — Postgres table + seed worker; ADR-008 superseded | ADR-032, V008 migration, `02_DATA_MODEL.md`, `01_ARCHITECTURE.md` |
| 6 | Variant B co-purchase data fixture | 🔴 Pending | S-04 | Use fixture in S-04, real V006 at S-10 — define fixture format at S-04 brief | `slices/S-04_BRIEF.md` (future) |
| 7 | V006 timing (S-09 partial vs S-10 full) | 🔴 Pending | S-09 + S-10 | Partial apply V006 (co_purchase_matrix only) at S-09, full at S-10 — plan migration ordering at S-09 brief | `slices/S-09_BRIEF.md` (future) |
| 8 | Component framework choice | 🟢 **Resolved 2026-05-18** | S-01 | **ADR-033 Accepted** — shadcn/ui + Tailwind v3 | ADR-033, `PHASE_01_INFRA.md` Day 6 (updated) |
| 9 | Animation library choice | 🟢 **Resolved 2026-05-18** | S-01 | **ADR-034 Accepted** — Hybrid CSS-only + Framer Motion + canvas-confetti | ADR-034 |
| 10 | State management library | 🟢 **Resolved 2026-05-18** | S-01, S-02 | **ADR-035 Accepted** — Zustand + TanStack Query + react-hook-form + Context + useState (phân chia rõ) | ADR-035 |

**Summary:**
- ✅ **5 resolved** (#1, #5, #8, #9, #10)
- 🔴 **5 pending** (#2, #3, #4, #6, #7) — sẽ resolve ở Step 4 Slice Brief của slice tương ứng (per Rule 2 — no full backlog upfront)

---

## Priority Summary

| Priority | Slices |
|---|---|
| **P0** (foundation, blocking) | S-00, S-01, S-02, S-03, S-04 |
| **P1** (commerce + AI flagship) | S-05, S-06, S-07, S-08 |
| **P2** (extension AI, may defer) | S-09, S-10 |
| **P0-final** (ship-critical) | S-11 |

---

## What's NOT in This Backlog (per Rule 2)

- ❌ Sub-tasks per slice (Step 5 `slices/S-XX_TASKLIST.md`)
- ❌ Task Pack contents (Step 7 `taskpacks/SXX-TYY_<NAME>.md`)
- ❌ Implementation reports / review verdicts (Steps 8-9)
- ❌ Specific PR breakdown
- ❌ Day-by-day timeline

---

## Acceptance Criteria for This Backlog

- [x] 12 slices listed với 6 columns: Slice ID, Slice Name, Goal, Type, Priority, Status
- [x] Per slice: Primary Phase Spec reference (per Section 14.4.1 mapping)
- [x] Per slice: Conflict resolution notes
- [x] Per slice: Depends on / Blocks dependencies
- [x] Cross-slice dependency graph drawn
- [x] Known conflicts flagged (10 conflicts) per Rule 7
- [x] Priority assigned per slice
- [x] Mockup states coverage explicit per V-SLICE
- [x] Tech decisions LOCKED referenced (ADRs)
- [x] Risks per slice articulated
- [ ] **Human approval** of slice priority order — waiting (Step 3 will pick first slice)

---

## Next Step

Sau khi human approve backlog:
- **Step 3** — Human pick first slice (recommend **S-00 Repo Reality Check** để audit thực tế trước khi commit Stage 1 sequence)
- **Step 4** — AI tạo `slices/S-00_BRIEF.md` (Slice Brief) với evidence + DoD + risks
- **Step 5** — AI tạo `slices/S-00_TASKLIST.md` (Checklist Mode method)

---

**END OF MASTER SLICE BACKLOG.**

**Generated:** 2026-05-18
**Version:** 1.0
**Authority:** Step 2 output of ICP Workflow v1.3
**Update policy:** Bump version khi human chốt scope change, slice reorder, hoặc add/remove slice
