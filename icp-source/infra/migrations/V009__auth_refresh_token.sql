-- ============================================================================
-- V009__auth_refresh_token.sql
-- ============================================================================
-- S-03 T01 migration — auth refresh token support + display_name NOT NULL.
--
-- Source of truth: docs/02_DATA_MODEL.md §1 lines 31-56 (post-S-03 Phiên 30
-- patches; comment line 43 V002→V009 per C-10 Phiên 31 correction).
--
-- Adds 2 columns to sessions (refresh_token_hash + refresh_expires_at) per
-- S-03 C-02 LOCKED Phiên 30 + PHASE_02_AUTH_SEARCH §A line 51 "Refresh token
-- random UUID, lưu hash trong sessions table, exp 30d".
--
-- Tightens users.display_name to NOT NULL per S-03 C-05 LOCKED Phiên 30
-- (mockup state-E greeting "Xin chào, {display_name}" + state-F profile card
-- require non-NULL display_name).
--
-- V version note (S-03 C-10 LOCKED Phiên 31): originally planned V002 in
-- S-03_TASKLIST.md v1.0 Phase 1 Phiên 30; V002 already TAKEN by existing
-- V002__product_enrichment.sql. Next available after chain V001→V002→V003→
-- V005→V006→V008 = V009. V004 (promotions) + V007 (media_uploads) reserved
-- per docs/09_FIELD_AUDIT.md lines 312, 315 (do not fill).
--
-- Migration chain post-V009: V001 → V002 → V003 → V005 → V006 → V008 → V009.
--
-- Idempotency contract: every statement defensive per apply.sh F-4:
--   - apply.sh skips entire file if filename in schema_migrations
--   - BUT if schema_migrations row missing while schema changes already
--     applied (vd manual DELETE FROM schema_migrations, container volume
--     restore), re-execute must NOT fail
--   - Strategy: ADD COLUMN IF NOT EXISTS (Postgres 9.6+), DO blocks with
--     information_schema conditional check for SET NOT NULL, CREATE INDEX
--     IF NOT EXISTS
--
-- Postgres version requirement: 13+ (matches V001 baseline; ADD COLUMN IF
-- NOT EXISTS available since 9.6).
-- ============================================================================


-- ============================================================================
-- 1. USERS — display_name NOT NULL (per S-03 C-05)
-- ============================================================================
-- Pre-flight backfill (defensive): rows with NULL display_name get email as
-- fallback. Idempotent — no-op if no NULL rows. C14-bis Phiên 8 LOCKED
-- users.json baseline guarantees 5 seed rows have display_name populated, so
-- this UPDATE typically affects 0 rows. Defensive for edge case where seed
-- was bypassed or extra users were INSERTed without display_name.

UPDATE users
SET    display_name = email
WHERE  display_name IS NULL;

-- ALTER COLUMN SET NOT NULL — no built-in IF NOT EXISTS guard. Use DO block
-- with information_schema check.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = current_schema()
      AND  table_name = 'users'
      AND  column_name = 'display_name'
      AND  is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
  END IF;
END
$$;


-- ============================================================================
-- 2. SESSIONS — refresh_token_hash + refresh_expires_at (per S-03 C-02)
-- ============================================================================
-- refresh_token_hash: SHA-256 hex of refresh UUID v4 (64 hex chars). UNIQUE
-- constraint prevents collision attack + supports refresh-rotation lookup
-- pattern (UPDATE WHERE refresh_token_hash=old_hash per S-03 C-06).
--
-- refresh_expires_at: TIMESTAMPTZ — refresh exp 30d (vs access JWT exp 24h
-- in existing expires_at column). Rotating refresh per S-03 C-06.
--
-- ADD COLUMN IF NOT EXISTS (Postgres 9.6+) makes ADD idempotent. UNIQUE +
-- NOT NULL constraints applied via subsequent ALTER (deferred to handle the
-- case where column exists without constraints — rare but defensive).

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(64);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ;

-- Enforce NOT NULL via DO block (information_schema conditional).
-- Note: existing rows would block SET NOT NULL. Sessions table is expected
-- empty pre-T02 (auth flow not yet operational), so SET NOT NULL succeeds.
-- If rows exist, T02 must backfill before V009 SET NOT NULL — STOP per ST-3
-- analog. Defensive guard: skip SET NOT NULL if any NULL row exists, log
-- via RAISE NOTICE (apply.sh captures stdout).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = current_schema()
      AND  table_name = 'sessions'
      AND  column_name = 'refresh_token_hash'
      AND  is_nullable = 'YES'
  ) THEN
    IF EXISTS (SELECT 1 FROM sessions WHERE refresh_token_hash IS NULL LIMIT 1) THEN
      RAISE NOTICE 'V009: sessions has rows with NULL refresh_token_hash; SET NOT NULL deferred. T02 must backfill or truncate.';
    ELSE
      ALTER TABLE sessions ALTER COLUMN refresh_token_hash SET NOT NULL;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = current_schema()
      AND  table_name = 'sessions'
      AND  column_name = 'refresh_expires_at'
      AND  is_nullable = 'YES'
  ) THEN
    IF EXISTS (SELECT 1 FROM sessions WHERE refresh_expires_at IS NULL LIMIT 1) THEN
      RAISE NOTICE 'V009: sessions has rows with NULL refresh_expires_at; SET NOT NULL deferred.';
    ELSE
      ALTER TABLE sessions ALTER COLUMN refresh_expires_at SET NOT NULL;
    END IF;
  END IF;
END
$$;

-- UNIQUE constraint on refresh_token_hash. ALTER TABLE ... ADD CONSTRAINT
-- doesn't support IF NOT EXISTS until PG 16. Use DO block with
-- pg_constraint check for backward compat with PG 13+.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'sessions_refresh_token_hash_key'
      AND  conrelid = 'sessions'::regclass
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);
  END IF;
END
$$;

-- Index for refresh-rotation lookup (S-03 C-06 UPDATE WHERE refresh_token_hash=).
-- UNIQUE constraint creates btree index automatically, but explicit named index
-- per 02_DATA_MODEL §1 line 56 idx_sessions_refresh_token_hash naming.
-- Postgres dedup: UNIQUE constraint index is named sessions_refresh_token_hash_key
-- (auto), so this explicit named index is redundant but matches doc spec.
-- Use IF NOT EXISTS to avoid duplicate index error.

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash
  ON sessions(refresh_token_hash);


-- ============================================================================
-- End of V009__auth_refresh_token.sql
-- ============================================================================
