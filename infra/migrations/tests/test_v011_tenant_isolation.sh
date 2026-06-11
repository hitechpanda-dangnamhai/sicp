#!/usr/bin/env bash
# ============================================================================
# test_v011_tenant_isolation.sh — embedded test cho V011 (S-P0-01 T01)
# ============================================================================
# DoD §5: test NHÚNG trong task. Verify 2 thứ:
#   1. migrate idempotent — re-exec V011 không lỗi.
#   2. RLS: role icp_app NOBYPASSRLS, query không SET app.tenant_id → 0 row;
#      đúng tenant → >0 row; tenant lạ → 0 row (cross-tenant isolation).
#
# Yêu cầu: postgres container đang chạy + V011 đã apply (bash apply.sh).
# Chạy:
#   PGCONTAINER=icp-postgres bash infra/migrations/tests/test_v011_tenant_isolation.sh
# ============================================================================
set -euo pipefail

PGCONTAINER="${PGCONTAINER:-icp-postgres}"
SUPER_URL="${DATABASE_URL_MIGRATE:-postgresql://icp:icp_dev_password@localhost:5432/icp}"
APP_URL="${DATABASE_URL_APP:-postgresql://icp_app:icp_app_dev_password@localhost:5432/icp}"
DEMO='11111111-1111-1111-1111-111111111111'
FOREIGN='22222222-2222-2222-2222-222222222222'
MIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/V011__multi_tenant.sql"

fail() { echo "FAIL: $*" >&2; exit 1; }
q_super() { docker exec -i "$PGCONTAINER" psql "$SUPER_URL" -t -A -v ON_ERROR_STOP=1 -c "$1"; }
q_app() { docker exec -i "$PGCONTAINER" psql "$APP_URL" -t -A -v ON_ERROR_STOP=1 "$@"; }

echo "=== 1. idempotency: re-exec V011 (expect no ERROR) ==="
docker exec -i "$PGCONTAINER" psql "$SUPER_URL" -v ON_ERROR_STOP=1 -f - < "$MIG_FILE" >/dev/null 2>idem.err || {
  cat idem.err; rm -f idem.err; fail "re-exec V011 raised an error"
}
rm -f idem.err
echo "  OK re-exec clean"

echo "=== 2. icp_app NOBYPASSRLS ==="
[ "$(q_app -t -A -c "SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user;")" = "f" ] \
  || fail "icp_app has BYPASSRLS"
echo "  OK NOBYPASSRLS"

echo "=== 3. RLS fail-closed: no GUC → 0 products ==="
[ "$(q_app -c "SELECT count(*) FROM products;")" = "0" ] \
  || fail "no-GUC SELECT returned rows (RLS not fail-closed)"
echo "  OK 0 rows without app.tenant_id"

echo "=== 4. demo tenant → >0 ==="
# SET in ra dòng "SET" trước kết quả → lấy dòng số cuối cùng.
DEMO_N="$(q_app -c "SET app.tenant_id='$DEMO'; SELECT count(*) FROM products;" | tail -n1)"
[ "$DEMO_N" -gt 0 ] || fail "demo tenant returned 0 products"
echo "  OK demo sees $DEMO_N products"

echo "=== 5. foreign tenant → 0 (cross-tenant isolation) ==="
FOR_N="$(q_app -c "SET app.tenant_id='$FOREIGN'; SELECT count(*) FROM products;" | tail -n1)"
[ "$FOR_N" = "0" ] || fail "foreign tenant saw $FOR_N products (LEAK)"
echo "  OK foreign tenant sees 0 products"

echo "=== 6. behavior_events partitioned: RLS qua parter VÀ partition trực tiếp ==="
# parent: foreign tenant → 0
BE_PARENT="$(q_app -c "SET app.tenant_id='$FOREIGN'; SELECT count(*) FROM behavior_events;" | tail -n1)"
[ "$BE_PARENT" = "0" ] || fail "behavior_events parent leaked $BE_PARENT rows to foreign tenant"
# partition trực tiếp: foreign tenant → 0 (relrowsecurity per-partition đã bật)
BE_PART="$(q_app -c "SET app.tenant_id='$FOREIGN'; SELECT count(*) FROM behavior_events_y2026m05;" | tail -n1)"
[ "$BE_PART" = "0" ] || fail "behavior_events partition leaked $BE_PART rows to foreign tenant"
echo "  OK behavior_events isolated (parent + partition direct)"

echo ""
echo "ALL V011 ISOLATION TESTS PASSED"
