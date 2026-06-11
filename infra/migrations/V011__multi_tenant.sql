-- ============================================================================
-- V011__multi_tenant.sql  —  S-P0-01 T01 (Multi-tenant SaaS foundation)
-- ============================================================================
-- Hiện thực ADR-040 (SaaS multi-tenant, isolation DB-layer ưu tiên RLS) +
-- ADR-046 (model #2 marketplace: users/sessions GLOBAL, mọi bảng data khác
-- tenant-scoped) + amendment 2026-06-11 của cả hai (icp_app NOBYPASSRLS,
-- SET LOCAL app.tenant_id, 2 connection string, composite UNIQUE).
--
-- Chain: V001→V002→V003→V005→V006→V008→V009→V010→V011 (this).
--
-- WHY backfill tenant 'demo':
--   DB live đã có data thật (orders 1281, order_items 1412, behavior_events
--   1010, events 37, action_cards 15, policies 7, products 75). Thêm
--   tenant_id NOT NULL trên bảng có sẵn → phải backfill trước SET NOT NULL.
--   Toàn bộ data hiện hữu thuộc 1 shop demo → gán tenant 'demo' (UUID cố định
--   11111111-1111-1111-1111-111111111111 để idempotent + reproducible).
--
-- WHY users/sessions KHÔNG có tenant_id (ADR-046 model #2):
--   1 customer mua nhiều shop bằng 1 account → account GLOBAL. Quan hệ
--   merchant/staff ↔ shop ghi ở tenant_memberships. Bảng users/sessions
--   KHÔNG enable RLS, KHÔNG thêm tenant_id.
--
-- WHY shopee_prices_mock + schema_migrations KHÔNG tenant-scoped:
--   shopee_prices_mock = dữ liệu THAM CHIẾU thị trường ngoài (giá Shopee),
--   chia sẻ cho mọi merchant, không thuộc sở hữu tenant nào (ADR-046 liệt kê
--   bảng tenant-scoped KHÔNG gồm nó). schema_migrations = metadata hạ tầng.
--   → cả hai giữ GLOBAL, không RLS.
--
-- WHY runtime DATABASE_URL CHƯA chuyển sang icp_app trong T01:
--   icp_app NOBYPASSRLS; query KHÔNG có `SET LOCAL app.tenant_id` sẽ trả 0
--   row (RLS fail-closed). withTenant()/SET LOCAL chỉ được wire ở T02/T03.
--   Nếu flip runtime creds NGAY bây giờ → app đang chạy gãy. Vì vậy T01:
--     - tạo role icp_app + RLS + DATABASE_URL_MIGRATE (superuser, cho apply.sh)
--     - GIỮ runtime DATABASE_URL = superuser 'icp' (BYPASSRLS) tạm thời
--     - cutover DATABASE_URL→icp_app để T02/T03 làm khi SET LOCAL đã thật.
--   .env.example có sẵn dòng DATABASE_URL (icp_app) comment cho cutover.
--
-- Idempotency (apply.sh skip nếu filename đã record, NHƯNG re-exec phải an
-- toàn nếu schema_migrations bị mất/restore): ADD COLUMN IF NOT EXISTS, DO
-- block guard cho FK/constraint/policy/role, CREATE INDEX IF NOT EXISTS,
-- DROP MATERIALIZED VIEW IF EXISTS trước recreate.
--
-- breaking: KHÔNG (runtime creds giữ nguyên; composite UNIQUE bao trùm
--   UNIQUE cũ vì toàn bộ data 1 tenant; new column NOT NULL đã backfill).
-- Rollback note: DROP các matview tenant; ALTER...DROP COLUMN tenant_id mọi
--   bảng; DROP POLICY tenant_isolation; ALTER TABLE ... DISABLE RLS;
--   DROP ROLE icp_app; DROP TABLE tenant_memberships, tenants; khôi phục
--   UNIQUE đơn (orders_idempotency_key_key, policies_code_key); recreate 3
--   matview bản V006. (Forward-only theo DoD — note để vận hành.)
-- ============================================================================


-- ============================================================================
-- 1. TENANTS  +  TENANT_MEMBERSHIPS  (ADR-046)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(63) UNIQUE NOT NULL,          -- subdomain/path key (DNS-safe)
  name        VARCHAR(120) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tenant_memberships: chỉ merchant/staff (ADR-046). Customer GLOBAL không có
-- membership — quyền mua hàng là quyền global, không cần row ở đây.
CREATE TABLE IF NOT EXISTS tenant_memberships (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'staff'
                CHECK (role IN ('owner', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_memberships(tenant_id);

COMMENT ON TABLE tenants IS 'SaaS tenant (shop). ADR-040/046.';
COMMENT ON TABLE tenant_memberships IS 'merchant/staff ↔ tenant RBAC. Customer global KHÔNG có row (ADR-046).';


-- ============================================================================
-- 2. DEMO TENANT (backfill anchor, UUID cố định)
-- ============================================================================
INSERT INTO tenants (id, slug, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'demo', 'Demo Shop')
ON CONFLICT (id) DO NOTHING;

-- Gán mọi merchant hiện hữu làm owner tenant demo (data hiện hữu = demo's).
-- WHY role='merchant': seed users dùng email merchant{1,2}@demo.icp; backfill
-- theo role bền hơn theo email cố định. Idempotent qua ON CONFLICT.
INSERT INTO tenant_memberships (user_id, tenant_id, role)
SELECT id, '11111111-1111-1111-1111-111111111111', 'owner'
FROM users
WHERE role = 'merchant'
ON CONFLICT (user_id, tenant_id) DO NOTHING;


-- ============================================================================
-- 3. tenant_id + backfill + FK + index + RLS cho 10 bảng tenant-scoped
-- ============================================================================
-- Loop DO block: thao tác đồng nhất cho mọi bảng (kể cả behavior_events
-- partitioned — ADD COLUMN/INDEX/RLS trên parent cascade xuống partitions PG11+).
-- Special-case (composite UNIQUE, matview) xử lý riêng phía dưới.

DO $$
DECLARE
  t           text;
  demo_id     uuid := '11111111-1111-1111-1111-111111111111';
  tenant_tables text[] := ARRAY[
    'products', 'events', 'policies', 'action_cards', 'orders',
    'order_items', 'transactions', 'product_reviews', 'insights',
    'behavior_events'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- 3a. ADD COLUMN tenant_id (nullable trước để backfill)
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id uuid', t);

    -- 3b. backfill data hiện hữu → demo tenant
    EXECUTE format('UPDATE %I SET tenant_id = %L WHERE tenant_id IS NULL', t, demo_id);

    -- 3c. SET NOT NULL (no-op nếu đã NOT NULL — idempotent native)
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);

    -- 3d. FK → tenants(id), guarded (ADD CONSTRAINT không có IF NOT EXISTS <PG16)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = format('fk_%s_tenant', t)
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id)',
        t, format('fk_%s_tenant', t)
      );
    END IF;

    -- 3e. index tenant_id (partitioned parent → partitioned index PG11+)
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)',
                   format('idx_%s_tenant', t), t);

    -- 3f. ENABLE RLS (parent partitioned → áp xuống partitions)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- 3g. POLICY tenant_isolation, guarded. fail-closed: GUC chưa set →
    --     current_setting(...,true)=NULL → so sánh NULL → 0 row.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I '
        'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
        'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
        t
      );
    END IF;
  END LOOP;
