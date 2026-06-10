# 02 — Data Model

> **Load khi:** code migrations, repositories, queries, Vespa schema. Đây là contract; thay đổi cần ghi `DECISIONS.md`.

<!--
============================================================================
PRODUCTION RECONCILE (2026-06-09) — Hackathon→Production pivot.
- Multi-tenant model #2 marketplace (ADR-040): tenant=shop; merchant/staff qua
  tenant_memberships; customer = account GLOBAL (KHÔNG tenant-scoped).
- Payment VNPay/Momo (ADR-038), Shopee crawl (ADR-039 supersedes ADR-032),
  GDPR (ADR-041), hash-chain audit (ADR-042), per-tenant learn-to-rank
  (ADR-043), per-tenant usage metering (ADR-044).
- Schema thật (verified migrations V001..V010): §1 base TRƯỚC ĐÂY thiếu
  `product_reviews` (V002) + `insights` (V003) → đã bổ sung vào §1.
- Thay đổi production gom ở §1.X (forward migrations V011 + V012) — append-only,
  KHÔNG viết lại V001..V010.
============================================================================
-->

## 1. Postgres Schema (DDL)

```sql
-- USERS
-- display_name NOT NULL locked S-03 Phiên 30 C-05 (mockup state-E greeting "Xin chào, {display_name}" requires)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('merchant', 'customer', 'admin')),
  display_name  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SESSIONS (JWT stateless + refresh token persistent)
-- refresh_token_hash + refresh_expires_at added V009 migration locked S-03 Phiên 30 C-02
-- (V version amended Phiên 31 C-10: original V002 collided existing V002__product_enrichment.sql)
-- per PHASE_02 §A "Refresh token random UUID, lưu hash trong sessions table, exp 30d"
CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti                 VARCHAR(64) UNIQUE NOT NULL,
  refresh_token_hash  VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 of refresh UUID v4
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,         -- access token (JWT) expiry, 24h
  refresh_expires_at  TIMESTAMPTZ NOT NULL,         -- refresh token expiry, 30d
  revoked_at          TIMESTAMPTZ
);
CREATE INDEX idx_sessions_jti                ON sessions(jti);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);

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
  image_url       VARCHAR(500),                          -- legacy column (future CDN URL); stays per V010 ADD-only migration
  image_data      TEXT,                                   -- NEW V010 (C-S07-B Option Β; ADR-01-01) — base64 inline image (image_url để dành cho CDN sau)
  vespa_doc_id    VARCHAR(100),
  trend_score     REAL DEFAULT 0,
  -- V002 product_enrichment (verified DB 2026-06-10 — rule b, DDL base cũ thiếu 7 cột dưới):
  brand           VARCHAR(100),               -- denorm brand (filter/display)
  original_price  BIGINT,                     -- giá gốc (strike-through khi giảm giá)
  rating_avg      REAL DEFAULT 0,             -- → idx_products_rating_avg
  rating_count    INT  DEFAULT 0,
  sold_count      INT  DEFAULT 0,             -- → idx_products_sold_count
  image_gradient  VARCHAR(50),                -- placeholder gradient (seed D-S04-11)
  icon_hint       VARCHAR(40),                -- icon hint theo category (seed D-S04-11)
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'draft')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);
-- Partial indexes (verified DB 2026-06-10 pg_dump, rule b — có trong DB, chưa có trong doc cũ):
CREATE INDEX idx_products_rating_avg ON products(rating_avg DESC) WHERE status='active' AND rating_count >= 3;
CREATE INDEX idx_products_sold_count ON products(sold_count DESC) WHERE status='active';

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
-- C13 Amendment (2026-05-18 Phiên 7): user_id + updated_at thêm vào base DDL.
-- Rationale: V005 index `idx_transactions_user_failed` (user_id) + backfill
-- `completed_at = updated_at` require 2 columns này tồn tại từ V001.
-- Denorm user_id (vs JOIN qua orders.user_id) hợp lý cho per-user failed-tx
-- query hot path. updated_at align với pattern mutable entity (orders/products).
-- See decisions-log.md C13 amendment.
CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      BIGINT NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  provider    VARCHAR(40) DEFAULT 'mock',
  external_id VARCHAR(100),
  -- V005 payment_metadata (verified DB 2026-06-10 pg_dump — rule b/d, DDL base cũ thiếu 5 cột + SAI nullable):
  payment_method  VARCHAR(40) NOT NULL DEFAULT 'mock',  -- DB: NOT NULL DEFAULT 'mock' + chk_payment_method; +vnpay = V011 🟡 CHƯA CODE
  failure_reason  TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',          -- DB: NOT NULL DEFAULT '{}' (doc cũ ghi nullable = SAI)
  provider_txn_id VARCHAR(120),               -- ID giao dịch phía provider
  completed_at    TIMESTAMPTZ,                -- thời điểm success/failed cuối (backfill = updated_at)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payment_method CHECK (payment_method IN ('mock','momo','zalopay','bank_transfer','cod'))
);
-- V005 index (verified DB 2026-06-10 pg_dump, rule b — doc cũ thiếu): per-user failed-tx hot path
CREATE INDEX idx_transactions_user_failed ON transactions(user_id, created_at DESC) WHERE status = 'failed';

-- BEHAVIOR_EVENTS (user behavior cho recommendation/analytics)
-- Chi tiết xem docs/07_BEHAVIOR_LOGS.md
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

-- PRODUCT_REVIEWS (V002 — verified purchase reviews)
CREATE TABLE product_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  order_id    UUID REFERENCES orders(id),         -- verified purchase
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id, order_id)          -- 1 review per purchase
);
CREATE INDEX idx_reviews_product ON product_reviews(product_id, created_at DESC);  -- rule b (verified DB 2026-06-10)
-- TRIGGER (verified DB 2026-06-10 pg_dump, rule b): mỗi INSERT/UPDATE/DELETE review tự cập nhật
-- products.rating_avg + rating_count qua function update_product_rating() (định nghĩa ở cuối §1).

-- INSIGHTS (V003 — AI-generated merchant insights / hero+action cards)
CREATE TABLE insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(60) NOT NULL,             -- REVENUE_DROP, STOCK_LOW, TREND_SHIFT, ...
  severity      VARCHAR(20) NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info', 'warning', 'critical')),
  label         VARCHAR(50) NOT NULL,
  title         TEXT NOT NULL,
  highlight     VARCHAR(50),
  description   TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  actions       JSONB NOT NULL DEFAULT '[]',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'viewed', 'acted', 'dismissed', 'expired')),
  expires_at    TIMESTAMPTZ NOT NULL,
  viewed_at     TIMESTAMPTZ,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes insights (verified DB 2026-06-10 pg_dump, rule b — doc cũ thiếu):
CREATE INDEX idx_insights_user_all     ON insights(user_id, status, created_at DESC);
CREATE INDEX idx_insights_user_pending ON insights(user_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_insights_dedup        ON insights(user_id, type, created_at DESC);

-- SCHEMA_MIGRATIONS (migration ledger — verified DB 2026-06-10, rule b; NGUỒN CHUẨN version migration)
-- Đã apply (8): V001,V002,V003,V005,V006,V008,V009,V010 (V004/V007 skip số) → max = V010.
CREATE TABLE schema_migrations (
  filename    VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)
);

-- DB FUNCTION + TRIGGER (verified DB 2026-06-10 pg_dump, rule b — doc cũ thiếu):
-- update_product_rating(): tự tính lại products.rating_avg/rating_count từ product_reviews.
CREATE FUNCTION update_product_rating() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products SET
    rating_avg   = (SELECT AVG(rating)::REAL FROM product_reviews WHERE product_id = NEW.product_id),
    rating_count = (SELECT COUNT(*)::INT  FROM product_reviews WHERE product_id = NEW.product_id),
    updated_at   = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_review_update_product
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ANALYTICS MATVIEWS V006 (verified DB 2026-06-10 pg_dump, full definition) — tất cả WHERE status='paid', tz Asia/Ho_Chi_Minh:
--  • analytics_daily: GROUP BY o.user_id (AS merchant_id), day → orders_count, revenue=sum(o.total),
--    unique_customers, avg_order_value, items_sold (subquery sum qty).
--    ⚠️ QUIRK (verified): orders KHÔNG có merchant_id thật; o.user_id = người MUA → "merchant_id" gán nhầm
--    + unique_customers luôn=1 (group by chính user_id). Sẽ fix ở multi-tenant ADR-040 (tenant-scoped analytics).
--  • analytics_daily_category: GROUP BY p.merchant_id, day, category → orders_count, qty_sold, revenue, distinct_products.
--  • analytics_product_performance: per product (p.status='active') → qty_7d, revenue_7d, qty_30d, revenue_30d
--    (CASE now()-interval 7/30 days). LEFT JOIN orders WHERE paid.
-- Co-purchase KHÔNG có matview, tính on-the-fly bởi MCP analytics.co_purchased (raw SQL). Chi tiết: 07_BEHAVIOR_LOGS.md §6.4.
-- Matview indexes + refresh (verified DB 2026-06-10 pg_dump, rule b): UNIQUE index BẮT BUỘC cho REFRESH CONCURRENTLY.
--   analytics_daily:               UNIQUE(merchant_id,day) + (day DESC)
--   analytics_daily_category:      UNIQUE(merchant_id,day,category) + (merchant_id,day,revenue DESC)
--   analytics_product_performance: UNIQUE(product_id) + (merchant_id,revenue_7d DESC)
-- refresh_analytics_aggregations(): SQL function REFRESH MATERIALIZED VIEW CONCURRENTLY cả 3 matview;
--   worker-analytics gọi mỗi giờ. ⚠️ Cả 3 matview tạo WITH NO DATA → phải REFRESH lần đầu trước khi query.
```

