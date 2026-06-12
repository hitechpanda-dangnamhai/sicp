"""Intent 01 importing_by_images — Pattern A LangGraph 2-interrupt per D-S04-13
LAW reuse + C-S07-C Φᶜ″ + C-S07-J Ω₂ + C-S07-L empirically validated.

S-07 T01.D (Phiên Sx07-D) — first slice using events.append outbox pattern
(per C-S07-M Option ❸ outbox-only; Kafka publish defers to S-06).

Graph topology (per docs/04_INTENT_SPECS.md Intent 01 + mockup 10 states):

    START
      ├─► vision_analyze (Gemini 2.5 Flash multimodal via MCP vision.analyze)
      │       ├─► IF blur (3-threshold check Ω₂ per C-S07-J empirically validated):
      │       │     overall conf<0.3 OR category in unknown/unreadable/'' OR
      │       │     max(confidence_per_field.values()) < 0.4
      │       │     → publish_sse error E_VISION_BLUR (state-E)
      │       │     → END
      │       └─► proceed to enrich
      ├─► enrich (asyncio.gather 4 tools parallel per C-S07-C Φᶜ″):
      │       - vespa.compare_similar (phase 2 — product fingerprint mockup)
      │       - vespa.search_trend (phase 3)
      │       - shopee.price_range (phase 3)
      │       - gtrends.interest_over_time (phase 3)
      │       Sequential phase_progress SSE emit per D-S04-14 LAW
      │       (FE sees phase_id 1→2→3 sequential even when backend parallel)
      ├─► generate_description (LLM Gemini 2.5 Flash, 15s timeout per D-S04-15 LAW)
      ├─► emit_form_prefill (3 NEW SSE events per C-S07-D):
      │       publish_form_prefill — state-B prefilled form render trigger
      │       publish_market_trend — state-B TrendCard render
      │       publish_shopee_compare — state-B ShopeeCompareCard render
      │       publish_sse status awaiting_user_input
      ├─► INTERRUPT #1 (Pattern A) — await {"awaiting": "submit_draft"}

    USER SUBMIT FORM via POST /intent/{rid}/action {"choice":"submit_draft","value":{...}}

      ├─► emit_draft_event (MCP events.append ProductDraftSubmitted outbox per C-S07-M)
      ├─► find_policies (MCP policies.find_matching with rich context)
      ├─► create_cards (loop matching policies → MCP cards.create + publish SSE card per item)
      ├─► publish_sse status awaiting_user_input
      ├─► INTERRUPT #2 — await {"awaiting": "commit"}

    USER COMMIT via POST /intent/{rid}/action {"choice":"commit"}

      ├─► commit_product (MCP products.create idempotent outbox per C-S07-M
      │     + MCP vespa.index Document API POST per D-S04-10 LAW)
      └─► publish_sse final → END

Reuses (100% from S-04/S-05 emit per handoff §2.3):
    - state.IcpState — extended +6 S-07 fields per T01.D.D6 state.py amendment
    - tools.llm_client.get_llm_client + LLMTimeout — 15s default
    - tools.mcp_client.McpClient + McpError — JSON-RPC 2.0 client
    - tools.redis_publisher.RedisPublisher — extended +3 helpers per T01.D.D8
    - prompts.load_prompt — for generate_description.txt
    - langgraph.checkpoint.redis.aio.AsyncRedisSaver — caller-owned lifecycle
      per Phiên Sx04-7 fix LAW (compile_X_graph(saver, publisher) signature)
    - Pattern A interrupt+resume per D-S04-13 LAW

Reference:
    - slices/S-07_decisions-log.md C-S07-A/B/C/D/F/G/H/I/J/L/M
    - slices/S-04_decisions-log.md D-S04-13 LAW (Pattern A + Option Z + Saver lifecycle)
    - slices/S-04_decisions-log.md D-S04-14 LAW (Progressive Streaming)
    - slices/S-04_decisions-log.md D-S04-15 LAW (LLM timeout calibration)
    - docs/04_INTENT_SPECS.md Intent 01 (graph topology, amended T01.G)
    - docs/mockups/intent-01/intent-01-state-{0,A,B,C-rising,C-falling,D,E,F,G,H}.html
    - apps/ai/src/graphs/intents/cart_by_text.py Pattern A precedent
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, Optional

import structlog
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from opentelemetry import trace

from ...state import IcpState
from ...tools.llm_client import LLMError, LLMTimeout, get_llm_client
from ...tools.mcp_client import McpClient, McpError, identity_kwargs
from ...tools.redis_publisher import RedisPublisher
from ...prompts import load_prompt

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()


def _mcp_url() -> str:
    """Resolve MCP service JSON-RPC endpoint from env."""
    return os.getenv("MCP_URL", "http://mcp:5050/rpc")


# ---------------------------------------------------------------------------
# Blur detection per C-S07-J Ω₂ empirically validated (Phiên Sx07-B 2026-05-26)
# ---------------------------------------------------------------------------

def is_vision_blur_error(result: dict[str, Any]) -> bool:
    """3-threshold blur detection per C-S07-J Ω₂.

    Empirical validation (Phiên Sx07-B with LIVE Gemini 2.5 Flash):
      - Blurry (GaussianBlur radius=18): confidence:0.05 category:"unknown"
        all field confs 0.0 → ALL 3 thresholds fire
      - Clear (radius=0): confidence:0.98 category:"Sauce" max field conf 0.99
        → all 3 pass

    Triggers (ANY fires → blur error):
      1. Overall confidence < 0.3
      2. category in ('unknown', 'unreadable', '')
      3. max(confidence_per_field.values()) < 0.4
    """
    if not isinstance(result, dict):
        return True

    overall = result.get("confidence", 0.0)
    try:
        if float(overall) < 0.3:
            return True
    except (TypeError, ValueError):
        return True

    category = str(result.get("category") or "").strip().lower()
    if category in ("unknown", "unreadable", ""):
        return True

    field_confs = result.get("confidence_per_field") or {}
    if isinstance(field_confs, dict) and field_confs:
        try:
            max_field_conf = max(float(v) for v in field_confs.values())
            if max_field_conf < 0.4:
                return True
        except (TypeError, ValueError):
            return True

    return False


# ---------------------------------------------------------------------------
# Helper — current OTel trace_id hex for SSE error payload trace_id field
# ---------------------------------------------------------------------------

def _current_trace_id() -> str:
    """Get current OTel trace_id as 32-char hex string."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx and ctx.is_valid:
        return f"{ctx.trace_id:032x}"
    return ""


