-- ============================================================================
-- V012__session_last_active_tenant.sql  —  S-P0-01 T02 (Issue #2)
-- ============================================================================
-- ADR-046 amendment (c) — Active tenant = URL, JWT = membership list.
--
-- `sessions.last_active_tenant_id` = LANDING HINT duy nhất: khi user vào root
-- URL (không có /s/<slug>), GET /auth/landing đọc cột này để redirect tới
-- /s/<slug> shop dùng gần nhất (hoặc /onboarding nếu NULL). UPDATE khi
-- switch-tenant. KHÔNG dùng cho request routing (active tenant = URL).
--
-- NULL = chưa từng switch / customer global → landing /onboarding.
-- FK ON DELETE SET NULL: tenant bị xoá → hint về NULL (landing /onboarding),
-- KHÔNG xoá session.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Chain V011 → V012 (this).
-- breaking: KHÔNG (cột nullable, không backfill bắt buộc).
-- Rollback note: ALTER TABLE sessions DROP COLUMN last_active_tenant_id;
--   (forward-only theo DoD — note để vận hành).
-- ============================================================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_active_tenant_id UUID NULL;

-- FK → tenants(id), guarded (ADD CONSTRAINT không có IF NOT EXISTS < PG16).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_last_active_tenant'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT fk_sessions_last_active_tenant
      FOREIGN KEY (last_active_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END
$$;

COMMENT ON COLUMN sessions.last_active_tenant_id IS
  'Landing hint (ADR-046 amend c): shop dùng gần nhất cho GET /auth/landing. KHÔNG dùng routing.';

-- ============================================================================
-- END V012__session_last_active_tenant.sql
-- ============================================================================
