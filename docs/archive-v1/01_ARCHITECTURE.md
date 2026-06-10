# 01 — Architecture

> **Load khi:** code service boundaries, layering, dependency direction, hoặc khi tạo module/folder mới.

## 1. High-Level Components

```
┌──────────────────────────────────────────────────────────┐
│  Next.js Web (apps/web)                                  │
│  - 1 màn hình all-in-one                                 │
│  - SSE client cho streaming                              │
│  - SWR/TanStack Query cho REST                           │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTPS REST + SSE
                 ▼
┌──────────────────────────────────────────────────────────┐
│  NestJS Gateway (apps/gateway)                           │
│  - Auth (JWT verify) + Tenant resolve (tenant_id)       │
│  - Rate limiting (per-tenant + per-user)                │
│  - Idempotency middleware                               │
│  - Route to AI service hoặc direct CRUD                 │
│  - SSE proxy                                            │
└────────────────┬─────────────────────────────────────────┘
                 │ Internal HTTP/JSON
                 ▼
┌──────────────────────────────────────────────────────────┐
│  AI Service (apps/ai) — Flask + LangGraph                │
│  - Intent classifier                                     │
│  - 8 sub-agents (1 graph mỗi intent)                     │
│  - Streaming response                                    │
└────────┬─────────────────────────────────────────────────┘
         │ MCP protocol (JSON-RPC over stdio/HTTP)
         ▼
┌──────────────────────────────────────────────────────────┐
│  MCP Server (apps/mcp)                                   │
│  - Tool registry                                         │
│  - Postgres, Redis, Vespa                               │
│  - External APIs: Gemini, VNPay/Momo/ZaloPay, Shopee crawl│
└──────────────────────────────────────────────────────────┘

   Kafka (icp.*) ──→ Workers (apps/workers)
                      - card-generator
                      - payment-consumer
                      - inventory-consumer
                      - notification-consumer
                      - behavior-aggregator
                      - outbox
                      - audit-logger
                      - shopee-crawl
   # ⚠️ CHƯA CODE (verified 2026-06-09): apps/workers/src THẬT = SKELETON — chỉ `index.ts`
   #   (header: "Status: Skeleton S-00b T02; actual logic implement Phase 04+") + `shopee-mock-seed-worker.ts`.
   #   → 8 worker trên CHƯA implement. `audit-logger` = wow ADR-042 (chưa có cả trong skeleton list của index.ts).
   #   `shopee-crawl` = ADR-039 production (hiện mới chỉ có `shopee-mock-seed-worker`).
```

> ⚠️ **Gateway — verified 2026-06-09:** **Tenant resolve** (0 dòng `tenant` trong `apps/gateway/src`) + **Rate limiting** (chỉ comment "Future S-05+", chưa có ThrottlerModule) = 🟡 **CHƯA CODE** (ADR-040 + production hardening). ĐÃ CÓ: JWT auth, `IdempotencyMiddleware`, SSE proxy, route.

## 2. Clean Architecture Per Service

Mỗi service NestJS / Flask theo cấu trúc 3 lớp:

```
apps/<service>/src/
  domain/              ← Pure business logic, NO imports from infra/app
    entities/
    value-objects/
    events/            ← Domain event types
    policies/          ← Pure rule evaluators
    errors.ts
  application/         ← Use cases, orchestration
    use-cases/         ← Mỗi file = 1 use case
    ports/             ← Interfaces (ProductRepo, EventBus, ...)
    dto/
  infrastructure/      ← Adapters cho ports
    postgres/
    redis/
    kafka/
    vespa/
    mcp/
  presentation/        ← Controllers / handlers
    rest/
    sse/
```

> **Verified vs code (2026-06-09):** cấu trúc THẬT = **feature-module** (NestJS): `apps/gateway/src/{auth,cart,cards,products,intent,dashboard,tracking,health,idempotency,clients,config,database,observability}/`. Clean-arch 3 lớp (`domain`/`application`/`infrastructure`) áp **bên trong module** nơi phức tạp (vd `auth/` có đủ 3 lớp); module đơn giản để controller+service ở root. **KHÔNG** có thư mục `presentation/`/`use-cases/`/`ports/` tách riêng. AI service = `graphs/`+`tools/`+`prompts/` (graph-based, KHÔNG 3 lớp). Sơ đồ dưới là **convention/target** — áp dần theo độ phức tạp, KHÔNG phải layout bắt buộc mọi module.

