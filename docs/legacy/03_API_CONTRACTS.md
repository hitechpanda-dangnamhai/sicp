# 03 — API Contracts

> **Load khi:** code controller, DTO, MCP tool, hoặc frontend client. Contracts đây là LOCKED — đổi cần `DECISIONS.md`.

<!--
PRODUCTION RECONCILE (2026-06-09): tenant context (ADR-040, §1.0), payment
VNPay/Momo (ADR-038, §1.8), GDPR consent/DSAR (ADR-041, §1.9), JWT payload +
tenant_id, error codes mới (§4), bỏ "Hackathon scope" (§9). Tenant conveyance =
hybrid: header `X-Tenant-Id` (storefront/customer) + JWT `tenant_id` claim
(merchant) → TenantContextGuard → RLS GUC + propagate. Verified source: chưa có
cơ chế tenant/RLS nào (greenfield) → chọn hướng production-grade.
-->


## 1. Gateway REST Endpoints (NestJS)

Base URL: `/api/v1`

### 1.0 Tenant Context (Production — multi-tenant, ADR-040)

> 🟡 **CHƯA CODE (verified 2026-06-10):** toàn bộ §1.0 là **spec target production**. Grep `apps/gateway/src` KHÔNG có `tenant` / `TenantContextGuard` / `SET app.current_tenant` / RLS nào (greenfield) — JWT payload hiện chỉ `sub/email/role/jti`, chưa có `tenant_id`. Cần `tenant_memberships` table + guard + RLS GUC khi code (ADR-040, V011/V012).

Mọi request tới resource **tenant-scoped** phải có **active tenant**. Gateway resolve qua `TenantContextGuard` (chạy sau `JwtAuthGuard`).

**Nguồn active tenant (precedence):**
1. Header `X-Tenant-Id: <uuid>` — storefront/customer (FE set từ shop slug đang xem; shareable/SEO). Cũng cho phép staff đổi shop đang thao tác.
2. JWT claim `tenant_id` — default cho merchant/staff (active tenant lúc login). **JWT production mang thêm `tenant_id`** (ngoài `sub/email/role/jti`).

**Validate quyền:**
- merchant/staff: phải có row `tenant_memberships(tenant_id, user_id)` → nếu không khớp tenant yêu cầu: `403 CROSS_TENANT`.
- customer (global): tenant phải tồn tại + `status='active'` → nếu không: `404` (không lộ tồn tại) hoặc `403`.

**Sau resolve:** Gateway (a) `SET app.current_tenant = '<uuid>'` trên DB connection (RLS), (b) gắn `tenant_id` vào request context, (c) propagate `tenant_id` xuống AI/MCP (header `X-Tenant-Id`), Kafka (header), trace span.

**Endpoint KHÔNG cần tenant context:** `/auth/*` (trừ `/me` trả memberships), payment webhook `/payments/:provider/ipn` (public — định danh tenant qua chữ ký/đơn hàng), `/health/*`.

**Forward (pending UI/mockup):** storefront có thể dùng subdomain `:slug.icp.app` hoặc path `/shop/:slug` để suy ra `X-Tenant-Id`; chốt khi có mockup customer marketplace.

### 1.1 Auth

**Auth pattern LOCKED S-03 Phiên 30 C-01:** cookie httpOnly only per ADR-019 + D-05. NO JWT/refresh token in response body — tokens delivered via `Set-Cookie` headers (`icp_session` SameSite=Lax + `icp_refresh` SameSite=Strict). **Idempotency (verified 2026-06-10):** `auth.module` KHÔNG gắn middleware nào, và base `IdempotencyMiddleware` chỉ `.forRoutes(POST /intent, POST /products, PATCH /products/:id, POST /orders/checkout)` — **KHÔNG route `/auth/*` nào** đi qua idempotency (không cache password/token rotation — đạt được bằng cách đơn giản không liệt kê auth, không phải bằng `.exclude`).

```
POST /auth/login
  Body: { email, password, remember_me?: boolean = false }
  Response 200:
    Set-Cookie: icp_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/;
                Max-Age=86400 if remember_me else session
    Set-Cookie: icp_refresh=<uuid>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth;
                Max-Age=2592000 if remember_me else session
    Body: { user: { id, email, role, display_name, avatar_initials } }
  Errors: 401 invalid_credentials

POST /auth/logout
  Header: Cookie (icp_session per ADR-019)
  Response 204
    Set-Cookie: icp_session=; Max-Age=0
    Set-Cookie: icp_refresh=; Max-Age=0

POST /auth/refresh
  Header: Cookie (icp_refresh per ADR-019 + C-06 rotating)
  Response 200:
    Set-Cookie: icp_session=<new_jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age preserved
    Set-Cookie: icp_refresh=<new_uuid>; HttpOnly; Secure; SameSite=Strict; Max-Age preserved
  Errors: 401 if refresh revoked/expired (rotating C-06 revokes old on each refresh)

GET /auth/me
  Header: Cookie (icp_session per ADR-019)
  Response 200: { id, email, role, display_name, avatar_initials, last_login_at,
                  active_tenant_id,                                  # merchant/staff: tenant đang thao tác; null nếu customer global
                  memberships: [{ tenant_id, slug, name, role }] }   # merchant/staff; [] cho customer
  Errors: 401 if cookie absent/invalid
  # Production (ADR-040): JWT payload mang thêm `tenant_id` (active tenant của merchant/staff).
  # Customer = account global → memberships=[]; chọn shop qua header X-Tenant-Id mỗi request.

POST /auth/forgot-password
  Body: { email }
  Response 200: { sent: true }   # stub Phase 02 — no real SMTP, emits auth.password_reset_requested event
```

**Field semantics:**
- `avatar_initials: string` — server-computed from `display_name` (NFD normalize, first 2 uppercase chars). Vietnamese diacritics safe. Locked S-03 C-05.
- `last_login_at: ISO8601 string` — `MAX(sessions.issued_at) WHERE user_id=current AND revoked_at IS NULL`. Used by `/me` profile state-F display.
- `remember_me: boolean` (default false) — controls cookie `Max-Age` (session vs 30d). S-03 C-04.

### 1.2 Intent (Universal Endpoint)

Đây là **endpoint chính**, mọi user input đều qua đây. **Endpoint pattern hybrid (LOCKED S-02 T07 C-38)**: POST returns `request_id` 202; client opens SSE stream via GET với native `EventSource` API.

```
POST /intent
  Header: Cookie (icp_session per ADR-019), Idempotency-Key
  Body (multipart/form-data hoặc JSON):
    Variant A (text):
      { modality: 'text', content: 'mua nước tương', mode?: 'ai_augmented'|'basic_fallback' }
    Variant B (image):
      multipart: file=<binary>, modality='image', hint?='import'|'buy'|'search'|'recommend'
    Variant C (voice):
      multipart: file=<audio binary>, modality='voice'

  # `mode` field (S-04 NEW Phiên Sx04 D-S04-03 LAW):
  #   - 'ai_augmented' (default for Intent 03) — full Variant B graph
  #   - 'basic_fallback' — degraded Variant A baseline (user-explicit or auto-degrade)
  #   - Other intents currently ignore this field (Intent 03 first-need)
  # NOTE: "Variant A/B/C" above refers to MODALITY (text/image/voice), DIFFERENT
  # from Intent 03 "Variant A/B" (baseline/AI-augmented). See `04_INTENT_SPECS.md`
  # Intent 03 for the intent-level Variant naming.

  Response 202: { request_id, status: 'accepted' }

GET /intent/stream?id=<request_id>
  Header: Cookie (icp_session per ADR-019)
  Response: text/event-stream (SSE), see Section 3
  Auth: cookie httpOnly (NO query string token per ADR-019); EventSource with
        `{withCredentials: true}` carries cookie automatically.

POST /intent/{request_id}/action
  Header: Cookie (icp_session per ADR-019), Idempotency-Key
  Mô tả: user respond lại 1 action card hoặc clarification
  Body: { card_id?, choice?, value?, _meta?: { attempt_n: int } }
  Response 202: { request_id, status: 'accepted' }   # subsequent SSE pickup
                                                     # via same GET /intent/stream

POST /intent/{request_id}/suggest-attrs   # CODE: registered (intent-suggest-attrs.controller; doc cũ thiếu)
  Header: Cookie (icp_session)   # verified 2026-06-10: KHÔNG có idempotency MW áp cho route này
                                 # (intent.module chỉ áp IntentActionIdempotencyMiddleware cho /:rid/action;
                                 #  base MW match `api/v1/intent` exact, không phủ sub-path suggest-attrs)
  Mô tả: gợi ý thuộc tính (attributes) cho draft sản phẩm trong luồng Intent 01
  Response 202: { request_id, status: 'accepted' }   # kết quả trả qua SSE
                                                     # connection (Option Z pub/sub)
```

