# 04 — Intent Specs

> **Load khi:** code LangGraph subgraph, hoặc fix bug intent. Reference cho cả frontend khi build UI.

Mỗi intent có format:
- **Modality demo** (1 trong 3, đã LOCKED ở `00_CONTEXT`)
- **Input contract**
- **Graph stages**
- **Tools used**
- **Events emitted**
- **Output contract** (SSE events Frontend nhận)
- **Error paths**

---

## Intent 01 — `importing_products_by_images`

### Modality demo: image (multipart upload)

### Input
```json
{ "modality": "image", "file": "<binary>", "hint": "import" }
```

### Graph stages
```
ENTRY
  └─► classify_intent (LLM)
       └─► [intent=importing_by_images] → IMPORT_GRAPH
             ├─► vision_analyze (vision.analyze)
             ├─► enrich (parallel)
             │     ├─► vespa.search_trend
             │     ├─► shopee.price_range
             |     ├─► gtrends.interest_over_time  ← (MỚI, market demand)
             │     └─► text.embed (cho indexing sau)
             ├─► generate_description (LLM call)
             ├─► EMIT events.append(ProductDraftSuggested)
             └─► wait_user_input (return prefilled form via SSE)

USER ENTERS price, qty, title, then POST /intent/{rid}/action with {choice:'submit_draft', value: form}

CONTINUE
  ├─► validate (domain)
  ├─► vespa.compare_similar
  ├─► EMIT events.append(ProductDraftSubmitted)
  ├─► policies.find_matching → loop create cards
  └─► wait_user_input (return cards via SSE)

USER resolves cards → POST /intent/{rid}/action with {choice:'commit'}

COMMIT
  ├─► products.create (Postgres, idempotent)
  ├─► vespa.index
  ├─► EMIT events.append(ProductImported) + publish Kafka
  └─► return final
```

### Tools used
`vision.analyze`, `vespa.search_trend`, `shopee.price_range`, `text.embed`, `vespa.compare_similar`, `policies.find_matching`, `cards.create`, `products.create`, `vespa.index`, `events.append`

### Events emitted
- `ProductDraftSuggested` (sau AI analyze)
- `ProductDraftSubmitted` (sau user submit form)
- `ProductImported` (sau commit, kafka publish)

### SSE Output sequence
```
status: classifying
status: analyzing
tool_call: vision.analyze
tool_result: vision.analyze
tool_call: vespa.search_trend
tool_call: shopee.price_range
tool_call: gtrends.interest_over_time 
... (parallel results)
tool_result: vespa.search_trend
tool_result: shopee.price_range
tool_result: gtrends.interest_over_time 
status: synthesizing
partial_text: "Tôi đã phân tích..."
[FORM_PREFILL custom event: data: {title, category, attrs, suggested_price, ...}]
[MARKET_TREND custom event: data: {current_score, delta_pct, trajectory, series, related_rising}]
status: awaiting_user_input

(after user submits form)
status: validating
tool_call: vespa.compare_similar
tool_result: vespa.compare_similar
card: {action_type: SUGGEST_PRICE, ...}  ← 0..N cards
status: awaiting_user_input

(after user commits)
status: committing
products: [Product]
final: {text: "Đã nhập hàng thành công", product_id: "..."}
```

### Error paths
- `vision.analyze` confidence < 0.3 → return error `LOW_CONFIDENCE_IMAGE`, ask retake photo
- Duplicate idempotency-key → return cached final result
- Vespa index fail → rollback products row (compensating delete), return `EXTERNAL_DOWN`

---

## Intent 02 — `buying_products_by_voices`

### Modality demo: voice (audio upload)

### Input
```json
{ "modality": "voice", "file": "<audio binary>" }
```

### Graph stages
```
ENTRY
  ├─► speech.transcribe
  ├─► classify_intent (LLM, also extract entity)
  └─► [intent=buying_by_voices] → BUY_GRAPH
        ├─► vespa.hybrid_search(query=entity, limit=5)
        ├─► [matches.length == 0] → return suggest_search
        ├─► [matches.length == 1] → AUTO_ADD branch
        │     └─► cart.upsert
        └─► [matches.length > 1] → CLARIFY branch
              └─► return choices via SSE
                    
USER picks one via voice "chọn cái thứ 2" → POST /intent/{rid}/action {choice: '2', qty: 2}

CONTINUE
  ├─► resolve choice ordinal → sku
  ├─► cart.upsert(user, sku, qty)
  ├─► EMIT events.append(CartUpdated)
  └─► final
```

### Tools used
`speech.transcribe`, `vespa.hybrid_search`, `cart.upsert`, `events.append`, `speech.synthesize` (optional TTS reply)

### Events emitted
- `IntentRecognized` (debug/analytics)
- `CartUpdated`

### SSE Output sequence
```
status: transcribing
partial_text: "Bạn nói: mua nước tương Maggi"
status: searching
products: [5 candidates]
[CHOICES event: data: {options: [...]}]
status: awaiting_user_input

(after voice choice)
status: updating_cart
final: {text: "Đã thêm vào giỏ", cart: Cart}
```