END
$$;

-- 3h. behavior_events PARTITIONED: ENABLE RLS trên parent KHÔNG tự áp xuống
--     partition khi query TRỰC TIẾP partition (relrowsecurity per-table). App
--     chỉ query parent (đã an toàn), nhưng defense-in-depth + slice "mọi
--     partition": bật RLS + policy trên từng partition con.
DO $$
DECLARE
  part        regclass;
  part_name   text;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass
    FROM pg_inherits
    WHERE inhparent = 'behavior_events'::regclass
  LOOP
    part_name := (SELECT relname FROM pg_class WHERE oid = part);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = part_name AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %s '
        'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
        'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
        part
      );
    END IF;
  END LOOP;
END
$$;


-- ============================================================================
-- 4. COMPOSITE UNIQUE — vỡ-multi-tenant fix (slice evidence)
-- ============================================================================
-- orders.idempotency_key + policies.code: UNIQUE global → 2 tenant không thể
-- trùng key/code. Đổi sang composite (tenant_id, key). Drop UNIQUE cũ trước.
ALTER TABLE orders   DROP CONSTRAINT IF EXISTS orders_idempotency_key_key;
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_code_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_tenant_idem') THEN
    ALTER TABLE orders ADD CONSTRAINT uq_orders_tenant_idem
      UNIQUE (tenant_id, idempotency_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_policies_tenant_code') THEN
    ALTER TABLE policies ADD CONSTRAINT uq_policies_tenant_code
      UNIQUE (tenant_id, code);
  END IF;
END
$$;


-- ============================================================================
-- 5. ROLE icp_app — runtime, NOBYPASSRLS (ADR-040 amendment i/ii)
-- ============================================================================
-- Dev password khớp convention 'icp_dev_password'. PROD: ALTER ROLE icp_app
-- PASSWORD <env secret> (DoD: secret qua env — dev creds chấp nhận hackathon).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'icp_app') THEN
    CREATE ROLE icp_app LOGIN PASSWORD 'icp_app_dev_password' NOBYPASSRLS;
  ELSE
    -- đảm bảo thuộc tính đúng nếu role đã tồn tại từ run trước
    ALTER ROLE icp_app NOBYPASSRLS;
  END IF;
END
$$;


-- ============================================================================
-- 6. RECREATE 3 MATERIALIZED VIEW + tenant_id (bản V006 + cột tenant_id)
-- ============================================================================
-- Matview KHÔNG hỗ trợ RLS; thêm cột tenant_id để consumer (dashboard) filter
-- app-level. REFRESH chạy bằng owner (superuser) đọc base table BYPASSRLS →
-- aggregate mọi tenant; cột tenant_id phân biệt. DROP CASCADE để recreate sạch.
DROP MATERIALIZED VIEW IF EXISTS analytics_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics_daily_category CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics_product_performance CASCADE;

