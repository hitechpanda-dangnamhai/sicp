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
.PHONY: help up down migrate seed vespa-deploy obs-up obs-down logs clean lint test typecheck contract-check

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
