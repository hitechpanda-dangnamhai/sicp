-- ============================================================================
-- V001__init.sql
-- ============================================================================
-- Foundational migration cho ICP — base schema cho Phase 01.
--
-- Source of truth: docs/02_DATA_MODEL.md Section 1 (lines 1-165 pre-patch +
-- C13 amendment lines 119-136 patched 2026-05-18 Phiên 7).
--
-- Decision C12 (Phiên 3 LOCKED 2026-05-18 Option B): Embeddings Vespa-only.
-- V001 KHÔNG include text_embedding / image_embedding VECTOR columns trong
-- products. Embeddings stored exclusively trong Vespa search index per
-- ADR-036 (CLIP ViT-B/32 512 dim).
--
-- Decision C13 (Phiên 7 AMENDMENT 2026-05-18 Option C-clean): transactions
-- table base DDL bổ sung 2 columns vào source-of-truth:
--   - user_id     UUID NOT NULL REFERENCES users(id)
--   - updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- Rationale: V005 (idx_transactions_user_failed) + backfill require columns
-- này; thiếu trong V001 → chain V001→V005 fail. V005 author intent expect
-- denorm pattern. See decisions-log.md C13 amendment.
--
-- Decision C16 (Phiên 8 AMENDMENT 2026-05-18 Path α): behavior_events table
-- PRIMARY KEY changed từ single-column (event_id) → composite
-- (event_id, occurred_at). Rationale: Postgres requires unique constraints
-- on partitioned tables include all partition key columns. Spec gốc
-- 02_DATA_MODEL.md line 141 + 07_BEHAVIOR_LOGS.md line 149 đều spec single
-- PK → Postgres 16 reject ERROR "unique constraint on partitioned table
-- must include all partitioning columns". V001 EXACT mirror nên cũng fail.
-- Fix in-session với human ack Path α (Phiên 8 smoke test phát hiện).
-- 2 upstream docs (02_DATA_MODEL.md + 07_BEHAVIOR_LOGS.md) patched cùng
-- session. See decisions-log.md C16 amendment.
--
-- Migration chain: V001 (this) → V002 → V003 → V005 → V006 → V008.
-- V004 (promotions) + V007 (media_uploads) intentionally skipped per
-- docs/09_FIELD_AUDIT.md lines 312, 315 (promotions cut hackathon scope;
-- image storage = base64 inline trong products.image_url).
--
-- Postgres version requirement: 13+ (gen_random_uuid() in core, partitioned
-- table support, GIN indexes on JSONB). Production target: postgres:16-alpine
-- per docs/phases/PHASE_01_INFRA.md line 24.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
-- pgcrypto: gen_random_uuid() native (PG13+ also has it in core, extension
-- guard cho compat với image variant cũ).
-- uuid-ossp: provides uuid_generate_v4() — không strictly cần (DDL dùng
-- gen_random_uuid() exclusively) nhưng giữ defensive cho future flexibility
-- per EXECUTION_GUIDE §4.4 skeleton.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. SCHEMA_MIGRATIONS METADATA
-- ============================================================================
-- Track table cho apply.sh idempotent runner. apply.sh cũng bootstrap table
-- này (idempotent both ways — V001 + apply.sh thay nhau create đều OK nhờ
-- IF NOT EXISTS).
-- filename = file basename (vd 'V001__init.sql'). VARCHAR(120) đủ cho
-- naming convention V###__<desc>.sql với desc ≤100 chars.
-- checksum: NULL trong S-00b (apply.sh không compute hash); reserve cho
-- future drift detection.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)
);


-- ============================================================================
-- 2. USERS
-- ============================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('merchant', 'customer', 'admin')),
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 3. SESSIONS (JWT metadata; JWT stateless, lưu jti cho revoke list)
-- ============================================================================

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         VARCHAR(64) UNIQUE NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX idx_sessions_jti ON sessions(jti);


-- ============================================================================
-- 4. PRODUCTS
-- ============================================================================
-- Note (C12 LOCKED Option B): KHÔNG có text_embedding / image_embedding
-- VECTOR columns. Embeddings stored Vespa-only per ADR-036. Postgres giữ
-- source-of-truth domain data (title, price, stock, attributes, image_url).
-- Vespa indexing pipeline (S-02+) compute embedding từ Postgres data + push
-- vào Vespa khi product create/update.
-- Note: V002 sẽ ALTER ADD brand/original_price/rating_avg/rating_count/
-- sold_count/image_gradient/icon_hint — KHÔNG include trong V001 base.

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
CREATE INDEX idx_products_attrs    ON products USING GIN (attributes);


