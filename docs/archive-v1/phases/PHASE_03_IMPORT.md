# Phase 03 — Import Products (Intent 01) + Events/Cards Pipeline

> **Status:** ✅ **DONE** (import-by-image graph + cards pipeline verified vs `importing_by_images.py` 2026-06-09). Phần production = §Production.
> **Mục tiêu:** Chụp/upload ảnh → analyze → prefill form → policies → Action Cards → commit product (Vespa + Postgres), event-driven (outbox).
>
> **Cross-ref:** `04_INTENT_SPECS.md` Intent 01, `02_DATA_MODEL.md` (products, policies, events, action_cards), `03_API_CONTRACTS.md`.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs apps/ai/.../importing_by_images.py):
- Flow thật = Pattern A 2-interrupt (submit_draft + commit); enrich parallel = compare_similar+search_trend+shopee.price_range+gtrends (KHÔNG text.embed); outbox events (published_at=NULL); cards INLINE trong graph.
- Kafka DEFERRED (code: "Kafka publish defers to S-06") → outbox-only, chưa relay. Đánh CHƯA WIRE.
- §A "23 registered tools" (snapshot S-07) → thật 37 tool.
- shopee.price_range mock (ADR-032) → production crawler thật shopee_prices (ADR-039); gtrends fixture (ADR-031).
- XOÁ cruft: Phiên Sx07-D, C-S07-NN, D-S04-15, Day1-7, Duration Tuần3, "wow factor demo".
- THÊM §Production: shopee crawler real, Kafka+outbox-relay worker, card-generator worker, circuit breaker, products CRUD, file-upload validate, image CDN (TÙY CHỌN). -->

## Definition of Done — trạng thái thật (verified)

- [x] Merchant upload ảnh → vision analyze → prefill form (SSE) ✅
- [x] Submit draft → Event `ProductDraftSubmitted` (outbox), evaluate policies, generate 0-N Action Cards ✅
- [x] Cards hiển thị, accept/reject từng card ✅
- [x] Commit "Nhập hàng" → `ProductImported` (outbox) + Vespa index + Postgres ✅
- [x] Idempotent commit (products.create outbox idempotent) ✅
- [x] Policy DSL evaluator (`policies.find_matching`) ✅
- [ ] Kafka publish + outbox-relay worker — 🟡 CHƯA WIRE (defer; outbox ghi events table)

## Scope

### A. MCP Tools (Intent 01) — verified

> Catalog tổng = **37 tool registered** (KHÔNG phải 23 snapshot S-07). Tools Intent 01 dùng (verified call trong graph):

| Tool | Vai trò | Note |
|---|---|---|
| `vision.analyze` | Gemini Flash multimodal → category, attributes, ocr_text, confidence, confidence_per_field, alternatives | model version per `apps/mcp` config |
| `vision.suggest_attributes` | gợi ý thuộc tính thiếu | |
| `vespa.compare_similar` | sản phẩm tương tự + avg_price/p25/p75 (enrich phase) | |
| `vespa.search_trend` | trend score theo category, windowed N ngày | |
| `shopee.price_range` | so giá Shopee `{aggregates, samples}` | **mock** `shopee_prices_mock` (ADR-032) → production crawler thật `shopee_prices` (ADR-039) |
| `gtrends.interest_over_time` | trajectory + series + delta_pct + related_rising | **fixture-mock** (ADR-031) → production real gtrends (tuỳ chọn) |
| `analytics.suggest_price` | gợi giá (dùng trong create_cards) | |
| `policies.find_matching` | DSL evaluator — `trigger`/`condition{op,field,value}`/`action{type,template}` (flat field, KHÔNG JSONPath) | match theo trigger event_type |
| `cards.create` / `cards.list_pending` / `cards.update_status` | tạo/list/accept-reject cards (outbox CardStatusChanged) | |
| `products.create` / `products.get` / `products.update` | idempotent outbox INSERT/UPDATE; ownership re-verify trong txn | `products.update` whitelist field |
| `events.append` | outbox INSERT same-txn (published_at=NULL) | |
| `vespa.index` | feed Document API; embed **native** từ title/description | |

> ~~`text.embed`~~ **KHÔNG dùng** — Vespa embed native (CLIP 512-dim). Image storage = base64 inline `products.image_data` (V010), không S3/V007.

### B. AI Service — Intent 01 graph (`apps/ai/src/graphs/intents/importing_by_images.py`) — flow thật

> ✅ **Pattern A LangGraph, 2 interrupt** (submit_draft + commit), AsyncRedisSaver checkpointer, outbox event-sourcing.

