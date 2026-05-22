#!/usr/bin/env bash
# =============================================================================
# apps/gateway/test/smoke-auth.sh
# =============================================================================
# S-03 T02 smoke test — exercises 4 auth endpoints end-to-end via curl + jq.
#
# Pre-conditions:
#   - Gateway running on http://localhost:3001 (docker compose up gateway)
#   - Postgres + Redis up
#   - Seed user merchant1@demo.icp / demo1234 / display_name "Anh Nam"
#
# Run via: make smoke-auth (from repo root)
#
# Determinism strategy (v2 Phiên 32 fix):
#   - Pre-cleanup: DELETE PG sessions for test user + DEL Redis session:*
#     for our test user (idempotent — handles leftover state from prior runs).
#   - AC-2 also runs full login+logout cycle (no orphan session).
#   - Post-AC-5 DB check expects exact deterministic count: 4 total rows
#     (3 login + 1 refresh-new), 0 active (all revoked).
#
# Exit non-zero on first failed AC; final summary line on full pass.
# =============================================================================

set -euo pipefail

BASE_URL="${ICP_GATEWAY_URL:-http://localhost:3001/api/v1}"
COOKIE_JAR=/tmp/icp-auth.jar
COOKIE_JAR_AC2=/tmp/icp-auth-ac2.jar
COOKIE_JAR_OLD=/tmp/icp-auth-old.jar
TMP_LOGIN=/tmp/icp-auth-login.json
TMP_LOGIN_REM=/tmp/icp-auth-login-rem.json
TMP_LOGIN_BAD=/tmp/icp-auth-login-bad.json
TMP_ME=/tmp/icp-auth-me.json
TMP_REFRESH=/tmp/icp-auth-refresh.json
TMP_REPLAY=/tmp/icp-auth-replay.json
TMP_ME_AFTER=/tmp/icp-auth-me-after.json

DB_EXEC="docker compose -f infra/docker-compose.yml exec -T postgres psql -U icp -d icp"
REDIS_EXEC="docker compose -f infra/docker-compose.yml exec -T redis redis-cli"

rm -f "$COOKIE_JAR" "$COOKIE_JAR_AC2" "$COOKIE_JAR_OLD" \
  "$TMP_LOGIN" "$TMP_LOGIN_REM" "$TMP_LOGIN_BAD" \
  "$TMP_ME" "$TMP_REFRESH" "$TMP_REPLAY" "$TMP_ME_AFTER"

# =============================================================================
# Pre-cleanup — wipe prior test sessions for deterministic counts
# =============================================================================
echo "=== Pre-cleanup: wipe prior sessions for merchant1@demo.icp ==="
$DB_EXEC -tA -c \
  "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'merchant1@demo.icp');" \
  > /dev/null
# Redis: delete only session:* keys (preserve idem:* namespace per S-02 T01)
# Use plain KEYS (default raw) — outputs unquoted strings, one per line.
REDIS_KEYS=$($REDIS_EXEC KEYS 'session:*' 2>/dev/null | grep -v '^$' || true)
if [ -n "$REDIS_KEYS" ]; then
  # Pipe directly to xargs DEL — one key per arg, no quoting needed.
  echo "$REDIS_KEYS" | xargs -r $REDIS_EXEC DEL > /dev/null
fi
echo "  OK (PG sessions + Redis session:* wiped)"

