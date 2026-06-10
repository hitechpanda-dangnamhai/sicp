# 07 — Behavior Logs (Recommendation & Analytics Data)

> **Load khi:** code event tracking, Vespa learn-to-rank, collaborative filter, hoặc analytics. Đây là loại log **khác** với operational logs (`06_OBSERVABILITY.md`).

<!-- PRODUCTION RECONCILE (2026-06-09, verified DB trực tiếp + code):
§5 DDL behavior_events KHỚP DB 100% (14 cột: event_id,event_type,occurred_at,received_at,user_id,
session_id,device_id,intent,modality,request_id,subject_type,subject_id,properties,app_version;
PK (event_id,occurred_at); partitioned). Event Zod schemas THẬT ở packages/shared-types/src/behavior/*.ts
(auth/cart/import/nav/recommend/search/error-events + catalog.ts + tracker.ts) + api TrackBatchDto/TrackerService.
CHƯA CODE: worker behavior-aggregator (apps/workers/src chỉ có index.ts + shopee-mock-seed-worker.ts);
tenant_id trên behavior_events (multi-tenant ADR-040). Vespa signal fields (§6.1) CÓ thật trong product.sd. -->

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

> **Verified vs DB (2026-06-09):** `behavior_events` thật có 14 cột = các field trên TRỪ `user_agent`/`ip_hash` (2 field này KHÔNG là cột riêng — lưu trong `properties` hoặc không persist). **`tenant_id` CHƯA CODE** (production multi-tenant ADR-040 sẽ thêm cột + scope).

## 3. Event Type Catalog (LOCKED, append-only)

> **CODE (verified):** schema Zod thật ở `packages/shared-types/src/behavior/*.ts` — `auth-events`, `search-events`, `nav-events`, `import-events`, `cart-events`, `recommend-events`, `error-events`, gom ở `catalog.ts` (+ `tracker.ts` SDK). Batch DTO: `api/models/TrackBatchDto.ts`. Catalog dưới đây phải khớp các file này.

Mỗi event type có **fixed properties schema**. Vi phạm = invalid event, dropped.

> **✅ IMPLEMENTED (verified `catalog.ts` 2026-06-09) — 31 event:** auth(signed_in/signed_out/password_reset_requested) · card(accepted/rejected/shown) · cart(cleared/item_added/item_removed/promo_applied/promo_removed/qty_changed/viewed) · error.report_requested · intent.first_card_emitted · nav(settings_section_opened/tile_clicked) · product(import_abandoned/import_completed/import_started/viewed) · recommendation(clicked/dismissed/shown) · search(first_card_rendered/followup_filter_tapped/result_clicked/suggested_chip_tapped/typo_corrected/variant_degraded) · session.started.
> 🟡 **CHƯA CODE (designed, chưa trong catalog.ts — GIỮ làm telemetry target):** session.ended, search.performed, search.result_impressed, search.result_dismissed, product.zoomed, product.shared, checkout.started, checkout.completed, checkout.failed, checkout.cancelled. (checkout.* gắn payment Intent06 CHƯA CODE; search.performed/result_impressed/result_dismissed = impression/CTR; session.ended/product.zoomed/shared = engagement.) **+ `card.expired`, `analytics.queried`, `analytics.chart_viewed`** (ở §3.5/§3.6 — KHÔNG trong catalog.ts, designed). Các bảng §3.x dưới gồm cả implemented + designed — phần CHƯA CODE đánh dấu 🟡 inline.

### 3.1 Auth & Session
| Type | Properties |
|---|---|
| `session.started` | `{ source: 'web'|'mobile' }` |
| `session.ended` | `{ duration_seconds }` |
| `auth.signed_in` | `{ method: 'password' }` |
| `auth.signed_out` | `{}` |
| `auth.password_reset_requested` | `{ email_hash }` — verified catalog.ts (forgot-password) |

### 3.2 Discovery (CRITICAL cho recommendation)
| Type | Properties |
|---|---|
| `search.performed` | `{ query: string, filters: object, modality, result_count, mode?: 'ai_augmented'\|'basic_fallback' }` — `mode` field NEW S-04 per D-S04-03 LAW |
| `search.result_impressed` | `{ query, product_id, position: int, rank_profile }` |
| `search.result_clicked` | `{ query, product_id, position, dwell_ms_before_click? }` |
| `search.result_dismissed` | `{ query, product_id, position }` — user scrolled past |
| `recommendation.shown` | `{ source: 'image'\|'product_page'\|'cart', seed_product_id?, products: [{id, position, reason}] }` |
| `recommendation.clicked` | `{ source, product_id, position }` |
| `recommendation.dismissed` | `{ source, product_id, position }` — verified catalog.ts |
| `search.suggested_chip_tapped` | (**NEW S-04 per D-S04-07 LAW**) `{ query: string, chip_label: string, chip_position: int }` — pre-query welcome SuggestedQueryChips tap (mockup intent-03B-state-0-happy.html SuggestedQueryChips synthesized molecule, 3 WOW demo chips per D-S04-12 LAW). |
| `search.followup_filter_tapped` | (**NEW S-04 per D-S04-08 LAW**) `{ query: string, filter_label: string, filter_position: int }` — Variant A AI followup chip tap (mockup intent-03A-state-F-refine.html FollowupFilterChips). |
| `search.typo_corrected` | (**NEW S-04 per D-S04-13 LAW Pattern A**) `{ request_id: string, original_query: string, corrected_query: string, confidence: number, user_choice: 'accept'\|'reject', attempt_n: int }` — FE emits when user taps "Đúng rồi" / "Không, em tìm '...'" button in typo_suggestion SSE event UX (mockup intent-03B-state-F-typo.html line 160-162). Pairs with ops log `intent.resumed` resume_choice=accept\|reject. |
| `search.variant_degraded` | (**NEW S-04 per D-S04-03 LAW** + D-S04-13 LAW Pattern A) `{ request_id: string, from: 'ai_augmented', to: 'basic_fallback', reason: 'llm_timeout'\|'llm_error'\|'user_explicit', error_code?: string, trace_id?: string, user_choice: 'retry_ai'\|'continue_basic', attempt_n: int }` — FE emits when user taps "Thử lại với AI" / "Dùng bản cơ bản" in variant_degraded SSE event UX (mockup intent-03B-state-C-error.html lines 169-173). Pairs with ops logs `intent.degraded` + `intent.resumed`. |
| `search.first_card_rendered` | (**NEW Sx04-4 per D-S04-14 LAW Adaptive Progressive Streaming**) `{ request_id: string, time_to_first_card_ms: int, total_cards_expected: int, mode: 'ai_augmented'\|'basic_fallback' }` — FE emits at exact moment FIRST Product Card paints after first `product_ready` SSE event arrives (per-product progressive streaming). Pairs with ops log `intent.first_card_emitted` (AI-side). Critical perceived-latency telemetry: p50/p95 time-to-first-card measurable in Grafana via `SELECT percentile_cont(0.50/0.95) FROM behavior_logs WHERE event_type='search.first_card_rendered' AND mode='ai_augmented'`. |

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
| `cart.promo_applied` | `{ code: string, discount_amount: int, subtotal_before: int, subtotal_after: int }` — **S-05 NEW Phiên Sx05-2 per D-S05-05 LAW**: emitted by Gateway POST /cart/promo when MCP fast-path exact-match `promo_codes.json` fixture lookup succeeds. LLM typo correction layer wired T03 (separate AI graph path; not MCP fast-path scope). |
| `cart.promo_removed` | `{ code: string }` — **S-05 NEW Phiên Sx05-2**: emitted by Gateway DELETE /cart/promo when user removes applied promo. |
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
| `card.expired` 🟡 | `{ card_id }` — **CHƯA CODE** (KHÔNG trong catalog.ts; designed target) |

### 3.6 Analytics Usage
| Type | Properties |
|---|---|
| `analytics.queried` 🟡 | `{ metric, dimension, range_months, modality }` — **CHƯA CODE** (KHÔNG trong catalog.ts; designed) |
| `analytics.chart_viewed` 🟡 | `{ chart_type, duration_seconds }` — **CHƯA CODE** (KHÔNG trong catalog.ts; designed) |

### 3.7 Navigation, Intent & Error (verified `catalog.ts` — doc cũ thiếu bảng)
| Type | Properties |
|---|---|
| `nav.tile_clicked` | `{ tile_id, destination }` |
| `nav.settings_section_opened` | `{ section }` |
| `intent.first_card_emitted` | `{ request_id, intent }` — pairs ops log cùng tên (perceived-latency) |
| `error.report_requested` | `{ error_code?, context? }` |

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
-- C16 Amendment (Phiên 8 2026-05-18 Path α): PRIMARY KEY composite
-- (event_id, occurred_at). Postgres requires PK on partitioned table
-- include partition key columns. See decisions-log.md C16.
CREATE TABLE behavior_events (
  event_id     UUID NOT NULL,
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
  
  app_version  VARCHAR(20),
  
  PRIMARY KEY (event_id, occurred_at)
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

> **Verified DB trực tiếp (2026-06-09):** DDL trên **khớp 100%** bảng `behavior_events` thật (14 cột, PK `(event_id, occurred_at)`, partitions `y2026m05/06/07`). **`tenant_id` CHƯA CODE** — production (ADR-040) thêm `tenant_id UUID` + index `(tenant_id, occurred_at)` + scope per-tenant.
> Production: auto-partition (pg_partman hoặc job tạo partition theo tháng) thay cho tạo tay. *(Bỏ nhãn "Hackathon".)*

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
      query(text_query) tensor<float>(x[512])
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

> ⚠️ **CHƯA CODE (verified 2026-06-09):** `apps/workers/src/` thật chỉ có `index.ts` + `shopee-mock-seed-worker.ts` — **chưa có `behavior-aggregator.ts`**. Logic dưới đây là spec target. (Vespa signal fields ở §6.1 thì ĐÃ có trong `product.sd`; chỉ thiếu worker populate.)

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

Pattern này = streaming aggregation. Tradeoff: write rate Vespa cao. Mặc định: batch 5-min (real-time increment là optional).

### 6.4 Analytics matviews V006 + Co-purchase (VERIFIED DB + code 2026-06-09)

**V006 đã tạo 3 materialized view (sales aggregations, `WHERE status='paid'`, tz `Asia/Ho_Chi_Minh`) — verified `pg_matviews`:**
- `analytics_daily(merchant_id, day, orders_count, revenue, unique_customers, avg_order_value, items_sold)` — `merchant_id = orders.user_id`. Đọc bởi MCP `analytics.aggregate` / `analytics.suggest_loan`.
- `analytics_daily_category(merchant_id, day, category, orders_count, qty_sold, revenue, distinct_products)` — `merchant_id = products.merchant_id`. ⚠️ Comment code `analytics.py`: matview này **over-count** order của buyer khác → tool category-level cố ý query **raw** `order_items JOIN orders` thay vì đọc matview.
- `analytics_product_performance(merchant_id, product_id, title, category, qty_7d, revenue_7d, qty_30d, revenue_30d)` — `WHERE products.status='active'`.

**Co-purchase ("mua kèm", Intent 04) — HIỆN TẠI (code, VERIFIED):** MCP tool `analytics.co_purchased(category, limit=20)` tính **on-the-fly** từ `orders`+`order_items`+`products` (CTE `target_orders`, "PHASE_05 §C SQL verbatim"). KHÔNG đọc matview.

**Tối ưu TÙY CHỌN — precompute `co_purchase_matrix` (chưa cam kết):** ⚠️ tên này **KHÔNG xuất hiện ở bất kỳ đâu trong repo** (verified grep 2026-06-09) — đây chỉ là hướng tối ưu tiêu chuẩn, KHÔNG phải plan đã chốt. **Nên dùng khi:** `co_purchased` on-the-fly vượt ngưỡng latency p95 ở scale lớn → precompute cặp đồng-mua vào materialized view, refresh hằng giờ qua aggregator worker, rồi `co_purchased` đọc matview. Thiết kế tham khảo (product-level):

```sql
-- TÙY CHỌN, CHƯA CAM KẾT — không có ở code/plan repo (verified grep); chỉ build nếu cần precompute khi scale
CREATE MATERIALIZED VIEW co_purchase_matrix AS
WITH order_pairs AS (
  SELECT oi1.product_id AS product_a, oi2.product_id AS product_b,
         COUNT(DISTINCT oi1.order_id) AS co_count
  FROM order_items oi1
  JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
  GROUP BY oi1.product_id, oi2.product_id
  HAVING COUNT(DISTINCT oi1.order_id) >= 2
)
SELECT product_a, product_b, co_count,
       co_count::float / GREATEST(
         (SELECT COUNT(*) FROM order_items WHERE product_id = product_a),
         (SELECT COUNT(*) FROM order_items WHERE product_id = product_b)) AS jaccard_estimate
FROM order_pairs;
CREATE INDEX idx_copurchase_a ON co_purchase_matrix(product_a, co_count DESC);
-- refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY co_purchase_matrix; (aggregator worker, hằng giờ)
```

> ⚠️ CHƯA CODE: refresh job (`REFRESH MATERIALIZED VIEW CONCURRENTLY`) cho 3 matview V006 (+ matview tối ưu trên nếu build) do aggregator worker — `apps/workers/src` mới là skeleton.

## 7. Client SDK (Next.js)

> **CODE (verified):** SDK + types thật ở `packages/shared-types/src/behavior/tracker.ts` (dùng chung), gọi `POST /api/v1/track` (batch — `api/services/TrackerService.ts`, body `TrackBatchDto`). Production: chỉ gửi khi consent `behavior_tracking` granted (xem `03 §1.9`); thêm `tenant_id` khi multi-tenant.

```typescript
// packages/shared-types/src/behavior/tracker.ts (dùng bởi apps/web)
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
    mode?: 'ai_augmented' | 'basic_fallback';  // NEW S-04 per D-S04-03 LAW
  };
  'search.result_clicked': {
    query: string;
    product_id: string;
    position: number;
    dwell_ms_before_click?: number;
  };

  // ─── NEW S-04 events per D-S04-07/08/13 LAW + D-S04-03 LAW ───
  'search.suggested_chip_tapped': {     // D-S04-07 LAW
    query: string;
    chip_label: string;
    chip_position: number;
  };
  'search.followup_filter_tapped': {    // D-S04-08 LAW
    query: string;
    filter_label: string;
    filter_position: number;
  };
  'search.typo_corrected': {            // D-S04-13 LAW Pattern A
    request_id: string;
    original_query: string;
    corrected_query: string;
    confidence: number;
    user_choice: 'accept' | 'reject';
    attempt_n: number;
  };
  'search.variant_degraded': {          // D-S04-03 LAW + D-S04-13 LAW Pattern A
    request_id: string;
    from: 'ai_augmented';
    to: 'basic_fallback';
    reason: 'llm_timeout' | 'llm_error' | 'user_explicit';
    error_code?: string;
    trace_id?: string;
    user_choice: 'retry_ai' | 'continue_basic';
    attempt_n: number;
  };

  // ─── NEW Phiên Sx04-4 per D-S04-14 LAW Adaptive Progressive Streaming ───
  'search.first_card_rendered': {       // D-S04-14 LAW perceived-latency telemetry
    request_id: string;
    time_to_first_card_ms: number;
    total_cards_expected: number;
    mode: 'ai_augmented' | 'basic_fallback';
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

## 11. Storage Cost (ước tính)

- ~75 products (verified DB 2026-06-09) × 5 users × ~20 events/session × 5 sessions ≈ demo data (sizing estimate)
- Mỗi event ~500 bytes JSON → ~12.5MB
- Vô tư trong PG, không cần concern.

## 12. Phase Mapping

| Phase | What |
|---|---|
| **Phase 01** | Schema migration: `behavior_events` table, partition setup |
| **Phase 02** | Client tracker SDK skeleton, `/track` endpoint, server-side events từ auth + search |
| **Phase 03** | Events: product import flow, card shown/accepted/rejected |
| **Phase 04** | Events: cart actions, checkout, payment outcome; Vespa partial update for purchases |
| **Phase 05** | Aggregator worker (5min batch), refresh 3 analytics matviews (V006), behavior signals trong rank profile |
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
