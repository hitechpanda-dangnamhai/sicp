"""LangGraph subgraphs for ICP AI service.

T03 Phase 1: router skeleton only. V-SLICE S-04..S-10 will add per-intent
subgraphs (IMPORT_GRAPH, BUY_GRAPH, SEARCH_GRAPH, etc.) per 04_INTENT_SPECS.
"""

from .router_graph import router_graph

__all__ = ["router_graph"]
