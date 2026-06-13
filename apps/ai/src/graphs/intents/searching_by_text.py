"""Intent 03 searching_by_text — 8-node adaptive LangGraph with Pattern P2
dynamic interrupt() at 4 conditional points + per-product progressive streaming.

S-04 T02 (Phiên Sx04-5) per D-S04-13 LAW (Pattern A + Option Z + Option α +
Pattern P2 + Strategy β) + D-S04-14 LAW (Sync HTTP MCP + Gemini Primary +
Per-product `product_ready` SSE + Paired telemetry).

----------------------------------------------------------------------------
PHIÊN Sx04-7 FIX AMENDMENT (2026-05-24) — async/sync boundary correctness:

Original bug: `build_searching_by_text_graph(redis_url)` instantiated
`AsyncRedisSaver(redis_url=..., ttl=...)` via direct constructor — which does
NOT initialize the internal async Redis client nor call `asetup()` to register
RedisJSON indices. When the first graph node async-invoked the saver's
`aput()`, the internal client was None and asyncio raised "no running event
loop" from inside the lazy-init connection path.

Fix per docs (https://pypi.org/project/langgraph-checkpoint-redis/):
    Pattern A correct usage of AsyncRedisSaver is via async context manager
    `AsyncRedisSaver.from_conn_string(url, ttl=cfg)` + `await saver.asetup()`
    inside a running event loop.

Refactor strategy (this file):
    - REMOVED top-level `saver = AsyncRedisSaver(...)` inside the builder.
    - REPLACED `build_searching_by_text_graph(redis_url) -> compiled` with
      `compile_searching_by_text_graph(saver, publisher) -> compiled` which
      accepts an already-setup saver + publisher and compiles a graph bound
      to them. Caller (`main.py`) owns the `async with AsyncRedisSaver
      .from_conn_string(...)` context manager and saver lifecycle.
    - Backward-compat shim: legacy `build_searching_by_text_graph(redis_url)`
      kept as a wrapper that raises with a clear migration message so any
      stale callers fail loud rather than silent.
----------------------------------------------------------------------------

Graph topology (per docs/04_INTENT_SPECS.md Intent 03 Graph stages):

    START
      ├─► detect_typo (Variant B only)
      │       └─► interrupt({awaiting: 'typo_action'}) IF confidence > 0.85
      ├─► generate_understanding (Variant B only)
      │       └─► interrupt({awaiting: 'degrade_action'}) ON TimeoutError
      ├─► parse_filters (Both modes)
      │       └─► degrade on TimeoutError (no interrupt — regex fallback)
      ├─► embed_query (Variant B only, NO-OP per D-S04-10 LAW)
      ├─► hybrid_search (MCP vespa.hybrid_search call)
      ├─► generate_reasons (Variant B only)
      │       └─► per-product `product_ready` SSE emit (D-S04-14 LAW)
      │       └─► interrupt({awaiting: 'degrade_action'}) on FULL timeout
      ├─► rank_finalize (Both modes)
      │       └─► interrupt({awaiting: 'cart_action'}) ALWAYS (Option α)
      ├─► [conditional edge based on state.cart_trigger_product_id]
      │       └─► co_purchase_lookup (only if cart_trigger set)
      └─► final → END
            └─► await saver.adelete_thread(rid)  (Strategy β fast-path cleanup)

RedisSaver checkpointer config (Strategy β LAW):
    ttl={'default_ttl': 30, 'refresh_on_read': True}
    + explicit adelete_thread(rid) on final emit

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW + D-S04-14 LAW full doc
    - docs/04_INTENT_SPECS.md Intent 03 graph stages (lines 215-351)
    - docs/phases/PHASE_02_AUTH_SEARCH.md §C
    - Mockup intent-03B-state-0-happy.html lines 152-260 (understanding card +
      4 product cards with match badge + reason chip)
    - Mockup intent-03B-state-F-typo.html lines 152-163 (typo confirm card)
    - Mockup intent-03B-state-C-error.html lines 160-173 (ErrorCard graceful)
    - Mockup intent-03B-state-E-cart.html lines 215-260 (co-purchase hint)
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

import structlog
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from opentelemetry import trace

from ...prompts import load_prompt
from ...state import IcpState
from ...tools.llm_client import LITE_MODEL, LLMTimeout, get_llm_client
from ...tools.mcp_client import McpClient, McpError, identity_kwargs
from ...tools.redis_publisher import RedisPublisher

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()

# Co-purchase fixture path (per 02_DATA_MODEL.md §X.2 S-04 stub; S-10 V006 mat
# view replaces real).
_COPURCHASE_FIXTURE_PATH = os.getenv(
    "COPURCHASE_FIXTURE_PATH", "/app/infra/seed/co_purchase_category.json"
)

# Vietnamese category labels for co_purchase_hint reason templating per
# 02_DATA_MODEL.md §X.2 reason_template = "Khách mua {anchor_category_vi}
# thường lấy kèm {suggested_category_vi}".
_CATEGORY_VI = {
    "banh_keo": "bánh kẹo",
    "banh_mi": "bánh mì",
    "dau_an": "dầu ăn",
    "do_dong_hop": "đồ đóng hộp",
    "gao": "gạo",
    "gia_vi": "gia vị",
    "mi_tom": "mì tôm",
    "nuoc_giai_khat": "nước giải khát",
    "nuoc_tuong": "nước tương",
    "sua": "sữa",
    "tuong_ot": "tương ớt",
}

# 4-phase PhasesCard meta per mockup intent-03B-state-A-loading.html lines 145-181.
# Phase 0 = "Hiểu yêu cầu của anh"; Phase 1 = "Tìm sản phẩm phù hợp";
# Phase 2 = "Viết lý do gợi ý cho từng món" (progressive arrival evidence per
# D-S04-14 LAW); Phase 3 = "Hoàn tất xếp hạng".
_PHASE_IDS = {
    "understanding": 0,
    "search": 1,
    "reasons": 2,
    "finalize": 3,
}


def _mcp_url() -> str:
    return os.getenv("MCP_URL", "http://mcp:5050/rpc")


# ============================================================================
# Node implementations (8 nodes per Intent 03 spec)
# ============================================================================


async def _node_detect_typo(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """Node 1: detect_typo (Variant B only).

    LLM call → returns {confidence, corrected_query, original_query}.
    IF confidence > 0.85: publish typo_suggestion SSE event + interrupt()
    waiting Command(resume={choice: 'accept'|'reject'}).

    Mockup intent-03B-state-F-typo.html lines 152-163 LOCKED strings used in
    detect_typo.txt prompt → output text matches "Có phải anh đang tìm Maggi?
    Em đã sửa lỗi chính tả giúp anh."
    """
    rid = state["request_id"]
    if state.get("mode") != "ai_augmented":
        return {}  # Variant A skips

    # Sx07-F-debug Phiên 2026-05-26 — Skip LLM call for multi-word queries.
    # Typos are statistically near-zero for queries with spaces (users do not
    # misspell while typing space). Saves ~2-5s LLM RTT for ~80% of queries.
    query_text = state.get("content", "")
    if " " in query_text.strip() and len(query_text.strip()) >= 6:
        _logger.info("typo.skipped_multiword", request_id=rid, query_len=len(query_text))
        return {}

    llm = get_llm_client()
    prompt = load_prompt("detect_typo").format(query=state["content"])
    try:
        result = await llm.generate_json(prompt, timeout_s=3.0, model=LITE_MODEL)
    except LLMTimeout:
        # Variant B detect_typo timeout = NOT critical → skip (no interrupt);
        # continue to generate_understanding with original query.
        _logger.warning("typo.timeout_skipped", request_id=rid)
        return {}

    confidence = float(result.get("confidence", 0.0))
    corrected_query = result.get("corrected_query", "")

    if confidence > 0.85 and corrected_query and corrected_query != state["content"]:
        # Publish typo_suggestion SSE + interrupt for user confirm.
        await publisher.publish_sse(
            rid,
            "typo_suggestion",
            {
                "original": state["content"],
                "corrected": corrected_query,
                "confidence": confidence,
            },
        )
        await publisher.publish_sse(rid, "status", {"status": "awaiting_user_input"})
        _logger.info(
            "intent.interrupted",
            request_id=rid,
            node="detect_typo",
            awaiting="typo_action",
        )

        # Pattern P2 inline interrupt() — graph pauses; RedisSaver persists.
        resume = interrupt({"awaiting": "typo_action", "corrected": corrected_query})

        # Resume value shape: {choice: 'accept'|'reject', attempt_n?: int}
        choice = (resume or {}).get("choice")
        _logger.info(
            "intent.resumed",
            request_id=rid,
            node="detect_typo",
            resume_choice=choice,
        )

        if choice == "accept":
            return {"content": corrected_query, "corrected_query_accepted": True}
        # 'reject' or missing → keep original content as-is.
        return {"corrected_query_accepted": False}

    return {}


async def _node_generate_understanding(
    state: IcpState, publisher: RedisPublisher
) -> IcpState:
    """Node 2: generate_understanding (Variant B only).

    LLM call → returns {text, highlighted_terms}. Publish understanding SSE.
    On TimeoutError: flip mode to basic_fallback + variant_degraded SSE +
    interrupt({awaiting: 'degrade_action'}).

    Mockup intent-03B-state-0-happy.html line 158 LOCKED target text used in
    generate_understanding.txt prompt → "Anh cần **nước tương đậm đặc** phù
    hợp ăn phở — loại thường dùng kèm theo ớt và chanh. Em chọn những sản
    phẩm có độ đạm cao, vị đậm."
    """
    rid = state["request_id"]
    if state.get("mode") != "ai_augmented":
        return {}  # Variant A skips

    # Phase progress: phase 0 understanding active.
    await publisher.publish_sse(
        rid, "phase_progress", {"phase_id": _PHASE_IDS["understanding"], "status": "active"}
    )

    llm = get_llm_client()
    prompt = load_prompt("generate_understanding").format(query=state["content"])
    t0 = time.monotonic()
    try:
        result = await llm.generate_json(prompt, timeout_s=14.0)
    except LLMTimeout:
        # Flip mode + degrade interrupt.
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        _logger.warning(
            "intent.degraded",
            request_id=rid,
            from_mode="ai_augmented",
            to_mode="basic_fallback",
            reason="llm_timeout",
            node="generate_understanding",
            elapsed_ms=elapsed_ms,
        )
        await publisher.publish_sse(
            rid,
            "variant_degraded",
            {
                # SSE event payload per 03_API_CONTRACTS.md §3 lines 334-340.
                # Field naming `from`/`to` matches spec (distinct from
                # ops log `intent.degraded` which uses `from_mode`/`to_mode`
                # per LOG_CATALOG.md line 44 — 2 separate contracts).
                "from": "ai_augmented",
                "to": "basic_fallback",
                "reason": "llm_timeout",
                "error_code": "E_LLM_TIMEOUT",
                # Rule 6 MOCKUP IS LAW — `trace_id` field required per
                # mockup intent-03B-state-C-error.html line 166 displays
                # truncated trace "b7e1...d042". FE truncates client-side.
                "trace_id": state.get("trace_id", ""),
                # Mockup intent-03B-state-C-error.html lines 160-161 LOCKED strings.
                # `title` field NEW per Rule 6 mockup line 160 — error card heading.
                # `user_message` field per spec line 338 — error card body text.
                "title": "Mô hình AI phản hồi chậm",
                "user_message": "Em đang quá tải nên chưa viết được lý do gợi ý. Anh có thể dùng bản tìm kiếm cơ bản.",
                # NOTE: `retry_actions` field per spec line 339 NOT emitted —
                # mockup lines 171+173 hardcode button labels "Thử lại với AI"
                # / "Dùng bản cơ bản" FE-side per Rule 6. Spec needs update.
            },
        )
        await publisher.publish_sse(rid, "status", {"status": "awaiting_user_input"})

        resume = interrupt(
            {"awaiting": "degrade_action", "error_code": "E_LLM_TIMEOUT", "node": "generate_understanding"}
        )
        choice = (resume or {}).get("choice", "continue_basic")
        _logger.info(
            "intent.resumed",
            request_id=rid,
            node="generate_understanding",
            resume_choice=choice,
        )

        if choice == "retry_ai":
            # NOTE: Full retry semantics (adelete_thread + re-invoke from ENTRY)
            # handled by AI service /resume endpoint when receiving 'retry_ai'
            # choice — controller deletes checkpoint and invokes graph fresh.
            # Here we just signal mode preserved; controller does cleanup.
            return {"mode": "ai_augmented"}
        # 'continue_basic' → keep mode flip; skip remaining Variant B LLM nodes.
        return {
            "mode": "basic_fallback",
            "degraded_from": "ai_augmented",
            "degraded_reason": "llm_timeout",
        }

    # Success path.
    text = result.get("text", "")
    highlighted = result.get("highlighted_terms", [])
    # S04-NN-15 gate (D-S08-NN-15 LAW): Vespa=recall, LLM=intent. If the
    # query is not a real product reference, skip Vespa entirely and route
    # to the no_product_ref node which emits empty_state (WOW suggestion).
    is_product_ref = result.get("is_product_reference", True)
    if is_product_ref is False:
        return {
            "_skip_search_no_ref": True,
            "_suggested_real_query": result.get("suggested_real_query", ""),
        }
    await publisher.publish_sse(
        rid, "understanding", {"text": text, "highlighted_terms": highlighted}
    )
    await publisher.publish_sse(
        rid,
        "phase_progress",
        {
            "phase_id": _PHASE_IDS["understanding"],
            "status": "done",
            "ms": int((time.monotonic() - t0) * 1000),
        },
    )
    return {}


async def _node_parse_filters(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """Node 3: parse_filters (Both modes — but LLM only in Variant B).

    Per Q-Sx04-3-1 LAW cross-language category detection. LLM structured
    output → {category, filters}. Variant A uses regex fallback (no LLM).
    Stored in state.attempt_filters (transient, not surfaced).
    """
    rid = state["request_id"]
    query = state["content"]

    # Sx07-F-debug Phiên 2026-05-26 — Explicit filter override short-circuit.
    # FE passes chip-driven filters → skip LLM call entirely (~2-3s saved +
    # exact match, no LLM hallucination on brand/category guess).
    override = state.get("_filters_override")  # type: ignore[typeddict-item]
    if isinstance(override, dict) and override:
        category = override.get("category")
        brand = override.get("brand")
        attributes = override.get("attributes")
        extra: dict = {}
        if brand:
            extra["brand"] = brand
        if isinstance(attributes, dict) and attributes:
            extra["attributes"] = attributes
        _logger.info(
            "parse_filters.override_used",
            request_id=rid,
            category=category,
            brand=brand,
            attribute_count=len(attributes) if isinstance(attributes, dict) else 0,
        )
        return {  # type: ignore[typeddict-unknown-key]
            "_filters": {
                "category": category,
                "extra": extra,
            }
        }

    if state.get("mode") != "ai_augmented":
        # Variant A: regex/keyword fallback. Trivial heuristic — match
        # category name verbatim in query.
        category = None
        ql = query.lower()
        for cat_key in _CATEGORY_VI:
            if cat_key.replace("_", " ") in ql or cat_key in ql:
                category = cat_key
                break
        return {"_filters": {"category": category}}  # type: ignore[typeddict-unknown-key]

    llm = get_llm_client()
    prompt = load_prompt("parse_filters").format(query=query)
    try:
        result = await llm.generate_json(prompt, timeout_s=3.0, model=LITE_MODEL)
        category = result.get("category")
        filters = result.get("filters", {})
        _logger.info(
            "llm.generated",
            request_id=rid,
            node="parse_filters",
            category=category,
            filter_count=len(filters),
            # Phiên Sx04-12 debug — dump full filter content for filter-pass diagnosis
            filters_dump=filters,
        )
        return {"_filters": {"category": category, "extra": filters}}  # type: ignore[typeddict-unknown-key]
    except LLMTimeout:
        # parse_filters timeout = item-level degrade (no interrupt) — fall
        # back to no category filter; vespa search proceeds without category
        # constraint. NOT mode-flip because BM25 baseline still useful.
        _logger.warning("parse_filters.timeout_fallback", request_id=rid)
        return {"_filters": {"category": None}}  # type: ignore[typeddict-unknown-key]


async def _node_embed_query(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """Node 4: embed_query (Variant B only — D-S04-10 LAW NO-OP pass-through).

    Per D-S04-10 LAW: Vespa native hugging-face-embedder handles
    embedding inside the YQL `embed(@query, clip_multilingual)` clause.
    AI service writes NO embedding code. Silent node — no SSE event.
    """
    return {}


async def _node_hybrid_search(state: IcpState, publisher: RedisPublisher) -> dict:
    """Node 5: hybrid_search via MCP vespa.hybrid_search.

    Phase 1 active → call MCP → phase 1 done with timing meta. rank_profile
    chosen by state.mode. Filter category applied when present.
    """
    rid = state["request_id"]
    mode = state.get("mode", "ai_augmented")
    filters = state.get("_filters") or {}  # type: ignore[typeddict-item]

    await publisher.publish_sse(
        rid, "phase_progress", {"phase_id": _PHASE_IDS["search"], "status": "active"}
    )

    # Sx07-F-debug Phiên 2026-05-27 — Use Vespa native ONNX cross-encoder rerank
    # for ai_augmented mode (replaces brittle LLM rerank Gemini). Top 30 retrieved
    # via BM25+vector, then ONNX cross-encoder global-phase rerank → top 8.
    # Production-grade pattern (Spotify/Etsy/Pinterest). See infra/vespa/schemas/
    # product.sd rank-profile cross_encoder_rerank + services.xml.
    rank_profile = "cross_encoder_rerank" if mode == "ai_augmented" else "baseline"
    params = {
        "query": state["content"],
        "rank_profile": rank_profile,
        "limit": 8,
    }
    cat = filters.get("category") if isinstance(filters, dict) else None
    if cat:
        params["category_filter"] = cat
    # Phiên Sx04-12 fix — propagate LLM-extracted price filters (D-S04 spec)
    extra = filters.get("extra") if isinstance(filters, dict) else None
    if isinstance(extra, dict):
        if "price_min" in extra and extra["price_min"] is not None:
            params["price_min"] = extra["price_min"]
        if "price_max" in extra and extra["price_max"] is not None:
            params["price_max"] = extra["price_max"]
        # Phiên Sx04-12 fix — brand filter propagation
        if "brand" in extra and extra["brand"]:
            params["brand_filter"] = extra["brand"]
        # Sx07-F-debug Phiên 2026-05-26 — attribute filter propagation (chip
        # re-search A1). Dict {key: value} forwarded to MCP, which builds
        # YQL `attributes contains sameElement(...)` clause per key-value pair.
        if "attributes" in extra and extra["attributes"]:
            params["attribute_filter"] = extra["attributes"]

    mcp = McpClient(_mcp_url(), timeout_s=30.0)
    t0 = time.monotonic()
    try:
        result = await mcp.call("vespa.hybrid_search", params, **identity_kwargs(state))
    except McpError as e:
        _logger.error("mcp.error", request_id=rid, tool="vespa.hybrid_search", error=str(e))
        await publisher.publish_sse(
            rid, "error", {"code": "E_MCP_ERROR", "message": "Search service unavailable"}
        )
        return {"_search_items": [], "_search_total": 0}  # type: ignore[typeddict-unknown-key]

    items = result.get("items", [])
    total = int(result.get("total", len(items)))

    await publisher.publish_sse(
        rid,
        "phase_progress",
        {
            "phase_id": _PHASE_IDS["search"],
            "status": "done",
            "ms": int((time.monotonic() - t0) * 1000),
        },
    )

    _logger.info(
        "mcp.tool_called",
        request_id=rid,
        tool="vespa.hybrid_search",
        rank_profile=rank_profile,
        result_count=total,
    )

    # Empty state handling per Intent 03 spec lines 541-548.
    # Phiên Sx04-12 fix — payload must match SseEmptyStateEvent contract:
    # {message: str, fallback_actions: list, suggested_queries: list[str]}
    if total == 0:
        query_text = state["content"]
        await publisher.publish_sse(
            rid,
            "empty_state",
            {
                "message": f"Em không tìm thấy sản phẩm nào khớp với \"{query_text}\". Anh/chị thử mở rộng tìm kiếm hoặc chụp ảnh sản phẩm nhé.",
                "fallback_actions": [
                    {"type": "widen_query", "label": "Tìm rộng hơn", "value": query_text},
                    {"type": "capture_image", "label": "Chụp ảnh sản phẩm"},
                    {"type": "create_product", "label": "Tạo sản phẩm mới"},
                ],
                "suggested_queries": [
                    "Sản phẩm phổ biến",
                    "Sản phẩm mới",
                    "Khuyến mãi hôm nay",
                ],
            },
        )

    return {"_search_items": items, "_search_total": total}  # type: ignore[typeddict-unknown-key]


async def _per_product_reason(
    product: dict[str, Any], query: str, llm: Any, prompt_template: str
) -> dict[str, Any]:
    """Helper for D-S04-14 LAW per-product LLM parallel emit pattern.

    Each call returns {item_with_reason_or_none, success: bool}. Caller (
    `_node_generate_reasons`) emits `product_ready` SSE as each task settles.
    """
    item = dict(product)  # shallow copy so we can augment
    try:
        prompt = prompt_template.format(query=query, product=json.dumps(product, ensure_ascii=False))
        result = await llm.generate_json(prompt, timeout_s=15.0)
        item["reason"] = result.get("reason", "")
        return {"item": item, "success": True}
    except LLMTimeout:
        # Item-level degrade — emit without reason (only match_score from Vespa).
        return {"item": item, "success": False}


async def _node_generate_reasons(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """Node 6: generate_reasons (Variant B only).

    **D-S04-14 LAW Phiên Sx04-4 per-product LLM parallel emit pattern.**

    For each product from hybrid_search:
        - Spawn asyncio.create_task(_per_product_reason(...))
        - As each task COMPLETES (asyncio.as_completed), publish:
            - `product_ready` SSE event {item, index, total}
            - On FIRST emission (state.first_card_emitted False):
                - Emit `intent.first_card_emitted` ops log via
                  publisher.emit_first_card_emitted_log (idempotency guard)
                - Set state.first_card_emitted=True (in returned dict — LangGraph merges)

    On FULL timeout (ALL products fail): mode flip + interrupt({awaiting:
    'degrade_action'}) — same protocol as generate_understanding.

    Per docs/04_INTENT_SPECS.md Intent 03 lines 287-310.
    """
    rid = state["request_id"]
    if state.get("mode") != "ai_augmented":
        return {}  # Variant A skips

    items = state.get("_search_items") or []  # type: ignore[typeddict-item]
    if not items:
        return {}  # empty already handled at hybrid_search node

    await publisher.publish_sse(
        rid, "phase_progress", {"phase_id": _PHASE_IDS["reasons"], "status": "active"}
    )

    llm = get_llm_client()
    prompt_template = load_prompt("generate_reasons")
    total = len(items)
    t_start = time.monotonic()

    # Track original index so out-of-order completion still maps correctly.
    tasks = {
        asyncio.create_task(_per_product_reason(p, state["content"], llm, prompt_template)): i
        for i, p in enumerate(items)
    }

    enriched: list[dict[str, Any] | None] = [None] * total
    success_count = 0
    first_card_emitted_local = state.get("first_card_emitted", False)

    for fut in asyncio.as_completed(tasks):
        try:
            result = await fut
        except Exception as e:  # noqa: BLE001
            _logger.error("per_product_reason.error", request_id=rid, error=str(e))
            continue

        item = result["item"]
        success = result["success"]
        if success:
            success_count += 1

        # Find original index (asyncio.as_completed doesn't preserve task→index map
        # directly so we scan tasks dict).
        idx = -1
        for task, i in tasks.items():
            if task.done() and enriched[i] is None:
                idx = i
                break
        if idx < 0:
            # Fallback: linear search by id match (shouldn't happen but defensive).
            for i, p in enumerate(items):
                if enriched[i] is None and p.get("id") == item.get("id"):
                    idx = i
                    break

        if idx < 0:
            continue
        enriched[idx] = item

        # **D-S04-14 LAW per-product progressive emit** — publish product_ready.
        await publisher.publish_product_ready(rid, item, idx, total)

        # **D-S04-14 LAW idempotency guard** — emit intent.first_card_emitted ops
        # log ONCE per request_id on FIRST successful per-product emit.
        if not first_card_emitted_local:
            ttfc_ms = int((time.monotonic() - t_start) * 1000)
            publisher.emit_first_card_emitted_log(
                rid,
                time_to_first_card_ms=ttfc_ms,
                total_cards_expected=total,
                mode=state.get("mode", "ai_augmented"),
            )
            first_card_emitted_local = True

    # All settled — check full-failure case.
    if success_count == 0 and total > 0:
        # FULL per-product timeout → mode flip + interrupt (degrade protocol).
        _logger.warning(
            "intent.degraded",
            request_id=rid,
            from_mode="ai_augmented",
            to_mode="basic_fallback",
            reason="llm_timeout",
            node="generate_reasons",
        )
        await publisher.publish_sse(
            rid,
            "variant_degraded",
            {
                # SSE event payload per 03_API_CONTRACTS.md §3 lines 334-340.
                # Same shape as generate_understanding emit above — full
                # per-product timeout treated same as understanding timeout.
                "from": "ai_augmented",
                "to": "basic_fallback",
                "reason": "llm_timeout",
                "error_code": "E_LLM_TIMEOUT",
                # Rule 6 MOCKUP IS LAW — `trace_id` per mockup line 166.
                "trace_id": state.get("trace_id", ""),
                # Mockup intent-03B-state-C-error.html lines 160-161 LOCKED.
                "title": "Mô hình AI phản hồi chậm",
                "user_message": "Em đang quá tải nên chưa viết được lý do gợi ý. Anh có thể dùng bản tìm kiếm cơ bản.",
            },
        )
        await publisher.publish_sse(rid, "status", {"status": "awaiting_user_input"})

        resume = interrupt(
            {"awaiting": "degrade_action", "error_code": "E_LLM_TIMEOUT", "node": "generate_reasons"}
        )
        choice = (resume or {}).get("choice", "continue_basic")
        if choice == "retry_ai":
            return {"mode": "ai_augmented"}
        return {
            "mode": "basic_fallback",
            "degraded_from": "ai_augmented",
            "degraded_reason": "llm_timeout",
            "_search_items": items,  # type: ignore[typeddict-unknown-key]
        }

    await publisher.publish_sse(
        rid,
        "phase_progress",
        {
            "phase_id": _PHASE_IDS["reasons"],
            "status": "done",
            "ms": int((time.monotonic() - t_start) * 1000),
            "success_count": success_count,
            "total": total,
        },
    )

    return {
        "_search_items": [e for e in enriched if e is not None],  # type: ignore[typeddict-unknown-key]
        "first_card_emitted": first_card_emitted_local,
    }


async def _node_rank_finalize(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """Node 7: rank_finalize (Both modes).

    Apply trend boost (Variant B from match_score) or BM25-only ordering
    (Variant A). Publish canonical `products` event (backward-compat per
    D-S04-14 LAW for FE without `product_ready` handler) + final phase done.

    ALWAYS interrupt({awaiting: 'cart_action'}) at end per Option α LAW —
    wait up to 60s for user cart action (Gateway-side timeout default).
    """
    rid = state["request_id"]
    items = state.get("_search_items") or []  # type: ignore[typeddict-item]
    mode = state.get("mode", "ai_augmented")

    # Sort: prefer match_score desc (Variant B), else preserve order (Variant A).
    if mode == "ai_augmented":
        items = sorted(items, key=lambda x: float(x.get("match_score", 0.0)), reverse=True)

    # Canonical `products` event per D-S04-14 LAW backward-compat reconciliation.
    await publisher.publish_sse(
        rid,
        "products",
        {"items": items, "mode": mode},
    )

    await publisher.publish_sse(
        rid, "phase_progress", {"phase_id": _PHASE_IDS["finalize"], "status": "done"}
    )

    await publisher.publish_sse(rid, "status", {"status": "awaiting_user_input"})

    _logger.info(
        "intent.interrupted",
        request_id=rid,
        node="rank_finalize",
        awaiting="cart_action",
    )

    # Option α ALWAYS pause at end — Pattern P2 inline interrupt().
    resume = interrupt({"awaiting": "cart_action", "result_count": len(items)})
    choice = (resume or {}).get("choice", "skip")
    _logger.info(
        "intent.resumed",
        request_id=rid,
        node="rank_finalize",
        resume_choice=choice,
    )

    if choice == "add_to_cart":
        product_id = ((resume or {}).get("value") or {}).get("product_id")
        if product_id:
            return {"cart_trigger_product_id": product_id}
    # 'skip' or no product_id → no cart_trigger, conditional edge skips co_purchase.
    return {}


async def _node_co_purchase_lookup(
    state: IcpState, publisher: RedisPublisher
) -> IcpState:
    """Node 8: co_purchase_lookup (Variant B only — conditional, runs only when
    state.cart_trigger_product_id is set per Option α LAW).

    Read fixture JSON per 02_DATA_MODEL.md §X.2 S-04 stub → emit co_purchase_hint
    SSE.

    Mockup intent-03B-state-E-cart.html lines 215-260 LOCKED:
        - hint text "Khách mua nước tương Maggi thường lấy kèm tương ớt"
        - rate "68% khách mua kèm"
        - suggested product = Tương ớt Chin-su 250g 17.000₫
        - anchor category nuoc_tuong → suggested category tuong_ot
    """
    rid = state["request_id"]
    if state.get("mode") != "ai_augmented":
        return {}  # Variant A doesn't run co-purchase per spec line 500

    trigger_id = state.get("cart_trigger_product_id")
    if not trigger_id:
        return {}

    # Find anchor product in current search items to determine category.
    items = state.get("_search_items") or []  # type: ignore[typeddict-item]
    anchor = next((p for p in items if p.get("id") == trigger_id), None)
    anchor_category = anchor.get("category") if anchor else None

    if not anchor_category:
        _logger.info("copurchase.no_anchor_category", request_id=rid, trigger=trigger_id)
        return {}

    # Load fixture.
    try:
        with open(_COPURCHASE_FIXTURE_PATH, encoding="utf-8") as f:
            fixture = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        _logger.warning("copurchase.fixture_load_failed", request_id=rid, error=str(e))
        return {}

    # Match on anchor_category_id.
    entries = fixture if isinstance(fixture, list) else fixture.get("entries", [])
    match = next(
        (
            e
            for e in entries
            if e.get("anchor_category_id") == anchor_category
            or e.get("anchor_category") == anchor_category
        ),
        None,
    )
    if not match:
        _logger.info("copurchase.no_fixture_match", request_id=rid, anchor=anchor_category)
        return {}

    suggested_category = match.get("suggested_category_id") or match.get("suggested_category")
    rate_pct = int(match.get("rate_pct", 0))
    template = match.get(
        "reason_template",
        "Khách mua {anchor_category_vi} thường lấy kèm {suggested_category_vi}",
    )
    reason = template.format(
        anchor_category_vi=_CATEGORY_VI.get(anchor_category, anchor_category),
        suggested_category_vi=_CATEGORY_VI.get(suggested_category, suggested_category),
    )

    await publisher.publish_sse(
        rid,
        "co_purchase_hint",
        {
            "anchor_product_id": trigger_id,
            "anchor_category": anchor_category,
            "suggested_category": suggested_category,
            "suggested_product_id": match.get("suggested_product_id_seed")
            or match.get("suggested_product_id"),
            "rate_pct": rate_pct,
            "reason": reason,
        },
    )

    return {}


async def _node_final(state: IcpState, publisher: RedisPublisher, saver: Any) -> IcpState:
    """Node 9: final — publish final SSE event + Strategy β fast-path cleanup.

    Per D-S04-13 LAW Strategy β: await saver.adelete_thread(rid) explicitly on
    final emit (best of both worlds with TTL auto-cleanup if user abandons).
    """
    rid = state["request_id"]
    await publisher.publish_sse(
        rid,
        "final",
        {
            "request_id": rid,
            "mode": state.get("mode", "ai_augmented"),
            "result_count": len(state.get("_search_items") or []),  # type: ignore[typeddict-item]
        },
    )

    # Strategy β fast-path cleanup.
    try:
        await saver.adelete_thread(rid)
        _logger.info("intent.checkpoint_cleaned", request_id=rid)
    except Exception as e:  # noqa: BLE001
        _logger.warning("intent.checkpoint_cleanup_failed", request_id=rid, error=str(e))

    return {}


# ============================================================================
# Conditional edge dispatch
# ============================================================================


async def _node_no_product_ref(state: IcpState, publisher: RedisPublisher) -> IcpState:
    """S04-NN-15 node: query is not a product reference. Emit empty_state with
    a WOW suggestion (suggested_real_query) then END. Bypasses Vespa.

    Reuses SseEmptyStateEvent contract {message, fallback_actions,
    suggested_queries} (no shape change -> FE intent-03/page.tsx renders it).
    """
    rid = state["request_id"]
    query_text = state["content"]
    suggested = (state.get("_suggested_real_query") or "").strip()
    if suggested:
        message = (
            f"Shop chua co san pham khop voi \"{query_text}\". "
            f"Em doan anh can \u201c{suggested}\u201d \u2014 thu xem nhe?"
        )
        suggested_queries = [suggested, "San pham pho bien", "Khuyen mai hom nay"]
    else:
        message = (
            f"Em khong tim thay san pham nao khop voi \"{query_text}\". "
            "Anh/chi thu mo rong tim kiem hoac chup anh san pham nhe."
        )
        suggested_queries = ["San pham pho bien", "San pham moi", "Khuyen mai hom nay"]

    await publisher.publish_sse(
        rid,
        "empty_state",
        {
            "message": message,
            "fallback_actions": [
                {"type": "widen_query", "label": "Tim rong hon", "value": suggested or query_text},
                {"type": "capture_image", "label": "Chup anh san pham"},
                {"type": "create_product", "label": "Tao san pham moi"},
            ],
            "suggested_queries": suggested_queries,
        },
    )
    _logger.info(
        "search.no_product_ref",
        request_id=rid,
        query=query_text,
        suggested=suggested,
    )
    return {}


def _route_after_understanding(state: IcpState) -> str:
    """If mode flipped to basic_fallback by generate_understanding interrupt
    resume='continue_basic', skip remaining Variant B LLM nodes per spec
    line 258-261 ("skip remaining Variant B LLM nodes, no parse_filters
    refinement, no generate_reasons").
    """
    # S04-NN-15 gate: not-a-product -> emit empty_state, bypass Vespa.
    if state.get("_skip_search_no_ref"):
        return "no_product_ref"
    if state.get("mode") == "basic_fallback" and state.get("degraded_reason") == "llm_timeout":
        # Jump directly to hybrid_search (skips parse_filters refinement +
        # embed_query + generate_reasons).
        return "hybrid_search"
    return "parse_filters"


def _route_after_rank_finalize(state: IcpState) -> str:
    """Option α LAW: route based on cart_trigger_product_id presence.

    cart_trigger set → co_purchase_lookup; missing/None → final.
    """
    if state.get("cart_trigger_product_id"):
        return "co_purchase_lookup"
    return "final"


# ============================================================================
# Graph builder
# ============================================================================


def compile_searching_by_text_graph(
    saver: AsyncRedisSaver, publisher: RedisPublisher
) -> Any:
    """Compile the 8-node searching_by_text graph with a pre-initialized
    AsyncRedisSaver checkpointer and RedisPublisher.

    Phiên Sx04-7 fix: caller (`main.py`) owns saver + publisher lifecycle —
    saver MUST have been entered as `async with AsyncRedisSaver.from_conn_string(...)`
    AND `await saver.asetup()` called BEFORE this function is invoked,
    otherwise RedisJSON indices won't be registered and node `aput()` will
    fail at runtime.

    Per D-S04-13 LAW Pattern A:
        - AsyncRedisSaver as checkpointer
        - StateGraph.compile(checkpointer=saver)
        - thread_id passed via config in main.py invocation

    Per D-S04-13 LAW Strategy β:
        - ttl={'default_ttl': 30, 'refresh_on_read': True}  (configured by caller)
        - adelete_thread(rid) called explicitly at final node

    Args:
        saver:      AsyncRedisSaver already entered + asetup() called.
        publisher:  RedisPublisher (lazy-init OK; no setup required).

    Returns:
        Compiled LangGraph ready for `.astream(initial_state, config)`.
    """
    # Wrap each node closure binding publisher (+ saver for final cleanup).
    async def n_detect_typo(s: IcpState) -> IcpState:
        return await _node_detect_typo(s, publisher)

    async def n_understanding(s: IcpState) -> IcpState:
        return await _node_generate_understanding(s, publisher)
    async def n_no_product_ref(s: IcpState) -> IcpState:  # S04-NN-15
        return await _node_no_product_ref(s, publisher)

    async def n_parse_filters(s: IcpState) -> IcpState:
        return await _node_parse_filters(s, publisher)

    async def n_embed_query(s: IcpState) -> IcpState:
        return await _node_embed_query(s, publisher)

    async def n_hybrid_search(s: IcpState) -> IcpState:
        return await _node_hybrid_search(s, publisher)


    async def n_generate_reasons(s: IcpState) -> IcpState:
        return await _node_generate_reasons(s, publisher)

    async def n_rank_finalize(s: IcpState) -> IcpState:
        return await _node_rank_finalize(s, publisher)

    async def n_co_purchase(s: IcpState) -> IcpState:
        return await _node_co_purchase_lookup(s, publisher)

    async def n_final(s: IcpState) -> IcpState:
        return await _node_final(s, publisher, saver)

    g = StateGraph(IcpState)
    g.add_node("detect_typo", n_detect_typo)
    g.add_node("generate_understanding", n_understanding)
    g.add_node("no_product_ref", n_no_product_ref)  # S04-NN-15
    g.add_node("parse_filters", n_parse_filters)
    g.add_node("embed_query", n_embed_query)
    g.add_node("hybrid_search", n_hybrid_search)
    g.add_node("generate_reasons", n_generate_reasons)
    g.add_node("rank_finalize", n_rank_finalize)
    g.add_node("co_purchase_lookup", n_co_purchase)
    g.add_node("final", n_final)

    # Edges: linear with conditional skips per spec.
    g.add_edge(START, "detect_typo")
    g.add_edge("detect_typo", "generate_understanding")

    # Conditional after generate_understanding: skip refinement when degraded
    # (continue_basic resume choice).
    g.add_conditional_edges(
        "generate_understanding",
        _route_after_understanding,
        {"parse_filters": "parse_filters", "hybrid_search": "hybrid_search", "no_product_ref": "no_product_ref"},  # S04-NN-15
    )

    g.add_edge("parse_filters", "embed_query")
    g.add_edge("embed_query", "hybrid_search")
    g.add_edge("hybrid_search", "generate_reasons")
    g.add_edge("generate_reasons", "rank_finalize")

    # Conditional after rank_finalize: Option α dispatch on cart_trigger.
    g.add_conditional_edges(
        "rank_finalize",
        _route_after_rank_finalize,
        {"co_purchase_lookup": "co_purchase_lookup", "final": "final"},
    )

    g.add_edge("co_purchase_lookup", "final")
    g.add_edge("final", END)
    g.add_edge("no_product_ref", END)  # S04-NN-15

    compiled = g.compile(checkpointer=saver)
    return compiled


# ============================================================================
# Legacy shim — Phiên Sx04-7 backward-compat
# ============================================================================


def build_searching_by_text_graph(redis_url: str | None = None) -> Any:
    """DEPRECATED — Phiên Sx04-7 fix replaced this with
    `compile_searching_by_text_graph(saver, publisher)`.

    Original signature (Phiên Sx04-5) instantiated `AsyncRedisSaver` via direct
    constructor which silently failed at runtime ("no running event loop"
    error from inside async Redis lazy-init). Calling this function now raises
    immediately with a migration message rather than failing later.

    Migration:
        OLD:
            graph = build_searching_by_text_graph(redis_url)
            async for c in graph.astream(state, config=cfg): ...

        NEW (caller owns saver+publisher lifecycle):
            from langgraph.checkpoint.redis.aio import AsyncRedisSaver
            from .tools.redis_publisher import RedisPublisher
            from .graphs.intents.searching_by_text import (
                compile_searching_by_text_graph,
            )

            async with AsyncRedisSaver.from_conn_string(
                redis_url, ttl={"default_ttl": 30, "refresh_on_read": True}
            ) as saver:
                await saver.asetup()
                publisher = RedisPublisher(redis_url)
                try:
                    graph = compile_searching_by_text_graph(saver, publisher)
                    async for c in graph.astream(state, config=cfg): ...
                finally:
                    await publisher.close()
    """
    _ = redis_url  # silence unused-param warning
    raise RuntimeError(
        "build_searching_by_text_graph() is deprecated since Phiên Sx04-7. "
        "Use compile_searching_by_text_graph(saver, publisher) inside an "
        "`async with AsyncRedisSaver.from_conn_string(...)` block. "
        "See module docstring for migration example."
    )