### Dependency Rule (HARD)

- `domain` → không import gì
- `application` → chỉ import từ `domain` và `application/ports`
- `infrastructure` → implement `application/ports`, import từ `domain` cho types
- `presentation` → import từ `application`, không import trực tiếp `infrastructure`
- DI container (Nest `Module` / Flask blueprint factory) wire mọi thứ
- **Multi-tenant (ADR-040):** `tenant_id` là 1st-class context. Domain entities/aggregates mang `tenant_id`; mọi port (repo/search/event bus) phải scope theo `tenant_id`. `tenant_id` lấy từ JWT ở presentation, truyền xuống application → infrastructure; KHÔNG bao giờ query cross-tenant.

### Vi phạm điển hình cần tránh

```ts
// ❌ BAD — application import infra trực tiếp
import { PostgresProductRepo } from '../infrastructure/postgres/product-repo';

// ✅ GOOD — application chỉ biết về port
import { ProductRepo } from '../ports/product-repo';
```

## 3. Event Flow

```
User action
    │
    ▼
Use case (application)
    │
    ├──► Write to repo (Postgres) [transaction]
    │
    ├──► Append to `events` table (same transaction = outbox pattern)
    │
    └──► After commit: publish to Kafka
              │
              ▼
        Consumer (worker) reads
              │
              ├──► Apply policy → maybe create ActionCard
              │
              └──► May publish derived events
```

**Outbox pattern:** Để tránh "DB committed but Kafka publish failed", dùng pattern outbox:
1. Use case ghi cả entity + event row vào DB trong cùng transaction
2. Một background job đọc events table chưa publish, push lên Kafka, mark published
3. **Production (theo ADR-006):** trong cùng transaction ghi business row + events row (`published_at=NULL`). Sau commit → publish lên Kafka → set `published_at`. Background sweeper retry mỗi 30s cho events chưa published. Consumers phải idempotent (có thể duplicate publish). KHÔNG dùng XA transaction.

> ⚠️ **CHƯA CODE (verified 2026-06-09):** Kafka **chưa wire** (không có topic `icp.*`, không có kafkajs/producer/consumer; "subscribe" trong code = Redis pub/sub cho SSE). Bảng `events` (Postgres) do MCP ghi thì có; nhưng **outbox-relay → Kafka + consumers = target** (worker skeleton — xem §1, `LOG_CATALOG`). Toàn bộ event-bus flow ở §3 là kiến trúc đích.

## 4. Idempotency

`IdempotencyMiddleware` (NestJS) được áp **per-module qua `.forRoutes()`** cho các route mutating cụ thể (KHÔNG tự động cho mọi POST/PUT/PATCH — danh sách route verified ở note cuối §4):

```
1. Read header `Idempotency-Key` (UUID v4 từ client)
2. Check Redis key `idem:{tenantId}:{userId}:{key}`
   - HIT → return cached response (status, body)
   - MISS → process request, sau khi success cache 24h
3. Nếu request đang xử lý (lock): return 409 Conflict
```

Pseudocode:
```ts
const lockKey = `idem:lock:${tenantId}:${userId}:${key}`;
const cacheKey = `idem:cache:${tenantId}:${userId}:${key}`;

const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const locked = await redis.set(lockKey, '1', { NX: true, EX: 30 });
if (!locked) throw new ConflictException();

try {
  const result = await next(); // run actual handler
  await redis.setex(cacheKey, 86400, JSON.stringify(result));
  return result;
} finally {
  await redis.del(lockKey);
}
```

