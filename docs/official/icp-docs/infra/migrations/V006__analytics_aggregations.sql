-- V006__analytics_aggregations.sql
-- Materialized views cho Intent 07 Analytics.
-- Pre-aggregate orders + order_items theo day × category để chart query nhanh.
-- Refresh strategy: cron worker hourly REFRESH MATERIALIZED VIEW CONCURRENTLY.

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
  COALESCE(
    (SELECT SUM(qty) FROM order_items WHERE order_id IN (
      SELECT id FROM orders o2 
      WHERE o2.user_id = o.user_id 
        AND DATE(o2.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') 
            = DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND o2.status = 'paid'
    )),
    0
  )                                      AS items_sold
FROM orders o
WHERE o.status = 'paid'
GROUP BY 
  o.user_id, 
  DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh');

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
