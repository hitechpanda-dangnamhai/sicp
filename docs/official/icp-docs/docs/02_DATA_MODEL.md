# 02 — Data Model

> **Load khi:** code migrations, repositories, queries, Vespa schema. Đây là contract; thay đổi cần ghi `DECISIONS.md`.

## 1. Postgres Schema (DDL)

```sql
-- USERS
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('merchant', 'customer', 'admin')),
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SESSIONS (chỉ lưu metadata, JWT stateless)
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         VARCHAR(64) UNIQUE NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX idx_sessions_jti ON sessions(jti);

-- PRODUCTS
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(100) NOT NULL,
  attributes      JSONB NOT NULL DEFAULT '{}',   -- {brand, size, weight, ...}
  price           BIGINT NOT NULL CHECK (price >= 0),  -- VND, integer
  stock           INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url       VARCHAR(500),
  vespa_doc_id    VARCHAR(100),
  trend_score     REAL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);

-- EVENTS (event sourcing append-only)
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(80) NOT NULL,
  aggregate_type  VARCHAR(40) NOT NULL,        -- 'Product', 'Order', 'User', ...
  aggregate_id    UUID NOT NULL,
  user_id         UUID REFERENCES users(id),
  payload         JSONB NOT NULL,
  metadata        JSONB DEFAULT '{}',          -- {ip, user_agent, request_id, ...}
  published_at    TIMESTAMPTZ,                 -- NULL = chưa publish Kafka
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id, created_at);
CREATE INDEX idx_events_type ON events(type, created_at);
CREATE INDEX idx_events_unpublished ON events(created_at) WHERE published_at IS NULL;

-- POLICIES (rule DSL)
CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(40) UNIQUE NOT NULL,     -- 'PRICE_TOO_HIGH_v1'
  description TEXT,
  rule_dsl    JSONB NOT NULL,                  -- see section 3
  priority    INT NOT NULL DEFAULT 100,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ACTION_CARDS
CREATE TABLE action_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id),
  policy_id   UUID NOT NULL REFERENCES policies(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(60) NOT NULL,            -- 'SUGGEST_PRICE', 'SUGGEST_PROMOTION', ...
  suggestion  JSONB NOT NULL,                  -- payload tuỳ action_type
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at  TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cards_user_status ON action_cards(user_id, status);
CREATE INDEX idx_cards_event ON action_cards(event_id);

-- ORDERS
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  total             BIGINT NOT NULL CHECK (total >= 0),
  idempotency_key   VARCHAR(64) UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

-- ORDER_ITEMS
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  qty         INT NOT NULL CHECK (qty > 0),
  unit_price  BIGINT NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- TRANSACTIONS (payment)
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  amount      BIGINT NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  provider    VARCHAR(40) DEFAULT 'mock',
  external_id VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BEHAVIOR_EVENTS (user behavior cho recommendation/analytics)
-- Chi tiết xem docs/07_BEHAVIOR_LOGS.md
CREATE TABLE behavior_events (
  event_id     UUID PRIMARY KEY,
  event_type   VARCHAR(80) NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id      UUID,
  session_id   VARCHAR(64),
  device_id    VARCHAR(64),
  intent       VARCHAR(80),
  modality     VARCHAR(20),
  request_id   VARCHAR(64),
  subject_type VARCHAR(40),
  subject_id   VARCHAR(64),
  properties   JSONB NOT NULL DEFAULT '{}',
  app_version  VARCHAR(20)
) PARTITION BY RANGE (occurred_at);

-- Monthly partitions, Phase 01 tạo trước 3 tháng
CREATE TABLE behavior_events_y2026m05 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE behavior_events_y2026m06 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE behavior_events_y2026m07 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX idx_be_user_time   ON behavior_events (user_id, occurred_at DESC);
CREATE INDEX idx_be_type_time   ON behavior_events (event_type, occurred_at DESC);
CREATE INDEX idx_be_subject     ON behavior_events (subject_type, subject_id);
CREATE INDEX idx_be_properties  ON behavior_events USING GIN (properties);

-- CO-PURCHASE MATRIX (materialized view, refresh hourly từ Phase 05)
-- DDL chi tiết xem 07_BEHAVIOR_LOGS.md section 6.4
```

## 2. Vespa Schema

File `infra/vespa/schemas/product.sd`:

