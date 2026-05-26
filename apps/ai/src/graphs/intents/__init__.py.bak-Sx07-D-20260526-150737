"""Per-intent LangGraph subgraphs for ICP AI service.

S-04 T02 (Phiên Sx04-5): First per-intent subgraph lands —
`searching_by_text` for Intent 03 text product discovery (V-SLICE 1 demo).

Phiên Sx04-7 fix: export `compile_searching_by_text_graph` (NEW canonical
builder accepting pre-initialized saver+publisher) alongside legacy
`build_searching_by_text_graph` (now raises with migration message — kept
only so stale callers fail loud at import-call boundary).

Future V-SLICEs will add sibling modules:
    - S-07 T0X: `importing_by_images.py` for Intent 01 (vision + form prefill)
    - S-08 T0X: `buying_by_voices.py` for Intent 02 (voice + ordinal choice)
Both reuse the same RedisSaver + Pattern P2 interrupt() + Option Z pub/sub
pattern that S-04 T02 ships as foundational architecture (per D-S04-13 LAW
cross-slice forward-compat note).

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW + D-S04-14 LAW + D-S04-15
      (Phiên Sx04-7 saver lifecycle correctness)
    - docs/04_INTENT_SPECS.md Intent 03 graph stages
    - docs/phases/PHASE_02_AUTH_SEARCH.md §C
"""

from .searching_by_text import (
    build_searching_by_text_graph,
    compile_searching_by_text_graph,
)

__all__ = [
    "build_searching_by_text_graph",  # deprecated; raises on call
    "compile_searching_by_text_graph",  # Phiên Sx04-7 canonical builder
]