## 1.X Production Reconcile — Multi-tenant + Payment + GDPR + Wow (V011/V012)

> ⚠️ **🟡 CHƯA CODE — RE-VERIFIED DB trực tiếp 2026-06-10** (3 lệnh: `information_schema.columns` = 17 bảng + `schema_migrations` ledger + `pg_dump --schema-only`): DB thật **KHÔNG có** bất kỳ cột `tenant_id` nào, **KHÔNG có** các bảng `tenants/tenant_memberships/payment_callbacks/consent_records/data_subject_requests/data_retention_policies/audit_log/tenant_ranking_weights/usage_events/usage_daily`, và `transactions` **chưa có cột refund**. Migration đã apply (8): V001,V002,V003,V005,V006,V008,V009,V010 → **max = V010** (V004/V007 skip số). Toàn bộ V011/V012 dưới đây là **spec forward để tạo** (chưa tồn tại trong code/DB).
> Áp dụng pivot Production. Append-only forward migrations; **KHÔNG** viết lại V001..V010.
> Tenant model #2 marketplace (ADR-040): customer = account GLOBAL → `users`/`sessions` KHÔNG có `tenant_id`; `users.email` GIỮ global UNIQUE. Backfill `tenant_id` từ `products.merchant_id` → tenant tương ứng rồi mới `SET NOT NULL`.

### V011 — Multi-tenant + Payment + GDPR (`V011__multitenant_payment_gdpr.sql`)

```sql
-- ── Tenants (shop) + memberships (chỉ merchant/staff; customer global KHÔNG membership) ──
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(60) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX idx_memberships_user ON tenant_memberships(user_id);

-- ── tenant_id: NOT NULL (luôn thuộc 1 shop) — backfill rồi SET NOT NULL ──
ALTER TABLE products        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE orders          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE order_items     ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE transactions    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE action_cards    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE insights        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- ── tenant_id: NULLABLE (NULL = platform-level) ──
ALTER TABLE events          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);  -- NULL = platform event (vd UserRegistered)
ALTER TABLE policies        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);  -- NULL = global policy
ALTER TABLE behavior_events ADD COLUMN IF NOT EXISTS tenant_id UUID;                          -- partitioned: FK bỏ theo ràng buộc partition; NULL = platform

CREATE INDEX IF NOT EXISTS idx_products_tenant     ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant       ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cards_tenant        ON action_cards(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_tenant       ON events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_be_tenant_time      ON behavior_events(tenant_id, occurred_at DESC);

-- ── UNIQUE scoping theo tenant ──
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_idempotency_key_key;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_idem_key UNIQUE (tenant_id, idempotency_key);
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_code_key;
CREATE UNIQUE INDEX policies_tenant_code_key ON policies (tenant_id, code);                 -- per-tenant
CREATE UNIQUE INDEX policies_global_code_key ON policies (code) WHERE tenant_id IS NULL;     -- global override
-- users.email GIỮ global UNIQUE (model #2) — KHÔNG đổi.

-- ── Payment VNPay/Momo/ZaloPay (mở rộng transactions; provider/payment_method/provider_txn_id/metadata/completed_at đã có V001+V005) ──
-- payment_method enum (verified DB chk_payment_method 2026-06-10 pg_dump) = {mock, momo, zalopay, bank_transfer, cod}.
-- THÊM 'vnpay' (DB hiện THIẾU — ADR-038): online = momo|zalopay|vnpay; offline = cod|bank_transfer; mock = dev/test.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','success','failed','refunded'));
-- payment_method: thêm 'vnpay' vào CHECK (DB hiện = mock/momo/zalopay/bank_transfer/cod, thiếu vnpay)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_payment_method;
ALTER TABLE transactions ADD CONSTRAINT chk_payment_method
  CHECK (payment_method IN ('mock','momo','zalopay','vnpay','bank_transfer','cod'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','paid','failed','cancelled','refunded'));

-- payment_callbacks: audit IPN/callback (1 txn ↔ N callback) + verify signature + dedup
CREATE TABLE payment_callbacks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id),
  transaction_id UUID REFERENCES transactions(id),
  provider       VARCHAR(40) NOT NULL,            -- 'momo'|'zalopay'|'vnpay'|'bank_transfer'|'cod'
  provider_ref   VARCHAR(120),
  raw_payload    JSONB NOT NULL,
  signature_ok   BOOLEAN NOT NULL,
  dedup_key      VARCHAR(120) UNIQUE,             -- idempotency cho IPN gửi lặp
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pcb_txn ON payment_callbacks(transaction_id);

-- ── GDPR (ADR-041) ──
CREATE TABLE consent_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id      UUID REFERENCES tenants(id),       -- NULL = consent cấp platform
  purpose        VARCHAR(60) NOT NULL,              -- 'behavior_tracking'|'marketing'|...
  granted        BOOLEAN NOT NULL,
  policy_version VARCHAR(20) NOT NULL,
  granted_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_consent_user_purpose ON consent_records(user_id, purpose);

CREATE TABLE data_subject_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('access','erasure','portability','rectification')),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes        TEXT
);

CREATE TABLE data_retention_policies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type      VARCHAR(60) UNIQUE NOT NULL,       -- 'orders'|'behavior_events'|'audit_log'|...
  retention_days INT NOT NULL CHECK (retention_days > 0),
  action         VARCHAR(20) NOT NULL DEFAULT 'anonymize' CHECK (action IN ('anonymize','delete')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row-Level Security (ADR-040, isolation mặc định) ──
-- Mỗi connection (Gateway/MCP per-request): SET app.current_tenant = '<uuid>';
-- Áp cho mọi bảng tenant-scoped (vd products; tương tự orders/transactions/action_cards/product_reviews/insights):
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
-- Lưu ý: pool phải set GUC mỗi checkout; superuser/migration bypass RLS;
-- repo/port VẪN filter tenant_id (defense-in-depth).
```

