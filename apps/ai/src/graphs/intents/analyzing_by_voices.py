"""Intent 07 analyzing_by_voices — Pattern A LangGraph for voice-driven
merchant analytics per D-S10-NN-G LAW (Math-First Reasoning Engine cornerstone)
+ D-S10-NN-A LAW (Voice Analytics Flow) + D-S08-NN-A LAW reuse (Voice Session
Memory Hybrid) + D-S09-NN-A LAW reuse (parallel MCP fan-out).

S-10 T01.D (Phiên Phase2-C) — Analytics Graph Layer.

This module is ADDITIVE and ZERO-BLAST: it clones the verified Pattern A
mechanics from buying_by_voices.py (compile_*_graph(saver, publisher)
signature, node-closure wiring, AsyncRedisSaver checkpointer, RedisPublisher
SSE, Strategy beta adelete_thread cleanup, interrupt() Pattern A) WITHOUT
importing from or modifying buying_by_voices.py. The math lives entirely in
the MCP `analytics.*` tools (deployed analytics.py, 791 LOC). The graph only
orchestrates: query -> solve -> narrate. Per D-S10-NN-G the LLM NEVER produces
numbers; every figure shown traces to a solver `_trace`.

Graph topology (per reasoning_engine_spec.md v2.0 §"Integration S-10"):

    START
      |-> load_context
      |     - Redis GET voice:context:{user_id} -> state.voice_history
      |       (separate key from RedisSaver checkpoint, D-S08-NN-A reuse;
      |        TTL 30min refresh-on-read, FIFO 5 turns). NO cart.get
      |        (analytics path does not touch cart).
      |     - emit status SSE phase='load_context'
      |
      |-> speech_transcribe
      |     - speech.transcribe MCP (Gemini audio, D-S08-NN-03 reuse)
      |     - emit voice_transcribed + partial_text SSE
      |     - on E_TRANSCRIBE_FAILED / E_NO_SPEECH: emit error + -> final
      |
      |-> classify_analyze   (NEW, D-S10-NN-C inline classifier)
      |     - LLM LITE_MODEL generate_json (classify_analyze_intent.txt,
      |       8 few-shot VN) -> {metric, dimension, time_range, filters,
      |       ai_summary_vi, needs_clarification}
      |     - emit phase_progress phase='classify' + understanding SSE
      |     - Pattern A interrupt({awaiting:'analyze_clarify'}) when
      |       needs_clarification (mockup state-I; dormant by default —
      |       classifier conservative). On malformed -> error -> final.
      |
      |-> [conditional: _route_after_classify]  __error__ -> final
      |
      |-> execute_queries    (NEW, parallel D-S09-NN-A)
      |     - asyncio.gather(analytics.aggregate, analytics.detect_anomaly,
      |       analytics.stock_snapshot) — all merchant-filtered by user_id
      |     - emit phase_progress phase='query' + chart SSE (line, monthly)
      |       + tool_result summaries
      |     - empty merchant data -> __nodata__ (text-only "Chua du du lieu")
      |
      |-> [conditional: _route_after_queries]  __nodata__/__error__ -> final
      |
      |-> build_insights     (NEW, PURE python — graph form of
      |     call_tools_smoke.py glue, D-S10-NN-G)
      |     - caution category -> suggest_promo + explain_trend
      |       (price_now=recent_rev/recent_qty, price_prev=prior_rev/prior_qty)
      |     - rising category + low days_left product -> suggest_restock
      |     - suggest_loan(avg_monthly_revenue, tenure_months[from aggregate],
      |       qty_7d, trend, reorder_qty=restock.reorder_qty, unit_price)
      |     - assemble reasoning {price,promo,restock,trend,loan} + cards
      |     - emit analytics_cards SSE (numbers + _trace; NO prose yet)
      |
      |-> narrate            (NEW, LLM narrate-only)
      |     - LLM generate_json (narrate_reasoning.txt) interprets the
      |       solver _trace into VN prose. NEVER generates numbers
      |       (D-S10-NN-G). Fallback deterministic template on LLM failure.
      |     - emit phase_progress phase='narrate' + partial_text narrative
      |
      |-> save_voice_context
      |     - Redis SET voice:context:{user_id} with this analyze turn
      |       (action='analyze', FIFO 5, TTL 30min). Full G.4 cross-intent
      |       shape lands in Phần F.
      |
      |-> final
            - emit final SSE + await saver.adelete_thread(rid) Strategy beta
              (voice:context PERSISTS in its own key per D-S08-NN-A).

Error codes (reuse S-08 + 1 NEW per D-S10-NN-A):
    - E_TRANSCRIBE_FAILED / E_NO_SPEECH       (reuse S-08 speech)
    - E_INTENT_PARSE_FAILED                   (reuse — classify malformed)
    - E_ANALYTICS_TIMEOUT                     (NEW — query/tool failure)

Reuses (no new infra):
    - state.IcpState — extended +11 analytics fields (additive, total=False)
    - tools.llm_client.get_llm_client + LLMTimeout + LITE_MODEL
    - tools.mcp_client.McpClient + McpError
    - tools.redis_publisher.RedisPublisher.publish_sse
    - prompts.load_prompt (classify_analyze_intent + narrate_reasoning)
    - langgraph.checkpoint.redis.aio.AsyncRedisSaver (caller-owned lifecycle)
    - redis.asyncio for voice:context (separate from saver)

Reference:
    - reasoning_engine_spec.md v2.0 (5 solver + 3 SQL tool — deployed)
    - apps/mcp/tests/call_tools_smoke.py (canonical 3-tool->5-solver glue)
    - apps/ai/src/graphs/intents/buying_by_voices.py (Pattern A precedent)
    - docs/04_INTENT_SPECS.md Intent 07 (tool names reconcile Phần J:
      aggregate/detect_anomaly/stock_snapshot win over sales_by_month/...)
    - docs/mockups/intent-07/* (11 states; FE Phần H)
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, Optional

import redis.asyncio as aioredis
import structlog
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from opentelemetry import trace

from ...state import IcpState
from ...tools.llm_client import LLMTimeout, get_llm_client, LITE_MODEL
from ...tools.mcp_client import McpClient, McpError, identity_kwargs
from ...tools.redis_publisher import RedisPublisher
from ...prompts import load_prompt

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()

# ----------------------------------------------------------------------------
# Constants — env-tunable per D-S08-NN-10 + D-S04-03 + D-S08-NN-10 precedent.
# ----------------------------------------------------------------------------

VOICE_CONTEXT_TTL_S = 30 * 60  # 30 minutes per D-S08-NN-A LAW (reuse)
VOICE_CONTEXT_MAX_TURNS = 5  # FIFO truncate per D-S08-NN-A LAW (reuse)
SPEECH_MCP_TIMEOUT_S = 30.0  # MCP HTTP outer timeout; speech.py inner 15s
CLASSIFY_TIMEOUT_S = float(os.getenv("ICP_ANALYZE_CLASSIFY_TIMEOUT", "8.0"))
NARRATE_TIMEOUT_S = float(os.getenv("ICP_ANALYZE_NARRATE_TIMEOUT", "15.0"))
ANALYTICS_MCP_TIMEOUT_S = float(os.getenv("ICP_ANALYTICS_MCP_TIMEOUT", "20.0"))

# Default analytics window when classifier omits one (D-S10-NN-G).
TREND_PERIOD_DEFAULT = os.getenv("ICP_TREND_PERIOD_DEFAULT", "rolling_7d")
ANOMALY_WINDOW_DAYS = int(os.getenv("ICP_ANOMALY_WINDOW_DAYS", "7"))
# Restock candidate gate: product is "low cover" when days_left <= this.
# cover(14) + lead(3) + buffer ≈ 21; Maggi days_left 14 -> triggers.
RESTOCK_DAYS_GATE = int(os.getenv("ICP_RESTOCK_DAYS_GATE", "21"))

_ANALYZE_METRICS = {"revenue", "trend", "stock", "loan", "overview"}


def _mcp_url() -> str:
    return os.getenv("MCP_URL", "http://mcp:5050/rpc")


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


def _voice_context_key(user_id: str, tenant_id: str | None = None) -> str:
    # S-P0-01 T03a (ADR-040 iv): tenant-scoped (shared shape với buying_by_voices).
    # tenant None=dev → key cũ. Key cũ orphan sau deploy — TTL 30min tự hết.
    if tenant_id:
        return f"voice:context:{tenant_id}:{user_id}"
    return f"voice:context:{user_id}"


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ============================================================================
# Voice context Redis helpers (D-S08-NN-A LAW cornerstone — cloned, additive)
# ============================================================================


async def _load_voice_context_redis(
    user_id: str, tenant_id: str | None = None
) -> list[dict[str, Any]]:
    """Load voice:context:{user_id} from Redis. Returns [] if missing.

    Separate Redis key from RedisSaver checkpoint per D-S08-NN-A LAW. TTL
    30min refresh-on-read. Shared shape with buying_by_voices so cross-intent
    recall ("doanh thu món hồi nãy") works (full G.4 wiring lands Phần F).
    """
    client = aioredis.from_url(_redis_url(), decode_responses=True)
    try:
        raw = await client.get(_voice_context_key(user_id, tenant_id))
        if not raw:
            return []
        await client.expire(_voice_context_key(user_id, tenant_id), VOICE_CONTEXT_TTL_S)
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError as e:
            _logger.warning("analyze.context.malformed", user_id=user_id,
                            error=str(e))
            return []
        turns = doc.get("turns") or []
        return turns if isinstance(turns, list) else []
    finally:
        await client.aclose()


async def _save_voice_context_redis(
    user_id: str, turns: list[dict[str, Any]], tenant_id: str | None = None
) -> None:
    """Save voice:context:{user_id} with FIFO truncate + TTL (D-S08-NN-A)."""
    truncated = turns[-VOICE_CONTEXT_MAX_TURNS:]
    doc = {"turns": truncated, "updated_at": _now_iso()}
    client = aioredis.from_url(_redis_url(), decode_responses=True)
    try:
        await client.set(
            _voice_context_key(user_id, tenant_id),
            json.dumps(doc, ensure_ascii=False),
            ex=VOICE_CONTEXT_TTL_S,
        )
    finally:
        await client.aclose()


async def _emit_error_and_route_to_final(
    publisher: RedisPublisher,
    rid: str,
    code: str,
    message_vi: str,
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Emit error SSE + set sentinel voice_action='__error__' so conditional
    edges short-circuit to final (mirrors buying_by_voices error helper)."""
    payload = {"code": code, "message": message_vi, "request_id": rid}
    if details:
        payload["details"] = details
    await publisher.publish_sse(rid, "error", payload)
    _logger.error("analyze.error_emitted", request_id=rid, code=code,
                  message=message_vi)
    return {"voice_action": "__error__"}


