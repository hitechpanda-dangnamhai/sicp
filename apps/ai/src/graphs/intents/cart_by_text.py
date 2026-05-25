"""Intent 05 cart_by_text — Pattern A LangGraph with 2 entry intents per
D-S05-01/03/04 LAW + sub-decisions D-S05-09/10/11 + C-S05-E/F resolutions.

S-05 T02 (Phiên Sx05-2b) — Backend Services Layer.

Graph topology (per docs/04_INTENT_SPECS.md Intent 05 post-T02 reconcile):

    START
      ├─► [conditional edge on state.entry_intent — _route_entry]
      │       ├─► cart_clear_confirm entry:
      │       │     clear_confirm_prompt node
      │       │       emit clear_confirm SSE (item_count + subtotal +
      │       │         user_message BE-templated + advice) per D-S05-10
      │       │       emit status awaiting_user_input SSE
      │       │       interrupt({"awaiting": "clear_action"})
      │       │     clear_execute node (after resume)
      │       │       ├─► resume choice='confirm_clear' →
      │       │       │     cart.clear MCP + emit cart_cleared (minimal per D-S05-11)
      │       │       └─► resume choice='cancel_clear' →
      │       │             emit clear_cancelled (no-op cart mutation)
      │       │     → final
      │       └─► cart_view_with_stock_check entry:
      │             cart_view node
      │               cart.get MCP (loads cart + inline validate_stock)
      │               ├─► no out-of-stock items: emit cart_view_ready → final
      │               └─► detect out-of-stock list: route to stock_issue_lookup
      │             stock_issue_lookup node (per D-S05-04 LAW + C-S05-E path-a)
      │               For each out-of-stock product_id:
      │                 vespa.hybrid_search category+brand exclude (8s soft-timeout)
      │                 LLMClient.generate_json cart_stock_replacement_reason.txt
      │                 emit stock_issue_ready PER item (progressive per
      │                   D-S04-14 product_ready pattern via publish_cart_event)
      │                 If Vespa null OR LLM 8s soft-timeout:
      │                   Fallback to cart_stock_replacement.json fixture
      │                   lookup by category+brand anchor (C-S05-E path-a)
      │                 If both null: emit stock_issue_ready with
      │                   replacement=null + reason=null (FE shows only "Bỏ" CTA)
      │               emit stock_issue_summary SSE
      │               emit status awaiting_user_input SSE
      │               interrupt({"awaiting": "stock_action", "product_id": ...})
      │             stock_resolve node (after resume)
      │               ├─► resume choice='resolve_remove' →
      │               │     cart.remove MCP → emit cart_updated
      │               └─► resume choice='resolve_replace' →
      │                     cart.remove + cart.update_qty (add replacement) →
      │                     emit cart_updated
      │             → final
      └─► final node
            emit final SSE event
            await saver.adelete_thread(rid)  (Strategy β fast-path cleanup
              per D-S04-13 LAW — same pattern as searching_by_text.py)

Reuses (100% from S-04 emit per handoff §2.3):
    - state.IcpState — extended +8 fields per S-05 T02 (state.py amendment)
    - tools.llm_client.get_llm_client + LLMTimeout — 15s default + 8s override
    - tools.mcp_client.McpClient + McpError — JSON-RPC 2.0 client
    - tools.redis_publisher.RedisPublisher + publish_cart_event (S-05 helper)
    - prompts.load_prompt — for cart_stock_replacement_reason.txt
    - langgraph.checkpoint.redis.aio.AsyncRedisSaver — caller-owned lifecycle
      per Phiên Sx04-7 fix LAW (compile_X_graph(saver, publisher) signature)

Reference:
    - slices/S-05_decisions-log.md D-S05-01..05 LAW + D-S05-09/10/11
      + C-S05-E (fixture-load fallback path-a) + C-S05-F (Path α hint enum)
    - docs/handoff/00/PHASE_00_INTENT_05_MOCKUP_HANDOFF.md §3-4
    - Mockup intent-05-state-F-clear-confirm.html (clear_confirm UX)
    - Mockup intent-05-state-E-stock-issue.html (stock_issue_ready UX)
    - apps/ai/src/graphs/intents/searching_by_text.py Pattern A precedent
      (lines 38-58 topology, 168-195 typo interrupt, 651-685 cart_action)
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, Optional

import structlog
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from opentelemetry import trace

from ...state import IcpState
from ...tools.llm_client import LLMTimeout, get_llm_client
from ...tools.mcp_client import McpClient, McpError
from ...tools.redis_publisher import RedisPublisher
from ...prompts import load_prompt

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()

# D-S05-04 LAW soft timeout per R-S05-2 mitigation (8s — tighter than
# llm_client.DEFAULT_TIMEOUT_S=15s to allow graceful degrade within demo
# perceived-latency budget).
_STOCK_LLM_SOFT_TIMEOUT_S = 8.0

# C-S05-E path-a resolution: fixture file consulted only when Vespa+LLM
# primary returns null OR LLM 8s soft-timeout fires.
_CART_STOCK_FIXTURE_PATH = os.getenv(
    "CART_STOCK_FIXTURE_PATH", "/app/infra/seed/cart_stock_replacement.json"
)


def _mcp_url() -> str:
    return os.getenv("MCP_URL", "http://mcp:5050/rpc")


def _format_vnd(amount: int) -> str:
    """Format integer VND as '175.000' with Vietnamese thousand-separator dots.

    Used for BE-templated user_message string per D-S05-10 LAW (mockup
    state-F line 196 dynamic copy embedding subtotal).
    """
    s = f"{int(amount):,}"
    # f-string `:,` uses comma; swap to dot per VND convention.
    return s.replace(",", ".")


# ============================================================================
# Node implementations
# ============================================================================


async def _node_clear_confirm_prompt(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Node 1a: clear_confirm_prompt (cart_clear_confirm entry).

    Loads current cart via cart.get MCP → emits clear_confirm SSE with
    BE-templated user_message + advice per D-S05-09/10 LAW → emits
    status:awaiting_user_input → interrupts on 'clear_action' resume.

    Mockup intent-05-state-F-clear-confirm.html ground truth:
        line 196 dynamic copy: "Em sẽ xoá {N} món trị giá {X}₫ khỏi giỏ.
                                Hành động này không thể hoàn tác."
        line 209 advice line: "Nếu chỉ muốn bỏ vài món, anh hãy vuốt sang
                                trái từng item thay vì xoá hết."
    """
    rid = state["request_id"]
    # Sx05-3-CODE HOTFIX (D-S05-13 LAW): read authenticated user_id from
    # IcpState (propagated by Gateway POST /intent JwtAuthGuard → AI main.py
    # initial_state per fix #2). Pre-hotfix this was `state.get("content") or
    # "smoke-user-anon"` which ALWAYS fell back to anon (content holds user
    # query text, NOT user_id) → wrong cart cleared per Bug #1+#2 manual test.
    user_id = state.get("user_id") or "anon"

    try:
        cart = await mcp_client.call("cart.get", {"user_id": user_id})
    except McpError as e:
        _logger.warning(
            "cart_clear.cart_get_failed", request_id=rid, error=str(e)
        )
        cart = {"items": [], "totals": {"subtotal": 0}}

    item_count = len(cart.get("items", []))
    subtotal = int((cart.get("totals") or {}).get("subtotal", 0))
    user_message = (
        f"Em sẽ xoá {item_count} món trị giá {_format_vnd(subtotal)}₫ khỏi giỏ. "
        f"Hành động này không thể hoàn tác."
    )
    advice = (
        "Nếu chỉ muốn bỏ vài món, anh hãy vuốt sang trái từng item "
        "thay vì xoá hết."
    )

    await publisher.publish_cart_event(
        rid,
        "clear_confirm",
        {
            "item_count": item_count,
            "subtotal": subtotal,
            "user_message": user_message,
            "advice": advice,
        },
    )
    await publisher.publish_sse(
        rid, "status", {"status": "awaiting_user_input"}
    )
    _logger.info(
        "intent.interrupted",
        request_id=rid,
        node="clear_confirm_prompt",
        awaiting="clear_action",
    )

    # Pattern P2 inline interrupt — graph pauses; RedisSaver persists.
    resume = interrupt({"awaiting": "clear_action"})
    choice = (resume or {}).get("choice")
    _logger.info(
        "intent.resumed",
        request_id=rid,
        node="clear_confirm_prompt",
        resume_choice=choice,
    )
    return {"cart_clear_action": choice}


