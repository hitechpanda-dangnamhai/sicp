"""Structured JSON logger using structlog with 6 LOCKED schema fields.

Parity with apps/gateway/src/observability/logger.ts (T01 reference).

LOCKED fields per docs/06_OBSERVABILITY.md §4 — every log entry MUST contain:
    - timestamp   ISO 8601 UTC
    - level       'debug' | 'info' | 'warning' | 'error' | 'critical'
    - service     'ai' | 'gateway' | 'mcp' | ...
    - trace_id    hex (OTel auto-inject via context — empty when no span)
    - span_id     hex (OTel auto-inject — empty when no span)
    - message     snake_case event name (NOT free-form sentences)

OPTIONAL fields (only when relevant):
    request_id, user_id, intent, phase, duration_ms, ok,
    error_code, error_message

CRITICAL anti-patterns (forbidden per 06_OBS §4):
    logger.info(f"Received intent {intent}")     ← free-form interpolation
    logger.info("classifying intent")            ← no snake_case event name

CORRECT usage:
    logger.info("intent.received", request_id=rid, modality=mod)
    logger.info("intent.classified", request_id=rid, intent="unknown")

The first positional arg becomes `message` field (LOCKED schema).
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any

import structlog
from opentelemetry import trace

# Sensitive fields that MUST be redacted in any log payload (per 06_OBS §7).
# Parity with apps/gateway logger.ts `redact.paths`.
_REDACT_KEYS = frozenset(
    {
        "password",
        "authorization",
        "token",
        "access_token",
        "refresh_token",
        "jwt",
        "api_key",
    }
)
_REDACT_PLACEHOLDER = "[REDACTED]"


def _add_trace_context(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor: inject OTel trace_id + span_id from active span.

    When no active span exists (bootstrap, background threads outside request),
    fields are set to empty strings — schema still LOCKED, just blank values.
    """
    span = trace.get_current_span()
    ctx = span.get_span_context() if span else None
    if ctx and ctx.is_valid:
        # OTel context returns ints; render as 32-/16-char hex per W3C spec.
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    else:
        event_dict["trace_id"] = ""
        event_dict["span_id"] = ""
    return event_dict


def _rename_event_to_message(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog emits the positional msg as `event`. LOCKED schema uses `message`."""
    if "event" in event_dict and "message" not in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


def _redact_sensitive(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Recursively redact sensitive keys at any depth.

    Parity with gateway logger.ts `redact.paths` (top-level + nested via `*.foo`).
    """
    return _redact_dict(event_dict)


def _redact_dict(d: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        if k.lower() in _REDACT_KEYS:
            out[k] = _REDACT_PLACEHOLDER
        elif isinstance(v, dict):
            out[k] = _redact_dict(v)
        else:
            out[k] = v
    return out


def _make_base_fields_processor(
    service: str, version: str, env: str
) -> structlog.types.Processor:
    """Return a processor that injects service/version/env into every event dict.

    KI-T03-10 fix Phiên 24: replaces `structlog.contextvars.bind_contextvars`
    which uses Python contextvars — those are NOT inherited by Flask's request
    handler threads (Flask dev server runs requests in a thread pool by default).
    Symptom: `service.started` log (main thread) had `service=ai`, but
    `intent.received` / `intent.classified` (request thread) silently DROPPED
    the `service` field — violating LOCKED 6-field schema.

    A per-call processor runs on every log invocation regardless of thread,
    so the fields are guaranteed present everywhere.
    """

    def _inject(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
        # Don't overwrite if call site already provided these (rare but possible).
        event_dict.setdefault("service", service)
        event_dict.setdefault("version", version)
        event_dict.setdefault("env", env)
        return event_dict

    return _inject


def _configure_structlog(service: str, version: str, env: str, level: str) -> None:
    """Configure structlog global state. Idempotent."""

    # stdlib logging baseline — structlog will route through here when
    # `wrap_for_formatter` is used. For simplicity in T03 we use structlog's
    # native PrintLoggerFactory (stdout), which is what container log driver
    # captures.
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
    )

    processors: list[structlog.types.Processor] = [
        # NOTE: do NOT use `structlog.stdlib.filter_by_level` here — that
        # processor calls `logger.isEnabledFor()` which only stdlib `Logger`
        # instances have, NOT `PrintLogger` (our factory choice). Level
        # filtering is already handled upstream by `wrapper_class=
        # make_filtering_bound_logger(level)` configured below — that gates
        # log calls before any processor runs, so adding filter_by_level here
        # is redundant + incompatible.
        # KI-T03-9 fix Phiên 24.
        #
        # Rename `event` → `message` (LOCKED schema).
        _rename_event_to_message,
        # Inject service / version / env into EVERY log line (thread-safe).
        # KI-T03-10 fix Phiên 24: replaces contextvars-based binding which
        # failed in Flask multi-threaded request handlers.
        _make_base_fields_processor(service=service, version=version, env=env),
        # Add ISO 8601 timestamp.
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
        # Add level field as string ("info" not 20).
        structlog.processors.add_log_level,
        # Inject OTel trace_id + span_id.
        _add_trace_context,
        # Redact sensitive keys recursively.
        _redact_sensitive,
        # Render exceptions as structured tracebacks.
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # Final: emit JSON to stdout.
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def create_logger(
    service: str = "ai",
    version: str | None = None,
    env: str | None = None,
    level: str | None = None,
) -> structlog.stdlib.BoundLogger:
    """Create + configure a structlog logger.

    Idempotent — multiple calls reconfigure with last values. In practice
    called once at app-factory time in main.py.

    Args:
        service: LOCKED `service` field value (default "ai").
        version: `version` field (default env APP_VERSION or "0.0.1").
        env: `env` field (default env DEPLOYMENT_ENV or "dev").
        level: log level string (default env LOG_LEVEL or "info"; "debug"
               if non-production).

    Returns:
        BoundLogger ready for `.info("event.name", **kwargs)` calls.
    """
    v = version or os.environ.get("APP_VERSION", "0.0.1")
    e = env or os.environ.get("DEPLOYMENT_ENV", os.environ.get("NODE_ENV", "dev"))
    lvl = level or os.environ.get(
        "LOG_LEVEL", "info" if e == "production" else "debug"
    )

    _configure_structlog(service=service, version=v, env=e, level=lvl)
    return structlog.get_logger()
