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
    - docs/04_INTENT_SPECS.md Intent 03 Graph stages
    - docs/02_DATA_MODEL.md §5 Redis Key Patterns (intent:checkpoint:{rid} +
      intent:action:{rid}:{attempt_n} + sse:pubsub:{rid})
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

Modality = Literal["text", "image", "voice"]

Mode = Literal["ai_augmented", "basic_fallback"]
DegradedFrom = Literal["ai_augmented"]
DegradedReason = Literal["llm_timeout", "llm_rate_limited"]


class IcpState(TypedDict, total=False):
    """LangGraph router state. `total=False` allows V-SLICE extensions.

    Phase 1 (T03) router-skeleton fields + S-04 T02 (Phiên Sx04-5) intent-specific
    fields per D-S04-13 LAW + D-S04-14 LAW. See module docstring for per-field
    semantics + provenance.
    """

    # --- Phase 1 router-skeleton fields (T03 baseline) ---
    request_id: str
    modality: Modality
    content: str
    intent: Optional[str]
    confidence: Optional[float]
    trace_id: str

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
