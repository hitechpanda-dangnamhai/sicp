# Phase 04 — Buy (Voice) + Cart + Payment (Intent 02 + 05 + 06)

> **Status:** Cart (Intent 05) + Buy-voice (Intent 02) = ✅ **DONE** (verified vs code 2026-06-09). Payment (Intent 06) = 🟡 **CHƯA CODE** (VNPay/Momo thật, ADR-038).
> **Mục tiêu:** Giỏ hàng + đặt hàng bằng giọng nói + thanh toán thật.
>
> **Cross-ref:** `04_INTENT_SPECS.md` Intent 02/05/06, `03_API_CONTRACTS.md` §1.3b/§1.8, `02_DATA_MODEL.md` (orders/order_items/transactions), `DECISIONS.md` ADR-038.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs cart_by_text.py + buying_by_voices.py + grep gateway):
- Cart graph tools = cart.get/update_qty/remove/clear + vespa.hybrid_search (cart.upsert→cart.update_qty). Buy graph = speech.transcribe + vespa.hybrid_search + cart.get/update_qty + analytics.co_purchased. DONE.
- paying_by_text.py KHÔNG tồn tại (6 graph, pay=Gateway). Intent 06 payment = CHƯA CODE (không orders/payment controller, không VNPay/Momo/checkout).
- "mock payment 80/20" → VNPay/Momo thật (ADR-038, no mock). Workers (payment/inventory/notification) = skeleton CHƯA CODE. Kafka CHƯA WIRE.
- speech.transcribe = OpenAI gpt-4o-transcribe (real tool); speech.synthesize = gpt-4o-mini-tts (backend tool, FE playback deferred).
- XOÁ cruft: Phiên Sx08-D8, D-S08-NN, Day1-7, Duration Tuần4.
- THÊM production payment: IPN verify, idempotent dedup_key, payment_callbacks (V011), refund, no-log payload, circuit breaker, Kafka+outbox+DLQ. -->

## Định nghĩa hoàn thành — trạng thái thật

- [x] Voice "mua nước tương Maggi" → buying_by_voices: speech.transcribe → search → clarify → add cart ✅
- [x] Cart text commands (thêm/xóa/sửa qty/xem giỏ) via cart_by_text + cart controller ✅
- [ ] "thanh toán" → tạo order → payment → status SSE — 🟡 **CHƯA CODE** (Intent 06)
- [ ] Stock decrement/restore (inventory-consumer) — 🟡 CHƯA CODE (worker skeleton)
- [ ] Payment provider — 🟡 **VNPay/Momo/ZaloPay thật** (ADR-038), KHÔNG mock; offline COD/chuyển khoản

## Scope

### A. Speech tools (MCP) — verified

- `speech.transcribe` — **OpenAI `gpt-4o-transcribe`** (`audio.transcriptions.create`, native timeout, max_retries=0). *(Gemini bị no-timeout hang → chuyển OpenAI.)* Input audio_b64, lang='vi' → text + confidence. ✅ tool registered.
- `speech.synthesize` — **OpenAI `gpt-4o-mini-tts`** (voice alloy, mp3). ✅ backend tool registered; graph chưa gọi + FE audio playback = 🟡 CHƯA CODE (deferred).

> Image + LLM parse = Gemini Flash; STT/TTS = OpenAI.

### B. Cart (Redis ops qua MCP) — verified DONE

Cart MCP tools (7): `cart.get`, `cart.update_qty`, `cart.remove`, `cart.clear`, `cart.validate_stock`, `cart.apply_promo`, `cart.remove_promo`. *(KHÔNG có `cart.upsert` — đã đổi tên `update_qty`.)*
- Mỗi op emit `CartUpdated` qua `events.append` (outbox).
- Total tính lại mỗi lần (gọi `products.get` lấy giá hiện tại; không cache).
- Cart controller 7 route: `GET/POST/PATCH /cart/items`, `DELETE /cart/items/:productId`, `DELETE /cart`, `POST/DELETE /cart/promo`. Cross-ref `03 §1.3b`.

### C. AI Subgraphs

