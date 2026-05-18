# Intent Field Audit Report — 7 Intents Còn Lại

> **Lập:** sau khi audit Intent 03 phát hiện 7 vấn đề. Doc này preempt audit cho 7 intent còn lại để biết **tổng số migration cần** trước khi vẽ mockup.

## Phương Pháp Audit

Mỗi intent đối chiếu:
- **Field UI sẽ cần** (predicted từ functional spec ở `04_INTENT_SPECS.md`)
- **Source hiện có** (Postgres V001+V002, Vespa, Redis)
- **Gap** — field thiếu cần migration / new table / new endpoint

Status:
- ✅ **OK** — field đã có
- ⚠️ **DERIVED** — không cần migration, FE/BE compute
- ❌ **MISSING** — cần migration mới

---

## Intent 01 — Import Products by Images

### UI Predicted (Phase 03 flagship)
- Camera capture UI
- Vision analyzing loading state với progress phases
- **Prefilled form**: title, brand, category, attributes (size/weight/origin/...), price, stock, description, image
- **Shopee comparison panel**: price range, top similar products
- **Market trend panel** (Google Trends): trajectory icon (📈/➡️/📉), delta % 90 ngày, sparkline, related rising chips
- **Action cards** sidebar/bubble: SUGGEST_PRICE, SUGGEST_ATTRS, SUGGEST_ALTERNATIVES, SUGGEST_CREDIT, SUGGEST_PROMOTION, SUGGEST_STOCK_UP, SUGGEST_WAIT_OR_REDUCE
- Commit button → product visible in shop

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Image upload preview | FE state | ⚠️ DERIVED |
| Vision phases (analyzing, embedding, comparing) | SSE `status` event | ✅ |
| Prefilled `title`, `description` | LLM output → form state | ⚠️ DERIVED |
| Prefilled `brand` | LLM output | ✅ V002 column ready |
| Prefilled `category` | LLM output, taxonomy fixed | ✅ |
| Prefilled `attributes` | LLM output JSONB | ✅ V001 |
| Prefilled `price` suggestion | Shopee mock + Vespa similar avg | ⚠️ DERIVED BE |
| Prefilled `stock` | User input | ⚠️ DERIVED |
| Image `image_url` after upload | S3-compatible storage | ❌ **MISSING: file storage** |
| Image `image_gradient` fallback | AI generate from dominant color | ✅ V002 |
| Image `icon_hint` fallback | LLM suggest Tabler icon | ✅ V002 |
| Shopee comparison `price_min/max/avg` | MCP `shopee.price_range` returns | ⚠️ DERIVED BE |
| Similar products from Vespa | MCP `vespa.compare_similar` returns | ✅ |
| Action card `policy_code` | Postgres `policies` (rule_dsl) | ✅ V001 |
| Action card `suggestion` payload | Postgres `action_cards.suggestion` JSONB | ✅ V001 |
| Card "applied_value" tracking | Behavior event property | ✅ |
| Commit button state | FE | ⚠️ DERIVED |
| Market trend `trajectory` icon | MCP `gtrends.interest_over_time` returns | ⚠️ DERIVED BE (transient) |
| Market trend `delta_pct` display | MCP `gtrends.interest_over_time` returns | ⚠️ DERIVED BE (transient) |
| Market trend `current_score` 0-100 | MCP `gtrends.interest_over_time` returns | ⚠️ DERIVED BE (transient) |
| Market trend sparkline `series[]` 90d | MCP `gtrends.interest_over_time` returns | ⚠️ DERIVED BE (transient) |
| Market trend `related_rising` chips | MCP `gtrends.interest_over_time` returns | ⚠️ DERIVED BE (transient) |
| Market trend AI reasoning strip | LLM synthesizes from MCP result | ⚠️ DERIVED BE |

### ❌ Migrations Cần Thêm
- **0 migrations cho Google Trends** — data transient, không persist Postgres/Vespa
- **Depends on new MCP tool**: `gtrends.interest_over_time` (xem ADR-031 trong `DECISIONS.md`, spec ở `03_API_CONTRACTS.md` Section 5)
- **Depends on payload extension**: event `ProductDraftSubmitted` và `ProductImported` thêm field `market_trend` (đã update `02_DATA_MODEL.md` Section 7)
- **V003 (Image Storage)**: ...
- **V003 (Image Storage)**: Setup MinIO/S3-compatible service + table `media_uploads` (id, user_id, mime, size, url, created_at)
  - Hoặc đơn giản hơn: dùng base64 data URLs lưu trực tiếp trong `products.image_url` cho hackathon (50 products × ~50KB = 2.5MB OK)