def _build_voice_history_text(turns: list[dict[str, Any]]) -> str:
    """Render voice_history as compact JSON for prompt injection."""
    if not turns:
        return "[]"
    compact = []
    for t in turns:
        compact.append({
            "user_utterance": t.get("user_utterance", ""),
            "action": t.get("action", ""),
            "ai_summary_vi": t.get("ai_summary_vi", ""),
        })
    return json.dumps(compact, ensure_ascii=False)


# ============================================================================
# Node 1 — load_context
# ============================================================================


async def _node_load_context(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """Load voice:context:{user_id} from Redis (D-S08-NN-A reuse)."""
    rid = state["request_id"]
    user_id = state.get("user_id") or "anon"

    with _tracer.start_as_current_span("analyze.load_context") as span:
        span.set_attribute("analyze.user_id", user_id)
        await publisher.publish_sse(
            rid, "status", {"phase": "load_context", "request_id": rid},
        )
        voice_history = await _load_voice_context_redis(
            user_id, state.get("tenant_id")
        )
        span.set_attribute("analyze.history_turns", len(voice_history))

    _logger.info("analyze.context_loaded", request_id=rid, user_id=user_id,
                 history_turns=len(voice_history))
    return {"voice_history": voice_history}


# ============================================================================
# Node 2 — speech_transcribe  (cloned from buying_by_voices, D-S08-NN-03)
# ============================================================================


async def _node_speech_transcribe(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """speech.transcribe MCP -> voice_transcribed + partial_text SSE."""
    rid = state["request_id"]

    # S-10 text-entry bypass: when a preset question text is supplied directly
    # (e.g. home "Xem phân tích" → /intent-07?preset=...), skip Gemini STT and
    # use the text as-is. Emits the SAME SSE shape as a real transcription so the
    # downstream graph + FE result view are identical. Additive / zero-blast: the
    # audio path below is untouched and only runs when no preset text is present.
    preset_text = (state.get("voice_text") or "").strip()
    if preset_text:
        await publisher.publish_sse(
            rid, "phase_progress", {"phase": "transcribe", "request_id": rid},
        )
        await publisher.publish_sse(
            rid, "voice_transcribed",
            {"type": "voice_transcribed", "text": preset_text, "confidence": 1.0,
             "duration_ms": 0, "language": "vi"},
        )
        await publisher.publish_sse(
            rid, "partial_text",
            {"text": preset_text, "delta": preset_text, "request_id": rid},
        )
        _logger.info("analyze.transcribe.preset_text", request_id=rid,
                     text_chars=len(preset_text))
        return {"voice_text": preset_text, "voice_confidence": 1.0}

    audio_b64 = state.get("voice_audio_b64") or state.get("content") or ""

    if not audio_b64:
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_NO_SPEECH",
            "Không nhận được dữ liệu giọng nói. Bạn thử lại nhé.",
            {"retriable": True},
        )

    await publisher.publish_sse(
        rid, "phase_progress", {"phase": "transcribe", "request_id": rid},
    )

    mcp = McpClient(_mcp_url(), timeout_s=SPEECH_MCP_TIMEOUT_S)
    try:
        with _tracer.start_as_current_span("analyze.transcribe") as span:
            result = await mcp.call(
                "speech.transcribe",
                {"audio_b64": audio_b64, "mime_type": "audio/webm", "lang": "vi"},
                **identity_kwargs(state),
            )
            span.set_attribute("analyze.text_chars",
                               len((result or {}).get("text", "")))
    except McpError as e:
        detail = (e.data or {}).get("detail", "") if isinstance(e.data, dict) else ""
        if "E_NO_SPEECH" in str(e) or "E_NO_SPEECH" in detail:
            return await _emit_error_and_route_to_final(
                publisher, rid, "E_NO_SPEECH",
                "Không nghe rõ, bạn nói lại nhé?", {"retriable": True},
            )
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_TRANSCRIBE_FAILED",
            "Em không nghe được, bạn thử lại nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )
    except Exception as e:  # noqa: BLE001
        _logger.error("analyze.transcribe.unexpected", request_id=rid, error=str(e))
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_TRANSCRIBE_FAILED",
            "Em không nghe được, bạn thử lại nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )

    text = (result or {}).get("text", "").strip()
    confidence = result.get("confidence")
    duration_ms = int(result.get("duration_ms", 0))
    language = result.get("language", "vi")

    if not text:
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_NO_SPEECH",
            "Không nghe rõ, bạn nói lại nhé?", {"retriable": True},
        )

    await publisher.publish_sse(
        rid, "voice_transcribed",
        {"type": "voice_transcribed", "text": text, "confidence": confidence,
         "duration_ms": duration_ms, "language": language},
    )
    await publisher.publish_sse(
        rid, "partial_text", {"text": text, "delta": text, "request_id": rid},
    )
    _logger.info("analyze.transcribed", request_id=rid, text_chars=len(text),
                 duration_ms=duration_ms, confidence=confidence)
    return {"voice_text": text, "voice_confidence": confidence}