> ⚠️ **Verified 2026-06-09:** `IdempotencyMiddleware` CÓ THẬT (`apps/gateway/src/idempotency/idempotency.middleware.ts`, áp ở module). Nhưng key hiện **chưa có `tenantId`** (tenant CHƯA CODE) → thực tế `idem:{userId}:{key}`; thêm `{tenantId}` khi multi-tenant (ADR-040).
>
> ⚠️ **Re-verified 2026-06-10 (phạm vi áp dụng):** KHÔNG áp blanket — mỗi module gọi `consumer.apply(IdempotencyMiddleware).forRoutes(...)` cho route mutating cụ thể. Evidenced: `POST /intent` (`intent.module`); 6 cart-write (`cart.module`: POST `/cart/items`, PATCH/DELETE `/cart/items/:productId`, DELETE `/cart`, POST/DELETE `/cart/promo`); POST `/cards/:id/accept|reject` (`cards.module`); + 4 route BẮT BUỘC per `03_API_CONTRACTS` §1 (POST /intent, POST /products, PATCH /products/:id, POST /orders/checkout).
>
> ⚠️ **Idempotency middleware THỨ 2** — `intent/intent-action-idempotency.middleware.ts` (S-04): riêng cho `POST /api/v1/intent/:rid/action`, key composite `intent:action:{rid}:{attempt_n}` (TTL **5min** ≠ 24h), cho retry hợp lệ qua `attempt_n` monotonic; tách khỏi base do dedup semantics khác.

## 5. LangGraph Structure

> **Verified vs code (2026-06-09):** thật có **6 subgraph** (Intent **06 paying** + **08 auth** do Gateway/workers xử lý — KHÔNG có graph). `router_graph.py` là **classifier skeleton**; `main.py` dispatch subgraph (vd `searching_by_text` invoke trực tiếp). `state.py` nằm ở `apps/ai/src/state.py` (KHÔNG trong `graphs/`).

```
apps/ai/src/
  state.py                   ← IcpState TypedDict (shared)
  graphs/
    router_graph.py          ← classify modality + intent (skeleton; dispatch ở main.py)
    intents/
      importing_by_images.py ← Intent 01
      buying_by_voices.py    ← Intent 02
      searching_by_text.py   ← Intent 03
      recommend_by_images.py ← Intent 04
      cart_by_text.py        ← Intent 05
      analyzing_by_voices.py ← Intent 07
      # Intent 06 (paying), 08 (auth): KHÔNG có graph — Gateway + workers
  tools/                     ← MCP client wrappers
```

**State design:** `IcpState` (`TypedDict, total=False`) — field thật gồm `user_id` (JWT-resolved, propagate từ Gateway `POST /intent`), `intent`, `request_id`, `mode`, `entry_intent`… (mở rộng dần per-intent):
```python
class IcpState(TypedDict, total=False):
    user_id: str           # JWT-resolved, từ Gateway
    intent: Optional[str]
    request_id: str
    # … intent-specific fields (mode, entry_intent, tool_results, response, …)
    # Production (ADR-040): + tenant_id propagate từ Gateway — HIỆN CHƯA có (code task)
```
Mỗi subgraph nhận và trả về cùng `IcpState`.

## 6. MCP Server Tool List (LOCKED tên)

**Tool registry THẬT** (verified vs `apps/mcp/src/tools/` 2026-06-09; phần lớn ĐÃ implement). Production: mọi tool đọc/ghi dữ liệu tenant-scoped nhận + scope theo `tenant_id` (RLS) — code chưa có (greenfield):