### Verdict: **0 migration thêm cho Google Trends** (chỉ depends on new MCP tool + event payload extension). Vẫn giữ note về Image Storage: 1 migration optional nếu không dùng base64.
---

## Intent 02 — Buy Products by Voice

### UI Predicted (Phase 04, voice modality)
- Voice recording UI với waveform animation
- Live transcription preview text
- Confidence indicator
- **Product candidates** list (5-10 matches) — reuse ProductCard với "match score"
- Clarify dialog nếu ambiguous ("Anh muốn loại nào?")
- Quantity stepper per item
- Add-to-cart button bulk

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Voice waveform animation | FE (MediaRecorder + canvas) | ⚠️ DERIVED |
| Live transcription text | MCP `speech.transcribe` SSE | ✅ |
| Transcription `confidence` | Gemini STT response | ⚠️ DERIVED BE |
| Product candidates | Vespa search results | ✅ (reuse Intent 03 schema) |
| **Match score per candidate** | Vespa rank_score | ✅ ADR-024 đã có |
| **Clarify questions** | LLM generate based on ambiguity | ⚠️ DERIVED BE |
| Quantity stepper | FE state | ⚠️ DERIVED |
| Add-to-cart bulk | Redis cart key | ✅ |

### ❌ Migrations Cần Thêm
- **0 migrations** — tận dụng hết schema hiện có

### Verdict: **0 migration thêm**

---

## Intent 04 — Recommend Products by Image

### UI Predicted (Phase 05)
- Image upload (giống intent 01)
- AI analyzing state
- **10 recommended products** carousel — reuse ProductCard
- **"Lý do gợi ý" per product** ✨ — đây là điểm đặc sắc
- Co-purchase signals ("Người mua X thường mua Y")
- Sort by: visual similarity / co-purchase / trending

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Image upload + vision analyze | Same as Intent 01 | ✅ |
| Image embedding | MCP `vision.embed` | ✅ V001 Vespa |
| 10 recommended products | Vespa `image_similarity` + `co_purchased` blend | ✅ |
| **Reason per product** | LLM generate per item | ❌ **MISSING field** |
| **Similarity score** | Vespa rank_score | ⚠️ DERIVED BE (cùng search) |
| **"Người mua X thường mua Y"** | Postgres `co_purchase_matrix` (Phase 05) | ✅ ADR-013 |
| Visual badge "98% giống" | Vespa closeness score formatted | ⚠️ DERIVED BE |
| Source filter (visual/collab/trending) | Recommend graph metadata | ⚠️ DERIVED BE |

### ❌ Migrations Cần Thêm
- **0 migrations** — `reason` là **transient field**, không persist, chỉ tồn tại trong SSE response

### ⚠️ Schema Update
- Cần extend `SearchProductSchema` thành `RecommendedProductSchema` thêm:
  - `reason: string` (LLM generated, transient)
  - `match_score: number` (0-1)
  - `match_type: 'visual' | 'collab' | 'trending'`

### Verdict: **0 migration, 1 schema extension**

---

## Intent 05 — View Cart Products by Text

### UI Predicted (Phase 04, bottom sheet)
- Bottom sheet pull-up
- 3-snap points (peek 15vh / half 50vh / full 90vh)
- Cart items list — reuse ProductCard compact
- Per-item: image, title, qty stepper, unit_price, line_total, remove button
- Subtotal, discount preview, shipping (optional), total
- Free gift hint ("Mua thêm X được tặng Y")
- Checkout CTA

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Cart items list | Redis `cart:{user_id}` JSON | ✅ V001 |
| Per-item product info | Embed product snapshot khi add hoặc lookup live | ⚠️ DERIVED BE |
| Per-item `qty` | Redis cart entry | ✅ |
| Per-item `unit_price` | Redis cart entry (snapshotted at add time) | ✅ |
| Per-item `line_total` | qty × unit_price | ⚠️ DERIVED FE |
| Subtotal | sum of line_totals | ⚠️ DERIVED FE |
| **Discount** | Promotion engine (Phase 06 optional) | ❌ **MISSING** |
| **Free gift hint** | Rule engine | ❌ **MISSING** |
| Total | subtotal - discount + shipping | ⚠️ DERIVED FE |

