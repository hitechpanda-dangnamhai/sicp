"""Flask app factory for ICP AI service.

Per docs/phases/PHASE_01_INFRA.md Day 4.

CRITICAL initialization order (parity với T01 Gateway pattern):
    1. init_otel()    — register TracerProvider + exporters BEFORE Flask import
                        so Flask auto-instrumentation can attach.
    2. create_logger() — configure structlog with 6 LOCKED schema fields.
    3. Flask(__name__) — app instance.
    4. Routes register.

When started via `opentelemetry-instrument flask --app src.main:create_app run`
(production CMD in Dockerfile), the OTel agent injects Flask instrumentation
BEFORE create_app() runs. init_otel() inside create_app() then attaches our
BatchSpanProcessor + Resource to the existing global TracerProvider — see
observability/setup.py docstring for the idempotent attach pattern.

Endpoints:
    GET  /health    — liveness; always 200 when process is up.
    GET  /ready     — readiness; Phase 1: 200 always (MCP/DB checks defer T05).
    POST /intent    — invoke LangGraph router; returns request_id + intent stub.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import structlog
from flask import Flask, jsonify, request
from opentelemetry import trace

from . import __version__
from .graphs.router_graph import router_graph
from .observability import create_logger, init_otel


def create_app() -> Flask:
    """Application factory. Idempotent — repeated calls return new Flask
    instance with shared OTel + logger global state.
    """
    # 1. OTel SDK first (attach Resource + exporter to existing or new provider).
    init_otel()

    # 2. Structured logger second.
    logger = create_logger(service="ai", version=__version__)

    # 3. Flask app.
    app = Flask(__name__)

    tracer = trace.get_tracer(__name__)

    @app.get("/health")
    def health() -> tuple[Any, int]:
        """Liveness probe — always 200 if process is up.

        Used by docker-compose HEALTHCHECK (apps/ai/Dockerfile).
        Per docs/phases/PHASE_01_INFRA.md DoD-3.
        """
        return jsonify(
            {
                "status": "ok",
                "service": "ai",
                "version": __version__,
            }
        ), 200

    @app.get("/ready")
    def ready() -> tuple[Any, int]:
        """Readiness probe — Phase 1: 200 always.

        T05 will extend: check MCP `/health` (T04 owns) + collector reachability.
        Kept distinct from /health so k8s/compose can distinguish liveness vs
        traffic-readiness.
        """
        return jsonify({"status": "ok", "service": "ai"}), 200

    @app.post("/intent")
    def intent() -> tuple[Any, int]:
        """Universal intent endpoint — Phase 1 stub.

        Per docs/03_API_CONTRACTS.md §1.2.
        Phase 1 contract (per S-02 D-03):
          - Accept {modality, content} JSON OR multipart for image/voice.
          - Invoke router_graph (LangGraph) which always classifies as "unknown".
          - Return 200 JSON {request_id, intent, confidence, modality}.

        T07 will replace this with SSE stream wrapper. For Phase 1 (T03),
        plain JSON response keeps smoke testing simple.
        """
        request_id = str(uuid.uuid4())

        with tracer.start_as_current_span("ai.intent.handle") as span:
            span.set_attribute("ai.request_id", request_id)

            # Accept JSON or form-data (multipart for image/voice — T07 territory).
            if request.is_json:
                payload = request.get_json(silent=True) or {}
            else:
                payload = request.form.to_dict()

            modality = payload.get("modality", "text")
            content = payload.get("content", "")
            span.set_attribute("ai.modality", modality)

            logger.info(
                "intent.received",
                request_id=request_id,
                modality=modality,
                content_length=len(content) if isinstance(content, str) else 0,
            )

            # Invoke router graph (Phase 1: classify→"unknown").
            initial_state: dict[str, Any] = {
                "request_id": request_id,
                "modality": modality,
                "content": content,
                "intent": None,
                "confidence": None,
                "trace_id": format(span.get_span_context().trace_id, "032x"),
            }
            final_state = router_graph.invoke(initial_state)

            return jsonify(
                {
                    "request_id": request_id,
                    "modality": modality,
                    "intent": final_state.get("intent", "unknown"),
                    "confidence": final_state.get("confidence", 0.0),
                    "stub": True,
                }
            ), 200

    # Startup log — verifiable in smoke AC-7 (single line containing service=ai).
    logger.info(
        "service.started",
        port=int(os.environ.get("FLASK_RUN_PORT", "5001")),
        version=__version__,
    )

    return app
