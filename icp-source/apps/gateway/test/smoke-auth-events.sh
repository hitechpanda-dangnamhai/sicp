#!/usr/bin/env bash
# apps/gateway/test/smoke-auth-events.sh
#
# S-03 T03 smoke — verify 3 server-side behavior events emit from AuthService
# loopback via TrackingService.ingest() + POST /auth/forgot-password endpoint.
#
# Tests:
#   AC-12.a — login → behavior_events 1 row event_type='auth.signed_in'
#   AC-12.b — logout → behavior_events 1 row event_type='auth.signed_out'
#   AC-12.c + AC-13 — forgot-password → HTTP 200 {sent:true} + 1 row
#                      event_type='auth.password_reset_requested' user_id=NULL
#                      session_id='system' email_hash length=16
#   Idempotent — re-run 2× identical (DB exact match 3 inserted total)
#
# Pre-conditions:
#   - Postgres + Redis + Gateway up via docker compose
#   - V001..V009 migrations applied (T01 DONE)
#   - Phase 01 seed loaded — seed user merchant1@demo.icp / demo1234 exists
#
# Compatible with C-11 host-side execution: prefix DATABASE_URL=localhost:5432
# (workaround verified T01 Phiên 31 Bước 4).
#
# Run:
#   make smoke-auth-events
#
# Exits non-zero on any AC failure with diagnostic output.

set -euo pipefail

GW="${GW:-http://localhost:3001}"
EMAIL="merchant1@demo.icp"
PASSWORD="demo1234"
PGURL="${DATABASE_URL:-postgresql://icp:icp_dev_password@localhost:5432/icp}"

# Resolve test user_id from PG (matches seed merchant1@demo.icp)
USER_ID=$(psql "$PGURL" -tAc "SELECT id FROM users WHERE email='$EMAIL'")
if [ -z "$USER_ID" ]; then
  echo "FAIL: Seed user $EMAIL not found in users table — run 'make seed' first"
  exit 1
fi

echo "================================================================"
echo "S-03 T03 Smoke: AuthService behavior event loopback emit"
echo "User: $EMAIL ($USER_ID)"
echo "Gateway: $GW"
echo "================================================================"

# ─────────────────────────────────────────────────────────────────────
# Pre-cleanup — DELETE behavior_events for test scope + DEL Redis session:*
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "[Pre-cleanup] DELETE behavior_events for test scope + DEL Redis sessions"
psql "$PGURL" -c "DELETE FROM behavior_events WHERE user_id='$USER_ID' OR session_id='system';" > /dev/null
docker compose -f infra/docker-compose.yml exec -T redis sh -c \
  "redis-cli --scan --pattern 'session:*' | xargs -r redis-cli DEL" > /dev/null 2>&1 || true
echo "OK"

# ─────────────────────────────────────────────────────────────────────
# AC-12.a — login → emit auth.signed_in
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "[AC-12.a] POST /auth/login → emit auth.signed_in"

COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

LOGIN_RESP=$(curl -sS -X POST "$GW/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"remember_me\":false}" \
  -c "$COOKIE_JAR")
LOGIN_USER_ID=$(echo "$LOGIN_RESP" | jq -r '.user.id')
if [ "$LOGIN_USER_ID" != "$USER_ID" ]; then
  echo "FAIL: login returned user.id=$LOGIN_USER_ID, expected $USER_ID"
  echo "Response: $LOGIN_RESP"
  exit 1
fi
echo "OK login → user.id=$LOGIN_USER_ID"

# Allow ~250ms for fire-and-forget loopback ingest to complete
sleep 0.5

# Verify behavior_events row inserted
SIGNED_IN_COUNT=$(psql "$PGURL" -tAc \
  "SELECT count(*) FROM behavior_events WHERE event_type='auth.signed_in' AND user_id='$USER_ID';")
if [ "$SIGNED_IN_COUNT" != "1" ]; then
  echo "FAIL: behavior_events expected 1 row for auth.signed_in/user_id=$USER_ID, got $SIGNED_IN_COUNT"
  psql "$PGURL" -c "SELECT event_type, user_id, session_id, properties FROM behavior_events WHERE user_id='$USER_ID' ORDER BY occurred_at;"
  exit 1
fi
SIGNED_IN_METHOD=$(psql "$PGURL" -tAc \
  "SELECT properties->>'method' FROM behavior_events WHERE event_type='auth.signed_in' AND user_id='$USER_ID';")
