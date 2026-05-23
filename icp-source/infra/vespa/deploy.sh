#!/usr/bin/env bash
# ============================================================================
# infra/vespa/deploy.sh
# ============================================================================
# Vespa application package deploy script.
#
# Slice: S-00b Foundation Scaffold, Task T06 Vespa Schema (Phiên 9 LOCKED).
#
# Builds zip of infra/vespa/ contents (schemas/ + services.xml + hosts.xml),
# POSTs to Vespa config server REST API at :19071, and verifies activation.
# Idempotent — Vespa config server handles versioning via session-id.
#
# Usage:
#   ./deploy.sh                                          # uses default VESPA_CONFIG_SERVER
#   VESPA_CONFIG_SERVER=http://localhost:19071 ./deploy.sh   # host-mode override
#
# Default VESPA_CONFIG_SERVER=http://vespa:19071 — Docker compose service name
# resolution (T08 docker-compose.yml will define service `vespa`). Override
# to http://localhost:19071 when running from host with vespa container
# port-forwarded.
#
# Q-3 A resolution (Phiên 9): zip command unconditionally includes hosts.xml
# because Q-1 α emits hosts.xml as a permanent application-package member.
# No HOSTS_XML env var gating (skeleton variant superseded by Q-3 A ack).
#
# Make this file executable post-checkout: chmod +x infra/vespa/deploy.sh
# (mode bit may not persist through artifact download; verify after copy).
# ============================================================================

set -euo pipefail

VESPA_DIR="$(dirname "$0")"
VESPA_CONFIG_SERVER="${VESPA_CONFIG_SERVER:-http://vespa:19071}"
APP_ZIP="/tmp/icp-vespa-app.zip"

echo "Building Vespa app package from $VESPA_DIR ..."
cd "$VESPA_DIR"
rm -f "$APP_ZIP"
zip -r "$APP_ZIP" schemas/ services.xml hosts.xml 2>&1 | tail -5

echo "Waiting for Vespa config server at $VESPA_CONFIG_SERVER ..."
for i in $(seq 1 60); do
  if curl -sf "$VESPA_CONFIG_SERVER/state/v1/health" >/dev/null 2>&1; then
    echo "Vespa config server ready."
    break
  fi
  sleep 2
done

echo "Deploying to $VESPA_CONFIG_SERVER ..."
curl -X POST -H "Content-Type: application/zip" \
  --data-binary "@$APP_ZIP" \
  "$VESPA_CONFIG_SERVER/application/v2/tenant/default/prepareandactivate" \
  | tee /tmp/vespa-deploy-response.json

echo ""

if grep -q '"session-id"' /tmp/vespa-deploy-response.json; then
  echo "Deploy succeeded."
else
  echo "Deploy may have failed. Check response:"
  cat /tmp/vespa-deploy-response.json
  exit 1
fi