# ===========================================================================
# Node 1: vision_analyze — Gemini multimodal + blur check
# ===========================================================================

async def _node_vision_analyze(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any] | Command:
    """Call MCP vision.analyze + apply 3-threshold blur check.

    Returns either a state update dict (proceed to enrich) or Command(goto=END)
    on blur/error (graph terminates with SSE error emitted).
    """
    rid = state["request_id"]
    image_b64 = state.get("image_b64") or state.get("content", "")

    if not image_b64:
        _logger.error("vision_analyze.no_image", request_id=rid)
        await publisher.publish_sse(rid, "error", {
            "code": "VALIDATION_FAILED",
            "message": "Thiếu dữ liệu ảnh (image_b64)",
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    # Phase 1 SSE — Đọc nhãn sản phẩm (mockup state-A line ~340)
    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 1,
        "status": "active",
        "label": "Đọc nhãn sản phẩm",
        "meta": "Gemini Vision",
    })

    try:
        result = await mcp_client.call(
            "vision.analyze",
            {"image_b64": image_b64, "timeout_s": 15.0},
            **identity_kwargs(state),
        )
    except McpError as e:
        _logger.warning(
            "vision_analyze.mcp_error",
            request_id=rid,
            error=str(e),
        )
        await publisher.publish_sse(rid, "phase_progress", {
            "phase_id": 1, "status": "error",
        })
        await publisher.publish_sse(rid, "error", {
            "code": "E_VISION_FAILED",
            "message": "Phân tích ảnh thất bại — vui lòng thử lại",
            "details": {"retriable": True},
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    # 3-threshold blur check per C-S07-J Ω₂
    if is_vision_blur_error(result):
        _logger.info(
            "vision_analyze.blur_detected",
            request_id=rid,
            confidence=result.get("confidence"),
            category=result.get("category"),
        )
        await publisher.publish_sse(rid, "phase_progress", {
            "phase_id": 1, "status": "error",
        })
        # Mockup state-E line 393 literal: E_VISION_BLUR
        await publisher.publish_sse(rid, "error", {
            "code": "E_VISION_BLUR",
            "message": "Ảnh hơi mờ HOẶC thiếu ánh sáng",
            "details": {"retriable": True},
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 1, "status": "done",
    })
    _logger.info(
        "vision_analyze.done",
        request_id=rid,
        category=result.get("category"),
        confidence=result.get("confidence"),
    )
    return {"_vision_result": result}


# ===========================================================================
# Node 2: enrich — asyncio.gather 4 tools parallel per C-S07-C Φᶜ″
# ===========================================================================

async def _node_enrich(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """asyncio.gather 4 tools parallel; FE sees sequential phase_progress per D-S04-14.

    Phase mapping per C-S07-C Φᶜ″ Move-Compare-Similar-To-Enrich:
      phase 2 = vespa.compare_similar (product fingerprint)
      phase 3 = vespa.search_trend + shopee.price_range + gtrends.interest_over_time
    """
    rid = state["request_id"]
    vision = state.get("_vision_result") or {}
    category = vision.get("category") or ""
    attributes = vision.get("attributes") or {}
    brand = attributes.get("brand") or ""
    size = attributes.get("size") or ""
    keyword = " ".join(p for p in (brand, size, category) if p).strip() or category

    # Phase 2 active — product fingerprint
    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 2,
        "status": "active",
        "label": "Sinh dấu vân tay sản phẩm",
        "meta": "Embedding 512 chiều",
    })

    # asyncio.gather 4 parallel tasks
    product_payload = {
        "title": (attributes.get("brand", "") + " " + attributes.get("size", "")).strip()
                 or vision.get("ocr_text", "")[:80],
        "brand": brand,
        "size": size,
        "category": category,
    }
    compare_task = mcp_client.call("vespa.compare_similar", {
        "product": product_payload, "limit": 10,
    }, **identity_kwargs(state))
    search_trend_task = mcp_client.call("vespa.search_trend", {
        "category": category or "nuoc_tuong", "limit": 10,
    }, **identity_kwargs(state))
    shopee_task = mcp_client.call("shopee.price_range", {
        "category": category or "nuoc_tuong",
        "attributes": {k: attributes.get(k) for k in ("brand", "size") if attributes.get(k)},
    }, **identity_kwargs(state))
    gtrends_task = mcp_client.call("gtrends.interest_over_time", {
        "keyword": keyword,
        "category": category,
        "window_days": 7,
    }, **identity_kwargs(state))

    results = await asyncio.gather(
        compare_task, search_trend_task, shopee_task, gtrends_task,
        return_exceptions=True,
    )
    compare_res, search_trend_res, shopee_res, gtrends_res = results

    # Graceful degrade: replace exceptions with empty defaults
    def _safe(res: Any, default: dict[str, Any]) -> dict[str, Any]:
        if isinstance(res, Exception):
            _logger.warning(
                "enrich.tool_error", request_id=rid, error=str(res),
            )
            return default
        return res if isinstance(res, dict) else default

    compare_data = _safe(compare_res, {"similar_count": 0, "aggregates": {}, "items": []})
    search_trend_data = _safe(search_trend_res, {"items": [], "aggregates": {}})
    shopee_data = _safe(shopee_res, {
        "aggregates": {"min_price": 0, "avg_price": 0, "max_price": 0,
                       "sample_count": 0, "review_count": 0},
        "samples": [], "matched_via": "no_match",
    })
    gtrends_data = _safe(gtrends_res, {
        "trajectory": "stable", "current_score": 50.0, "delta_pct": 0.0,
        "series": [50.0] * 7, "related_rising": [],
        "insight": "Không có dữ liệu trend",
    })

    # Phase 2 done — compare_similar finished
    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 2, "status": "done",
    })
    # Phase 3 active — market analysis
    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 3,
        "status": "active",
        "label": "Phân tích thị trường",
        "meta": "Shopee + Trends + Vespa",
    })
    await publisher.publish_sse(rid, "phase_progress", {
        "phase_id": 3, "status": "done",
    })

    enrich_data = {
        "compare": compare_data,
        "search_trend": search_trend_data,
        "shopee": shopee_data,
        "gtrends": gtrends_data,
    }
    _logger.info(
        "enrich.done",
        request_id=rid,
        similar_count=compare_data.get("similar_count", 0),
        shopee_matched=shopee_data.get("matched_via"),
        trend_trajectory=gtrends_data.get("trajectory"),
    )
    return {"_enrich_data": enrich_data}