Nodes (verified `_node_*` + `add_node`):
1. `vision_analyze` — MCP `vision.analyze`.
2. `enrich` — **parallel** MCP: `vespa.compare_similar` + `vespa.search_trend` + `shopee.price_range` + `gtrends.interest_over_time` *(KHÔNG text.embed)*.
3. `generate_description` — LLM.
4. `emit_prefill` → publish prefill form SSE → **`interrupt({awaiting:'submit_draft'})`** → graph PAUSE. Resume qua `POST /intent/{rid}/action` → `Command(resume=...)`.
5. `emit_draft_event` — MCP `events.append` `ProductDraftSubmitted` (**outbox**, `published_at=NULL`, same-txn).
6. `find_policies` — MCP `policies.find_matching` trigger=`ProductDraftSubmitted`.
7. `create_cards` — loop MCP `cards.create` (+ `analytics.suggest_price` cho SUGGEST_PRICE).
8. `emit_cards_interrupt` → publish cards SSE → **`interrupt({awaiting:'commit'})`** → PAUSE.
9. `commit` — MCP `products.create` (**outbox** emit `ProductImported`) + `vespa.index`. Idempotent. *(verified: node name code = `commit`, KHÔNG `commit_product`; trace span `ai.graph.intent_01.commit`.)*

> **Outbox (verified):** events ghi vào bảng `events` với `published_at=NULL`. **Relay → Kafka = CHƯA WIRE** (code: "Kafka publish defers to S-06"). Choreography pattern giữ ở event-sourcing layer; consumer = inline graph (cards), async relay = production.

### C. Card generation — inline (DONE) + worker (CHƯA CODE)

- ✅ **Hiện tại:** cards sinh **inline trong graph** (`find_policies` + `create_cards`). Outbox `ProductDraftSubmitted` vẫn emit để future async consumer replay.
- 🟡 **Production target:** worker `card-generator` (subscribe `icp.products.events` → policies → cards.create → publish CardsGenerated). Hiện `apps/workers` = skeleton → CHƯA CODE.

### D. Policy DSL Evaluator (`apps/mcp/src/policies/evaluator.py`)

DSL theo `02_DATA_MODEL.md` §3 (**verified rule_dsl 2026-06-09**): mỗi policy = `{ trigger, condition{op, field, value}, action{type, template} }`. Evaluator: match `trigger` = event_type → eval `condition` (op ∈ `>`,`<`,`>=` + composite `lt_with_hot`; `field` = metric **phẳng** vd `price_vs_median_pct`/`trend_delta_pct`/`missing_attrs_count`/`days_since_last_sale`/`stock_and_trend` — **KHÔNG JSONPath**) → emit card `action.type` với template `action.template` (tên template string). Test: **7 policy** × (match + no-match).

### E. Web — Import Screen (components verified tồn tại)

Components thật (`components/icp/molecules/`): `ImageDropZone`, `PrefillForm`, `ActionCard`, `ShopeeCompareCard(+Expanded)`, `TrendCard(+Expanded)`, `BlurErrorCard`, `LowConfidenceWarningBanner`, `BrainCheckBadge`, `AnalyzingPhasesCard`, `SuccessTransition`. Route `app/intent-01`.

Orchestration `apps/web/src/features/import/` *(verified 2026-06-09 — path có prefix `src/`)*: `use-import-flow.ts` (TanStack + SSE), `import-state-machine.ts` (state machine), `action-poster.ts` (POST `/intent/{rid}/action` resume), `use-ai-attribute-suggest.ts` (suggest-attrs flow), `tracking-hooks.ts` (behavior events). *(Doc cũ ghi `features/import/import-screen.tsx` + `prefill-form.tsx` = SAI: screen = `app/intent-01/page.tsx`; form = `components/icp/molecules/PrefillForm.tsx`.)*

> **Verified FE structure:** `apps/web/components/` (root, KHÔNG `src/`) chứa UI; `apps/web/src/features/` chứa orchestration = **6 feature = 6 graph**: `cart` (Intent05) · `import` (Intent01) · `recommend` (Intent04) · `search` (Intent03) · `voice-analyze` (Intent07) · `voice-buy` (Intent02). Route = App Router `app/intent-0X/page.tsx` (intent-01..07).

UX: upload → "Đang phân tích" → prefill form → submit (`POST /intent/{rid}/action`) → cards → accept/reject → "Nhập hàng" commit → toast. **Idempotency-Key** (UUID v4 client) mọi POST `/products`.

### F. Card UI theo action_type

| action_type | Fields | UI |
|---|---|---|
| `SUGGEST_PRICE` | current, suggested_range, rationale | Slider + apply |
| `SUGGEST_ATTRS` | missing_attrs[] | Checklist + input |
| `SUGGEST_ALTERNATIVES` | products[] | Mini grid + replace |
| `SUGGEST_CREDIT_LOAN` | suggested_amount, terms | Info + apply |
| `SUGGEST_PROMOTION` | discount_range, bundle_with | Form |
| `SUGGEST_STOCK_UP` | delta_pct, trajectory, suggested_qty | Info + stock-up CTA (`ac-stock-up`; policy MARKET_RISING) |
| `SUGGEST_WAIT_OR_REDUCE` | delta_pct, trajectory | Warning + wait/reduce (`ac-wait`; policy TREND_FADING/MARKET_FALLING) |

