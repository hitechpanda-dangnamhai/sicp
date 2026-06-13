"""Per-intent LangGraph subgraphs for ICP AI service.

S-04 T02 (Phiên Sx04-5): First per-intent subgraph lands —
`searching_by_text` for Intent 03 text product discovery (V-SLICE 1 demo).

Phiên Sx04-7 fix: export `compile_searching_by_text_graph` (NEW canonical
builder accepting pre-initialized saver+publisher) alongside legacy
`build_searching_by_text_graph` (now raises with migration message — kept
only so stale callers fail loud at import-call boundary).

S-05 T02 (Phiên Sx05-2 per D-S05-01..03 LAW + C-S05-F Path α): SECOND per-intent
subgraph — `cart_by_text` for Intent 05 cart-domain entry intents
(cart_clear_confirm + cart_view_with_stock_check). Lazy-imported in main.py
dispatch to avoid module-import side effects on startup.

S-07 T01.D (Phiên Sx07-D per C-S07-A/C/D/J/L/M): THIRD per-intent subgraph —
`importing_by_images` for Intent 01 import-by-image flow (vision.analyze +
4-tool parallel enrich + 3 NEW SSE events form_prefill/market_trend/
shopee_compare + 2 Pattern A interrupts submit_draft + commit). Lazy-imported
in main.py dispatch (modality=="image" branch) to avoid module-import side
effects on startup.

S-09 T01 (Phiên Sx09-C per D-S09-NN-A/B/C LAW + C-S09-O/P/Q/R/S): FOURTH
per-intent subgraph — `recommend_by_images` for Intent 04 image recommendation
flow (5-node sequential: vision_analyze → build_query_desc → parallel_fetch
[vespa.image_nearest_neighbor + analytics.co_purchased + analytics.product_corpus_size]
→ blend_and_rank Python composite → attach_reasons LLM + progressive product_ready).
Lazy-imported in main.py dispatch (nested if entry_intent='recommend' inside
modality='image' branch per C-S09-S).

All four subgraphs reuse the same RedisSaver + Pattern P2 interrupt() +
Option Z pub/sub pattern that S-04 T02 ships as foundational architecture
(per D-S04-13 LAW cross-slice forward-compat note).

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW + D-S04-14 LAW + D-S04-15
    - slices/S-05_decisions-log.md D-S05-01/03 LAW + C-S05-F Path α
    - slices/S-07_decisions-log.md C-S07-A/C/D/J/L/M
    - slices/S-09_decisions-log.md D-S09-NN-A/B/C/D/E LAW + C-S09-A..S
    - docs/04_INTENT_SPECS.md Intent 01 + Intent 03 + Intent 04 + Intent 05 graph stages
    - docs/phases/PHASE_02_AUTH_SEARCH.md §C
    - docs/phases/PHASE_03_IMPORT.md §B
    - docs/phases/PHASE_05_RECO_ANALYTICS.md §B/C
"""

from .cart_by_text import compile_cart_by_text_graph
from .importing_by_images import compile_importing_by_images_graph
from .recommend_by_images import compile_recommend_by_images_graph
from .searching_by_text import (
    build_searching_by_text_graph,
    compile_searching_by_text_graph,
)

__all__ = [
    "build_searching_by_text_graph",  # deprecated; raises on call
    "compile_searching_by_text_graph",  # Phiên Sx04-7 canonical builder
    "compile_cart_by_text_graph",  # Phiên Sx05-2 S-05 T02
    "compile_importing_by_images_graph",  # Phiên Sx07-D S-07 T01.D
    "compile_recommend_by_images_graph",  # Phiên Sx09-C S-09 T01
]