**`/intent/{rid}/action` semantics LOCKED S-04 Phiên Sx04-3 per D-S04-13 LAW (Pattern A interrupt+resume + Option Z Redis pub/sub):**
- **Pattern A LangGraph interrupt+resume**: AI service graph paused at `interrupt()` primitive (Pattern P2 dynamic — fires only when condition matches: typo detected / LLM timeout / cart action). State persisted in RedisSaver checkpointer (key `intent:checkpoint:{request_id}` TTL 30min + refresh_on_read=True per Strategy β LAW). Gateway forwards `/action` POST to AI service internal `POST /intent/{rid}/resume` endpoint → AI service calls `graph.astream(Command(resume=<choice>), config={'configurable': {'thread_id': rid}})` → graph continues from checkpoint.
- **Option Z Redis pub/sub SSE channel**: "subsequent SSE pickup via same GET /intent/stream connection" means the existing EventSource connection FE opened earlier STAYS OPEN. Gateway maintains `ioredis.duplicate().subscribe('sse:pubsub:{rid}')` for the duration; AI service publishes new events to the same channel after resume → Gateway forwards to FE via the open connection. No FE reconnect required.
- **`_meta.attempt_n` field (S-04 NEW Phiên Sx04-3)**: monotonic integer (1, 2, 3, ...) incremented by FE per logical retry (e.g. user taps "Thử lại với AI" then "Dùng bản cơ bản" = attempt_n=1 then attempt_n=2 cho same request_id). Used by Gateway Idempotency-Key composition: cache key becomes `intent:action:{request_id}:{attempt_n}` (TTL 5min). Prevents accidental double-action on rapid taps; allows legitimate retry with different attempt_n.
- **`choice` field semantic enum (S-04 typo+degrade+cart action use cases per D-S04-13 LAW)**:
  - Typo flow: `'accept'` (use corrected_query) / `'reject'` (keep original query) — emits resume from `detect_typo` node
  - Degrade flow: `'retry_ai'` (clear checkpoint via `adelete_thread(rid)` + re-invoke `ai_augmented` mode) / `'continue_basic'` (resume with `state.mode='basic_fallback'`, skip remaining LLM nodes) — emits resume from `generate_understanding` or `generate_reasons` node
  - Cart action flow: `'add_to_cart'` (with `value: {product_id}` → resume into `co_purchase_lookup` node) / `'skip'` (60s Gateway timeout default → graph emits `final` event directly without co_purchase) — emits resume from `rank_finalize` node
- **`IntentActionIdempotencyMiddleware` applies** (verified 2026-06-10 — MW riêng cho `/intent/:rid/action`, KHÔNG phải base MW): header `Idempotency-Key` REQUIRED (UUID v4); cache key `intent:action:{rid}:{attempt_n}` (TTL 5min) + lock `intent:action:lock:{rid}:{attempt_n}` (EX 30s); cùng key + khác `attempt_n` = dispatch mới (retry hợp lệ).

**Why hybrid pattern (C-38 rationale):**
- Native browser `EventSource` API only accepts GET — splitting POST (mutation) from
  GET (stream) keeps `EventSource` usable without manual `fetch + ReadableStream`.
- POST returns immediately (202 Accepted) for low-latency client UX; SSE stream
  pickup is decoupled.
- Idempotency-Key middleware applies cleanly to POST only (dedup mutation, not
  stream subscription).

### 1.3 Products

> ⚠️ **Verified routes (2026-06-09):** gateway code HIỆN CHỈ có **`PATCH /products/:id`** (`products.controller.ts`). `GET`/`POST`/`DELETE` dưới đây **CHƯA CODE** ở gateway — đọc/tạo sản phẩm hiện qua MCP `products.get/create` + luồng Intent 01 (chưa expose REST).

```
GET /products?merchant_id&category&q&limit&cursor
  Response 200: { items: Product[], next_cursor? }

GET /products/:id
  Response 200: Product | 404

POST /products
  Header: Idempotency-Key
  Body: ProductDraft   # type thật = ProductDraft (products.ts), KHÔNG phải ProductCreateDTO
  Response 201: Product

PATCH /products/:id   # ACTIVE shipped Phiên Sx07-D per C-S07-N Option B
  Auth: cookie (JwtAuthGuard) — ownership re-verify inside MCP txn
  Header: Idempotency-Key (BẮT BUỘC; verified 2026-06-10: header name = `Idempotency-Key`,
          KHÔNG phải `X-`; áp per-module — idempotency.module `.forRoutes(PATCH /products/:id)`, KHÔNG global)
  Body: Partial<ProductDraft> (KHÔNG có type `ProductPatchDTO` shared — 12-field whitelist enforce ở MCP/controller: title, description, attributes, price,
        stock, image_url, brand, original_price, status, image_data, image_gradient, icon_hint)
  Response 200: Product   # + indexed:boolean (false on Vespa best-effort failure)
  Response 403: FORBIDDEN (non-owner)
  Response 404: PRODUCT_NOT_FOUND (non-existent or archived)
  Notes:
    - Emits outbox `ProductUpdated` event same-txn (distinct from `ProductImported`);
      S-06 outbox-relay-worker will replay to downstream consumers
    - Vespa re-index best-effort post-PG-commit; failure → response.indexed=false +
      log warn; PG state always persists
    - 9 immutable fields rejected at MCP layer: id, merchant_id, category, created_at,
      vespa_doc_id, rating_avg, rating_count, sold_count, trend_score
      # verified 2026-06-10: 12-field whitelist khớp hằng `_UPDATABLE_FIELDS` (products.py);
      # immutable 9 = phần bù (comment products.py:294-296); ownership re-verify → FORBIDDEN (products.py:404).
      # ✅ verified 2026-06-10: vòng `for field in _UPDATABLE_FIELDS: if field in params: updates[field]=params[field]` (products.py) — chỉ 12 field được gom, param khác bị bỏ. Nuance: `field:None` = SET None; muốn giữ giá trị cũ phải OMIT field (caller-omit semantics).

DELETE /products/:id  → archive thay vì xoá thật
  Response 204
```

### 1.3b Cards (NEW S-07 per C-S07-A)

```
GET /api/v1/cards?merchant_id=<uuid>
  Auth: cookie (JwtAuthGuard)
  Response 200: { items: Card[] }   # pending cards for the merchant

POST /api/v1/cards/:id/accept
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)   # verified 2026-06-10: cards.module áp IdempotencyMiddleware cho accept/reject
  Body: { applied_value?: any }     # e.g. {price: 35000} for SUGGEST_PRICE
  Response 200: Card                # status: 'accepted'
  Side-effect: outbox `CardStatusChanged` event emitted same-txn

POST /api/v1/cards/:id/reject
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Body: { reason?: string }
  Response 200: Card                # status: 'rejected'
  Side-effect: outbox `CardStatusChanged` event emitted same-txn
```

### 1.4 Cart

*Extended S-05 Phiên Sx05-2 per D-S05-02 LAW — 7 endpoints (5→7 add POST/DELETE /cart/promo) + DTO bodies extended (idempotency key required on write ops; snapshot field added on add_item per S-04 add_to_cart consistency). Sx05-2-CLOSE Phase 2 spec reconcile.*

```
GET /cart
  Auth: cookie (JwtAuthGuard)
  Response 200: Cart  # full shape, see Section 3 Cart type below

POST /cart/items
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Body: { product_id: UUID, qty: int (1..99), snapshot?: {title, brand, image_gradient, category?} }
  Response 201: Cart   # updated cart returned
  Errors: 400 INVALID_QTY / 404 PRODUCT_NOT_FOUND / 409 IDEMPOTENCY_CONFLICT

PATCH /cart/items/:product_id
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Body: { qty: int (0..99) }   # qty=0 → auto-remove (D-S05-02 LAW sugar)
  Response 200: Cart
  Errors: 400 INVALID_QTY / 404 ITEM_NOT_IN_CART

DELETE /cart/items/:product_id
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Response 200: Cart

DELETE /cart
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Response 200: { cleared: true }   # NOT 204; D-S05-02 LAW returns confirmation shape

POST /cart/promo   # NEW S-05 Phiên Sx05-2 per D-S05-05 LAW
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Body: { code: str (1..50 chars) }
  Response 200: Cart   # with promo + totals.discount applied
  Errors: 400 INVALID_CODE (fixture lookup miss; LLM typo correction T03 separate AI graph)
        / 409 PROMO_ALREADY_APPLIED

DELETE /cart/promo   # NEW S-05 Phiên Sx05-2
  Auth: cookie
  Header: Idempotency-Key (BẮT BUỘC)
  Response 200: Cart   # promo cleared + totals recomputed
```

**MCP JSON-RPC direct (agnostic to caller — proves AC8):**
```
POST http://mcp:5050/rpc
Content-Type: application/json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"cart.get","arguments":{"user_id":"<uuid>"}}}
→ Response: {"jsonrpc":"2.0","id":1,"result":<Cart shape — identical to REST>}
```

### 1.5 Orders