# =============================================================================
# AC-1 — POST /auth/login happy path, remember_me=false
# =============================================================================
echo "=== AC-1: POST /auth/login (remember_me=false) ==="
STATUS=$(curl -sS -o "$TMP_LOGIN" -w '%{http_code}' \
  -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant1@demo.icp","password":"demo1234","remember_me":false}')
test "$STATUS" = "200" || { echo "  FAIL HTTP $STATUS"; cat "$TMP_LOGIN"; exit 1; }
jq -e '.user.email == "merchant1@demo.icp" and .user.display_name == "Anh Nam" and .user.avatar_initials == "AN" and .user.role == "merchant"' "$TMP_LOGIN" > /dev/null \
  || { echo "  FAIL user shape"; cat "$TMP_LOGIN"; exit 1; }
# Body must NOT contain access_token or refresh_token per S-03 C-01
jq -e '.access_token == null and .refresh_token == null' "$TMP_LOGIN" > /dev/null \
  || { echo "  FAIL body contains tokens (must be cookie-only per ADR-019)"; cat "$TMP_LOGIN"; exit 1; }
# Cookies set in jar
grep -q 'icp_session' "$COOKIE_JAR" || { echo "  FAIL icp_session cookie missing"; exit 1; }
grep -q 'icp_refresh' "$COOKIE_JAR" || { echo "  FAIL icp_refresh cookie missing"; exit 1; }
echo "  PASS AC-1 (200 + 2 cookies + body sans tokens)"

# Logout AC-1 jar to avoid orphan session (deterministic count strategy)
curl -sS -o /dev/null -b "$COOKIE_JAR" -X POST "$BASE_URL/auth/logout"
rm -f "$COOKIE_JAR"

# =============================================================================
# AC-2 — POST /auth/login with remember_me=true (cookie Max-Age check) + cleanup
# =============================================================================
echo "=== AC-2: POST /auth/login (remember_me=true → cookie Max-Age set) ==="
HEADERS_FILE=/tmp/icp-auth-login-rem-hdr.txt
STATUS=$(curl -sS -o "$TMP_LOGIN_REM" -D "$HEADERS_FILE" -w '%{http_code}' \
  -c "$COOKIE_JAR_AC2" \
  -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant1@demo.icp","password":"demo1234","remember_me":true}')
test "$STATUS" = "200" || { echo "  FAIL HTTP $STATUS"; cat "$TMP_LOGIN_REM"; exit 1; }
# When remember_me=true, Set-Cookie includes Max-Age attribute
grep -i '^set-cookie:.*icp_session.*max-age=' "$HEADERS_FILE" > /dev/null \
  || { echo "  FAIL Set-Cookie icp_session missing Max-Age"; cat "$HEADERS_FILE"; exit 1; }
grep -i '^set-cookie:.*icp_refresh.*max-age=' "$HEADERS_FILE" > /dev/null \
  || { echo "  FAIL Set-Cookie icp_refresh missing Max-Age"; cat "$HEADERS_FILE"; exit 1; }
echo "  PASS AC-2 (remember_me=true sets Max-Age on both cookies)"

# Logout AC-2 jar to avoid orphan session
curl -sS -o /dev/null -b "$COOKIE_JAR_AC2" -X POST "$BASE_URL/auth/logout"
rm -f "$COOKIE_JAR_AC2"

# =============================================================================
# AC-3 — Wrong password → 401, no cookies
# =============================================================================
echo "=== AC-3: POST /auth/login wrong password → 401 ==="
HEADERS_BAD=/tmp/icp-auth-bad-hdr.txt
STATUS=$(curl -sS -o "$TMP_LOGIN_BAD" -D "$HEADERS_BAD" -w '%{http_code}' \
  -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant1@demo.icp","password":"wrong_password","remember_me":false}')
test "$STATUS" = "401" || { echo "  FAIL HTTP $STATUS (expected 401)"; cat "$TMP_LOGIN_BAD"; exit 1; }
jq -e '.error.code == "UNAUTHORIZED"' "$TMP_LOGIN_BAD" > /dev/null \
  || { echo "  FAIL error shape"; cat "$TMP_LOGIN_BAD"; exit 1; }
# No Set-Cookie headers (case-insensitive scan)
if grep -i '^set-cookie:' "$HEADERS_BAD" > /dev/null; then
  echo "  FAIL Set-Cookie present on 401 (must not leak cookies)"; cat "$HEADERS_BAD"; exit 1
fi
echo "  PASS AC-3 (401 + no cookies)"

# =============================================================================
# AC-4 — GET /auth/me with valid cookie (fresh login)
# =============================================================================
echo "=== AC-4: GET /auth/me with icp_session cookie ==="
curl -sS -o /dev/null \
  -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant1@demo.icp","password":"demo1234","remember_me":false}'
STATUS=$(curl -sS -o "$TMP_ME" -w '%{http_code}' \
  -b "$COOKIE_JAR" \
  "$BASE_URL/auth/me")
test "$STATUS" = "200" || { echo "  FAIL HTTP $STATUS"; cat "$TMP_ME"; exit 1; }
jq -e '.email == "merchant1@demo.icp" and .display_name == "Anh Nam" and .avatar_initials == "AN" and .last_login_at != null' "$TMP_ME" > /dev/null \
  || { echo "  FAIL /me shape"; cat "$TMP_ME"; exit 1; }
echo "  PASS AC-4 (/me with cookie OK + avatar_initials + last_login_at)"

# /auth/me without cookie → 401
echo "=== AC-4b: GET /auth/me without cookie → 401 ==="
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/auth/me")
test "$STATUS" = "401" || { echo "  FAIL expected 401 got $STATUS"; exit 1; }
echo "  PASS AC-4b (/me without cookie → 401)"

# Logout AC-4 jar to maintain determinism
curl -sS -o /dev/null -b "$COOKIE_JAR" -X POST "$BASE_URL/auth/logout"
rm -f "$COOKIE_JAR"

# =============================================================================
# AC-6 — Rotating refresh + replay rejection
# =============================================================================
echo "=== AC-6: POST /auth/refresh (rotating) ==="
# Login fresh with rememberMe so refresh cookie persists in jar.
curl -sS -o /dev/null \
  -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"merchant1@demo.icp","password":"demo1234","remember_me":true}'
# Snapshot old jar so we can replay attack later.
cp "$COOKIE_JAR" "$COOKIE_JAR_OLD"

STATUS=$(curl -sS -o "$TMP_REFRESH" -w '%{http_code}' \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "$BASE_URL/auth/refresh")
test "$STATUS" = "200" || { echo "  FAIL refresh HTTP $STATUS"; cat "$TMP_REFRESH"; exit 1; }
jq -e '.ok == true' "$TMP_REFRESH" > /dev/null || { echo "  FAIL refresh body"; cat "$TMP_REFRESH"; exit 1; }
echo "  PASS AC-6.a (refresh 200 + new cookies issued)"

# Replay with OLD refresh cookie → 401
echo "=== AC-6.b: replay refresh with OLD cookie → 401 ==="
STATUS=$(curl -sS -o "$TMP_REPLAY" -w '%{http_code}' \
  -b "$COOKIE_JAR_OLD" \
  -X POST "$BASE_URL/auth/refresh")
test "$STATUS" = "401" || { echo "  FAIL replay expected 401 got $STATUS"; cat "$TMP_REPLAY"; exit 1; }
echo "  PASS AC-6.b (replay refresh rejected)"

# =============================================================================
# AC-5 — Logout invalidation (uses post-refresh jar)
# =============================================================================
echo "=== AC-5: POST /auth/logout ==="
HEADERS_LOGOUT=/tmp/icp-auth-logout-hdr.txt
STATUS=$(curl -sS -o /dev/null -D "$HEADERS_LOGOUT" -w '%{http_code}' \
  -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/auth/logout")
test "$STATUS" = "204" || { echo "  FAIL logout HTTP $STATUS"; cat "$HEADERS_LOGOUT"; exit 1; }
# Set-Cookie clear (Max-Age=0)
grep -i '^set-cookie:.*icp_session.*max-age=0' "$HEADERS_LOGOUT" > /dev/null \
  || { echo "  FAIL Set-Cookie icp_session clear missing"; cat "$HEADERS_LOGOUT"; exit 1; }
grep -i '^set-cookie:.*icp_refresh.*max-age=0' "$HEADERS_LOGOUT" > /dev/null \
  || { echo "  FAIL Set-Cookie icp_refresh clear missing"; cat "$HEADERS_LOGOUT"; exit 1; }
echo "  PASS AC-5.a (logout 204 + 2 clear cookies)"

# Subsequent /me with same jar → 401 (session revoked)
echo "=== AC-5.b: /me after logout → 401 (session revoked) ==="
STATUS=$(curl -sS -o "$TMP_ME_AFTER" -w '%{http_code}' \
  -b "$COOKIE_JAR" \
  "$BASE_URL/auth/me")
test "$STATUS" = "401" || { echo "  FAIL /me-after-logout expected 401 got $STATUS"; cat "$TMP_ME_AFTER"; exit 1; }
echo "  PASS AC-5.b (/me after logout rejected)"

# =============================================================================
# DB persistence verify — deterministic counts after full smoke run
# =============================================================================
# After full sequence, sessions table for test user should have:
#   1. AC-1 login         (revoked by AC-1 cleanup logout)
#   2. AC-2 login         (revoked by AC-2 cleanup logout)
#   3. AC-4 login         (revoked by AC-4 cleanup logout)
#   4. AC-6 login         (revoked by AC-6.a refresh)
#   5. AC-6.a refresh new (revoked by AC-5 logout)
# AC-3 wrong password creates no row. AC-6.b replay matches 0 rows (already
# revoked), creates no row.
# Expected: total=5, active=0
# =============================================================================
echo "=== DB persistence: sessions table state ==="
TOTAL=$($DB_EXEC -tA -c "SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE u.email = 'merchant1@demo.icp';" | tr -d '[:space:]')
ACTIVE=$($DB_EXEC -tA -c "SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE u.email = 'merchant1@demo.icp' AND s.revoked_at IS NULL;" | tr -d '[:space:]')
echo "  Total sessions for test user: $TOTAL"
echo "  Active (revoked_at IS NULL): $ACTIVE"
test "$TOTAL" = "5" || { echo "  FAIL expected 5 total rows got $TOTAL"; exit 1; }
test "$ACTIVE" = "0" || { echo "  FAIL expected 0 active rows got $ACTIVE"; exit 1; }
echo "  PASS DB state deterministic (5 total, 0 active)"

echo ""
echo "=== smoke-auth: 10/10 checks PASS ==="
