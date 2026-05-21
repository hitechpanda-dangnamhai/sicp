# =============================================================================
# apps/mcp/src/observability/setup.py — OTel SDK bootstrap for MCP service
# =============================================================================
# Initializes OpenTelemetry tracing with OTLP gRPC exporter (D-01).
# Pattern mirrors apps/ai/src/observability/setup.py (T03 Phiên 24).
#
# Reference:
#   - docs/specs/06_OBSERVABILITY.md §3.3 (Python MCP OTel setup)
#   - DECISIONS.md ADR-011 (OTel SDK version lock)
#   - slices/S-02_decisions-log.md D-01 (OTLP gRPC exporter)
#
# Auto-instrumentation: opentelemetry-instrument wrapper in Dockerfile CMD
# auto-loads instrumentations for flask + psycopg + requests via entry points.
# This module configures SDK + Resource attributes + graceful shutdown only.
# =============================================================================

from __future__ import annotations

import logging
import os
import signal
import sys
from typing import Any

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_logger = logging.getLogger(__name__)

# Module-level singletons for graceful shutdown.
_provider: TracerProvider | None = None
_processor: BatchSpanProcessor | None = None


def _build_resource() -> Resource:
    """Build OTel Resource with service identity + deployment env."""
    env = os.getenv("DEPLOYMENT_ENV", "dev")
    version = os.getenv("APP_VERSION", "0.0.1")
    # service.name overridden by OTEL_SERVICE_NAME=mcp in docker-compose env.
    # Fallback "mcp" matches container name + log schema 'service' field.
    service_name = os.getenv("OTEL_SERVICE_NAME", "mcp")

    attrs: dict[str, Any] = {
        "service.name": service_name,
        "service.version": version,
        "deployment.environment": env,
    }
    return Resource.create(attrs)


def init_otel() -> trace.Tracer:
    """
    Initialize OTel TracerProvider + OTLP gRPC exporter.

    Called once at app startup (before Flask app.run()).
    Auto-instrumentation registered via `opentelemetry-instrument` wrapper.

    Returns:
        Module-scoped Tracer for manual span creation in tools/handlers.
    """
    global _provider, _processor

    if _provider is not None:
        _logger.warning("init_otel called twice; ignoring second call")
        return trace.get_tracer(__name__)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")
    # OTel gRPC exporter expects endpoint WITHOUT scheme prefix when insecure=True;
    # SDK is permissive and strips http:// if present. Keep scheme for env clarity.
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
    _processor = BatchSpanProcessor(
        exporter,
        max_queue_size=2048,
        schedule_delay_millis=5000,  # 5s flush window — matches T03 + AI service
        max_export_batch_size=512,
    )

    _provider = TracerProvider(resource=_build_resource())
    _provider.add_span_processor(_processor)
    trace.set_tracer_provider(_provider)

    tracer = trace.get_tracer(__name__)

    # Emit init span so Tempo shows service.name=mcp immediately on boot (proves
    # OTel pipeline alive without needing first /rpc request).
    with tracer.start_as_current_span("otel.initialized") as span:
        span.set_attribute("otel.endpoint", endpoint)
        span.set_attribute("service.name", os.getenv("OTEL_SERVICE_NAME", "mcp"))

    # Register graceful shutdown on SIGTERM (container stop) + SIGINT (Ctrl+C).
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    return tracer


def shutdown_otel() -> None:
    """
    Flush + shutdown OTel SDK gracefully.

    Called by signal handler on SIGTERM/SIGINT. Idempotent.
    Forces BatchSpanProcessor to flush pending spans within timeout before exit.
    """
    global _provider, _processor

    if _provider is None:
        return

    try:
        # force_flush blocks until pending spans exported or timeout (ms).
        # 5000ms matches K8s default termination grace period buffer.
        if _processor is not None:
            _processor.force_flush(timeout_millis=5000)
        _provider.shutdown()
    except Exception as e:  # noqa: BLE001
        # Best-effort shutdown — log + continue to allow process exit.
        _logger.error("otel.shutdown_failed", exc_info=e)
    finally:
        _provider = None
        _processor = None


def _signal_handler(signum: int, frame: Any) -> None:  # noqa: ARG001
    """Handle SIGTERM/SIGINT: flush OTel + exit cleanly."""
    _logger.info("signal.received signal=%d shutting_down=true", signum)
    shutdown_otel()
    sys.exit(0)
