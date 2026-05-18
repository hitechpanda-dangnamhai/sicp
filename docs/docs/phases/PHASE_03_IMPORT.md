# Phase 03 — Import Products (Intent 01) + Events/Cards Pipeline

> **Duration:** Tuần 3  
> **Mục tiêu:** Flagship feature — chụp ảnh → tạo sản phẩm có Action Cards, full event-driven.

## Tại sao Phase này quan trọng

Đây là **wow factor** chính của demo:
- Multimodal vision (Gemini analyze image)
- Multi-tool agent (vision + trend + price + LLM compose)
- Event → Action Card pipeline (showcase Event Sourcing + Policy DSL)
- Form prefill + cards UI (showcase UX khác biệt với chat thuần)

## Definition of Done

- [ ] Merchant chụp ảnh sản phẩm → ICP analyze, prefill form
- [ ] Submit draft → tạo Event `ProductDraftSubmitted`, evaluate 5 policies, generate 0-N Action Cards
- [ ] Cards hiển thị trên UI, merchant accept/reject từng card
- [ ] Click "Nhập hàng" → ProductImported event, vào Vespa + Postgres
- [ ] Idempotent: re-click không tạo duplicate
- [ ] Policy DSL evaluator hoạt động với 5 mock policies

## Scope chi tiết

### A. MCP Tools mới

```
vision.analyze         (Gemini multimodal)
vespa.search_trend
vespa.compare_similar
shopee.price_range     (mock từ JSON)
products.create
events.append          (đã có từ P01, thêm logic publish Kafka)
policies.find_matching
cards.create
cards.list_pending
cards.update_status
```

### B. AI Service — Intent 01 Subgraph

File: `apps/ai/src/graphs/intents/importing_by_images.py`

Stages (đã đặc tả ở `04_INTENT_SPECS.md` Intent 01):
1. `vision_analyze`
2. `enrich_parallel` (search_trend + price_range + text.embed)
3. `generate_description` (LLM)
4. yield prefilled form via SSE
5. `wait_user_input` (LangGraph interrupt pattern)

Sau khi user submit form via `/intent/{rid}/action`:
6. `validate_draft`
7. `compare_similar`
8. `emit_event` (ProductDraftSubmitted)
9. `find_policies` → loop `create_card`
10. yield cards via SSE
11. `wait_user_input` again

Sau khi user click "Nhập hàng":
12. `commit_product` (Postgres + Vespa, transactional via outbox)
13. `emit_event` (ProductImported, publish Kafka)
14. final response

**LangGraph interrupt pattern:** Dùng `interrupt_before=['wait_user_input']` để pause graph, lưu state vào Redis. Khi `/intent/{rid}/action` đến, load state từ Redis và resume.

### C. Card Generator Worker

File: `apps/workers/src/card-generator.ts`

```
Subscribe topic: icp.products.events
On message ProductDraftSubmitted:
  1. Fetch event payload
  2. Build context: { avg_market_price, missing_attrs[], trend_score }
  3. Call MCP policies.find_matching(event_type, payload, context)
  4. For each matching policy:
       - Render template (replace {{...}})
       - cards.create(...)
  5. Publish CardsGenerated event (cho audit)
```

Đây là choreography đầu tiên: AI service publish event, worker consume, không sync coupling.

### D. Policy DSL Evaluator

File: `apps/mcp/src/policies/evaluator.py`

Implement evaluator cho DSL ở `02_DATA_MODEL.md` section 3:
- Parse `when.conditions`
- JSONPath subset lookup
- Operators: ==, !=, >, >=, <, <=, in, contains, matches
- Template renderer cho `then.template` (mustache-like `{{path}}`)

Unit tests: 5 policies × 2 cases (match + no-match) = 10 test cases.

### E. Web — Import Screen (RÁP từ Phase 00)

Component đã có sẵn từ P00:
- `ImageDropZone` — drag-drop với preview
- `ActionCard` + 5 variants (`SuggestPriceCard`, `SuggestAttrsCard`, ...)
- `Button`, `Input`, `Badge`, `StatusPill`
- `ProductCard` (cho preview sau commit)

Phase 03 chỉ tạo orchestration:
```
apps/web/src/features/import/
  use-import-flow.ts      ← TanStack mutation + SSE state machine
  import-screen.tsx       ← Ráp components
  prefill-form.tsx        ← Form từ react-hook-form, validate qua Zod schema từ shared-types
```

**Idempotency:** Mọi POST `/products` từ `api.products.createProduct` phải pass `idempotency-key` (UUID v4 generate ở client, store trong React state cho retry).