### V012 — Wow features: audit hash-chain + LTR + usage metering (`V012__wow_audit_ltr_usage.sql`)

```sql
-- ① Hash-chain tamper-evident audit (ADR-042) — ghi bởi worker audit-logger
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),       -- NULL = platform chain
  seq           BIGINT NOT NULL,                   -- monotonic PER chain (tenant_id; NULL=platform)
  actor_user_id UUID REFERENCES users(id),
  action        VARCHAR(80) NOT NULL,              -- 'payment.succeeded'|'product.updated'|...
  target_type   VARCHAR(40),
  target_id     VARCHAR(64),
  payload       JSONB NOT NULL DEFAULT '{}',
  prev_hash     CHAR(64),                          -- NULL = genesis của chain
  hash          CHAR(64) NOT NULL,                 -- SHA256(prev_hash || canonical_json(core))
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, seq)                          -- thứ tự per-chain
);
CREATE INDEX idx_audit_tenant_seq ON audit_log(tenant_id, seq);
-- Verify integrity: re-compute hash theo seq; mọi sửa/xoá làm gãy chain.

-- ② Per-tenant learn-to-rank weights (ADR-043) — fit định kỳ từ behavior_events
CREATE TABLE tenant_ranking_weights (
  tenant_id     UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  weights       JSONB NOT NULL DEFAULT '{"w_text":0.5,"w_trend":0.2,"w_behavior":0.3}',
  model_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  fitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Vespa rank-profile `personalized` nhận query(w_text|w_trend|w_behavior) (xem §2);
-- Gateway/AI đọc weights theo tenant → inject vào YQL.

-- ③ Per-tenant usage metering (ADR-044) — billing SaaS
CREATE TABLE usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  metric      VARCHAR(40) NOT NULL,               -- 'ai_calls'|'searches'|'orders'|'storage_mb'
  quantity    BIGINT NOT NULL DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_usage_tenant_metric_time ON usage_events(tenant_id, metric, occurred_at);

CREATE TABLE usage_daily (
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  day         DATE NOT NULL,
  metric      VARCHAR(40) NOT NULL,
  total       BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day, metric)
);
```

## 2. Vespa Schema

File `infra/vespa/schemas/product.sd`:

```
schema product {

  document product {
    # === Core identity ===
    field id type string { indexing: attribute | summary }
    field merchant_id type string { indexing: attribute }
    # 🟡 CHƯA CODE — Production multi-tenant target (ADR-040): shop sở hữu product.
    #   product.sd THẬT (verified 2026-06-10) CHƯA có field này. Khi triển khai: filter
    #   mọi search theo tenant_id + per-shop ranking.
    # field tenant_id type string { indexing: attribute  attribute: fast-search }

    # === Searchable text (BM25 + embedding) ===
    field title type string {
      indexing: index | summary
      index: enable-bm25
    }
    field description type string {
      indexing: index | summary
      index: enable-bm25
    }

    # === Category + structured attrs ===
    field category type string {
      indexing: attribute | summary
      attribute: fast-search
    }
    field price type long { indexing: attribute | summary }
    field stock type int  { indexing: attribute | summary }
    # attributes: struct-field `attribute` trên key+value (Sx07-F-debug 2026-05-26) cho chip-filter
    # re-search YQL: attributes contains sameElement(key contains "size", value contains "500ml").
    # Vespa map<string,string> KHÔNG đặt `attribute` trực tiếp lên map — phải khai struct-field.
    field attributes type map<string, string> {
      indexing: summary
      struct-field key   { indexing: attribute }
      struct-field value { indexing: attribute }
    }

    # === Display fields (denormalized per ADR-024 — tránh FE JOIN Postgres sau search) ===
    field brand           type string { indexing: attribute | summary }
    field image_url       type string { indexing: summary }
    field original_price  type long   { indexing: attribute | summary }
    field rating_avg      type float  { indexing: attribute | summary }
    field rating_count    type int    { indexing: attribute | summary }
    field sold_count      type int    { indexing: attribute | summary }
    field image_gradient  type string { indexing: summary }
    field icon_hint       type string { indexing: summary }
    field status          type string { indexing: attribute }

    # image_description: text mô tả ảnh do vision.analyze sinh; là NGUỒN cho image_embedding
    # (vision.analyze → POST update field này → Vespa native embed indexing-time). S-09 cross-modal.
    field image_description type string { indexing: attribute | summary }

    # === Trend + temporal ===
    field trend_score type float { indexing: attribute | summary }
    field created_at  type long  { indexing: attribute }

    # === Behavioral signals (07_BEHAVIOR_LOGS §6.1; aggregator worker 5min Phase05,
    #     real-time partial-update on purchase Phase04) ===
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

  # === Synthetic embedding fields — NGOÀI document block (Vespa pattern: field có `embed`
  # indexing expression KHÔNG feed trực tiếp; derive từ document fields). ADR-036 LOCKED:
  # CLIP ViT-B/32 512-dim cho cả text + image (cùng vector space → cross-modal). C12 Option B:
  # embedding Vespa-only, Postgres KHÔNG có VECTOR column. C20: HNSW symmetric text↔image.
  # text_embedding auto-gen feed-time bởi native hugging-face-embedder `clip_multilingual` (services.xml §2.1);
  # query-time YQL embed(@query, clip_multilingual) → 512-dim trong container (tiết kiệm 1 RTT).
  field text_embedding type tensor<float>(x[512]) {
    indexing: input title . " " . input description | embed clip_multilingual | attribute | index
    attribute { distance-metric: angular }
    index { hnsw { max-links-per-node: 16  neighbors-to-explore-at-insert: 200 } }
  }

  # image_embedding: embed native indexing-time từ image_description (CLIP shared text+image space
  # → image query ↔ text doc). Backfill 2 bước: seed-product-images.ts (image_data) →
  # backfill-image-descriptions.ts (vision.analyze → image_description → POST update). S-09.
  field image_embedding type tensor<float>(x[512]) {
    indexing: input image_description | embed clip_multilingual | attribute | index
    attribute { distance-metric: angular }
    index { hnsw { max-links-per-node: 16  neighbors-to-explore-at-insert: 200 } }
  }

  # cross_encoder_tokens: pre-tokenize (title + description) feed-time qua huggingface-tokenizer
  # `cross_encoder_tokenizer` (services.xml), MAX 256 tokens — phục vụ rank-profile cross_encoder_rerank.
  field cross_encoder_tokens type tensor<float>(d0[256]) {
    indexing: input title . " " . input description | embed cross_encoder_tokenizer | attribute
  }

  # Fieldset BẮT BUỘC: thiếu thì YQL userQuery() không bind token vào BM25 field → 0 hits
  # (verified empirically). fieldset là schema-level element (peer rank-profile), KHÔNG trong document{}.
  fieldset default {
    fields: title, description
  }

  # === Rank profiles (S-04 D-S04-03 LAW: dual profile Adaptive Single Endpoint + Graceful Degradation) ===

  # baseline — Variant A fallback (BM25-only, no vector/trend; mode=basic_fallback).
  # Sx07-F-debug 2026-05-26: title 3x + phrase proximity → exact title match thắng scattered tokens.
  rank-profile baseline {
    first-phase {
      expression: 3.0 * bm25(title) + bm25(description) + 2.0 * fieldMatch(title).proximity
    }
    summary-features { bm25(title) bm25(description) fieldMatch(title).proximity }
  }

  # ai_augmented — Variant B default tier (BM25 + vector + trend; match_score badge FE).
  # Sx07-F-debug 2026-05-26 weights: 0.7 BM25 + 0.2 vector + 0.1 trend (vector/trend toned down để precision).
  # match_score + reason emitted INCREMENTALLY qua SSE `product_ready` per product (Sx04-4 D-S04-14);
  # reason LLM-gen tại generate_reasons node — KHÔNG lưu Vespa. Xem 03_API_CONTRACTS §3 + 04_INTENT_SPECS Intent03.
  rank-profile ai_augmented {
    inputs {
      query(query_embedding) tensor<float>(x[512])
    }
    first-phase {
      expression: 3.0 * bm25(title) + bm25(description) + 2.0 * fieldMatch(title).proximity
    }
    second-phase {
      expression: 0.7 * firstPhase + 0.2 * closeness(field, text_embedding) + 0.1 * attribute(trend_score)
    }
    summary-features { secondPhase bm25(title) bm25(description) closeness(field, text_embedding) fieldMatch(title).proximity }
  }

  # Backward-compat alias cho legacy `rank_profile=hybrid`; identical ai_augmented; remove sau S-04 + grep verify.
  rank-profile hybrid inherits ai_augmented {}

  # 🟡 CHƯA CODE — Per-tenant learn-to-rank target (ADR-043 Production).
  #   product.sd THẬT (verified 2026-06-10) CHỈ có 6 profile: baseline / ai_augmented / hybrid /
  #   image_similarity / image_recommendation / cross_encoder_rerank — KHÔNG có `personalized`,
  #   KHÔNG có query(w_*). Block dưới = target: weights học riêng từng shop từ behavior_events →
  #   Postgres tenant_ranking_weights; inject vào query mỗi request. KHÔNG thay ai_augmented (default/fallback).
  # rank-profile personalized inherits ai_augmented {
  #   inputs {
  #     query(query_embedding) tensor<float>(x[512])
  #     query(w_text) double  query(w_trend) double  query(w_behavior) double
  #   }
  #   second-phase {
  #     expression: query(w_text) * closeness(field, text_embedding)
  #               + query(w_trend) * attribute(trend_score)
  #               + query(w_behavior) * (attribute(ctr_7d) + attribute(velocity_score))
  #   }
  #   summary-features { secondPhase closeness(field, text_embedding) attribute(trend_score) }
  # }

  # image_similarity — ANN thuần trên image_embedding (img query vector). Giữ nguyên cho
  # forward-compat S-04 image search + S-08 voice-buy cross-modal reuse.
  rank-profile image_similarity {
    inputs {
      query(img_query) tensor<float>(x[512])
    }
    first-phase {
      expression: closeness(field, image_embedding)
    }
  }

  # image_recommendation (S-09 Sx09-C, C-S09-R Option B): song song image_similarity. Composite blend
  # ở Python blend_and_rank node (D-S09-NN-A: KHÔNG second-phase Vespa — sẽ bị Python ghi đè).
  rank-profile image_recommendation {
    inputs {
      query(query_embedding) tensor<float>(x[512])
    }
    first-phase {
      expression: closeness(field, image_embedding)
    }
    summary-features {
      closeness(field, image_embedding)
      attribute(trend_score)
    }
  }

  # ONNX cross-encoder rerank model (Sx07-F-debug 2026-05-26):
  # cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 (multilingual, 449MB). Output logits = score per (query,doc).
  onnx-model cross_encoder_rerank {
    file: models/cross_encoder_rerank/model.onnx
    input input_ids: input_ids
    input attention_mask: attention_mask
    output logits: logits
  }

  # cross_encoder_rerank — 3-phase: first/second-phase kế thừa ai_augmented + global-phase ONNX rerank top-30.
  rank-profile cross_encoder_rerank inherits ai_augmented {
    inputs {
      query(query_tokens) tensor<float>(d0[32])
      query(query_embedding) tensor<float>(x[512])
    }
    function input_ids() {
      expression: tokenInputIds(256, query(query_tokens), attribute(cross_encoder_tokens))
    }
    function attention_mask() {
      expression: tokenAttentionMask(256, query(query_tokens), attribute(cross_encoder_tokens))
    }
    function rerank_score() {
      expression: onnx(cross_encoder_rerank).logits{d0:0, d1:0}
    }
    global-phase {
      expression: rerank_score()
      rerank-count: 30
    }
    summary-features {
      rerank_score
      secondPhase
      bm25(title)
      closeness(field, text_embedding)
    }
  }
}
```

