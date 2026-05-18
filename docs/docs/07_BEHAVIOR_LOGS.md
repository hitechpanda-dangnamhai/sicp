# 07 — Behavior Logs (Recommendation & Analytics Data)

> **Load khi:** code event tracking, Vespa learn-to-rank, collaborative filter, hoặc analytics. Đây là loại log **khác** với operational logs (`06_OBSERVABILITY.md`).

## 1. Tại Sao Phải Tách Behavior Logs Khỏi Operational Logs?

| | Operational Logs | Behavior Logs |
|---|---|---|
| **Mục đích** | Debug, monitor health | Train ML, recommendation, analytics |
| **Schema** | Loose, nhiều fields | **Strict** canonical schema |
| **Volume** | Cao (noisy) | Vừa (chỉ user actions) |
| **Lifetime** | 7-30 ngày | **Forever** (training data) |
| **Trust level** | Best-effort | Source of truth |
| **Sampling** | OK sample 10% | **No sampling**, 100% capture |
| **Storage** | Loki (text search) | Postgres + Kafka + Vespa (queryable) |
| **PII** | Avoid | Pseudonymized user_id |

**Quy tắc vàng:** Behavior logs là **structured events**, không phải log statements. Code emit `BehaviorEvent` object qua dedicated tracker, không qua logger.

## 2. Behavior Event Schema (LOCKED)

```typescript
export type BehaviorEvent = {
  // Identity
  event_id: string;              // UUID, idempotency
  event_type: BehaviorEventType; // enum, see Section 3
  occurred_at: string;           // ISO 8601, client time
  received_at: string;           // server time
  
  // Actor
  user_id: string;               // pseudonymized, never email
  session_id: string;            // per browser session
  device_id?: string;            // stable across sessions
  
  // Context (denormalized — never depend on JOIN at query time)
  intent?: string;               // 'searching_by_text', 'buying_by_voices', ...
  modality?: 'text' | 'voice' | 'image';
  request_id?: string;           // links to operational trace
  
  // Subject (what was acted on)
  subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
  subject_id?: string;
  
  // Properties (event-specific payload, schema enforced per event_type)
  properties: Record<string, unknown>;
  
  // Tech
  user_agent?: string;
  ip_hash?: string;              // hashed, never raw
  app_version: string;
};
```

## 3. Event Type Catalog (LOCKED, append-only)

Mỗi event type có **fixed properties schema**. Vi phạm = invalid event, dropped.

### 3.1 Auth & Session
| Type | Properties |
|---|---|
| `session.started` | `{ source: 'web'|'mobile' }` |
| `session.ended` | `{ duration_seconds }` |
| `auth.signed_in` | `{ method: 'password' }` |
| `auth.signed_out` | `{}` |

### 3.2 Discovery (CRITICAL cho recommendation)
| Type | Properties |
|---|---|
| `search.performed` | `{ query: string, filters: object, modality, result_count }` |
| `search.result_impressed` | `{ query, product_id, position: int, rank_profile }` |
| `search.result_clicked` | `{ query, product_id, position, dwell_ms_before_click? }` |
| `search.result_dismissed` | `{ query, product_id, position }` — user scrolled past |
| `recommendation.shown` | `{ source: 'image'|'product_page'|'cart', seed_product_id?, products: [{id, position, reason}] }` |
| `recommendation.clicked` | `{ source, product_id, position }` |

### 3.3 Product Interaction
| Type | Properties |
|---|---|
| `product.viewed` | `{ product_id, source: 'search'|'reco'|'cart'|'direct', dwell_ms? }` |
| `product.zoomed` | `{ product_id }` — view image fullscreen |
| `product.shared` | `{ product_id, channel }` |

### 3.4 Cart & Checkout
| Type | Properties |
|---|---|
| `cart.item_added` | `{ product_id, qty, unit_price, source: 'search'|'reco'|'voice'|'direct', from_query? }` |
| `cart.item_removed` | `{ product_id, qty_removed }` |
| `cart.qty_changed` | `{ product_id, old_qty, new_qty }` |
| `cart.viewed` | `{ item_count, total }` |
| `cart.cleared` | `{}` |
| `checkout.started` | `{ items: [{product_id, qty, unit_price}], total }` |
| `checkout.completed` | `{ order_id, items, total }` |
| `checkout.failed` | `{ order_id, reason }` |
| `checkout.cancelled` | `{ order_id, stage: 'pending'|'processing' }` |