### Error paths
- STT confidence < 0.5 → ask repeat
- Multiple ambiguous matches sau 2 clarifications → fallback to text mode

---

## Intent 03 — `searching_products_by_text`

### Modality demo: text

### Input
```json
{ "modality": "text", "content": "nước tương ngon dưới 50k" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent
  └─► [intent=searching_by_text] → SEARCH_GRAPH
        ├─► parse_filters (LLM structured output → {category?, price_max?, attrs?})
        ├─► text.embed (cho hybrid search)
        ├─► vespa.hybrid_search (BM25 + vector + filters)
        ├─► [re-rank with trend_score]
        └─► return products
```

### Tools used
`text.embed`, `vespa.hybrid_search`

### Events emitted
- `SearchPerformed` (chỉ analytics, không trigger cards)

### SSE Output sequence
```
status: parsing
status: searching
products: [up to 10]
final: {text: "Tìm thấy 8 sản phẩm phù hợp", filters_applied: {...}}
```

### Error paths
- 0 results → return suggestion `widen your query?`
- Vespa timeout → fallback to BM25 only

---

## Intent 04 — `recommendation_products_by_images`

### Modality demo: image

### Input
```json
{ "modality": "image", "file": "<binary>", "hint": "recommend" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent (sử dụng hint)
  └─► [intent=recommendation_by_images] → RECO_GRAPH
        ├─► vision.embed (image → 768-d vector)
        ├─► vision.analyze (để biết category, gating)
        ├─► parallel:
        │    ├─► vespa.nearest_neighbor (visual similar)
        │    └─► analytics.co_purchased(category) [SQL]
        ├─► blend_and_rank (composite score)
        └─► return products
```

### Tools used
`vision.embed`, `vision.analyze`, `vespa.nearest_neighbor`, `analytics.co_purchased`

### Events emitted
- `RecommendationServed`

### SSE Output sequence
```
status: analyzing
status: searching_similar
status: blending
products: [10 recommendations with reason]
final: {text: "Đây là 10 gợi ý dựa trên hình bạn gửi", reason_per_item: [...]}
```

### Error paths
- No category match (vision confidence low) → fallback to pure visual similarity
- Cold start (zero co-purchased) → use only visual similarity

---

## Intent 05 — `viewing_cart_products_by_text`

### Modality demo: text

### Input
```json
{ "modality": "text", "content": "thêm 2 chai sp #5 vào giỏ" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent (subtype: ADD | REMOVE | UPDATE_QTY | VIEW | CLEAR)
  └─► [intent=cart_*] → CART_GRAPH
        ├─► extract_entities (LLM: product reference, qty, op)
        ├─► resolve_product_ref (nếu "#5" = ordinal in last search, lookup from session memory)
        ├─► branch on subtype:
        │    ├─► ADD/UPDATE → cart.upsert
        │    ├─► REMOVE → cart.remove
        │    ├─► VIEW → cart.get
        │    └─► CLEAR → cart.clear
        └─► EMIT CartUpdated, return final
```

### Tools used
`cart.get` / `cart.upsert` / `cart.remove` / `cart.clear`, `products.get`, `events.append`

### Events emitted
- `CartUpdated` (mỗi lần thay đổi)

### SSE Output sequence
```
status: parsing
status: updating_cart  (hoặc viewing)
final: {text: "Giỏ hàng đã cập nhật", cart: Cart}
```

### Error paths
- Product reference không resolve được → ask clarify
- Qty <= 0 → reject với VALIDATION_FAILED

---

## Intent 06 — `paying_order_products_by_text`

### Modality demo: text

### Input
```json
{ "modality": "text", "content": "thanh toán" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent (subtype: PAY | CANCEL | VIEW_INVOICE)
  └─► [intent=paying_*] → PAY_GRAPH
        ├─► [PAY] branch:
        │    ├─► cart.get(user)
        │    ├─► validate (items > 0, stock OK)
        │    ├─► create Order in PG (status=pending, idempotency-key locked)
        │    ├─► publish OrderPlaced to Kafka
        │    └─► return order_id, mở SSE stream chờ payment-consumer
        ├─► [CANCEL] branch:
        │    ├─► fetch Order
        │    ├─► [status != pending] → reject
        │    ├─► update status=cancelled
        │    └─► publish OrderCancelled
        └─► [VIEW_INVOICE] branch:
             └─► return order detail
```

Consumer chain (separate workers, không nằm trong AI graph):
- `payment-consumer` receives `OrderPlaced` → mock charge → publish `PaymentCompleted` | `PaymentFailed`
- `inventory-consumer` receives `OrderPlaced` → reserve stock, sau `PaymentCompleted` → commit; sau `PaymentFailed` → release
- Gateway lắng SSE: khi order status đổi → push qua client