```
schema product {
  document product {
    field id type string { indexing: attribute | summary }
    field merchant_id type string { indexing: attribute }
    field title type string {
      indexing: index | summary
      index: enable-bm25
    }
    field description type string {
      indexing: index | summary
      index: enable-bm25
    }
    field category type string {
      indexing: attribute | summary
      attribute: fast-search
    }
    field price type long { indexing: attribute | summary }
    field stock type int { indexing: attribute | summary }
    field attributes type map<string, string> {
      indexing: summary
    }
    
    # Display fields (denormalized từ Postgres khi index, dùng cho search response)
    # Audit ADR-024: tránh FE phải JOIN Postgres sau search
    field brand           type string { indexing: attribute | summary }
    field image_url       type string { indexing: summary }
    field original_price  type long   { indexing: attribute | summary }
    field rating_avg      type float  { indexing: attribute | summary }
    field rating_count    type int    { indexing: attribute | summary }
    field sold_count      type int    { indexing: attribute | summary }
    field image_gradient  type string { indexing: summary }
    field icon_hint       type string { indexing: summary }
    field status          type string { indexing: attribute }
    
    field text_embedding type tensor<float>(x[768]) {
      indexing: attribute | index
      attribute {
        distance-metric: angular
      }
      index {
        hnsw {
          max-links-per-node: 16
          neighbors-to-explore-at-insert: 200
        }
      }
    }
    field image_embedding type tensor<float>(x[768]) {
      indexing: attribute | index
      attribute {
        distance-metric: angular
      }
    }
    field trend_score type float { indexing: attribute | summary }
    field created_at type long { indexing: attribute }
    
    # Behavioral signals (updated by aggregator worker every 5min, Phase 05)
    # Real-time partial-update on purchase (Phase 04)
    # Chi tiết: docs/07_BEHAVIOR_LOGS.md section 6
    field impressions_7d  type long  { indexing: attribute | summary }
    field clicks_7d       type long  { indexing: attribute | summary }
    field add_to_cart_7d  type long  { indexing: attribute | summary }
    field purchases_7d    type long  { indexing: attribute | summary }
    field dismissals_7d   type long  { indexing: attribute | summary }
    field impressions_30d type long  { indexing: attribute | summary }
    field clicks_30d      type long  { indexing: attribute | summary }
    field purchases_30d   type long  { indexing: attribute | summary }
    field ctr_7d          type float { indexing: attribute }
    field cvr_7d          type float { indexing: attribute }
    field velocity_score  type float { indexing: attribute }
  }

  rank-profile hybrid {
    inputs {
      query(text_query) tensor<float>(x[768])
    }
    first-phase {
      expression: bm25(title) + bm25(description)
    }
    second-phase {
      expression: 0.5 * firstPhase + 0.3 * closeness(field, text_embedding) + 0.2 * attribute(trend_score)
    }
  }

  rank-profile image_similarity {
    inputs {
      query(img_query) tensor<float>(x[768])
    }
    first-phase {
      expression: closeness(field, image_embedding)
    }
  }
}
```

## 3. Policy Rule DSL

JSON DSL trong column `policies.rule_dsl`:

```json
{
  "when": {
    "event_type": "ProductDraftSubmitted",
    "conditions": [
      { "path": "$.payload.price", "op": ">", "value_from": "$.context.avg_market_price * 1.2" }
    ]
  },
  "then": {
    "action_type": "SUGGEST_PRICE",
    "template": {
      "title": "Giá đề xuất quá cao",
      "current_price": "{{payload.price}}",
      "suggested_range": {
        "min": "{{context.avg_market_price * 0.9}}",
        "max": "{{context.avg_market_price * 1.1}}"
      },
      "rationale": "Giá thị trường trung bình {{context.avg_market_price}} VND"
    },
    "expires_in_seconds": 3600
  }
}
```

**Supported `op`:** `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `contains`, `matches` (regex)
**Path syntax:** JSONPath subset, no wildcards yet.

## 4. Mock Policies (seed data)

| Code | Event | Condition | Action |
|---|---|---|---|
| `PRICE_TOO_HIGH_v1` | `ProductDraftSubmitted` | `price > market_avg * 1.2` | `SUGGEST_PRICE` |
| `WEAK_SEARCHABILITY_v1` | `ProductDraftSubmitted` | `missing_attrs >= 2` | `SUGGEST_ATTRS` |
| `TREND_FADING_v1` | `ProductDraftSubmitted` | `trend_score < 0.3` | `SUGGEST_ALTERNATIVES` |
| `LOW_STOCK_HOT_v1` | `StockChanged` | `stock < 10 AND trend_score > 0.7` | `SUGGEST_CREDIT_LOAN` |
| `SLOW_MOVING_v1` | `DailyStockReview` | `days_no_sale > 14` | `SUGGEST_PROMOTION` |
| `MARKET_RISING_v1`  | `ProductDraftSubmitted` | `market_trend.delta_pct > 30 AND market_trend.trajectory = 'rising'`  | `SUGGEST_STOCK_UP`        |
| `MARKET_FALLING_v1` | `ProductDraftSubmitted` | `market_trend.delta_pct < -20 AND market_trend.trajectory = 'falling'` | `SUGGEST_WAIT_OR_REDUCE`  |

## 5. Redis Key Patterns

```
# Sessions
session:{jti}                 → user_id (TTL = JWT exp)

