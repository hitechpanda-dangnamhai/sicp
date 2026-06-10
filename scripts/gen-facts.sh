#!/usr/bin/env bash
# gen-facts.sh v2 — sinh docs/FACTS.md từ code/DB thật. CẤM SỬA FACTS.md TAY.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="docs/FACTS.md"; mkdir -p docs
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
{
echo "# FACTS — generated ${ts} by scripts/gen-facts.sh — DO NOT EDIT BY HAND"
echo
echo "## Migrations   <!-- ls infra/migrations/*.sql -->"
for f in infra/migrations/V*.sql; do echo "- $(basename "$f")"; done
echo "- highest: V$(ls infra/migrations/V*.sql | sed -E 's/.*V([0-9]+)__.*/\1/' | sort -n | tail -1)"
echo
echo "## Gateway routes   <!-- grep @Get/@Post/@Patch/@Delete/@Put trong *.controller.ts -->"
total=0
for c in $(find apps/gateway/src -name "*.controller.ts" | sort); do
  name=$(basename "$c" .controller.ts)
  n=$(grep -cE "@(Get|Post|Patch|Delete|Put)\(" "$c" || true)
  routes=$(grep -oE "@(Get|Post|Patch|Delete|Put)\('?[^)']*'?\)" "$c" | tr '\n' ' ' || true)
  echo "- ${name}: ${n} route — ${routes}"; total=$((total+n))
done
echo "- TOTAL: ${total} route / $(find apps/gateway/src -name '*.controller.ts' | wc -l) controller"
echo
echo "## AI graphs   <!-- ls apps/ai/src/graphs/intents/*.py -->"
for g in apps/ai/src/graphs/intents/*.py; do b=$(basename "$g" .py); [ "$b" = "__init__" ] && continue; echo "- ${b}"; done
echo "- TOTAL: $(ls apps/ai/src/graphs/intents/*.py | grep -vc __init__) graph"
echo
echo "## MCP tools   <!-- grep 'register(\"' apps/mcp/src -->"
echo "- TOTAL: $(grep -rhoE 'register\("[^"]+"' apps/mcp/src --include="*.py" | sort -u | wc -l) tool (unique)"
grep -rhoE 'register\("[^"]+"' apps/mcp/src --include="*.py" | sed 's/register("/- /; s/"$//' | sort -u
echo
echo "## DB   <!-- docker exec icp-postgres psql; fallback parse migrations -->"
PGC="icp-postgres"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$PGC"; then
  PGU=$(docker exec "$PGC" sh -c 'echo "${POSTGRES_USER:-postgres}"')
  PGD=$(docker exec "$PGC" sh -c 'echo "${POSTGRES_DB:-$POSTGRES_USER}"'); PGD=${PGD:-$PGU}
  Q(){ docker exec "$PGC" psql -U "$PGU" -d "$PGD" -Atc "$1"; }
  echo "- nguồn: ★ DB LIVE (container ${PGC}, db ${PGD})"
  echo "- tables: $(Q "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
  Q "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" | sed 's/^/  - /'
  echo "- matviews: $(Q "select count(*) from pg_matviews where schemaname='public'")"
  Q "select matviewname from pg_matviews where schemaname='public' order by 1" | sed 's/^/  - /'
  echo "- migrations applied: $(Q "select count(*) from schema_migrations" 2>/dev/null || echo '? (bảng schema_migrations không đọc được)')"
  echo "- cột tenant_id: $(Q "select count(*) from information_schema.columns where table_schema='public' and column_name='tenant_id'")"
else
  echo "- nguồn: parse migrations (DB OFFLINE — verify lại khi DB chạy)"
  grep -rhoiE "CREATE TABLE (IF NOT EXISTS )?[a-z_]+" infra/migrations/*.sql | awk '{print $NF}' | sort -u | sed 's/^/  - /'
  echo "- cột tenant_id: $(grep -rhoc "tenant_id" infra/migrations/*.sql | paste -sd+ | bc) lần trong migrations"
fi
echo
echo "## Frontend (apps/web)   <!-- find app -name page.tsx; ls components -->"
echo "- pages (App Router): $(find apps/web/app \( -name 'page.tsx' -o -name 'page.ts' \) | wc -l)"
find apps/web/app \( -name "page.tsx" -o -name "page.ts" \) | sed 's|apps/web/app||; s|/page\.tsx$||; s|/page\.ts$||; s|^$|/ (root)|' | sort | sed 's/^/  - /'
echo "- components/ui (shadcn): $(ls apps/web/components/ui/*.tsx 2>/dev/null | wc -l) file"
for d in atoms molecules organisms layout; do
  echo "- components/icp/${d}: $(find apps/web/components/icp/${d} -name '*.tsx' 2>/dev/null | wc -l) file"
done
echo "- e2e specs: $(find apps/web/e2e -name '*.spec.ts' 2>/dev/null | wc -l)"
echo "- unit/__tests__: $(find apps/web/__tests__ -name '*.test.*' 2>/dev/null | wc -l)"
echo
echo "## Vespa rank-profiles   <!-- grep rank-profile product.sd -->"
grep -E "^\s*rank-profile" infra/vespa/schemas/product.sd | sed -E 's/^\s*rank-profile\s+([a-z_]+).*/- \1/' | sort -u
echo
echo "## Workers   <!-- ls apps/workers/src -->"
for w in apps/workers/src/*; do echo "- $(basename "$w")"; done
echo
echo "## Kafka   <!-- grep kafkajs package.json + docker ps redpanda -->"
if grep -rq "kafkajs" apps --include="package.json" 2>/dev/null; then
  echo "- app: WIRED"
else
  echo "- app: CHƯA WIRE (0 package.json import kafkajs)"
fi
docker ps --format '{{.Names}}' 2>/dev/null | grep -q redpanda && echo "- broker: container redpanda ĐANG CHẠY (infra có, app chưa dùng)" || true
echo
echo "<!-- END FACTS -->"
} > "$OUT"
echo "✔ wrote ${OUT} ($(wc -l < "$OUT") dòng)"