## 2.1 Vespa Embedder Component (D-S04-10 LAW Phiên Sx04-1)

**File `infra/vespa/services.xml`** (verified 2026-06-10) — cluster topology + 2 component trong
`<container>`: `clip_multilingual` (hugging-face-embedder) cho YQL `embed(@query, clip_multilingual)`
+ feed-time `embed` indexing expression; và `cross_encoder_tokenizer` (hugging-face-tokenizer) sinh
field `cross_encoder_tokens`. Single-node dev cluster (container + content + admin cùng alias `node0`,
redundancy=1; production sẽ redundancy≥2). Model binaries (`models/clip_multilingual/`,
`models/cross_encoder_rerank/`) KHÔNG commit git — đóng gói vào app zip qua `deploy.sh`.

```xml
<services version="1.0">
  <container id="default" version="1.0">
    <document-api/>
    <search/>

    <!-- D-S04-10 LAW: CLIP-ViT-B-32-multilingual-v1 (512-dim, Vietnamese-capable);
         shared image+text vector space → S-07 vision-buy cross-modal reuse. -->
    <component id="clip_multilingual" type="hugging-face-embedder">
      <transformer-model path="models/clip_multilingual/model.onnx"/>
      <tokenizer-model path="models/clip_multilingual/tokenizer.json"/>
      <max-tokens>256</max-tokens>
      <transformer-input-ids>input_ids</transformer-input-ids>
      <transformer-attention-mask>attention_mask</transformer-attention-mask>
      <!-- Sx04-2 reality fix: ONNX (optimum-cli library sentence_transformers) có 2 output:
           token_embeddings[batch,seq,768] + sentence_embedding[batch,512]. Vespa default chờ
           `last_hidden_state` (model không có) → lỗi. (1) transformer-output=sentence_embedding
           chọn output 512-d đã pre-pool. (2) pooling-strategy=none BẮT BUỘC cho output 2D
           (default `mean` chỉ chạy 3D). Xem hugging-face-embedder.def. -->
      <transformer-output>sentence_embedding</transformer-output>
      <pooling-strategy>none</pooling-strategy>
      <normalize>true</normalize>
    </component>

    <!-- Sx07-F-debug 2026-05-26: tokenize (title + description) feed-time → field
         cross_encoder_tokens; cùng tokenizer cho ONNX cross-encoder
         (cross-encoder/mmarco-mMiniLMv2-L12-H384-v1) ở rank-profile cross_encoder_rerank. -->
    <component id="cross_encoder_tokenizer" type="hugging-face-tokenizer">
      <model path="models/cross_encoder_rerank/tokenizer.json"/>
    </component>

    <nodes>
      <node hostalias="node0"/>
    </nodes>
  </container>

  <content id="products" version="1.0">
    <redundancy>1</redundancy>
    <documents>
      <document type="product" mode="index"/>
    </documents>
    <nodes>
      <node hostalias="node0" distribution-key="0"/>
    </nodes>
  </content>

  <admin version="2.0">
    <adminserver hostalias="node0"/>
  </admin>
</services>
```

**Model files** placed at `infra/vespa/models/clip_multilingual/`:
- `model.onnx` — CLIP ViT-B/32 multilingual text encoder, ONNX format, FP32
- `tokenizer.json` — XLMRoberta-style tokenizer (multilingual)

**Source:** `sentence-transformers/clip-ViT-B-32-multilingual-v1` exported via
`optimum-cli export onnx --task feature-extraction -m sentence-transformers/clip-ViT-B-32-multilingual-v1 infra/vespa/models/clip_multilingual/`.

**Indexing flow (seed-time):**
1. `infra/seed/seed.ts` insert products to Postgres (V001+V002 columns).
2. `infra/seed/vespa-feed.ts` (NEW) reads from Postgres, POSTs to Vespa
   `/document/v1/icp/product/docid/<id>` — Vespa schema indexing expression
   `input title . " " . input description | embed clip_multilingual | attribute | index`
   auto-generates text_embedding at feed time. Zero Python embedding code.