### 3.5 Merchant Actions
| Type | Properties |
|---|---|
| `product.import_started` | `{ source: 'image'|'voice'|'text' }` |
| `product.import_completed` | `{ product_id, category, price, was_prefilled: boolean }` |
| `product.import_abandoned` | `{ stage: 'form'|'cards' }` |
| `card.shown` | `{ card_id, action_type, event_id }` |
| `card.accepted` | `{ card_id, action_type, applied_value? }` |
| `card.rejected` | `{ card_id, action_type }` |
| `card.expired` | `{ card_id }` |

### 3.6 Analytics Usage
| Type | Properties |
|---|---|
| `analytics.queried` | `{ metric, dimension, range_months, modality }` |
| `analytics.chart_viewed` | `{ chart_type, duration_seconds }` |

## 4. Pipeline Architecture

```
┌──────────────────────────────────────────┐
│  Client (Next.js) — tracker.track(event) │
│  Buffer in memory, flush every 5s        │
└──────────────────┬───────────────────────┘
                   │ POST /track (batch)
                   ▼
┌──────────────────────────────────────────┐
│  Gateway /api/v1/track                   │
│  - Validate schema (zod per event_type)  │
│  - Enrich (received_at, ip_hash)         │
│  - Drop invalid (log to ops, not crash)  │
└──────────────────┬───────────────────────┘
                   │ Kafka produce
                   ▼
            icp.behavior.events
                   │
       ┌───────────┼───────────────┐
       ▼           ▼               ▼
┌──────────┐ ┌──────────┐ ┌────────────────┐
│ PG sink  │ │ Vespa    │ │ Aggregator     │
│ (raw)    │ │ sink     │ │ (1min windows) │
│          │ │ (per-doc │ │                │
│ all      │ │ counters)│ │ → trend_scores │
│ events   │ │          │ │ → top_products │
└──────────┘ └──────────┘ └────────────────┘
```

Server-side events (cart updates from voice, payment outcomes from workers) publish trực tiếp vào Kafka — không cần đi qua /track.

## 5. Postgres Sink Table

```sql
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
)
PARTITION BY RANGE (occurred_at);

-- Daily partitions
CREATE TABLE behavior_events_y2026m05 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_be_user_time   ON behavior_events (user_id, occurred_at DESC);
CREATE INDEX idx_be_type_time   ON behavior_events (event_type, occurred_at DESC);
CREATE INDEX idx_be_subject     ON behavior_events (subject_type, subject_id);
CREATE INDEX idx_be_properties  ON behavior_events USING GIN (properties);
```

Cho Hackathon: partition tay 1-2 tháng tới. Trong prod sẽ auto-partition.

## 6. Vespa Behavioral Signals (cho Learn-to-Rank)

Đây là phần **bạn hỏi** — đúng là Vespa cần behavior data để improve search/reco.

### 6.1 Per-product signal counters

Update product document trong Vespa với **counter fields**:

```
schema product {
  document product {
    # ... existing fields ...
    
    # Behavioral signals
    field impressions_7d type long  { indexing: attribute | summary }
    field clicks_7d      type long  { indexing: attribute | summary }
    field add_to_cart_7d type long  { indexing: attribute | summary }
    field purchases_7d   type long  { indexing: attribute | summary }
    field dismissals_7d  type long  { indexing: attribute | summary }
    
    field impressions_30d type long { indexing: attribute | summary }
    field clicks_30d     type long  { indexing: attribute | summary }
    field purchases_30d  type long  { indexing: attribute | summary }
    
    # Derived (updated by aggregator)
    field ctr_7d         type float { indexing: attribute }   # clicks/impressions
    field cvr_7d         type float { indexing: attribute }   # purchases/clicks
    field velocity_score type float { indexing: attribute }   # smoothed recent activity
    field trend_score    type float { indexing: attribute }   # composite for ranking
  }
  
  rank-profile hybrid_with_behavior {
    inputs {
      query(text_query) tensor<float>(x[768])
    }
    first-phase {
      expression: bm25(title) + bm25(description)
    }
    second-phase {
      expression {
        0.4 * firstPhase
        + 0.2 * closeness(field, text_embedding)
        + 0.15 * attribute(trend_score)
        + 0.15 * attribute(ctr_7d)
        + 0.10 * log10(attribute(purchases_30d) + 1)
      }
    }
  }
}
```

