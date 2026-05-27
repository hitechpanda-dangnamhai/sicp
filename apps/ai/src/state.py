"""IcpState — TypedDict describing LangGraph router state.

Per docs/04_INTENT_SPECS.md Common section + Intent 01-08.

Phase 1 (T03 Phiên 24) baseline: 6 minimal router-skeleton fields.

S-04 T02 amendment (Phiên Sx04-5 per D-S04-13 LAW + D-S04-14 LAW): ADD 7 NEW
intent-specific fields supporting the Adaptive Interrupt+Resume + Adaptive
Progressive Streaming architecture for Intent 03 (`searching_by_text`):

    mode                       — Variant B (`ai_augmented`) vs Variant A
                                  (`basic_fallback`). Initial value comes from
                                  POST /intent body `mode` field (default
                                  `'ai_augmented'`). Auto-flipped on LLM timeout
                                  in `generate_understanding` / `parse_filters` /
                                  `generate_reasons` nodes (per D-S04-03 LAW
                                  graceful degrade).
    cart_trigger_product_id    — Set by Command(resume={choice:'add_to_cart',
                                  value:{product_id}}) at `rank_finalize`
                                  interrupt; consumed by conditional edge to
                                  route to `co_purchase_lookup` (Option α per
                                  Q-Sx04-3-5 LAW).
    degraded_from              — Only populated when mode flips at runtime;
                                  records original mode for ops log audit
                                  (`intent.degraded {from_mode, to_mode}`).
    degraded_reason            — Why mode flipped: `'llm_timeout'` (2s timeout
                                  hit) or `'llm_rate_limited'` (E_LLM_RATE_LIMITED
                                  per 03_API §4). NOT populated for explicit user
                                  'continue_basic' choice (that's a user
                                  preference, not a runtime degrade).
    corrected_query_accepted   — Set True by Command(resume={choice:'accept'}) at
                                  `detect_typo` interrupt; used by
                                  `generate_understanding` to swap original →
                                  corrected query in state.content.
    attempt_n                  — Monotonic counter incremented by FE per logical
                                  retry of /action endpoint (1, 2, 3, ...). Used
                                  by Gateway Idempotency-Key composite cache key
                                  `idem:cache:{user_id}:{Idempotency-Key}-attempt-{n}`
                                  to allow legitimate user retries (e.g., user
                                  taps "Thử lại với AI" then "Dùng bản cơ bản" =
                                  attempt_n=1 then 2 same request_id).
    first_card_emitted         — **D-S04-14 LAW Phiên Sx04-4 idempotency guard.**
                                  Set True by `generate_reasons` node on FIRST
                                  successful per-product LLM completion. Guards
                                  `intent.first_card_emitted` ops log emission
                                  (emit ONCE per request_id at first product_ready
                                  emission; subsequent emissions skip the log).
                                  Per Q-Sx04-4-4 Metric-2 LAW paired telemetry.

S-05 T02 amendment (Phiên Sx05-2 per D-S05-01/03 LAW + C-S05-F Path α
resolution): ADD 8 NEW cart-domain fields supporting Pattern A interrupt+resume
for the 2 cart entry intents in `cart_by_text.py`:

    entry_intent               — **C-S05-F Path α LAW.** Set by main.py from
                                  POST /intent body `hint` field when value is
                                  `'cart_clear_confirm'` or
                                  `'cart_view_with_stock_check'`. Consumed by
                                  `_drive_graph_async` dispatch chain to select
                                  cart_by_text vs searching_by_text graph
                                  compile target. Persisted by RedisSaver so
                                  `_drive_graph_resume_async` can recover the
                                  same graph compilation choice on resume.
                                  Backward-compat: `None` → default
                                  searching_by_text per S-04 classifier path.
    cart_clear_action          — Set by Command(resume={choice:'confirm_clear'
                                  | 'cancel_clear'}) at the clear_confirm
                                  interrupt. Consumed by `_node_clear_execute`
                                  conditional logic (confirm → cart.clear MCP
                                  + emit cart_cleared; cancel → emit
                                  clear_cancelled).
    cart_stock_action          — Set by Command(resume={choice:'resolve_remove'
                                  | 'resolve_replace'}) at the stock_issue
                                  interrupt. Consumed by `_node_stock_resolve`
                                  conditional logic.
    cart_stock_resolve_product_id
                               — Product ID the user is resolving (from
                                  resume.value.product_id). Required for
                                  cart.remove + cart.upsert MCP calls.
    cart_stock_resolve_replacement_id
                               — Replacement product ID (from
                                  resume.value.replacement_id). Only populated
                                  when cart_stock_action == 'resolve_replace';
                                  None for 'resolve_remove' path.

    _cart_data                 — Internal transient: cart snapshot loaded
                                  from `cart.get` MCP at `_node_cart_view`
                                  entry; reused downstream nodes to avoid
                                  redundant MCP roundtrips. Underscore prefix
                                  marks internal (NOT surfaced to SSE) per
                                  Phiên Sx04-7 fix pattern.
    _cart_out_of_stock_ids     — Internal transient: list[str] of product_ids
                                  flagged in_stock=False by validate_stock
                                  inline check. Drives per-item Vespa+LLM
                                  lookup loop in `_node_stock_issue_lookup`.
    _cart_stock_replacements   — Internal transient: dict mapping
                                  out_of_stock_product_id → replacement dict
                                  (or None on Vespa+LLM null/timeout per
                                  D-S05-04 LAW step 4 graceful degrade).
                                  Built incrementally as
                                  stock_issue_ready events are published;
                                  passed forward to stock_resolve node so it
                                  can issue the correct cart.upsert call when
                                  user picks 'resolve_replace'.

Fields kept Phase 1:
    request_id  — UUID per /intent invocation (AI-issued per Q-Sx04-3-6 Option A
                  LAW; matches RedisSaver thread_id + Redis pub/sub channel +
                  Gateway cache key — single namespace).
    modality    — 'text' | 'image' | 'voice' — per 03_API_CONTRACTS §1.2.
    content     — text body for modality=text; base64 / file ref for image/voice.
                  May be REWRITTEN by `detect_typo` 'accept' path to corrected.
    intent      — Classifier output (`'searching_by_text'` from S-02 router).
    confidence  — 0.0..1.0 classifier confidence.
    trace_id    — W3C trace_id hex (32 chars) for cross-service correlation.

`total=False` is preserved so future V-SLICEs (S-07/S-08) can ADD their own
intent-specific fields without breaking existing nodes.

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW + D-S04-14 LAW
    - slices/S-05_decisions-log.md D-S05-01 LAW + D-S05-03 LAW + C-S05-F
      (Phiên Sx05-2 Path α hint enum extend + entry_intent dispatch field)
    - docs/04_INTENT_SPECS.md Intent 03 Graph stages + Intent 05 cart graph
      (post-T02 reconcile)
    - docs/02_DATA_MODEL.md §5 Redis Key Patterns (intent:checkpoint:{rid} +
      intent:action:{rid}:{attempt_n} + sse:pubsub:{rid} + cart:{user_id})
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

Modality = Literal["text", "image", "voice"]

Mode = Literal["ai_augmented", "basic_fallback"]
DegradedFrom = Literal["ai_augmented"]
DegradedReason = Literal["llm_timeout", "llm_rate_limited"]

# --- S-05 T02 (Phiên Sx05-2 per D-S05-01 LAW + C-S05-F Path α resolution) ---
# Entry intent override values — extends `hint` enum on POST /intent body to
# explicitly dispatch the cart_by_text graph vs default searching_by_text.
# `None` value (hint unset) preserves S-04 classifier path (backward-compat).
EntryIntent = Literal["cart_clear_confirm", "cart_view_with_stock_check"]

# Resume choice values for cart interrupts (D-S05-03 LAW Pattern A Reuse).
CartClearAction = Literal["confirm_clear", "cancel_clear"]
CartStockAction = Literal["resolve_remove", "resolve_replace"]


class IcpState(TypedDict, total=False):
    """LangGraph router state. `total=False` allows V-SLICE extensions.

    Phase 1 (T03) router-skeleton fields + S-04 T02 (Phiên Sx04-5) intent-specific
    fields per D-S04-13 LAW + D-S04-14 LAW + S-05 T02 (Phiên Sx05-2) cart entry
    intent fields per D-S05-01/03 LAW + C-S05-F Path α resolution.
    See module docstring for per-field semantics + provenance.
    """

    # --- Phase 1 router-skeleton fields (T03 baseline) ---
    request_id: str
    modality: Modality
    content: str
    intent: Optional[str]
    confidence: Optional[float]
    trace_id: str

    # --- Sx05-3-CODE HOTFIX (D-S05-13 LAW Cross-service User Context
    #     Propagation, Phiên Sx05-3-CODE manual test discovery) ---
    # JWT-resolved authenticated user_id propagated from Gateway POST /intent
    # handler (intent.controller.ts @UseGuards(JwtAuthGuard) extracts req.user.id)
    # → PostIntentBody.user_id → AI main.py initial_state['user_id'] → checkpointed
    # via RedisSaver → restored on resume. Cart subgraph nodes MUST read from
    # this field (NOT state.get('content') which holds user query text).
    # Fallback 'anon' kept defensive for backward-compat with /intent calls
    # that pre-date JWT propagation (e.g. smoke tests bypassing auth).
    user_id: str

    # --- S-04 T02 D-S04-13 LAW fields (Phiên Sx04-5) ---
    mode: Mode
    cart_trigger_product_id: str
    degraded_from: DegradedFrom
    degraded_reason: DegradedReason
    corrected_query_accepted: bool
    attempt_n: int

    # --- S-04 T02 D-S04-14 LAW fields (Phiên Sx04-5 — Progressive Streaming) ---
    first_card_emitted: bool

    # --- S-04 T02 internal transient fields (Phiên Sx04-7 fix — were used
    #     by nodes via `# type: ignore[typeddict-unknown-key]` but NOT declared
    #     in TypedDict schema → LangGraph state-merge dropped them silently
    #     between nodes → `generate_reasons` saw empty `_search_items` →
    #     skipped per-product loop → `rank_finalize` emitted empty `products`
    #     event. Declaring them here makes LangGraph persist them across
    #     node transitions. Underscore prefix marks them as internal /
    #     not-surfaced-to-SSE; FE/Gateway never sees these). ---
    _filters: dict
    _search_items: list
    _search_total: int
    # Sx07-F-debug Phiên 2026-05-26 — Explicit filter override from FE (A1
    # design). Must be declared here (same lesson as _search_items above):
    # LangGraph TypedDict total=False schema drops undeclared keys between
    # node transitions, so parse_filters node would see None even when
    # main.py set the value in initial_state. Shape: {brand?, category?} or None.
    _filters_override: Optional[dict]

    # --- S-05 T02 D-S05-01/03 LAW fields (Phiên Sx05-2 — Pattern A cart entry
    #     intents per C-S05-F Path α resolution). 5 user-facing fields drive
    #     graph dispatch + interrupt resume semantics; persisted by RedisSaver
    #     across interrupt+resume boundary. ---
    entry_intent: EntryIntent
    cart_clear_action: CartClearAction
    cart_stock_action: CartStockAction
    cart_stock_resolve_product_id: str
    cart_stock_resolve_replacement_id: Optional[str]

    # --- S-05 T02 internal transient fields (Phiên Sx04-7 declare-or-drop
    #     pattern). _cart_data is loaded once at _node_cart_view entry and
    #     reused downstream to avoid redundant MCP cart.get roundtrips.
    #     _cart_out_of_stock_ids + _cart_stock_replacements drive the
    #     per-item Vespa+LLM lookup loop + carry replacement candidates
    #     forward to the stock_resolve node. ---
    _cart_data: dict
    _cart_out_of_stock_ids: list
    _cart_stock_replacements: dict

    # --- S-07 T01.D D-S04-13 LAW Pattern A 2-interrupt fields (Phiên Sx07-D
    #     per C-S07-A/C/D/J/L/M). Intent 01 importing_by_images graph uses
    #     these 6 internal transient fields to carry state across vision →
    #     enrich → describe → emit_prefill → INTERRUPT #1 → emit_draft_event →
    #     find_policies → create_cards → INTERRUPT #2 → commit_product. All
    #     underscore-prefixed per Phiên Sx04-7 declare-or-drop pattern
    #     (NOT surfaced to SSE; FE/Gateway never sees these). ---
    image_b64: str
    _vision_result: dict
    _enrich_data: dict
    _description: dict
    _submitted_form: dict
    _draft_id: str
    _draft_event_id: str
    _matched_policies: list
    _policy_context: dict
    _cards_created: list
    _commit_confirmed: bool
    _product_id: str
    _committed: bool
    _terminated: bool
