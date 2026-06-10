# ICP — Project Context (Anchor Doc)

> **Cách dùng:** Paste toàn bộ file này vào đầu MỌI conversation khi nhờ AI code dự án ICP. Đây là "hiến pháp" — không thay đổi trừ khi có quyết định lớn (ghi vào `DECISIONS.md`).
>
> **v2.0 — Hackathon → Production pivot (2026-06-09).** Mục tiêu giờ là sản phẩm production thật, không còn demo hackathon. Quyết định này phải được log vào `DECISIONS.md` (ADR mới). Các file `01`–`09`, `LOG_CATALOG.md`, `DECISIONS.md` sẽ được chuẩn hoá theo bản này ở các phiên sau.
>
> **v2.1 (2026-06-09)** — sync với `02_DATA_MODEL.md` + ADR-042/043/044: thêm `audit-logger` vào workers; per-tenant learn-to-rank + hash-chain audit + usage metering chuyển sang in-scope (§8); làm rõ tenant model #2 (user/session global) ở pillar 10; bổ sung glossary.

---

## 1. Project Identity

- **Tên:** ICP — Intelligent Commerce Platform
- **Mục tiêu:** Sản phẩm **production** — nền tảng SaaS **multi-tenant** cung cấp trợ lý AI thương mại cho chủ shop: 1 màn hình all-in-one, nhập hàng / mua / phân tích bằng voice + image + text.
- **Repo layout:**
  ```
  icp/
    docs/                     ← bộ tài liệu cross-cutting (SOURCE OF TRUTH, quản riêng)
      00_CONTEXT.md           ← luôn load đầu tiên (hiến pháp)
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
      DECISIONS.md            ← ADR registry — log mọi quyết định lớn cross-cutting
      phases/                 ← spec theo area/phase (vd PHASE_00_DESIGN_SYSTEM, PHASE_03_IMPORT)
      mockups/                ← mockups per intent (intent-01 … intent-08)
      handoff/                ← handoff docs giữa các phase
    slices/                   ← per-vertical execution docs (1 bộ / feature, cùng cấp docs/)
      S-NN_BRIEF.md           ← goal, evidence, done-means, non-goals, deps
      S-NN_TASKLIST.md        ← task breakdown (T01, T02 …)
      S-NN_decisions-log.md   ← D-S-NN (LAW) + C-S-NN (conflict) trong phạm vi slice
      S-NN_LAYER_MATRIX.md    ← VSP layer matrix
      INDEX_{SLICES,DECISIONS,PROJECT}_S-NN.md
      MASTER_SLICE_BACKLOG.md ← trạng thái toàn bộ slices
    apps/
      web/                    ← Next.js
      gateway/                ← NestJS
      ai/                     ← Flask + LangGraph
      mcp/                    ← MCP server
      workers/                ← Kafka consumers (payment-consumer, inventory-consumer,
                                notification-consumer, card-generator, behavior-aggregator,
                                outbox, audit-logger, shopee-crawl)
                                # ⚠️ CHƯA CODE (verified 2026-06-09): thật mới = skeleton
                                #   (index.ts + shopee-mock-seed-worker.ts); 8 worker implement
                                #   Phase 04+ (audit-logger=ADR-042, shopee-crawl=ADR-039 prod)
    packages/
      shared-types/           ← TypeScript types dùng chung (Zod + OpenAPI client)
    infra/
      docker-compose.yml
      docker-compose.observability.yml  ← LGTM stack (đã có)
      otel/                   ← Collector config, Grafana dashboards
      vespa/
      kafka/                  ← Redpanda (dev) / managed Kafka (prod)
      migrations/
      seed/                   ← dev/seed only — KHÔNG dùng làm dữ liệu production
  ```

> **Per-vertical docs:** mỗi feature có 1 bộ doc trong `slices/S-NN_*`. Khi code 1 feature, đọc slice tương ứng để biết chi tiết execution — `00_CONTEXT` chỉ giữ invariant, **không lặp lại** nội dung slice. Quyết định mới: ADR cross-cutting → `docs/DECISIONS.md`; quyết định trong phạm vi 1 slice → `slices/S-NN_decisions-log.md`.

## 2. Tech Stack (LOCKED — phản ánh production hiện tại)

