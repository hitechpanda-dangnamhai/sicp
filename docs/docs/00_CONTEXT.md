# ICP — Project Context (Anchor Doc)

> **Cách dùng:** Paste toàn bộ file này vào đầu MỌI conversation khi nhờ AI code dự án ICP. Đây là "hiến pháp" — không thay đổi trừ khi có quyết định lớn (ghi vào `DECISIONS.md`).

---

## 1. Project Identity

- **Tên:** ICP — Intelligent Commerce Platform
- **Mục tiêu:** Hackathon 2026. Demo trợ lý AI cho chủ shop nhỏ: 1 màn hình, nhập hàng / mua / phân tích bằng voice + image + text.
- **Repo layout:**
  ```
  icp/
    docs/                     ← bộ tài liệu này (SOURCE OF TRUTH)
      00_CONTEXT.md           ← luôn load đầu tiên
      01_ARCHITECTURE.md
      02_DATA_MODEL.md
      03_API_CONTRACTS.md
      04_INTENT_SPECS.md
      05_CODING_CONVENTIONS.md
      06_OBSERVABILITY.md     ← OpenTelemetry, ops logs, metrics, traces
      07_BEHAVIOR_LOGS.md     ← User events cho recommendation/analytics
      08_FE_BE_CONTRACT.md    ← OpenAPI codegen, type-safe FE↔BE workflow
      09_FIELD_AUDIT.md       ← UI field ↔ data source mapping, derivation rules
      LOG_CATALOG.md          ← Registry mọi log message + event type
      DECISIONS.md            ← log mọi quyết định lớn
      phases/
        PHASE_00_DESIGN_SYSTEM.md  ← Design tokens, palette, components
        PHASE_01_*.md         ← spec từng phase
        PHASE_01_HANDOFF.md   ← tạo sau khi xong phase
    apps/
      web/                    ← Next.js
      gateway/                ← NestJS
      ai/                     ← Flask + LangGraph
      mcp/                    ← MCP server
      workers/                ← Kafka consumers (payment, inventory, notification,
                                card-generator, behavior-aggregator, outbox)
    packages/
      shared-types/           ← TypeScript types dùng chung
    infra/
      docker-compose.yml
      docker-compose.observability.yml  ← LGTM stack
      otel/                   ← Collector config, Grafana dashboards
      vespa/
      kafka/
      migrations/
      seed/
  ```

## 2. Tech Stack (LOCKED — không đổi)

| Layer | Tech | Version |
|---|---|---|
| Frontend | Next.js | 14 App Router |
| API Gateway | NestJS | 10 |
| AI Service | Flask + LangGraph | Python 3.11, LangGraph 0.2+ |
| LLM (multimodal) | Gemini 2.0 Flash | qua google-generativeai |
| LLM (reasoning) | OpenAI GPT-4o-mini | qua langchain-openai |
| Search | Vespa | 8.x |
| Relational DB | PostgreSQL | 16 |
| Cache/State | Redis | 7 |
| Message bus | Kafka (Redpanda for dev) | 3.x |
| MCP server | Python | tự build, expose tools cho LangGraph |

## 3. Architectural Pillars (LOCKED)

