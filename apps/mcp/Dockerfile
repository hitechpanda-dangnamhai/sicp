# =============================================================================
# apps/mcp/Dockerfile — ICP MCP Tool Server (T04 — C-21 fix Phiên 25)
# =============================================================================
# Replaces T03 stub. Real implementation: multi-stage build with Flask + OTel
# auto-instrumentation + JSON-RPC handler.
#
# C-21 fix (Phiên 25): CMD module path `mcp.server` → `src.server` to match
# T03 packages.find pattern (where=["."], include=["src", "src.*"]).
#
# Stage:    T04 C-21 fix
# Port:     5050 (per docs/phases/PHASE_01_INFRA.md line 30)
# Base:     python:3.11-slim
# Pattern:  Mirror apps/ai/Dockerfile (T03 Phiên 24 working) — 2 stages.
#
# Lessons applied:
#   - KI-T03-7: CMD pass explicit --host/--port
#   - KI-T03-12: HEALTHCHECK uses curl-fsS (curl already installed)
#   - KI-T04-2 (NEW): when uncertain, mirror T03 exactly — don't optimize
# =============================================================================

# ---- Stage 1: builder ----
FROM python:3.11-slim AS builder

WORKDIR /build

# System deps for psycopg[binary] + curl (used in runtime HEALTHCHECK).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      curl \
 && rm -rf /var/lib/apt/lists/*

# Copy project metadata first for Docker layer cache hit on unchanged deps.
COPY pyproject.toml ./
COPY src/ ./src/

# pip install -e . resolves deps + makes `src` package importable.
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -e .

# OTel auto-instrument registry — install instrumentation packages discovered
# from installed deps (flask, psycopg, requests). Idempotent.
RUN opentelemetry-bootstrap -a install

# ---- Stage 2: runtime ----
FROM python:3.11-slim AS runtime

WORKDIR /app

# curl for HEALTHCHECK. libpq for psycopg runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpq5 \
      curl \
 && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages + entry scripts from builder.
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy app source. /app/src holds Python package `src` (per packages.find).
COPY --from=builder /build/src /app/src
COPY --from=builder /build/pyproject.toml /app/pyproject.toml

# Re-install editable in runtime stage so `.pth` file points to /app/src.
# (Builder stage `.pth` points to /build/src which doesn't exist in runtime.)
RUN pip install --no-cache-dir -e .

EXPOSE 5050

# C-21 fix: `python -m src.server` (not `mcp.server`). Mirrors T03 pattern
# where `src/` itself is the importable package per packages.find config.
# KI-T03-7: explicit host/port; do NOT rely on FLASK_RUN_HOST env vars.
CMD ["opentelemetry-instrument", "python", "-m", "src.server", "--host=0.0.0.0", "--port=5050"]

# Healthcheck per S-00b decisions-log.md D-02 (stateless service defaults).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -fsS http://localhost:5050/health || exit 1