**Query flow (runtime):**
1. AI service receives text query, builds YQL:
   ```python
   yql = (
     "select * from product where "
     "({targetHits: 100}nearestNeighbor(text_embedding, query_embedding)) "
     "or ({grammar: 'weakAnd'}userInput(@query));"
   )
   query_body = {
     "yql": yql,
     "query": user_query,           # for weakAnd
     "input.query(query_embedding)": f"embed(clip_multilingual, @query)",
     "ranking.profile": "ai_augmented",
   }
   ```
2. Vespa internally invokes embedder once per query → 512-dim tensor → ANN
   search. No external embedding service needed.

**Performance (CPU FP32 baseline per Vespa blog Jan 2026):**
- Doc indexing: ~30ms/doc (seed-time only, ~75 docs total = product corpus, verified DB 2026-06-10)
- Query embedding: ~30ms/query
- Total query latency (embed + search + rank): ~60ms p95 for ~75-doc index

**Why this over `text.embed` MCP tool (C-S04-K retracted Phiên Sx04-1):**
- Saves 1 RTT (Python AI service → MCP HTTP → embedding lib → return vector → POST Vespa)
- Single source of truth (one model file, one container)
- Forward-compat S-07 vision (same CLIP shared space)
- Production-grade pattern (per Vespa engineering blog)

## 3. Policy Rule DSL

JSON DSL trong column `policies.rule_dsl`:

```json
{
  "trigger": "ProductDraftSubmitted",
  "condition": { "op": ">", "field": "price_vs_median_pct", "value": 20 },
  "action": { "type": "SUGGEST_PRICE", "template": "price_outlier_warn" }
}
```

**Re-verified vs DB `rule_dsl` (2026-06-10):** keys = `trigger` (event type) · `condition {op, field, value}` · `action {type, template}`.
- **`op` thật:** `>`, `<`, `>=` + composite **`lt_with_hot`** (LOW_STOCK_HOT, value = `{stock_max, trend_min}`).
- **`field`** = tên metric **phẳng** (vd `price_vs_median_pct`, `trend_delta_pct`, `missing_attrs_count`, `days_since_last_sale`, `stock_and_trend`) — **KHÔNG JSONPath**.
- **`value`** = number hoặc object (composite). **`action.template`** = **tên template string** (resolve ở card pipeline), KHÔNG phải inline object. KHÔNG có `expires_in_seconds` trong rule_dsl (expires_at set ở action_cards).

## 4. Mock Policies (seed data)

> **Re-verified DB 2026-06-10 — 7 policy, all enabled (`t`).** Bảng dưới phản ánh `rule_dsl` THẬT (đã thêm cột `prio` = `priority`, sort desc):

| Code | prio | trigger | condition (field op value) | action.type | template |
|---|---|---|---|---|---|
| `PRICE_TOO_HIGH_v1` | 100 | `ProductDraftSubmitted` | `price_vs_median_pct > 20` | `SUGGEST_PRICE` | `price_outlier_warn` |
| `WEAK_SEARCHABILITY_v1` | 95 | `ProductDraftSubmitted` | `missing_attrs_count >= 2` | `SUGGEST_ATTRS` | `weak_searchability_warn` |
| `LOW_STOCK_HOT_v1` | 90 | `StockChanged` | `stock_and_trend` (op `lt_with_hot`, `{stock_max:10, trend_min:0.7}`) | `SUGGEST_CREDIT_LOAN` | `low_stock_hot_warn` |
| `TREND_FADING_v1` | 80 | `ProductDraftSubmitted` | `trend_delta_pct < -10` | `SUGGEST_WAIT_OR_REDUCE` | `trend_fading_warn` |
| `MARKET_FALLING_v1` | 78 | `ProductDraftSubmitted` | `trend_delta_pct < -15` | `SUGGEST_WAIT_OR_REDUCE` | `market_falling_warn` |
| `MARKET_RISING_v1` | 75 | `ProductDraftSubmitted` | `trend_delta_pct > 15` | `SUGGEST_STOCK_UP` | `market_rising_opportunity` |
| `SLOW_MOVING_v1` | 70 | `DailyStockReview` | `days_since_last_sale >= 30` | `SUGGEST_PROMOTION` | `slow_moving_warn` |

> ⚠️ **action.type từ 7 policy `rule_dsl` (verified DB):** SUGGEST_PRICE · SUGGEST_ATTRS · SUGGEST_WAIT_OR_REDUCE (TREND_FADING + MARKET_FALLING) · SUGGEST_STOCK_UP · SUGGEST_CREDIT_LOAN · SUGGEST_PROMOTION. **TREND_FADING_v1 → `SUGGEST_WAIT_OR_REDUCE`** (doc cũ ghi `SUGGEST_ALTERNATIVES` = SAI cho policy này).
>
> **Tập action card type ĐẦY ĐỦ trong code (re-grep 2026-06-10, `apps/**` .ts/.tsx/.py — 7 loại):** `SUGGEST_PRICE`(12), `SUGGEST_PROMOTION`(8), `SUGGEST_ATTRS`(8), `SUGGEST_CREDIT_LOAN`(7), **`SUGGEST_ALTERNATIVES`**(7 refs — CÓ THẬT), `SUGGEST_STOCK_UP`(4), `SUGGEST_WAIT_OR_REDUCE`(3). `SUGGEST_ALTERNATIVES` **được sinh bởi import/create_cards path** (Intent 01, không phải 7 rule_dsl policy ở trên) + render FE — xem `PHASE_03 §ActionCard`.
> 3 literal `SUGGEST_*` còn lại KHÔNG phải action card type (config): `SUGGEST_PROMPT_TEMPLATE`, `SUGGEST_DEFAULT_TIMEOUT_S`, `SUGGEST_CHIPS`.

## 5. Redis Key Patterns