# Idempotency
idem:lock:{user_id}:{key}     → "1" (TTL 30s)
idem:cache:{user_id}:{key}    → JSON response (TTL 24h)

# Cart (hash)
cart:{user_id}                → HASH { sku_1: qty, sku_2: qty, ... } (TTL 7d)
cart:meta:{user_id}           → JSON { updated_at, total_estimate }

# Intent state (LangGraph checkpoints, optional)
intent:{user_id}:{session_id} → JSON state (TTL 1h)

# Rate limiting (Phase 2+)
rl:{user_id}:{window}         → INT counter (TTL = window)

# Streaming buffers
stream:{request_id}           → LIST of SSE events (TTL 5min, for replay)

# Aggregator state (Phase 05)
aggregator:last_run           → ISO timestamp
aggregator:counters:{pid}     → JSON {impressions_7d, clicks_7d, ...} (TTL 1d)
```

## 6. Kafka Topics

| Topic | Partitions | Producer | Consumers |
|---|---|---|---|
| `icp.products.imported` | 3 | Gateway | card-generator, audit-logger |
| `icp.products.events` | 3 | Gateway/AI | card-generator, audit-logger |
| `icp.orders.placed` | 6 | Gateway | payment-consumer, inventory-consumer, notification-consumer |
| `icp.payments.completed` | 3 | payment-consumer | inventory-consumer, audit-logger |
| `icp.payments.failed` | 3 | payment-consumer | inventory-consumer (compensate), audit-logger |
| `icp.inventory.changed` | 3 | inventory-consumer | card-generator |
| `icp.user.activity` | 3 | Gateway | audit-logger |
| `icp.behavior.events` | 6 | Gateway /track + workers | behavior-pg-sink, behavior-aggregator (P05) |

**Key strategy:** Domain topics keyed by `aggregate_id`. Behavior topic keyed by `user_id` để các events của 1 user xử lý theo thứ tự.

**Trace propagation:** Mọi producer inject `traceparent` header, consumer extract — xem `06_OBSERVABILITY.md` section 10.

## 7. Event Payload Schemas (TypeScript types)

```ts
// packages/shared-types/src/events.ts

export type EventEnvelope<T extends string, P> = {
  event_id: string;
  event_type: T;
  aggregate_type: string;
  aggregate_id: string;
  user_id?: string;
  occurred_at: string; // ISO
  payload: P;
};

export type ProductDraftSubmitted = EventEnvelope<'ProductDraftSubmitted', {
  product_id: string;
  merchant_id: string;
  title: string;
  category: string;
  price: number;
  attributes: Record<string, unknown>;
  market_trend: {                         // ← THÊM
    current_score: number;                //   0-100
    delta_pct: number;                    //   % change
    trajectory: 'rising' | 'stable' | 'falling';
    related_rising: string[];             //   max 5 keywords
  } | null;                               //   null nếu MCP timeout/unavailable
}>;

export type ProductImported = EventEnvelope<'ProductImported', {
  product_id: string;
  merchant_id: string;
  initial_stock: number;
  price: number;
}>;

export type OrderPlaced = EventEnvelope<'OrderPlaced', {
  order_id: string;
  user_id: string;
  total: number;
  items: { product_id: string; qty: number; unit_price: number }[];
  idempotency_key: string;
}>;

export type PaymentCompleted = EventEnvelope<'PaymentCompleted', {
  order_id: string;
  transaction_id: string;
  amount: number;
}>;

export type PaymentFailed = EventEnvelope<'PaymentFailed', {
  order_id: string;
  reason: string;
}>;