> **7 action card type (verified code grep 2026-06-09):** SUGGEST_PRICE/ATTRS/ALTERNATIVES/CREDIT_LOAN/PROMOTION + STOCK_UP + WAIT_OR_REDUCE. (ALTERNATIVES sinh bởi import/create_cards path; STOCK_UP/WAIT_OR_REDUCE từ policy MARKET_*/TREND_FADING.)

### G. Observability & Behavior Events

- Logs: `intent.received/classified/dispatched`; `vision.analyzed{category,confidence}` + `vision.low_confidence` (warn <0.3); `vespa.search_completed` (search_trend/compare_similar); `llm.generated` (track tokens); `event.appended` (ProductDraftSubmitted/ProductImported); `card.created`.
- Metrics: `icp.cards.generated{action_type,policy_code}`; `icp.vision.duration`/`confidence`; `icp.llm.tokens{provider,kind}`.
- Traces: gateway→ai→mcp→vision/vespa cùng `trace_id`; node span `ai.graph.intent_01.<node>`; interrupt+resume link parent qua trace context lưu Redis.
- Behavior events (catalog.ts thật): `product.import_started/completed/abandoned/viewed`, `card.shown/accepted/rejected`.
- Grafana: "Cards Performance" (accept/reject ratio per action_type), "Vision Pipeline" (confidence dist, duration p95).

## Test scenarios (giữ)

| ID | Scenario | Expected |
|---|---|---|
| IMP-01 | Upload ảnh chai nước tương | Form prefilled category=nuoc_tuong + attrs |
| IMP-02 | Giá quá cao (1.5x avg) | Card SUGGEST_PRICE |
| IMP-03 | Attrs thiếu | Card SUGGEST_ATTRS checklist |
| IMP-04 | Commit 2 lần same key | 1 product |
| IMP-05 | Vespa down giữa flow | Rollback PG, return external-down |
| IMP-06 | Reject SUGGEST_PRICE | status=rejected, vẫn import |

## Public interfaces sẵn cho Phase 04

- LangGraph interrupt+resume pattern (Phase 04 voice buy clarify dùng lại).
- Card system end-to-end (inline).
- **Outbox WRITE proven** (events `published_at=NULL`); relay→Kafka = CHƯA CODE.
- MCP products tools comprehensive; Vespa indexing pipeline.

---

## Production hardening (§5b)

| Hạng mục | Hiện trạng | Đề xuất + nên dùng gì | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **Shopee crawler thật (ADR-039)** | mock `shopee_prices_mock` | worker `shopee-crawl` → `shopee_prices`; tool shape giữ. ⚠️ rủi ro ToS/pháp lý | 🟡 CHƯA CODE | P1 |
| **Kafka wire + outbox-relay worker** | outbox ghi events, chưa relay | worker đọc events `published_at=NULL` → publish `icp.products.events` → set published_at; DLQ | 🟡 CHƯA CODE | P1 |
| **card-generator worker** | inline graph | worker async consume → cards (giảm tải graph khi scale) | 🟡 CHƯA CODE | P1 |
| **File upload validate** | base64 inline | validate MIME + size + reject oversize trước analyze (`05 §10`) | 🟡 CHƯA CODE | **P0** |
| **Circuit breaker vision/Gemini + retry** | timeout | breaker + backoff cho Gemini vision + Vespa + Shopee | 🟡 CHƯA CODE | P1 |
| **products CRUD** | chỉ PATCH `:id` | GET/POST/DELETE `/products` (`03 §1.3`) | 🟡 CHƯA CODE | P1 |
| **gtrends real API** | fixture-mock (ADR-031) | Google Trends real (rate-limit + cache) | 🔵 TÙY CHỌN | P2 |
| **Image CDN** | base64 inline `image_data` | `image_url` để dành → S3/CDN khi ảnh lớn/nhiều | 🔵 TÙY CHỌN | P2 |
| **Tenant scoping (ADR-040)** | 0 tenant_id | products/events/cards scope `tenant_id` (RLS) | 🟡 CHƯA CODE | P0 |

---

## Khi Phase 03 hoàn tất (đã DONE)

Reusable: LangGraph interrupt pattern (Phase 04 voice clarify), card UI components (Phase 05 anomaly alerts), outbox event-sourcing (Kafka relay = production).

---

**END — PHASE_03 (Production reconcile 2026-06-09).**
