# =============================================================================
# apps/mcp/src/tools/__init__.py — MCP tool registry
# =============================================================================
# Registry pattern per docs/phases/PHASE_01_INFRA.md Day 5:
#   "Tool registry pattern: mỗi tool wrap trong
#    tracer.start_as_current_span("mcp.tool.<name>")"
#
# Auto-discovery: import all sibling modules → each module calls register(name, fn)
# at import time. Registry maps JSON-RPC method name → handler function.
#
# Per AC-10 + AC-12:
#   - Each tool invocation creates span "mcp.tool.<name>" (parent of any deeper
#     spans the tool itself creates, e.g. DB query via psycopg auto-instrument).
#   - system.list_tools returns registered tool names sorted.
#
# Reference:
#   - docs/specs/03_API_CONTRACTS.md §5 (MCP Tool Specs LOCKED — JSON-RPC 2.0)
#   - docs/phases/PHASE_01_INFRA.md Day 5
# =============================================================================

from __future__ import annotations

from typing import Any, Callable

from opentelemetry import trace

from src.observability import get_logger

_logger = get_logger(__name__)
_tracer = trace.get_tracer(__name__)

# JSON-RPC 2.0 error codes per spec (https://www.jsonrpc.org/specification §5.1)
JSONRPC_PARSE_ERROR = -32700
JSONRPC_INVALID_REQUEST = -32600
JSONRPC_METHOD_NOT_FOUND = -32601
JSONRPC_INVALID_PARAMS = -32602
JSONRPC_INTERNAL_ERROR = -32603

# Tool registry: method name (e.g. "products.get") → callable.
# Callable signature: (params: dict) -> Any (result serialized to JSON by handler).
_REGISTRY: dict[str, Callable[[dict[str, Any]], Any]] = {}


def register(name: str, fn: Callable[[dict[str, Any]], Any]) -> None:
    """
    Register a tool under JSON-RPC method name.

    Called by tool modules at import time. Idempotent: re-registering same name
    overwrites (acceptable for hot-reload dev scenarios).
    """
    if name in _REGISTRY:
        _logger.warning("tool.duplicate_registration", name=name)
    _REGISTRY[name] = fn


def list_tools() -> list[str]:
    """Return registered tool names sorted (for system.list_tools method)."""
    return sorted(_REGISTRY.keys())


def dispatch(method: str, params: dict[str, Any]) -> tuple[Any, dict | None]:
    """
    Dispatch a JSON-RPC method to its handler with OTel span wrap.

    Returns (result, error) tuple — exactly one is None.
    Error dict shape: {"code": int, "message": str, "data": Optional[Any]}.

    Span per AC-10: `mcp.tool.<name>` created here, parent of any deeper spans
    the tool itself creates (psycopg auto-instrument query spans become children).
    """
    # Built-in introspection method — does NOT need span wrap (no I/O).
    if method == "system.list_tools":
        return list_tools(), None

    handler = _REGISTRY.get(method)
    if handler is None:
        _logger.warning("tool.method_not_found", method=method)
        return None, {
            "code": JSONRPC_METHOD_NOT_FOUND,
            "message": "Method not found",
            "data": {"method": method},
        }

    # AC-10: per-tool span. Name pattern `mcp.tool.<method>` matches PHASE_01 Day 5.
    with _tracer.start_as_current_span(f"mcp.tool.{method}") as span:
        span.set_attribute("mcp.tool.name", method)
        try:
            result = handler(params)
            span.set_attribute("mcp.tool.status", "ok")
            return result, None
        except ValueError as e:
            # Validation failures → JSON-RPC invalid_params (caller error).
            _logger.warning("tool.invalid_params", method=method, error=str(e))
            span.set_attribute("mcp.tool.status", "invalid_params")
            span.record_exception(e)
            return None, {
                "code": JSONRPC_INVALID_PARAMS,
                "message": "Invalid params",
                "data": {"detail": str(e)},
            }
        except Exception as e:  # noqa: BLE001
            # Internal failures (DB down, etc.) → JSON-RPC internal_error.
            _logger.error("tool.internal_error", method=method, error=str(e))
            span.set_attribute("mcp.tool.status", "internal_error")
            span.record_exception(e)
            return None, {
                "code": JSONRPC_INTERNAL_ERROR,
                "message": "Internal error",
                "data": {"detail": str(e)},
            }


# Auto-discover: import all tool modules so register() side-effects fire.
# Order matters only for consistent system.list_tools output (sorted anyway).
from src.tools import auth, events, products  # noqa: E402, F401

__all__ = ["register", "list_tools", "dispatch"]
