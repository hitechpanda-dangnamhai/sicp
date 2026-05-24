"""LangGraph router skeleton — S-04 T02 amended (Phiên Sx04-5).

Per docs/04_INTENT_SPECS.md Common section + S-02 D-03 (Phase 1 classifier
stub = "unknown") + S-04 T02 D-S04-13 LAW (`searching_by_text` subgraph
dispatch).

Graph topology Phase 1 (T03 baseline):

    START ──► classify_intent ──► END

Graph topology S-04 T02 amendment (Phiên Sx04-5):
    The compiled `router_graph` retains Phase 1 shape for backward compat;
    `searching_by_text` subgraph is invoked DIRECTLY by `main.py` SSE handler
    via `build_searching_by_text_graph()` instead of being wired as a
    StateGraph sub-node here. Rationale: the search subgraph compiles its
    own RedisSaver checkpointer (D-S04-13 Pattern A) and publishes its own
    SSE events to Redis pub/sub (Option Z) — embedding it as a sub-node
    would duplicate checkpointer wiring + complicate thread_id namespace.

    Future intents (S-07 / S-08) can either:
    (a) follow same direct-dispatch pattern from `main.py`, OR
    (b) wire here if they don't need their own checkpointer.

For Phase 1 backward compat, `classify_intent` still returns `{intent:
'unknown', confidence: 0.0}` — the S-02 contract. Real classification at
S-04 T02 happens via heuristic check in `main.py` (modality='text' +
non-empty content → dispatch to searching_by_text subgraph).

Compiled graph exported as module-level `router_graph` for backward compat
with existing imports.

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW (foundational interrupt+resume)
    - docs/04_INTENT_SPECS.md Intent 03 graph stages
"""

from __future__ import annotations

import structlog
from langgraph.graph import END, START, StateGraph
from opentelemetry import trace

from ..state import IcpState

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()


def classify_intent(state: IcpState) -> IcpState:
    """Heuristic classifier — S-04 T02 amendment over Phase 1 stub.

    Phase 1 (T03) baseline always returned `intent="unknown"`. S-04 T02 amends
    to do minimal modality-based routing: text + non-empty content →
    `searching_by_text` (per docs/04_INTENT_SPECS.md Intent 03 mapping table).

    The real subgraph invocation does NOT happen here — `main.py` SSE handler
    dispatches to `build_searching_by_text_graph()` directly when classifier
    output matches (see graph topology docstring above).

    Emits LOCKED log event `intent.classified` per LOG_CATALOG convention.
    """
    with _tracer.start_as_current_span("ai.classify_intent") as span:
        modality = state.get("modality", "")
        content = state.get("content", "")
        span.set_attribute("ai.modality", modality)

        # S-04 T02: minimal text-search heuristic.
        if modality == "text" and isinstance(content, str) and content.strip():
            intent = "searching_by_text"
            confidence = 0.95  # heuristic high-confidence for text path
        else:
            intent = "unknown"
            confidence = 0.0

        span.set_attribute("ai.intent", intent)

        _logger.info(
            "intent.classified",
            request_id=state.get("request_id", ""),
            modality=modality,
            intent=intent,
            confidence=confidence,
        )

        # Return only fields we mutate; LangGraph merges into existing state.
        return {"intent": intent, "confidence": confidence}  # type: ignore[return-value]


def _route_after_classify(state: IcpState) -> str:
    """Conditional edge — route to per-intent subgraph or END.

    S-04 T02 dispatch:
        intent == 'searching_by_text' → END (subgraph invoked directly by
            main.py SSE handler; see module docstring topology note).
        otherwise → END.

    Future S-07/S-08 may add returns like 'importing_products_by_images' /
    'buying_products_by_voices' wiring real sub-StateGraphs.
    """
    intent = state.get("intent")
    # Both branches END at router level — search subgraph runs via main.py.
    # Keeping the conditional edge in place documents the dispatch intent
    # in code review even though both paths converge.
    if intent == "searching_by_text":
        return END
    return END


def _build_graph() -> StateGraph:
    """Build the router StateGraph and compile.

    Per S-04 T02 amendment: the classify_intent node runs first; conditional
    edge `_route_after_classify` documents the intent dispatch contract
    (`searching_by_text` recognized) even though execution converges to END
    here — actual subgraph invocation is in `main.py` per topology rationale.
    """
    g = StateGraph(IcpState)
    g.add_node("classify_intent", classify_intent)
    g.add_edge(START, "classify_intent")
    # S-04 T02 amendment — conditional edge documents dispatch table even
    # though all paths currently END at router level (subgraph runs via main.py).
    g.add_conditional_edges(
        "classify_intent",
        _route_after_classify,
        {END: END},
    )
    return g.compile()


# Module-level singleton — compiled once at import time.
router_graph = _build_graph()
