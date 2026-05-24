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
#   ./deploy.sh                                       # uses default VESPA_CONFIG_SERVER (host-mode)
#   VESPA_CONFIG_SERVER=http://vespa:19071 ./deploy.sh   # docker-network mode (e.g., CI runner inside Docker network)
#
# Default VESPA_CONFIG_SERVER=http://localhost:19071 — host-mode (running from
# the dev machine with `make vespa-deploy`). Vespa container exposes port
# 19071 to host per docker-compose.yml ports mapping. Override to
# http://vespa:19071 when this script runs from inside another container
# on the `icp` Docker network (CI runners, internal jobs) where the service
# DNS name `vespa` resolves.
#
# v3 amendment (Phiên Sx04-2 Bước 4 mid-smoke reality finding): default
# was `http://vespa:19071` (v1/v2) but that breaks `make vespa-deploy` from
# host shell where DNS `vespa` does not resolve. Default flipped to
# `localhost:19071`; CI/container override path kept available.
#
# Q-3 A resolution (Phiên 9): zip command unconditionally includes hosts.xml
# because Q-1 α emits hosts.xml as a permanent application-package member.
# No HOSTS_XML env var gating (skeleton variant superseded by Q-3 A ack).
#
# S-04 T01 amendment (Phiên Sx04-2, D-S04-10 LAW): zip command now includes
# `models/` directory. Vespa `hugging-face-embedder` component (services.xml)
# resolves `<transformer-model path="models/clip_multilingual/model.onnx"/>`
# RELATIVE TO THE DEPLOYED APPLICATION PACKAGE, not container FS. The model
# files MUST be inside this zip. Binary files generated via
# `infra/vespa/models/clip_multilingual/EXPORT.md` `optimum-cli` command —
# verify existence before running this script (or zip will succeed with
# empty models/ directory and Vespa container will fail at boot).
#
# S-04 T01 v2 amendment (Phiên Sx04-2 Bước 4 mid-smoke reality findings):
# Two operational bugs discovered when deploying with actual 540MB model.onnx:
#   1. `zip -r ... models/` includes Python venv `.venv-onnx/` if dev placed
#      it there per EXPORT.md v2 recommendation — inflates zip 520MB → 3.4GB
#      (97k files). Fix: add `-x "models/**/.venv*/*"` etc. exclusion patterns.
#   2. `curl --data-binary "@$APP_ZIP"` loads entire 520MB+ zip into curl
#      memory before HTTP send → `curl: option --data-binary: out of memory`
#      on Ubuntu 24 curl 8.5. Fix: switch to `--upload-file` (streaming),
#      Vespa official Deploy REST API pattern.
# Both fixes are defense-in-depth: even with EXPORT.md v3 directing venv
# location elsewhere, the exclusion pattern prevents accidental bloat.
#
# S-04 T01 v4 amendment (Phiên Sx04-2 Bước 4 attempt #5 reality finding):
# Vespa schema validator rejects indexing expression CHANGE on existing field
# (text_embedding switched from plain tensor → synthetic with embed) because
# stale tokens in existing index could corrupt. Fix: add conditional include
# of `validation-overrides.xml` (Vespa-blessed dev pattern with expiry date).
# Override file kept separate from main zip command so absence doesn't abort
# builds — required ONLY for the schema migration deploy, removable once
# schema stable. See infra/vespa/validation-overrides.xml + Vespa docs:
# https://docs.vespa.ai/en/reference/applications/validation-overrides.html
#
# Make this file executable post-checkout: chmod +x infra/vespa/deploy.sh
# (mode bit may not persist through artifact download; verify after copy).
# ============================================================================

set -euo pipefail

VESPA_DIR="$(dirname "$0")"
VESPA_CONFIG_SERVER="${VESPA_CONFIG_SERVER:-http://localhost:19071}"
APP_ZIP="/tmp/icp-vespa-app.zip"

echo "Building Vespa app package from $VESPA_DIR ..."
cd "$VESPA_DIR"
rm -f "$APP_ZIP"
# S-04 T01 Phiên Sx04-2 deploy.sh v2 — zip exclusion pattern:
# Models directory may contain dev artifacts that MUST NOT be packaged:
#   - .venv-onnx/, venv/, .venv*/    Python venvs from EXPORT.md procedure
#   - __pycache__/, *.pyc            Python bytecode cache
#   - .DS_Store, Thumbs.db           OS metadata noise
# Including these inflates zip from ~520MB → 3.4GB+ (97k+ files) and breaks
# curl --data-binary with out-of-memory + breaks Vespa session prepare with
# too-many-files limits. Defense-in-depth: even if EXPORT.md v3 recommends
# venv path OUTSIDE models/ dir, this exclusion ensures clean zip if a dev
# violates the convention.
zip -r "$APP_ZIP" schemas/ services.xml hosts.xml models/ \
  -x "models/**/.venv*/*" \
  -x "models/**/__pycache__/*" \
  -x "models/**/*.pyc" \
  -x "models/**/.DS_Store" \
  -x "models/**/Thumbs.db" \
  2>&1 | tail -10
# S-04 T01 Phiên Sx04-2 deploy.sh v4 — add validation-overrides.xml if exists.
# This file is conditional (present for S-04 T01 indexing-change migration;
# removable after schema stable). Add separately from main zip command so
# missing file doesn't abort the build. Vespa app package treats it as
# optional metadata file.
if [ -f validation-overrides.xml ]; then
  zip -u "$APP_ZIP" validation-overrides.xml 2>&1 | tail -2
  echo "validation-overrides.xml included in app package."
fi
echo "Zip size: $(du -h "$APP_ZIP" | cut -f1)"

echo "Waiting for Vespa config server at $VESPA_CONFIG_SERVER ..."
for i in $(seq 1 60); do
  if curl -sf "$VESPA_CONFIG_SERVER/state/v1/health" >/dev/null 2>&1; then
    echo "Vespa config server ready."
    break
  fi
  sleep 2
done

echo "Deploying to $VESPA_CONFIG_SERVER ..."
# S-04 T01 Phiên Sx04-2 deploy.sh v2 — curl streaming pattern.
# Original `--data-binary "@$APP_ZIP"` reads entire zip into curl memory
# before HTTP send → fails with "out of memory" on ~520MB+ zips (verified
# on Ubuntu 24 curl 8.5). Vespa official Deploy REST API docs recommend
# pipe-stdin streaming via `--data-binary @-`. We use `--upload-file`
# (alias `-T`) which is the canonical curl streaming POST/PUT — handles
# arbitrarily-large files via chunked transfer encoding, constant memory.
# `--max-time 600` = 10 min ceiling (model upload + Vespa internal validation
# of 540MB ONNX can take 3-5 min on first deploy).
curl -X POST -H "Content-Type: application/zip" \
  --upload-file "$APP_ZIP" \
  --max-time 600 \
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
