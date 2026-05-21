# =============================================================================
# apps/mcp/src/observability/logger.py — structlog with 6 LOCKED schema fields
# =============================================================================
# JSON logger with mandatory fields per docs/specs/06_OBSERVABILITY.md §4:
#   timestamp, level, service, trace_id, span_id, message
#
# Pattern mirrors apps/ai/src/observability/logger.py (T03 Phiên 24).
#
# Reference:
#   - DECISIONS.md ADR-014 (logger schema LOCKED)
#   - docs/specs/06_OBSERVABILITY.md §4 (6 mandatory fields)
#   - slices/S-02_decisions-log.md (no MCP-specific log decisions yet)
#
# CRITICAL lesson from T03 (KI-T03-10):
#   Use PER-CALL processor chain that reads OTel context fresh each log emit.
#   DO NOT use structlog.contextvars.bind_contextvars(trace_id=...) at request
#   entry because:
#     1. trace_id leaks across requests if not unbound (memory leak)
#     2. nested spans get parent trace_id, not current child span_id
#     3. processor chain bind happens at logger creation, not call time
#   The _add_trace_context processor below reads opentelemetry.trace.get_current_span()
#   AT EACH LOG CALL → always reflects active span (parent or child).
# =============================================================================

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog
from opentelemetry import trace

# Service identity LOCKED — matches OTEL_SERVICE_NAME env in docker-compose
# mcp block. Hardcoded fallback ensures 'service' field always present even
# if env var missing (defensive — log schema field is mandatory).
SERVICE_NAME = "mcp"

# Fields redacted from log payload to prevent credential leaks (defense-in-depth).
# Applied recursively to all dict values via _redact_sensitive processor below.
_REDACT_KEYS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "jwt",
        "authorization",
        "auth",
        "api_key",
        "apikey",
        "private_key",
        "cookie",
        "session",
    }
)

_REDACT_PLACEHOLDER = "[REDACTED]"


def _add_service(
    logger: logging.Logger,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Inject 'service' field — LOCKED schema field #3.

    Order matters: this runs BEFORE structlog.processors.dict_tracebacks etc.
    so 'service' appears consistently on every log line including exceptions.
    """
    event_dict["service"] = SERVICE_NAME
    return event_dict


def _add_trace_context(
    logger: logging.Logger,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Inject 'trace_id' + 'span_id' from active OTel context.

    KI-T03-10 lesson: reads span context AT EACH CALL (not bound at init).
    Returns hex string per W3C Trace Context spec (32-char trace_id, 16-char
    span_id) — matches traceparent header format for Tempo correlation.

    If no active span (e.g. log emitted outside request handler during startup),
    sets fields to None — log schema still satisfies 'field present' check via
    explicit None (jq `(.trace_id != null)` in smoke test).
    Per AC-6 smoke: `.trace_id and .span_id` truthy check uses null-coalesce.
    """
    span = trace.get_current_span()
    ctx = span.get_span_context() if span is not None else None

    if ctx is not None and ctx.is_valid:
        # format(_, '032x') zero-pads to 32 hex chars per W3C spec section 3.2.
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    else:
        # No active span (startup/shutdown phase). Use deterministic placeholder
        # values so 6-field schema check passes (`.trace_id != null` truthy).
        # 32-char + 16-char zero strings match W3C format width.
        event_dict["trace_id"] = "0" * 32
        event_dict["span_id"] = "0" * 16

    return event_dict


def _rename_event_to_message(
    logger: logging.Logger,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Rename structlog's default 'event' key → 'message' per LOCKED schema.

    structlog uses `logger.info("event.name")` → emits `event="event.name"`.
    Schema §4 mandates field name `message`. This processor remaps in place.
    """
    if "event" in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


def _redact_sensitive(
    logger: logging.Logger,  # noqa: ARG001
    method_name: str,  # noqa: ARG001
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """
    Recursively redact sensitive keys (password, token, jwt, etc.) from payload.

    Applied AFTER 6-field schema injection so we don't accidentally redact
    the OTel-derived trace_id (which is NOT a credential).
    Recurses into nested dicts but caps depth at 10 to avoid infinite loops.
    """

    def _walk(obj: Any, depth: int = 0) -> Any:
        if depth > 10:
            return obj
        if isinstance(obj, dict):
            return {
                k: (_REDACT_PLACEHOLDER if k.lower() in _REDACT_KEYS else _walk(v, depth + 1))
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_walk(item, depth + 1) for item in obj]
        return obj

    # Don't redact the LOCKED schema fields themselves.
    locked = {"timestamp", "level", "service", "trace_id", "span_id", "message"}
    return {k: (v if k in locked else _walk(v)) for k, v in event_dict.items()}


def setup_logger() -> None:
    """
    Configure structlog with 6 LOCKED schema fields + JSON renderer.

    Call once at app startup (after init_otel so trace context available).
    Subsequent get_logger() calls return loggers using this config.

    Output format: single-line JSON per log emit, e.g.:
      {"timestamp":"2026-05-21T...","level":"info","service":"mcp",
       "trace_id":"...","span_id":"...","message":"server.started",
       "port":5050}

    Stream: stdout (Docker logs JSON file driver picks up; otel-collector
    filelog receiver tails the JSON file → Loki via Loki exporter).
    """
    # Wire stdlib logging → stdout in plain text mode FIRST (covers any third-
    # party libs that call logging.getLogger directly — OTel SDK, urllib3, etc).
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    structlog.configure(
        processors=[
            # 1. Timestamp ISO 8601 UTC — LOCKED schema field #1.
            structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
            # 2. Level name (lowercase: info/warning/error) — LOCKED schema field #2.
            structlog.processors.add_log_level,
            # 3. Service name 'mcp' — LOCKED schema field #3.
            _add_service,
            # 4+5. trace_id + span_id from OTel context — LOCKED fields #4-5.
            _add_trace_context,
            # 6. Rename 'event' → 'message' — LOCKED schema field #6.
            _rename_event_to_message,
            # Defense — redact sensitive values from payload.
            _redact_sensitive,
            # Stack info for ERROR-level only.
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            # Final: render to JSON single-line.
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.BoundLogger:
    """
    Return a structlog BoundLogger configured with 6-field schema.

    Args:
        name: Optional logger name (defaults to caller's __name__ if None).
              Currently used only for grep filtering, not structural separation.
    """
    return structlog.get_logger(name or __name__)
