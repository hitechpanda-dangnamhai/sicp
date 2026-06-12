#!/usr/bin/env bash
# ============================================================================
# test_v014_housekeeper.sh — embedded test cho V014 + housekeeper (S-P0-02 T02)
# ============================================================================
# DoD §5: test NHÚNG. Verify acceptance DB-level (W-66 gỡ bom):
#   1. INSERT behavior_events dated 2026-10 THÀNH CÔNG (trước V014: FAIL).
#   2. V014 idempotent — re-apply không lỗi (CREATE IF NOT EXISTS).
#   3. INSERT dated 2026-12 (biên m12) thành công.
#   4. REFRESH MATERIALIZED VIEW CONCURRENTLY thành công (W-67 path).
# (acceptance leader-lock + kill/restart worker = chạy worker live qua tsx,
#  xem report; mọi op idempotent nên restart an toàn.)
#
# Yêu cầu: postgres container chạy. Chạy:
#   PGCONTAINER=icp-postgres bash infra/migrations/tests/test_v014_housekeeper.sh
# ============================================================================
set -euo pipefail

PGCONTAINER="${PGCONTAINER:-icp-postgres}"
URL="${DATABASE_URL_MIGRATE:-postgresql://icp:icp_dev_password@localhost:5432/icp}"
MIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/V014__housekeeper_safety.sql"

fail() { echo "FAIL: $*" >&2; exit 1; }
q() { docker exec -i "$PGCONTAINER" psql "$URL" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
apply_v014() { docker exec -i "$PGCONTAINER" psql "$URL" -v ON_ERROR_STOP=1 -f - < "$MIG_FILE" >/dev/null; }

echo "== V014 housekeeper safety test =="

# --- Apply V014 (idempotent) ---
apply_v014
echo "ok: V014 applied"

# behavior_events.tenant_id NOT NULL (V011) → lấy 1 tenant thật cho test INSERT.
TENANT=$(q "SELECT id FROM tenants LIMIT 1;")
[ -n "$TENANT" ] || fail "không có tenant nào trong DB để test INSERT"

# --- Test 1: INSERT dated 2026-10 thành công (gỡ W-66) ---
N=$(q "INSERT INTO behavior_events (event_id, tenant_id, event_type, occurred_at) VALUES (gen_random_uuid(), '$TENANT', 'test.v014.oct', '2026-10-15T00:00:00Z') RETURNING 1;")
[ "$N" = "1" ] || fail "INSERT 2026-10 không thành công (W-66 chưa gỡ)"
echo "ok 1: INSERT behavior_events dated 2026-10 thành công"

# --- Test 2: V014 re-apply idempotent (CREATE IF NOT EXISTS, 0 lỗi duplicate) ---
apply_v014
apply_v014
echo "ok 2: V014 re-apply 2× idempotent — 0 lỗi duplicate partition"

# --- Test 3: INSERT biên m12 (2026-12) thành công ---
N=$(q "INSERT INTO behavior_events (event_id, tenant_id, event_type, occurred_at) VALUES (gen_random_uuid(), '$TENANT', 'test.v014.dec', '2026-12-31T23:00:00Z') RETURNING 1;")
[ "$N" = "1" ] || fail "INSERT 2026-12 không thành công (m12 thiếu)"
echo "ok 3: INSERT dated 2026-12 (biên m12) thành công"

# --- Test 4: REFRESH MATERIALIZED VIEW CONCURRENTLY (W-67 path) ---
q "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily;" >/dev/null
echo "ok 4: REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily thành công"

# --- Cleanup test rows ---
q "DELETE FROM behavior_events WHERE event_type IN ('test.v014.oct','test.v014.dec','test.precheck');" >/dev/null
echo "ok: cleanup test rows"

echo "== PASS 4/4 (DB-level) =="
