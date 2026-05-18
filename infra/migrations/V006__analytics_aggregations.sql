-- V006__analytics_aggregations.sql
-- Materialized views cho Intent 07 Analytics.
-- Pre-aggregate orders + order_items theo day × category để chart query nhanh.
-- Refresh strategy: cron worker hourly REFRESH MATERIALIZED VIEW CONCURRENTLY.
--
-- C18 Amendment (Phiên 8 2026-05-18 Path α): analytics_daily MV definition
-- refactor items_sold subquery → LEFT JOIN pre-aggregated subquery. Pre-patch
-- correlated subquery referenced o.created_at raw inside DATE(...) expression;
-- Postgres GROUP BY validator doesn't recognize functional equivalence với
-- outer GROUP BY DATE(o.created_at AT TIME ZONE ...). Error: "subquery uses
-- ungrouped column o.created_at from outer query". Fix: pre-aggregate qty
-- per (merchant, day) outside main GROUP BY, then LEFT JOIN — same result,
-- PG-acceptable, no correlated subquery N+1 anti-pattern.
-- See decisions-log.md C18 amendment.

-- ============================================================================
-- 1. ANALYTICS_DAILY — orders + revenue per merchant per day
-- ============================================================================
CREATE MATERIALIZED VIEW analytics_daily AS
SELECT
  o.user_id                              AS merchant_id,
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
  COUNT(*)                               AS orders_count,
  SUM(o.total)                           AS revenue,
  COUNT(DISTINCT o.user_id)              AS unique_customers,
  AVG(o.total)                           AS avg_order_value,
  COALESCE(items_agg.items_sold, 0)      AS items_sold
FROM orders o
LEFT JOIN (
  -- C18: pre-aggregate items per (merchant, day) to avoid correlated
  -- subquery referencing ungrouped o.created_at.
  SELECT
    o2.user_id                                          AS merchant_id,
    DATE(o2.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,
    SUM(oi.qty)                                         AS items_sold
  FROM orders o2
  JOIN order_items oi ON oi.order_id = o2.id
  WHERE o2.status = 'paid'
  GROUP BY o2.user_id, DATE(o2.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
) items_agg
  ON items_agg.merchant_id = o.user_id
  AND items_agg.day = DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
WHERE o.status = 'paid'
GROUP BY 
  o.user_id, 
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),
  items_agg.items_sold;

-- UNIQUE INDEX required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_analytics_daily_pk
  ON analytics_daily(merchant_id, day);

CREATE INDEX idx_analytics_daily_day
  ON analytics_daily(day DESC);

-- ============================================================================
-- 2. ANALYTICS_DAILY_CATEGORY — per merchant × day × category
-- ============================================================================
CREATE MATERIALIZED VIEW analytics_daily_category AS
SELECT
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
  p.merchant_id, 
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 
  p.category;

CREATE UNIQUE INDEX idx_analytics_daily_category_pk
  ON analytics_daily_category(merchant_id, day, category);

CREATE INDEX idx_analytics_daily_category_revenue
  ON analytics_daily_category(merchant_id, day, revenue DESC);

-- ============================================================================
-- 3. ANALYTICS_PRODUCT_PERFORMANCE — top sellers (7d / 30d windows)
-- ============================================================================
-- Note: NOW() inside SUM(CASE WHEN ...) is evaluated at MV refresh time,
-- not at index build time → NOT subject to IMMUTABLE constraint (only index
-- predicates require IMMUTABLE). Windows are point-in-time snapshots; worker
-- refreshes MV hourly để keep windows current.
CREATE MATERIALIZED VIEW analytics_product_performance AS
SELECT
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
GROUP BY p.merchant_id, p.id, p.title, p.category;

CREATE UNIQUE INDEX idx_analytics_product_perf_pk
  ON analytics_product_performance(product_id);

CREATE INDEX idx_analytics_product_perf_merchant
  ON analytics_product_performance(merchant_id, revenue_7d DESC);

-- ============================================================================
-- 4. REFRESH FUNCTION (called by worker-analytics every hour via pg_cron or app scheduler)
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_analytics_aggregations() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_category;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_product_performance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_analytics_aggregations IS 'Called by worker-analytics every hour. Uses CONCURRENTLY so reads not blocked.';

-- ============================================================================
-- 5. MANUAL REFRESH for immediate after seed (Phase 01 bootstrap)
-- ============================================================================
-- After running seed scripts, call this once:
--   SELECT refresh_analytics_aggregations();
-- 
-- For hackathon demo, worker can refresh on app startup if MV is empty.

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================
COMMENT ON MATERIALIZED VIEW analytics_daily IS 
  'Per-merchant daily aggregates. Used by chart "Doanh thu 7 ngày", dashboard stats, insight detection.';

COMMENT ON MATERIALIZED VIEW analytics_daily_category IS 
  'Per-merchant per-category daily aggregates. Used by chart "Top categories", donut chart.';

COMMENT ON MATERIALIZED VIEW analytics_product_performance IS 
  'Per-product 7d/30d rolling windows. Used by "Top sellers" chart and trend_score derivation.';
