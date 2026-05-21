"""LangGraph router skeleton — Phase 1 stub.

Per docs/04_INTENT_SPECS.md Common section + S-02 D-03 (LangGraph router
classify stub = "unknown" Phase 1).

Graph topology Phase 1:

    START ──► classify_intent ──► END

`classify_intent` Phase 1 = hardcoded stub returning `intent="unknown"` +
`confidence=0.0`. V-SLICE S-04..S-10 will replace with real LLM-backed
classifier + branch to per-intent subgraphs (IMPORT_GRAPH, BUY_GRAPH, ...).

Compiled graph exported as module-level `router_graph` for use by Flask
`/intent` endpoint in main.py.
"""

from __future__ import annotations

import structlog
from langgraph.graph import END, START, StateGraph
from opentelemetry import trace

from ..state import IcpState

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()


def classify_intent(state: IcpState) -> IcpState:
    """Stub classifier — Phase 1 always returns "unknown".

    Per S-02 D-03: real classifier deferred to V-SLICE S-04+ when first
    intent subgraph lands. Phase 1 contract: every request returns
    `intent="unknown"`, `confidence=0.0` so downstream pipeline (T05
    trace propagation, T07 SSE wrapper) can wire without dependency on
    real LLM availability.

    Emits LOCKED log event `intent.classified` per LOG_CATALOG convention.
    """
    with _tracer.start_as_current_span("ai.classify_intent") as span:
        span.set_attribute("ai.modality", state.get("modality", ""))
        span.set_attribute("ai.intent_stub", "unknown")

        _logger.info(
            "intent.classified",
            request_id=state.get("request_id", ""),
            modality=state.get("modality", ""),
            intent="unknown",
            confidence=0.0,
            stub=True,
        )

        # Return only the fields we mutate; LangGraph merges into existing state.
        return {"intent": "unknown", "confidence": 0.0}  # type: ignore[return-value]


def _build_graph() -> StateGraph:
    """Build the StateGraph and compile.

    Kept as a function (not module-level execution) so unit tests can rebuild
    fresh graphs without sharing global state.
    """
    g = StateGraph(IcpState)
    g.add_node("classify_intent", classify_intent)
    g.add_edge(START, "classify_intent")
    g.add_edge("classify_intent", END)
    return g.compile()


# Module-level singleton — compiled once at import time.
# Importing `router_graph` from this module returns a ready-to-invoke graph.
router_graph = _build_graph()
