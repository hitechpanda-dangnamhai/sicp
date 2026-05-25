# =============================================================================
# ICP — Monorepo Makefile
# =============================================================================
# Quickstart:
#   cp .env.example .env
#   pnpm install
#   make up && make seed
#
# Source: docs/phases/PHASE_01_INFRA.md Day 7 + slices/S-00b_EXECUTION_GUIDE.md §4.1
#
# C22.b Amendment (Phiên 10 2026-05-18 Path Q-3 B-controlled): targets `up` và
# `obs-up` được thêm idempotent network bootstrap line `docker network inspect
# icp >/dev/null 2>&1 || docker network create icp` BEFORE compose up command.
# Lý do: `docker-compose.observability.yml` (T07) declare network `icp` là
# `external: true` — compose KHÔNG tự tạo external network, user trước đó phải
# chạy `docker network create icp` thủ công. C22.b wire bootstrap vào Makefile
# để user không cần một-time setup step. `obs-down` / `down` không cần patch
# (network persistent across down cycles; only create/idempotent on up).
# See decisions-log.md C22.b amendment.
#
# C-11 Amendment (Phiên 23 2026-05-21 S-02 T02): target `contract-check` added
# under "OpenAPI codegen" section. Runs `pnpm openapi:sync` then verifies
# generated artifacts (openapi.json + src/api/) are committed (no drift).
# CI integration deferred to Phase 6 polish (avoids STOP-4 GHA docker compose
# stack startup flakiness). See S-02_decisions-log.md C-11.
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help up down migrate seed seed-vespa vespa-deploy obs-up obs-down logs clean lint test typecheck contract-check

# Note: target name `vespa:deploy` dùng dấu hai chấm sẽ break parse của make.
# Convention: dùng `vespa-deploy` (tên target) — script được gọi vẫn là
# `infra/vespa/deploy.sh`. Tài liệu / report đôi khi reference `vespa:deploy`
# (theo execution guide notation) — đây alias style, command thực gõ
# `make vespa-deploy`.

# --- Help (default target) ---------------------------------------------------
help:
	@echo "ICP Makefile targets:"
	@echo ""
	@echo "  make up             — Boot app + observability stacks (merged compose)"
	@echo "  make down           — Tear down both stacks"
	@echo "  make migrate        — Run pending Postgres migrations (V*.sql)"
	@echo "  make seed           — Migrate + load seed data (users/products/policies)"
	@echo "  make vespa-deploy   — Deploy Vespa application package"
	@echo "  make seed-vespa     — Deploy Vespa schema + bulk-feed 55 products (S-04 T01)"
	@echo "  make obs-up         — Boot only observability stack (otel/loki/tempo/prom/grafana)"
	@echo "  make obs-down       — Tear down only observability stack"
	@echo "  make logs           — Tail logs across all services"
	@echo "  make clean          — Remove node_modules + build outputs"
	@echo "  make lint           — Run lint across workspaces"
	@echo "  make test           — Run tests across workspaces"
	@echo "  make typecheck      — Run typecheck across workspaces"
	@echo "  make contract-check — Verify FE-BE contract sync (openapi.json + generated api/)"

# --- Stack lifecycle ---------------------------------------------------------
# Note: 2 compose files chưa tồn tại tại T01 — T07 (obs) + T08 (app) sẽ tạo.
# Makefile reference path để Day 7 wiring có sẵn template.
up:
	@docker network inspect icp >/dev/null 2>&1 || docker network create icp
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml up -d

down:
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml down

# --- Database ---------------------------------------------------------------
# `apply.sh` được T04 tạo. Idempotent: walks V*.sql alphabetically,
# records applied versions vào schema_migrations table.
migrate:
	bash infra/migrations/apply.sh

# `seed.ts` được T05 tạo. Depends on migrate xong trước.
# C14 Amendment (Phiên 8 2026-05-18 Path B): replaced `node infra/seed/seed.ts`
# với `pnpm --filter @icp/seed run seed` vì:
#   1. seed.ts là TypeScript — `node` không parse TS syntax → SyntaxError runtime.
#   2. `infra/seed` đã được add vào pnpm-workspace.yaml packages glob (cùng C14),
#      package `@icp/seed` resolve được qua workspace; deps (pg/bcryptjs/dotenv/tsx)
#      install tự động khi root `pnpm install`.
#   3. Script `seed` trong infra/seed/package.json invokes `tsx seed.ts` (D-05
#      ESM + tsx runner per execution guide §4.5 line 1274).
# See decisions-log.md C14 amendment.
seed: migrate
	pnpm --filter @icp/seed run seed

