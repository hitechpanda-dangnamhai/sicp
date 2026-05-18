# Phase 04 — Buy (Voice) + Cart + Payment

> **Duration:** Tuần 4  
> **Mục tiêu:** Intent 02 (voice buy), Intent 05 (cart), Intent 06 (payment). Showcase Kafka choreography.

## Định nghĩa hoàn thành

- [ ] Customer nói "mua nước tương Maggi" → search → chọn → add cart
- [ ] Gõ commands cart: thêm, xóa, sửa qty, xem giỏ
- [ ] Gõ "thanh toán" → tạo order → choreography chain → status update qua SSE
- [ ] Mock payment success/fail 80/20 random để demo compensation
- [ ] Stock decrement khi paid, restore khi failed

## Scope

### A. Speech-to-Text Tool

MCP `speech.transcribe`:
- Input: audio_b64, lang='vi'
- Implement: gọi Gemini Audio API (Gemini 2.0 Flash hỗ trợ audio input)
- Return: text + confidence

### B. Cart Service

Pure Redis ops, qua MCP:
- `cart.get`, `cart.upsert`, `cart.remove`, `cart.clear`
- Mỗi op emit event `CartUpdated` qua MCP `events.append`
- Cart tính lại total mỗi lần (không cache, gọi `products.get` để lấy current price)

### C. AI Subgraphs

`apps/ai/src/graphs/intents/`:
- `buying_by_voices.py`
- `cart_by_text.py`
- `paying_by_text.py`

**buying_by_voices.py** đặc biệt cần:
- Resolve "cái thứ hai" → cần session memory (last search results lưu Redis `intent:{userId}:{sessionId}`)
- Interrupt pattern khi clarify

**paying_by_text.py** lại đặc biệt khác:
- KHÔNG dùng MCP `orders.create` qua AI service. Lý do: payment phải đi qua Gateway (idempotency middleware). 
- AI service chỉ classify intent + extract entities + return special action `INITIATE_CHECKOUT` để frontend trigger POST /orders/checkout
- Hoặc: AI service gọi internal Gateway API `POST /internal/orders` với service-to-service token

**Quyết định:** Đi route đầu (frontend tự gọi /orders/checkout sau khi nhận intent classified). Đơn giản hơn.

### D. Order + Payment Workers

```
apps/workers/src/
  payment-consumer.ts
  inventory-consumer.ts
  notification-consumer.ts
```

**payment-consumer:**
```
Subscribe: icp.orders.placed
On OrderPlaced:
  - mock charge (sleep 1-3s)
  - 80% chance success → publish PaymentCompleted
  - 20% chance fail → publish PaymentFailed (reason: 'mock_random_fail')
  - Idempotent: check if transaction with order_id already exists
```

**inventory-consumer:**
```
Subscribe: icp.orders.placed, icp.payments.completed, icp.payments.failed
On OrderPlaced:
  - For each item: tentative reserve (decrement stock in PG with WHERE stock >= qty)
  - If insufficient: publish StockReservationFailed → triggers OrderCancelled
On PaymentCompleted:
  - Confirm reservation (just log, stock already decremented)
On PaymentFailed:
  - Restore stock (increment back)
```

**notification-consumer:**
```
Subscribe: icp.payments.completed, icp.payments.failed
- Log to console (mock email)
- Update order_id in some notification table (optional)
- Push to client SSE channel via Redis pub/sub
```

### E. SSE Order Stream

Gateway: `GET /api/v1/orders/:id/stream`
- Subscribe Redis pub/sub channel `order:{order_id}:updates`
- Workers publish to that channel after each event handled
- Stream `order_update` SSE events down to client

### F. Web

- Cart sidebar (always visible, hide when empty)
- Order summary modal
- Real-time status pill: "pending" → "processing" → "paid" / "failed"

### G. Observability & Behavior Events — Phase 04 (CRITICAL)

Phase này có Kafka choreography, **trace propagation qua message headers** là điểm dễ vỡ nhất — phải làm cẩn thận.

**Kafka tracing pattern (BẮT BUỘC):**
- Producer: gọi `propagation.inject(context.active(), messageHeaders)` trước mỗi `producer.send`
- Consumer: extract context từ headers, wrap handler trong `context.with(parent, ...)`
- Verify: 1 trace duy nhất span: client → gateway → kafka → payment-consumer → kafka → inventory-consumer → kafka → SSE → client

**Operational logs cần emit:**
- `order.created`, `order.placed_published` (gateway)
- `event.consumed` mỗi worker khi nhận message (debug level)
- `payment.charge_started`, `payment.charge_succeeded`, `payment.charge_failed` (worker-payment)
- `stock.reserved`, `stock.reservation_failed`, `stock.released` (worker-inventory)
- `order.status_changed` (mọi khi status thay đổi)