async def _node_clear_execute(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Node 1b: clear_execute — branches on cart_clear_action resume choice.

    confirm_clear → cart.clear MCP + emit cart_cleared
    cancel_clear  → emit clear_cancelled (no cart mutation)
    """
    rid = state["request_id"]
    # Sx05-3-CODE HOTFIX (D-S05-13 LAW) — see _node_cart_clear_prompt docstring.
    user_id = state.get("user_id") or "anon"
    choice = state.get("cart_clear_action")

    if choice == "confirm_clear":
        try:
            await mcp_client.call("cart.clear", {"user_id": user_id})
            _logger.info("cart.cleared_via_graph", request_id=rid, user_id=user_id)
        except McpError as e:
            _logger.error(
                "cart_clear.mcp_failed", request_id=rid, error=str(e)
            )
            # Still emit cart_cleared so FE refetches and reconciles
            # (per D-S05-11 LAW minimal trigger; truth source is GET /cart).
        await publisher.publish_cart_event(rid, "cart_cleared", {})
    else:
        # 'cancel_clear' OR missing/unknown choice → safe cancel path.
        await publisher.publish_cart_event(rid, "clear_cancelled", {})
        _logger.info(
            "cart.clear_cancelled", request_id=rid, resume_choice=choice
        )

    return {}


async def _node_cart_view(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Node 2a: cart_view (cart_view_with_stock_check entry).

    Loads cart via cart.get MCP (inline validate_stock per A4 LAW). Inspects
    items for in_stock=False. If none: emit cart_view_ready + END. Else:
    populate state._cart_data + _cart_out_of_stock_ids for downstream
    stock_issue_lookup node.
    """
    rid = state["request_id"]
    # Sx05-3-CODE HOTFIX (D-S05-13 LAW) — see _node_cart_clear_prompt docstring.
    user_id = state.get("user_id") or "anon"

    try:
        cart = await mcp_client.call("cart.get", {"user_id": user_id})
    except McpError as e:
        _logger.error(
            "cart_view.cart_get_failed", request_id=rid, error=str(e)
        )
        # Defensive: treat as empty cart — emit cart_view_ready and bail.
        await publisher.publish_cart_event(rid, "cart_view_ready", {})
        return {"_cart_data": {"items": []}, "_cart_out_of_stock_ids": []}

    items = cart.get("items") or []
    out_of_stock_ids = [
        it["product_id"] for it in items
        if not it.get("in_stock", True) and it.get("product_id")
    ]

    if not out_of_stock_ids:
        # Happy path — no stock issues.
        await publisher.publish_cart_event(rid, "cart_view_ready", {})
        _logger.info(
            "cart_view.no_stock_issue",
            request_id=rid,
            item_count=len(items),
        )
        return {
            "_cart_data": cart,
            "_cart_out_of_stock_ids": [],
        }

    _logger.info(
        "cart_view.stock_issue_detected",
        request_id=rid,
        out_of_stock_count=len(out_of_stock_ids),
        product_ids=out_of_stock_ids,
    )
    return {
        "_cart_data": cart,
        "_cart_out_of_stock_ids": out_of_stock_ids,
    }


def _route_after_cart_view(state: IcpState) -> str:
    """Conditional edge after cart_view: route to stock_issue_lookup or final."""
    if state.get("_cart_out_of_stock_ids"):
        return "stock_issue_lookup"
    return "final"


def _fixture_lookup_replacement(
    out_of_stock_item: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """C-S05-E path-a fallback: load cart_stock_replacement.json fixture and
    match by anchor_category + anchor_brand_filter.

    Returns dict {product_id, title, brand, unit_price, available_stock} or
    None on no match / fixture missing.

    Note: fixture entries use `*_seed` placeholder IDs (resolved at seed time
    against real Postgres rows). For Sx05-2b emit, fixture is best-effort
    demo safety net — Vespa+LLM primary is the production runtime path.
    """
    try:
        fixture = json.loads(
            __import__("pathlib").Path(_CART_STOCK_FIXTURE_PATH).read_text(
                encoding="utf-8"
            )
        )
    except (OSError, json.JSONDecodeError) as e:
        _logger.warning(
            "stock_issue.fixture_load_failed", error=str(e)
        )
        return None

    if not isinstance(fixture, list) or not fixture:
        return None

    snapshot = out_of_stock_item.get("snapshot") or {}
    item_brand = (snapshot.get("brand") or "").strip().lower()
    item_category = (snapshot.get("category") or "").strip().lower()

    for entry in fixture:
        if not isinstance(entry, dict):
            continue
        anchor_cat = str(entry.get("anchor_category", "")).strip().lower()
        anchor_brand = str(entry.get("anchor_brand_filter", "")).strip().lower()
        if anchor_cat and item_category and anchor_cat != item_category:
            continue
        if anchor_brand and item_brand and anchor_brand != item_brand:
            continue
        # Match — note: fixture replacement_product_id_seed is unresolved at
        # fixture-load time. Caller (smoke / demo) should ensure seed rewrite
        # happened. For runtime safety, surface the seed key as product_id
        # placeholder (FE will skip "Thay" CTA if shape invalid per Zod).
        repl_id = entry.get("replacement_product_id_seed")
        if not isinstance(repl_id, str):
            continue
        return {
            "product_id": repl_id,
            "title": str(entry.get("replacement_product_title_seed", "")),
            "brand": str(entry.get("anchor_brand_filter", "")),
            "unit_price": int(entry.get("replacement_unit_price", 0)),
            "available_stock": int(entry.get("replacement_available_stock", 0)),
        }
    return None


async def _node_stock_issue_lookup(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Node 2b: stock_issue_lookup per D-S05-04 LAW.

    For each out-of-stock product_id:
      1. vespa.hybrid_search same category, excluding the out-of-stock id,
         top-1 result with 8s soft-timeout.
      2. If hit: LLMClient.generate_json cart_stock_replacement_reason.txt
         (8s soft-timeout per R-S05-2 mitigation).
      3. If Vespa null OR LLM timeout: fallback to fixture lookup
         (C-S05-E path-a resolution).
      4. Emit stock_issue_ready PER item (progressive D-S04-14 pattern via
         publish_cart_event helper).

    After all per-item lookups complete: emit stock_issue_summary, then
    emit status awaiting_user_input, then interrupt('stock_action').
    """
    rid = state["request_id"]
    out_of_stock_ids = state.get("_cart_out_of_stock_ids") or []
    cart_items = (state.get("_cart_data") or {}).get("items") or []

    # Map product_id → item for quick snapshot lookup.
    item_by_id = {it["product_id"]: it for it in cart_items if it.get("product_id")}

    replacements: dict[str, Optional[dict[str, Any]]] = {}
    llm = get_llm_client()

    for pid in out_of_stock_ids:
        item = item_by_id.get(pid) or {}
        snapshot = item.get("snapshot") or {}
        category = snapshot.get("category", "")
        brand = snapshot.get("brand", "")
        title = snapshot.get("title", "")

        replacement: Optional[dict[str, Any]] = None
        reason: Optional[str] = None

        # Step 1: Vespa primary search (same category, excluding out-of-stock).
        vespa_hit: Optional[dict[str, Any]] = None
        try:
            search_q = title or category or "thay thế"
            vespa_result = await asyncio.wait_for(
                mcp_client.call(
                    "vespa.hybrid_search",
                    {
                        "query": search_q,
                        "category_filter": category or None,
                        "brand_filter": brand or None,
                        "limit": 5,
                        "rank_profile": "ai_augmented",
                    },
                ),
                timeout=_STOCK_LLM_SOFT_TIMEOUT_S,
            )
            hits = (vespa_result or {}).get("items") or []
            # Top-1 excluding the out-of-stock product_id itself.
            for h in hits:
                hpid = h.get("product_id") or h.get("id")
                if hpid and hpid != pid and int(h.get("stock", 0)) > 0:
                    vespa_hit = h
                    break
        except (asyncio.TimeoutError, McpError) as e:
            _logger.warning(
                "stock_issue.vespa_lookup_failed",
                request_id=rid,
                product_id=pid,
                error=type(e).__name__,
            )

        # Step 2: LLM reason if Vespa hit found.
        if vespa_hit:
            try:
                prompt = load_prompt("cart_stock_replacement_reason").format(
                    out_of_stock_product=json.dumps(snapshot, ensure_ascii=False),
                    replacement_product=json.dumps(vespa_hit, ensure_ascii=False),
                )
                llm_out = await llm.generate_json(
                    prompt, timeout_s=_STOCK_LLM_SOFT_TIMEOUT_S
                )
                reason = str(llm_out.get("reason", "")) or None
                replacement = {
                    "product_id": str(vespa_hit.get("product_id") or vespa_hit.get("id", "")),
                    "title": str(vespa_hit.get("title", "")),
                    "brand": str(vespa_hit.get("brand", "")),
                    "unit_price": int(vespa_hit.get("price", 0)),
                    "available_stock": int(vespa_hit.get("stock", 0)),
                }
            except LLMTimeout:
                _logger.warning(
                    "stock_issue.llm_timeout_soft",
                    request_id=rid,
                    product_id=pid,
                )
                # Keep replacement from Vespa, reason=None (FE handles
                # null reason gracefully per Zod schema).
                replacement = {
                    "product_id": str(vespa_hit.get("product_id") or vespa_hit.get("id", "")),
                    "title": str(vespa_hit.get("title", "")),
                    "brand": str(vespa_hit.get("brand", "")),
                    "unit_price": int(vespa_hit.get("price", 0)),
                    "available_stock": int(vespa_hit.get("stock", 0)),
                }
                reason = None
            except Exception as e:  # noqa: BLE001
                _logger.warning(
                    "stock_issue.llm_other_error",
                    request_id=rid,
                    product_id=pid,
                    error=str(e),
                )

        # Step 3: Fixture fallback (C-S05-E path-a) when Vespa returned nothing.
        if replacement is None:
            fixture_repl = _fixture_lookup_replacement(item)
            if fixture_repl:
                replacement = fixture_repl
                reason = "Cùng dòng sản phẩm, dung tích lớn tiết kiệm hơn."
                _logger.info(
                    "stock_issue.fixture_fallback_used",
                    request_id=rid,
                    product_id=pid,
                    replacement_id=replacement.get("product_id"),
                )

        # Step 4: Emit per-item stock_issue_ready (progressive D-S04-14 pattern).
        await publisher.publish_cart_event(
            rid,
            "stock_issue_ready",
            {
                "product_id": pid,
                "replacement": replacement,
                "reason": reason,
            },
        )
        replacements[pid] = replacement

    # Emit summary after all per-item events.
    await publisher.publish_cart_event(
        rid,
        "stock_issue_summary",
        {
            "out_of_stock_count": len(out_of_stock_ids),
            "product_ids": out_of_stock_ids,
        },
    )
    await publisher.publish_sse(
        rid, "status", {"status": "awaiting_user_input"}
    )
    _logger.info(
        "intent.interrupted",
        request_id=rid,
        node="stock_issue_lookup",
        awaiting="stock_action",
        out_of_stock_count=len(out_of_stock_ids),
    )

    # Pattern P2 inline interrupt — waits for user to pick "Bỏ" or "Thay" per item.
    # For Sx05-2b scope, single-interrupt handles 1 item at a time; FE may
    # POST /action multiple times for multi-item resolution (S-06 owner may
    # add batch-resolve semantics later).
    resume = interrupt({
        "awaiting": "stock_action",
        "product_ids": out_of_stock_ids,
    })
    resume_value = (resume or {}).get("value") or {}
    choice = (resume or {}).get("choice")
    _logger.info(
        "intent.resumed",
        request_id=rid,
        node="stock_issue_lookup",
        resume_choice=choice,
    )

    return {
        "_cart_stock_replacements": replacements,
        "cart_stock_action": choice,
        "cart_stock_resolve_product_id": str(resume_value.get("product_id", "")),
        "cart_stock_resolve_replacement_id": resume_value.get("replacement_id"),
    }


async def _node_stock_resolve(
    state: IcpState,
    publisher: RedisPublisher,
    mcp_client: McpClient,
) -> dict[str, Any]:
    """Node 2c: stock_resolve — execute cart mutation per resume choice.

    resolve_remove  → cart.remove MCP for product_id
    resolve_replace → cart.remove (out-of-stock) + cart.update_qty (replacement)

    Emits cart_updated SSE (minimal trigger per D-S05-11 LAW — FE refetches).
    """
    rid = state["request_id"]
    # Sx05-3-CODE HOTFIX (D-S05-13 LAW) — see _node_cart_clear_prompt docstring.
    user_id = state.get("user_id") or "anon"
    choice = state.get("cart_stock_action")
    product_id = state.get("cart_stock_resolve_product_id", "")
    replacement_id = state.get("cart_stock_resolve_replacement_id")

    if not product_id:
        _logger.warning(
            "stock_resolve.missing_product_id",
            request_id=rid,
            choice=choice,
        )
        await publisher.publish_cart_event(rid, "cart_updated", {})
        return {}

    try:
        if choice == "resolve_remove":
            await mcp_client.call(
                "cart.remove",
                {"user_id": user_id, "product_id": product_id},
            )
            _logger.info(
                "stock_resolve.removed",
                request_id=rid,
                product_id=product_id,
            )
        elif choice == "resolve_replace":
            # 1) Remove out-of-stock item.
            await mcp_client.call(
                "cart.remove",
                {"user_id": user_id, "product_id": product_id},
            )
            # 2) Add replacement product (uses qty=1 default; FE may
            #    surface a qty stepper post-resolve if needed).
            if isinstance(replacement_id, str) and replacement_id:
                await mcp_client.call(
                    "cart.update_qty",
                    {
                        "user_id": user_id,
                        "product_id": replacement_id,
                        "qty": 1,
                    },
                )
            _logger.info(
                "stock_resolve.replaced",
                request_id=rid,
                product_id=product_id,
                replacement_id=replacement_id,
            )
        else:
            _logger.warning(
                "stock_resolve.unknown_choice",
                request_id=rid,
                choice=choice,
            )
    except McpError as e:
        _logger.error(
            "stock_resolve.mcp_failed",
            request_id=rid,
            choice=choice,
            error=str(e),
        )
        # Still emit cart_updated so FE refetches (last-source-of-truth contract).

    await publisher.publish_cart_event(rid, "cart_updated", {})
    return {}


async def _node_final(
    state: IcpState,
    publisher: RedisPublisher,
    saver: Any,
) -> dict[str, Any]:
    """Node terminal: emit final SSE + Strategy β fast-path RedisSaver cleanup.

    Mirrors searching_by_text.py:_node_final pattern.
    """
    rid = state["request_id"]
    entry = state.get("entry_intent", "")
    await publisher.publish_sse(
        rid,
        "final",
        {
            "request_id": rid,
            "entry_intent": entry,
            "mode": state.get("mode", "ai_augmented"),
        },
    )
    try:
        await saver.adelete_thread(rid)
        _logger.info("intent.checkpoint_cleaned", request_id=rid)
    except Exception as e:  # noqa: BLE001
        _logger.warning(
            "intent.checkpoint_cleanup_failed",
            request_id=rid,
            error=str(e),
        )
    return {}


# ============================================================================
# Conditional edge dispatch
# ============================================================================


def _route_entry(state: IcpState) -> str:
    """Conditional edge from START: dispatch by entry_intent.

    Per D-S05-01 LAW + C-S05-F Path α: state.entry_intent is set by
    main.py from POST /intent body hint field. None/unknown → safety
    fallback to final (graph wraps gracefully without crashing).
    """
    entry = state.get("entry_intent")
    if entry == "cart_clear_confirm":
        return "clear_confirm_prompt"
    if entry == "cart_view_with_stock_check":
        return "cart_view"
    _logger.warning("cart_graph.unknown_entry_intent", entry=entry)
    return "final"


# ============================================================================
# Graph builder
# ============================================================================


def compile_cart_by_text_graph(
    saver: AsyncRedisSaver, publisher: RedisPublisher
) -> Any:
    """Compile the cart_by_text LangGraph with a pre-initialized
    AsyncRedisSaver checkpointer and RedisPublisher.

    Phiên Sx04-7 fix LAW: caller (main.py) owns saver + publisher lifecycle.
    saver MUST have been entered as `async with
    AsyncRedisSaver.from_conn_string(...)` AND `await saver.asetup()` called
    BEFORE this function is invoked.

    Args:
        saver:      AsyncRedisSaver already entered + asetup() called.
        publisher:  RedisPublisher (lazy-init OK; no setup required).

    Returns:
        Compiled LangGraph ready for `.astream(initial_state, config)`.
    """
    # MCP client construction is cheap (lazy httpx client); one per request.
    mcp_client = McpClient(_mcp_url())

    # Wrap each node closure binding publisher + mcp_client (+ saver for final).
    async def n_clear_prompt(s: IcpState) -> dict[str, Any]:
        return await _node_clear_confirm_prompt(s, publisher, mcp_client)

    async def n_clear_execute(s: IcpState) -> dict[str, Any]:
        return await _node_clear_execute(s, publisher, mcp_client)

    async def n_cart_view(s: IcpState) -> dict[str, Any]:
        return await _node_cart_view(s, publisher, mcp_client)

    async def n_stock_lookup(s: IcpState) -> dict[str, Any]:
        return await _node_stock_issue_lookup(s, publisher, mcp_client)

    async def n_stock_resolve(s: IcpState) -> dict[str, Any]:
        return await _node_stock_resolve(s, publisher, mcp_client)

    async def n_final(s: IcpState) -> dict[str, Any]:
        return await _node_final(s, publisher, saver)

    g = StateGraph(IcpState)
    g.add_node("clear_confirm_prompt", n_clear_prompt)
    g.add_node("clear_execute", n_clear_execute)
    g.add_node("cart_view", n_cart_view)
    g.add_node("stock_issue_lookup", n_stock_lookup)
    g.add_node("stock_resolve", n_stock_resolve)
    g.add_node("final", n_final)

    # Entry dispatch from START.
    g.add_conditional_edges(
        START,
        _route_entry,
        {
            "clear_confirm_prompt": "clear_confirm_prompt",
            "cart_view": "cart_view",
            "final": "final",
        },
    )

    # cart_clear_confirm flow: prompt → execute → final
    g.add_edge("clear_confirm_prompt", "clear_execute")
    g.add_edge("clear_execute", "final")

    # cart_view_with_stock_check flow: view → (stock_lookup OR final)
    g.add_conditional_edges(
        "cart_view",
        _route_after_cart_view,
        {
            "stock_issue_lookup": "stock_issue_lookup",
            "final": "final",
        },
    )
    g.add_edge("stock_issue_lookup", "stock_resolve")
    g.add_edge("stock_resolve", "final")

    g.add_edge("final", END)

    compiled = g.compile(checkpointer=saver)
    return compiled