> ⚠️ **CHƯA CODE (verified 2026-06-09):** KHÔNG có `orders.controller` ở gateway — các endpoint dưới đây chưa expose REST. Checkout hiện đi qua luồng cart/intent; orders/transactions ghi ở tầng dưới (MCP/worker). Đây là spec target.

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

> ⚠️ **Trùng §1.3b — verified:** code chỉ có MỘT cards controller tại **`/api/v1/cards`** (xem §1.3b: `GET`, `POST :id/accept`, `POST :id/reject`). Path `/cards` (không prefix) ở đây là spec cũ → **dùng §1.3b làm chuẩn**; query `?status=pending&limit=20` áp cho `GET /api/v1/cards`.

### 1.7 Analytics / Dashboard

> ⚠️ **Verified routes (2026-06-09):** code có **`dashboard.controller`** — KHÔNG có `analytics.controller`. Dashboard thật:

```
GET /api/v1/dashboard/stats     # CODE: registered — số liệu tổng quan shop
GET /api/v1/dashboard/insight   # CODE: registered — insight/đề xuất (cards, trend…)
```

**(Target — CHƯA CODE)** Analytics chi tiết (đọc matview V006), chưa expose REST:
```
GET /analytics/sales?product_id?&range=6m
  Response 200: { series: [{month, revenue, qty}], summary: {...} }

GET /analytics/trend?product_id&range=6m
  Response 200: { series: [{date, score}], top_attrs: [...] }

GET /analytics/stock
  Response 200: { items: [{product_id, title, stock, status}] }
```

### 1.8 Payments (NEW Production — VNPay/Momo/ZaloPay, ADR-038)

> ⚠️ **CHƯA CODE (verified routes 2026-06-09):** gateway KHÔNG có controller `payments`/`orders` (route grep `apps/gateway/src`) — toàn bộ §1.8 là **spec target wow-production**. Cần payment-consumer + IPN handler + bảng `payment_callbacks` (`02 §1.X`, chưa có trong DB). Provider payload/ack shape phải **verify lại với SDK VNPay/Momo/ZaloPay** khi code (không suy diễn). payment_method enum = `{mock, momo, zalopay, vnpay, bank_transfer, cod}` (DB `chk_payment_method` (verified 2026-06-09) = {mock, momo, zalopay, bank_transfer, cod}; **`vnpay` CHƯA có trong CHECK → V011 ALTER thêm (CHƯA CODE)**.).

```
POST /orders/:id/pay
  Header: Authorization (customer JWT) + X-Tenant-Id + Idempotency-Key
  Body: { provider: 'vnpay'|'momo'|'zalopay', return_url }   # offline cod/bank_transfer set trực tiếp
  Response 200: { transaction_id, redirect_url }     # redirect/deeplink tới cổng
  Errors: 402 PAYMENT_FAILED, 409 IDEMPOTENCY_CONFLICT, 404 ORDER_NOT_FOUND

POST /payments/:provider/ipn          # PUBLIC webhook — KHÔNG JWT, KHÔNG X-Tenant-Id
  Body: <provider payload>            # VNPay query params / Momo JSON
  Xử lý: verify chữ ký → idempotent theo dedup_key → cập nhật transaction + order
         → publish icp.payments.completed|failed → ghi payment_callbacks
  Response: <provider-required ack>   # vd VNPay {RspCode:'00', Message:'success'}
  Errors: SIGNATURE_INVALID (log + ack theo yêu cầu provider)

GET /orders/:id/payment
  Response 200: { transaction_id, status, provider, amount, completed_at }

POST /payments/:transaction_id/refund     # merchant/admin
  Header: Authorization + X-Tenant-Id + Idempotency-Key
  Body: { amount?, reason }
  Response 200: { transaction_id, status: 'refunded' }
  Errors: 403 FORBIDDEN, 422 POLICY_VIOLATION (vd đã refund / quá hạn)
```

### 1.9 Privacy — Consent & Data Subject Rights (NEW Production — GDPR, ADR-041)

> ⚠️ **CHƯA CODE (verified routes 2026-06-09):** KHÔNG có controller consent/privacy ở gateway (route grep) — §1.9 là **spec target wow-production**. Phụ thuộc bảng `consent_records`/`data_subject_requests`/`data_retention_policies` (`02 §1.X`) — chưa tồn tại trong DB.

```
GET  /me/consents
  Response 200: { consents: [{ purpose, granted, policy_version, updated_at }] }

PUT  /me/consents
  Body: { purpose: 'behavior_tracking' | 'marketing' | ..., granted: boolean }
  Response 200: { purpose, granted }
  # Behavior tracking (07_BEHAVIOR_LOGS) chỉ ghi khi purpose='behavior_tracking' granted=true.

POST /me/data-requests
  Body: { type: 'access' | 'erasure' | 'portability' | 'rectification' }
  Response 202: { request_id, status: 'pending' }
  # access/portability → export data; erasure → anonymize/delete theo data_retention_policies.
```

### 1.10 Behavior Tracking & Health (CODE: registered — doc cũ thiếu)

```
POST /api/v1/track            # CODE: tracking.controller — ghi behavior event (schema chi tiết ở 07_BEHAVIOR_LOGS)
  Body: BehaviorEvent (per @icp/shared-types/behavior)
  Response 202: { accepted: true }
  # Chỉ ghi khi consent 'behavior_tracking' granted (xem §1.9).

GET /api/v1/health            # CODE: health.controller — liveness
GET /api/v1/health/ready      # CODE: readiness probe (DB/Redis/Vespa)
```

## 2. DTOs (TypeScript canonical)

> **Verified 2026-06-10 (rule d/b):** Type KHÔNG nằm ở `dto.ts` (file đó không tồn tại). Nguồn thật =
> **Zod schema + `z.infer`** rải ở `packages/shared-types/src/`: `products.ts` (ProductDraft/Product),
> `cart.ts` (CartItemSnapshot/CartItem/Cart), `dto/*.dto.ts` (analytics/error/intent-suggest-attrs),
> `recommendations.ts`, `behavior/*`, `sse/intent-stream.ts`, `api/models/*` + `api/services/*` (✅ verified 2026-06-10: auto-gen `openapi-typescript-codegen`, header "do not edit" — LoginDto/IntentRequestDto/MeResponseDto/DashboardStatsDto/TrackBatchDto/…).
> Shape dưới đây là `z.infer` của các schema đó (đối chiếu nguyên văn code). `Record<...>` thực tế là Zod
> `z.record(z.string(), z.string())` v.v.

