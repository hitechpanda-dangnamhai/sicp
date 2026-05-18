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
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help up down migrate seed vespa-deploy obs-up obs-down logs clean lint test typecheck

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