-- ============================================================================
-- 5. EVENTS (event sourcing, append-only)
-- ============================================================================

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
CREATE INDEX idx_events_aggregate    ON events(aggregate_type, aggregate_id, created_at);
CREATE INDEX idx_events_type         ON events(type, created_at);
CREATE INDEX idx_events_unpublished  ON events(created_at) WHERE published_at IS NULL;


-- ============================================================================
-- 6. POLICIES (rule DSL)
-- ============================================================================

CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(40) UNIQUE NOT NULL,     -- 'PRICE_TOO_HIGH_v1'
  description TEXT,
  rule_dsl    JSONB NOT NULL,                  -- see 02_DATA_MODEL.md section 3
  priority    INT NOT NULL DEFAULT 100,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 7. ACTION_CARDS
-- ============================================================================

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
CREATE INDEX idx_cards_event       ON action_cards(event_id);


-- ============================================================================
-- 8. ORDERS
-- ============================================================================

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


-- ============================================================================
-- 9. ORDER_ITEMS
-- ============================================================================

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  qty         INT NOT NULL CHECK (qty > 0),
  unit_price  BIGINT NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);


-- ============================================================================
-- 10. TRANSACTIONS (payment)
-- ============================================================================
-- C13 Amendment (2026-05-18 Phiên 7 Option C-clean): bổ sung user_id +
-- updated_at vào base DDL (vs pre-patch 02_DATA_MODEL Section 1 lines 119-128).
-- See decisions-log.md C13 + comment block trong 02_DATA_MODEL.md.
-- - user_id NOT NULL REFERENCES users(id): denorm cho hot-path query
--   "list failed transactions per user" (V005 idx_transactions_user_failed).
--   NO ON DELETE CASCADE: giữ transactions cho audit trail nếu user xóa
--   (match orders.user_id pattern).
-- - updated_at: mutable entity lifecycle (status pending→success/failed,
--   V005 ALTER ADD completed_at). Parity với orders + products updated_at.
-- Note: V005 sẽ ALTER ADD payment_method/failure_reason/metadata/
-- provider_txn_id/completed_at — KHÔNG include trong V001 base.

CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      BIGINT NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  provider    VARCHAR(40) DEFAULT 'mock',
  external_id VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 11. BEHAVIOR_EVENTS (partitioned by occurred_at, monthly)
-- ============================================================================
-- User behavior cho recommendation/analytics. Chi tiết schema + event type
-- catalog xem docs/07_BEHAVIOR_LOGS.md.
-- Partition strategy: monthly RANGE on occurred_at. Phase 01 tạo trước
-- 3 tháng (y2026m05, m06, m07); production auto-partition qua pg_partman
-- hoặc cron task.

CREATE TABLE behavior_events (
  -- C16 Amendment (Phiên 8): PRIMARY KEY composite (event_id, occurred_at).
  -- Postgres requires PK on partitioned table include partition key columns.
  -- Single-column PK on event_id (per upstream spec) → reject.
  -- See decisions-log.md C16.
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

-- Monthly partitions, Phase 01 tạo trước 3 tháng:
CREATE TABLE behavior_events_y2026m05 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE behavior_events_y2026m06 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE behavior_events_y2026m07 PARTITION OF behavior_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Indexes (apply lên parent → cascade xuống partitions automatically PG11+):
CREATE INDEX idx_be_user_time   ON behavior_events (user_id, occurred_at DESC);
CREATE INDEX idx_be_type_time   ON behavior_events (event_type, occurred_at DESC);
CREATE INDEX idx_be_subject     ON behavior_events (subject_type, subject_id);
CREATE INDEX idx_be_properties  ON behavior_events USING GIN (properties);


-- ============================================================================
-- END V001__init.sql
-- ============================================================================
-- Next migrations trong chain (đã tồn tại trong infra/migrations/):
--   V002__product_enrichment.sql      — ALTER products + CREATE product_reviews
--   V003__insights.sql                — CREATE insights (FK users)
--   V005__payment_metadata.sql        — ALTER transactions (consumes C13)
--   V006__analytics_aggregations.sql  — MATERIALIZED VIEW orders/order_items/products
--   V008__shopee_prices_mock.sql      — CREATE shopee_prices_mock (standalone)
-- V004 + V007 intentionally skipped (no files); apply.sh sẽ apply theo
-- alphabetical glob V*.sql, skip naturally.
-- ============================================================================
