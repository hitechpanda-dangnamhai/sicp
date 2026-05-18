# 03 — API Contracts

> **Load khi:** code controller, DTO, MCP tool, hoặc frontend client. Contracts đây là LOCKED — đổi cần `DECISIONS.md`.

## 1. Gateway REST Endpoints (NestJS)

Base URL: `/api/v1`

### 1.1 Auth

```
POST /auth/login
  Body: { email, password }
  Response 200: { access_token, refresh_token, user: {id, email, role, display_name} }
  Errors: 401 (invalid creds)

POST /auth/logout
  Header: Authorization: Bearer <jwt>
  Response 204
  
POST /auth/refresh
  Body: { refresh_token }
  Response 200: { access_token }

GET /auth/me
  Header: Authorization: Bearer <jwt>
  Response 200: { id, email, role, display_name }
```

### 1.2 Intent (Universal Endpoint)

Đây là **endpoint chính**, mọi user input đều qua đây.

```
POST /intent
  Header: Authorization, Idempotency-Key
  Body (multipart/form-data hoặc JSON):
    Variant A (text):
      { modality: 'text', content: 'mua nước tương' }
    Variant B (image):
      multipart: file=<binary>, modality='image', hint?='import'|'buy'|'search'|'recommend'
    Variant C (voice):
      multipart: file=<audio binary>, modality='voice'
  
  Response: text/event-stream (SSE), see Section 3

POST /intent/{request_id}/action
  Mô tả: user respond lại 1 action card hoặc clarification
  Body: { card_id?, choice?, value? }
  Response: SSE stream tiếp theo
```

### 1.3 Products

```
GET /products?merchant_id&category&q&limit&cursor
  Response 200: { items: Product[], next_cursor? }

GET /products/:id
  Response 200: Product | 404

POST /products
  Header: Idempotency-Key
  Body: ProductCreateDTO
  Response 201: Product

PATCH /products/:id
  Header: Idempotency-Key
  Body: ProductPatchDTO (partial)
  Response 200: Product

DELETE /products/:id  → archive thay vì xoá thật
  Response 204
```

### 1.4 Cart

```
GET /cart
  Response 200: { items: [{product_id, title, price, qty, image_url}], total }

POST /cart/items
  Body: { product_id, qty }
  Response 200: Cart

PATCH /cart/items/:product_id
  Body: { qty }
  Response 200: Cart

DELETE /cart/items/:product_id
  Response 200: Cart

DELETE /cart
  Response 204
```

### 1.5 Orders

```
POST /orders/checkout
  Header: Idempotency-Key (BẮT BUỘC)
  Body: {} hoặc { shipping_address? }
  Response 202: { order_id, status: 'pending' }
  
  Subsequent: client mở SSE /orders/:id/stream để nhận updates

GET /orders
  Response 200: { items: Order[] }

GET /orders/:id
  Response 200: OrderDetail (items, transactions, status_history)

GET /orders/:id/stream
  Response: SSE, push events khi status change
```

### 1.6 Action Cards

```
GET /cards?status=pending&limit=20
  Response 200: { items: ActionCard[] }

POST /cards/:id/accept
  Body: { params? }   # tuỳ action_type
  Response 200: ActionCard

POST /cards/:id/reject
  Response 200: ActionCard
```

### 1.7 Analytics

```
GET /analytics/sales?product_id?&range=6m
  Response 200: { series: [{month, revenue, qty}], summary: {...} }

GET /analytics/trend?product_id&range=6m
  Response 200: { series: [{date, score}], top_attrs: [...] }

GET /analytics/stock
  Response 200: { items: [{product_id, title, stock, status}] }
```

## 2. DTOs (TypeScript canonical)