-- 6.1 analytics_daily (+ tenant_id từ orders)
CREATE MATERIALIZED VIEW analytics_daily AS
SELECT
  o.tenant_id,
  o.user_id                              AS merchant_id,
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
  COUNT(*)                               AS orders_count,
  SUM(o.total)                           AS revenue,
  COUNT(DISTINCT o.user_id)              AS unique_customers,
  AVG(o.total)                           AS avg_order_value,
  COALESCE(items_agg.items_sold, 0)      AS items_sold
FROM orders o
LEFT JOIN (
  SELECT
    o2.tenant_id                                        AS tenant_id,
    o2.user_id                                          AS merchant_id,
    DATE(o2.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
    SUM(oi.qty)                                         AS items_sold
  FROM orders o2
  JOIN order_items oi ON oi.order_id = o2.id
  WHERE o2.status = 'paid'
  GROUP BY o2.tenant_id, o2.user_id, DATE(o2.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
) items_agg
  ON items_agg.tenant_id = o.tenant_id
  AND items_agg.merchant_id = o.user_id
  AND items_agg.day = DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
WHERE o.status = 'paid'
GROUP BY
  o.tenant_id,
  o.user_id,
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),
  items_agg.items_sold;

CREATE UNIQUE INDEX idx_analytics_daily_pk
  ON analytics_daily(tenant_id, merchant_id, day);
CREATE INDEX idx_analytics_daily_day
  ON analytics_daily(tenant_id, day DESC);

-- 6.2 analytics_daily_category (+ tenant_id từ products)
CREATE MATERIALIZED VIEW analytics_daily_category AS
SELECT
  p.tenant_id,
  p.merchant_id,
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
  p.category,
  COUNT(DISTINCT o.id)                   AS orders_count,
  SUM(oi.qty)                            AS qty_sold,
  SUM(oi.qty * oi.unit_price)            AS revenue,
  COUNT(DISTINCT oi.product_id)          AS distinct_products
FROM order_items oi
JOIN orders o   ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'paid'
GROUP BY
  p.tenant_id,
  p.merchant_id,
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),
  p.category;

CREATE UNIQUE INDEX idx_analytics_daily_category_pk
  ON analytics_daily_category(tenant_id, merchant_id, day, category);
CREATE INDEX idx_analytics_daily_category_revenue
  ON analytics_daily_category(tenant_id, merchant_id, day, revenue DESC);

-- 6.3 analytics_product_performance (+ tenant_id từ products)
CREATE MATERIALIZED VIEW analytics_product_performance AS
SELECT
  p.tenant_id,
  p.merchant_id,
  p.id                                   AS product_id,
  p.title,
  p.category,
  COALESCE(SUM(CASE
    WHEN o.created_at > NOW() - INTERVAL '7 days'
    THEN oi.qty ELSE 0
  END), 0)                               AS qty_7d,
  COALESCE(SUM(CASE
    WHEN o.created_at > NOW() - INTERVAL '7 days'
    THEN oi.qty * oi.unit_price ELSE 0
  END), 0)                               AS revenue_7d,
  COALESCE(SUM(CASE
    WHEN o.created_at > NOW() - INTERVAL '30 days'
    THEN oi.qty ELSE 0
  END), 0)                               AS qty_30d,
  COALESCE(SUM(CASE
    WHEN o.created_at > NOW() - INTERVAL '30 days'
    THEN oi.qty * oi.unit_price ELSE 0
  END), 0)                               AS revenue_30d
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o       ON o.id = oi.order_id AND o.status = 'paid'
WHERE p.status = 'active'
GROUP BY p.tenant_id, p.merchant_id, p.id, p.title, p.category;

CREATE UNIQUE INDEX idx_analytics_product_perf_pk
  ON analytics_product_performance(tenant_id, product_id);
CREATE INDEX idx_analytics_product_perf_merchant
  ON analytics_product_performance(tenant_id, merchant_id, revenue_7d DESC);

-- refresh function: V006 đã DROP CASCADE? Không — function độc lập, giữ nguyên.
-- (refresh_analytics_aggregations vẫn trỏ đúng tên matview, không cần đổi.)


-- ============================================================================
-- 7. GRANT cho icp_app (đặt CUỐI để bao cả matview vừa recreate)
-- ============================================================================
-- ALL TABLES gồm cả view + materialized view (PG semantics).
GRANT USAGE ON SCHEMA public TO icp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO icp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO icp_app;

-- Default privileges cho object tương lai do superuser 'icp' tạo.
ALTER DEFAULT PRIVILEGES FOR ROLE icp GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO icp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE icp GRANT USAGE, SELECT ON SEQUENCES TO icp_app;

-- ============================================================================
-- END V011__multi_tenant.sql
-- ============================================================================