### 6.2 Aggregator Worker

`apps/workers/src/behavior-aggregator.ts`:

```
On schedule (every 5 min):
  1. Query Postgres for events since last_run:
     SELECT subject_id as product_id, event_type, count(*)
     FROM behavior_events
     WHERE subject_type = 'product'
       AND occurred_at > $last_run
     GROUP BY product_id, event_type
  
  2. Update in-memory counters (decay old data, add new)
  
  3. For each affected product:
     - Compute ctr_7d = clicks_7d / max(impressions_7d, 1)
     - Compute cvr_7d = purchases_7d / max(clicks_7d, 1)
     - Compute velocity_score = exponential smoothing of daily purchases
     - Compute trend_score = 0.3*ctr + 0.4*velocity + 0.3*recent_growth
  
  4. Bulk-update Vespa via /document/v1/<id>/update (PARTIAL UPDATE)
     - Send only changed fields
     - Vespa supports atomic increment via "operation": "increment"
```

### 6.3 Real-Time Increment (optional, Phase 06)

Cho event quan trọng (clicks, purchases) — Vespa partial update **ngay** thay vì đợi 5 min:

```
On Kafka event 'product.viewed':
  POST /document/v1/icp/product/docid/{product_id}
  {
    "fields": {
      "impressions_7d": { "increment": 1 }
    }
  }
```

Pattern này = streaming aggregation. Tradeoff: write rate Vespa cao. Hackathon: dùng batch 5-min.

### 6.4 Co-Purchase Matrix (cho Intent 04 Recommendation)

Trong Postgres, materialized view refreshed hourly:

```sql
CREATE MATERIALIZED VIEW co_purchase_matrix AS
WITH order_pairs AS (
  SELECT 
    oi1.product_id AS product_a,
    oi2.product_id AS product_b,
    COUNT(DISTINCT oi1.order_id) AS co_count
  FROM order_items oi1
  JOIN order_items oi2 ON oi1.order_id = oi2.order_id
  WHERE oi1.product_id < oi2.product_id   -- avoid duplicate pairs
  GROUP BY oi1.product_id, oi2.product_id
  HAVING COUNT(DISTINCT oi1.order_id) >= 2
)
SELECT product_a, product_b, co_count,
       co_count::float / GREATEST(
         (SELECT COUNT(*) FROM order_items WHERE product_id = product_a),
         (SELECT COUNT(*) FROM order_items WHERE product_id = product_b)
       ) AS jaccard_estimate
FROM order_pairs;

CREATE INDEX idx_copurchase_a ON co_purchase_matrix(product_a, co_count DESC);
CREATE INDEX idx_copurchase_b ON co_purchase_matrix(product_b, co_count DESC);

-- Refresh schedule (worker hourly)
REFRESH MATERIALIZED VIEW CONCURRENTLY co_purchase_matrix;
```

MCP tool `analytics.co_purchased(product_id)` query view này.

## 7. Client SDK (Next.js)

```typescript
// apps/web/src/lib/tracker.ts
class Tracker {
  private queue: BehaviorEvent[] = [];
  private flushInterval = 5000;
  
  track<T extends BehaviorEventType>(
    type: T,
    properties: PropertiesFor<T>,
    subject?: { type: string; id: string }
  ) {
    this.queue.push({
      event_id: uuidv4(),
      event_type: type,
      occurred_at: new Date().toISOString(),
      received_at: '',  // server fills
      user_id: this.currentUserId,
      session_id: this.sessionId,
      device_id: this.deviceId,
      subject_type: subject?.type,
      subject_id: subject?.id,
      properties,
      app_version: APP_VERSION,
    } as BehaviorEvent);
  }
  
  // Auto-flush every 5s, or on page unload
  flush() { /* POST /api/v1/track with batch */ }
}

export const tracker = new Tracker();
```

Usage:
```ts
// On product card click
tracker.track('search.result_clicked', {
  query: currentQuery,
  product_id: product.id,
  position: index,
}, { type: 'product', id: product.id });

// On checkout
tracker.track('checkout.completed', {
  order_id: order.id,
  items: order.items,
  total: order.total,
});
```

## 8. TypeScript Type Safety

`packages/shared-types/src/behavior.ts`:

```typescript
export type PropertiesMap = {
  'session.started': { source: 'web' | 'mobile' };
  'search.performed': {
    query: string;
    filters: Record<string, unknown>;
    modality: 'text' | 'voice' | 'image';
    result_count: number;
  };
  'search.result_clicked': {
    query: string;
    product_id: string;
    position: number;
    dwell_ms_before_click?: number;
  };
  // ... entire catalog
};

export type BehaviorEventType = keyof PropertiesMap;
export type PropertiesFor<T extends BehaviorEventType> = PropertiesMap[T];
```

→ `tracker.track('search.result_clicked', { query, ...})` compile error nếu thiếu field.

## 9. Privacy & Quality

### 9.1 PII Handling
- `user_id` luôn UUID, never email
- `ip_hash` = SHA256(ip + daily_salt), không raw IP
- Query string trong `search.performed.query` — chấp nhận, vì là input chính
- Tuyệt đối **không** log password, token, payment details

### 9.2 Bot Filtering
- Drop events có user_agent matching bot patterns
- Rate limit: max 1000 events / user / hour
- Drop events with `occurred_at` quá lệch (>1h future, >7d past)

### 9.3 Schema Drift Detection
- Validator strict trên `properties` per event_type (zod schema)
- Invalid event → drop + emit operational metric `icp.behavior.dropped` với reason label
- Schema thay đổi → bump `event_type` version: `search.performed.v2`

## 10. Use Cases trong Demo

### UC-A: Improve Search Ranking
Trong demo, sau khi seed 200 mock historical events:
- `velocity_score` của "Maggi" giảm vì impressions cao + clicks thấp + dismissals tăng
- Same search query 1 tuần sau → Chinsu lên top
- Showcase: "AI tự học từ behavior"

### UC-B: Cold Start Recommendation
Khách upload ảnh mới → co-purchase chưa có data → fallback pure visual similarity. Sau 10 orders mock → showcase blend visual + collab.

### UC-C: Merchant Insight
Analytics intent: "Tại sao Maggi giảm?" → narrative kéo data từ behavior_events:
- "Impressions giữ nguyên 1200/tháng, clicks giảm 40%"
- "Dismissal rate tăng từ 12% → 28%"
- "→ Suggested: review giá và title"

→ Đây là Action Card được generate **từ behavior data**, không phải static rules.

## 11. Storage Cost (Hackathon scope)

- 50 products × 5 users × ~20 events/user/session × 5 sessions = ~25K events demo data
- Mỗi event ~500 bytes JSON → ~12.5MB
- Vô tư trong PG, không cần concern.

## 12. Phase Mapping

| Phase | What |
|---|---|
| **Phase 01** | Schema migration: `behavior_events` table, partition setup |
| **Phase 02** | Client tracker SDK skeleton, `/track` endpoint, server-side events từ auth + search |
| **Phase 03** | Events: product import flow, card shown/accepted/rejected |
| **Phase 04** | Events: cart actions, checkout, payment outcome; Vespa partial update for purchases |
| **Phase 05** | Aggregator worker (5min batch), `co_purchase_matrix` refresh, behavior signals trong rank profile |
| **Phase 06** | Demo seed: 200 historical events spread across 6 months, dashboard cho behavior |

## 13. Anti-Patterns (Đừng làm)

```ts
// ❌ Track free-form
logger.info(`User clicked product`);

// ❌ Schema không enforced
tracker.track('user_did_something', { whatever: 'goes here' });

// ❌ Trộn ops log
logger.info({ event: 'product_clicked', ...});  // KHÔNG, đây là behavior event

// ❌ Track ở server cho UI event
// UI events track ở client. Server chỉ verify + persist.

// ❌ Sample behavior events
if (Math.random() < 0.1) tracker.track(...);  // KHÔNG, 100% capture

// ✅ Track right
tracker.track('search.result_clicked', {
  query, product_id, position
});
```

## 14. Cross-Reference với Domain Events

**Đừng nhầm:**
- `events` table (đã có ở `02_DATA_MODEL`) = **domain events** (ProductImported, OrderPlaced) — emitted by services, drive choreography
- `behavior_events` table = **user behavior** (clicked, viewed) — emitted by client, drives ML

Cả hai có thể link qua `request_id` để correlate "user clicked → resulted in order".

---

**END OF BEHAVIOR LOGS DOC.**