1. **Clean Architecture** — 3 layers: `domain` / `application` / `infrastructure`. Domain không import infra. Application orchestrate.
2. **Event Sourcing (lite)** — bảng `events` append-only. Không full replay, nhưng audit + driver cho action cards.
3. **Choreography** — không có orchestrator service. Consumers tự subscribe Kafka topics và react.
4. **Idempotency** — mọi mutating endpoint nhận `Idempotency-Key` header. Lưu cache 24h trong Redis.
5. **MCP-first tool calling** — LangGraph không gọi trực tiếp Postgres/Vespa. Mọi I/O đi qua MCP server.
6. **OpenTelemetry-first observability** — Mọi service emit OTel logs/metrics/traces tới Collector từ Phase 01. Operational logs theo schema chuẩn tại `06_OBSERVABILITY.md`, message names tại `LOG_CATALOG.md`.
7. **Behavior tracking** — User events (click/view/dismiss/purchase) tách hoàn toàn khỏi operational logs, ghi qua tracker SDK → Kafka → Postgres + Vespa. Schema strict per event_type tại `07_BEHAVIOR_LOGS.md`. Đây là **input cho recommendation và learn-to-rank**.
8. **Contract-first FE↔BE** — Types định nghĩa duy nhất tại `packages/shared-types/` (Zod schemas). Backend NestJS auto-generate OpenAPI từ controller decorators. Frontend Next.js dùng auto-generated TypeScript API client. Bắt buộc chạy `pnpm openapi:sync` sau mỗi DTO change. CI verify drift. Chi tiết tại `08_FE_BE_CONTRACT.md`.
9. **Design system first — mobile-first, light, fresh** — UI tokens, components LOCKED tại `PHASE_00_DESIGN_SYSTEM.md` trước khi code feature. **Mobile-first** (viewport target 390px iPhone 13), **light + pastel** (KHÔNG dark), one-screen all-in-one cho 8 intents. Palette: Sky (primary AI) + Rose (alerts) + Mango (money) + Mint (success) + Lilac (analytics). Font: Be Vietnam Pro. Desktop = wrap UI vào phone frame centered.

## 4. 8 Intents (LOCKED — đây là scope demo)

| ID | Intent | Modality demo | Phase |
|---|---|---|---|
| 01 | `importing_products_by_images` | image | P3 |
| 02 | `buying_products_by_voices` | voice | P4 |
| 03 | `searching_products_by_text` | text | P2 |
| 04 | `recommendation_products_by_images` | image | P5 |
| 05 | `viewing_cart_products_by_text` | text | P4 |
| 06 | `paying_order_products_by_text` | text | P4 |
| 07 | `analyzing_by_voices` | voice | P5 |
| 08 | `login_logout_by_text` | text | P2 |

Chi tiết flow từng intent → xem `04_INTENT_SPECS.md`.

## 5. Naming Conventions (LOCKED)

- **Files:** `kebab-case.ts`, `snake_case.py`
- **Classes:** `PascalCase`
- **Functions/vars:** `camelCase` (TS), `snake_case` (Python)
- **DB tables:** `snake_case`, **số nhiều** (users, products, action_cards)
- **DB columns:** `snake_case`
- **Kafka topics:** `icp.<domain>.<event>` ví dụ `icp.orders.placed`, `icp.products.imported`
- **Event types:** `PascalCase` past tense (`OrderPlaced`, `ProductImported`)
- **API routes:** `/api/v1/<resource>/<action>` kebab-case
- **MCP tool names:** `<domain>.<verb>` ví dụ `vespa.search_trend`, `cart.upsert`

## 6. Communication Patterns

- **UI → Gateway:** REST/JSON over HTTPS, JWT in `Authorization` header, `Idempotency-Key` header
- **UI ← Gateway (streaming):** Server-Sent Events on `/api/v1/intent/stream`
- **Gateway → AI Service:** REST/JSON, internal network
- **AI Service → MCP:** stdio or HTTP, JSON-RPC 2.0 protocol
- **Service → Kafka:** producer with `acks=all`, idempotent producer enabled
- **Service ← Kafka:** consumer groups per worker, manual commit after DB write

## 7. Definition of Done cho mỗi feature

1. Unit test cho domain logic
2. Integration test cho ít nhất 1 happy path
3. Updated `04_INTENT_SPECS.md` nếu thay đổi flow
4. Logged decision vào `DECISIONS.md` nếu có trade-off
5. README ở apps/<service>/ ghi rõ env vars cần thiết

## 8. Out of Scope (cho Hackathon)

- ❌ Real payment integration (mock service)
- ❌ Real Shopee crawler (mock data ~50 sản phẩm)
- ❌ Multi-tenant
- ❌ Production-grade observability (chỉ console + 1 simple log aggregator)
- ❌ E2E test toàn dự án (chỉ critical flows)
- ❌ Rate limiting / DDoS protection
- ❌ GDPR / data retention
- ❌ Microservices split của AI service (1 Flask app đủ)