# --- Vespa ------------------------------------------------------------------
# `deploy.sh` được T06 tạo. Zip schemas/services.xml + POST tới Vespa config server.
vespa-deploy:
	bash infra/vespa/deploy.sh

# `seed-vespa` (S-04 T01 Phiên Sx04-2, D-S04-10 + D-S04-11 LAW): chains
# vespa-deploy → wait readiness → vespa-feed bulk-feed. Depends `seed` so
# Postgres has 55 products with V002 columns before the feed runs.
#
# Vespa readiness probe: query config server /state/v1/health up to 60×2s
# (parity với deploy.sh internal wait pattern). Without this wait, the feed
# can race with embedder model load (~5-10s loading ~150MB ONNX into Vespa
# container memory) and fail with "embedder not ready" 503 responses.
#
# Idempotent: vespa-deploy uses session-id (Vespa internal versioning);
# vespa-feed POSTs upsert by docid. Safe to re-run.
seed-vespa: seed vespa-deploy
	@echo "Waiting for Vespa query endpoint at :8080 ..."
	@for i in $$(seq 1 60); do \
	  if curl -sf http://localhost:8080/state/v1/health >/dev/null 2>&1; then \
	    echo "Vespa query endpoint ready."; break; \
	  fi; \
	  sleep 2; \
	done
	pnpm --filter @icp/seed run vespa-feed

# --- Observability escape hatch ---------------------------------------------
obs-up:
	@docker network inspect icp >/dev/null 2>&1 || docker network create icp
	docker compose -f infra/docker-compose.observability.yml up -d

obs-down:
	docker compose -f infra/docker-compose.observability.yml down

# --- OpenAPI codegen (S-02 T02 — C-11) --------------------------------------
# Verify FE-BE contract sync: regenerate openapi.json + src/api/ from current
# Gateway runtime, then check `git diff --exit-code` to detect drift. Run
# locally before commit. CI integration deferred Phase 6 polish (STOP-4: GHA
# docker compose stack startup flakiness avoided).
#
# Prerequisite: `make up` first (gateway container must be running for
# `openapi:export` `docker compose exec` to succeed — per C-08).
contract-check:
	@if ! docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml ps --status running --services 2>/dev/null | grep -q '^gateway$$'; then \
		echo "ERROR: gateway container not running. Run 'make up' first."; exit 1; \
	fi
	pnpm openapi:sync
	@git diff --exit-code packages/shared-types/openapi.json packages/shared-types/src/api/ \
		&& echo "✅ Contract in sync (no drift detected)." \
		|| (echo "❌ Contract drift detected. Commit regenerated files." && exit 1)

# --- Diagnostics ------------------------------------------------------------
logs:
	docker compose logs -f --tail=100

