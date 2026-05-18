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
│  - Auth (JWT verify)                                     │
│  - Idempotency middleware                                │
│  - Route to AI service hoặc direct CRUD                  │
│  - SSE proxy                                             │
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
│  - Postgres, Redis, Vespa, External APIs                 │
└──────────────────────────────────────────────────────────┘

   Kafka (icp.*) ──→ Workers (apps/workers)
                      - card-generator
                      - payment-consumer
                      - inventory-consumer
                      - notification-consumer
                      - audit-logger
```

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

### Dependency Rule (HARD)

- `domain` → không import gì
- `application` → chỉ import từ `domain` và `application/ports`
- `infrastructure` → implement `application/ports`, import từ `domain` cho types
- `presentation` → import từ `application`, không import trực tiếp `infrastructure`
- DI container (Nest `Module` / Flask blueprint factory) wire mọi thứ

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
3. Hackathon đơn giản: trong cùng request, publish ngay sau commit, retry 3 lần nếu fail. KHÔNG dùng XA transaction.

## 4. Idempotency

Mọi POST/PUT/PATCH route đi qua `IdempotencyMiddleware` của NestJS:

```
1. Read header `Idempotency-Key` (UUID v4 từ client)
2. Check Redis key `idem:{userId}:{key}`
   - HIT → return cached response (status, body)
   - MISS → process request, sau khi success cache 24h
3. Nếu request đang xử lý (lock): return 409 Conflict
```

Pseudocode:
```ts
const lockKey = `idem:lock:${userId}:${key}`;
const cacheKey = `idem:cache:${userId}:${key}`;

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

## 5. LangGraph Structure

```
apps/ai/src/
  graphs/
    router_graph.py          ← entry point, classify modality + intent
    intents/
      importing_by_images.py ← Intent 01 subgraph
      buying_by_voices.py    ← Intent 02
      searching_by_text.py   ← Intent 03
      recommend_by_images.py ← Intent 04
      cart_by_text.py        ← Intent 05
      paying_by_text.py      ← Intent 06
      analyzing_by_voices.py ← Intent 07
      auth_by_text.py        ← Intent 08
  tools/                     ← MCP client wrappers
  state.py                   ← shared TypedDict state
```

**State design:** một `IcpState` TypedDict chứa:
```python
class IcpState(TypedDict):
    user_id: str
    session_id: str
    raw_input: dict  # {type: 'text'|'image'|'audio', content: ...}
    intent: Optional[str]
    parsed_entities: dict
    tool_results: dict
    response: dict  # {text, chart?, cards?, products?}
    events_to_publish: list
```

Mỗi subgraph nhận và trả về cùng `IcpState`.

## 6. MCP Server Tool List (LOCKED tên)

Phase 2 sẽ implement tất cả tools này:

```
# Auth
auth.verify_jwt(token) -> {user_id, role} | null

# Products
products.get(id) -> Product | null
products.create(draft) -> Product
products.update(id, patch) -> Product

# Vespa
vespa.hybrid_search(query, filters, limit) -> [Product]
vespa.nearest_neighbor(vector, category?, limit) -> [Product]
vespa.search_trend(category, window_days) -> {score, top_attrs}
vespa.index(product) -> ok
vespa.compare_similar(product) -> {avg_price, similar_count, ...}

# Shopee mock (per ADR-032 — supersedes ADR-008 JSON file approach)
# Queries Postgres table shopee_prices_mock seeded by shopee-mock-seed-worker at startup.
# Real Shopee crawler is OUT OF SCOPE for ICP — implemented in a separate project.
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
vision.embed(image_b64) -> [float]  # 768-d
speech.transcribe(audio_b64, lang) -> {text, confidence}

# Cart
cart.get(user_id) -> CartLine[]
cart.upsert(user_id, sku, qty) -> Cart
cart.remove(user_id, sku) -> Cart
cart.clear(user_id) -> ok

# Events
events.append(type, payload) -> EventId
events.list_by_product(product_id, since?) -> Event[]

# Action cards
cards.create(event_id, policy_id, action_type, suggestion) -> Card
cards.list_pending(user_id) -> Card[]
cards.update_status(id, status) -> Card

# Policy
policies.find_matching(event_type, payload) -> Policy[]

# Analytics (read-only)
analytics.sales_by_month(product_id?, range) -> [{month, revenue, qty}]
analytics.stock_snapshot(merchant_id) -> [{product_id, stock}]
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

## 8. Service Boundaries — Ai sở hữu cái gì

| Concern | Owner |
|---|---|
| JWT validate, idempotency, rate limit | Gateway (NestJS) |
| Intent classification, multi-tool orchestration | AI Service |
| DB writes (Products, Orders, Events, Cards) | MCP server (called by Gateway hoặc AI) |
| Embedding generation | MCP server (calls Gemini) |
| Vespa indexing | MCP server |
| Kafka publish | Gateway VÀ AI service (both can publish) |
| Kafka consume | Workers only |
| Action Card generation | `card-generator` worker (consumes events) |
| Payment, Inventory, Notification on order | Respective workers |

## 9. Error Handling

- **Domain errors** — typed exceptions trong `domain/errors.ts`, ví dụ `InsufficientStockError`, `ProductNotFoundError`
- **Application errors** — wrap domain + technical (`TimeoutError`, `ExternalServiceError`)
- **HTTP mapping** trong presentation layer:
  - `*NotFound` → 404
  - `Insufficient*` / `Invalid*` → 400
  - `Unauthorized` → 401
  - `Forbidden` → 403
  - `Conflict*` / `Duplicate*` → 409
  - Anything else → 500 + log

## 10. Diagrams to Maintain

Khi thay đổi flow lớn, update các sequence diagrams đã thống nhất ở conversation gốc (8 intents). Nếu repo, lưu dưới dạng PlantUML hoặc Mermaid trong `docs/diagrams/`.

---

**END OF ARCHITECTURE DOC.**