### ❌ Migrations Cần Thêm
- **V004 (Promotions)** — chỉ nếu muốn show "Mua thêm X được tặng Y":
  ```sql
  CREATE TABLE promotions (
    id UUID PRIMARY KEY,
    code VARCHAR(40) UNIQUE,
    name TEXT,
    rule_dsl JSONB,  -- {"min_subtotal": 100000, "free_gift_product_id": "..."}
    enabled BOOL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ
  );
  ```

### Verdict: **1 migration optional** (skip nếu cut feature gift cho hackathon)

---

## Intent 06 — Pay Order Products by Text

### UI Predicted (Phase 04)
- Trigger từ cart sheet "Thanh toán" button
- Confirm modal: order summary + payment method selector + confirm CTA
- Payment processing state với real-time SSE order status pill
- Success state: order ID, receipt, navigate to order detail
- Failed state: error message + retry / cancel

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Order summary | Build from cart Redis | ✅ |
| **Payment method selector** (Momo/ZaloPay/Bank/COD) | Static config | ❌ **MISSING table** `payment_methods` (optional) |
| Order ID after create | Postgres `orders.id` | ✅ V001 |
| Real-time status pill | SSE `order_update` event | ✅ |
| Order status (pending/processing/paid/failed) | Postgres `orders.status` | ✅ V001 |
| Order `total` | Postgres | ✅ V001 |
| Order `created_at` | Postgres | ✅ V001 |
| Transaction record | Postgres `transactions` | ✅ V001 |
| Receipt download (PDF) | Generated on-demand (Phase 06) | ❌ skip hackathon |
| Failure reason | Postgres `transactions.metadata` (need JSONB) | ❌ **MISSING column** |

### ❌ Migrations Cần Thêm
- **V005 (Payment polish)** — minor:
  ```sql
  ALTER TABLE transactions
    ADD COLUMN payment_method VARCHAR(40) DEFAULT 'mock',
    ADD COLUMN failure_reason TEXT,
    ADD COLUMN metadata JSONB DEFAULT '{}';
  ```
- Payment methods table: skip cho hackathon, hardcode 1 mock provider

### Verdict: **1 migration nhỏ** (alter table)

---

## Intent 07 — Analyze Business by Voice

### UI Predicted (Phase 05)
- Voice recording (giống intent 02)
- Chart card inline trong chat thread
- 3 chart types: line (trend over time), bar (compare categories), donut (share)
- Narrative text từ LLM
- "Action cards" gợi ý từ insight (vd: "Top sản phẩm giảm trend - cần xem")
- Drill-down chips

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Voice + transcription | Reuse Intent 02 | ✅ |
| Chart `type`, `title`, `x_axis`, `y_axis` | LLM intent classify → SQL plan → result | ⚠️ DERIVED BE |
| Chart `series[]` data | MCP `analytics.aggregate` SQL queries | ❌ **MISSING** — tools chưa define |
| **Pre-aggregated tables** | Should have for performance | ❌ **MISSING** |
| Narrative text | LLM | ⚠️ DERIVED BE |
| Action cards from insights | Reuse policy engine | ✅ V001 |

### ❌ Migrations Cần Thêm
- **V006 (Analytics aggregations)** — quan trọng cho performance:
  ```sql
  -- Daily aggregates per merchant
  CREATE MATERIALIZED VIEW analytics_daily AS
  SELECT
    user_id AS merchant_id,
    DATE(created_at) AS day,
    COUNT(*) AS orders_count,
    SUM(total) AS revenue,
    SUM((SELECT SUM(qty) FROM order_items WHERE order_id = orders.id)) AS items_sold
  FROM orders
  WHERE status = 'paid'
  GROUP BY merchant_id, DATE(created_at);
  CREATE UNIQUE INDEX ON analytics_daily(merchant_id, day);
  
  -- Daily aggregates per merchant × category
  CREATE MATERIALIZED VIEW analytics_daily_category AS
  SELECT
    p.merchant_id,
    DATE(o.created_at) AS day,
    p.category,
    SUM(oi.qty) AS qty_sold,
    SUM(oi.qty * oi.unit_price) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE o.status = 'paid'
  GROUP BY p.merchant_id, DATE(o.created_at), p.category;
  CREATE UNIQUE INDEX ON analytics_daily_category(merchant_id, day, category);
  
  -- Refresh strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY hourly via worker
  ```