```ts
// products.ts — z.infer<typeof ProductDraftSchema>
// (FE submit Intent 01; mirror apps/mcp/src/tools/products.py:122 create() minus server-fill)
export type ProductDraft = {
  title: string;                     // 1..255 (KHÔNG phải 3..255)
  brand?: string | null;            // max 100, TOP-LEVEL (D-S04-11 LAW — không nested trong attributes)
  category: string;                  // 1..100 (canonical CANONICAL_CATEGORIES OR 'unknown')
  attributes: Record<string, string>;  // z.record(string, string) — values stringified, KHÔNG number/boolean
  price: number;                     // int >= 0 (VND)
  stock: number;                     // int >= 0
  sku?: string;                      // max 50
  description?: string | null;
  image_data?: string | null;        // base64 inline
  image_url?: string | null;         // URL (post-upload)
};
// (Doc cũ ghi `ProductCreateDTO`/`ProductPatchDTO` = SAI tên. PATCH whitelist/immutable enforce ở
//  MCP/controller, KHÔNG là type shared riêng — xem §1.3.)

// products.ts — z.infer<typeof ProductSchema> = ProductDraftSchema.extend({...server fields})
export type Product = ProductDraft & {
  id: string;                        // UUID
  merchant_id: string;               // UUID
  status: 'active' | 'inactive' | 'archived' | 'draft';   // 4 giá trị (doc cũ thiếu 'inactive')
  trend_score: number;               // default 0
  original_price?: number | null;    // int
  rating_avg: number;                // default 0
  rating_count: number;              // int default 0
  sold_count: number;                // int default 0
  image_gradient?: string | null;
  icon_hint?: string | null;
  vespa_doc_id?: string | null;
  created_at: string;                // ISO
  updated_at: string;                // ISO
};

// cart.ts — z.infer<typeof CartItemSnapshotSchema>
export type CartItemSnapshot = {
  title: string;
  brand: string | null;
  image_url: string | null;
  image_gradient: string | null;     // cặp hex "#FEF3C7,#FCD34D" (KHÔNG phải "6-char seed")
  icon_hint: string | null;          // "i-bottle"
  original_price: number | null;     // int
};

// cart.ts — z.infer<typeof CartItemSchema>
// (KHÔNG có `line_total` trong shape contract — verified cart.ts/MCP/gateway. FE tự tính
//  `lineTotal = unit_price × qty` để hiển thị + `lineTotalOverride` optimistic-UI (D-S05-07);
//  KHÔNG phải field server.)
export type CartItem = {
  product_id: string;       // UUID
  qty: number;              // 1..99
  unit_price: number;       // int >= 0, persisted at add time
  added_at: string;         // ISO (doc cũ thiếu)
  snapshot: CartItemSnapshot;
  in_stock: boolean;        // REQUIRED — BE-derived (live re-query Postgres per ADR-05-02)
  available_stock: number | null;   // required key, nullable
};

// cart.ts — các sub-shape dưới đây là object INLINE trong CartSchema (KHÔNG export riêng):
export type Cart = {
  user_id: string;          // UUID (doc cũ thiếu)
  items: CartItem[];
  updated_at: string;       // ISO (doc cũ thiếu)
  totals: { subtotal: number; discount: number; shipping: number; total: number };  // tất cả int
  promo: { code: string; label: string; discount_amount: number } | null;
  free_gift_hint: {         // SỬA: shape thật = {threshold, progress, gift_label}
    threshold: number;      // 200000
    progress: number;       // current subtotal
    gift_label: string;     // "Dầu ăn Tường An 250ml"
  } | null;
  pending_interrupts: {     // SỬA HOÀN TOÀN: shape thật (D-S05-02 LAW)
    clear_confirm_rid: string | null;
    stock_issue_rid: string | null;
    stock_issue_product_ids: string[] | null;
  } | null;
  last_action_rid: string | null;   // doc cũ thiếu
};

// ActionCard — KHÔNG ở shared-types; shape thật = serializer apps/mcp/src/tools/cards.py (= DB action_cards 10 cột)
export type ActionCard = {
  id: string;
  event_id: string;
  policy_id: string;        // SỬA: doc cũ ghi `policy_code` = SAI (đây là UUID FK)
  user_id: string;          // doc cũ thiếu
  action_type: string;      // VARCHAR(60), client validate 5 variant (SUGGEST_PRICE,...)
  suggestion: Record<string, unknown>;   // JSONB
  status: 'pending' | 'accepted' | 'rejected' | 'expired';   // DB CHECK
  expires_at: string | null;
  resolved_at: string | null;   // doc cũ thiếu
  created_at: string | null;
};

// Order — 🟡 CHƯA CODE: orders chưa build (không có OrdersModule/controller/Order type shared).
// Shape dưới là spec target (DB orders 7 cột); xác minh lại khi code.
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

**Event catalog (verified 2026-06-10 — `IntentStreamEventMap`): 31 typed payload events + `heartbeat` transport keepalive.** Phân bổ: base 10 (S-02 T07 C-36) + S-04 ×7 + S-05 ×7 + S-07 ×3 + S-08 ×2 + S-10 ×2. Typed Zod schemas at `packages/shared-types/src/sse/intent-stream.ts` (FE subpath `@icp/shared-types/sse`, BE root barrel `@icp/shared-types`). `heartbeat` KHÔNG có Zod schema (transport-only).

```
event: status
data: {"phase": "classifying" | "analyzing" | "searching" | "synthesizing" | "committing" | "awaiting_user_input" | "done"}

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
data: {"ts": 1700000000}    # gửi mỗi 15s — transport keepalive only, không có Zod schema

# ─── NEW S-04 Phiên Sx04 (D-S04-03 LAW Adaptive Single Endpoint) — 5 typed events ───

event: phase_progress
data: {"phase_id": 0, "label": "Hiểu ngữ nghĩa câu hỏi",
       "status": "active"|"done"|"pending", "meta": "412ms"}
# Variant B PhasesCard realtime tracking — mockup intent-03B-state-A-loading.html
# lines 155-189. Emitted by `searching_by_text.py` graph per node lifecycle.
# `phase_id` enum 0..3: 0=understanding, 1=search, 2=reasons, 3=rank.

event: understanding
data: {"text": "Anh cần nước tương đậm đặc phù hợp ăn phở...",
       "highlighted_terms": ["nước tương đậm đặc"]}
# Variant B semantic interpretation card — mockup intent-03B-state-0-happy.html
# lines 152-164 ("Đã hiểu ý anh" card). Emitted ONCE per query, BEFORE products.

event: typo_suggestion
data: {"original": "mai gi", "corrected": "Maggi", "confidence": 0.94,
       "actions": [{"label": "Đúng rồi", "value": "accept"},
                   {"label": "Không, em tìm 'mai gi'", "value": "reject"}]}
# Variant B typo correction inline UX — mockup intent-03B-state-F-typo.html
# lines 152-163. Triggers `status: awaiting_user_input`. User POSTs
# /intent/{rid}/action {choice: 'accept'|'reject'} to continue.

event: variant_degraded
data: {"from": "ai_augmented", "to": "basic_fallback",
       "reason": "llm_timeout"|"llm_error"|"user_explicit",
       "error_code": "E_LLM_TIMEOUT", "trace_id": "b7e1...d042",
       "title": "Mô hình AI phản hồi chậm",
       "user_message": "Em đang quá tải nên chưa viết được lý do gợi ý..."}
# Variant B → A graceful degradation — mockup intent-03B-state-C-error.html
# lines 153-175. Triggers `status: awaiting_user_input` so user can choose
# retry vs accept basic mode.
#
# Shape AMENDED Phiên Sx04-8b per C-S04-Q resolution (T03 EXECUTION SMOKE PASS):
# - REMOVED `retry_actions` field — mockup hardcodes button labels FE per state
#   HTML (intent-03A-state-C-error.html line 171/173 "Thử lại"/"Báo lỗi" vs
#   intent-03B-state-C-error.html line 171/173 "Thử lại với AI"/"Dùng bản
#   cơ bản" — labels differ per error origin). Server emitting array would
#   require runtime FE branching keyed off `from`/`reason` — strictly more
#   complex than mockup hardcoded approach. Rule 7 Priority 1 Mockup wins.
# - ADDED `title` as REQUIRED — mockup line 160 LOCKED VERBATIM strings
#   ("Mô hình AI phản hồi chậm" for intent-03B / "Kết nối bị gián đoạn"
#   for intent-03A) demand distinct heading from body text.
# - `trace_id` field REQUIRED per mockup line 166 truncated display
#   (first 8 chars + "..." + last 4 chars; matches OTel span context 32-char hex).
# Field naming convention (KHÔNG conflict với LOG_CATALOG.md §A.Intent):
# - SSE event `variant_degraded`: `from` / `to` (this spec line 335)
# - Ops log `intent.degraded`: `from_mode` / `to_mode` (LOG_CATALOG.md §A row)
# Two contracts distinct by design — SSE is consumer-facing FE handler,
# ops log is observability-facing structured log.

event: co_purchase_hint
data: {"rate_pct": 68, "reason": "Khách mua nước tương Maggi thường lấy kèm tương ớt",
       "suggested_product": {...Product},
       "anchor_category": "nuoc_tuong", "suggested_category": "tuong_ot"}
# Variant B post-cart-add cross-sell hint — mockup intent-03B-state-E-cart.html
# lines 221-251. Emitted ONLY when `mode=ai_augmented` AND user adds to cart
# during search session (triggered by FE `cart.item_added` behavior event).
# S-04 stub fixture per `02_DATA_MODEL.md` §X.2; S-10 real V006 mat view.

# ─── NEW Phiên Sx04-4 (D-S04-14 LAW Adaptive Progressive Streaming) — 1 typed event ───

event: product_ready
data: {"item": {...Product, "match_score": 0.98, "reason": "Độ đậm cao, khách phở hay chọn nhất"},
       "index": 0, "total": 8}
# Variant B incremental product emission — emitted PER product as LLM
# `generate_reasons` parallel call completes (instead of buffering all
# results until rank_finalize). Final `products` event STILL emitted
# at rank_finalize end with canonical full list (backward-compat).
# `item` field shape: identical to `products.items[i]` augmented payload
# (Product + match_score + reason). `index` 0-based; `total` from
# hybrid_search result count. FE accumulates incrementally; if FE missed
# some events (rare network drop), final `products` event provides
# canonical reconciliation list.
# WOW: perceived latency 1500ms → 500ms time-to-first-card (mockup
# intent-03B-state-A-loading.html shimmer skeleton already designed for
# progressive arrival). Variant A SKIPS this event (no LLM reasons —
# emits single-shot `products` event only).
# Triggers paired ops log `intent.first_card_emitted` (FIRST product_ready
# only per request_id) for perceived-latency telemetry.
# See 04_INTENT_SPECS.md Intent 03 generate_reasons node spec +
# slices/S-04_decisions-log.md D-S04-14 LAW full doc.

# ─── END NEW Phiên Sx04-4 event ───

event: empty_state
data: {"message": "Em đã tìm kỹ nhưng chưa có sản phẩm nào khớp...",
       "fallback_actions": [
         {"type": "widen_query",    "label": "Tìm \"nước mắm\" tổng quát hơn", "value": "<widened>"},
         {"type": "capture_image",  "label": "Chụp ảnh để gợi ý sản phẩm"},
         {"type": "create_product", "label": "Nhập sản phẩm mới vào kho"}
       ],
       "suggested_queries": ["Nước mắm Nam Ngư", "Nước mắm Chinsu", "Nước mắm 40 độ đạm"]}