# ===========================================================================
# Node 3: generate_description — LLM compose title + description
# ===========================================================================

async def _node_generate_description(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient | None = None,  # D-S10-NN-G-I01-Q4
) -> dict[str, Any]:
    """LLM call to compose product title + description from vision + enrich data.

    Per D-S04-15 LAW 15s timeout. Graceful degrade on timeout: fall back to
    OCR + brand/size concatenation (no LLM-generated polish but flow continues).
    """
    rid = state["request_id"]
    vision = state.get("_vision_result") or {}
    enrich = state.get("_enrich_data") or {}

    prompt_template = load_prompt("generate_description")
    # Compose context for prompt — keep small to fit Flash-Lite context window.
    attrs = vision.get("attributes") or {}
    shopee_agg = (enrich.get("shopee") or {}).get("aggregates") or {}
    trend = enrich.get("gtrends") or {}
    # D-S10-NN-G-I01-Q4: math-first price (strict LAW D-S10-NN-G — LLM never generates the
    # number). suggest_price (pure) computes the prefill; deterministic shopee_avg
    # fallback when the solver does not emit (confidence gate) or no shopee data.
    _price_ctx = {
        "shopee_avg_price": shopee_agg.get("avg_price", 0),
        "shopee_sample_count": shopee_agg.get("sample_count", 0),
        "trend_trajectory": trend.get("trajectory", "stable"),
    }
    _price_solver = (
        await _fetch_price_solver(mcp_client, _price_ctx) if mcp_client else {}
    )
    _algo_price = (
        int(_price_solver["suggested_price"])
        if _price_solver.get("emitted") and _price_solver.get("suggested_price")
        else None
    )

    context_payload = {
        "category": vision.get("category", ""),
        "brand": attrs.get("brand", ""),
        "size": attrs.get("size", ""),
        "type": attrs.get("type", ""),
        "ocr_text": (vision.get("ocr_text") or "")[:200],
        "shopee_avg_price": shopee_agg.get("avg_price", 0),
        "trend_trajectory": trend.get("trajectory", "stable"),
    }
    # Simple {key} placeholder substitution per prompts/__init__.py contract.
    try:
        prompt = prompt_template.format(**context_payload)
    except KeyError as e:
        _logger.warning("generate_description.format_error", missing_key=str(e))
        prompt = prompt_template

    client = get_llm_client()
    try:
        llm_result = await client.generate_json(prompt, timeout_s=15.0)
    except (LLMTimeout, LLMError) as e:
        _logger.warning(
            "generate_description.llm_error",
            request_id=rid,
            error=str(e),
        )
        # Graceful degrade: synthesize from raw attrs
        title_fallback = " ".join(p for p in (
            attrs.get("brand", ""), attrs.get("type", ""), attrs.get("size", ""),
        ) if p).strip() or vision.get("ocr_text", "")[:80] or "Sản phẩm mới"
        return {
            "_description": {
                "title": title_fallback,
                "description": f"{title_fallback} — nhập từ ảnh.",
                "suggested_price": _algo_price if _algo_price is not None else shopee_agg.get("avg_price", 0),  # D-S10-NN-G-I01-Q4
            },
        }

    # Normalize LLM output (defensive — LLM may return partial JSON)
    if not isinstance(llm_result, dict):
        llm_result = {}
    title = str(llm_result.get("title") or "").strip()
    description = str(llm_result.get("description") or "").strip()
    suggested_price = _algo_price if _algo_price is not None else shopee_agg.get("avg_price", 0)  # D-S10-NN-G-I01-Q4
    try:
        suggested_price = int(suggested_price)
    except (TypeError, ValueError):
        suggested_price = shopee_agg.get("avg_price", 0)

    if not title:
        title = " ".join(p for p in (
            attrs.get("brand", ""), attrs.get("type", ""), attrs.get("size", ""),
        ) if p).strip() or "Sản phẩm mới"
    if not description:
        description = f"{title} — nhập từ ảnh."

    _logger.info(
        "generate_description.done",
        request_id=rid,
        title=title[:60],
        suggested_price=suggested_price,
    )
    return {
        "_description": {
            "title": title,
            "description": description,
            "suggested_price": suggested_price,
        },
    }