- Also: insights table V003 đã propose

### Verdict: **2 migrations** (V003 insights + V006 analytics aggregations)

---

## Intent 08 — Login/Logout by Text

### UI Predicted (Phase 02)
- Splash login modal one-time
- Email/password form
- "Quên mật khẩu?" link (skip cho hackathon)
- Demo accounts hint ("merchant@demo.com / demo1234")
- Loading state during auth
- Success → modal close + main screen load

### Field Audit

| UI element | Source | Status |
|---|---|---|
| Form fields email/password | FE state | ⚠️ DERIVED |
| Login submit | POST `/auth/login` | ✅ V001 |
| JWT cookie set | Server response | ✅ V001 |
| Session record | Postgres `sessions` | ✅ V001 |
| Display name greeting | Postgres `users.display_name` | ✅ V001 |
| Avatar fallback | Initials computed from display_name | ⚠️ DERIVED FE |
| Logout | POST `/auth/logout` + revoke `sessions.revoked_at` | ✅ V001 |

### ❌ Migrations Cần Thêm
- **0 migrations** — auth schema đã đầy đủ trong V001

### Verdict: **0 migration**

---

## Tổng Kết — Migration Roadmap

| Migration | Intent | Priority | Phase | Status |
|---|---|---|---|---|
| V001 (existing) | All | — | P01 | ✅ Done |
| **V002** (existing) | 03 Search | P0 | P01 | ✅ Done (vừa làm) |
| **V003 — insights** | 07 Analytics + Hero card home | **P0** | P02 | ❌ Need to write |
| **V004 — promotions** | 05 Cart "free gift" | P2 optional | P06 | ⚠️ Skip-able |
| **V005 — payment metadata** | 06 Payment | P1 | P04 | ❌ Need to write |
| **V006 — analytics aggregations** | 07 Analytics | **P0** | P05 | ❌ Need to write |
| **V007 — media uploads** (hoặc base64 inline) | 01 Import | P1 | P03 | ⚠️ Decision pending |

### Note: Non-Migration Dependencies (Update sau ADR-031)

Một số features thêm sau audit ban đầu KHÔNG cần migration nhưng có **non-DB dependencies** quan trọng:

| Feature | Intent | Dependency | Type | Doc reference |
|---|---|---|---|---|
| Google Trends market signal | 01 Import | MCP tool `gtrends.interest_over_time` | New MCP tool | `03_API_CONTRACTS.md` §5 |
| Google Trends market signal | 01 Import | Event payload field `market_trend` | Schema extension | `02_DATA_MODEL.md` §7 |
| Google Trends market signal | 01 Import | Policy rules `MARKET_RISING_v1`, `MARKET_FALLING_v1` | Policy seed | `02_DATA_MODEL.md` policies table |
| Google Trends market signal | 01 Import | Log messages `gtrends.*` | Ops log catalog | `LOG_CATALOG.md` §A |

### Có Thể Skip Cho Hackathon
- V004 promotions (cut "free gift")
- V007 media uploads → dùng base64 trong `image_url` text column

### Bắt Buộc Có
- V003 insights — hero AI card trống không có cái này
- V005 payment metadata — failure_reason cần cho demo "compensation"
- V006 analytics aggregations — Intent 07 sẽ chậm khủng khiếp nếu không có

### Schema Extensions (không phải migration)
- `RecommendedProductSchema` extends `SearchProductSchema` thêm `reason`, `match_score`, `match_type`
- `CartItemSchema` cần spec đầy đủ
- `OrderStatusPillState` enum cần lock
- `AnalyticsChartSpec` cần lock structure

---

## Quyết Định Cần Confirm

**Câu hỏi cho bạn:**

1. **Image storage Intent 01:** Base64 inline (đơn giản, hackathon-friendly) hay S3/MinIO (proper)?
2. **Promotions (Intent 05):** Cut feature "free gift" hay làm V004?
3. **Receipt PDF (Intent 06):** Skip hay implement Phase 06?
4. **Pre-aggregations (Intent 07):** Materialized view auto-refresh hourly OK chứ?

---

## Tổng Số Migration Cần Cho Toàn Bộ Hackathon

**Bắt buộc:** V001 + V002 + V003 + V005 + V006 = **5 migrations**
**Optional:** V004 + V007 = thêm 2 nếu có thời gian

→ **Hợp lý** cho 6 tuần hackathon, không bị migration hell.