# Both Variants empty result — mockup intent-03A-state-B-empty.html + 03B-state-B-empty.html.
# Replaces `products: {items: []}` for empty case to provide actionable UX.
# Action types `capture_image` + `create_product` are decorative S-04 (S-07 owner).

# ─── END NEW S-04 events ───

# ─── NEW S-07 events (Phiên Sx07-B per C-S07-D Option ⓐ) ───

event: form_prefill
data: {
  category: string,                  # ICP taxonomy: 11 canonical (CANONICAL_CATEGORIES @ products.ts); DB hiện 12 distinct do `gạo` (1 sp) chưa normalize về `gao` (verified 2026-06-10)
  attributes: dict,                  # {brand, size, weight, ...}
  ocr_text: string,                  # raw OCR (may be empty)
  confidence: float,                 # overall [0,1] from Gemini
  confidence_per_field: dict,        # NEW per C-S07-L — {title: 0.97, brand: 0.98, ...}
  alternatives: dict                 # NEW per C-S07-L — {category: ['nuoc_tuong', 'sauce_other'], ...}
}
# Single event emitted after vision_analyze + enrich phases complete.
# FE renders state-B-prefilled (green badges for fields ≥70%) or state-F-low-confidence
# (yellow per-field badges + alt-chip suggestions) depending on confidence_per_field values.
# Trigger E_VISION_BLUR (per §4) if Ω₂ 3-threshold check fires before this event.

event: market_trend
data: {
  trajectory: 'rising' | 'stable' | 'falling',
  current_score: int,                # 0-100 Google Trends scale
  delta_pct: number,                 # % change vs previous window (-50..+200)
  series: [{date: 'YYYY-MM-DD', value: int}],   # ≤ 90 points
  related_rising: [string],          # top 5 related queries
  window_days: int                   # default 90
}
# Emitted in parallel with form_prefill + shopee_compare during enrich phase
# (asyncio.gather per backend; FE phase_progress emits sequentially per D-S04-14 LAW).
# Trajectory drives state-C-rising vs state-C-falling branch (mockup states).

event: shopee_compare
data: {
  aggregates: {
    sample_count: int,
    avg: number,
    min: number,
    max: number,
    p25: number,
    p75: number
  },
  samples: [{                          # 0..3 samples per category per row
    title: string,
    price: number,
    seller: string,
    rating?: number,
    url: string
  }]
}
# Emitted from shopee.price_range MCP tool returns (2-tier lookup per C-S07-A).
# FE renders ShopeeCompareCard compact (S-04 reuse) + state-D-shopee-expanded modal
# on user click (no additional backend event).

# ─── END NEW S-07 events ───

# ─── NEW S-05 events (Phiên Sx05-2 per D-S05-01..11 LAW) — 7 typed events ───
# (verified 2026-06-10: IntentStreamEventMap @ packages/shared-types/src/sse/intent-stream.ts;
#  catalog chuẩn = 31 typed event + heartbeat. Đa số S-05 theo D-S05-11: minimal-trigger + FE refetch.)

event: clear_confirm
data: {"item_count": 3, "subtotal": 150000,
       "user_message": "Em sẽ xoá 3 món trị giá 150.000₫ khỏi giỏ...",
       "advice": "..."}
# Pattern A interrupt 'clear_action'. user_message + advice = BE-templated (D-S05-10).

event: cart_cleared
data: {}    # .passthrough(); FE invalidate CART_QUERY_KEY → refetch GET /cart (state-B empty)

event: clear_cancelled
data: {}    # .passthrough(); FE đóng modal, giữ nguyên giỏ

event: stock_issue_ready
data: {"product_id": "<uuid>",
       "replacement": {"product_id": "<uuid>", "title": "...", "brand": "...",
                       "unit_price": 35000, "available_stock": 47} | null,
       "reason": "..." | null}
# Progressive per out-of-stock item (Vespa+LLM); replacement+reason null nếu không có candidate/LLM timeout.

event: stock_issue_summary
data: {"out_of_stock_count": 2, "product_ids": ["<uuid>", "<uuid>"]}
# Emit SAU tất cả stock_issue_ready, TRƯỚC interrupt('stock_action').

event: cart_updated
data: {}    # .passthrough(); sau resolve_remove/resolve_replace → FE refetch GET /cart

event: cart_view_ready
data: {}    # .passthrough(); happy-path stock-check xong, không có item hết hàng

# ─── END NEW S-05 events ───

# ─── NEW S-08 events (Phiên Sx08-D per D-S08-NN + C-S08-R) — 2 typed events ───

event: voice_transcribed
data: {"type": "voice_transcribed", "text": "mua 2 chai nước tương",
       "confidence": 0.92, "duration_ms": 1840, "language": "vi"}
# confidence nullable. Intent 02 buying_by_voices.py.

event: voice_clarify_options
data: {"type": "voice_clarify_options", "request_id": "...",
       "resolved": 1, "total": 2,
       "ambiguous_items": [{"item_idx": 0, "query": "nước tương", "qty": 2,
         "candidates": [{"id": null, "title": null, "price": null, "original_price": null,
                         "rating": null, "rating_count": null, "sold_count": null, "stock": null,
                         "brand": null, "image_url": null, "image_icon": null,
                         "image_gradient": null, "match_score": null}]}]}
# Emit TRƯỚC mỗi interrupt() (C-S08-R); chip-row đến qua event này, KHÔNG qua interrupt payload.
# Mỗi candidate dùng `match_score` (KHÔNG `score`); tất cả field nullable (đọc verbatim từ Vespa hit).
# Resume: POST /intent/{rid}/action {choice:'clarify_pick', value:{product_id}} (enum choice thứ 11).

# ─── END NEW S-08 events ───

# ─── NEW S-10 events (Intent 07 Voice Analytics, D-S10-NN-G) — 2 typed events ───
# (`chart` + `tool_result` REUSE từ base; chỉ 2 event dưới là mới)

event: analytics_cards
data: {"type": "analytics_cards", "request_id": "...", "count": 2,
       "cards": [                            # AnalyticsCardSchema = discriminated-union 'type' @ dto/analytics.dto.ts:
         # caution     → {type:'caution', category, delta_pct, rationale, reasoning:{trend?, promo?}}
         # opportunity → {type:'opportunity', category?, product_id?, title?, rationale, reasoning:{restock}}
         # loan        → {type:'loan', rationale, reasoning:{loan}}
       ],
       "reasoning": {                         # AnalyticsReasoningSchema (5-slot, nullable), cho drill-down:
         "price": null, "promo": null, "restock": null, "trend": null, "loan": null
       } | null}
# _node_build_insights; solver-derived numbers + _trace (NO LLM-generated numbers).
# Sub-reasoning (PriceReasoning/PromoReasoning/RestockReasoning/TrendBreakdown/LoanReasoning) @ analytics.dto.ts.

event: analytics_clarify
data: {"type": "analytics_clarify", "request_id": "...", "question": "...",
       "options": [{"label": "...", "value": {"metric": "..."}}]}   # AnalyticsClarifyOption = {label, value:Record<string,string>}
# DORMANT Pattern-A interrupt (mockup state-I); khi không tìm được subject phân tích.