`apps/ai/src/graphs/intents/`:
- **`cart_by_text.py`** (Intent 05) ✅ — tools: `cart.get/update_qty/remove/clear` + `vespa.hybrid_search`.
- **`buying_by_voices.py`** (Intent 02) ✅ — tools: `speech.transcribe` + `vespa.hybrid_search` + `cart.get/update_qty` + `analytics.co_purchased`. **Voice session memory** (D-S08-NN-A): Redis `voice:context:{user_id}` JSON FIFO 5 turns, TTL 30min (`load/save_voice_context`) → Siri-class continuity. **4 voice action** (D-S08-NN-B): add / remove / update_qty / query. Nodes thật: speech_transcribe→load_voice_context→parse_voice_intent (LLM bulk-parse)→resolve_items→route_resolution→{bulk_cart_commit | voice_cart_remove | **voice_recall** (Q&A history, không hit Vespa) | **voice_no_match_alts** (đề xuất thay thế)}→reason_need→co_purchase_lookup→save_voice_context. clarify/no_match qua `interrupt()` Pattern A. `no_match` gate: LLM `is_product_reference` trước Vespa.
- ~~`paying_by_text.py`~~ **KHÔNG tồn tại.** Payment (Intent 06) xử lý ở **Gateway** (idempotency middleware), KHÔNG qua AI graph. AI chỉ classify + return action `INITIATE_CHECKOUT` → FE gọi `POST /orders/checkout`.

### D. Payment (Intent 06) — 🟡 CHƯA CODE (ADR-038, VNPay/Momo/ZaloPay thật)

> Hiện **chưa có** orders/payments controller, checkout endpoint, payment MCP tool, hay 3 worker consumer (apps/workers = skeleton). DB sẵn sàng: `orders` (idempotency_key UNIQUE), `order_items`, `transactions` (V005: payment_method/failure_reason/metadata/provider_txn_id/completed_at; **status CHECK pending/success/failed — chưa refunded**).
> **Payment methods (verified DB chk_payment_method 2026-06-09):** online = **momo/zalopay/vnpay**, offline = **cod/bank_transfer**, **mock** = dev/test. payment_method enum = {mock, momo, zalopay, vnpay, bank_transfer, cod}; DB `chk_payment_method` verified = {mock,momo,zalopay,bank_transfer,cod} → **vnpay CHƯA có trong CHECK, thêm via V011 (CHƯA CODE)**.

Target production:
- Gateway `POST /orders/checkout` (idempotent, build order từ cart, txn + events outbox). Cross-ref `03 §1.8`.
- Payment init → redirect/deeplink VNPay/Momo/ZaloPay (offline COD/bank_transfer set trực tiếp); **IPN callback**: verify chữ ký TRƯỚC khi cập nhật order/transaction; idempotent theo `dedup_key`; KHÔNG log payload nhạy cảm (`05 §10`).
- Bảng mới `payment_callbacks` (1 txn ↔ N callback: raw payload, signature_verified, received_at) + status `refunded` (orders/transactions) — **V011**.
- Worker `payment-consumer` (VNPay/Momo confirm, idempotent theo order_id), `inventory-consumer` (reserve/restore stock), `notification-consumer` (→ SSE). **CHƯA CODE.**

### E. SSE Order Stream — 🟡 CHƯA CODE

Gateway `GET /api/v1/orders/:id/stream` subscribe Redis `order:{order_id}:updates`; workers publish sau mỗi event. (Pattern SSE qua Redis pub/sub đã proven ở intent stream.)

### F. Web

Components thật (`components/icp/molecules/`): `CartItemRow`, `SwipeableCartItem`, `CartSummary`, `CartCountPill`, `ClearConfirmModal`, `UndoRemoveToast`, `PromoSuccessBanner`, `StockIssueAlert`, `StockReplacementCard`, `MicButton`, `LivePartialTranscript`, `OtpField`, `PaymentMethodPicker`; organism `OrderSummary`. Route `app/intent-02`, `intent-05`, `intent-06`.

> ⚠️ FE payment components (`PaymentMethodPicker`, `OtpField`) **đã build**, nhưng **backend VNPay/Momo CHƯA CODE** → UI chưa wire flow thật.

### G. Observability & Behavior Events