```
# Sessions
session:{jti}                 → user_id (TTL = JWT exp)

# Idempotency
idem:lock:{user_id}:{key}     → "1" (TTL 30s)
idem:cache:{user_id}:{key}    → JSON response (TTL 24h)

# ─────────────────────────────────────────────────────────────────────
# Cart — JSON snapshot per S-05 D-S05-02 LAW (REWRITE per C-S05-B resolution).
# Phiên Sx05-2 atomic batch reconcile (CLOSE Phase 2 spec sync).
# Schema source-of-truth: `packages/shared-types/src/cart.ts` (T01 ship 2026-05-25).
# Old HASH pattern (`cart:{uid}` HASH of sku→qty) DEPRECATED — single JSON
# key holds full Cart shape with per-item snapshot (title, brand, image_gradient,
# unit_price persisted at add time) for FE optimistic UI + S-04 add_to_cart
# precedent consistency.
# See: S-05_decisions-log.md Section 1 D-S05-02 LAW + Section 2 C-S05-B.
# ─────────────────────────────────────────────────────────────────────
# Cart (JSON snapshot — 1 key per user)
cart:{user_id}                → JSON Cart (TTL 7d, refresh_on_read=True)
                                # Schema source-of-truth: packages/shared-types/src/cart.ts (verified 2026-06-10)
                                {
                                  user_id: UUID,
                                  items: [
                                    {
                                      product_id: UUID,
                                      qty: int (1..99),
                                      unit_price: int (VND),
                                      added_at: ISO8601,
                                      snapshot: {
                                        title: str,
                                        brand: str | null,
                                        image_url: str | null,
                                        image_gradient: str | null,   # "#FEF3C7,#FCD34D"
                                        icon_hint: str | null,         # "i-bottle"
                                        original_price: int | null
                                      },
                                      in_stock: bool,                  # BE live re-query (ADR-05-02 stock exception)
                                      available_stock: int | null
                                    }
                                  ],
                                  updated_at: ISO8601,
                                  totals: { subtotal: int, discount: int, shipping: int, total: int },
                                  promo: null | { code: str, label: str, discount_amount: int },
                                  free_gift_hint: null | { threshold: int, progress: int, gift_label: str },
                                  pending_interrupts: null | {  # D-S05-02 Pattern A interrupt-aware
                                    clear_confirm_rid: str | null,
                                    stock_issue_rid: str | null,
                                    stock_issue_product_ids: str[] | null
                                  },
                                  last_action_rid: str | null
                                }
cart:{user_id}:lock           → "1" (TTL 5s) — atomic mutex per write op

# Intent state — LangGraph checkpointer (S-04 T02 D-S04-13 LAW)
# RedisSaver thread_id = request_id (AI service authoritative per Q-Sx04-3-6
# Option A LAW). TTL 30 minutes + refresh_on_read=True (Strategy β LAW per
# Q-Sx04-3-9). Explicit adelete_thread(rid) on `final` event = fast-path
# cleanup. Underlying Redis keys created by langgraph-checkpoint-redis package
# (multiple keys per checkpoint — see RedisSaver internal schema).
intent:checkpoint:{request_id}        → LangGraph state checkpoint
                                         (TTL 30min, refresh_on_read=True)

# Intent payload cache — Gateway /stream auth check (verified code 2026-06-10:
# `INTENT_CACHE_PREFIX = 'intent:cache:'` ở gateway intent.service.ts; ai.client.ts cache
# intent payload tại đây cho /stream auth gate). rule b — code @see §5 key này nhưng doc cũ thiếu.
intent:cache:{request_id}             → JSON intent payload (TTL 60s)

# Action endpoint Idempotency-Key dedup (S-04 T02+T03 D-S04-13 LAW)
# POST /intent/{request_id}/action body includes _meta.attempt_n for retry
# distinct-key per attempt. Gateway Idempotency-Key middleware locks per
# attempt to prevent double-action on rapid taps.
intent:action:{request_id}:{attempt_n} → JSON {choice, value} (TTL 5min)

# SSE pub/sub channel — Option Z architecture (S-04 T02+T03 D-S04-13 LAW)
# AI service Python: redis.publish(`sse:pubsub:{rid}`, event_json)
# Gateway NestJS: ioredis.duplicate().subscribe(`sse:pubsub:{rid}`) inside
# /intent/stream handler → forward each message to FE EventSource. Pub/sub
# is ephemeral (no TTL, no buffer — fire-and-forget). On `final` event:
# Gateway closes connection + AI service publishes terminal event.
# Forward-compat: S-08 voice partial transcript chunks reuse same channel.
sse:pubsub:{request_id}        → ephemeral channel (no TTL — pub/sub model)

# Legacy intent state — DEPRECATED Phiên Sx04-3 per D-S04-13 LAW
# REPLACED by `intent:checkpoint:{request_id}` above. Kept here for
# documentation lineage only; no T02+ code reads/writes this key.
# intent:{user_id}:{session_id} → JSON state (TTL 1h)  [DEPRECATED]

# Rate limiting — 🟡 CHƯA CODE (re-verified 2026-06-10: chưa có key `rl:` Redis thật trong code; Phase 2+)
rl:{user_id}:{window}         → INT counter (TTL = window)

# Streaming replay buffers — DEPRECATED Phiên Sx04-3 per D-S04-13 LAW
# REPLACED by `sse:pubsub:{request_id}` pub/sub channel (Option Z).
# Original LIST replay pattern from S-00b drafts was never implemented.
# (re-verified 2026-06-10: 0 key `stream:` Redis sống — match grep duy nhất là TS `let stream: MediaStream`).
# stream:{request_id}           → LIST of SSE events  [DEPRECATED]

# Aggregator state (Phase 05)
aggregator:last_run           → ISO timestamp
aggregator:counters:{pid}     → JSON {impressions_7d, clicks_7d, ...} (TTL 1d)
```

## 6. Kafka Topics

> ⚠️ **CHƯA WIRE — RE-VERIFIED 2026-06-10:** Kafka chưa wire — không dep `kafkajs`/`kafka-python`, không producer/consumer (ref `Kafka` duy nhất = comment *"Future … KafkaProducerClient as needed"* ở `gateway/src/clients/clients.module.ts`), **không có topic `icp.*` thật trong code** (grep `apps/`: chỉ 1 comment metric `icp.behavior.dropped` ở `tracking.service.ts`, KHÔNG phải topic). Bảng dưới = **kiến trúc đích** (topics tạo khi wire Phase 04+). Behavior hiện ghi **trực tiếp** `INSERT behavior_events` (KHÔNG qua `icp.behavior.events`). Xem §3 + `01_ARCHITECTURE` §3.

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
| `icp.payments.refunded` | 3 | payment-consumer | inventory-consumer, audit-logger |
| `icp.audit.recorded` | 3 | audit-logger | (sink → audit_log hash-chain) |
| `icp.usage.metered` | 3 | services | usage-aggregator → usage_events/usage_daily |
| `icp.shopee.crawled` | 3 | shopee-crawl | (sink → shopee_prices) |

**Tenant:** mọi message mang `tenant_id` (trong payload + Kafka header) trừ event platform-level (NULL).

**Key strategy:** Domain topics keyed by `aggregate_id`. Behavior topic keyed by `user_id` để các events của 1 user xử lý theo thứ tự.

**Trace propagation:** Mọi producer inject `traceparent` header, consumer extract — xem `06_OBSERVABILITY.md` section 10.

## 7. Event Payload Schemas (TypeScript types)

> ⚠️ **CHƯA CODE (verified 2026-06-10):** `packages/shared-types/src/events.ts` **KHÔNG tồn tại** (grep toàn `shared-types/` rỗng — không có `EventEnvelope` lẫn 5 type domain-event). Block dưới = **spec target** (khi wire event-sourcing/Kafka phía TS). Bảng `events` THẬT đã có (MCP `events.append` ghi, 37 row) nhưng `payload` JSONB **chưa ràng TS contract**.