# ─── END NEW S-10 events ───
```

**`phase_id` enum values (S-04 LOCKED Phiên Sx04 D-S04-03 LAW):**
- `0` — understanding (Variant B only — LLM semantic parse)
- `1` — search (both modes — Vespa hybrid_search)
- `2` — reasons (Variant B only — LLM per-product reason generation, parallel)
- `3` — rank (both modes — finalize ranking)

**`products.items[]` payload augmentation (S-04 LOCKED):** In Variant B mode
(`mode: 'ai_augmented'`), each product item augments base `Product` shape with:
- `match_score: number` — float [0,1], displayed as `%` badge on card (mockup
  state-0-happy line 185: `98%`, line 212: `91%`). Source: Vespa rank profile
  `ai_augmented` summary-features.
- `reason: string` — short Vietnamese phrase (max 60 chars), displayed in pink
  gradient inline card on product (mockup state-0-happy lines 194-197:
  "Độ đậm cao, khách phở hay chọn nhất"). Source: LangGraph `generate_reasons`
  node LLM call.
Both fields **optional** in Variant A mode (`mode: 'basic_fallback'`) per
graceful degradation contract — FE conditional render guard.

**`status.phase` 7 values (C-37 LOCKED):**
- `classifying` — intent router classify in progress
- `analyzing` — payload extraction / context gather
- `searching` — Vespa hybrid search / retrieval (V-SLICE S-04)
- `synthesizing` — LLM summarisation / chart compose (V-SLICE S-08)
- `committing` — order/cart write phase (V-SLICE S-06 checkout)
- `awaiting_user_input` — action card requires user confirm (V-SLICE S-04+)
- `done` — pipeline terminal; client closes stream

**Phase 1 wrapper scope (S-02 T07):** Gateway emits `status:classifying → status:analyzing → status:done → final` for D-03 stub router. Real `tool_call`/`tool_result`/`products`/`card`/`chart`/`order_update` events defer V-SLICE S-04..S-10 first-need.

**S-04 wrapper scope (Phiên Sx04 D-S04-03 LAW + Phiên Sx04-4 D-S04-14 LAW):** Intent 03 first-need expands event catalogue with 6 NEW events Phiên Sx04: `phase_progress`, `understanding`, `typo_suggestion`, `variant_degraded`, `co_purchase_hint`, `empty_state`; plus 1 NEW event Phiên Sx04-4: `product_ready` (incremental per-product emission per D-S04-14 LAW Adaptive Progressive Streaming). Plus augmented `products` payload (per-item `match_score` + `reason` in Variant B mode). Total typed payload events: 10 (Phase 1) + 6 (S-04 Phiên Sx04) + 1 (S-04 Phiên Sx04-4) = **17 events** + `heartbeat` transport keepalive.

**S-04 SSE transport architecture LOCKED Phiên Sx04-3 per D-S04-13 LAW (Pattern A + Option Z + Option α):**
- **Transport pattern Option Z (Redis pub/sub multi-channel)**: AI service publishes SSE events to Redis channel `sse:pubsub:{request_id}` (Python `redis.publish()`); Gateway subscribes via `ioredis.duplicate().subscribe(channel)` inside `/intent/stream` handler (NestJS) → forwards each Redis message to FE EventSource. Pub/sub ephemeral (no TTL, no buffer). Cleanup: on `final` event Gateway closes connection + unsubscribes; on FE close (browser tab) Gateway detects via `req.on('close')` + unsubscribes; on 60s idle (graph paused past Gateway-side timeout) Gateway unsubscribes + emits implicit `Command(resume={choice: 'skip'})` to AI internal `/resume` endpoint. Forward-compat: S-08 voice partial transcript chunks reuse same channel pattern.
- **Interrupt+resume pattern A (LangGraph RedisSaver checkpointer + Pattern P2 dynamic `interrupt()` primitive)**: 3 SSE events trigger graph pause (server-side `interrupt()` call) → emit `status: awaiting_user_input` after the trigger event:
  1. `typo_suggestion` event → graph pauses at `detect_typo` node (only when LLM confidence > 0.85 per D-S04-13 Pattern P2 conditional rule)
  2. `variant_degraded` event → graph pauses at `generate_understanding` OR `generate_reasons` node (only when LLM `TimeoutError`/`LLMError` caught)
  3. `products` event (Variant B `mode=ai_augmented` only) → graph pauses at `rank_finalize` node END (Option α — always pause for cart action with 60s Gateway timeout)
  Resume: FE POST `/intent/{rid}/action` → Gateway forwards → AI service `graph.astream(Command(resume=<choice>), config={'configurable': {'thread_id': rid}})` → graph continues from checkpoint → publishes next events to same `sse:pubsub:{rid}` channel.
- **Cart action flow Option α (Pattern A reused 2nd stage in same request)**: AI graph from `final` event boundary checks `state.cart_trigger_product_id` (set by Command(resume=...) injection); if present → routes to `co_purchase_lookup` node → emits `co_purchase_hint` SSE event → emits `final` → graph END + `adelete_thread(rid)` cleanup. If skipped (`{choice: 'skip'}` from Gateway timeout) → emits `final` directly → graph END.

Client (Next.js — typed wrapper at `apps/web/lib/sse-client.ts`):
```ts
import { streamIntent } from '@/lib/sse-client';

const close = streamIntent(`/api/v1/intent/stream?id=${requestId}`, {
  status: (e) => setPhase(e.phase),
  partial_text: (e) => append(e.delta),
  card: (card) => showCard(card),
  // S-04 NEW handlers:
  phase_progress: (p) => updatePhase(p.phase_id, p.status, p.meta),
  understanding: (u) => setUnderstandingCard(u.text, u.highlighted_terms),
  typo_suggestion: (t) => showTypoConfirmCard(t),
  variant_degraded: (v) => { setMode(v.to); showErrorCard(v.title, v.user_message, v.trace_id); },  // S-04 Phiên Sx04-8b C-S04-Q: button labels hardcoded FE per state HTML (NOT from server array)
  co_purchase_hint: (c) => appendChatMessage(<CoPurchaseHintCard hint={c} />),
  empty_state: (e) => setEmptyState(e),
  product_ready: (p) => appendProductCard(p.item, p.index, p.total),  // NEW Phiên Sx04-4 D-S04-14 LAW
  products: (p) => setProducts(p.items, p.mode),  // mode field NEW S-04; canonical final list (backward-compat)
  final: (f) => { finalize(f); close(); },
  error: (err) => toast.error(err.message),
});
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
| 429 | `RATE_LIMITED` | Quá giới hạn (production: per-tenant + per-user ở Gateway) |
| 402 | `PAYMENT_FAILED` | Thanh toán bị từ chối/thất bại (VNPay/Momo) |
| 400 | `SIGNATURE_INVALID` | Chữ ký IPN/callback payment không hợp lệ |
| 403 | `CROSS_TENANT` | Truy cập tài nguyên thuộc tenant khác |
| 400 | `TENANT_REQUIRED` | Thiếu active tenant (X-Tenant-Id / JWT claim) |
| 403 | `CONSENT_REQUIRED` | Hành động cần consent (GDPR) chưa được cấp |
| 500 | `INTERNAL` | Unknown |
| 503 | `EXTERNAL_DOWN` | Vespa/Gemini timeout |
| 503 | `E_LLM_TIMEOUT` (S-04 NEW) | LLM provider timeout in Variant B path — triggers `variant_degraded` SSE event for graceful fallback to Variant A. NOT a hard error; user gets retry/continue choice. |
| 503 | `E_LLM_RATE_LIMITED` (S-04 NEW) | LLM provider rate limit hit — same handling as `E_LLM_TIMEOUT`. |
| 422 | `E_VISION_BLUR` (S-07 NEW per C-S07-F) | Image blur / unrecognizable. Fires when Ω₂ 3-threshold check matches: `vision.analyze` returns `confidence<0.3` OR `category='unknown'` OR `max(confidence_per_field.values()) <0.4`. Server-side per C-S07-J (NO client-side Canvas blur check). Empirically validated Phiên Sx07-B+Sx07-D against blurry control image (GaussianBlur radius=18 → confidence:0.05 category:'unknown' all field confs 0.0 → ALL 3 thresholds fire). Response includes `trace_id` + `retriable:true`; FE renders state-E-blur-error with "Chụp lại" CTA. |
| (SSE) | `E_TRANSCRIBE_FAILED` (S-08 NEW per D-S08-NN-11) | speech.transcribe timeout (>15s) hoặc Gemini audio API lỗi. Surface qua SSE `error` từ `_node_speech_transcribe` (buying_by_voices.py, Intent 02). FE state-G; retriable. |
| (SSE) | `E_INTENT_PARSE_FAILED` (S-08 NEW) | LLMClient.generate_json rỗng/JSON hỏng ở `_node_parse_voice_intent`. |
| (FE) | `E_PERMISSION_DENIED` (S-08 NEW) | Browser từ chối quyền mic; FE-side, BE KHÔNG raise (doc để đủ FE-BE contract). |
| (SSE) | `E_NO_SPEECH` (S-08 NEW) | Audio < 0.5s hoặc Gemini trả transcription rỗng (im lặng). Surface từ `_node_speech_transcribe`. |

> **Verified 2026-06-10 (error.dto.ts):** chỉ `E_LLM_TIMEOUT` + `E_LLM_RATE_LIMITED` được enum hoá (`LlmErrorCodeSchema`); mọi code khác để `code: z.string()` **mở** (bảng này là tham chiếu doc, không phải Zod enum). 4 voice code + `E_VISION_BLUR` chỉ surface qua **SSE `error` event** (không phải HTTP body) — **verified 2026-06-10 raised trong AI graph**: voice codes ở `buying_by_voices.py` (Intent 02) + `analyzing_by_voices.py` (Intent 07 reuse); `E_VISION_BLUR` ở `importing_by_images.py` (Intent 01) + `recommend_by_images.py` (Intent 04). `E_PERMISSION_DENIED` = FE-side, BE KHÔNG raise (comment buying_by_voices.py:108). Các code `CROSS_TENANT`/`TENANT_REQUIRED`/`CONSENT_REQUIRED`/`RATE_LIMITED`(per-tenant)/`PAYMENT_FAILED`/`SIGNATURE_INVALID` gắn với feature **🟡 CHƯA CODE** (tenant/GDPR/rate-limit/payment). **Cột HTTP-status là tham chiếu doc — KHÔNG verify exhaustive từng code→status với Nest exception phiên này** (envelope ✓; status thực do exception filter quyết định runtime).

## 5. MCP Tool Specs

MCP tools dùng JSON-RPC 2.0. Signature dạng:

```yaml
# auth
auth.verify_jwt:
  params: { token: string }
  returns: { user_id: string, tenant_id: string | null, role: string } | null
  # ⚠️ CODE HIỆN TẠI = STUB (apps/mcp/src/tools/auth.py trả None mọi token — "NOT building auth/JWT until S-03").
  #   JWT + tenant verify THẬT ở GATEWAY (JwtAuthGuard + jwt.helper.ts; xem §1.0) — KHÔNG qua MCP.
  #   Shape trên (gồm tenant_id, ADR-040) = TARGET production, không phải code hiện tại.
  # Production (ADR-040): trả thêm tenant_id (active tenant của merchant; null cho customer global).
  # Mọi MCP tool đọc/ghi dữ liệu tenant-scoped nhận + scope theo tenant_id (RLS GUC ở DB).

# products  
products.get:
  params: { id: string }
  returns: Product | null

products.create:   # verified 2026-06-10 (products.py) — params FLAT (KHÔNG nested `draft`)
  params: { merchant_id: string, title, category, attributes, price, stock,
            description?, image_url?, image_data?, brand?, trend_score?, idempotency_key? }
  returns: { product_id: string, created: bool }   # verified: KHÔNG phải full Product (created=False nếu trùng (merchant_id,title))

products.update:   # verified 2026-06-10 — params FLAT (KHÔNG nested `patch`)
  params: { product_id: string, expected_merchant_id: string,   # ownership pre-check
            ...subset _UPDATABLE_FIELDS (12: title/description/attributes/price/stock/image_url/
            brand/original_price/status/image_data/image_gradient/icon_hint) }
  returns: { product_id: string, updated: bool, event_id: string | null,
             snapshot: { ...full updated row } }   # verified: KHÔNG phải bare Product

# vespa
# vespa.hybrid_search — Vespa hybrid YQL search (BM25 + ANN)
#
# Implementation status LOCKED Phiên Sx04-3 per D-S04-13 LAW + C-S04-N:
#   Spec'd S-02 T07 (was assumed to be S-02 deliverable per MASTER_SLICE_BACKLOG
#   line 444/466 and S-04_BRIEF.md line 114) but actual S-02 source ships ONLY
#   MCP framework scaffold + 3 first tools (auth.verify_jwt, events.append,
#   products.get). `vespa.hybrid_search` implementation **ships at S-04 T02**
#   per C-S04-N resolution (operational gap fix; spec contract unchanged).
#   Filed at `apps/mcp/src/tools/vespa.py` (NEW); Python httpx → Vespa
#   :8080/search/ YQL build pattern; `apps/mcp/pyproject.toml` adds `httpx`
#   dep. S-07/S-08 reuse this MCP tool.
#
# S-04 Phiên Sx04 D-S04-03 LAW amendments (rank_profile param + match_score
# response augmentation):
vespa.hybrid_search:   # verified 2026-06-10: impl = `def search()` @ vespa.py (register map tool→search)
  params:
    query: string
    rank_profile?: 'baseline' | 'ai_augmented' | 'hybrid'  # default 'ai_augmented' (D-S04-03)
    limit?: int (default 8)        # verified: default 8 (KHÔNG phải 10)
    # FLAT filter params (verified — KHÔNG nested trong `filters{}`):
    category_filter?: string
    brand_filter?: string
    price_min?: int | null
    price_max?: int | null
    attribute_filter?: string
  returns: { items: [Product+{match_score, name, image_icon, rating, ...}], total: int, degraded_filters: [...] }
    # return là OBJECT {items,total,degraded_filters} (KHÔNG phải bare list).
    # match_score: float — từ summary_features.secondPhase (ai_augmented/hybrid); baseline dùng bm25(title).
    # Query embedding INSIDE Vespa qua YQL `embed(@query, clip_multilingual)` (D-S04-10, 512-d CLIP); no text.embed MCP.

vespa.image_nearest_neighbor:   # verified 2026-06-10 — cross-modal CLIP (text→image embedding)
  params:
    query_desc: string          # verified: TEXT mô tả ảnh (build từ vision.analyze output) — KHÔNG phải `image_b64`
    category_filter?: string     # verified: tên là `category_filter` (không phải `category`)
    limit?: int (default 30)
  returns: { items: [Product+match_score], total: int }   # OBJECT, không phải bare list

vespa.search_trend:   # verified 2026-06-10
  params: { category: string, limit?: int (default 10) }   # verified: dùng `limit`, KHÔNG có `window_days` input
  returns: { items: [{id, title, category, brand, price, trend_score, sold_count}],
             aggregates: { window_days: 7, top_count: int, avg_trend_score: float } }
    # window_days = OUTPUT constant (7), không phải input. (doc cũ {score,top_attrs,top_products} = SAI.)

vespa.index:
  params: { product: Product }   # KHÔNG truyền text_emb/image_emb — embedding tạo NATIVE trong Vespa (512-d CLIP, 02 §2.1)
  returns: { indexed: true, doc_id: string }   # verified: {indexed,doc_id} (doc cũ {ok:true} = SAI)

vespa.compare_similar:   # verified 2026-06-10
  params: { product: ProductDraft, limit?: int (default 10) }
  returns: { similar_count: int,
             aggregates: { avg_price: number, price_p25: number, price_p75: number },   # verified: nested trong `aggregates`
             items: [{id, title, price, brand, match_score}] }


# shopee — CODE hiện query bảng `shopee_prices_mock` (ADR-032 còn trong code);
#   production → `shopee_prices` do worker `shopee-crawl` (ADR-039); tool name/shape GIỮ NGUYÊN.
shopee.price_range:   # verified 2026-06-10 (_row_to_result/_empty_result @ shopee.py)
  params: { category: string, attributes?: dict }   # verified: tên `attributes` (doc cũ `attrs?`)
  returns: { aggregates: { min_price: int, avg_price: int, max_price: int,
                           sample_count: int, review_count: int },
             samples: [{ title: string, store: string, price: int, rating: float|null, sold_count: int }],
                # ✅ DB-verified 2026-06-10: query `shopee_prices_mock.samples->0` = {title,store,price,rating(float),sold_count}; pass-through JSONB qua `_row_to_result`.
             matched_via: string }    # "specific" | "category_fallback" | "no_match"
    # doc cũ {found, min, max, avg, count, updated_at} = SAI: không có found/updated_at;
    # min/avg/max nested trong `aggregates` (min_price/avg_price/max_price); count→sample_count; +matched_via.

# gtrends (mock) — market demand signal
gtrends.interest_over_time:   # verified 2026-06-10 (gtrends.py)
  params:
    keyword: string         # vd: "nước tương Maggi"
    category?: string        # verified: tham số là `category` (KHÔNG phải `geo`)
    window_days?: int        # verified: default 7 (KHÔNG phải 90)
  returns:
    trajectory: 'rising' | 'stable' | 'falling'   # >10% rising, <-10% falling, else stable
    current_score: float    # latest week 0-100 (float, không phải int)
    delta_pct: float        # % change vs window_days ago
    series: [float]         # verified: mảng float phẳng (KHÔNG phải [{date,value}])
    related_rising: [string]   # related queries trending up
    insight: string         # verified: có `insight` (doc cũ ghi `fetched_at` = SAI)

# multimodal
vision.analyze:    # verified 2026-06-10 — return khớp `_normalize_result` (vision.py); single Gemini 2.5 Flash rich-prompt
  params: { image_b64: string, timeout_s?: float }   # verified: +timeout_s? optional
  returns:
    category: string                       # ICP taxonomy: 11 canonical (DB 12 distinct — `gạo` dup chưa normalize) OR 'unknown' on blur
    attributes: dict                       # {brand, size, weight, ...}
    ocr_text: string                       # raw OCR (may be empty)
    confidence: float                      # overall [0,1] — blur convention: 0.0-0.3 on unrecognizable
    confidence_per_field: dict             # NEW Phiên Sx07-B per C-S07-L — {title, brand, category, size}
    alternatives: dict                     # NEW Phiên Sx07-B per C-S07-L — {category: ['nuoc_tuong', ...], ...}
  # Used by Intent 01 vision_analyze node; Ω₂ 3-threshold blur check
  # (overall conf<0.3 OR category='unknown' OR max field conf<0.4) emits E_VISION_BLUR
  # error per C-S07-J (empirically validated 2026-05-26)

vision.suggest_attributes:   # verified 2026-06-10 — text-based (KHÔNG nhận ảnh); gợi ý attribute cho draft (Intent 01)
  params: { category?: string, existing_attrs?: dict, timeout_s?: float }   # verified: KHÔNG có image_b64 (doc cũ SAI)
  returns: { suggested_attributes: [...] }   # verified: list (≤5) qua `_normalize_suggest_result`; doc cũ `{attributes: dict}` = SAI

vision.embed:                # ⚠️ CHƯA CODE: KHÔNG có MCP tool này. Embedding ảnh tạo NATIVE trong Vespa
  params: { image_b64: string }   #   (512-d CLIP, ADR-036) — không gọi qua MCP. (Doc cũ ghi float[768] = SAI.)
  returns: { vector: float[512] }   # target nếu sau này cần embed ngoài Vespa

# text.embed: RETRACTED Phiên Sx04-1 per D-S04-10 LAW + C-S04-K resolution.
#   Query embedding done by Vespa native hugging-face-embedder via YQL
#   `embed(@query, clip_multilingual)` — see 02_DATA_MODEL.md §2.1.
#   No MCP tool needed. Indexing-time embed also via Vespa schema indexing
#   expression `input title . " " . input description | embed clip_multilingual`.

speech.transcribe:   # verified 2026-06-10 (speech.py) — OpenAI STT (gpt-4o-transcribe)
  params: { audio_b64: string, mime_type?: string (def 'audio/webm'), lang?: string (def 'vi'), timeout_s?: float }
  returns: { text: string, confidence: null, duration_ms: int, language: string }
    # verified: confidence LUÔN null (Gemini/OpenAI audio không surface — R-S08-1); +duration_ms,language.
    # (Khớp SSE voice_transcribed payload.)

speech.synthesize:   # verified 2026-06-10 — OpenAI TTS (gpt-4o-mini-tts)
  params: { text: string, voice?: string, format?: string (def 'mp3'), timeout_s?: float }   # verified: KHÔNG có `lang`
  returns: { audio_b64: string, mime: string, model: string, voice: string }   # verified: mime/model/voice (doc cũ `format:'mp3'` = SAI)

# cart — Extended S-05 Phiên Sx05-2 per D-S05-02 LAW (4→7 tools + snapshot fields)
cart.get:
  params: { user_id: string }
  returns: Cart   # with inline validate_stock per A4 (single SQL query for in_stock + available_stock)

cart.update_qty:
  params: { user_id: string, product_id: UUID, qty: int (0..99), snapshot?: CartItemSnapshot }
  # qty=0 → auto-remove (D-S05-02 LAW sugar); qty>0 → upsert with snapshot persistence
  # snapshot required on first add; optional on subsequent updates (preserved)
  returns: Cart

cart.remove:
  params: { user_id: string, product_id: UUID }
  returns: Cart

cart.clear:
  params: { user_id: string }
  returns: { cleared: true, user_id: string }   # verified 2026-06-10 (cart.py:583) — doc cũ `items_count_cleared` = SAI

cart.validate_stock:   # NEW S-05 — verified 2026-06-10 (cart.py:586-623)
  params: { user_id: string }
  returns: { updates: [{ product_id: string, in_stock: bool, available_stock: int }] }
    # verified literal: key `updates` (doc cũ `items_with_stock_issue` = SAI); re-query Postgres, KHÔNG mutate Redis cart; [] khi cart rỗng.

cart.apply_promo:   # NEW S-05 per D-S05-05 LAW
  params: { user_id: string, code: string }
  # Fast-path: case-insensitive exact match against `promo_codes.json` fixture
  # No exact match → returns {error: 'INVALID_CODE'} (LLM typo correction T03 — separate AI graph)
  returns: Cart   # with promo + totals.discount applied

cart.remove_promo:   # NEW S-05
  params: { user_id: string }
  returns: Cart   # promo cleared + totals recomputed

# events
events.append:   # verified 2026-06-10 (events.py) — params + return {event_id} khớp impl chính xác
  params:
    type: string
    aggregate_type: string
    aggregate_id: string
    user_id?: string
    payload: dict
    metadata?: dict
  returns: { event_id: string }

events.list_by_aggregate:   # ⚠️ CHƯA CODE: registry chỉ có `events.append`. Đây là target (đọc event theo aggregate).
  params: { aggregate_type, aggregate_id, since? }
  returns: [Event]

# action cards
cards.create:
  params: { event_id, policy_id, user_id, action_type, suggestion, expires_at? }   # verified cards.py: expires_at ISO 8601 (KHÔNG phải expires_in_seconds)
  returns: { card_id: string }   # verified 2026-06-10 (cards.py:158) — KHÔNG phải full ActionCard

cards.list_pending:
  params: { user_id, limit?: int }
  returns: [ActionCard]   # verified: dùng `_row_to_card` (10 field) @199

cards.update_status:
  params: { card_id: string, status: 'accepted'|'rejected'|'expired', applied_value?: dict }   # verified cards.py:208-215 (doc cũ id/params? + thiếu 'expired' = SAI); re-apply cùng status = no-op (updated=false)
  returns: { card_id: string, status: string, updated: bool }   # verified 2026-06-10 (cards.py:272) — KHÔNG phải full ActionCard

# policies
policies.find_matching:   # verified 2026-06-10 (policies.py)
  params: { trigger: string, context?: dict }   # verified: `trigger` + `context?` (doc cũ `{event_type, payload, context?}` = SAI)
  returns: [Policy]    # list policy rows khớp điều kiện (DSL eval), ordered by priority

# analytics (đọc-only) — REGISTRY THẬT = 10 tools (verified apps/mcp/src/tools/analytics.py):
analytics.stock_snapshot:      # CODE: registered — verified 2026-06-10 (analytics.py)
  params: { merchant_id: string, category?: string, product_id?: string }
  returns: { products: [{ product_id, title, category, current_stock, unit_price,
                          qty_7d, qty_30d, velocity_per_day, days_left }], _trace: dict }
    # verified: OBJECT {products,_trace} (KHÔNG bare list); field current_stock/days_left (doc cũ stock/days_no_sale = SAI).
analytics.co_purchased:        # CODE: registered — sản phẩm hay mua kèm (S-10)
analytics.product_corpus_size: # CODE: registered — kích thước corpus (cho confidence)
analytics.suggest_price:       # CODE: registered — gợi ý giá
analytics.suggest_promo:       # CODE: registered — gợi ý khuyến mãi
analytics.suggest_restock:     # CODE: registered — gợi ý nhập hàng
analytics.suggest_loan:        # CODE: registered — gợi ý vay vốn
analytics.explain_trend:       # CODE: registered — giải thích xu hướng
analytics.aggregate:           # CODE: registered — tổng hợp số liệu
analytics.detect_anomaly:      # CODE: registered — phát hiện bất thường
#   (params/returns chi tiết theo analytics.py; 10 tool trên phục vụ Intent 07 — xem 04_INTENT_SPECS.)

# ⚠️ CHƯA CODE (doc cũ ghi nhưng registry KHÔNG có) — target đọc matview V006:
analytics.sales_by_month:      # CHƯA CODE
  params: { product_id?: string, merchant_id?: string, range_months: int }
  returns: [{ month: 'YYYY-MM', revenue: number, qty: int }]
analytics.trend_history:       # CHƯA CODE (registry có `explain_trend`, KHÔNG có `trend_history`)
  params: { product_id?: string, category?: string, range_days: int }
  returns: [{ date: 'YYYY-MM-DD', score: float }]
```