## 9. Mock Data Strategy

- 50 products mock, file `infra/seed/products.json`
- 10 categories: nước tương, dầu ăn, mì tôm, sữa, bánh kẹo, ...
- Mỗi product có: title, attrs JSON, price VND, stock, image URL (placeholder), trend_score float
- 5 users: 2 merchants, 3 customers, password đều là `demo1234`
- 20 historical orders + 100 events để demo analytics

## 10. Critical Constraints cho AI Agent Coding

Khi bạn (AI) được nhờ code:
1. **KHÔNG tự ý đổi naming conventions** ở section 5
2. **KHÔNG bypass MCP** — không gọi trực tiếp Postgres từ LangGraph
3. **KHÔNG hard-code business rules** vào agent code — phải qua bảng `policies`
4. **LUÔN dùng idempotency-key** cho mọi write operation từ UI
5. **KHÔNG dùng `console.log` / `print`** — luôn dùng structured logger với schema ở `06_OBSERVABILITY.md`
6. **KHÔNG tạo log message mới** mà chưa có trong `LOG_CATALOG.md` — nếu cần, propose entry trước
7. **KHÔNG trộn behavior events với operational logs** — behavior events đi qua tracker SDK, log đi qua logger
8. **KHÔNG track behavior event mới** mà chưa có trong `PropertiesMap` (TypeScript) tại `07_BEHAVIOR_LOGS.md`
9. **LUÔN propagate trace context** qua HTTP headers, Kafka headers, và SSE
10. **KHÔNG định nghĩa types ở Frontend** — chỉ import từ `@icp/shared-types`. Mọi DTO phải có Zod schema. Xem `08_FE_BE_CONTRACT.md`.
11. **KHÔNG gọi raw `fetch` từ Frontend** — phải dùng auto-generated client từ `@icp/shared-types/api`.
12. **LUÔN chạy `pnpm openapi:sync`** sau khi đổi DTO/controller. Commit cả generated files.
13. **KHÔNG hardcode color/font/spacing values** ở component — phải dùng CSS variables hoặc Tailwind classes từ design tokens (xem `PHASE_00_DESIGN_SYSTEM.md`)
14. **KHÔNG tạo UI component ad-hoc** trong feature code — phải kế thừa từ component library đã có. Thiếu component → thêm vào library trước, dùng sau.
15. **KHÔNG vẽ UI element nào mà chưa được audit field** trong `09_FIELD_AUDIT.md`. Quy trình: vẽ draft → audit từng visible field → propose migration nếu thiếu → mới được present UI final. Vi phạm = vẽ UI "đẹp giả" mà BE không có data backing.
16. Nếu phát hiện conflict giữa instruction người dùng và doc này → DỪNG LẠI và hỏi
17. Nếu cần một quyết định kiến trúc mới → đề xuất, đợi confirm, sau đó ghi vào `DECISIONS.md`

## 11. Glossary

- **Event (Domain)** — domain fact đã xảy ra (immutable), lưu `events` table + publish Kafka. Ví dụ `OrderPlaced`.
- **Behavior Event** — user action (click/view/dismiss), lưu `behavior_events` table, **khác** domain event. Drive recommendation.
- **Operational Log** — diagnostic record (info/warn/error), structured JSON, qua OTel → Loki. **Không** drive logic.
- **Action Card** — gợi ý hành động AI sinh ra cho người dùng quyết định, status: pending|accepted|rejected|expired
- **Policy** — rule DSL trong DB, dạng JSON, ánh xạ event type → action template
- **Intent** — phân loại ý định người dùng, 1 trong 8 giá trị enum
- **MCP tool** — function expose qua MCP protocol, LangGraph gọi để I/O
- **Choreography** — pattern multi-service phối hợp qua events, không có central coordinator
- **Trace** — distributed request flow across services, có `trace_id` chung
- **Span** — đơn vị 1 operation trong trace
- **OTel** — OpenTelemetry, vendor-neutral observability framework

---

**END OF ANCHOR DOC.** Luôn paste cùng với phase-specific spec.
