#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-live.sh — S-P0-03/T01 (W-76) deploy-drift + live smoke gate.
#
# WHY: S-P0-02/T06 shipped a cart→MCP identity fix but the mcp container wasn't
# redeployed → prod ran stale code while git looked correct. This script makes
# that class of failure LOUD: every service bakes GIT_SHA at build time and
# reports it (HTTP /health git_sha, or workers startup log), and we assert each
# running container's SHA matches the expected deploy SHA. Then a thin smoke of
# the core flows (health/login/intent/cart) confirms the deploy actually serves.
#
# USAGE (manual or CI deploy stage — needs the compose stack up):
#   EXPECTED_SHA=$(git rev-parse HEAD) bash scripts/smoke-live.sh
# Env knobs (defaults target local compose):
#   EXPECTED_SHA   commit every container must report   (default: git HEAD)
#   GATEWAY_URL    default http://localhost:3001
#   AI_URL         default http://localhost:5001
#   MCP_URL        default http://localhost:5050
#   WEB_URL        default http://localhost:3000
#   SMOKE_EMAIL / SMOKE_PASSWORD   demo creds for login/intent/cart smoke
#   SKIP_SMOKE=1   SHA-drift check only (skip login/intent/cart flows)
#   WORKERS_SVC    compose service name for the SHA-via-logs check (default workers)
# Exit non-zero on ANY drift or failed smoke assertion.
# =============================================================================
set -uo pipefail

EXPECTED_SHA="${EXPECTED_SHA:-$(git rev-parse HEAD 2>/dev/null || echo dev)}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
AI_URL="${AI_URL:-http://localhost:5001}"
MCP_URL="${MCP_URL:-http://localhost:5050}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
SMOKE_EMAIL="${SMOKE_EMAIL:-merchant1@demo.icp}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-demo1234}"
WORKERS_SVC="${WORKERS_SVC:-workers}"

fail=0
note() { printf '  %s\n' "$1"; }
err()  { printf '::error::%s\n' "$1"; fail=1; }

# first 7 hex chars — handles short/full SHA on either side.
short() { printf '%s' "$1" | tr -d '\r\n' | cut -c1-7; }
EXP_SHORT="$(short "$EXPECTED_SHA")"

echo "Deploy-drift check — expected SHA ${EXP_SHORT}"

# --- HTTP services: GET /health → .git_sha must match expected --------------
check_http() {
  local name="$1" url="$2"
  local body sha
  body="$(curl -fsS --max-time 5 "$url" 2>/dev/null)" || { err "$name: /health unreachable ($url)"; return; }
  sha="$(printf '%s' "$body" | sed -n 's/.*"git_sha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$sha" ]; then err "$name: /health has no git_sha field"; return; fi
  if [ "$sha" = "dev" ]; then err "$name: git_sha=dev (image not built with GIT_SHA build-arg)"; return; fi
  if [ "$(short "$sha")" != "$EXP_SHORT" ]; then
    err "$name: STALE container — git_sha $(short "$sha") != expected ${EXP_SHORT}"
  else
    note "$name: git_sha $(short "$sha") ✓"
  fi
}

check_http gateway "${GATEWAY_URL}/api/v1/health"
check_http ai      "${AI_URL}/health"
check_http mcp     "${MCP_URL}/health"
check_http web     "${WEB_URL}/api/health"

# --- workers: no HTTP → read git_sha from the housekeeper.started log -------
if command -v docker >/dev/null 2>&1; then
  wsha="$(docker compose logs "$WORKERS_SVC" 2>/dev/null | grep -o '"git_sha":"[^"]*"' | tail -1 | sed 's/.*:"\([^"]*\)"/\1/')"
  if [ -z "$wsha" ]; then
    note "workers: git_sha not found in logs (skip — service may be idle/absent)"
  elif [ "$(short "$wsha")" != "$EXP_SHORT" ]; then
    err "workers: STALE — log git_sha $(short "$wsha") != expected ${EXP_SHORT}"
  else
    note "workers: git_sha $(short "$wsha") ✓"
  fi
else
  note "workers: docker CLI absent — skipping log-based SHA check"
fi

# --- smoke the core flows (login → intent → cart) --------------------------
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  echo "Smoke flows"
  jar="$(mktemp)"
  trap 'rm -f "$jar"' EXIT
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 -c "$jar" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\"}" \
    "${GATEWAY_URL}/api/v1/auth/login" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    note "login: $code ✓"
    icode="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 -b "$jar" \
      -H 'Content-Type: application/json' -d '{"text":"smoke","mode":"basic_fallback"}' \
      "${GATEWAY_URL}/api/v1/intent" 2>/dev/null || echo 000)"
    case "$icode" in 200|201|202) note "intent: $icode ✓";; *) err "intent: $icode";; esac
    ccode="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 -b "$jar" \
      "${GATEWAY_URL}/api/v1/cart" 2>/dev/null || echo 000)"
    case "$ccode" in 200|404) note "cart: $ccode ✓";; *) err "cart: $ccode";; esac
  else
    err "login: $code (check SMOKE_EMAIL/PASSWORD + seed) — skipping intent/cart"
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "::error::smoke-live FAILED — stale container or broken flow above."
  exit 1
fi
echo "smoke-live OK — all containers at ${EXP_SHORT}, core flows serving."