if [ "$SIGNED_IN_METHOD" != "password" ]; then
  echo "FAIL: auth.signed_in.properties.method expected 'password', got '$SIGNED_IN_METHOD'"
  exit 1
fi
echo "OK behavior_events 1 row auth.signed_in {method:password}"

# ─────────────────────────────────────────────────────────────────────
# AC-12.b — logout → emit auth.signed_out
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "[AC-12.b] POST /auth/logout → emit auth.signed_out"

LOGOUT_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$GW/api/v1/auth/logout" \
  -b "$COOKIE_JAR")
if [ "$LOGOUT_STATUS" != "204" ]; then
  echo "FAIL: logout expected 204, got $LOGOUT_STATUS"
  exit 1
fi
echo "OK logout 204"

sleep 0.5

SIGNED_OUT_COUNT=$(psql "$PGURL" -tAc \
  "SELECT count(*) FROM behavior_events WHERE event_type='auth.signed_out' AND user_id='$USER_ID';")
if [ "$SIGNED_OUT_COUNT" != "1" ]; then
  echo "FAIL: behavior_events expected 1 row for auth.signed_out/user_id=$USER_ID, got $SIGNED_OUT_COUNT"
  exit 1
fi
SIGNED_OUT_PROPS=$(psql "$PGURL" -tAc \
  "SELECT properties::text FROM behavior_events WHERE event_type='auth.signed_out' AND user_id='$USER_ID';")
if [ "$SIGNED_OUT_PROPS" != "{}" ]; then
  echo "FAIL: auth.signed_out.properties expected '{}', got '$SIGNED_OUT_PROPS'"
  exit 1
fi
echo "OK behavior_events 1 row auth.signed_out {}"

# ─────────────────────────────────────────────────────────────────────
# AC-12.c + AC-13 — forgot-password → HTTP 200 + emit auth.password_reset_requested
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "[AC-12.c + AC-13] POST /auth/forgot-password → 200 + emit auth.password_reset_requested"

FORGOT_RESP=$(curl -sS -X POST "$GW/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}")
FORGOT_SENT=$(echo "$FORGOT_RESP" | jq -r '.sent')
if [ "$FORGOT_SENT" != "true" ]; then
  echo "FAIL: forgot-password expected {sent:true}, got: $FORGOT_RESP"
  exit 1
fi
echo "OK forgot-password 200 {sent:true}"

sleep 0.5

# Verify behavior_events row: user_id IS NULL + session_id='system' + email_hash length=16
RESET_COUNT=$(psql "$PGURL" -tAc \
  "SELECT count(*) FROM behavior_events WHERE event_type='auth.password_reset_requested' AND user_id IS NULL AND session_id='system';")
if [ "$RESET_COUNT" != "1" ]; then
  echo "FAIL: behavior_events expected 1 row auth.password_reset_requested with user_id=NULL session_id='system', got $RESET_COUNT"
  psql "$PGURL" -c "SELECT event_type, user_id, session_id, properties FROM behavior_events WHERE event_type='auth.password_reset_requested';"
  exit 1
fi
RESET_HASH_LEN=$(psql "$PGURL" -tAc \
  "SELECT length(properties->>'email_hash') FROM behavior_events WHERE event_type='auth.password_reset_requested' AND session_id='system';")
if [ "$RESET_HASH_LEN" != "16" ]; then
  echo "FAIL: auth.password_reset_requested.properties.email_hash expected length 16, got $RESET_HASH_LEN"
  exit 1
fi
echo "OK behavior_events 1 row auth.password_reset_requested {email_hash:<16-hex>}"

# ─────────────────────────────────────────────────────────────────────
# Final DB persistence verification (deterministic exact match)
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "[Final] DB persistence verify — exact 3 rows total for test scope"

TOTAL=$(psql "$PGURL" -tAc \
  "SELECT count(*) FROM behavior_events WHERE user_id='$USER_ID' OR session_id='system';")
if [ "$TOTAL" != "3" ]; then
  echo "FAIL: behavior_events expected 3 rows total (1 signed_in + 1 signed_out + 1 password_reset_requested), got $TOTAL"
  psql "$PGURL" -c "SELECT event_type, user_id, session_id, properties FROM behavior_events WHERE user_id='$USER_ID' OR session_id='system' ORDER BY occurred_at;"
  exit 1
fi
echo "OK behavior_events total=3 (deterministic)"

echo ""
echo "================================================================"
echo "ALL 4 ACs PASS (AC-12.a + AC-12.b + AC-12.c + AC-13)"
echo "Re-run identical for idempotent verify."
echo "================================================================"
