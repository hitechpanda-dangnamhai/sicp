# =============================================================================
# apps/workers/Dockerfile — ICP workers (housekeeper) — S-P0-02/T02
# =============================================================================
# Worker THẬT đầu tiên (BACKLOG #12). Chạy housekeeper.ts qua tsx (TS trực tiếp,
# ESM — nhất quán seed-shopee worker; single node process → SIGTERM tới được
# graceful shutdown). KHÔNG HTTP server → không EXPOSE/healthcheck port.
# Base: node:20-alpine (D-03 LOCKED Node 20 LTS, parity gateway).
# Build trong pnpm workspace để @opentelemetry/* resolve đúng root overrides.
# =============================================================================
# ──────── Stage 1: Builder ────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY apps/workers/package.json ./apps/workers/
# Install deps workers (incl dev — typecheck). Workers KHÔNG có @icp/* workspace dep.
RUN pnpm install --frozen-lockfile --filter @icp/workers...
COPY apps/workers ./apps/workers
# Typecheck (build artifact không dùng runtime — chạy qua tsx; tsc = gate type).
WORKDIR /workspace/apps/workers
RUN pnpm typecheck

# ──────── Stage 2: Runtime ────────
FROM node:20-alpine AS runtime
# S-P0-03/T01 deploy-drift gate (W-76): bake build commit → housekeeper.started
# log carries git_sha (workers have no HTTP surface).
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA
WORKDIR /workspace
# Copy WHOLE workspace từ builder (preserve pnpm .pnpm symlink store — parity
# gateway Dockerfile C-04). tsx + deps có sẵn.
COPY --from=builder /workspace ./
RUN addgroup -S icp && adduser -S icp -G icp && chown -R icp:icp /workspace
USER icp
WORKDIR /workspace/apps/workers
# Exec form → PID 1 nhận SIGTERM trực tiếp (graceful shutdown housekeeper.ts).
# node --import tsx = tsx ESM loader, chạy TS không build (tsx v4.7+).
CMD ["node", "--import", "tsx", "src/housekeeper.ts"]