### Tools used
`cart.get`, `orders.create`, `events.append` (NestJS gateway, không qua AI service)

### Events emitted (& consumed)
- Emit: `OrderPlaced`, `OrderCancelled`
- Consume (workers): `PaymentCompleted`, `PaymentFailed`, `StockReserved`, `StockReleased`

### SSE Output sequence
```
status: building_order
order_update: {order_id, status: 'pending'}
status: awaiting_payment

(async after payment-consumer)
order_update: {order_id, status: 'paid'}
final: {text: "Thanh toán thành công"}

OR:
order_update: {order_id, status: 'failed', reason: "..."}
final: {text: "Thanh toán thất bại"}
```

### Error paths
- Empty cart → `VALIDATION_FAILED`
- Stock insufficient (race) → `INSUFFICIENT_STOCK`, compensating event `StockReleased`
- Payment provider timeout 30s → mark failed, compensate

---

## Intent 07 — `analyzing_by_voices`

### Modality demo: voice

### Input
```json
{ "modality": "voice", "file": "<audio binary>" }
```

### Graph stages
```
ENTRY
  ├─► speech.transcribe
  ├─► classify_intent (extract: metric, dimension, time_range, filters)
  └─► [intent=analyzing_by_voices] → ANALYTICS_GRAPH
        ├─► plan_queries (LLM decides which tools)
        ├─► execute_queries (parallel):
        │    ├─► analytics.sales_by_month (if needed)
        │    ├─► analytics.trend_history (if needed)
        │    └─► analytics.stock_snapshot (if needed)
        ├─► synthesize_narrative (LLM: explain trend, causes)
        ├─► build_chart_spec (LLM → JSON schema)
        └─► return chart + narrative
```

### Tools used
`speech.transcribe`, `analytics.*`, `speech.synthesize` (optional TTS narrative)

### Events emitted
- `AnalyticsQueried` (light, only for usage stats)

### SSE Output sequence
```
status: transcribing
partial_text: "Bạn nói: phân tích trend nước tương 6 tháng"
status: querying
tool_result: analytics.sales_by_month (summary)
tool_result: analytics.trend_history (summary)
status: synthesizing
chart: {type:'line', title, x_axis, y_axis, series:[{name, data}]}
partial_text: "Nước tương Maggi giảm 35% do..."
final: {text: '...full narrative', chart_id}
```

### Error paths
- Empty data → return text-only "Chưa đủ dữ liệu"
- Range > 24 months → reject hoặc truncate

---

## Intent 08 — `login_logout_by_text`

### Modality demo: text (form / chat)

### Input
```json
{ "modality": "text", "content": "đăng nhập email a@b.com password ..." }
```

OR direct REST: `POST /auth/login { email, password }`

### Graph stages
Đây intent đơn giản nhất, **KHÔNG cần đi qua AI service** trong happy path. Gateway xử lý trực tiếp.

```
NestJS /auth/login:
  ├─► validate dto
  ├─► fetch user from PG by email
  ├─► bcrypt.compare(password, hash)
  ├─► [fail] → 401 UNAUTHORIZED
  ├─► generate JWT (jti, exp 24h)
  ├─► insert sessions row
  ├─► SET redis session:{jti} (TTL = exp)
  ├─► publish UserLoggedIn (Kafka)
  └─► return tokens
```

Logout:
```
NestJS /auth/logout:
  ├─► verify JWT
  ├─► DEL redis session:{jti}
  ├─► UPDATE sessions SET revoked_at = NOW()
  ├─► publish UserLoggedOut
  └─► 204
```

Chỉ khi user gõ trong chat "đăng nhập" thì AI service phát hiện intent này và prompt user mở form login UI (không xử lý credentials qua AI).

### Tools used (nếu qua AI path)
`auth.verify_jwt` (chỉ verify, không issue)

### Events emitted
- `UserLoggedIn`
- `UserLoggedOut`

### SSE / Response
Direct REST 200/204, không SSE.

### Error paths
- Wrong creds → 401
- User not found → 401 (không leak)
- JWT expired → 401 với `code: TOKEN_EXPIRED`

---

## Common: Intent Classifier Prompt Template

```
Bạn là intent classifier cho hệ thống ICP. Phân loại user input vào 1 trong:
- importing_by_images
- importing_by_voices
- importing_by_text
- buying_by_images
- buying_by_voices
- buying_by_text
- searching_by_images
- searching_by_voices
- searching_by_text
- recommendation_by_images
- recommendation_by_voices
- recommendation_by_text
- cart_by_images
- cart_by_voices
- cart_by_text
- paying_by_images
- paying_by_voices
- paying_by_text
- analyzing_by_images
- analyzing_by_voices
- analyzing_by_text
- login
- logout
- unknown

Modality: {modality}
Hint từ frontend (nếu có): {hint}
User input: {content}

Trả về JSON: {intent: string, confidence: float, entities: {...}}
```

Confidence < 0.5 → fallback ask user.

---

**END OF INTENT SPECS DOC.**
