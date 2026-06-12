#!/usr/bin/env bash
# scripts/gate-tenant-routes.sh
#
# S-P0-01 T02b-3 (ADR-046 amend d) — grep gate: 0 hardcoded tenant route
# `/home` | `/intent-<n>` (flat) ngoài helper `tenantHref()` + middleware
# `LEGACY_REDIRECTS` map. Mọi nav tenant-scoped phải qua tenantHref() để carry
# slug `/s/<slug>` (route nested mới `/intent/0X` dùng `/` nên không match dash).
#
# Loại trừ: comment (`*` `/*` `/**` `//`), `*.module.css` import, `app/dev/*`
# (dev global), dòng dùng `tenantHref(`, `middleware.ts` (redirect map nhà chính),
# `lib/tenant-href.ts` (helper nhà chính), `__tests__/*` (fixture test route).
set -uo pipefail
cd "$(dirname "$0")/.."

ROOTS="apps/web/app apps/web/components apps/web/lib apps/web/src"

hits=$(grep -rnE "(['\"\`])/(home|intent-[0-9])" $ROOTS \
        --include='*.tsx' --include='*.ts' 2>/dev/null \
        | grep -vE ':[0-9]+:[[:space:]]*(\*|//|/\*)' \
        | grep -vE '\.module\.css' \
        | grep -vE 'apps/web/app/dev/' \
        | grep -v 'tenantHref(' \
        | grep -vE 'apps/web/middleware\.ts:' \
        | grep -vE 'apps/web/lib/tenant-href\.ts:' \
        | grep -vE 'apps/web/__tests__/' \
        || true)

if [ -n "$hits" ]; then
  echo "::error::[gate-tenant-routes] hardcoded tenant route ngoài tenantHref()/middleware:"
  echo "$hits"
  echo "→ wrap qua tenantHref('/home'|'/intent/0X', slug); global context dùng lib/landing.ts."
  exit 1
fi
echo "[gate-tenant-routes] OK — 0 hardcoded /home|/intent-<n> ngoài helper + middleware."
