#!/usr/bin/env bash
# =============================================================================
# apps/gateway/test/smoke-dashboard.sh
# =============================================================================
# S-03 T03b smoke test — exercises GET /api/v1/dashboard/stats end-to-end.
#
# Covers ACs:
#   - AC-21: GET /dashboard/stats với icp_session cookie → 200 + JSON shape
#            {orders_today, revenue_today, inventory_count, currency: "VND"}
#            matching D-10 stub hardcoded values (8 / 2_400_000 / 142 / VND)
#   - AC-22: GET /dashboard/stats WITHOUT cookie → 401 (JwtAuthGuard enforces)
#
# Pre-conditions:
#   - Gateway running on http://localhost:3001 (docker compose up gateway)
#   - Postgres + Redis up
#   - Seed user merchant1@demo.icp / demo1234 (per C14-bis baseline)
#
# Run via: make smoke-dashboard (from repo root)
#
# Determinism: stub endpoint returns fixed values (no DB state to clean).
# Idempotent — safe to run repeatedly.
#
# Exit non-zero on first failed AC; final summary line on full pass.
# =============================================================================

set -euo pipefail

BASE_URL="${ICP_GATEWAY_URL:-http://localhost:3001/api/v1}"
COOKIE_JAR=/tmp/icp-dashboard.jar
TMP_LOGIN=/tmp/icp-dashboard-login.json
TMP_STATS=/tmp/icp-dashboard-stats.json
TMP_STATS_NOAUTH=/tmp/icp-dashboard-stats-noauth.json

rm -f "$COOKIE_JAR" "$TMP_LOGIN" "$TMP_STATS" "$TMP_STATS_NOAUTH"

# =============================================================================
# AC-22 — GET /dashboard/stats WITHOUT cookie → 401
# =============================================================================
# Run BEFORE login (no cookie present anywhere). Verify JwtAuthGuard reject.
echo "=== AC-22: GET /dashboard/stats without cookie ==="
STATUS=$(curl -s -o "$TMP_STATS_NOAUTH" -w "%{http_code}" "$BASE_URL/dashboard/stats")
test "$STATUS" = "401" || { echo "  FAIL expected 401 got $STATUS"; cat "$TMP_STATS_NOAUTH"; exit 1; }
echo "  PASS AC-22 (401 without cookie)"

# =============================================================================
# AC-21 — Login + GET /dashboard/stats with cookie → 200 + shape
# =============================================================================
echo "=== AC-21.1: POST /auth/login (issue icp_session cookie) ==="
STATUS=$(curl -s -c "$COOKIE_JAR" -o "$TMP_LOGIN" -w "%{http_code}" \
  -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant1@demo.icp","password":"demo1234"}')
test "$STATUS" = "200" || { echo "  FAIL login expected 200 got $STATUS"; cat "$TMP_LOGIN"; exit 1; }
test -s "$COOKIE_JAR" || { echo "  FAIL no cookie jar written"; exit 1; }
grep -q "icp_session" "$COOKIE_JAR" || { echo "  FAIL icp_session cookie not in jar"; cat "$COOKIE_JAR"; exit 1; }
echo "  PASS login (200 + icp_session cookie issued)"

echo "=== AC-21.2: GET /dashboard/stats with cookie → 200 + JSON shape ==="
STATUS=$(curl -s -b "$COOKIE_JAR" -o "$TMP_STATS" -w "%{http_code}" "$BASE_URL/dashboard/stats")
test "$STATUS" = "200" || { echo "  FAIL expected 200 got $STATUS"; cat "$TMP_STATS"; exit 1; }
echo "  PASS HTTP 200 with cookie"

# Verify JSON shape — 4 required fields + correct types + D-10 hardcoded values
echo "=== AC-21.3: Verify JSON shape matches D-10 hardcoded stub ==="
ORDERS=$(jq -r '.orders_today' "$TMP_STATS")
REVENUE=$(jq -r '.revenue_today' "$TMP_STATS")
INVENTORY=$(jq -r '.inventory_count' "$TMP_STATS")
CURRENCY=$(jq -r '.currency' "$TMP_STATS")

test "$ORDERS" = "8" || { echo "  FAIL orders_today expected 8 got $ORDERS"; cat "$TMP_STATS"; exit 1; }
test "$REVENUE" = "2400000" || { echo "  FAIL revenue_today expected 2400000 got $REVENUE"; cat "$TMP_STATS"; exit 1; }
test "$INVENTORY" = "142" || { echo "  FAIL inventory_count expected 142 got $INVENTORY"; cat "$TMP_STATS"; exit 1; }
test "$CURRENCY" = "VND" || { echo "  FAIL currency expected VND got $CURRENCY"; cat "$TMP_STATS"; exit 1; }
echo "  PASS shape match (orders=8, revenue=2400000, inventory=142, currency=VND)"

# =============================================================================
# AC-21.4 — Idempotency check: stub returns SAME values on second call
# =============================================================================
echo "=== AC-21.4: Second call returns deterministic same values ==="
STATUS2=$(curl -s -b "$COOKIE_JAR" -o "$TMP_STATS.2" -w "%{http_code}" "$BASE_URL/dashboard/stats")
test "$STATUS2" = "200" || { echo "  FAIL second call expected 200 got $STATUS2"; exit 1; }
diff <(jq -S . "$TMP_STATS") <(jq -S . "$TMP_STATS.2") > /dev/null || \
  { echo "  FAIL second call returned different JSON"; diff <(jq -S . "$TMP_STATS") <(jq -S . "$TMP_STATS.2"); exit 1; }
rm -f "$TMP_STATS.2"
echo "  PASS idempotent (same JSON on repeat call)"

echo ""
echo "=== smoke-dashboard: 5/5 checks PASS ==="