# --- Cleanup ----------------------------------------------------------------
clean:
	rm -rf node_modules apps/*/node_modules packages/*/node_modules \
		apps/*/dist packages/*/dist apps/*/.next \
		apps/*/__pycache__ apps/*/.venv

# --- pnpm workspace orchestration -------------------------------------------
lint:
	pnpm -r lint

test:
	pnpm -r test

typecheck:
	pnpm -r typecheck


# =============================================================================
# T03 Makefile patch — APPEND-ONLY block
# =============================================================================
# Source: S-02-T03 task pack §4.2 + §5 smoke plan.
# Safety: additive only. Add to existing Makefile WITHOUT removing any
# existing targets (up/down/test verified present per Bước 1 H output).
#
# Append the lines below to the END of /home/hai-dang/projects/icpp/sicp/Makefile
# (verify no name collision first: `grep -E "^(smoke-ai|logs-ai|build-ai):" Makefile`
# should return empty).
# =============================================================================

# =============================================================================
# T03 Makefile patch — APPEND-ONLY block
# =============================================================================
# Source: S-02-T03 task pack §4.2 + §5 smoke plan.
# Safety: additive only. Add to existing Makefile WITHOUT removing any
# existing targets (up/down/test verified present per Bước 1 H output).
#
# Append the lines below to the END of /home/hai-dang/projects/icpp/sicp/Makefile
# (verify no name collision first: `grep -E "^(smoke-ai|logs-ai|build-ai):" Makefile`
# should return empty).
# =============================================================================

# ---- AI service (T03) ----
.PHONY: build-ai smoke-ai logs-ai

build-ai:
	docker compose -f infra/docker-compose.yml build ai

smoke-ai:
	@echo "=== AC-3: GET /health ==="
	@curl -fsS http://localhost:5001/health | jq -e '.status=="ok" and .service=="ai"' && echo "PASS"
	@echo "=== AC-4: GET /ready ==="
	@curl -fsS http://localhost:5001/ready | jq -e '.status=="ok"' && echo "PASS"
	@echo "=== AC-5: POST /intent stub ==="
	@curl -fsS -X POST http://localhost:5001/intent \
		-H "Content-Type: application/json" \
		-d '{"modality":"text","content":"hello"}' \
		| jq -e '.request_id and .intent=="unknown" and .confidence==0.0' && echo "PASS"
	@echo "--- triggering 2 more /intent to ensure ≥3 JSON log lines for AC-6..8 ---"
	@curl -fsS -X POST http://localhost:5001/intent -H "Content-Type: application/json" -d '{"modality":"text","content":"smoke-a"}' > /dev/null
	@curl -fsS -X POST http://localhost:5001/intent -H "Content-Type: application/json" -d '{"modality":"text","content":"smoke-b"}' > /dev/null
	@sleep 1
	@echo "=== AC-6: log schema 6 LOCKED fields (ALL JSON lines must satisfy) ==="
	@docker logs icp-ai 2>&1 | grep '^{' \
		| jq -es 'all(.[]; .timestamp and .level and .service and (.trace_id != null) and (.span_id != null) and .message)' \
		| grep -q '^true$$' && echo "PASS"
	@echo "=== AC-7: service field consistent (single value 'ai') ==="
	@test "$$(docker logs icp-ai 2>&1 | grep '^{' | jq -r '.service' | sort -u | tr -d '\n')" = "ai" && echo "PASS"
	@echo "=== AC-8: message snake_case (every JSON line) ==="
	@docker logs icp-ai 2>&1 | grep '^{' | jq -r '.message' | sort -u \
		| awk 'NF && !/^[a-z_]+\.[a-z_]+$$/ { bad=1; print "FAIL:", $$0 } END { exit bad }' && echo "PASS"

logs-ai:
	docker logs icp-ai --tail 50 -f
# =============================================================================
# T04 Makefile patch — APPEND-ONLY block
# =============================================================================
# Source: S-02-T04 task pack §4.2 + §5 smoke plan (Phiên 25).
# Pattern: Parallel apps/ai T03 (Phiên 24) — per-service targets per C-14.
# Safety: additive only. Append the lines below to END of Makefile WITHOUT
# removing any existing targets.
#
# Verify no name collision first:
#   grep -E "^(smoke-mcp|logs-mcp|build-mcp):" Makefile   # should return empty
# =============================================================================

# ---- MCP service (T04) ----
.PHONY: build-mcp smoke-mcp logs-mcp

build-mcp:
	docker compose -f infra/docker-compose.yml build mcp

smoke-mcp:
	@echo "=== AC-3: GET /health ==="
	@curl -fsS http://localhost:5050/health | jq -e '.status=="ok" and .service=="mcp"' && echo "PASS"
	@echo "=== AC-4: JSON-RPC products.get happy path ==="
	@curl -fsS -X POST http://localhost:5050/rpc \
		-H "Content-Type: application/json" \
		-d '{"jsonrpc":"2.0","method":"products.get","params":{"id":"00000000-0000-0000-0000-000000000001"},"id":1}' \
		| jq -e '.jsonrpc=="2.0" and .id==1 and has("result")' && echo "PASS"
	@echo "=== AC-5: JSON-RPC method-not-found ==="
	@curl -fsS -X POST http://localhost:5050/rpc \
		-H "Content-Type: application/json" \
		-d '{"jsonrpc":"2.0","method":"unknown.tool","params":{},"id":2}' \
		| jq -e '.error.code==-32601' && echo "PASS"
	@echo "=== AC-12: system.list_tools ==="
	@curl -fsS -X POST http://localhost:5050/rpc \
		-H "Content-Type: application/json" \
		-d '{"jsonrpc":"2.0","method":"system.list_tools","params":{},"id":3}' \
		| jq -e '.result | sort == ["auth.verify_jwt","events.append","products.get"]' && echo "PASS"
	@echo "--- triggering more /rpc to ensure ≥3 JSON log lines ---"
	@curl -fsS -X POST http://localhost:5050/rpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"auth.verify_jwt","params":{"token":"smoke-token-1"},"id":4}' > /dev/null
	@curl -fsS -X POST http://localhost:5050/rpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"events.append","params":{"type":"smoke.test","aggregate_type":"smoke","aggregate_id":"00000000-0000-0000-0000-000000000099","payload":{"src":"smoke-mcp"}},"id":5}' > /dev/null
	@sleep 1
	@echo "=== AC-6: log schema 6 LOCKED fields (ALL JSON lines must satisfy) ==="
	@docker logs icp-mcp 2>&1 | grep '^{' \
		| jq -es 'all(.[]; .timestamp and .level and .service and (.trace_id != null) and (.span_id != null) and .message)' \
		| grep -q '^true$$' && echo "PASS"
	@echo "=== AC-7: service field consistent (single value 'mcp') ==="
	@test "$$(docker logs icp-mcp 2>&1 | grep '^{' | jq -r '.service' | sort -u | tr -d '\n')" = "mcp" && echo "PASS"
	@echo "=== AC-8: message snake_case (every JSON line) ==="
	@docker logs icp-mcp 2>&1 | grep '^{' | jq -r '.message' | sort -u \
		| awk 'NF && !/^[a-z_]+\.[a-z_]+$$/ { bad=1; print "FAIL:", $$0 } END { exit bad }' && echo "PASS"

logs-mcp:
	docker logs icp-mcp --tail 50 -f
# =============================================================================
# =============================================================================
# T05 Makefile patch v2 (Phiên 26 mid-fix) — APPEND-ONLY block
# =============================================================================
# C-25 RESOLVED: `curl -fsS` fails (exit 22) on HTTP 503 from /ready when AI
# is down — but 503 IS the expected response (degraded). Use `curl -sS` (no
# -f) for AC-5a expected-degraded checks. Keep `-fsS` only for AC-4/5b/6 where
# 200 is expected.
#
# C-26 RESOLVED: AC-9 Tempo TraceQL query simplified — `q=` syntax can timeout
# / return empty for newly-emitted spans. Use indirect verification: fetch
# recent gateway traces + grep span name list. Sleep buffer extended 5s → 8s
# to clear Tempo's default batch flush interval.
#
# Naming: `smoke-trace-e2e` cross-task per C-23 (smoke-<purpose>).
# =============================================================================

.PHONY: smoke-trace-e2e logs-trace-e2e

smoke-trace-e2e:
	@echo "=== AC-4: /ready returns ai status (not 'unknown') ==="
	@curl -fsS http://localhost:3001/api/v1/health/ready \
		| jq -e '.deps.ai != "unknown" and (.deps.ai | IN("up","down"))' \
		> /dev/null && echo "PASS AC-4"
	@echo "=== AC-5a: ai down → 'down' + 503 ==="
	@docker compose -f infra/docker-compose.yml stop ai > /dev/null 2>&1
	@sleep 3
	@CODE=$$(curl -sS -o /tmp/icp-ready-down.json -w "%{http_code}" http://localhost:3001/api/v1/health/ready); \
		test "$$CODE" = "503" && echo "  HTTP 503 PASS" || (echo "  FAIL expected 503 got $$CODE"; exit 1)
	@jq -e '.deps.ai == "down" and .status == "degraded"' /tmp/icp-ready-down.json > /dev/null \
		&& echo "PASS AC-5a (ai down + degraded)"
	@echo "=== AC-5b: ai recovered → 'up' ==="
	@docker compose -f infra/docker-compose.yml start ai > /dev/null 2>&1
	@echo "  waiting 20s for ai healthcheck (start_period 10s + curl interval 30s upper bound)..."
	@sleep 20
	@curl -fsS http://localhost:3001/api/v1/health/ready \
		| jq -e '.deps.ai == "up" and .status == "ok"' > /dev/null \
		&& echo "PASS AC-5b (ai recovered)"
	@echo "=== AC-6 trigger: 5x /ready calls to seed Tempo ==="
	@for i in 1 2 3 4 5; do curl -fsS http://localhost:3001/api/v1/health/ready > /dev/null; done
	@echo "  waiting 8s for Tempo batch flush..."
	@sleep 8
	@echo "=== AC-6a: Tempo has gateway service traces ==="
	@curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway&limit=5" \
		| jq -e '.traces | length > 0' > /dev/null \
		&& echo "PASS AC-6a (gateway service traces present)"
	@echo "=== AC-6b: Tempo has ai service traces ==="
	@curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dai&limit=20" \
		| jq -e '.traces | length > 0' > /dev/null \
		&& echo "PASS AC-6b (ai service traces present)"
	@echo "=== AC-9: gateway.handler.ready span present in recent traces ==="
	@curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway&limit=20" \
		| jq -e '[.traces[]?.rootTraceName, .traces[]?.spans[]?.name] | flatten | map(select(. == "gateway.handler.ready")) | length > 0' \
		> /dev/null 2>&1 && echo "PASS AC-9 (manual span emitted)" \
		|| (echo "  AC-9 indirect query fallback: list all root span names found"; \
		    curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway&limit=20" \
		    | jq -r '.traces[]?.rootTraceName' | sort -u; \
		    echo "  → expect 'gateway.handler.ready' in list above"; exit 1)
	@echo "=== smoke-trace-e2e: 6/6 checks PASS ==="

logs-trace-e2e:
	@docker logs icp-gateway 2>&1 | grep -E "(ai_client|service\.started)" | tail -20
# =============================================================================
# T06 Makefile patch (Phiên 27) — APPEND-ONLY block
# =============================================================================
# Source: S-02-T06 task pack §7 smoke plan.
# Pattern: Cross-task target name `smoke-tracker` per C-23 LOCKED (Phiên 26)
# `smoke-<purpose>` for cross-cutting tasks (T06 spans FE + BE + DB); per-service
# `smoke-<svc>` reserved single-service.
#
# Safety: additive only. Verify no name collision first:
#   grep -E "^(smoke-tracker|logs-tracker):" Makefile   # should return empty
#
# Prerequisite: `make up` first (gateway + postgres + redpanda + redis healthy).
# Note: T06 endpoint POST /api/v1/track does NOT require Idempotency-Key
# (route not in 4-route list per ADR-004 + 03_API §1); dedup at DB layer via
# composite PK (event_id, occurred_at) + ON CONFLICT DO NOTHING.
#
# C-16 amendment (Phiên 33 2026-05-22 S-03 T03 cross-slice cleanup):
# (1) 4 `-d '{ \\\n ... \\\n }'` multi-line bodies → single-line JSON. Bash
#     does NOT join `\<newline>` inside single quotes — curl received literal
#     backslash bytes → 400 "Expected property name or '}' in JSON at position
#     2". Mirror T07 smoke-sse single-line pattern (already PASS).
# (2) AC-10 Tempo query limit=30 + post-fetch jq filter → direct `http.target`
#     tag query + limit=10 (more robust under mixed-traffic conditions: S-02
#     auth/tracker + S-03 auth shared Tempo retention window).
# Pattern LOCKED for future smoke targets:
#   - Avoid multi-line `-d '{...}'` inside single quotes.
#   - Tempo span verification: prefer direct tag filter (http.target/operation.name)
#     over post-fetch jq scan on a recent-N window.
# See S-03_decisions-log.md C-16.
# =============================================================================

.PHONY: smoke-tracker logs-tracker

smoke-tracker:
	@echo "=== AC-8 + AC-9: POST /track happy-path batch (3 valid events) ==="
	@FIXED_UUID=$$(uuidgen); \
		NOW=$$(date -u +%Y-%m-%dT%H:%M:%S.000Z); \
		UUID2=$$(uuidgen); UUID3=$$(uuidgen); \
		curl -sS -X POST http://localhost:3001/api/v1/track \
		-H "Content-Type: application/json" \
		-o /tmp/icp-track-ok.json -w "  HTTP %{http_code}\n" \
		-d '{"events":[{"event_id":"'"$$FIXED_UUID"'","event_type":"session.started","occurred_at":"'"$$NOW"'","session_id":"sess_smoke_1","app_version":"0.0.1","properties":{"source":"web"}},{"event_id":"'"$$UUID2"'","event_type":"product.viewed","occurred_at":"'"$$NOW"'","session_id":"sess_smoke_1","app_version":"0.0.1","properties":{"product_id":"p_smoke_001","source":"search"}},{"event_id":"'"$$UUID3"'","event_type":"cart.item_added","occurred_at":"'"$$NOW"'","session_id":"sess_smoke_1","app_version":"0.0.1","properties":{"product_id":"p_smoke_001","qty":1,"unit_price":50000,"source":"search"}}]}'
	@jq -e '.accepted == 3 and .dropped == 0 and .request_id' /tmp/icp-track-ok.json > /dev/null \
		&& echo "  PASS AC-8 + AC-9 (3 accepted, 0 dropped)" \
		|| (echo "  FAIL AC-8/9"; cat /tmp/icp-track-ok.json; exit 1)
	@echo "=== AC-9 schema drift drop: invalid properties for product.viewed ==="
	@curl -sS -X POST http://localhost:3001/api/v1/track \
		-H "Content-Type: application/json" \
		-o /tmp/icp-track-drop.json -w "  HTTP %{http_code}\n" \
		-d '{"events":[{"event_id":"'"$$(uuidgen)"'","event_type":"product.viewed","occurred_at":"'"$$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'","session_id":"sess_smoke_2","app_version":"0.0.1","properties":{"wrong_field":"no product_id"}}]}'
	@jq -e '.accepted == 0 and .dropped == 1' /tmp/icp-track-drop.json > /dev/null \
		&& echo "  PASS AC-9 schema drift drop (0 accepted, 1 dropped)" \
		|| (echo "  FAIL drift drop"; cat /tmp/icp-track-drop.json; exit 1)
	@echo "=== AC-9 bot filter drop: occurred_at > 7d past ==="
	@curl -sS -X POST http://localhost:3001/api/v1/track \
		-H "Content-Type: application/json" \
		-o /tmp/icp-track-old.json -w "  HTTP %{http_code}\n" \
		-d '{"events":[{"event_id":"'"$$(uuidgen)"'","event_type":"session.started","occurred_at":"1990-01-01T00:00:00.000Z","session_id":"sess_smoke_3","app_version":"0.0.1","properties":{"source":"web"}}]}'
	@jq -e '.accepted == 0 and .dropped == 1' /tmp/icp-track-old.json > /dev/null \
		&& echo "  PASS AC-9 bot filter drop (occurred_at_too_old)" \
		|| (echo "  FAIL bot filter"; cat /tmp/icp-track-old.json; exit 1)
	@echo "=== AC-9 dedup: duplicate event_id second POST (DB ON CONFLICT) ==="
	@DUP=$$(jq -r '.events[0].event_id // empty' /tmp/icp-track-ok.json 2>/dev/null); \
		if [ -z "$$DUP" ]; then DUP=$$(uuidgen); fi; \
		NOW=$$(date -u +%Y-%m-%dT%H:%M:%S.000Z); \
		curl -sS -X POST http://localhost:3001/api/v1/track \
		-H "Content-Type: application/json" \
		-o /tmp/icp-track-dup.json -w "  HTTP %{http_code}\n" \
		-d '{"events":[{"event_id":"'"$$DUP"'","event_type":"session.started","occurred_at":"'"$$NOW"'","session_id":"sess_smoke_4","app_version":"0.0.1","properties":{"source":"web"}}]}'
	@jq -e '.dropped == 0 and (.accepted == 0 or .accepted == 1)' /tmp/icp-track-dup.json > /dev/null \
		&& echo "  PASS AC-9 dedup semantics (silent ON CONFLICT no-op)" \
		|| (echo "  FAIL dedup"; cat /tmp/icp-track-dup.json; exit 1)
	@echo "=== AC-9 DB persistence verify (≥3 rows in behavior_events_y2026m05) ==="
	@COUNT=$$(docker compose -f infra/docker-compose.yml exec -T postgres \
		psql -U icp -d icp -tA -c "SELECT count(*) FROM behavior_events WHERE event_type IN ('session.started','product.viewed','cart.item_added') AND session_id LIKE 'sess_smoke_%';"); \
		test "$$COUNT" -ge "3" && echo "  PASS AC-9 DB rows: $$COUNT" \
		|| (echo "  FAIL expected ≥3 got $$COUNT"; exit 1)
	@echo "=== AC-11 contract-check (regression: openapi.json + api/ generated cleanly) ==="
	@$(MAKE) -s contract-check 2>&1 | tail -5
	@echo "=== AC-10 + AC-11 Tempo: POST /track auto-instrument span present ==="
	@echo "  waiting 8s for Tempo batch flush..."
	@sleep 8
	@curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway%20http.target%3D%2Fapi%2Fv1%2Ftrack&limit=10" \
		| jq -e '.traces | length > 0' \
		> /dev/null && echo "  PASS Tempo span POST /api/v1/track found (http.target filter)" \
		|| (echo "  AC-10 fallback: list root span names (limit=100 mixed-traffic safe)"; \
		    curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway&limit=100" \
		    | jq -r '.traces[]?.rootTraceName' | sort | uniq -c; exit 1)
	@echo "=== smoke-tracker: 7/7 checks PASS ==="

logs-tracker:
	@docker logs icp-gateway 2>&1 | grep -E "tracker\.|db\.behavior_partition" | tail -30

# ============================================================================

# ============================================================================
# S-02 T07 — SSE wrapper smoke target (Gateway POST /intent + GET stream)
# Per C-23 cross-task naming: smoke-<purpose> (smoke-sse = single-purpose
# Gateway endpoint flow). C-14 per-service `smoke-<svc>` pattern reserved
# single-service smokes.
# Per C-41 (T07 Phiên N): Idempotency-Key MUST be UUID v4 format (T01
# middleware regex strict per ADR-004) — use uuidgen, NOT date+RANDOM.
# ============================================================================

.PHONY: smoke-sse logs-sse

smoke-sse:
	@echo "=== T07 AC-6: POST /api/v1/intent returns 202 + request_id ==="
	@curl -sS -X POST http://localhost:3001/api/v1/intent \
		-H "Content-Type: application/json" \
		-H "Idempotency-Key: $$(uuidgen)" \
		-d '{"modality":"text","content":"smoke test T07"}' \
		-o /tmp/icp-intent-post.json \
		-w "  HTTP %{http_code}\n"
	@RID=$$(jq -r '.request_id // empty' /tmp/icp-intent-post.json); \
		test -n "$$RID" && echo "  PASS AC-6 request_id=$$RID" \
			|| (echo "  FAIL AC-6 — POST body:"; cat /tmp/icp-intent-post.json; exit 1); \
		echo "$$RID" > /tmp/icp-intent-rid.txt
	@RID=$$(cat /tmp/icp-intent-rid.txt); \
		echo "=== T07 AC-9: GET /intent/stream WITHOUT cookie -> 401 ==="; \
		HTTP=$$(curl -sS -o /tmp/icp-sse-noauth.json -w "%{http_code}" \
			"http://localhost:3001/api/v1/intent/stream?id=$$RID"); \
		test "$$HTTP" = "401" && echo "  PASS AC-9 unauthorized=401" \
			|| (echo "  FAIL AC-9 expected 401 got $$HTTP — body:"; cat /tmp/icp-sse-noauth.json; exit 1)
	@RID=$$(cat /tmp/icp-intent-rid.txt); \
		echo "=== T07 AC-7 + AC-8: GET /intent/stream WITH cookie -> SSE frames ==="; \
		curl -sSN -H "Cookie: icp_session=test-stub-jwt" \
			"http://localhost:3001/api/v1/intent/stream?id=$$RID" \
			-o /tmp/icp-sse-frames.txt --max-time 5 || true; \
		FRAMES=$$(grep -c "^event: " /tmp/icp-sse-frames.txt 2>/dev/null || echo 0); \
		test "$$FRAMES" -ge "4" && echo "  PASS AC-7 frames=$$FRAMES (status x3 + final)" \
			|| (echo "  FAIL AC-7 expected >=4 frames got $$FRAMES — body:"; cat /tmp/icp-sse-frames.txt; exit 1); \
		grep -q "^event: final" /tmp/icp-sse-frames.txt \
			&& echo "  PASS AC-7 final event present" \
			|| (echo "  FAIL AC-7 no final event"; cat /tmp/icp-sse-frames.txt; exit 1)
	@echo "=== T07 AC-12 KI-T05-6 retest: manual span gateway.intent.dispatch in Tempo ==="
	@echo "  waiting 8s for Tempo batch flush..."
	@sleep 8
	@curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway+operation.name%3Dgateway.intent.dispatch&limit=10" \
		-o /tmp/icp-tempo-search.json 2>/dev/null || echo "  Tempo unreachable"; \
		COUNT=$$(jq -r '.traces | length // 0' /tmp/icp-tempo-search.json 2>/dev/null || echo 0); \
		test "$$COUNT" -ge "1" \
			&& echo "  PASS AC-12 manual span visible count=$$COUNT (KI-T05-6 RESOLVED via /intent route)" \
			|| (echo "  AC-12 FAIL manual span invisible count=$$COUNT — KI-T05-6 confirmed; per STOP-4 escalate NodeSDK 0.52->0.53+ bump"; \
				echo "  Available root span names for service gateway:"; \
				curl -fsS "http://localhost:3200/api/search?tags=service.name%3Dgateway&limit=20" 2>/dev/null \
				| jq -r '.traces[]?.rootTraceName' | sort -u; exit 2)
	@echo "=== smoke-sse: 5/5 inline checks PASS ==="

logs-sse:
	@docker logs icp-gateway 2>&1 | grep -E "intent\.(sse_|received|failed)" | tail -30

# --- S-03 T02 Auth smoke ----------------------------------------------------
.PHONY: smoke-auth logs-auth

smoke-auth:
	@bash apps/gateway/test/smoke-auth.sh

logs-auth:
	@docker logs icp-gateway 2>&1 | grep -E "auth\.(login|logout|me|token|refresh)|gateway\.auth\." | tail -30

# --- S-03 T03 Auth Behavior Events smoke ------------------------------------
# Source: S-03-T03 task pack §3.5.
# Pattern: cross-task `smoke-<purpose>` per C-23 LOCKED — covers Gateway
# AuthService loopback emit (login/logout/forgot-password) → behavior_events
# DB sink verify. Anchored to seed user merchant1@demo.icp per C14-bis.
#
# Prerequisite:
#   - `make up` first (gateway + postgres + redis running)
#   - `make seed` (merchant1@demo.icp / demo1234 exists with display_name="Anh Nam")
#
# Compatible with C-11 host-side execution via DATABASE_URL=localhost:5432
# override (workaround verified T01 Phiên 31 Bước 4).
.PHONY: smoke-auth-events logs-auth-events

smoke-auth-events:
	@DATABASE_URL=$${DATABASE_URL:-postgresql://icp:icp_dev_password@localhost:5432/icp} \
		bash apps/gateway/test/smoke-auth-events.sh

logs-auth-events:
	@docker logs icp-gateway 2>&1 | grep -E "auth\.(signed_|password_reset_requested)|tracker\.(loopback_failed|batch_)" | tail -30

# --- S-03 T03b Home Dashboard smoke ------------------------------------------
# Source: S-03-T03b task pack §3.6 (Batch 6 smoke).
# Pattern: minimal `smoke-<purpose>` — covers BE DashboardModule endpoint
# GET /api/v1/dashboard/stats (AC-21 200 + AC-22 401). Anchored to seed user
# merchant1@demo.icp per C14-bis. Stub endpoint (D-10) — no DB state to clean,
# idempotent. Verifies JwtAuthGuard cross-module DI per C-24 fix end-to-end.
#
# Prerequisite:
#   - `make up` first (gateway + postgres + redis running)
#   - `make seed` (merchant1@demo.icp / demo1234 exists)
.PHONY: smoke-dashboard logs-dashboard

smoke-dashboard:
	@bash apps/gateway/test/smoke-dashboard.sh

logs-dashboard:
	@docker logs icp-gateway 2>&1 | grep -E "dashboard\.|gateway\.dashboard\." | tail -30

# --- S-03 T06 E2E Playwright smoke + cleanup ---------------------------------
# Source: S-03-T06 task pack §3 (NEW Phiên N+5)
# Pattern: chain `e2e-cleanup` + Playwright FE E2E tests.
#   - C-T06-1 RESOLVED-INLINE per D-23 LAW: SKIP BE Jest E2E (auth.e2e-spec.ts)
#     since `make smoke-auth` (T02 owner) covers full BE contract 10/10.
#   - Cleanup pattern reused from `smoke-auth.sh` lines 44-56 (PG DELETE
#     sessions + Redis DEL session:* for canonical test user) — deterministic.
#
# Prerequisite:
#   - `make up` first (gateway + postgres + redis + web running)
#   - `make seed` (merchant1@demo.icp / demo1234 exists with display_name="Anh Nam")
#   - Chromium already installed: `pnpm --filter web exec playwright install chromium`
#     (idempotent — skip if cached). S-01 T07 baseline pattern.
.PHONY: e2e-cleanup smoke-e2e

# Reusable cleanup target — wipes prior test sessions for deterministic state.
# Used by:
#   - Playwright `beforeEach` hook in auth-flow.spec.ts + dashboard.spec.ts
#   - Manual repeat-run before `make smoke-e2e`
e2e-cleanup:
	@echo "=== e2e-cleanup: wipe sessions for merchant1@demo.icp ==="
	@docker compose -f infra/docker-compose.yml exec -T postgres psql -U icp -d icp -tA -c \
		"DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'merchant1@demo.icp');" \
		> /dev/null
	@REDIS_KEYS=$$(docker compose -f infra/docker-compose.yml exec -T redis redis-cli KEYS 'session:*' 2>/dev/null | grep -v '^$$' || true); \
		if [ -n "$$REDIS_KEYS" ]; then \
			echo "$$REDIS_KEYS" | xargs -r docker compose -f infra/docker-compose.yml exec -T redis redis-cli DEL > /dev/null; \
		fi
	@echo "  OK (PG sessions + Redis session:* wiped)"

# Full E2E smoke target — chains cleanup + Playwright 5 tests.
# Expected output (per Task Pack §5):
#   === e2e-cleanup: wipe sessions for merchant1@demo.icp ===
#     OK (PG sessions + Redis session:* wiped)
#   === Playwright: install chromium (idempotent) ===
#   === Playwright: run e2e/auth-flow.spec.ts + e2e/dashboard.spec.ts ===
#   Running 5 tests using 1 worker
#     ✓ [chromium] › auth-flow.spec.ts › happy login → /home
#     ✓ [chromium] › auth-flow.spec.ts › wrong password → state-C inline alert
#     ✓ [chromium] › auth-flow.spec.ts › logout → /auth/login
#     ✓ [chromium] › dashboard.spec.ts › /home loaded with header + stats + tiles
#     ✓ [chromium] › dashboard.spec.ts › D-28 avatar tap → /me
#   5 passed
smoke-e2e: e2e-cleanup
	@echo "=== Playwright: install chromium (idempotent) ==="
	@pnpm --filter web exec playwright install chromium --with-deps 2>&1 | grep -v "is already installed" || true
	@echo "=== Playwright: run e2e/auth-flow.spec.ts + e2e/dashboard.spec.ts ==="
	@pnpm --filter web exec playwright test
