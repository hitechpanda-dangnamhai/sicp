# =============================================================================
# apps/mcp/src/server.py — Flask app: GET /health + POST /rpc JSON-RPC 2.0
# =============================================================================
# Entry point — invoked by Dockerfile CMD via
#   opentelemetry-instrument python -m mcp.server --host=... --port=...
#
# Auto-instrumentation (loaded by `opentelemetry-instrument` wrapper):
#   - opentelemetry-instrumentation-flask → wraps every HTTP request in a span
#     named after the route (e.g. "POST /rpc"), with semantic conventions for
#     http.* attrs.
#   - opentelemetry-instrumentation-psycopg → wraps DB calls inside tool handlers.
#   - opentelemetry-instrumentation-requests → wraps any outbound HTTP (none in
#     T04 yet, but pre-installed for T05+ V-SLICE).
#
# Manual span wraps (in addition to Flask auto-spans):
#   - server-side W3C traceparent extract at /rpc entry (REVIEW §10.1.5)
#   - per-tool `mcp.tool.<name>` span in tools/__init__.py dispatch()
#
# Reference:
#   - docs/specs/03_API_CONTRACTS.md §5 (JSON-RPC 2.0 LOCKED)
#   - docs/phases/PHASE_01_INFRA.md Day 5 (POST /rpc + GET /health)
#   - T03 REVIEW §10.1.5 (server-side propagator extract pattern)
# =============================================================================

from __future__ import annotations

import argparse
import os
from typing import Any

from flask import Flask, jsonify, request
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

from src import __version__
from src.db import reset_request_identity, set_request_identity
from src.observability import get_logger, init_otel, setup_logger
from src.tools import (
    JSONRPC_INVALID_REQUEST,
    JSONRPC_PARSE_ERROR,
    dispatch,
)

# S-P0-01 T03b (ADR-047 note 2026-06-12): WHITELIST tool tenant-optional = ∅.
# MỌI RPC (kể cả system.list_tools) PHẢI mang X-Tenant-Id — giữ invariant phổ
# quát + attribution usage metering (ADR-044). Entry tương lai PHẢI qua test đỏ
# + câu WHY tường minh. test_t03b assert frozenset này RỖNG.
_TENANT_OPTIONAL_WHITELIST: frozenset[str] = frozenset()