```ts
// packages/shared-types/src/events.ts (TARGET — CHƯA CODE)

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
- **Production (V011/V012 — xem §1.X):**
  - `V011__multitenant_payment_gdpr.sql`: tenants + memberships, tenant_id (+backfill từ merchant_id rồi SET NOT NULL cho bảng NOT NULL), UNIQUE scoping, payment (refunded + payment_callbacks), GDPR tables, RLS enable + policies.
  - `V012__wow_audit_ltr_usage.sql`: audit_log (hash-chain), tenant_ranking_weights, usage_events + usage_daily.
  - Cao nhất hiện tại = V010 → tách 2 khối để review/rollback từng phần.

## 9. ID Strategy

- UUID v4 cho mọi PK (gen ở DB layer)
- Idempotency-Key, JWT JTI: UUID v4 client-generated
- Không expose internal sequence IDs

## 10. Soft Delete vs Hard Delete

**Production:** status fields (`status='archived'`) cho lifecycle thường. Riêng **GDPR erasure** (ADR-041): data-subject erasure → anonymize/delete PII theo `data_retention_policies` + xử lý `data_subject_requests`; KHÔNG để PII tồn tại quá retention. Soft-delete/anonymize cho dữ liệu cá nhân thay vì hard-delete phá referential nếu cần audit.

## X.0 Seed Data Discipline — Curated WOW Data (D-S04-11 + D-S04-12 LAW Phiên Sx04-1)

> **Migration:** NONE (data-only, V001+V002 schema already supports all fields)
> **File:** `infra/seed/products.json` — seed discipline (S-04: 50→55). ⚠️ **DB thật = 75 products, 12 chuỗi category** (re-verified 2026-06-10; `gạo` có dấu ×1 chưa normalize về `gao` ×6). Seed đã mở rộng — **DB là chuẩn**.
> **Loader:** `infra/seed/seed.ts` extended INSERT (all V002 columns)
> **Vespa feed:** `infra/seed/vespa-feed.ts` (NEW) post-Postgres-seed, native embed

### Purpose

Demo/seed data cần coherent, realistic search results across multiple
queries (Variant A baseline + Variant B AI-augmented). Random fill = inconsistent
demo; curated data = pixel-perfect mockup match + cross-query coherence.

### Categories (DB thật 2026-06-10: 75 products, 12 chuỗi category — `tuong_ot` NEW per D-S04-12; `gạo` có dấu = dup CHƯA normalize)

| Category | Code | # (DB) | Vietnamese name | Used in |
|---|---|---|---|---|
| `nuoc_tuong` | nt | 9 | Nước tương | Mockup state-0/A/B/D/E/F (anchor query) |
| **`tuong_ot`** ⭐ NEW | tot | 5 | **Tương ớt** | **Mockup state-E (suggested co-purchase)** + state-B-empty |
| `dau_an` | da | 5 | Dầu ăn | Generic |
| `mi_tom` | mt | 5 | Mì tôm | Suggested query chip "Mì tôm Hảo Hảo" |
| `gia_vi` | gv | 5 | Gia vị (bột canh, tiêu, muối, hạt nêm, bột ngọt) | Excluding tương ớt (separate category) |
| `sua` | su | 5 | Sữa | Generic |
| `banh_keo` | bk | 5 | Bánh kẹo | Generic |
| `nuoc_giai_khat` | nk | 19 | Nước giải khát | Generic |
| `do_dong_hop` | dh | 5 | Đồ đóng hộp | Generic |
| `gao` | ga | 6 | Gạo | Generic |
| `gạo` ⚠️ | — | 1 | Gạo (chuỗi có dấu — CHƯA normalize; nên gộp về `gao`) | data-quality cleanup |
| `banh_mi` | bm | 5 | Bánh mì | Generic |
| **Total** | — | **75** | — | — |

### 4 mockup-pixel-perfect products (D-S04-11 LAW)

Variant B state-0-happy mockup shows 4 nuoc_tuong cards. Seed data MUST
match exactly so demo flow query "Nước tương cho phở" returns these 4:

| Mockup card | Title | brand | price | original_price | rating_avg | sold_count | trend_score (target match_score) |
|---|---|---|---|---|---|---|---|
| Card 1 (HOT, -15%, 98%) | Nước tương Maggi đậm đặc 700ml | MAGGI | 25500 | 30000 | 4.8 | 1200 | 0.95 |
| Card 2 (TREND, 91%) | Nước tương Tam Thái Tử nâu 500ml | CHIN-SU | 32000 | null | 4.7 | 987 | 0.88 |
| Card 3 (-16%, 87%) | Nước tương Nàng Dâu 450ml | NAM DƯƠNG | 21000 | 25000 | 4.5 | 654 | 0.78 |
| Card 4 (-20%, 79%) | Nước tương Maggi tỏi ớt 300ml | MAGGI | 18000 | 22500 | 4.6 | 856 | 0.72 |

> ✅ **Re-verified DB 2026-06-10:** 4 card trên khớp DB **chính xác từng trường**. `nuoc_tuong` có **9 row** tổng — 5 row thừa: 2 **test/debug** (`Nước Tương Maggi Phiên-Test-Sx07D…`, `DEBUG Test Maggi cay spice` — rating/sold/trend=0) + 2 Cholimex gần trùng (rating/sold=0) + 1 Lee Kum Kee Premium → **cleanup candidates** (data-quality, không thuộc curated set).

### Pareto distribution discipline (D-S04-11 LAW)

For all products (**DB=75 re-verified 2026-06-10**): ~20% products dominate ≥80% of sold_count (Pareto). ⚠️ Tier counts dưới (11/22/22 = 55) mô tả **seed baseline gốc**; DB nay **75** — phân bố tier thực tế chưa re-derive (không suy diễn).

- **Tier 1 — premium brands (11 products):** sold_count 1000-3000. Brands:
  Maggi, Chinsu, Vinamilk, TH True Milk, Hảo Hảo, Coca-Cola, Tường An,
  Neptune, Bibica, Acecook.
- **Tier 2 — mid-tier (22 products):** sold_count 200-800. Mix of national +
  regional brands.
- **Tier 3 — niche (22 products):** sold_count 30-200. Local + premium import.

### Behavioral signals consistency (D-S04-11 LAW)

For each product, derived behavioral fields (V001 products columns +
Vespa-only fields) MUST satisfy:

- `impressions_7d = sold_count × random(20-40)` (impressions:purchase ratio realistic)
- `clicks_7d = impressions_7d × random(0.05-0.12)` (CTR 5-12%)
- `add_to_cart_7d = clicks_7d × random(0.15-0.30)` (cart-add rate)
- `purchases_7d = sold_count / 4` (sold spread across 4 weeks roughly)
- `ctr_7d = clicks_7d / impressions_7d` (derived)
- `cvr_7d = purchases_7d / clicks_7d` (derived)
- `velocity_score = trend_score × 0.7 + ctr_7d × 100 × 0.3` (composite)

**Why:** Vespa rank profile `ai_augmented` (second-phase `0.7*firstPhase + 0.2*closeness(text_embedding) + 0.1*trend_score`, firstPhase có title 3x + proximity — xem §2) trả top-k coherent.
Realistic seed data → realistic demo flow.

### Per-category image_gradient + icon_hint (D-S04-11 LAW)

Mockup uses gradient placeholders (no real images). Each category has
canonical gradient + icon for visual identity:

| Category | image_gradient | icon_hint |
|---|---|---|
| nuoc_tuong | `#7C2D12,#A16207` (dark amber → brown) | `ti-bottle` |
| tuong_ot | `#7F1D1D,#DC2626` (deep red → bright red) | `ti-flame` |
| dau_an | `#FCD34D,#F59E0B` (yellow → amber) | `ti-droplet` |
| mi_tom | `#EA580C,#FB923C` (orange) | `ti-bowl` |
| gia_vi | `#92400E,#D97706` (warm brown) | `ti-salt` |
| sua | `#DBEAFE,#3B82F6` (white-blue → blue) | `ti-milk` |
| banh_keo | `#FCE7F3,#EC4899` (pink) | `ti-candy` |
| nuoc_giai_khat | `#14532D,#16A34A` (dark green → green) | `ti-beer` |
| do_dong_hop | `#E5E7EB,#6B7280` (gray) | `ti-tin` |
| gao | `#F5F5DC,#A8A29E` (cream → tan) | `ti-grain` |
| banh_mi | `#FED7AA,#FB923C` (peach) | `ti-bread` |

### SuggestedQueryChips amendment (D-S04-12 LAW + D-S04-07 content swap)

Original 3 chips per D-S04-07 line 147-150 swap for WOW demo:

| Position | OLD chip (D-S04-07 v1.0) | **NEW chip (D-S04-12 v1.1)** | Demo purpose |
|---|---|---|---|
| 1 | "Nước tương cho phở" | "Nước tương cho phở" | Mockup-perfect 4 cards exact match |
| 2 | "Tương ớt cay" | **"Đồ cay cay ăn phở"** | Semantic abstraction (CLIP multilingual maps "cay cay" → tuong_ot results) |
| 3 | "Mì tôm Hảo Hảo" | **"Soy sauce for pho"** | **Cross-language** WOW (English → Vietnamese matches via multilingual CLIP) |

### Cross-references

- Mockup ground truth: `docs/mockups/intent-03/intent-03B-state-0-happy.html` (4 cards exact match)
- Mockup co-purchase: `docs/mockups/intent-03/intent-03B-state-E-cart.html` (Tương ớt Chin-su anchor)
- §X.2 fixture `tuong_ot` consumer
- Seed loader: `infra/seed/seed.ts` extended (V002 columns INSERT)
- Vespa feed: `infra/seed/vespa-feed.ts` NEW (T01 emit)
- D-S04-07 SuggestedQueryChips content (amended Phiên Sx04-1 per D-S04-12)