UX flow:
1. Merchant click "Nhập hàng bằng ảnh" (button có sẵn ở chat input)
2. ImageDropZone modal mở
3. Upload → SSE bắt đầu, StatusPill show "Đang phân tích..."
4. Nhận `FORM_PREFILL` event → render PrefillForm với react-hook-form `defaultValues`
5. User edit + submit → POST `/intent/{rid}/action`
6. Nhận `card` events → render ActionCard variants vào sidebar (component có sẵn)
7. User accept/reject từng card (POST `/cards/:id/accept` qua api client)
8. Click "Nhập hàng" → POST `/intent/{rid}/action` với commit
9. Toast success, redirect chat

### F. Card UI Components Theo action_type

| action_type | Suggestion fields | UI |
|---|---|---|
| `SUGGEST_PRICE` | current, suggested_range, rationale | Slider + apply button |
| `SUGGEST_ATTRS` | missing_attrs[] | Checklist + input cho từng attr |
| `SUGGEST_ALTERNATIVES` | products[] | Mini product grid + replace button |
| `SUGGEST_CREDIT_LOAN` | suggested_amount, terms | Info card + apply CTA |
| `SUGGEST_PROMOTION` | discount_range, bundle_with | Form input |

### G. Observability & Behavior Events

**Operational logs cần emit:**
- `intent.received`, `intent.classified`, `intent.dispatched` (router)
- `vision.analyzed` với attributes `category`, `confidence`
- `vision.low_confidence` (warn) nếu confidence < 0.3
- `vespa.search_completed` cho search_trend + compare_similar
- `llm.generated` cho LLM description + LLM rationale (track tokens!)
- `event.appended` + `event.published` cho ProductDraftSubmitted/ProductImported
- `card.created` per generated card

**Metrics:**
- Counter `icp.cards.generated{action_type, policy_code}`
- Histogram `icp.vision.duration` và `icp.vision.confidence`
- Counter `icp.llm.tokens{provider=gemini, kind=input/output}`

**Traces:**
- Span hierarchy đầy đủ: gateway → ai → mcp → vision/vespa, đảm bảo `trace_id` xuyên suốt
- LangGraph nodes wrap span: `ai.graph.intent_01.<node_name>`
- LangGraph interrupt + resume: span phải link parent qua trace context lưu trong Redis state

**Behavior events** (gọi từ Web tracker):
- `product.import_started` khi merchant click upload
- `product.import_abandoned` nếu user đóng tab ở stage form/cards
- `card.shown` cho mỗi card hiển thị (mỗi card 1 event riêng)
- `card.accepted` / `card.rejected` với `applied_value` (ví dụ giá đã apply)
- `product.import_completed` khi commit thành công

→ Behavior data này sau dùng để measure card acceptance rate, identify policies kém hiệu quả.

**Grafana:**
- Cập nhật dashboard "Cards Performance": accepted/rejected ratio per `action_type`
- Dashboard "Vision Pipeline": confidence distribution, duration p95

## Tasks ordering

### Day 1 — Vision tool + analyze flow
- MCP `vision.analyze` wrapper (Gemini 2.0 Flash), span + log + metric `icp.vision.duration`
- Test với 5 hình mẫu, verify trace trong Tempo

### Day 2 — Enrichment tools
- MCP `vespa.search_trend`, `shopee.price_range`, `vespa.compare_similar`
- Mock shopee data đầy đủ

### Day 3 — Policy DSL evaluator + seed
- Implement evaluator
- Insert 5 mock policies vào DB
- Unit tests pass

### Day 4 — AI intent_01 subgraph (stages 1-5)
- LangGraph với interrupt pattern
- Redis state persistence

### Day 5 — Cards pipeline
- Worker consume events
- Generate cards qua policies + LLM rationale
- SSE push cards to client

### Day 6 — Web UI
- Image upload + prefill form
- Card list with action variants
- Commit flow

### Day 7 — E2E test + polish
- Toàn bộ flow: photo → form → cards → commit → product visible in search
- Demo nội bộ

## Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| IMP-01 | Upload ảnh chai nước tương | Form prefilled với category=nuoc_tuong, attrs |
| IMP-02 | Submit với giá quá cao (1.5x avg) | Card SUGGEST_PRICE xuất hiện |
| IMP-03 | Submit với attrs thiếu | Card SUGGEST_ATTRS với checklist |
| IMP-04 | Submit OK, click Nhập hàng 2 lần với same key | Chỉ 1 product được tạo |
| IMP-05 | Vespa down giữa flow | Rollback PG insert, return EXTERNAL_DOWN |
| IMP-06 | Reject card SUGGEST_PRICE | Card status = rejected, vẫn import được |

## Public interfaces sẵn cho Phase 04

- LangGraph interrupt + resume pattern working
- Card system end-to-end
- Outbox pattern proven (events publish reliable)
- MCP tools comprehensive cho products
- Vespa indexing pipeline

---

## Khi xong Phase 03

Tạo `PHASE_03_HANDOFF.md`. Đặc biệt note:
- Reusable LangGraph interrupt pattern (Phase 04 dùng lại cho voice buy clarify)
- Card UI components (Phase 05 reuse cho analytics anomaly alerts)