# ===========================================================================
# Node 4: emit_prefill + INTERRUPT #1
# ===========================================================================

async def _node_emit_prefill_and_interrupt(
    state: IcpState,
    publisher: RedisPublisher,
) -> dict[str, Any]:
    """Publish 3 NEW SSE events (form_prefill + market_trend + shopee_compare),
    then interrupt awaiting user submit_draft action.
    """
    rid = state["request_id"]
    vision = state.get("_vision_result") or {}
    enrich = state.get("_enrich_data") or {}
    desc = state.get("_description") or {}

    # form_prefill — state-B prefilled form render trigger
    form_payload = {
        "category": vision.get("category", ""),
        "attributes": vision.get("attributes") or {},
        "ocr_text": vision.get("ocr_text") or "",
        "confidence": vision.get("confidence", 0.0),
        "confidence_per_field": vision.get("confidence_per_field") or {},
        "alternatives": vision.get("alternatives") or {},
        "suggested_price": desc.get("suggested_price", 0),
        # Helper extras for FE (not in Zod schema; passthrough acceptable per
        # SseFormPrefillEvent z.record... permissive shape).
        "title": desc.get("title", ""),
        "description": desc.get("description", ""),
    }
    await publisher.publish_form_prefill(rid, form_payload)

    # market_trend — state-B TrendCard render
    trend = enrich.get("gtrends") or {}
    await publisher.publish_market_trend(rid, {
        "trajectory": trend.get("trajectory", "stable"),
        "current_score": trend.get("current_score", 50.0),
        "delta_pct": trend.get("delta_pct", 0.0),
        "series": trend.get("series", []),
        "related_rising": trend.get("related_rising", []),
        "insight": trend.get("insight", ""),
    })

    # shopee_compare — state-B ShopeeCompareCard render
    shopee = enrich.get("shopee") or {}
    await publisher.publish_shopee_compare(rid, {
        "aggregates": shopee.get("aggregates") or {
            "min_price": 0, "avg_price": 0, "max_price": 0,
            "sample_count": 0, "review_count": 0,
        },
        "samples": shopee.get("samples") or [],
        "matched_via": shopee.get("matched_via", "no_match"),
    })

    await publisher.publish_sse(rid, "status", {"phase": "awaiting_user_input"})

    _logger.info(
        "import.prefill_emitted_awaiting_submit",
        request_id=rid,
    )

    # INTERRUPT #1 — Pattern A wait for submit_draft action
    action = interrupt({"awaiting": "submit_draft"})

    # Resume: extract submitted form value
    if not isinstance(action, dict):
        action = {}
    choice = action.get("choice")
    value = action.get("value") or {}

    if choice != "submit_draft":
        _logger.info(
            "import.unexpected_choice_at_submit_interrupt",
            request_id=rid,
            choice=choice,
        )
        # Other choices (retake, manual_entry, cancel) terminate the flow.
        await publisher.publish_sse(rid, "final", {
            "status": "cancelled",
            "reason": str(choice or "unknown"),
        })
        return {"_terminated": True}

    return {"_submitted_form": value}


# ===========================================================================
# Node 5: emit_draft_event — events.append ProductDraftSubmitted outbox
# ===========================================================================