**Metrics:**
- Counter `icp.orders.placed`
- Counter `icp.payments.outcome{outcome=success/failed}`
- Histogram `icp.payment.duration`
- Gauge `icp.kafka.consumer_lag{topic, partition}` (qua Kafka admin API)
- Histogram `icp.event.publish_to_consume_lag` (occurred_at vs handler start time)

**Behavior events** (cực kỳ quan trọng cho Phase 05 recommendation):
- `cart.item_added` với `source: 'voice'/'text'/'search_result'/'reco'`, `from_query?` (để biết user đến từ search nào)
- `cart.item_removed`, `cart.qty_changed`, `cart.cleared`
- `cart.viewed`
- `checkout.started` với items snapshot
- `checkout.completed` (server-side sau payment success)
- `checkout.failed` (server-side sau payment fail)
- `checkout.cancelled`

→ `cart.item_added.from_query` là **gold data** cho Vespa learn-to-rank: query nào dẫn tới purchase, query nào không.

**Vespa partial update — RT signal** (preview cho Phase 05):
- Khi `checkout.completed` → cho mỗi item, gọi `vespa.partial_update` increment `purchases_7d`, `purchases_30d`
- Cụ thể trong worker-inventory sau `payment.charge_succeeded`
- Mục đích: Vespa biết ngay sản phẩm vừa được mua, ranking sau update tức thì

**Grafana:**
- Dashboard "Order Lifecycle": funnel chart từ `checkout.started` → `checkout.completed`
- Dashboard "Kafka Health": consumer lag per topic, throughput, error rate

## Tasks ordering

### Day 1 — Speech tool + voice UI
- MCP `speech.transcribe` với span + log
- Web: voice recorder component (MediaRecorder API), waveform indicator
- Tracker: emit `recommendation.shown` / `product.viewed` nếu chưa có từ Phase 02

### Day 2 — Cart MCP + AI subgraph
- Cart tools (mỗi tool log `cart.*` operational)
- AI subgraph 05 (text)
- Web: cart sidebar component
- Tracker: emit `cart.item_added/removed/qty_changed/viewed` ở Web

### Day 3 — Buy voice subgraph
- AI subgraph 02 (voice)
- Session memory in Redis (Redis key cần `trace_id` để link resume trace với original)
- Clarify flow (LangGraph interrupt)

### Day 4 — Order + Idempotent checkout endpoint
- Gateway endpoint POST /orders/checkout
- Build order from cart, transaction with events outbox
- Publish OrderPlaced với **traceparent header**
- Tracker: emit `checkout.started`

### Day 5 — Workers + Kafka tracing
- 3 consumers, **mỗi consumer EXTRACT trace context từ message headers**
- Worker-payment: log `payment.*`, emit metric `icp.payments.outcome`
- Worker-inventory: log `stock.*`, **Vespa partial update purchases counter** sau payment success
- Worker-notification: log `notification.dispatched`
- Compensation: worker-inventory subscribe PaymentFailed → publish StockReleased
- Pub/sub for SSE

### Day 6 — SSE order stream + Web UI
- Gateway subscribes Redis, pushes events (preserve trace_id)
- Web: order status pill, live update
- Tracker: emit `checkout.completed/failed` server-side sau payment outcome

### Day 7 — E2E test
- Voice buy → cart → checkout → success
- Voice buy → checkout → fail → stock restored
- Demo nội bộ

## Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| BUY-01 | Voice "mua Maggi" với 3 matches | Clarify question |
| BUY-02 | Voice "cái thứ 2, 3 chai" | Cart updated với 3 chai |
| CART-01 | "thêm 2 chai sp #5" | Cart upsert |
| CART-02 | "xóa sản phẩm Maggi" | Cart remove |
| CART-03 | "xem giỏ" | Trả về cart |
| PAY-01 | Checkout cart 3 items, payment success | Order status=paid, stock decreased |
| PAY-02 | Checkout, payment fail | Order status=failed, stock restored |
| PAY-03 | Checkout 2 lần same idempotency-key | Cùng order_id |
| PAY-04 | Stock đủ cho 5, ai cũng đặt 3 → second one fail | Compensation chạy |

## Public interfaces sẵn cho Phase 05

- Speech tool có thể reuse cho analytics voice
- Choreography pattern proven
- SSE bidirectional (intent stream + order stream)
- Order history available cho analytics queries

---

## Khi xong Phase 04

Tạo `PHASE_04_HANDOFF.md`. Đặc biệt note:
- Idempotent producer / consumer pattern đã chứng minh
- Order history data sẽ là input cho analytics
