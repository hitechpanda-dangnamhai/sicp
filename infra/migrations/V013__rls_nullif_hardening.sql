-- ============================================================================
-- V013__rls_nullif_hardening.sql  —  S-P0-01 T02 (Issue #3)
-- ============================================================================
-- ADR-040 amendment (b) — RLS NULLIF hardening cho empty GUC.
--
-- WHY (vấn đề V011 policy để lại):
--   PostgreSQL pg-pool (Gateway max=10) TÁI SỬ DỤNG connection. `SET LOCAL
--   app.tenant_id = $t` chỉ sống trong txn; sau COMMIT, GUC KHÔNG unset hoàn
--   toàn mà RESET về empty string ''. Connection kế tiếp lấy từ pool nếu chạy
--   query KHÔNG mở txn-with-SET-LOCAL sẽ thấy current_setting('app.tenant_id',
--   true) = '' (không phải NULL). Policy V011 cast ''::uuid → THROW 'invalid
--   input syntax for type uuid'. Fail-closed NHƯNG qua exception, không qua
--   RLS — hành vi phụ thuộc trạng thái pool, không phải invariant.
--
-- SỬA: mọi policy dùng NULLIF(current_setting('app.tenant_id', true), '')::uuid.
--   '' → NULL → so sánh `tenant_id = NULL` = unknown → 0 row. Connection mới
--   (current_setting = NULL) cũng → NULL → 0 row. Hành vi CUỐI đồng nhất:
--   0 rows silently, KHÔNG exception, KHÔNG leak, độc lập trạng thái pool.
--
-- ÁP DỤNG: mọi bảng tenant-scoped (10) + WITH CHECK + behavior_events 3
--   partition (y2026m05 archive / y2026m06 current / y2026m07 next). Atomic
--   transaction — hoặc toàn bộ policy đổi, hoặc không gì.
--
-- Idempotent: DROP POLICY IF EXISTS trước CREATE. Re-exec an toàn. Chain
--   V011 → V012 → V013 (this). Dùng cùng tenant_tables array + pg_inherits
--   loop như V011 §3 để KHÔNG bỏ sót bảng/partition.
--
-- breaking: KHÔNG (policy name giữ 'tenant_isolation'; chỉ siết predicate từ
--   throw-on-empty → 0-row-on-empty; mọi data path THẬT qua withTenant() đặt
--   GUC hợp lệ → không đổi kết quả; chỉ đổi hành vi path-không-set-GUC).
-- Rollback note: re-CREATE policy bản V011 (bỏ NULLIF) — forward-only theo DoD.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. 10 bảng tenant-scoped (parent behavior_events bao trong array)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t             text;
  tenant_tables text[] := ARRAY[
    'products', 'events', 'policies', 'action_cards', 'orders',
    'order_items', 'transactions', 'product_reviews', 'insights',
    'behavior_events'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) '
      'WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. behavior_events partitions (relrowsecurity per-table — V011 §3h defense)
--    Dynamic qua pg_inherits: bắt đúng các partition đang tồn tại
--    (y2026m05/m06/m07) mà không hardcode tên.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  part        regclass;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass
    FROM pg_inherits
    WHERE inhparent = 'behavior_events'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', part);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s '
      'USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) '
      'WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      part
    );
  END LOOP;
END
$$;

COMMIT;

-- ============================================================================
-- END V013__rls_nullif_hardening.sql
-- ============================================================================