async def _node_emit_draft_event(
    state: IcpState,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """INSERT events row (ProductDraftSubmitted, published_at=NULL outbox) per
    C-S07-M Option ❸. NO Kafka publish (defer S-06).
    """
    if state.get("_terminated"):
        return {}

    rid = state["request_id"]
    user_id = state.get("user_id") or "anon"
    submitted = state.get("_submitted_form") or {}
    vision = state.get("_vision_result") or {}
    enrich = state.get("_enrich_data") or {}

    payload = {
        "submitted_form": submitted,
        "vision_result": {
            "category": vision.get("category"),
            "confidence": vision.get("confidence"),
            "ocr_text": (vision.get("ocr_text") or "")[:500],
        },
        "market_trend": (enrich.get("gtrends") or {}).get("trajectory"),
    }

    # Use a synthetic UUID-string aggregate_id for the not-yet-persisted draft.
    # Real product_id arrives after commit_product node (different aggregate cycle).
    import uuid
    draft_id = str(uuid.uuid4())

    try:
        result = await mcp_client.call("events.append", {
            "type": "ProductDraftSubmitted",
            "aggregate_type": "ProductDraft",
            "aggregate_id": draft_id,
            "user_id": user_id if user_id != "anon" else None,
            "payload": payload,
            "metadata": {"request_id": rid},
        }, **identity_kwargs(state))
        event_id = result.get("event_id") if isinstance(result, dict) else None
    except McpError as e:
        _logger.warning(
            "emit_draft_event.mcp_error",
            request_id=rid,
            error=str(e),
        )
        event_id = None

    _logger.info(
        "import.draft_event_emitted",
        request_id=rid,
        draft_id=draft_id,
        event_id=event_id,
    )
    return {"_draft_id": draft_id, "_draft_event_id": event_id}


# ===========================================================================
# Node 6: find_policies — MCP policies.find_matching with rich context
# ===========================================================================

async def _node_find_policies(
    state: IcpState,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Build rich context (price_vs_median, missing_attrs, trend_delta)
    + call policies.find_matching with trigger=ProductDraftSubmitted.
    """
    if state.get("_terminated"):
        return {}

    rid = state["request_id"]
    submitted = state.get("_submitted_form") or {}
    enrich = state.get("_enrich_data") or {}

    # Compute condition-eval bindings
    submitted_price = int(submitted.get("price") or 0)
    shopee_avg = int((enrich.get("shopee") or {}).get("aggregates", {}).get("avg_price") or 0)
    price_vs_median_pct = 0.0
    if shopee_avg > 0:
        price_vs_median_pct = round(((submitted_price - shopee_avg) / shopee_avg) * 100.0, 2)

    submitted_attrs = submitted.get("attrs") or submitted.get("attributes") or {}
    expected_attrs = ("brand", "size", "type")
    missing_attrs = [k for k in expected_attrs if not submitted_attrs.get(k)]
    missing_attrs_count = len(missing_attrs)

    trend_delta_pct = float((enrich.get("gtrends") or {}).get("delta_pct") or 0.0)

    context = {
        "price_vs_median_pct": price_vs_median_pct,
        "missing_attrs_count": missing_attrs_count,
        "missing_attrs": missing_attrs,
        "trend_delta_pct": trend_delta_pct,
        "submitted_price": submitted_price,
        "shopee_avg_price": shopee_avg,
        # D-S10-NN-G-I01: math-first price inputs (additive)
        "shopee_sample_count": int(
            (enrich.get("shopee") or {}).get("aggregates", {}).get("sample_count") or 0
        ),
        "trend_trajectory": (enrich.get("gtrends") or {}).get("trajectory")
        or ("rising" if trend_delta_pct > 5 else "falling" if trend_delta_pct < -5 else "stable"),
        "shopee_samples": (enrich.get("shopee") or {}).get("samples") or [],
        "category": submitted.get("category") or "",
        "title": submitted.get("title") or "",
    }

    try:
        matches = await mcp_client.call("policies.find_matching", {
            "trigger": "ProductDraftSubmitted",
            "context": context,
        }, **identity_kwargs(state))
    except McpError as e:
        _logger.warning(
            "find_policies.mcp_error",
            request_id=rid,
            error=str(e),
        )
        matches = []

    if not isinstance(matches, list):
        matches = []

    _logger.info(
        "import.policies_matched",
        request_id=rid,
        matched_count=len(matches),
        context_summary={
            "price_vs_median_pct": price_vs_median_pct,
            "missing_attrs_count": missing_attrs_count,
            "trend_delta_pct": trend_delta_pct,
        },
    )
    return {"_matched_policies": matches, "_policy_context": context}


# ===========================================================================
# Node 7: create_cards — loop matched policies + emit card SSE per item
# ===========================================================================

async def _node_create_cards(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """For each matched policy: MCP cards.create + publish_sse card event.
    Emits cards progressively per D-S04-14 LAW precedent.
    """
    if state.get("_terminated"):
        return {}

    rid = state["request_id"]
    user_id = state.get("user_id") or "anon"
    matched = state.get("_matched_policies") or []
    draft_event_id = state.get("_draft_event_id")
    policy_context = state.get("_policy_context") or {}
    submitted = state.get("_submitted_form") or {}

    if not draft_event_id:
        _logger.warning(
            "create_cards.no_draft_event_id",
            request_id=rid,
            matched_count=len(matched),
        )
        # Without event_id, cards cannot satisfy FK action_cards.event_id.
        # Skip card creation; user can still commit.
        return {"_cards_created": []}

    if user_id == "anon":
        _logger.warning(
            "create_cards.anonymous_user_skipped",
            request_id=rid,
            matched_count=len(matched),
        )
        return {"_cards_created": []}

    cards_created: list[str] = []
    for match in matched:
        if not isinstance(match, dict):
            continue
        action_type = match.get("action_type", "UNKNOWN")
        policy_id = match.get("policy_id")
        template = match.get("template", "")
        rationale_ctx = match.get("rationale_context") or policy_context

        # Build suggestion JSONB based on action_type
        # D-S10-NN-G-I01: pre-fetch math-first price solver (PRICE only)
        if action_type == "SUGGEST_PRICE":
            rationale_ctx = {
                **rationale_ctx,
                "_price_solver": await _fetch_price_solver(mcp_client, rationale_ctx),
            }
        suggestion = _build_suggestion(action_type, rationale_ctx, submitted)

        try:
            card_result = await mcp_client.call("cards.create", {
                "event_id": draft_event_id,
                "policy_id": policy_id,
                "user_id": user_id,
                "action_type": action_type,
                "suggestion": suggestion,
            }, **identity_kwargs(state))
            card_id = card_result.get("card_id") if isinstance(card_result, dict) else None
        except McpError as e:
            _logger.warning(
                "create_cards.mcp_error",
                request_id=rid,
                action_type=action_type,
                error=str(e),
            )
            continue

        if card_id:
            cards_created.append(card_id)
            # Emit card SSE event per S-02 SseCardEvent (z.unknown — passthrough)
            await publisher.publish_sse(rid, "card", {
                "id": card_id,
                "action_type": action_type,
                "suggestion": suggestion,
                "policy_code": match.get("policy_code"),
                "template": template,
                "status": "pending",
            })

    _logger.info(
        "import.cards_created",
        request_id=rid,
        count=len(cards_created),
    )
    return {"_cards_created": cards_created}


async def _fetch_price_solver(
    mcp_client: McpClient,
    context: dict[str, Any],
) -> dict[str, Any]:
    """D-S10-NN-G-I01: math-first price via analytics.suggest_price.

    Intent 01 only wires PRICE (promo/restock/loan are Intent 07 — they need
    sales history a brand-new product lacks). Returns {} on missing shopee
    data / MCP error → caller falls back to the original heuristic.
    """
    avg = int(context.get("shopee_avg_price") or 0)
    if avg <= 0:
        return {}
    try:
        res = await mcp_client.call("analytics.suggest_price", {
            "shopee_avg_price": avg,
            "shopee_sample_count": int(context.get("shopee_sample_count") or 0),
            "trend_trajectory": context.get("trend_trajectory") or "stable",
            "seller_type": None,
        }, **identity_kwargs(state))
    except McpError:
        return {}
    return res if isinstance(res, dict) else {}


def _build_suggestion(
    action_type: str,
    context: dict[str, Any],
    submitted: dict[str, Any],
) -> dict[str, Any]:
    """Build suggestion JSONB shape per action_type variant (PHASE_03 §F).

    Defensive: never raises; returns minimal shape on missing context.
    """
    if action_type == "SUGGEST_PRICE":
        avg = int(context.get("shopee_avg_price") or 0)
        # D-S10-NN-G-I01: math-first when solver emitted; else heuristic fallback.
        solver = context.get("_price_solver") or {}
        if solver.get("emitted") and solver.get("suggested_price"):
            price = int(solver["suggested_price"])
            return {
                "current_price": int(submitted.get("price") or 0),
                "suggested_price": price,
                "suggested_range": {"min": int(price * 0.97), "max": int(price * 1.03)},
                "confidence": solver.get("confidence"),
                "rationale": (
                    f"Giá đề xuất {price:,} VND (TB Shopee {avg:,} VND, "
                    f"xu hướng {context.get('trend_trajectory') or 'stable'})"
                ),
                "_trace": solver.get("_trace"),
            }
        return {
            "current_price": int(submitted.get("price") or 0),
            "suggested_range": {
                "min": int(avg * 0.95),
                "max": int(avg * 1.10),
            },
            "rationale": f"Giá thị trường trung bình {avg:,} VND",
        }
    if action_type == "SUGGEST_ATTRS":
        return {
            "missing_attrs": context.get("missing_attrs", []),
            "rationale": "Bổ sung thông tin để tăng khả năng tìm kiếm",
        }
    if action_type == "SUGGEST_ALTERNATIVES":
        return {
            "products": (context.get("shopee_samples") or [])[:3],
            "rationale": "Sản phẩm tương tự đang bán tốt",
        }
    if action_type == "SUGGEST_CREDIT_LOAN":
        return {
            "suggested_amount": 5_000_000,
            "terms": "Trả góp 6 tháng",
            "rationale": "Hỗ trợ vốn nhập hàng hot",
        }
    if action_type == "SUGGEST_PROMOTION":
        return {
            "discount_range": {"min": 5, "max": 15},
            "bundle_with": [],
            "rationale": "Khuyến mại để kích thích bán",
        }
    if action_type == "SUGGEST_WAIT_OR_REDUCE":
        return {
            "trend_delta_pct": context.get("trend_delta_pct", 0),
            "rationale": "Thị trường đang giảm — cân nhắc giảm giá hoặc chờ",
        }
    if action_type == "SUGGEST_STOCK_UP":
        return {
            "trend_delta_pct": context.get("trend_delta_pct", 0),
            "rationale": "Thị trường đang lên — nhập thêm để đón sóng",
        }
    return {"rationale": "Gợi ý chung", "action_type": action_type}


# ===========================================================================
# Node 8: emit_cards_status + INTERRUPT #2
# ===========================================================================

async def _node_emit_cards_interrupt(
    state: IcpState,
    publisher: RedisPublisher,
) -> dict[str, Any]:
    """Emit awaiting_user_input status then interrupt awaiting commit action."""
    if state.get("_terminated"):
        return {}

    rid = state["request_id"]
    cards = state.get("_cards_created") or []
    cards_count = len(cards)

    _logger.info(
        "import.cards_emitted_awaiting_commit",
        request_id=rid,
        cards_count=cards_count,
    )
    # Sx07-F-debug Phien 2026-05-27 - Auto-commit if cards empty.
    if cards_count == 0:
        _logger.info("import.auto_commit_no_cards", request_id=rid)
        return {"_commit_confirmed": True}

    await publisher.publish_sse(rid, "status", {"phase": "awaiting_user_input"})
    action = interrupt({"awaiting": "commit"})

    if not isinstance(action, dict):
        action = {}
    choice = action.get("choice")

    if choice != "commit":
        _logger.info(
            "import.unexpected_choice_at_commit_interrupt",
            request_id=rid,
            choice=choice,
        )
        await publisher.publish_sse(rid, "final", {
            "status": "cancelled",
            "reason": str(choice or "unknown"),
        })
        return {"_terminated": True}

    return {"_commit_confirmed": True}


# ===========================================================================
# Node 9: commit_product — products.create + vespa.index
# ===========================================================================

async def _node_commit_product(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """MCP products.create (outbox emit ProductImported) + vespa.index."""
    if state.get("_terminated"):
        return {}

    rid = state["request_id"]
    user_id = state.get("user_id") or "anon"
    submitted = state.get("_submitted_form") or {}
    vision = state.get("_vision_result") or {}
    image_b64 = state.get("image_b64") or state.get("content", "")

    if user_id == "anon":
        await publisher.publish_sse(rid, "error", {
            "code": "UNAUTHORIZED",
            "message": "Bạn cần đăng nhập để nhập hàng",
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    attrs = submitted.get("attrs") or submitted.get("attributes") or vision.get("attributes") or {}
    create_params = {
        "merchant_id": user_id,
        "title": submitted.get("title") or (state.get("_description") or {}).get("title") or "Sản phẩm mới",
        "category": submitted.get("category") or vision.get("category") or "",
        "description": submitted.get("description") or (state.get("_description") or {}).get("description", ""),
        "attributes": attrs,
        "price": int(submitted.get("price") or 0),
        "stock": int(submitted.get("stock") or 0),
        "image_data": image_b64 if image_b64 else None,
        # Sx07-F-debug Phiên 2026-05-26 — Brand from TOP-LEVEL submit field
        # per D-S04-11 LAW. PrefillForm FE lifts brand out of attributes →
        # submit payload has `brand` at top-level. Previous code read
        # `attrs.get("brand")` which is empty after FE remap → Vespa stored
        # empty brand → search brand_filter recall fails (verified Phiên
        # Sx07-F-debug — product e24fba95 created without brand top-level →
        # query "cholimex" with brand_filter="CHOLIMEX" returned only legacy
        # products that still had brand in attributes).
        "brand": submitted.get("brand") or (attrs.get("brand") if isinstance(attrs, dict) else None),
        "trend_score": 0.5,
        "idempotency_key": f"intent:{rid}",
    }

    try:
        create_res = await mcp_client.call(
            "products.create", create_params, **identity_kwargs(state)
        )
    except McpError as e:
        _logger.error(
            "commit_product.create_failed",
            request_id=rid,
            error=str(e),
        )
        await publisher.publish_sse(rid, "error", {
            "code": "INTERNAL_ERROR",
            "message": "Không lưu được sản phẩm — vui lòng thử lại",
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    if not isinstance(create_res, dict) or not create_res.get("product_id"):
        await publisher.publish_sse(rid, "error", {
            "code": "INTERNAL_ERROR",
            "message": "Phản hồi tạo sản phẩm không hợp lệ",
            "request_id": rid,
            "trace_id": _current_trace_id(),
        })
        return Command(goto=END)

    product_id = create_res["product_id"]
    created = create_res.get("created", True)

    # Vespa index (best-effort — failure logged but doesn't rollback PG)
    try:
        await mcp_client.call("vespa.index", {
            "product": {
                "id": product_id,
                "merchant_id": user_id,
                "title": create_params["title"],
                "description": create_params["description"],
                "category": create_params["category"],
                "attributes": attrs if isinstance(attrs, dict) else {},
                "price": create_params["price"],
                "stock": create_params["stock"],
                "brand": create_params.get("brand") or "",
                "image_url": "",
                "trend_score": create_params["trend_score"],
                "status": "active",
            },
        }, **identity_kwargs(state))
        indexed = True
    except McpError as e:
        _logger.warning(
            "commit_product.vespa_index_failed",
            request_id=rid,
            product_id=product_id,
            error=str(e),
        )
        indexed = False

    await publisher.publish_sse(rid, "final", {
        "status": "success",
        "product_id": product_id,
        "created": created,
        "indexed": indexed,
    })
    _logger.info(
        "import.commit_done",
        request_id=rid,
        product_id=product_id,
        created=created,
        indexed=indexed,
    )
    return {"_product_id": product_id, "_committed": True}


# ===========================================================================
# Conditional edges
# ===========================================================================

def _route_after_vision(state: IcpState) -> str:
    """Skip enrich if vision_analyze terminated (blur/error)."""
    if state.get("_terminated"):
        return END
    return "enrich"


def _route_after_emit_prefill(state: IcpState) -> str:
    """Skip remaining nodes if user cancelled at INTERRUPT #1."""
    if state.get("_terminated"):
        return END
    return "emit_draft_event"


def _route_after_cards_interrupt(state: IcpState) -> str:
    """Skip commit if user cancelled at INTERRUPT #2."""
    if state.get("_terminated"):
        return END
    return "commit"


# ===========================================================================
# Compile entry point — caller-owned saver + publisher lifecycle per Phiên Sx04-7
# ===========================================================================

def compile_importing_by_images_graph(
    saver: AsyncRedisSaver,
    publisher: RedisPublisher,
) -> Any:
    """Compile Intent 01 importing_by_images graph.

    Caller (main.py `_drive_graph_async` / `_drive_graph_resume_async`) owns
    saver + publisher lifecycle per Phiên Sx04-7 saver lifecycle correctness LAW.

    Pattern A 2-interrupt per D-S04-13 LAW reuse.
    """
    mcp_client = McpClient(_mcp_url(), timeout_s=30.0)

    # Wrap async nodes as closures binding publisher + mcp_client.
    async def n_vision(s: IcpState) -> Any:
        return await _node_vision_analyze(s, publisher, mcp_client)

    async def n_enrich(s: IcpState) -> Any:
        return await _node_enrich(s, publisher, mcp_client)

    async def n_describe(s: IcpState) -> Any:
        return await _node_generate_description(s, publisher, mcp_client)  # D-S10-NN-G-I01-Q4

    async def n_emit_prefill(s: IcpState) -> Any:
        return await _node_emit_prefill_and_interrupt(s, publisher)

    async def n_emit_draft(s: IcpState) -> Any:
        return await _node_emit_draft_event(s, mcp_client)

    async def n_find_pol(s: IcpState) -> Any:
        return await _node_find_policies(s, mcp_client)

    async def n_create_cards(s: IcpState) -> Any:
        return await _node_create_cards(s, publisher, mcp_client)

    async def n_emit_cards_int(s: IcpState) -> Any:
        return await _node_emit_cards_interrupt(s, publisher)

    async def n_commit(s: IcpState) -> Any:
        return await _node_commit_product(s, publisher, mcp_client)

    builder = StateGraph(IcpState)
    builder.add_node("vision_analyze", n_vision)
    builder.add_node("enrich", n_enrich)
    builder.add_node("generate_description", n_describe)
    builder.add_node("emit_prefill", n_emit_prefill)
    builder.add_node("emit_draft_event", n_emit_draft)
    builder.add_node("find_policies", n_find_pol)
    builder.add_node("create_cards", n_create_cards)
    builder.add_node("emit_cards_interrupt", n_emit_cards_int)
    builder.add_node("commit", n_commit)

    # Linear edges + conditional terminators (blur error / user cancel)
    builder.add_edge(START, "vision_analyze")
    builder.add_conditional_edges("vision_analyze", _route_after_vision, {
        "enrich": "enrich", END: END,
    })
    builder.add_edge("enrich", "generate_description")
    builder.add_edge("generate_description", "emit_prefill")
    builder.add_conditional_edges("emit_prefill", _route_after_emit_prefill, {
        "emit_draft_event": "emit_draft_event", END: END,
    })
    builder.add_edge("emit_draft_event", "find_policies")
    builder.add_edge("find_policies", "create_cards")
    builder.add_edge("create_cards", "emit_cards_interrupt")
    builder.add_conditional_edges("emit_cards_interrupt", _route_after_cards_interrupt, {
        "commit": "commit", END: END,
    })
    builder.add_edge("commit", END)

    return builder.compile(checkpointer=saver)