```
# Tenancy & privacy (production):
#   - Mọi tool đọc/ghi dữ liệu tenant-scoped phải nhận + scope theo tenant_id
#     (signature chi tiết ở 02_DATA_MODEL / 03_API_CONTRACTS + impl).
#   - KHÔNG trả/ghi dữ liệu cross-tenant; KHÔNG log PII.
# Payment (VNPay/Momo/ZaloPay) KHÔNG qua MCP — Gateway init + payment-consumer worker
#   xử lý callback/IPN với external gateway (ADR-038).

# Auth
auth.verify_jwt(token) -> {user_id, tenant_id, role} | null   # ⚠️ code = STUB (verify THẬT ở Gateway; shape+tenant_id=target — xem 03 §5)

# Products
products.get(id) -> Product | null
products.create(draft) -> Product
products.update(id, patch) -> Product

# Vespa
vespa.hybrid_search(query, filters, limit) -> [Product]
vespa.image_nearest_neighbor(image_b64, category?, limit) -> [Product]   # CODE: registered (S-09)
vespa.search_trend(category, window_days) -> {score, top_attrs}
vespa.index(product) -> ok
vespa.compare_similar(product) -> {avg_price, similar_count, ...}

# Shopee price reference. CODE THẬT (verified `shopee.py` 2026-06-10): query bảng `shopee_prices_mock`
# (V008, ADR-032 mock — `shopee.py:126/147 FROM shopee_prices_mock`). 🟡 CHƯA CODE: `shopee_prices` (real crawl,
# ADR-039 supersedes ADR-032) + `shopee-crawl` worker (hiện chỉ có `shopee-mock-seed-worker`) — xem §8 banner.
# ⚠️ Crawl có rủi ro ToS/pháp lý — cần rate-limit, anti-bot, và fallback stale cache
#    (giữ last-known + flag stale khi crawl fail). Schema (aggregates + samples JSONB)
#    giữ nguyên từ ADR-032 nên không phá MCP tool signature.
shopee.price_range(category, attrs) -> {
  found: bool,
  min: int,        # min_price VND
  avg: int,        # avg_price VND
  max: int,        # max_price VND
  count: int,      # sample_count
  review_count: int,
  samples: [       # 3-5 sample products for Intent 01 state D expanded panel
    {
      title: str,
      store: str,
      price: int,
      rating: float | null,
      sold_count: int
    },
    ...
  ],
  updated_at: ISO8601 str
}

# Multimodal
vision.analyze(image_b64) -> {category, attributes, ocr_text}
vision.suggest_attributes(...) -> {attributes}                 # CODE: registered
vision.embed(image_b64) -> [float]  # 512-d CLIP ViT-B/32 (ADR-036) — CHƯA CODE (embedding qua Vespa native embedder, không có MCP tool riêng)
speech.transcribe(audio_b64, lang) -> {text, confidence}
speech.synthesize(text, lang) -> {audio_b64}                   # CODE: registered

# Google Trends (market demand) — CODE: registered
gtrends.interest_over_time(keyword, window) -> {series, trajectory}

# Cart (7 tools — Redis snapshot, S-05)
cart.get(user_id) -> Cart
cart.update_qty(user_id, product_id, qty) -> Cart       # CODE: registered
cart.remove(user_id, product_id) -> Cart
cart.clear(user_id) -> ok
cart.validate_stock(user_id) -> {issues[]}              # CODE: registered
cart.apply_promo(user_id, code) -> Cart                 # CODE: registered
cart.remove_promo(user_id) -> Cart                      # CODE: registered

# Events
events.append(type, payload) -> EventId
events.list_by_product(product_id, since?) -> Event[]    # CHƯA CODE (chỉ `events.append` registered)

# Action cards
cards.create(event_id, policy_id, action_type, suggestion) -> Card
cards.list_pending(user_id) -> Card[]
cards.update_status(id, status) -> Card

# Policy
policies.find_matching(event_type, payload) -> Policy[]

# Analytics (10 tools registered — Intent 07)
analytics.stock_snapshot(merchant_id) -> [{product_id, stock}]
analytics.aggregate(...) ; analytics.detect_anomaly(...) ; analytics.explain_trend(...)        # CODE: registered
analytics.suggest_price(...) ; analytics.suggest_promo(...) ; analytics.suggest_restock(...)    # CODE: registered
analytics.suggest_loan(...) ; analytics.co_purchased(...) ; analytics.product_corpus_size()     # CODE: registered
analytics.sales_by_month(product_id?, range) -> [{month, revenue, qty}]   # CHƯA CODE (doanh thu đọc qua matview / endpoint 03 §1.7)
```

## 7. Streaming Response Protocol

Format SSE events từ Gateway xuống Next.js:

```
event: status
data: {"phase": "analyzing"}

event: partial
data: {"text": "Tôi đang phân tích hình..."}

event: tool_result
data: {"tool": "vespa.search_trend", "result": {...}}

event: card
data: {"id": "...", "type": "PriceTooHigh", "suggestion": {...}}

event: chart
data: {"type": "line", "data": {...}}

event: final
data: {"text": "...", "products": [...]}

event: error
data: {"code": "TIMEOUT", "message": "..."}
```

Next.js dùng `EventSource` API để consume.

> ⚠️ **Verified:** đây chỉ là **ví dụ format** (tên rút gọn, vd `partial`→thật `partial_text`). **SSE map đầy đủ = 31 event** (verified `intent-stream.ts`) — xem `08_FE_BE_CONTRACT.md §6` làm chuẩn (product_ready/understanding/typo_suggestion/variant_degraded/voice_*/cart_*/stock_*/analytics_*…).

## 8. Service Boundaries — Ai sở hữu cái gì

| Concern | Owner |
|---|---|
| JWT validate, tenant resolve, idempotency, rate limit | Gateway (NestJS) |
| Intent classification, multi-tool orchestration | AI Service |
| DB writes (Products, Orders, Events, Cards) | MCP server (called by Gateway hoặc AI) |
| Embedding generation | MCP server (calls Gemini) |
| Vespa indexing | MCP server |
| Kafka publish | Gateway VÀ AI service (both can publish) |
| Kafka consume | Workers only |
| Action Card generation | `card-generator` worker (consumes events) |
| Payment init (VNPay/Momo/ZaloPay) | Gateway |
| Payment callback/IPN verify + reconcile | `payment-consumer` worker |
| Inventory / Notification on order | `inventory-consumer` / `notification-consumer` |
| Audit trail (cross-topic: product/payment/user activity) | `audit-logger` worker |
| Shopee price crawl → `shopee_prices` | `shopee-crawl` worker |
| Outbox relay (events → Kafka) | `outbox` worker |
| Behavior aggregation → Vespa/analytics | `behavior-aggregator` worker |
| Tenant isolation (scope mọi data theo tenant_id) | Tất cả services (enforced ở repo/port + RLS) |
| Data privacy (consent/retention/DSAR), no-PII-log | Gateway + dedicated handlers |

> ⚠️ **CHƯA CODE (verified):** mọi dòng giao cho `*-worker`/`*-consumer`/`outbox`/`audit-logger`/`shopee-crawl` ở trên là **phân công target** — `apps/workers/src` thật mới là skeleton (`index.ts` + `shopee-mock-seed-worker.ts`), logic implement Phase 04+. **Kafka publish/consume cũng CHƯA WIRE** (không topic `icp.*`, không kafkajs — chỉ Redis pub/sub cho SSE). Gateway/MCP rows (auth/intent/products PATCH/cart/dashboard/tracking + `IdempotencyMiddleware` + ghi `events` Postgres) thì đã có code. **NHƯNG `rate limit` + `tenant resolve`/`tenant isolation` (các dòng Gateway/All-services trên) = 🟡 CHƯA CODE** (verified: 0 dòng tenant trong gateway; rate-limit chỉ comment future).

## 9. Error Handling

- **Domain errors** — typed exceptions trong `domain/errors.ts`, ví dụ `InsufficientStockError`, `ProductNotFoundError`
- **Application errors** — wrap domain + technical (`TimeoutError`, `ExternalServiceError`)
- **HTTP mapping** trong presentation layer:
  - `*NotFound` → 404
  - `Insufficient*` / `Invalid*` → 400
  - `Unauthorized` → 401
  - `Forbidden` → 403
  - `Conflict*` / `Duplicate*` → 409
  - `Payment*` (failed/declined) → 402; payment input lỗi → 400
  - Cross-tenant access attempt → 404 (không lộ tồn tại) hoặc 403 tuỳ ngữ cảnh
  - Anything else → 500 + log

## 10. Diagrams to Maintain

Khi thay đổi flow lớn, update các sequence diagrams đã thống nhất ở conversation gốc (8 intents). Nếu repo, lưu dưới dạng PlantUML hoặc Mermaid trong `docs/diagrams/`.

---

**END OF ARCHITECTURE DOC.**
