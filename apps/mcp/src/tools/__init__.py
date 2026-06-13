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
# S-05 T02 amendment (Phiên Sx05-2 per D-S05-02 LAW): ADD `cart` module.
#
# S-07 T01.C amendment (Phiên Sx07-D per C-S07-A): ADD 6 NEW tool modules:
#   - cards (cards.create, cards.list_pending, cards.update_status)
#   - gtrends (gtrends.interest_over_time)
#   - policies (policies.find_matching)
#   - shopee (shopee.price_range)
#   - vision (vision.analyze)
#   - products (products.create — was already imported, now also products.update
#     per T01.E.G C-S07-N Option B — registered inside products.py module body)
#
# S-07 T02 amendment (Phiên Sx07-F per C-S07-O option iii-a Sx07-G hotfix):
#   The `vision` module body now ALSO registers `vision.suggest_attributes` at
#   the bottom of `vision.py` (alongside the existing `vision.analyze` register
#   call). Auto-discovery via `from src.tools import vision` below already
#   triggers both registrations — NO import-line edit needed here. This file
#   is therefore documentation-only AMEND for Sx07-F (per Rule 7 — surface the
#   decision in code comments where consumers will look for it).
#
# S-08 T01.A amendment (Phiên Sx08-D per D-S08-NN-03 LAW): ADD `speech` module.
#   `speech.transcribe` wraps Gemini 2.5 Flash audio input for Intent 02 voice
#   buy flow — clones vision.py SDK + ThreadPoolExecutor sync-wrap pattern
#   (per Confusion Warning #2 Phiên Sx08-C handoff — Gemini SDK exposes sync
#   generate_content; we wrap in ThreadPoolExecutor for canonical timeout
#   enforcement, NOT generate_content_async).
#
# Reference:
#   - docs/specs/03_API_CONTRACTS.md §5 (MCP Tool Specs LOCKED — JSON-RPC 2.0)
#   - docs/phases/PHASE_01_INFRA.md Day 5
#   - slices/S-05_decisions-log.md D-S05-02 LAW
#   - slices/S-07_decisions-log.md C-S07-A (9 NEW MCP tools)
#   - slices/S-07_decisions-log.md C-S07-N Option B (products.update separate)
#   - slices/S-07_decisions-log.md C-S07-O Sx07-G hotfix (NEW Phiên Sx07-F)
#   - slices/S-08_decisions-log.md D-S08-NN-03 (Gemini 2.5 Flash audio NEW
#     Phiên Sx08-D)
# =============================================================================

from __future__ import annotations

from collections.abc import Callable
from typing import Any

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
_REGISTRY: dict[str, Callable[[dict[str, Any]], Any]] = {}


def register(name: str, fn: Callable[[dict[str, Any]], Any]) -> None:
    """Register a tool under JSON-RPC method name."""
    if name in _REGISTRY:
        _logger.warning("tool.duplicate_registration", name=name)
    _REGISTRY[name] = fn


def list_tools() -> list[str]:
    """Return registered tool names sorted (for system.list_tools method)."""
    return sorted(_REGISTRY.keys())


def dispatch(method: str, params: dict[str, Any]) -> tuple[Any, dict | None]:
    """Dispatch a JSON-RPC method to its handler with OTel span wrap."""
    # Built-in introspection — no span wrap needed.
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

    with _tracer.start_as_current_span(f"mcp.tool.{method}") as span:
        span.set_attribute("mcp.tool.name", method)
        try:
            result = handler(params)
            span.set_attribute("mcp.tool.status", "ok")
            return result, None
        except ValueError as e:
            _logger.warning("tool.invalid_params", method=method, error=str(e))
            span.set_attribute("mcp.tool.status", "invalid_params")
            span.record_exception(e)
            return None, {
                "code": JSONRPC_INVALID_PARAMS,
                "message": "Invalid params",
                "data": {"detail": str(e)},
            }
        except Exception as e:  # noqa: BLE001
            _logger.error("tool.internal_error", method=method, error=str(e))
            span.set_attribute("mcp.tool.status", "internal_error")
            span.record_exception(e)
            return None, {
                "code": JSONRPC_INTERNAL_ERROR,
                "message": "Internal error",
                "data": {"detail": str(e)},
            }


# Auto-discover: import all tool modules so register() side-effects fire.
# Sorted alphabetically for code review clarity.
# S-05 T02 (Phiên Sx05-2): cart module added.
# S-07 T01.C (Phiên Sx07-D): cards, gtrends, policies, shopee, vision modules added.
# S-07 T01.E.G (Phiên Sx07-D): products module body now also registers products.update.
# S-07 T02 (Phiên Sx07-F): vision module body now ALSO registers vision.suggest_attributes
#   per C-S07-O Sx07-G hotfix (NO import-line change here — vision import below
#   auto-triggers BOTH `vision.analyze` AND `vision.suggest_attributes` register calls
#   from the bottom of vision.py).
# S-09 T01 (Phiên Sx09-C): analytics module added per C-S09-B + C-S09-Q.
#   Registers `analytics.co_purchased` (PHASE_05 §C SQL) + `analytics.product_corpus_size`
#   (Redis-cached COUNT for dynamic phase_progress.meta per mockup C-S09-O).
# S-08 T01.A (Phiên Sx08-D): speech module added per D-S08-NN-03 LAW.
#   Registers `speech.transcribe` (Gemini 2.5 Flash audio input for Intent 02
#   voice buy flow — clones vision.py SDK + ThreadPoolExecutor sync-wrap).
from src.tools import (  # noqa: E402, F401
    analytics,
    auth,
    cards,
    cart,
    events,
    gtrends,
    policies,
    products,
    shopee,
    speech,  # ⭐ NEW S-08 T01.A per D-S08-NN-03 LAW
    vespa,
    vision,
)

__all__ = ["register", "list_tools", "dispatch"]