# ============================================================================
# Node 3 — classify_analyze  (NEW, D-S10-NN-C inline + Pattern A interrupt)
# ============================================================================


async def _node_classify_analyze(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """LLM LITE classify analytics sub-intent: metric / dimension /
    time_range / filters. Conservative: only sets needs_clarification when the
    utterance has no analyzable subject. On clarify -> Pattern A interrupt
    (mockup state-I). Numbers are NEVER produced here (D-S10-NN-G)."""
    rid = state["request_id"]
    if state.get("voice_action") == "__error__":
        return {}

    voice_text = state.get("voice_text") or ""
    voice_history = state.get("voice_history") or []

    await publisher.publish_sse(
        rid, "phase_progress", {"phase": "classify", "request_id": rid},
    )

    metric = "overview"
    dimension = "category"
    time_range = TREND_PERIOD_DEFAULT
    filters: dict[str, Any] = {}
    ai_summary_vi = voice_text
    needs_clarification = False
    clarify_options: list[dict[str, Any]] = []

    try:
        template = load_prompt("classify_analyze_intent")
        prompt = template.format(
            voice_history=_build_voice_history_text(voice_history),
            voice_text=voice_text,
        )
        llm = get_llm_client()
        with _tracer.start_as_current_span("analyze.classify") as span:
            parsed = await llm.generate_json(
                prompt=prompt, timeout_s=CLASSIFY_TIMEOUT_S, model=LITE_MODEL,
            )
            span.set_attribute("analyze.metric",
                               (parsed or {}).get("metric", "overview"))
        metric = (parsed or {}).get("metric") or "overview"
        if metric not in _ANALYZE_METRICS:
            metric = "overview"
        dimension = (parsed or {}).get("dimension") or "category"
        time_range = (parsed or {}).get("time_range") or TREND_PERIOD_DEFAULT
        filters = (parsed or {}).get("filters") or {}
        ai_summary_vi = (parsed or {}).get("ai_summary_vi") or voice_text
        needs_clarification = bool((parsed or {}).get("needs_clarification"))
        clarify_options = (parsed or {}).get("clarify_options") or []
    except LLMTimeout:
        # Degrade gracefully to merchant-wide overview (D-S04-14 precedent):
        # analytics still runs, just without a narrow focus.
        _logger.warning("analyze.classify.timeout_degrade", request_id=rid)
    except FileNotFoundError:
        # classify_analyze_intent.txt not yet present (Phần E) — heuristic only.
        _logger.warning("analyze.classify.prompt_missing", request_id=rid)
    except Exception as e:  # noqa: BLE001
        _logger.error("analyze.classify.unexpected", request_id=rid, error=str(e))

    await publisher.publish_sse(
        rid, "understanding", {"text": ai_summary_vi or voice_text, "request_id": rid},
    )

    # Pattern A interrupt (mockup state-I clarify). Dormant by default: the
    # classifier only flags needs_clarification when no analyzable subject was
    # detected AND it can offer concrete options. UX/copy ratify -> Phần H MAR-1.
    if needs_clarification and clarify_options:
        await publisher.publish_sse(
            rid, "status",
            {"phase": "awaiting_user_input", "request_id": rid,
             "reason": "analyze_clarify"},
        )
        await publisher.publish_sse(
            rid, "analytics_clarify",
            {"request_id": rid, "question": ai_summary_vi,
             "options": clarify_options},
        )
        _logger.info("analyze.interrupt_clarify", request_id=rid,
                     n_options=len(clarify_options))
        resume = interrupt({
            "awaiting": "analyze_clarify",
            "question": ai_summary_vi,
            "options": clarify_options,
        })
        choice = (resume or {}).get("choice")
        value = (resume or {}).get("value") or {}
        _logger.info("analyze.resumed", request_id=rid, choice=choice,
                     value=value)
        if choice == "analyze_clarify" and value:
            # Refine focus from the user's pick (e.g. {"category": "..."}).
            if value.get("category"):
                filters["category"] = value["category"]
            if value.get("product_id"):
                filters["product_id"] = value["product_id"]
            if value.get("metric") in _ANALYZE_METRICS:
                metric = value["metric"]
        # else: unexpected/cancel -> proceed with merchant-wide default.

    return {
        "voice_action": "analyze",
        "analyze_metric": metric,
        "analyze_dimension": dimension,
        "analyze_time_range": time_range,
        "analyze_filters": filters,
        "analyze_clarify_pending": False,
    }


# ============================================================================
# Node 4 — execute_queries  (NEW, parallel MCP fan-out D-S09-NN-A)
# ============================================================================


async def _node_execute_queries(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """Parallel analytics.aggregate + detect_anomaly + stock_snapshot
    (all merchant-filtered by user_id). Emits chart SSE from monthly rows.
    Empty merchant -> __nodata__ (text-only branch)."""
    rid = state["request_id"]
    if state.get("voice_action") == "__error__":
        return {}
    merchant_id = state.get("user_id") or ""

    await publisher.publish_sse(
        rid, "phase_progress", {"phase": "query", "request_id": rid},
    )

    if not merchant_id or merchant_id == "anon":
        await publisher.publish_sse(
            rid, "partial_text",
            {"text": "Chưa xác định được cửa hàng để phân tích.",
             "request_id": rid},
        )
        return {"voice_action": "__nodata__"}

    mcp = McpClient(_mcp_url(), timeout_s=ANALYTICS_MCP_TIMEOUT_S)
    try:
        with _tracer.start_as_current_span("analyze.execute_queries"):
            agg, anomaly, stock = await asyncio.gather(
                mcp.call("analytics.aggregate",
                         {"merchant_id": merchant_id, "period": "month"},
                         **identity_kwargs(state)),
                mcp.call("analytics.detect_anomaly",
                         {"merchant_id": merchant_id,
                          "window_days": ANOMALY_WINDOW_DAYS},
                         **identity_kwargs(state)),
                mcp.call("analytics.stock_snapshot",
                         {"merchant_id": merchant_id},
                         **identity_kwargs(state)),
            )
    except McpError as e:
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_ANALYTICS_TIMEOUT",
            "Em chưa lấy được số liệu, bạn thử lại sau chút nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )
    except Exception as e:  # noqa: BLE001
        _logger.error("analyze.queries.unexpected", request_id=rid, error=str(e))
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_ANALYTICS_TIMEOUT",
            "Em chưa lấy được số liệu, bạn thử lại sau chút nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )

    rows = (agg or {}).get("rows") or []
    if not rows and not ((anomaly or {}).get("categories")):
        await publisher.publish_sse(
            rid, "partial_text",
            {"text": "Chưa đủ dữ liệu để phân tích cho cửa hàng của bạn.",
             "request_id": rid},
        )
        _logger.info("analyze.nodata", request_id=rid, merchant_id=merchant_id[:8])
        return {"voice_action": "__nodata__"}

    # Chart spec (line, monthly revenue) for FE state-C. Schema -> Phần G.
    await publisher.publish_sse(
        rid, "chart",
        {"type": "line", "title": "Doanh thu theo tháng", "y_axis": "VND",
         "x_axis": [r.get("label") for r in rows],
         "series": [{"name": "Doanh thu",
                     "data": [r.get("revenue", 0) for r in rows]}],
         "request_id": rid},
    )
    # Light tool_result summaries (usage stats; per 04_INTENT_SPECS).
    await publisher.publish_sse(
        rid, "tool_result",
        {"tool": "analytics.detect_anomaly",
         "merchant_delta_pct": (anomaly or {}).get("merchant", {}).get("delta_pct"),
         "categories": len((anomaly or {}).get("categories") or []),
         "request_id": rid},
    )

    _logger.info("analyze.queries_done", request_id=rid,
                 merchant_id=merchant_id[:8], periods=len(rows),
                 last_30d=(agg or {}).get("last_30d_revenue"),
                 categories=len((anomaly or {}).get("categories") or []),
                 products=len((stock or {}).get("products") or []))

    return {
        "_agg_data": agg or {},
        "_anomaly_data": anomaly or {},
        "_stock_data": stock or {},
    }


# ============================================================================
# Node 5 — build_insights  (NEW, PURE — graph form of call_tools_smoke glue)
# ============================================================================


async def _node_build_insights(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """Deterministic math-first orchestration (D-S10-NN-G). Replicates the
    verified 3-tool -> 5-solver -> cards glue from call_tools_smoke.py, but
    generically (no hard-coded product titles). Solvers are called via MCP
    (analytics.suggest_*); they are pure + return _trace. NO LLM here."""
    rid = state["request_id"]
    if state.get("voice_action") in ("__error__", "__nodata__"):
        return {}

    merchant_id = state.get("user_id") or ""
    agg = state.get("_agg_data") or {}            # type: ignore[typeddict-item]
    anomaly = state.get("_anomaly_data") or {}    # type: ignore[typeddict-item]
    stock = state.get("_stock_data") or {}        # type: ignore[typeddict-item]
    period = state.get("analyze_time_range") or TREND_PERIOD_DEFAULT

    categories = anomaly.get("categories") or []
    cat_by_name = {c.get("category"): c for c in categories}
    merchant = anomaly.get("merchant") or {}
    delta_rev_merchant = int(merchant.get("recent_rev") or 0) - int(merchant.get("prior_rev") or 0)

    reasoning: dict[str, Any] = {
        "price": None, "promo": None, "restock": None, "trend": None, "loan": None,
    }
    cards: list[dict[str, Any]] = []
    mcp = McpClient(_mcp_url(), timeout_s=ANALYTICS_MCP_TIMEOUT_S)

    try:
        # --- (1) worst caution category -> explain_trend + suggest_promo ---
        caution = [c for c in categories if c.get("severity") == "caution"]
        if caution:
            worst = min(caution, key=lambda c: c.get("delta_pct", 0))
            qn = int(worst.get("recent_qty") or 0)
            qp = int(worst.get("prior_qty") or 0)
            rn = int(worst.get("recent_rev") or 0)
            rp = int(worst.get("prior_rev") or 0)
            if qn > 0 and qp > 0:
                trend, promo = await asyncio.gather(
                    mcp.call("analytics.explain_trend", {
                        "qty_now": qn, "qty_prev": qp,
                        "price_now": rn / qn, "price_prev": rp / qp,
                        "delta_rev_category": rn - rp,
                        "delta_rev_merchant": delta_rev_merchant,
                        "period": period,
                        "product_id": None, "merchant_id": merchant_id,
                    }, **identity_kwargs(state)),
                    mcp.call("analytics.suggest_promo",
                             {"delta_pct": worst.get("delta_pct", 0)},
                             **identity_kwargs(state)),
                )
                reasoning["trend"] = trend
                bd = trend.get("breakdown") or [{}, {}]
                vol_pct = bd[0].get("pct") if len(bd) > 0 else None
                price_pct = bd[1].get("pct") if len(bd) > 1 else None
                rationale = (
                    f"{worst.get('category')} {trend.get('delta_revenue_pct')}%: "
                    f"chủ yếu do {trend.get('top_driver')} "
                    f"(sản lượng {vol_pct}% / giá {price_pct}%), "
                    f"đóng góp {trend.get('category_contribution_pct')}% mức giảm chung."
                )
                if promo.get("emitted"):
                    reasoning["promo"] = promo
                    rationale += (
                        f" Đề xuất giảm giá {promo.get('promo_pct')}% "
                        f"→ kỳ vọng hồi phục ~{promo.get('projected_recovery_pct')}%."
                    )
                cards.append({
                    "type": "caution",
                    "category": worst.get("category"),
                    "delta_pct": worst.get("delta_pct"),
                    "rationale": rationale,
                    "reasoning": {"trend": trend, "promo": promo if promo.get("emitted") else None},
                })

        # --- (2) rising category + low days_left product -> suggest_restock ---
        products = stock.get("products") or []
        restock_candidates = [
            p for p in products
            if (p.get("velocity_per_day") or 0) > 0
            and p.get("days_left") is not None
            and p.get("days_left") <= RESTOCK_DAYS_GATE
            and (cat_by_name.get(p.get("category"), {}).get("delta_pct", 0) >= 0)
        ]
        restock = None
        restock_product = None
        if restock_candidates:
            restock_product = min(restock_candidates,
                                  key=lambda p: p.get("days_left", 10 ** 9))
            restock = await mcp.call("analytics.suggest_restock", {
                "qty_7d": int(restock_product.get("qty_7d") or 0),
                "current_stock": int(restock_product.get("current_stock") or 0),
            }, **identity_kwargs(state))
            if restock.get("emitted"):
                reasoning["restock"] = restock
                cards.append({
                    "type": "opportunity",
                    "category": restock_product.get("category"),
                    "product_id": restock_product.get("product_id"),
                    "title": restock_product.get("title"),
                    "rationale": (
                        f"{restock_product.get('title')} bán "
                        f"{restock.get('velocity_per_day')}/ngày, tồn "
                        f"{restock_product.get('current_stock')} (đủ "
                        f"{restock.get('days_left')} ngày) → nên đặt thêm "
                        f"~{restock.get('reorder_qty')}."
                    ),
                    "reasoning": {"restock": restock},
                })

        # --- (3) suggest_loan (reuse restock.reorder_qty + aggregate tenure) ---
        if restock and restock.get("emitted") and restock_product is not None:
            traj = "rising" if cat_by_name.get(
                restock_product.get("category"), {}).get("delta_pct", 0) >= 0 else "stable"
            loan = await mcp.call("analytics.suggest_loan", {
                "avg_monthly_revenue": int(agg.get("last_30d_revenue") or 0),
                "tenure_months": float(agg.get("tenure_months") or 0),
                "qty_7d": int(restock_product.get("qty_7d") or 0),
                "trend_trajectory": traj,
                "reorder_qty": int(restock.get("reorder_qty") or 0),
                "unit_price": int(restock_product.get("unit_price") or 0),
            }, **identity_kwargs(state))
            if loan.get("emitted"):
                reasoning["loan"] = loan
                cards.append({
                    "type": "loan",
                    "rationale": (
                        f"Cửa hàng đủ điều kiện vay ~"
                        f"{int(loan.get('suggested_amount') or 0):,}đ / "
                        f"{loan.get('term_months')} tháng "
                        f"(uy tín {loan.get('reputation')}, hạn mức 0.5× doanh thu "
                        f"{int(agg.get('last_30d_revenue') or 0):,})."
                    ),
                    "reasoning": {"loan": loan},
                })
    except McpError as e:
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_ANALYTICS_TIMEOUT",
            "Em chưa tính được đề xuất, bạn thử lại sau chút nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )
    except Exception as e:  # noqa: BLE001
        _logger.error("analyze.insights.unexpected", request_id=rid, error=str(e))
        return await _emit_error_and_route_to_final(
            publisher, rid, "E_ANALYTICS_TIMEOUT",
            "Em chưa tính được đề xuất, bạn thử lại sau chút nhé.",
            {"retriable": True, "detail": str(e)[:200]},
        )

    await publisher.publish_sse(
        rid, "analytics_cards",
        {"request_id": rid, "count": len(cards), "cards": cards,
         "reasoning": reasoning},
    )
    _logger.info("analyze.insights_built", request_id=rid, n_cards=len(cards),
                 has_promo=reasoning["promo"] is not None,
                 has_restock=reasoning["restock"] is not None,
                 has_loan=reasoning["loan"] is not None)

    return {"analyze_reasoning": reasoning, "analyze_cards": cards}


# ============================================================================
# Node 6 — narrate  (NEW, LLM narrate-only — NEVER generates numbers)
# ============================================================================


def _fallback_narrative(cards: list[dict[str, Any]]) -> str:
    """Deterministic VN narrative assembled from card rationales — used when
    narrate_reasoning.txt is absent (Phần E) or the LLM call fails. Numbers
    come from the solver _trace via Python, not generated (D-S10-NN-G safe)."""
    if not cards:
        return "Doanh thu cửa hàng nhìn chung ổn định, chưa có cảnh báo nào."
    parts = [c.get("rationale", "") for c in cards if c.get("rationale")]
    return " ".join(parts)


async def _node_narrate(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """LLM interprets solver _trace into VN prose. NEVER produces numbers
    (D-S10-NN-G): the prompt only rephrases values already in _trace. Falls
    back to a deterministic template on any failure."""
    rid = state["request_id"]
    if state.get("voice_action") in ("__error__", "__nodata__"):
        return {}

    cards = state.get("analyze_cards") or []          # type: ignore[typeddict-item]
    reasoning = state.get("analyze_reasoning") or {}  # type: ignore[typeddict-item]

    await publisher.publish_sse(
        rid, "phase_progress", {"phase": "narrate", "request_id": rid},
    )

    narrative = _fallback_narrative(cards)
    try:
        template = load_prompt("narrate_reasoning")
        prompt = template.format(
            reasoning=json.dumps(reasoning, ensure_ascii=False),
            cards=json.dumps(cards, ensure_ascii=False),
        )
        llm = get_llm_client()
        with _tracer.start_as_current_span("analyze.narrate"):
            parsed = await llm.generate_json(
                prompt=prompt, timeout_s=NARRATE_TIMEOUT_S,
            )
        cand = (parsed or {}).get("narrative_vi")
        if isinstance(cand, str) and cand.strip():
            narrative = cand.strip()
    except FileNotFoundError:
        _logger.warning("analyze.narrate.prompt_missing", request_id=rid)
    except LLMTimeout:
        _logger.warning("analyze.narrate.timeout_fallback", request_id=rid)
    except Exception as e:  # noqa: BLE001
        _logger.error("analyze.narrate.unexpected", request_id=rid, error=str(e))

    await publisher.publish_sse(
        rid, "partial_text",
        {"text": narrative, "delta": narrative, "request_id": rid},
    )
    _logger.info("analyze.narrated", request_id=rid, chars=len(narrative))
    return {"analyze_narrative": narrative}


# ============================================================================
# Node 7 — save_voice_context  (analyze turn; full G.4 shape -> Phần F)
# ============================================================================


async def _node_save_voice_context(
    state: IcpState, publisher: RedisPublisher
) -> dict[str, Any]:
    """Persist this analyze turn into voice:context:{user_id} (D-S08-NN-A
    reuse). Minimal shape now; full cross-intent G.4 shape (matched_products /
    parsed_items / action='analyze.run') lands in Phần F."""
    rid = state["request_id"]
    user_id = state.get("user_id") or "anon"
    if state.get("voice_action") in ("__error__", "__nodata__"):
        return {}

    # G.4: conform to the S-08 voice:context turn shape so cross-intent
    # recall works both ways (buying can recall an analyze turn; analyze
    # can read a buy turn). matched_products = top sellers by qty_7d (REAL,
    # from order_items via stock_snapshot), top-first, so an ordinal recall
    # like "thêm cái bán chạy nhất" resolves to matched_products[0] in
    # buying_by_voices._resolve_one. parsed_items=[] (analyze adds no cart
    # items). intent/metric are ADDITIVE fields beyond the S-08 shape.
    _stock = state.get("_stock_data") or {}  # type: ignore[typeddict-item]
    _top = sorted((_stock.get("products") or []),
                  key=lambda p: (p.get("qty_7d") or 0), reverse=True)[:5]
    matched_products = [
        {"id": p.get("product_id"), "title": p.get("title")}
        for p in _top if p.get("product_id")
    ]
    this_turn = {
        "request_id": rid,
        "user_utterance": state.get("voice_text", ""),
        "action": "analyze.run",
        "intent": "analyze",          # additive beyond S-08 shape
        "parsed_items": [],
        "matched_products": matched_products,
        "ai_summary_vi": state.get("analyze_narrative", ""),
        "metric": state.get("analyze_metric"),  # additive
        "ts": _now_iso(),
    }
    existing = state.get("voice_history") or []  # type: ignore[typeddict-item]
    new_history = list(existing) + [this_turn]
    try:
        await _save_voice_context_redis(
            user_id, new_history, state.get("tenant_id")
        )
        _logger.info("analyze.context_saved", request_id=rid, user_id=user_id,
                     total_turns=len(new_history[-VOICE_CONTEXT_MAX_TURNS:]))
    except Exception as e:  # noqa: BLE001
        _logger.warning("analyze.context_save_failed", request_id=rid,
                        user_id=user_id, error=str(e))
    return {}


# ============================================================================
# Node 8 — final  (Strategy beta cleanup — cloned from buying_by_voices)
# ============================================================================


async def _node_final(
    state: IcpState, publisher: RedisPublisher, saver: Any
) -> dict[str, Any]:
    """Terminal node — emit final SSE + Strategy beta RedisSaver cleanup.
    voice:context:{user_id} PERSISTS in its separate key (D-S08-NN-A)."""
    rid = state["request_id"]
    voice_action = state.get("voice_action", "")
    await publisher.publish_sse(
        rid, "final",
        {"request_id": rid, "modality": "voice", "intent": "analyze",
         "voice_action": voice_action,
         "card_count": len(state.get("analyze_cards") or [])},
    )
    try:
        await saver.adelete_thread(rid)
        _logger.info("intent.checkpoint_cleaned", request_id=rid)
    except Exception as e:  # noqa: BLE001
        _logger.warning("intent.checkpoint_cleanup_failed", request_id=rid,
                        error=str(e))
    return {}


# ============================================================================
# Conditional edge functions
# ============================================================================


def _route_after_classify(state: IcpState) -> str:
    """__error__ sentinel -> final; else proceed to queries."""
    if state.get("voice_action") == "__error__":
        return "final"
    return "execute_queries"


def _route_after_queries(state: IcpState) -> str:
    """__error__ / __nodata__ -> final (skip insights/narrate/save)."""
    if state.get("voice_action") in ("__error__", "__nodata__"):
        return "final"
    return "build_insights"


# ============================================================================
# Graph builder — compile_analyzing_by_voices_graph(saver, publisher)
# ============================================================================


def compile_analyzing_by_voices_graph(
    saver: AsyncRedisSaver, publisher: RedisPublisher
) -> Any:
    """Compile the analyzing_by_voices graph (Intent 07).

    Same caller contract as compile_buying_by_voices_graph (Phiên Sx04-7 fix
    LAW): caller (main.py) owns saver + publisher lifecycle; saver MUST be
    entered + asetup() before invocation. Pattern A interrupt + Strategy beta
    cleanup per D-S04-13 LAW. voice:context is a SEPARATE Redis key per
    D-S08-NN-A LAW (untouched by saver.adelete_thread).
    """
    async def n_load_context(s: IcpState) -> dict[str, Any]:
        return await _node_load_context(s, publisher)

    async def n_speech_transcribe(s: IcpState) -> dict[str, Any]:
        return await _node_speech_transcribe(s, publisher)

    async def n_classify_analyze(s: IcpState) -> dict[str, Any]:
        return await _node_classify_analyze(s, publisher)

    async def n_execute_queries(s: IcpState) -> dict[str, Any]:
        return await _node_execute_queries(s, publisher)

    async def n_build_insights(s: IcpState) -> dict[str, Any]:
        return await _node_build_insights(s, publisher)

    async def n_narrate(s: IcpState) -> dict[str, Any]:
        return await _node_narrate(s, publisher)

    async def n_save_voice_context(s: IcpState) -> dict[str, Any]:
        return await _node_save_voice_context(s, publisher)

    async def n_final(s: IcpState) -> dict[str, Any]:
        return await _node_final(s, publisher, saver)

    g = StateGraph(IcpState)
    g.add_node("load_context", n_load_context)
    g.add_node("speech_transcribe", n_speech_transcribe)
    g.add_node("classify_analyze", n_classify_analyze)
    g.add_node("execute_queries", n_execute_queries)
    g.add_node("build_insights", n_build_insights)
    g.add_node("narrate", n_narrate)
    g.add_node("save_voice_context", n_save_voice_context)
    g.add_node("final", n_final)

    g.add_edge(START, "load_context")
    g.add_edge("load_context", "speech_transcribe")
    g.add_edge("speech_transcribe", "classify_analyze")

    g.add_conditional_edges(
        "classify_analyze", _route_after_classify,
        {"execute_queries": "execute_queries", "final": "final"},
    )
    g.add_conditional_edges(
        "execute_queries", _route_after_queries,
        {"build_insights": "build_insights", "final": "final"},
    )
    g.add_edge("build_insights", "narrate")
    g.add_edge("narrate", "save_voice_context")
    g.add_edge("save_voice_context", "final")
    g.add_edge("final", END)

    compiled = g.compile(checkpointer=saver)
    return compiled
