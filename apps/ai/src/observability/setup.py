"""OpenTelemetry SDK bootstrap for ICP AI service.

Parity with apps/gateway/src/observability/otel.ts (T01 reference pattern).

CRITICAL: When started via `opentelemetry-instrument flask ...`, the Python
agent injects TracerProvider + auto-instrumentation BEFORE this module's
init_otel() runs. We still call init_otel() at app-factory time to:
  1. Ensure Resource attributes are present even when run WITHOUT the wrapper
     (e.g. unit tests, REPL).
  2. Register a graceful shutdown hook.
  3. Surface clear startup log line for ops verification.

Decisions applied:
  - D-01 (S-02 Phase 1): OTel exporter protocol = OTLP gRPC. Endpoint default
    `http://otel-collector:4317` (matches infra/otel/collector-config.yaml
    receivers.otlp.protocols.grpc).
  - ADR-011: OpenTelemetry-first observability mandate.

Env vars (read at runtime):
  - OTEL_SERVICE_NAME             (default "ai")
  - OTEL_EXPORTER_OTLP_ENDPOINT   (default "http://otel-collector:4317")
  - OTEL_RESOURCE_ATTRIBUTES      (e.g. "deployment.environment=dev")
  - APP_VERSION                   (default "0.0.1")
  - DEPLOYMENT_ENV                (default "dev")

Graceful shutdown via atexit + SIGTERM/SIGINT handlers — flushes batched spans
before process exits (otherwise last batch may be lost on container stop).
"""

from __future__ import annotations

import atexit
import logging
import os
import signal
import sys

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import (
    DEPLOYMENT_ENVIRONMENT,
    SERVICE_NAME,
    SERVICE_VERSION,
    Resource,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Module-level singletons to allow shutdown from any context.
_tracer_provider: TracerProvider | None = None
_meter_provider: MeterProvider | None = None


def init_otel() -> TracerProvider:
    """Initialize OTel SDK (idempotent).

    Returns the configured TracerProvider. Subsequent calls return the existing
    instance without re-registering exporters.

    NOTE: When `opentelemetry-instrument` wrapper is used (production CMD),
    the global TracerProvider may already be set by the agent. In that case
    we attach our BatchSpanProcessor to the existing provider so spans still
    flow to the configured exporter — this avoids the agent's default
    console exporter clobbering Tempo export.
    """
    global _tracer_provider

    if _tracer_provider is not None:
        return _tracer_provider

    service_name = os.environ.get("OTEL_SERVICE_NAME", "ai")
    service_version = os.environ.get("APP_VERSION", "0.0.1")
    deployment_env = os.environ.get("DEPLOYMENT_ENV", os.environ.get("NODE_ENV", "dev"))
    otlp_endpoint = os.environ.get(
        "OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"
    )

    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
            DEPLOYMENT_ENVIRONMENT: deployment_env,
        }
    )

    # Attach to existing provider if agent already installed one; else create.
    existing = trace.get_tracer_provider()
    if isinstance(existing, TracerProvider):
        _tracer_provider = existing
    else:
        _tracer_provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(_tracer_provider)

    # OTLP gRPC exporter per D-01.
    span_exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
    _tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))

    # --- Metrics pipeline (S-P0-03/T03c, W-55) — net-new MeterProvider. ----
    # observability/ previously had logger+tracing only. LLM cost/token metrics
    # (llm.cost.usd, llm.tokens, llm.latency) export via OTLP gRPC → collector
    # metrics pipeline → prometheusremotewrite → Prometheus (ADR-054 §2).
    # Attach-or-create (set_meter_provider is set-once): if the
    # opentelemetry-instrument agent already installed an SDK MeterProvider
    # (distro default exports OTLP), reuse it; else build ours with the OTLP
    # PeriodicExportingMetricReader. Export is async/batched → fire-and-forget,
    # never blocks/fails the request (parity with traces).
    global _meter_provider
    existing_mp = metrics.get_meter_provider()
    if isinstance(existing_mp, MeterProvider):
        _meter_provider = existing_mp
    else:
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=otlp_endpoint, insecure=True)
        )
        _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(_meter_provider)

    # Register graceful shutdown.
    atexit.register(shutdown_otel)
    _install_signal_handlers()

    logging.getLogger(__name__).info(
        "otel.initialized service=%s version=%s endpoint=%s",
        service_name,
        service_version,
        otlp_endpoint,
    )
    return _tracer_provider


def shutdown_otel() -> None:
    """Flush + shutdown Tracer + Meter providers. Safe to call multiple times."""
    global _tracer_provider, _meter_provider
    if _meter_provider is not None:
        try:
            _meter_provider.shutdown()
        except Exception as e:  # noqa: BLE001 — best-effort during shutdown
            logging.getLogger(__name__).warning("otel.meter_shutdown_failed err=%s", e)
        finally:
            _meter_provider = None
    if _tracer_provider is None:
        return
    try:
        _tracer_provider.shutdown()
    except Exception as e:  # noqa: BLE001 — best-effort during shutdown
        logging.getLogger(__name__).warning("otel.shutdown_failed err=%s", e)
    finally:
        _tracer_provider = None


def _install_signal_handlers() -> None:
    """Install SIGTERM + SIGINT handlers that flush OTel then exit cleanly.

    Skip when running under pytest (handler installation in non-main thread
    raises ValueError on some platforms).
    """
    if "pytest" in sys.modules:
        return

    def _handler(signum: int, _frame: object) -> None:  # noqa: ARG001
        shutdown_otel()
        # Re-raise default behaviour so Flask dev server / gunicorn exits.
        signal.signal(signum, signal.SIG_DFL)
        os.kill(os.getpid(), signum)

    try:
        signal.signal(signal.SIGTERM, _handler)
        signal.signal(signal.SIGINT, _handler)
    except ValueError:
        # Non-main thread — silently skip (per Python signal docs).
        pass
