#!/usr/bin/env bash
# ============================================================================
# apply.sh — idempotent Postgres migration runner cho ICP
# ============================================================================
# Walks infra/migrations/V*.sql alphabetically, applies pending ones to
# Postgres via host `psql` binary, records applied filenames in
# `schema_migrations` table. Re-run skip applied (idempotent).
#
# Per decisions-log.md D-04 + docs/02_DATA_MODEL.md line 415-417:
# "Hackathon: bash script `infra/migrations/apply.sh` đủ."
#
# Usage:
#   DATABASE_URL=postgresql://user:pw@host:5432/db ./apply.sh
#   # OR (from repo root):
#   bash infra/migrations/apply.sh
#   # OR (from infra/migrations/ dir): reads ../../.env automatically
#   cd infra/migrations && ./apply.sh
#
# Requirements:
#   - host `psql` binary (PostgreSQL client) trong PATH
#   - DATABASE_URL resolvable from host (postgres compose port forward
#     :5432 hoặc explicit override)
#
# Caller convention: Makefile target `make migrate` calls
# `bash infra/migrations/apply.sh` (per s00b-outputs/T01/code/Makefile L50-51).
# ============================================================================

set -euo pipefail


# === Resolve migration connection string ====================================
# S-P0-01 (ADR-040 amendment ii): migrations CHẠY BẰNG SUPERURL — CREATE ROLE
# icp_app / ENABLE RLS / GRANT đòi superuser. Runtime DATABASE_URL (icp_app,
# NOBYPASSRLS) KHÔNG đủ quyền. Ưu tiên DATABASE_URL_MIGRATE; fallback
# DATABASE_URL cho back-compat (env cũ chưa tách 2 string).
# Priority: explicit env > ../../.env file > error.
if [ -z "${DATABASE_URL_MIGRATE:-}" ] || [ -z "${DATABASE_URL:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="$SCRIPT_DIR/../../.env"
  if [ -f "$ENV_FILE" ]; then
    # Parse only the DB url lines, skip comments, export to current shell.
    export $(grep -v '^#' "$ENV_FILE" | grep -E '^DATABASE_URL(_MIGRATE)?=' | xargs)
  fi
fi

# DATABASE_URL used by all psql calls below = migrate URL (superuser).
DATABASE_URL="${DATABASE_URL_MIGRATE:-${DATABASE_URL:-}}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: neither DATABASE_URL_MIGRATE nor DATABASE_URL set." >&2
  echo "  Set via env: DATABASE_URL_MIGRATE=postgresql://... bash apply.sh" >&2
  echo "  Or place in .env at repo root (../../.env from script)." >&2
  exit 1
fi


# === Bootstrap schema_migrations =============================================
# Defensive — V001__init.sql cũng tạo table này, nhưng nếu user chạy apply.sh
# với DB chưa có V001 (lần đầu) cần bootstrap để per-file check INSERT làm
# việc được. IF NOT EXISTS = idempotent both ways.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    VARCHAR(120) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    VARCHAR(64)
);
SQL


# === Walk V*.sql alphabetically ==============================================
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLIED_COUNT=0
SKIPPED_COUNT=0

# Shell glob V*.sql expand theo lexicographic order = V001, V002, V003, V005,
# V006, V008 (V004 + V007 không có file, skip naturally per 09_FIELD_AUDIT
# lines 312, 315).
shopt -s nullglob
for file in "$MIGRATION_DIR"/V*.sql; do
  filename="$(basename "$file")"

  # Check if already applied. -t = tuple-only, -A = unaligned, -c = command.
  # Returns "1" if row exists, empty string otherwise.
  already_applied="$(psql "$DATABASE_URL" -t -A -v ON_ERROR_STOP=1 -c \
    "SELECT 1 FROM schema_migrations WHERE filename = '$filename';")"

  if [ "$already_applied" = "1" ]; then
    echo "SKIP  $filename (already applied)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo "APPLY $filename..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"

  # Record success. INSERT thay vì ON CONFLICT vì đã check exists trước —
  # nếu race condition (2 apply.sh chạy đồng thời) thì PK constraint sẽ
  # fail nhanh hơn ON CONFLICT silent skip → preferred for visibility.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO schema_migrations (filename) VALUES ('$filename');"

  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done


# === Summary ================================================================
echo ""
echo "=== Migration summary ==="
echo "Applied: $APPLIED_COUNT"
echo "Skipped: $SKIPPED_COUNT (already applied)"
echo "Done."
