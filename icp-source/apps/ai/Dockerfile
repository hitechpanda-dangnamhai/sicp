# =============================================================================
# apps/ai/Dockerfile — ICP AI Orchestration (Flask + LangGraph + OTel) — T03
# =============================================================================
# Replaces S-00b stub.
#
# Stage:    T03 production-grade image
# Purpose:  Run Flask app via `opentelemetry-instrument flask run`
#           (per docs/phases/PHASE_01_INFRA.md Day 4).
# Port:     5001
# Base:     python:3.11-slim (per S-00b D-03 — Python 3.11 LOCKED)
# =============================================================================

# ---- Stage 1: build deps (pip wheel cache) ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Build tooling for native wheels (e.g. pydantic-core, watchfiles).
# Cleanup apt cache to minimize layer.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src/ ./src/

# Install editable so version metadata works in container.
# `--no-cache-dir` keeps image small; pip wheel cache lives in /root/.cache.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -e .

# ---- Stage 2: runtime image ----
FROM python:3.11-slim AS runtime

WORKDIR /app

# curl for HEALTHCHECK directive (parity với apps/gateway pattern).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Copy installed Python deps + app source from builder.
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app/src /app/src
COPY pyproject.toml /app/pyproject.toml

# Bootstrap auto-instrumentation registry entries (one-time at image build).
# `opentelemetry-bootstrap -a install` is idempotent + cached in this layer.
RUN opentelemetry-bootstrap -a install 2>&1 | tail -5

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_APP=src.main:create_app \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5001 \
    OTEL_SERVICE_NAME=ai

EXPOSE 5001

# Wrap flask startup with `opentelemetry-instrument` so auto-instrumentation
# patches all libs (flask, httpx, urllib) BEFORE app import (parity with T01
# Node SDK pattern of importing './observability/otel' as first line).
# `flask --app src.main:create_app run` invokes the factory.
#
# KI-T03-7 belt-and-suspenders: pass --host + --port EXPLICITLY rather than
# relying on FLASK_RUN_HOST / FLASK_RUN_PORT ENV — opentelemetry-instrument
# wrapper does not guarantee CLI env propagation to subprocess, and Flask's
# default bind `127.0.0.1` makes host curl fail silently. Explicit args
# bypass this whole class of issues.
CMD ["opentelemetry-instrument", "flask", "--app", "src.main:create_app", "run", "--host=0.0.0.0", "--port=5001"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -fsS http://localhost:5001/health || exit 1