// Tiếp tục cho 8 intent...
```

Mọi service publish/consume PHẢI dùng types từ `packages/shared-types`.

## 8. Migration Strategy

- Dùng Flyway hoặc node-pg-migrate, file `infra/migrations/V001__init.sql`, ...
- Mỗi PR thêm migration mới phải có `down.sql` rollback (best effort)
- Seed data tách riêng vào `infra/seed/`, chạy sau migrate

## 9. ID Strategy

- UUID v4 cho mọi PK (gen ở DB layer)
- Idempotency-Key, JWT JTI: UUID v4 client-generated
- Không expose internal sequence IDs

## 10. Soft Delete vs Hard Delete

Hackathon scope: **không có soft delete**. Status fields đủ (`status='archived'`). Đơn giản hoá queries.

## X. Mock External Reference Data — Shopee Prices

> **Migration:** V008
> **ADR reference:** ADR-032 (supersedes ADR-008 JSON file approach)
> **Date added:** 2026-05-18
> **Seeded by:** `apps/workers/src/shopee-mock-seed-worker.ts` (idempotent startup worker)
> **Real crawler:** OUT OF SCOPE for ICP project — handled by a separate project

### Purpose

Cung cấp data reference cho **Intent 01 (Import by Image)** UI:
- **State B (compact card):** aggregate price range (min/avg/max) cho category + attributes match
- **State D (expanded panel):** 5 sample products với store name, rating, sold count

### DDL

```sql
CREATE TABLE shopee_prices_mock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorization (query key)
  category      VARCHAR(100) NOT NULL,
  attributes    JSONB NOT NULL DEFAULT '{}',
    -- {brand?: string, size?: string, variant?: string}

  -- Aggregates (state B)
  min_price     BIGINT NOT NULL CHECK (min_price >= 0),
  avg_price     BIGINT NOT NULL CHECK (avg_price >= min_price),
  max_price     BIGINT NOT NULL CHECK (max_price >= avg_price),
  sample_count  INT    NOT NULL CHECK (sample_count > 0),
  review_count  INT    NOT NULL DEFAULT 0,

  -- Samples for state D expanded panel (display-only JSONB)
  samples       JSONB NOT NULL DEFAULT '[]',
    -- [
    --   {
    --     "title": string,
    --     "store": string,
    --     "price": int,
    --     "rating": float | null,
    --     "sold_count": int
    --   }, ...
    -- ]

  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (category, attributes)
);

CREATE INDEX idx_shopee_category ON shopee_prices_mock(category);
CREATE INDEX idx_shopee_attrs ON shopee_prices_mock USING GIN (attributes);
```

### Query patterns

**Pattern 1 — Match by category + brand attribute (MCP `shopee.price_range` hot path):**

```sql
SELECT min_price, avg_price, max_price, sample_count, review_count, samples, updated_at
FROM shopee_prices_mock
WHERE category = $1 AND attributes @> $2::jsonb
ORDER BY updated_at DESC
LIMIT 1;
```

Args: `$1 = 'nuoc_tuong'`, `$2 = '{"brand":"Maggi","size":"200ml"}'`

**Pattern 2 — Fallback by category only (when no attribute match):**

```sql
SELECT min_price, avg_price, max_price, sample_count, review_count, samples, updated_at
FROM shopee_prices_mock
WHERE category = $1
ORDER BY updated_at DESC
LIMIT 1;
```

### Seed worker behavior

`apps/workers/src/shopee-mock-seed-worker.ts` (implement ở slice S-07):

1. Run once at startup
2. Check `SELECT COUNT(*) FROM shopee_prices_mock` → nếu > 0, skip seed
3. Insert ~200 rows covering 10 categories × ~20 attribute combos
4. Use `ON CONFLICT (category, attributes) DO NOTHING` for idempotency
5. Log `shopee.mock.seeded` với rows_inserted

### Sample data shape (1 row example)

```json
{
  "category": "nuoc_tuong",
  "attributes": {"brand": "Maggi", "size": "200ml"},
  "min_price": 22000,
  "avg_price": 24500,
  "max_price": 28000,
  "sample_count": 5,
  "review_count": 1247,
  "samples": [
    {"title": "Nước tương Maggi đậu nành nguyên chất 200ml", "store": "Maggi Official", "price": 22000, "rating": 4.9, "sold_count": 8500},
    {"title": "Maggi nước tương đậu nành chai 200ml", "store": "SiêuThị Online", "price": 24000, "rating": 4.7, "sold_count": 3200},
    {"title": "Nước tương Maggi cao cấp 200ml + tặng kèm", "store": "Premium Store", "price": 26000, "rating": 4.8, "sold_count": 1500},
    {"title": "Maggi nước tương đậu nành 200ml combo 3 chai", "store": "Vinmart+", "price": 28000, "rating": 5.0, "sold_count": 920}
  ]
}
```

### Cross-references

- MCP tool spec: `01_ARCHITECTURE.md` Section 6 `shopee.price_range`
- Mockup: `mockups/intent-01/intent-01-state-B-prefilled.html` + `intent-01-state-D-shopee-expanded.html`
- Decision: `DECISIONS.md` ADR-032 (supersedes ADR-008)
- Migration: `infra/migrations/V008__shopee_prices_mock.sql`
- Seed worker: `apps/workers/src/shopee-mock-seed-worker.ts` (slice S-07)
- TypeScript Zod schema: `packages/shared-types/src/shopee.ts` (slice S-07)

---

**END OF DATA MODEL DOC.**