## X. Shopee Price Reference — Real Crawl (Production) / Mock (dev)

> **Migration:** V008 (mock table) → production rename/repurpose `shopee_prices` (ADR-039)
> **ADR reference:** **ADR-039 (real crawler, supersedes ADR-032 mock)**; ADR-032 giữ làm lịch sử
> **Date added:** 2026-05-18 (mock); production crawl 2026-06-09
> **Populated by (production):** `apps/workers/src/shopee-crawl` worker (crawl thật → `shopee_prices`)
> **Populated by (dev/test):** `shopee-mock-seed-worker.ts` (idempotent seed)
> ⚠️ **Crawl rủi ro ToS/pháp lý** — cần rate-limit, anti-bot, fallback stale cache; rà soát pháp lý trước khi bật.
> **Schema:** giữ nguyên aggregates + samples JSONB (không phá MCP `shopee.price_range`); production THÊM cột crawl metadata: `crawled_at TIMESTAMPTZ`, `source_url VARCHAR(500)`, `is_stale BOOLEAN DEFAULT false`. Table thường để **global** (market reference, KHÔNG tenant-scoped).

### Purpose

Cung cấp data reference cho **Intent 01 (Import by Image)** UI:
- **State B (compact card):** aggregate price range (min/avg/max) cho category + attributes match
- **State D (expanded panel):** 5 sample products với store name, rating, sold count

### DDL

> ✅ **Khớp DB `shopee_prices_mock` (pg_dump 2026-06-10):** đủ 4 CHECK (min≥0, avg≥min, max≥avg, sample_count>0) + UNIQUE(category,attributes) + `idx_shopee_category`/`idx_shopee_attrs`. Cột crawl-metadata (`crawled_at/source_url/is_stale`) ở header = 🟡 production target (chưa có trong DB).

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

## X.2 Co-Purchase Category Fixture — Intent 03 Variant B (S-04 stub, S-10 real)

> **Migration:** NONE (fixture-only Phase 02 per BACKLOG line 333 risk note)
> **Real source (RE-VERIFIED code/DB 2026-06-10):** HIỆN TẠI co-purchase chạy bằng MCP tool `analytics.co_purchased` (`apps/mcp/src/tools/analytics.py`) — tính **on-the-fly** từ `orders`+`order_items`+`products` (CTE `target_orders`). Matview `co_purchase_matrix` **chưa build** (KHÔNG thuộc V006; V006 thật = `analytics_daily`/`analytics_daily_category`/`analytics_product_performance` — xác nhận pg_dump) → KHÔNG phải nguồn hiện tại. ⚠️ `co_purchase_matrix` **KHÔNG xuất hiện ở bất kỳ đâu trong repo** (re-verified grep 2026-06-10: 0 match code/SQL/docs) → chỉ là **hướng tối ưu precompute TÙY CHỌN, chưa cam kết** — cân nhắc khi `co_purchased` on-the-fly chậm ở scale lớn. Khối fixture dưới = stub Phase-02 (tool thật đã thay).
> **Date added:** Phiên Sx04 (S-04 Phase 1)
> **Owner:** S-04 BE T-N (loads fixture from `infra/seed/co_purchase_category.json`)

### Purpose

Variant B state-E mockup (`docs/mockups/intent-03/intent-03B-state-E-cart.html` lines 221-251) shows **co-purchase category-level hint card** sau khi user add product to cart: "Khách mua nước tương Maggi thường lấy kèm tương ớt. 68% khách mua kèm" + suggested product card.

Per ADR-013 (Vespa partial-update behavioral signals) + BACKLOG line 333: real V006 mat view computes co-purchase aggregations from `orders` + `order_items` historicals (Phase 05 dependency). S-04 ships **fixture-based** stub.

### Fixture format (`infra/seed/co_purchase_category.json`)

```json
[
  {
    "anchor_category": "nuoc_tuong",
    "anchor_brand_filter": null,
    "suggested_category": "tuong_ot",
    "suggested_product_id_seed": "<UUID seeded from products.json category=tuong_ot top-1 by trend_score>",
    "co_purchase_rate_pct": 68,
    "reason_template": "Khách mua {anchor_category_vi} thường lấy kèm {suggested_category_vi}"
  },
  {
    "anchor_category": "mi_tom",
    "anchor_brand_filter": null,
    "suggested_category": "trung",
    "suggested_product_id_seed": "<UUID seeded from products.json category=trung top-1>",
    "co_purchase_rate_pct": 54,
    "reason_template": "Khách mua {anchor_category_vi} thường lấy kèm {suggested_category_vi}"
  }
]
```

**Field semantics:**
- `anchor_category`: category của product user vừa add-to-cart (S-04 Variant B trigger)
- `anchor_brand_filter`: optional brand narrowing (null = category-level only, per BACKLOG line 327 "category-level NOT product-level")
- `suggested_category`: cross-sell category to display
- `suggested_product_id_seed`: top-1 product UUID resolved from `products` table at seed-time (NOT runtime per ADR-024 1 RTT discipline)
- `co_purchase_rate_pct`: integer 0-100 (mockup line 232 "68% khách mua kèm" pattern)
- `reason_template`: i18n template with `{anchor_category_vi}` + `{suggested_category_vi}` placeholders (e.g., "nuoc_tuong" → "nước tương")

### Lookup pattern (Phase 02 stub, replace S-10)

```python
# apps/ai/src/graphs/intents/searching_by_text.py — co_purchase_lookup node
def co_purchase_lookup(state: IcpState) -> dict:
    """Phase 02 stub — read fixture JSON; Phase 05/S-10 replaces with V006 mat view query."""
    fixture = load_json('infra/seed/co_purchase_category.json')
    anchor = state.get('cart_added_category')  # set by upstream cart.item_added emit
    match = next((row for row in fixture if row['anchor_category'] == anchor), None)
    if not match:
        return {'co_purchase_hint': None}
    suggested_product = mcp.products_get(id=match['suggested_product_id_seed'])
    return {
        'co_purchase_hint': {
            'rate_pct': match['co_purchase_rate_pct'],
            'reason': render_template(match['reason_template'], anchor, match['suggested_category']),
            'suggested_product': suggested_product,
        }
    }
```

**Co-purchase — HIỆN TẠI (code):** MCP `analytics.co_purchased` on-the-fly (`orders`+`order_items`+`products`, CTE `target_orders`, `apps/mcp/src/tools/analytics.py`, PHASE_05 §C). **Tối ưu TÙY CHỌN (chưa cam kết — `co_purchase_matrix` KHÔNG có ở code/plan nào trong repo, re-verified grep 2026-06-10):** nếu `co_purchased` on-the-fly chậm ở scale lớn, có thể precompute vào matview (category-level cho hint card Variant B, hoặc product-level — DDL tham khảo ở `07 §6.4`) + refresh hằng giờ qua aggregator worker. Fixture stub Phase-02 (`infra/seed/co_purchase_category.json` + node `co_purchase_lookup` ở `searching_by_text.py`) **vẫn còn trong code** (verified 2026-06-10) = lịch sử; tool `co_purchased` thật đã thay làm nguồn chính.

### Cross-references

- Mockup: `docs/mockups/intent-03/intent-03B-state-E-cart.html` lines 221-251 (co-purchase hint card pattern)
- Intent spec: `04_INTENT_SPECS.md` Intent 03 `ai_augmented` subgraph `co_purchase_lookup` node
- Risk LOCKED: `MASTER_SLICE_BACKLOG.md` line 333 (S-04 fixture → S-10 V006 real)
- ADR reference: ADR-013 (Vespa partial-update behavioral signals — different concern; co_purchase is PG-level not Vespa)

---

**END OF DATA MODEL DOC.**