```ts
// packages/shared-types/src/dto.ts

export type ProductCreateDTO = {
  title: string;            // 3..255
  description?: string;
  category: string;
  attributes: Record<string, string | number | boolean>;
  price: number;            // VND, integer >= 0
  stock: number;            // integer >= 0
  image_url?: string;
};

export type ProductPatchDTO = Partial<ProductCreateDTO> & {
  status?: 'active' | 'archived' | 'draft';
};

export type Product = {
  id: string;
  merchant_id: string;
  title: string;
  description?: string;
  category: string;
  attributes: Record<string, unknown>;
  price: number;
  stock: number;
  image_url?: string;
  trend_score: number;
  status: 'active' | 'archived' | 'draft';
  created_at: string;
  updated_at: string;
};

export type CartItem = {
  product_id: string;
  title: string;
  price: number;
  qty: number;
  image_url?: string;
  subtotal: number;
};

export type Cart = {
  items: CartItem[];
  total: number;
  updated_at: string;
};

export type ActionCard = {
  id: string;
  event_id: string;
  policy_code: string;
  action_type: string;
  suggestion: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at?: string;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  total: number;
  created_at: string;
};
```

## 3. SSE Event Format (đã định nghĩa ở 01_ARCHITECTURE, lặp lại đầy đủ)

Content-Type: `text/event-stream`

```
event: status
data: {"phase": "classifying" | "analyzing" | "searching" | "synthesizing" | "done"}

event: partial_text
data: {"delta": "Tôi đang phân tích "}

event: tool_call
data: {"tool": "vespa.search_trend", "args": {...}}

event: tool_result
data: {"tool": "vespa.search_trend", "result_summary": "..."}

event: products
data: {"items": [Product, Product, ...]}

event: card
data: ActionCard

event: chart
data: {"type": "line", "title": "...", "x_axis": "...", "y_axis": "...", "series": [...]}

event: order_update
data: {"order_id": "...", "status": "paid"}

event: final
data: {"text": "...", "summary": {...}}

event: error
data: {"code": "string", "message": "string", "retriable": boolean}

event: heartbeat
data: {"ts": 1700000000}    # gửi mỗi 15s để giữ connection
```

Client (Next.js):
```ts
const es = new EventSource(`/api/v1/intent?request_id=${id}`);
es.addEventListener('partial_text', (e) => append(JSON.parse(e.data).delta));
es.addEventListener('card', (e) => showCard(JSON.parse(e.data)));
es.addEventListener('final', (e) => { finalize(); es.close(); });
es.addEventListener('error', ...);
```

## 4. Standard Error Format

Mọi error response (non-SSE):
```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Sản phẩm không tồn tại",
    "details": { "product_id": "..." },
    "request_id": "..."
  }
}
```

Error codes (extensible):

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` | DTO validation lỗi |
| 400 | `INVALID_INTENT` | Cannot classify |
| 401 | `UNAUTHORIZED` | JWT thiếu hoặc invalid |
| 403 | `FORBIDDEN` | JWT valid nhưng không có quyền |
| 404 | `PRODUCT_NOT_FOUND` / `ORDER_NOT_FOUND` / ... | |
| 409 | `IDEMPOTENCY_CONFLICT` | Cùng key đang xử lý |
| 409 | `INSUFFICIENT_STOCK` | Đặt vượt quá tồn |
| 422 | `POLICY_VIOLATION` | Domain rule fail |
| 429 | `RATE_LIMITED` | (Phase sau) |
| 500 | `INTERNAL` | Unknown |
| 503 | `EXTERNAL_DOWN` | Vespa/Gemini timeout |

## 5. MCP Tool Specs

MCP tools dùng JSON-RPC 2.0. Signature dạng:

```yaml
# auth
auth.verify_jwt:
  params: { token: string }
  returns: { user_id: string, role: string } | null

# products  
products.get:
  params: { id: string }
  returns: Product | null

products.create:
  params: { merchant_id: string, draft: ProductCreateDTO }
  returns: Product

products.update:
  params: { id: string, patch: ProductPatchDTO }
  returns: Product

# vespa
vespa.hybrid_search:
  params:
    query: string
    filters: { category?: string, price_max?: number, ... }
    limit: int (default 10)
  returns: [Product]

vespa.nearest_neighbor:
  params:
    vector: float[768]
    category?: string
    limit: int
  returns: [Product]

vespa.search_trend:
  params: { category: string, window_days: int }
  returns: { score: float, top_attrs: [string], top_products: [Product] }