| Layer | Tech | Version / Note |
|---|---|---|
| Frontend | Next.js | 14 App Router (14.2.x) |
| API Gateway | NestJS | 10 (10.4.x) |
| AI Service | Flask + LangGraph | Python 3.11, LangGraph 0.2.x (0.2.76) |
| LLM (multimodal/primary) | **Gemini 2.5 Flash** (+ `gemini-2.5-flash-lite` cho background) | qua `google-generativeai` |
| LLM (fallback) | OpenAI GPT-4o-mini | qua `openai` SDK (không phải langchain-openai) |
| Vision | **Gemini 2.5 Flash** (`gemini-2.5-flash`) | qua MCP `vision.*` — `genai.generate_content`; KHÔNG dùng OpenAI (verified 2026-06-10: `vision.py` `analyze`/`suggest_attributes`) |
| Speech (STT + TTS) | **OpenAI** — STT `gpt-4o-transcribe`, TTS `gpt-4o-mini-tts` | qua MCP `speech.*`; `GEMINI_SPEECH_MODEL` chỉ giữ backward-compat/log, KHÔNG gọi ở call-site (verified 2026-06-10: `speech.py` `transcribe`/`synthesize`) |
| Search | Vespa | 8.x (CLIP-multilingual 512-dim shared text+image) |
| Relational DB | PostgreSQL | 16 |
| Cache/State | Redis | **redis-stack-server 7.4.0-v8** (RedisJSON; verified compose — KHÔNG redis:7-alpine) |
| Message bus | Kafka (Redpanda for dev) | redpanda **v23.3.10** trong compose — ⚠️ **CHƯA WIRE ở code** (verified 2026-06-09): hiện outbox `events.published_at=NULL` + Redis pub/sub `sse:pubsub:{rid}` cho SSE; Kafka wire = Phase 04+ |
| Payment | **VNPay + Momo + ZaloPay** | qua SDK/API chính thức (production); offline COD/chuyển khoản; mock=dev. DB `chk_payment_method` (verified 2026-06-09) = {mock, momo, zalopay, bank_transfer, cod}; **`vnpay` CHƯA có trong CHECK → V011 ALTER thêm (CHƯA CODE)**. |
| MCP server | Python | tự build, expose tools cho LangGraph |

## 3. Architectural Pillars (LOCKED)

