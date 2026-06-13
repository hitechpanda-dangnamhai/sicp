#!/usr/bin/env bash
# ============================================================================
# test_v015_llm_traces.sh — embedded test cho V015 (S-P0-03/T03a, W-93)
# ============================================================================
# DoD §5: test NHÚNG. Verify acceptance DB-level:
#   1. V015 apply forward-only + idempotent (re-apply 2× không lỗi).
#   2. Partition tháng hiện tại (2026m06) + kế (2026m07) tồn tại.
#   3. INSERT trace (super) cho tenant demo thành công + landing đúng partition.
#   4. CROSS-TENANT RLS (tenant-gate ADR-052): icp_app NOBYPASSRLS —
#      - no GUC → 0 row (fail-closed);
#      - SET app.tenant_id=demo → thấy row vừa insert (>0);
#      - SET app.tenant_id=foreign → 0 row (KHÔNG đọc trace tenant khác = LEAK).
#      RLS-aware: ĐỌC qua icp_app + SET app.tenant_id tường minh (CLAUDE.md §5).
#
# Yêu cầu: postgres container chạy + V015 trong infra/migrations/.
# Chạy:
#   PGCONTAINER=icp-postgres bash infra/migrations/tests/test_v015_llm_traces.sh
# ============================================================================
set -euo pipefail

PGCONTAINER="${PGCONTAINER:-icp-postgres}"
SUPER_URL="${DATABASE_URL_MIGRATE:-postgresql://icp:icp_dev_password@localhost:5432/icp}"
APP_URL="${DATABASE_URL_APP:-postgresql://icp_app:icp_app_dev_password@localhost:5432/icp}"
DEMO='11111111-1111-1111-1111-111111111111'
FOREIGN='22222222-2222-2222-2222-222222222222'
MIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/V015__llm_traces.sql"

fail() { echo "FAIL: $*" >&2; exit 1; }
q_super() { docker exec -i "$PGCONTAINER" psql "$SUPER_URL" -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }
q_app() { docker exec -i "$PGCONTAINER" psql "$APP_URL" -t -A -v ON_ERROR_STOP=1 "$@"; }
apply_v015() { docker exec -i "$PGCONTAINER" psql "$SUPER_URL" -v ON_ERROR_STOP=1 -f - < "$MIG_FILE" >/dev/null; }

echo "== V015 llm_traces test =="

# --- Test 1: apply forward-only + idempotent (re-apply 2×) ---
apply_v015
apply_v015
apply_v015
echo "ok 1: V015 apply 3× idempotent — 0 lỗi"

# --- Test 2: partition tháng hiện (m06) + kế (m07) tồn tại ---
for P in llm_traces_y2026m06 llm_traces_y2026m07; do
  N=$(q_super "SELECT count(*) FROM pg_class WHERE relname='$P';")
  [ "$N" = "1" ] || fail "partition $P không tồn tại"
done
echo "ok 2: partition m06 + m07 tồn tại"

# --- demo tenant phải có row trong tenants (V011) ---
[ "$(q_super "SELECT count(*) FROM tenants WHERE id='$DEMO';")" = "1" ] \
  || fail "tenant demo không tồn tại (chạy apply.sh trước)"

# --- Test 3: INSERT trace demo (super) landing đúng partition m06 ---
RID="test-v015-$$"
q_super "INSERT INTO llm_traces (tenant_id, intent_type, rid, provider, model, tokens_in, tokens_out, cost_usd, latency_ms, status, created_at) VALUES ('$DEMO', 'importing_by_images', '$RID', 'gemini', 'gemini-2.0-flash', 100, 50, 0.000125, 320, 'ok', '2026-06-15T00:00:00Z');" >/dev/null
LANDED=$(q_super "SELECT count(*) FROM llm_traces_y2026m06 WHERE rid='$RID';")
[ "$LANDED" = "1" ] || fail "INSERT không landing partition m06 (partition routing sai)"
echo "ok 3: INSERT trace demo → landing partition m06"

# --- Test 4a: icp_app NOBYPASSRLS, no GUC → 0 row (fail-closed) ---
NOGUC=$(q_app -c "SELECT count(*) FROM llm_traces WHERE rid='$RID';")
[ "$NOGUC" = "0" ] || fail "no-GUC SELECT trả $NOGUC row (RLS không fail-closed)"
echo "ok 4a: icp_app no-GUC → 0 row (fail-closed)"

# --- Test 4b: SET demo → thấy row (>0) ---
DEMO_N="$(q_app -c "SET app.tenant_id='$DEMO'; SELECT count(*) FROM llm_traces WHERE rid='$RID';" | tail -n1)"
[ "$DEMO_N" = "1" ] || fail "demo tenant thấy $DEMO_N row (mong đợi 1)"
echo "ok 4b: SET demo → thấy trace vừa insert"

# --- Test 4c: CROSS-TENANT — SET foreign → 0 row (KHÔNG đọc trace demo) ---
FOR_N="$(q_app -c "SET app.tenant_id='$FOREIGN'; SELECT count(*) FROM llm_traces WHERE rid='$RID';" | tail -n1)"
[ "$FOR_N" = "0" ] || fail "foreign tenant đọc được $FOR_N trace demo (CROSS-TENANT LEAK)"
echo "ok 4c: SET foreign → 0 row (cross-tenant isolation, tenant-gate ADR-052)"

# --- Cleanup ---
q_super "DELETE FROM llm_traces WHERE rid='$RID';" >/dev/null
echo "ok: cleanup test row"

echo "== PASS 4/4 (DB-level, cross-tenant RLS assert) =="