vespa.index:
  params: { product: Product, text_emb: float[768], image_emb?: float[768] }
  returns: { ok: true }

vespa.compare_similar:
  params: { product: ProductCreateDTO }
  returns: { similar_count: int, avg_price: number, price_p25: number, price_p75: number }

# shopee (mock)
shopee.price_range:
  params: { category: string, attrs?: dict }
  returns: { min: number, max: number, avg: number, sample_count: int }

# gtrends (mock) — market demand signal
gtrends.interest_over_time:
  params:
    keyword: string         # vd: "nước tương Maggi" 
    geo: string             # default 'VN'
    window_days: int        # default 90
  returns:
    current_score: int      # 0-100 (Google Trends scale)
    delta_pct: number       # % change vs previous window (-50..+200)
    trajectory: 'rising' | 'stable' | 'falling'
    series: [{date: 'YYYY-MM-DD', value: int}]   # ≤ 90 points
    related_rising: [string]   # top 5 related queries rising
    fetched_at: string

# multimodal
vision.analyze:
  params: { image_b64: string }
  returns:
    category: string
    attributes: dict
    ocr_text: string
    confidence: float

vision.embed:
  params: { image_b64: string }
  returns: { vector: float[768] }

text.embed:
  params: { text: string }
  returns: { vector: float[768] }

speech.transcribe:
  params: { audio_b64: string, lang: string (default 'vi') }
  returns: { text: string, confidence: float }

speech.synthesize:
  params: { text: string, lang: string, voice?: string }
  returns: { audio_b64: string, format: 'mp3' }

# cart
cart.get:
  params: { user_id: string }
  returns: Cart

cart.upsert:
  params: { user_id: string, sku: string, qty: int }
  returns: Cart

cart.remove:
  params: { user_id: string, sku: string }
  returns: Cart

cart.clear:
  params: { user_id: string }
  returns: { ok: true }

# events
events.append:
  params:
    type: string
    aggregate_type: string
    aggregate_id: string
    user_id?: string
    payload: dict
    metadata?: dict
  returns: { event_id: string }

events.list_by_aggregate:
  params: { aggregate_type, aggregate_id, since? }
  returns: [Event]

# action cards
cards.create:
  params: { event_id, policy_id, user_id, action_type, suggestion, expires_in_seconds? }
  returns: ActionCard

cards.list_pending:
  params: { user_id, limit?: int }
  returns: [ActionCard]

cards.update_status:
  params: { id: string, status: 'accepted'|'rejected', params?: dict }
  returns: ActionCard

# policies
policies.find_matching:
  params: { event_type: string, payload: dict, context?: dict }
  returns: [Policy]    # ordered by priority

# analytics (đọc-only, query-heavy)
analytics.sales_by_month:
  params: { product_id?: string, merchant_id?: string, range_months: int }
  returns: [{ month: 'YYYY-MM', revenue: number, qty: int }]

analytics.trend_history:
  params: { product_id?: string, category?: string, range_days: int }
  returns: [{ date: 'YYYY-MM-DD', score: float }]

analytics.stock_snapshot:
  params: { merchant_id: string }
  returns: [{ product_id, title, stock, days_no_sale }]
```

## 6. Pagination

Cursor-based, không offset:
```
GET /products?limit=20&cursor=eyJp...
Response: { items: [...], next_cursor: "eyJp..." | null }
```

Cursor là base64 của `{last_id, last_created_at}`.

## 7. Validation Rules

- Backend: class-validator (Nest), pydantic (Flask)
- Client cũng validate cơ bản (UX), nhưng server LUÔN re-validate
- Price: integer VND, không float
- String length limits: title 3-255, description 0-5000
- File upload: image ≤ 5MB, audio ≤ 10MB, format jpg/png/webp / mp3/wav/webm

## 8. CORS

Dev: allow `http://localhost:3000`
Prod: allow exact domain only.

## 9. Versioning

URL versioned: `/api/v1/...`. Breaking changes → `/v2`. Trong Hackathon scope chỉ có v1.

---

**END OF API CONTRACTS DOC.**
