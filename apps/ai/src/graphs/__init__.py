"""LangGraph subgraphs for ICP AI service.

Phase 1 (T03 Phiên 24) baseline: router skeleton only.

S-04 T02 (Phiên Sx04-5) amendment: First per-intent subgraph
`searching_by_text` lands under `graphs.intents.searching_by_text`. The
builder is re-exported here so call sites can `from src.graphs import
compile_searching_by_text_graph` without needing to know the per-intent
package layout.

Phiên Sx04-7 fix: re-export `compile_searching_by_text_graph` (NEW
canonical builder accepting pre-initialized saver+publisher per D-S04-15
async-saver-lifecycle correctness). Legacy `build_searching_by_text_graph`
still re-exported but now raises with migration message at call time —
kept only so stale import paths fail loud rather than silent.

Future V-SLICEs (S-07 / S-08) will add sibling intent builders under
`graphs/intents/` and re-export here for the same flat-import convenience.

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW + D-S04-14 LAW + D-S04-15
    - docs/04_INTENT_SPECS.md Intent 01-08 graph stages
"""

from .intents import (
    build_searching_by_text_graph,  # deprecated; raises on call
    compile_searching_by_text_graph,  # Phiên Sx04-7 canonical builder
)
from .router_graph import router_graph

__all__ = [
    "build_searching_by_text_graph",
    "compile_searching_by_text_graph",
    "router_graph",
]