1. **Clean Architecture** — 3 layers: `domain` / `application` / `infrastructure`. Domain không import infra. Application orchestrate. ⚠️ **(verified 2026-06-10):** code Gateway hiện = **feature-module**; chỉ `auth/` có đủ 3 layer (`domain`/`application`/`infrastructure`), các module khác (`cart`/`cards`/`products`/`intent`/`dashboard`/`tracking`…) phẳng. Clean Architecture = **convention/target** khi build feature mới (cross-ref `01_ARCHITECTURE` §2, `05_CODING_CONVENTIONS` §1).
2. **Event Sourcing (lite)** — bảng `events` append-only. Không full replay, nhưng audit + driver cho action cards.
3. **Choreography** — không có orchestrator service. Consumers tự subscribe Kafka topics và react. ⚠️ **CHƯA WIRE** (verified 2026-06-09): Kafka chưa nối ở code; hiện dùng outbox (`events.published_at=NULL`) + Redis pub/sub SSE. Workers = skeleton (implement Phase 04+).
4. **Idempotency** — mọi mutating endpoint nhận `Idempotency-Key` header. Lưu cache 24h trong Redis.
5. **MCP-first tool calling** — LangGraph không gọi trực tiếp Postgres/Vespa. Mọi I/O đi qua MCP server.
6. **OpenTelemetry-first observability** — Mọi service emit OTel logs/metrics/traces tới Collector. LGTM stack (Loki/Grafana/Tempo/Prometheus) đã triển khai. Schema chuẩn tại `06_OBSERVABILITY.md`, message names tại `LOG_CATALOG.md`.
7. **Behavior tracking** — User events (click/view/dismiss/purchase) tách hoàn toàn khỏi operational logs, ghi qua tracker SDK → Kafka → Postgres + Vespa. ⚠️ **(verified 2026-06-10):** hiện `POST /track` ghi **trực tiếp `INSERT INTO behavior_events`** (Postgres, partitioned theo tháng, `ON CONFLICT DO NOTHING`); **Kafka + Vespa-indexing = CHƯA WIRE** (target — `behavior-aggregator` worker CHƯA CODE). Schema strict per event_type tại `07_BEHAVIOR_LOGS.md`. Input cho recommendation và learn-to-rank. **Tracking PII phải có consent — xem pillar 10.**
8. **Contract-first FE↔BE** — Types định nghĩa duy nhất tại `packages/shared-types/` (Zod schemas). Backend NestJS auto-generate OpenAPI từ controller decorators. Frontend dùng auto-generated TS API client. Bắt buộc `pnpm openapi:sync` sau mỗi DTO change. CI verify drift. Chi tiết tại `08_FE_BE_CONTRACT.md`.
9. **Design system first — mobile-first, light, MoMo Premium** — UI tokens, components LOCKED tại `phases/PHASE_00_DESIGN_SYSTEM.md` trước khi code feature. **Mobile-first** (390px iPhone 13), **light** (KHÔNG dark), one-screen all-in-one. Palette (v3 LOCKED per **ADR-023**, verified PHASE_00 + `app/globals.css`): **MoMo-inspired hồng-cam — Pink-600 `#E91E63` dominant + Orange `#F97316` accent**, gradient mềm + radial glow. *(Palette cũ Sky/Rose/Mango/Mint/Lilac pastel = SUPERSEDED bởi ADR-023.)* Font: Be Vietnam Pro. Desktop = wrap UI vào phone frame centered.
10. **Multi-tenancy + Data privacy (production)** — 🟡 **CHƯA CODE (target, ADR-040/041; verified 2026-06-09: 0 cột `tenant_id`, không bảng tenants/tenant_memberships/consent_records — sẽ thêm V011).** Thiết kế: Hệ thống là SaaS nhiều shop (**model #2 marketplace**): tenant = 1 shop; **mọi dữ liệu tenant-scoped** (products, orders, transactions, events, behavior…) thuộc về 1 `tenant_id`, isolation bắt buộc (row-level security / RLS + scope ở repo). **Ngoại lệ:** `users`/`sessions` là **account global** (customer mua nhiều shop); merchant/staff gắn tenant qua `tenant_memberships`; `tenant_id` resolve **per-request**. Không bao giờ truy vấn cross-tenant. Dữ liệu cá nhân (PII) tuân thủ **GDPR (chuẩn châu Âu)** đồng thời **Luật BVDLCN 2025 (Luật 91/2025/QH15) + NĐ 356/2025/NĐ-CP** của VN: consent trước khi xử lý, quyền truy cập/xóa, retention policy, DPIA cho profiling/AI.

## 4. 8 Intents (LOCKED — core scope)

| ID | Intent | Modality | Phase |
|---|---|---|---|
| 01 | `importing_products_by_images` | image | P3 |
| 02 | `buying_products_by_voices` | voice | P4 |
| 03 | `searching_products_by_text` | text | P2 |
| 04 | `recommendation_products_by_images` | image | P5 |
| 05 | `viewing_cart_products_by_text` | text | P4 |
| 06 | `paying_order_products_by_text` | text | P4 |
| 07 | `analyzing_by_voices` | voice | P5 |
| 08 | `login_logout_by_text` | text | P2 |

Đây là enum LOCKED. Tên file graph trong `apps/ai/src/graphs/intents/` có thể rút gọn (vd `importing_by_images.py`) nhưng **giá trị intent enum phải đúng bảng này**. Chi tiết flow → `04_INTENT_SPECS.md`.

## 5. Naming Conventions (LOCKED)

- **Files:** `kebab-case.ts`, `snake_case.py`
- **Classes:** `PascalCase`
- **Functions/vars:** `camelCase` (TS), `snake_case` (Python)
- **DB tables:** `snake_case`, **số nhiều** (users, products, action_cards)
- **DB columns:** `snake_case`
- **Kafka topics:** `icp.<domain>.<event>` ví dụ `icp.orders.placed`, `icp.products.imported`
- **Event types:** `PascalCase` past tense (`OrderPlaced`, `ProductImported`)
- **API routes:** `/api/v1/<resource>/<action>` kebab-case
- **MCP tool names:** `<domain>.<verb>` ví dụ `vespa.search_trend`, `cart.update_qty`

## 6. Communication Patterns

- **UI → Gateway:** REST/JSON over HTTPS, JWT in `Authorization` header, `Idempotency-Key` header
- **UI ← Gateway (streaming):** Server-Sent Events on `/api/v1/intent/stream`
- **Gateway → AI Service:** REST/JSON, internal network
- **AI Service → MCP:** stdio or HTTP, JSON-RPC 2.0 protocol
- **Service → Kafka:** producer với `acks=all`, idempotent producer enabled
- **Service ← Kafka:** consumer groups per worker, manual commit after DB write
- **Propagation:** trace context + `tenant_id` propagate qua HTTP headers, Kafka headers, và SSE

## 7. Definition of Done cho mỗi feature (Production)

1. Unit test cho domain logic
2. Integration test cho happy path + các error path quan trọng
3. E2E test cho critical flows (auth, search, cart, payment, import)
4. Updated spec docs liên quan (`04_INTENT_SPECS`, `02_DATA_MODEL`, `03_API_CONTRACTS`) + `slices/S-NN_decisions-log.md`
5. Logged decision: ADR cross-cutting → `DECISIONS.md`; trong phạm vi slice → slice decisions-log
6. Security review: tenant isolation verified, idempotency trên writes, không leak PII/secret
7. Observability: spans/metrics/logs cho path mới + entries trong `LOG_CATALOG.md`
8. Migration + rollback plan nếu thay đổi schema
9. README ở `apps/<service>/` ghi rõ env vars cần thiết

## 8. Scope (Production)

### Trong scope — phải làm
- ✅ **Payment thật** — tích hợp **VNPay + Momo + ZaloPay** qua SDK/API chính thức (callback/IPN, reconciliation, refund cơ bản); offline COD/chuyển khoản
- ✅ **Multi-tenant SaaS** — `tenant_id` + isolation xuyên suốt (DB, cache, search, events)
- ✅ **Nguồn dữ liệu Shopee = crawler thật** — pipeline crawl feed `shopee_prices` (worker `shopee-crawl`). ⚠️ Lưu ý ToS/pháp lý + rate-limit/anti-bot; cần review rủi ro. (Thay thế quyết định cũ trong `01_ARCHITECTURE.md §6` "out of scope / separate project".)
- ✅ **Data privacy compliance** — **GDPR (chuẩn châu Âu)** + Luật BVDLCN 2025 / NĐ 356/2025: consent, data subject rights (truy cập/xóa), retention policy, DPIA cho tracking/recommendation
- ✅ **Production observability** — LGTM/OTel stack (đã có)
- ✅ **Rate limiting / abuse protection** — ở Gateway (per-tenant + per-user)
- ✅ **E2E tests** cho critical flows
- ✅ **Tamper-evident audit log** (hash-chain trên `audit_log`, ADR-042) — mạnh cho payment + compliance
- ✅ **Per-tenant learn-to-rank / personalization** (ADR-043) — mỗi shop có ranking riêng theo hành vi khách của shop (Vespa rank-profile `personalized` + `tenant_ranking_weights`)
- ✅ **Per-tenant usage metering** (ADR-044) — `usage_events`/`usage_daily` phục vụ billing SaaS

### Tạm hoãn — deferred (mở lại khi cần)
- 🔲 **Tách sâu microservices AI service** — hiện AI = 1 Flask app, MCP đã là service riêng; chỉ tách thêm khi tải/đội ngũ yêu cầu
- 🔲 **Learn-to-rank bằng deep models** (beyond per-tenant LTR v1 ở trên) — ví dụ neural ranker / embeddings-based reranker huấn luyện riêng, ở phase sau

## 9. Data & Seeding Strategy

- **Seed data chỉ dùng cho dev/test** (`infra/seed/`) — **KHÔNG** dùng làm dữ liệu production.
- **Hiện trạng DB (verified `products` 2026-06-09 — single source of truth):** **75 products**, **12 category values**: `banh_keo, banh_mi, dau_an, do_dong_hop, gao, gia_vi, mi_tom, nuoc_giai_khat, nuoc_tuong, sua, tuong_ot` + ⚠️ **`gạo`** — trùng nghĩa `gao` nhưng **khác encoding (có dấu)** → category CHƯA normalize (data quirk seed). **Nên dùng:** normalize category về slug không dấu (gộp `gạo`→`gao`) trong seed + migration cleanup. Seed file `infra/seed/products.json` có thể lệch DB — **DB là chuẩn**.
- Mỗi product: `title`, **`attributes`** (JSON), `price` (VND), `stock`, `image_url`, `trend_score` (float), kèm các field enrich (`brand`, `original_price`, `rating_avg/count`, `sold_count`, …). *Lưu ý: field tên là `attributes`, không phải `attrs`; `image_url` seed hiện để rỗng — production phải có ảnh thật.*
- Analytics seed: `generate_seed.py` sinh ~**150–1600 orders** + behavior events cho dashboard 30 ngày (không phải con số "20 orders/100 events" cũ).
- ⚠️ **Bảo mật:** 5 user seed với `password = demo1234` là **DEV ONLY**. Production: đăng ký/đăng nhập thật, password policy mạnh (bcrypt cost ≥10), secrets qua secret manager — **tuyệt đối không** có tài khoản mặc định/khoá demo trong prod.
- **Shopee data:** mock fixture chỉ cho dev; production lấy từ crawler (`shopee-crawl` worker) feed bảng `shopee_prices`.

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
9. **LUÔN propagate trace context + `tenant_id`** qua HTTP headers, Kafka headers, và SSE
10. **KHÔNG định nghĩa types ở Frontend** — chỉ import từ `@icp/shared-types`. Mọi DTO phải có Zod schema. Xem `08_FE_BE_CONTRACT.md`.
11. **KHÔNG gọi raw `fetch` từ Frontend** — phải dùng auto-generated client từ `@icp/shared-types/api`.
12. **LUÔN chạy `pnpm openapi:sync`** sau khi đổi DTO/controller. Commit cả generated files.
13. **KHÔNG hardcode color/font/spacing values** ở component — phải dùng CSS variables hoặc Tailwind classes từ design tokens (xem `phases/PHASE_00_DESIGN_SYSTEM.md`)
14. **KHÔNG tạo UI component ad-hoc** trong feature code — phải kế thừa từ component library đã có. Thiếu component → thêm vào library trước, dùng sau.
15. **KHÔNG vẽ UI element nào mà chưa được audit field** trong `09_FIELD_AUDIT.md`. Quy trình: vẽ draft → audit từng visible field → propose migration nếu thiếu → mới được present UI final.
16. **LUÔN scope mọi DB query/command theo `tenant_id`** (multi-tenant isolation) — không bao giờ truy vấn cross-tenant.
17. **Tuân thủ GDPR cho PII** — consent trước khi tracking; hỗ trợ truy cập/xóa; tôn trọng retention; KHÔNG log PII (chỉ định danh tối thiểu như `user_id`/`tenant_id`).
18. Nếu phát hiện conflict giữa instruction người dùng và doc này → **DỪNG LẠI và hỏi**
19. Nếu cần một quyết định kiến trúc mới → đề xuất, đợi confirm, sau đó ghi vào `DECISIONS.md`

## 11. Glossary

- **Tenant** — một shop trên SaaS (model #2 marketplace); dữ liệu tenant-scoped isolate theo `tenant_id`. User/session là account global.
- **Tenant membership** — quan hệ user↔tenant cho merchant/staff (RBAC quản trị shop); bảng `tenant_memberships`. Customer global KHÔNG có membership.
- **Audit log (hash-chain)** — bảng `audit_log` tamper-evident: mỗi bản ghi có `prev_hash`+`hash` (SHA256 chain) per-tenant; ghi bởi `audit-logger`. Khác `events` (outbox) và operational log.
- **Per-tenant learn-to-rank** — ranking riêng từng shop: trọng số học từ `behavior_events` lưu `tenant_ranking_weights`, áp qua Vespa rank-profile `personalized`.
- **Usage metering** — đo mức dùng per-tenant (`usage_events`/`usage_daily`) cho billing SaaS.
- **PII** — dữ liệu cá nhân (tên, email, hành vi gắn user). Tuân thủ GDPR + Luật BVDLCN 2025.
- **DPIA** — Data Protection Impact Assessment, đánh giá tác động cho profiling/AI.
- **Event (Domain)** — domain fact đã xảy ra (immutable), lưu `events` table + publish Kafka. Ví dụ `OrderPlaced`.
- **Behavior Event** — user action (click/view/dismiss), lưu `behavior_events` table, **khác** domain event. Drive recommendation.
- **Operational Log** — diagnostic record (info/warn/error), structured JSON, qua OTel → Loki. **Không** drive logic.
- **Action Card** — gợi ý hành động AI sinh ra cho người dùng quyết định, status: pending|accepted|rejected|expired
- **Policy** — rule DSL trong DB, dạng JSON, ánh xạ event type → action template
- **Intent** — phân loại ý định người dùng, 1 trong 8 giá trị enum
- **MCP tool** — function expose qua MCP protocol, LangGraph gọi để I/O
- **Choreography** — pattern multi-service phối hợp qua events, không có central coordinator
- **Trace / Span** — distributed request flow / 1 operation trong trace, có `trace_id` chung
- **OTel** — OpenTelemetry, vendor-neutral observability framework

---

**END OF ANCHOR DOC.** Luôn paste cùng với phase-specific spec (hoặc `slices/S-NN_*`).