- ✅ Behavior events thật (catalog.ts): `cart.item_added` (+source voice/text/search), `cart.item_removed/qty_changed/cleared/viewed/promo_applied/promo_removed`. → `cart.item_added.from_query` = gold data cho LTR.
- 🟡 CHƯA WIRE (Kafka choreography): `order.*`/`payment.*`/`stock.*` logs; metrics `icp.orders.placed`/`icp.payments.outcome`/`icp.payment.duration`/`icp.kafka.consumer_lag`; trace propagation qua Kafka headers (producer inject / consumer extract). Hiện chỉ Redis pub/sub.
- 🔵 RT signal (Phase 05 preview): khi `checkout.completed` → `vespa.partial_update` increment `purchases_7d/30d` per item (trong inventory-consumer) — CHƯA CODE (worker skeleton).
- Grafana: "Order Lifecycle" funnel, "Kafka Health" — sau khi wire.

## Test scenarios

| ID | Scenario | Expected | Trạng thái |
|---|---|---|---|
| BUY-01 | Voice "mua Maggi" 3 matches | Clarify question | ✅ |
| BUY-02 | "cái thứ 2, 3 chai" | Cart +3 chai | ✅ |
| CART-01 | "thêm 2 chai sp #5" | cart.update_qty | ✅ |
| CART-02 | "xóa Maggi" | cart.remove | ✅ |
| CART-03 | "xem giỏ" | cart.get | ✅ |
| PAY-01 | Checkout → payment success (VNPay/Momo) | order=paid, stock-- | 🟡 CHƯA CODE |
| PAY-02 | Payment fail | order=failed, stock restored | 🟡 CHƯA CODE |
| PAY-03 | Checkout 2× same idempotency-key | cùng order_id | 🟡 CHƯA CODE |
| PAY-04 | IPN signature invalid (vnpay/momo/zalopay) | reject, không update order | 🟡 CHƯA CODE |

## Public interfaces sẵn cho Phase 05

- Speech tool reuse cho analytics voice (Intent 07).
- Cart + behavior events (cart.item_added.from_query) = input LTR/analytics.
- SSE intent stream proven; order stream = production.
- Order/transaction schema sẵn (orders/order_items/transactions).

---

## Production hardening (payment-focused — §5b)

| Hạng mục | Hiện trạng | Đề xuất + nên dùng gì | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **VNPay/Momo/ZaloPay IPN verify** | CHƯA CODE | verify chữ ký HMAC trước update; idempotent `dedup_key`; no-log payload | 🟡 CHƯA CODE | **P0** |
| **payment_callbacks + refund + chk vnpay** | transactions V005 (no refund; CHECK thiếu vnpay) | V011: bảng payment_callbacks + status `refunded` + ALTER chk_payment_method thêm `vnpay` | 🟡 CHƯA CODE | **P0** |
| **Idempotency checkout** | orders.idempotency_key UNIQUE | middleware global (đã có); UNIQUE(tenant_id, idempotency_key) khi multi-tenant | 🟡 CHƯA CODE | **P0** |
| **Kafka choreography + outbox + DLQ** | Redis pub/sub | KafkaJS topic `icp.orders.*`/`icp.payments.*`; outbox relay; DLQ; trace propagation headers | 🟡 CHƯA CODE | P1 |
| **3 worker consumer** | skeleton | payment/inventory/notification consumer (idempotent) | 🟡 CHƯA CODE | **P0–P1** |
| **Circuit breaker VNPay/Momo** | — | breaker + timeout + retry/backoff cho provider | 🟡 CHƯA CODE | P1 |
| **TTS FE playback** | backend tool có | wire `audio_reply_b64` → FE audio player | 🔵 TÙY CHỌN | P2 |
| **Tenant scoping orders/transactions** | 0 tenant_id | scope tenant_id (RLS) | 🟡 CHƯA CODE | P0 |

---

## Khi Phase 04 hoàn tất

Cart + buy-voice DONE. Payment (VNPay/Momo) + workers + Kafka choreography = production milestone tiếp theo (P0). Order/transaction data → input analytics Phase 05.

---

**END — PHASE_04 (Production reconcile 2026-06-09).**