## 6. Pagination

> 🟡 **CHƯA CODE (verified 2026-06-10):** grep `gateway/src` KHÔNG có `cursor`/`next_cursor`/pagination nào. GET /products = CHƯA CODE; GET /cards trả `{items: Card[]}` (no cursor); GET /cart trả Cart. §6 dưới là **spec target**.

Cursor-based, không offset:
```
GET /products?limit=20&cursor=eyJp...
Response: { items: [...], next_cursor: "eyJp..." | null }
```

Cursor là base64 của `{last_id, last_created_at}`.

## 7. Validation Rules

- Backend: class-validator (Nest) **nhưng KHÔNG có global `ValidationPipe`** (verified 2026-06-10 main.ts) → decorator có trên DTO nhưng **validation hiện là defensive/manual trong controller**; `ZodValidationPipe` = target (C-S07-P). pydantic (Flask AI) — chưa verify ở phiên này.
- Client cũng validate cơ bản (UX), nhưng server re-validate (manual)
- Price: integer VND, không float (verified ProductDraftSchema `z.number().int()`)
- String length: **title 1-255** (verified ProductDraftSchema; doc cũ "3-255" = SAI). `description` — ProductDraftSchema KHÔNG đặt max (doc cũ "0-5000" chưa enforce trong schema).
- File upload (image ≤5MB, audio ≤10MB, jpg/png/webp / mp3/wav/webm): **🟡 KHÔNG tìm thấy enforce ở `gateway/src`** (verified grep rỗng) → target / có thể ở AI-side (chưa verify). Đừng coi là đã enforce.

## 8. CORS

Dev: allow `http://localhost:3000`
Prod: allow exact domain only.
> ✅ verified 2026-06-10: `app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' })` (main.ts) — dev default localhost:3000, prod set qua env `CORS_ORIGIN`.

## 9. Versioning

URL versioned: `/api/v1/...`. Breaking changes → `/v2`. Production: giữ `/v1` ổn định, deprecate có thông báo + thời gian chuyển tiếp.

---

**END OF API CONTRACTS DOC.**