def create_app() -> Flask:
    """Flask app factory — wires routes + observability."""
    app = Flask(__name__)
    log = get_logger(__name__)
    tracer = trace.get_tracer(__name__)
    propagator = TraceContextTextMapPropagator()

    # ---- GET /health (AC-3) ----
    @app.get("/health")
    def health() -> Any:
        """Liveness probe — used by Docker HEALTHCHECK + compose depends_on."""
        # No external deps checked in /health (returns 200 if process alive).
        # /ready (future) will check Postgres + Vespa connectivity.
        # git_sha: S-P0-03/T01 deploy-drift gate (baked via GIT_SHA build-arg).
        return (
            jsonify(
                {
                    "status": "ok",
                    "service": "mcp",
                    "version": __version__,
                    "git_sha": os.getenv("GIT_SHA", "dev"),
                }
            ),
            200,
        )

    # ---- POST /rpc (AC-4..AC-12 dispatch) ----
    @app.post("/rpc")
    def rpc() -> Any:
        """
        JSON-RPC 2.0 dispatcher.

        Request shape:
            {"jsonrpc":"2.0","method":"<name>","params":{...},"id":<int|str>}

        Response success:
            {"jsonrpc":"2.0","result":<any>,"id":<echoed>}

        Response error:
            {"jsonrpc":"2.0","error":{"code":<int>,"message":<str>},"id":<echoed|null>}

        Server-side traceparent extract: per REVIEW §10.1.5, extract incoming
        W3C trace context BEFORE dispatching → tool span becomes child of caller
        (T05 verifies Gateway→AI→MCP trace continuity).
        """
        # --- W3C traceparent extract (server-side, AC-11) ---
        # propagator.extract reads "traceparent" + "tracestate" headers from
        # carrier dict; returns Context with remote SpanContext attached.
        # If header missing or malformed, returns empty context (root span starts).
        carrier = {k.lower(): v for k, v in request.headers.items()}
        ctx = propagator.extract(carrier=carrier)

        # Wrap entire RPC dispatch in span — parent of tool span.
        # `context=ctx` makes this span a child of the extracted remote span,
        # so Tempo shows continuous trace Gateway→AI→MCP→tool→DB.
        with tracer.start_as_current_span("rpc.dispatch", context=ctx) as span:
            try:
                body = request.get_json(force=False, silent=False)
            except Exception as e:  # noqa: BLE001
                # Malformed JSON → JSON-RPC parse error.
                log.warning("rpc.parse_error", error=str(e))
                span.set_attribute("rpc.status", "parse_error")
                return jsonify(
                    {
                        "jsonrpc": "2.0",
                        "error": {"code": JSONRPC_PARSE_ERROR, "message": "Parse error"},
                        "id": None,
                    }
                ), 400

            # --- Envelope validation ---
            if not isinstance(body, dict):
                return _invalid_request("Body must be JSON object", request_id=None), 400

            req_id = body.get("id")  # echoed in response (per spec §4 — null for notifications)
            jsonrpc = body.get("jsonrpc")
            method = body.get("method")
            params = body.get("params", {})

            if jsonrpc != "2.0":
                return _invalid_request("'jsonrpc' must be '2.0'", request_id=req_id), 400
            if not isinstance(method, str):
                return _invalid_request("'method' must be string", request_id=req_id), 400
            if not isinstance(params, dict):
                # Per spec §4.2, params MAY be array; T04 limits to object only
                # (all 3 first tools take object params). Array support defer.
                return _invalid_request(
                    "'params' must be object (array params not supported)",
                    request_id=req_id,
                ), 400

            span.set_attribute("rpc.method", method)
            log.info("rpc.received", method=method, request_id=req_id)

            # --- S-P0-01 T03b: tenant fail-closed + identity contextvar ---
            # Header case-insensitive (werkzeug). WHITELIST = ∅ → mọi method đòi
            # X-Tenant-Id. Thiếu → reject TRƯỚC dispatch (ADR-047 (b), KHÔNG
            # fail-open — tenant boundary ADR-040). X-User-Id optional (tool đòi
            # user tự validate). Set contextvar → dispatch → reset (finally).
            tenant_id = request.headers.get("X-Tenant-Id")
            user_id = request.headers.get("X-User-Id")
            if not tenant_id and method not in _TENANT_OPTIONAL_WHITELIST:
                log.warning("rpc.tenant_missing", method=method, request_id=req_id)
                span.set_attribute("rpc.status", "tenant_missing")
                return jsonify(
                    {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": JSONRPC_INVALID_REQUEST,
                            "message": "Tenant context required",
                            "data": {"detail": "X-Tenant-Id header missing"},
                        },
                        "id": req_id,
                    }
                ), 400

            # --- Dispatch (tools/__init__.py wraps in mcp.tool.<name> span) ---
            tokens = set_request_identity(tenant_id, user_id)
            try:
                result, error = dispatch(method, params)
            finally:
                reset_request_identity(tokens)

            if error is not None:
                span.set_attribute("rpc.status", "error")
                span.set_attribute("rpc.error_code", error["code"])
                # JSON-RPC over HTTP convention: 200 for application-level errors,
                # 4xx only for transport-level (parse, malformed envelope).
                # Spec doesn't mandate HTTP status — keep 200 for tool errors.
                return jsonify(
                    {"jsonrpc": "2.0", "error": error, "id": req_id}
                ), 200

            span.set_attribute("rpc.status", "ok")
            return jsonify({"jsonrpc": "2.0", "result": result, "id": req_id}), 200

    return app


def _invalid_request(detail: str, request_id: Any) -> Any:
    """Helper — return JSON-RPC invalid_request error response (envelope-level)."""
    return jsonify(
        {
            "jsonrpc": "2.0",
            "error": {
                "code": JSONRPC_INVALID_REQUEST,
                "message": "Invalid Request",
                "data": {"detail": detail},
            },
            "id": request_id,
        }
    )


def _parse_args() -> argparse.Namespace:
    """
    Parse --host / --port CLI flags (KI-T03-7 lesson — explicit, not env-based).

    Defaults match port 5050 (PHASE_01 Day 5) + bind all interfaces in container.
    """
    p = argparse.ArgumentParser(description="ICP MCP Tool Server")
    p.add_argument("--host", default="0.0.0.0", help="bind address (default: 0.0.0.0)")
    p.add_argument("--port", type=int, default=5050, help="listen port (default: 5050)")
    return p.parse_args()


def main() -> None:
    """
    Entry point — invoked by `python -m mcp.server` per Dockerfile CMD.

    Sequence:
      1. Init OTel SDK + exporter (Resource attrs, BatchSpanProcessor).
      2. Setup structlog (6 LOCKED fields).
      3. Build Flask app + register routes.
      4. Log boot event with trace context.
      5. app.run() — Flask dev server (development-grade; gunicorn defers post-Hackathon).
    """
    args = _parse_args()

    # 1. OTel SDK init BEFORE Flask app creation so auto-instrument can wrap.
    # opentelemetry-instrument wrapper has already loaded instrumentation entry
    # points; this init_otel() configures TracerProvider + exporter that they use.
    init_otel()

    # 2. Logger setup after OTel so _add_trace_context can read live context.
    setup_logger()

    # 3. Build app (imports tools.* → registers tools at module load).
    app = create_app()

    # 4. Boot log — service.started event with port + version.
    log = get_logger(__name__)
    log.info(
        "service.started",
        host=args.host,
        port=args.port,
        version=__version__,
        service="mcp",
    )

    # 5. Run Flask dev server. Production gunicorn defers post-Hackathon
    # (Phase 06 polish slot). dev server adequate for runtime verification.
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
