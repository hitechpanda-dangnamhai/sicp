# =============================================================================
# apps/gateway/Dockerfile — ICP API Gateway (S-02 T01)
# =============================================================================
# Stage:    S-02 T01 multi-stage build (Phiên 22 2026-05-21 — C-04 final)
# Patched:  S-02 T06 Phiên 27 — C-35 add shared-types build step before gateway.
# Replaces: S-00b T03 stub per PHASE_01_INFRA.md Day 3.
# Port:     3001 (per PHASE_01_INFRA.md line 28)
# Base:     node:20-alpine (per S-00b decisions-log D-03 — Node 20 LTS)
#
# Decisions applied:
#   - C26 LOCKED — HEALTHCHECK uses IPv4 127.0.0.1 (NOT IPv6 localhost).
#   - C-04 fix (Phiên 22) — Stage 2 copies WHOLE /workspace tree from
#     builder (preserves pnpm .pnpm symlink store + node_modules layout)
#     WITHOUT pruning dev deps. Image size impact: ~600MB final vs ~200MB
#     theoretical with pure prod deps; acceptable for Hackathon scope.
#
#     Why NOT `pnpm prune --prod`: pnpm prune is interactive (prompts
#     "modules will be removed and reinstalled") + reinstall depends on
#     workspace filter which fails ("No projects matched"). Pruning aggressive
#     can wipe node_modules entirely. Phase 06 polish: switch to `pnpm deploy
#     --filter @icp/gateway --prod /deploy` which exports a self-contained
#     prod-only directory.
#
#   - ADR-011 — OTel SDK first-import requires dist/observability/otel.js
#     present at runtime.
#
#   - C-35 (S-02 T06 Phiên 27) — Builder stage must build @icp/shared-types
#     FIRST so gateway TS compile can resolve `@icp/shared-types` package
#     `main`/`types` field which points to `dist/index.{js,d.ts}`. Without
#     this step gateway build fails TS2307 "Cannot find module
#     '@icp/shared-types'". T01-era Dockerfile didn't hit this because
#     gateway didn't yet import from shared-types. T06 is first BE consumer.
# =============================================================================
# ──────── Stage 1: Builder ────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
# Copy workspace manifests first for layer cache efficiency.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/shared-types/package.json ./packages/shared-types/
# Install ALL deps (incl. dev) — needed for build step.
RUN pnpm install --frozen-lockfile --filter @icp/gateway... --filter @icp/shared-types...
# Copy source.
COPY apps/gateway ./apps/gateway
COPY packages/shared-types ./packages/shared-types
# C-35 fix (T06 Phiên 27): Build shared-types FIRST so gateway's TS compile
# can resolve `@icp/shared-types` (root barrel re-exports primitives + dto +
# behavior) via package.json `main`/`types` → dist/index.{js,d.ts}.
RUN pnpm --filter @icp/shared-types build
# Build gateway → emits apps/gateway/dist/.
WORKDIR /workspace/apps/gateway
# S-P0-01/META #32 (bằng chứng smoke T02c 06-12): incremental tsc
# (tsconfig.tsbuildinfo) + docker layer cache → build CÓ cache ship dist STALE
# (deploy code cũ, header T02c vắng trên wire). Bảo đảm = CLEAN BUILD: rm mọi
# output cũ + `pnpm build` = `tsc -p tsconfig.build.json` (incremental:false) →
# emit tươi mỗi lần, không dựa cache/assert.
RUN rm -rf dist tsconfig.tsbuildinfo && pnpm build
# ──────── Stage 2: Runtime ────────
FROM node:20-alpine AS runtime
# S-P0-03/T01 deploy-drift gate (W-76): bake the build commit so the running
# container can report it (GET /api/v1/health → git_sha). scripts/smoke-live.sh
# compares it against HEAD to catch stale/un-redeployed images.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA
WORKDIR /workspace
# C-04 fix: Copy WHOLE workspace from builder. Docker COPY preserves
# symlinks by default → pnpm's .pnpm content-addressed store + symlink
# architecture in node_modules/ intact. NO pruning (see header comment).
COPY --from=builder /workspace ./
# Non-root user for principle-of-least-privilege.
RUN addgroup -S icp && adduser -S icp -G icp && chown -R icp:icp /workspace
USER icp
WORKDIR /workspace/apps/gateway
EXPOSE 3001
# Healthcheck per C26 — IPv4 127.0.0.1.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q -O- http://127.0.0.1:3001/api/v1/health || exit 1
# Start command. node direct (no pnpm wrapper), exec form for PID 1 signal forwarding.
CMD ["node", "/workspace/apps/gateway/dist/main.js"]
