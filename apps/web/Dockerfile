# =============================================================================
# apps/web/Dockerfile — ICP Web (Next.js 14 standalone) production build
# =============================================================================
# Slice:    S-00b Foundation Scaffold (T08)
# Status:   OVERWRITES T03 stub. T03 file declared this overwrite sanctioned
#           ("T08 SẼ OVERWRITE FILE NÀY HOÀN TOÀN" — T03 Dockerfile line 8).
#
# Build context per Q-3 A LOCKED:
#   compose `web.build.context: ..` = monorepo root.
#   compose `web.build.dockerfile: apps/web/Dockerfile`.
# This is asymmetric vs gateway/ai/mcp (which use `context: ../apps/<svc>`)
# because Next.js multi-stage build needs to COPY pnpm-workspace.yaml + root
# package.json + packages/shared-types/package.json for workspace resolution.
# See `.dockerignore` at repo root (Q-7 A) to keep build context lean
# (excludes node_modules/.next/.git/docs/s00b-outputs).
#
# Source skeleton: slices/S-00b_EXECUTION_GUIDE.md Section 4.8 lines 2486-2525.
#
# Stage layout:
#   1. deps    — Resolve pnpm workspace deps for web + transitive shared-types.
#   2. builder — Build @icp/shared-types then @icp/web (Next.js standalone).
#   3. runner  — Minimal production image with server.js + static + public.
#
# Healthcheck targets `/api/health` per Q-1 A LOCKED (see
# app/api/health/route.ts).
# =============================================================================

# --- Stage 1: deps ----------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN pnpm install --frozen-lockfile

# --- Stage 2: builder -------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# shared-types is a workspace dep built before web (line below). Its per-package
# node_modules (pnpm symlinks → root .pnpm store, incl. zod) must be present or
# `pnpm --filter @icp/shared-types build` → tsc fails "Cannot find module 'zod'".
# Symmetric to the apps/web copy above. (.dockerignore excludes node_modules, so
# `COPY . .` below does NOT bring it from host — it must come from the deps stage.)
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN pnpm --filter @icp/shared-types build
# Same-origin proxy target for next.config.js `rewrites()`. Next bakes rewrite
# destinations into routes-manifest.json at BUILD time, so this must be set
# before `pnpm --filter @icp/web build`. In docker the web server proxies
# /api/v1/* to the gateway over the compose network (service DNS `gateway`),
# NOT localhost (which is the web container itself → ECONNREFUSED). Override at
# build with `--build-arg GATEWAY_PROXY_TARGET=...` if the gateway service name
# or port changes. NOT a NEXT_PUBLIC_ var → never inlined into the client bundle
# (browser SSE/fetch keep using localhost:3001 via the host port map).
ARG GATEWAY_PROXY_TARGET=http://gateway:3001
ENV GATEWAY_PROXY_TARGET=$GATEWAY_PROXY_TARGET
RUN pnpm --filter @icp/web build

# --- Stage 3: runner --------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
# S-P0-03/T01 deploy-drift gate (W-76): bake build commit → GET /api/health git_sha.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production

# Next.js standalone output produces:
#   .next/standalone/  → self-contained server.js + minimal node_modules
#   .next/static/      → static assets (chunked JS/CSS, optimized images)
#   public/            → user-provided static files (favicon, robots.txt, etc)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Healthcheck per D-02 (stateless tier) + Q-1 A (route `/api/health`).
# start-period=30s matches compose web service (Next.js cold-start buffer).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q -O- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
