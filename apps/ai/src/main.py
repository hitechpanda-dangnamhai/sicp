"""Flask app factory for ICP AI service.

S-04 T02 amendment (Phiên Sx04-5 per D-S04-13 LAW Option Z + Option α):
    - POST /intent: REWRITE Phase 1 stub JSON response → SSE streaming response
      using Flask `stream_with_context` + async generator subscribing to Redis
      pub/sub channel `sse:pubsub:{request_id}` (Option Z transport).
    - POST /intent/{rid}/resume: NEW internal endpoint receiving Gateway-forwarded
      action body `{choice, value?}` → calls `graph.astream(Command(resume=<choice>),
      config={'configurable': {'thread_id': rid}})` resuming graph from interrupt
      checkpoint (Pattern A semantics per `03_API_CONTRACTS.md §1.2` line 95-96).
    - Request_id authoritative at AI service per Q-Sx04-3-6 Option A LAW —
      generated here via `uuid.uuid4()`; single namespace across Redis checkpoint
      + Gateway intent cache + SSE pub/sub channel.

----------------------------------------------------------------------------
PHIÊN Sx04-7 FIX AMENDMENT (2026-05-24) — async/sync boundary correctness:

Original bug (Phiên Sx04-5): `_drive_graph_async` instantiated saver via
`build_searching_by_text_graph(redis_url)` which internally called
`AsyncRedisSaver(redis_url=..., ttl=...)` — direct constructor that does NOT
init the async Redis client nor register RedisJSON indices. First graph node
async-invoked saver `aput()` → "no running event loop" error → graph crashed
silently → SSE channel never received any event → Gateway timed out after 10s
→ HTTP 500.

Root cause per langgraph-checkpoint-redis docs
(https://pypi.org/project/langgraph-checkpoint-redis/):
    AsyncRedisSaver MUST be constructed via
    `AsyncRedisSaver.from_conn_string(url, ttl=cfg)` as an async context
    manager + explicit `await saver.asetup()` to register Redis indices.

Fix strategy in this file:
    - `_drive_graph_async` and `_drive_graph_resume_async` REWRITE to wrap
      saver setup + publisher creation + graph compilation + astream loop
      ALL inside a single coroutine running in a single event loop:

          async def _astream_with_saver():
              async with AsyncRedisSaver.from_conn_string(
                  url, ttl={"default_ttl": 30, "refresh_on_read": True}
              ) as saver:
                  await saver.asetup()
                  publisher = RedisPublisher(url)
                  try:
                      graph = compile_searching_by_text_graph(saver, publisher)
                      async for _ in graph.astream(state, config=cfg):
                          pass
                  finally:
                      await publisher.close()

    - Background thread + `asyncio.new_event_loop()` pattern KEPT — Flask sync
      request handler still cannot host the async graph directly. The thread
      remains as the boundary between Flask sync world and LangGraph async
      world; saver/publisher just live inside the coroutine instead of being
      built sync-first.
----------------------------------------------------------------------------

CRITICAL initialization order (parity với T01 Gateway pattern):
    1. init_otel()    — register TracerProvider + exporters BEFORE Flask import.
    2. create_logger() — configure structlog with 6 LOCKED schema fields.
    3. Flask(__name__) — app instance.
    4. Routes register.

Endpoints:
    GET  /health                      — liveness; always 200 when process is up.
    GET  /ready                       — readiness; 200 always (deps check defer).
    POST /intent                      — UNIVERSAL intent SSE stream (S-04 T02
                                        rewrite).
    POST /intent/<rid>/resume         — INTERNAL Gateway-forwarded action resume
                                        (S-04 T02 NEW per D-S04-13 LAW).

Reference:
    - docs/03_API_CONTRACTS.md §1.2 + §3 SSE Output sequence
    - slices/S-04_decisions-log.md D-S04-13 LAW Pattern A + Option Z + Option α
    - slices/S-04_decisions-log.md D-S04-15 (Phiên Sx04-7 saver lifecycle fix)
    - docs/02_DATA_MODEL.md §5 Redis key namespaces (`sse:pubsub:{rid}` +
      `intent:checkpoint:{rid}`)
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Any, AsyncIterator

import redis.asyncio as aioredis
import structlog
from flask import Flask, Response, jsonify, request, stream_with_context
from langgraph.checkpoint.redis.aio import AsyncRedisSaver
from langgraph.types import Command
from opentelemetry import trace

from . import __version__
from .graphs.intents import compile_searching_by_text_graph
from .graphs.router_graph import router_graph
from .observability import create_logger, init_otel
from .tools.redis_publisher import RedisPublisher

# RedisSaver TTL config per D-S04-13 LAW Strategy β:
#   ttl={'default_ttl': 30, 'refresh_on_read': True}
#   + explicit adelete_thread(rid) at final node (fast-path cleanup).
_SAVER_TTL_CONFIG = {"default_ttl": 30, "refresh_on_read": True}

# Redis pub/sub channel template per D-S04-13 LAW Option Z + 02_DATA_MODEL.md §5.
_SSE_PUBSUB_CHANNEL_TEMPLATE = "sse:pubsub:{request_id}"

# SSE heartbeat interval — keeps connection alive during interrupt user-think pauses
# (5-10s typical) per D-S04-13 Option Z architecture note. 15s < Gateway 60s timeout.
_SSE_HEARTBEAT_S = 15.0

# How long to wait for the first event before giving up on the channel and closing.
# If graph crashes before any publish, we don't want to hang indefinitely.
_SSE_FIRST_EVENT_TIMEOUT_S = 30.0


def _redis_url() -> str:
    """Resolve Redis URL from env (default localhost dev fallback)."""
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _scoped_id(tenant_id: str | None, request_id: str) -> str:
    """RedisSaver thread_id + SSE tenant-channel suffix scoped theo tenant.

    S-P0-01 T03a (ADR-040 amend iv): thread_id = `{tenant}:{rid}` khi có tenant,
    plain `{rid}` khi anonymous/dev. Checkpoint cũ (thread_id=rid) TTL 30min tự
    hết — KHÔNG migrate. Dùng chung cho RedisSaver thread_id + kênh dev-subscribe
    để initial + resume khớp namespace.
    """
    return f"{tenant_id}:{request_id}" if tenant_id else request_id


def _format_sse_message(event_type: str, data: dict[str, Any]) -> str:
    """Format a single SSE message per W3C EventSource spec.

    SSE format:
        event: <event_type>\n
        data: <json>\n
        \n
    """
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _sse_subscribe_stream(
    request_id: str, tenant_id: str | None = None
) -> AsyncIterator[str]:
    """Subscribe to Redis pub/sub channel and yield SSE messages forwarded by
    the graph (via redis_publisher).

    S-P0-01 T03a: dev-subscribe đọc kênh tenant-scoped `sse:pubsub:{tenant}:{rid}`
    (graph dual-publish cả 2 kênh). tenant None → kênh cũ `sse:pubsub:{rid}`.
    Đây là đường DEV direct-call; production Gateway subscribe kênh cũ tới T03b.

    Per D-S04-13 LAW Option Z: AI service publishes; this endpoint just
    forwards published messages to the EventSource. In production the Gateway
    is what subscribes — but in dev / direct-call mode this endpoint also
    subscribes so smoke tests can drive the graph without Gateway hop.

    Cleanup:
        - On `final` event: break loop + close subscription
        - On timeout / client disconnect: caller handles via `stream_with_context`
    """
    channel = f"sse:pubsub:{_scoped_id(tenant_id, request_id)}"
    client = aioredis.from_url(_redis_url(), decode_responses=True)
    pubsub = client.pubsub()
    try:
        await pubsub.subscribe(channel)
        # Yield initial comment to flush headers to client.
        yield ":connected\n\n"

        last_activity = asyncio.get_event_loop().time()
        first_event_seen = False

        while True:
            now = asyncio.get_event_loop().time()
            # Pre-first-event hang guard
            if not first_event_seen and (now - last_activity) > _SSE_FIRST_EVENT_TIMEOUT_S:
                yield _format_sse_message(
                    "error",
                    {"code": "E_NO_EVENTS", "message": "No events received from graph"},
                )
                break

            # Block-with-timeout for next pub/sub message.
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=_SSE_HEARTBEAT_S)
            if msg is None:
                # Heartbeat comment so Gateway / browser keeps connection alive.
                yield ": heartbeat\n\n"
                continue

            first_event_seen = True
            last_activity = asyncio.get_event_loop().time()

            data_raw = msg.get("data")
            if not data_raw:
                continue

            # Each pub/sub message is a pre-serialized SSE block of form:
            #   event: <type>\ndata: <json>\n\n
            # (published by redis_publisher.publish_sse helper)
            try:
                yield data_raw if data_raw.endswith("\n\n") else data_raw + "\n\n"
            except Exception:  # noqa: BLE001
                # Defensive: if message is malformed, surface as error event.
                yield _format_sse_message(
                    "error", {"code": "E_INTERNAL", "message": "Malformed pub/sub message"}
                )
                continue

            # Detect terminal `final` event and close.
            if "event: final" in data_raw:
                break
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            await client.close()
        except Exception:  # noqa: BLE001
            pass


def _drive_graph_async(initial_state: dict[str, Any]) -> None:
    """Spawn an asyncio task that runs the search graph to completion.

    Per D-S04-13 LAW Pattern A: graph publishes SSE events directly to Redis
    pub/sub during its execution; this function does not collect results — it
    just drives the graph and lets the SSE subscriber forward events to FE.

    Runs the graph in a fresh event loop in a background thread (Flask sync
    request context cannot host an asyncio.run() without conflict). For
    production a proper task queue (Celery / RQ) would replace this; for
    hackathon smoke it's sufficient.

    Phiên Sx04-7 fix: AsyncRedisSaver MUST be entered via
    `async with AsyncRedisSaver.from_conn_string(...)` + `await saver.asetup()`
    INSIDE the new event loop — direct constructor leaves the internal Redis
    client uninitialized, causing "no running event loop" at first aput().
    """
    import threading

    redis_url = _redis_url()
    request_id = initial_state["request_id"]
    # S-P0-01 T03a: tenant cho dual-publish + thread_id scope (ADR-040 iv / 048 c).
    tenant_id = initial_state.get("tenant_id")

    def _runner() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _astream_with_saver() -> None:
            # Async context manager: enters Redis connection pool + (after
            # asetup()) registers RedisJSON/RediSearch indices that the saver
            # uses to namespace checkpoints under `checkpoint:{thread_id}:...`.
            async with AsyncRedisSaver.from_conn_string(
                redis_url, ttl=_SAVER_TTL_CONFIG
            ) as saver:
                await saver.asetup()
                publisher = RedisPublisher(redis_url=redis_url, tenant_id=tenant_id)
                try:
                    # ─── Phiên Sx04-12 EMERGENCY FIX: wait-for-subscriber gate ───
                    # D-S04-13 LAW Option Z race condition: graph publishes
                    # immediately on spawn, but Gateway/FE need ~50-500ms to
                    # open EventSource + SUBSCRIBE channel. Without this gate,
                    # all early events (phase_progress, understanding, first
                    # product_ready) publish to subscriber_count=0 → void.
                    #
                    # Poll PUBSUB NUMSUB <channel> until ≥1 subscriber, max 3s.
                    # If timeout: continue anyway (best-effort — direct-call
                    # dev mode in main.py _sse_subscribe_stream may pick up
                    # later events, and FE will at least see final/error).
                    pub_client = await publisher._ensure_client()
                    # S-P0-01 T03a: gate poll kênh CŨ `sse:pubsub:{rid}` CÓ CHỦ Ý —
                    # consumer production là Gateway, vẫn subscribe kênh cũ tới T03b.
                    # Dual-publish emit cả 2 kênh nên không mất event. (Dev direct-call
                    # subscribe kênh mới → gate 3s timeout rồi publish-anyway, best-effort.)
                    channel = f"sse:pubsub:{request_id}"
                    _gate_started_at = asyncio.get_event_loop().time()
                    _gate_timeout_s = 3.0
                    while True:
                        try:
                            counts = await pub_client.execute_command(
                                "PUBSUB", "NUMSUB", channel
                            )
                            # ioredis-style reply: [channel_name, count]
                            count = 0
                            if isinstance(counts, (list, tuple)) and len(counts) >= 2:
                                count = int(counts[1])
                            elif isinstance(counts, dict):
                                count = int(counts.get(channel, 0))
                            if count >= 1:
                                structlog.get_logger().info(
                                    "intent.subscriber_ready",
                                    request_id=request_id,
                                    subscriber_count=count,
                                    wait_ms=int(
                                        (asyncio.get_event_loop().time() - _gate_started_at)
                                        * 1000
                                    ),
                                )
                                break
                        except Exception as gate_err:  # noqa: BLE001
                            structlog.get_logger().warning(
                                "intent.subscriber_gate_error",
                                request_id=request_id,
                                error=str(gate_err),
                            )
                            break  # fail-open: proceed without waiting
                        if (
                            asyncio.get_event_loop().time() - _gate_started_at
                        ) >= _gate_timeout_s:
                            structlog.get_logger().warning(
                                "intent.subscriber_gate_timeout",
                                request_id=request_id,
                                timeout_s=_gate_timeout_s,
                                msg="No subscriber after timeout; publishing anyway (events may be lost)",
                            )
                            break
                        await asyncio.sleep(0.05)  # 50ms poll interval
                    # ─── End fix ───

                    # S-07 T01.D NEW per C-S07-A/C/D + C-S07-M Option ❸:
                    # Image modality → Intent 01 importing_by_images graph.
                    # Checked BEFORE entry_intent so /intent body
                    # {"modality":"image","content":"<base64>"} routes
                    # correctly regardless of hint field.
                    modality_dispatch = initial_state.get("modality")
                    # S-05 T02 NEW per C-S05-F Path α LAW + D-S05-01 LAW:
                    # Dispatch graph compile target by entry_intent.
                    entry_intent_dispatch = initial_state.get("entry_intent")
                    if modality_dispatch == "image":
                        # S-09 T01 NEW per C-S09-S + D-S09-NN-C LAW: image-modality
                        # dispatch refinement by hint field. Default behavior (no hint
                        # OR hint != 'recommend') preserves S-07 importing_by_images
                        # graph (merchant import flow, backward-compat 100% per line
                        # 304-305 comment "regardless of hint field" — semantic now
                        # narrowed to default branch only).
                        #
                        # TODO(S-08/S-11 polish): When voice modality lands (Intent 02/07
                        # S-08/S-10), consider refactoring this whole dispatch block to
                        # lookup table DISPATCH_TABLE[(modality, hint)] for table-driven
                        # scalability. Current 4-graph scale = if/elif sweet spot per
                        # industry convention (per C-S09-S Câu hỏi 4 Option A confirmed).
                        if entry_intent_dispatch == "recommend":
                            # S-09 Intent 04 image recommendation flow (customer upload
                            # photo → 10 similar products + reasons). Per D-S09-NN-A/B/C
                            # LAW + C-S09-O/P/Q/R/S amendments.
                            from .graphs.intents.recommend_by_images import (
                                compile_recommend_by_images_graph,
                            )
                            graph = compile_recommend_by_images_graph(saver, publisher)
                        else:
                            # S-07 Intent 01 import flow (merchant photo → product draft).
                            # Lazy import — defers importing_by_images module load
                            # until first image-modality request fires.
                            from .graphs.intents.importing_by_images import (
                                compile_importing_by_images_graph,
                            )
                            graph = compile_importing_by_images_graph(saver, publisher)
                    # S-08 T01.D NEW per D-S08-NN-01 LAW + D-S08-NN-A LAW cornerstone
                    # (Phiên Sx08-D): Voice modality → Intent 02 buying_by_voices
                    # graph (initial dispatch). Checked BEFORE entry_intent so
                    # /intent body {"modality":"voice","content":"<base64-audio>"}
                    # routes correctly regardless of hint field (mirrors S-07
                    # image-modality precedent above). compile_buying_by_voices_graph
                    # is the canonical signature per Confusion Warning #1 Phiên
                    # Sx08-C handoff Section 2.4 — DO NOT use build_*_graph
                    # (deprecated since Phiên Sx04-7 D-S04-13 LAW).
                    elif modality_dispatch == "voice" and entry_intent_dispatch == "analyze":
                        # S-10 T01.D NEW per D-S10-NN-G LAW + D-S10-NN-A LAW: Intent 07
                        # analytics voice flow. Checked BEFORE the generic voice branch
                        # so "analyze" -> analyzing_by_voices; all other voice utterances
                        # fall through to buying_by_voices below (mirrors image
                        # recommend/import split, C-S09-S). Lazy import — additive,
                        # zero-blast on buying_by_voices.
                        from .graphs.intents.analyzing_by_voices import (
                            compile_analyzing_by_voices_graph,
                        )
                        graph = compile_analyzing_by_voices_graph(saver, publisher)
                    elif modality_dispatch == "voice":
                        # Lazy import — defers buying_by_voices module load
                        # until first voice-modality request fires (avoids
                        # module-import side effects polluting main.py).
                        from .graphs.intents.buying_by_voices import (
                            compile_buying_by_voices_graph,
                        )
                        graph = compile_buying_by_voices_graph(saver, publisher)
                    elif entry_intent_dispatch in (
                        "cart_clear_confirm", "cart_view_with_stock_check"
                    ):
                        # Lazy import — defers cart_by_text module load until
                        # first cart entry-intent request fires (avoids
                        # module-import side effects polluting main.py).
                        from .graphs.intents.cart_by_text import (
                            compile_cart_by_text_graph,
                        )
                        graph = compile_cart_by_text_graph(saver, publisher)
                    else:
                        graph = compile_searching_by_text_graph(saver, publisher)
                    # S-P0-01 T03a: thread_id tenant-scoped (ADR-040 iv).
                    config = {
                        "configurable": {
                            "thread_id": _scoped_id(tenant_id, request_id)
                        }
                    }
                    async for _chunk in graph.astream(initial_state, config=config):
                        # Events are published by nodes via redis_publisher;
                        # astream chunks are state-snapshot deltas we don't need
                        # to forward (the SSE consumer subscribes to Redis directly).
                        pass
                finally:
                    # Best-effort close — saver context manager handles its own
                    # Redis client teardown.
                    try:
                        await publisher.close()
                    except Exception:  # noqa: BLE001
                        pass

        try:
            loop.run_until_complete(_astream_with_saver())
        except Exception as e:  # noqa: BLE001
            structlog.get_logger().error(
                "intent.graph_failed",
                request_id=request_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            # Best-effort error SSE so subscriber doesn't hang on E_NO_EVENTS
            # timeout (30s). Use a fresh short-lived publisher because the
            # async-with publisher above may have already torn down.
            try:
                async def _emit_error() -> None:
                    err_pub = RedisPublisher(redis_url=redis_url, tenant_id=tenant_id)
                    try:
                        await err_pub.publish_sse(
                            request_id,
                            "error",
                            {
                                "code": "E_INTERNAL",
                                "message": f"graph_failed: {type(e).__name__}",
                            },
                        )
                        # final event so subscriber loop breaks cleanly.
                        await err_pub.publish_sse(
                            request_id,
                            "final",
                            {
                                "request_id": request_id,
                                "mode": initial_state.get("mode", "ai_augmented"),
                                "result_count": 0,
                                "error": True,
                            },
                        )
                    finally:
                        await err_pub.close()

                loop.run_until_complete(_emit_error())
            except Exception:  # noqa: BLE001
                pass
        finally:
            try:
                loop.close()
            except Exception:  # noqa: BLE001
                pass

    t = threading.Thread(target=_runner, daemon=True, name=f"graph-{request_id}")
    t.start()


def _drive_graph_resume_async(
    request_id: str, resume_value: Any, tenant_id: str | None = None
) -> None:
    """Spawn an asyncio task that resumes the search graph with a Command(resume=...).

    Per D-S04-13 LAW Pattern A: when Gateway forwards POST /action to this AI
    /resume endpoint, we re-invoke `graph.astream(Command(resume=<value>),
    config={'configurable': {'thread_id': rid}})`. RedisSaver restores state
    from `intent:checkpoint:{rid}` automatically.

    Phiên Sx04-7 fix: same async context manager pattern as `_drive_graph_async`
    — saver must be entered + `asetup()`-called inside the event loop.
    """
    import threading

    redis_url = _redis_url()

    def _runner() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def _astream_resume_with_saver() -> None:
            async with AsyncRedisSaver.from_conn_string(
                redis_url, ttl=_SAVER_TTL_CONFIG
            ) as saver:
                await saver.asetup()
                publisher = RedisPublisher(redis_url=redis_url, tenant_id=tenant_id)
                try:
                    # S-05 T02 NEW per C-S05-F Path α LAW + D-S05-01 LAW:
                    # Peek checkpointed state to recover entry_intent for
                    # correct graph compile target on resume. RedisSaver
                    # persisted state.entry_intent at first node's interrupt;
                    # we read it back before compile.
                    # S-P0-01 T03a: thread_id tenant-scoped — phải khớp namespace
                    # đã dùng ở /intent để aget_tuple tìm đúng checkpoint.
                    config = {
                        "configurable": {
                            "thread_id": _scoped_id(tenant_id, request_id)
                        }
                    }
                    entry_intent_dispatch = None
                    try:
                        checkpoint_tuple = await saver.aget_tuple(config)
                        if checkpoint_tuple and checkpoint_tuple.checkpoint:
                            channel_values = (
                                checkpoint_tuple.checkpoint.get("channel_values")
                                or {}
                            )
                            entry_intent_dispatch = channel_values.get(
                                "entry_intent"
                            )
                            # S-07 T01.D NEW: also peek modality for image dispatch on resume.
                            modality_dispatch_resume = channel_values.get(
                                "modality"
                            )
                    except Exception as peek_err:  # noqa: BLE001
                        structlog.get_logger().warning(
                            "intent.resume_peek_failed",
                            request_id=request_id,
                            error=str(peek_err),
                        )
                        modality_dispatch_resume = None
                    if modality_dispatch_resume == "image":
                        # S-09 T01 NEW per C-S09-S — mirror initial dispatch nested
                        # branch on resume (preserves saver-checkpointed entry_intent
                        # so re-routing on resume picks the SAME graph as initial run).
                        if entry_intent_dispatch == "recommend":
                            # S-09 resume recommend_by_images (rare for Intent 04
                            # since current 5-node graph has NO interrupts; resume
                            # path mostly defensive forward-compat for future
                            # interrupt additions e.g. low-confidence clarify).
                            from .graphs.intents.recommend_by_images import (
                                compile_recommend_by_images_graph,
                            )
                            graph = compile_recommend_by_images_graph(saver, publisher)
                        else:
                            # S-07 T01.D NEW per C-S07-A/C/D — resume importing_by_images
                            # graph (preserves saver-checkpointed image_b64 + vision_result
                            # across INTERRUPT #1 submit_draft + INTERRUPT #2 commit).
                            from .graphs.intents.importing_by_images import (
                                compile_importing_by_images_graph,
                            )
                            graph = compile_importing_by_images_graph(saver, publisher)
                    # S-08 T01.D NEW per D-S08-NN-01 LAW Pattern A resume +
                    # C-S08-P resolution (Phiên Sx08-D): Resume dispatch must
                    # ALSO route voice modality → buying_by_voices graph so
                    # clarify_pick interrupt POST /intent/{rid}/action resumes
                    # the SAME graph as initial run. Preserves saver-checkpointed
                    # voice_history + voice_parsed_items + voice_matched_products
                    # across the interrupt boundary.
                    elif modality_dispatch_resume == "voice" and entry_intent_dispatch == "analyze":
                        # S-10 T01.D NEW: resume dispatch must ALSO route analyze voice
                        # -> analyzing_by_voices (mirrors initial split above) so the
                        # clarify interrupt (state-I) resumes into the right graph.
                        from .graphs.intents.analyzing_by_voices import (
                            compile_analyzing_by_voices_graph,
                        )
                        graph = compile_analyzing_by_voices_graph(saver, publisher)
                    elif modality_dispatch_resume == "voice":
                        from .graphs.intents.buying_by_voices import (
                            compile_buying_by_voices_graph,
                        )
                        graph = compile_buying_by_voices_graph(saver, publisher)
                    elif entry_intent_dispatch in (
                        "cart_clear_confirm", "cart_view_with_stock_check"
                    ):
                        from .graphs.intents.cart_by_text import (
                            compile_cart_by_text_graph,
                        )
                        graph = compile_cart_by_text_graph(saver, publisher)
                    else:
                        graph = compile_searching_by_text_graph(saver, publisher)
                    async for _chunk in graph.astream(
                        Command(resume=resume_value), config=config
                    ):
                        pass
                finally:
                    try:
                        await publisher.close()
                    except Exception:  # noqa: BLE001
                        pass

        try:
            loop.run_until_complete(_astream_resume_with_saver())
        except Exception as e:  # noqa: BLE001
            structlog.get_logger().error(
                "intent.resume_failed",
                request_id=request_id,
                error=str(e),
                error_type=type(e).__name__,
            )
        finally:
            try:
                loop.close()
            except Exception:  # noqa: BLE001
                pass

    t = threading.Thread(target=_runner, daemon=True, name=f"resume-{request_id}")
    t.start()


def create_app() -> Flask:
    """Application factory. Idempotent — repeated calls return new Flask
    instance with shared OTel + logger global state.
    """
    # 1. OTel SDK first (attach Resource + exporter to existing or new provider).
    init_otel()

    # 2. Structured logger second.
    logger = create_logger(service="ai", version=__version__)

    # 3. Flask app.
    app = Flask(__name__)

    tracer = trace.get_tracer(__name__)

    @app.get("/health")
    def health() -> tuple[Any, int]:
        """Liveness probe — always 200 if process is up."""
        return jsonify({"status": "ok", "service": "ai", "version": __version__}), 200

    @app.get("/ready")
    def ready() -> tuple[Any, int]:
        """Readiness probe — Phase 1: 200 always."""
        return jsonify({"status": "ok", "service": "ai"}), 200

    @app.post("/intent")
    def intent() -> Any:
        """Universal intent endpoint — S-04 T02 SSE stream rewrite per D-S04-13 LAW.

        Flow:
            1. Generate request_id (AI authoritative per Q-Sx04-3-6 Option A LAW).
            2. Classify intent via router_graph (S-02 stub returns 'unknown';
               S-04 T02 routes to `searching_by_text` subgraph when classifier
               output matches).
            3. Spawn graph execution thread (publishes SSE events to Redis
               pub/sub `sse:pubsub:{rid}`).
            4. Return SSE stream Response subscribing to same channel and
               forwarding messages to FE EventSource.

        Per docs/03_API_CONTRACTS.md §1.2:
            - Accept JSON body `{modality, content, mode?}`.
            - Return SSE Content-Type `text/event-stream`.
        """
        request_id = str(uuid.uuid4())

        with tracer.start_as_current_span("ai.intent.handle") as span:
            span.set_attribute("ai.request_id", request_id)

            if request.is_json:
                payload = request.get_json(silent=True) or {}
            else:
                payload = request.form.to_dict()

            modality = payload.get("modality", "text")
            content = payload.get("content", "")
            # S-04 NEW: mode field defaults to 'ai_augmented' per D-S04-03 LAW.
            mode = payload.get("mode", "ai_augmented")
            # S-05 T02 NEW (Phiên Sx05-2 per C-S05-F Path α + D-S05-01 LAW):
            # Extract optional hint field as entry_intent for graph dispatch.
            # Allowed values: 'cart_clear_confirm', 'cart_view_with_stock_check'.
            # Backward-compat: hint absent/other values → classifier-driven
            # default search flow (S-04 router_graph heuristic).
            entry_intent = payload.get("hint") if isinstance(
                payload.get("hint"), str
            ) else None
            # Sx05-3-CODE HOTFIX (D-S05-13 LAW): extract authenticated user_id
            # forwarded by Gateway POST /intent handler. Fallback 'anon' for
            # backward-compat with smoke tests that bypass JwtAuthGuard.
            # Without this, cart_by_text graph nodes operate on anon cart →
            # wrong cart cleared/checked per Bug #1+#2 manual test.
            # S-P0-01 T03a (ADR-047): identity transport = header (Gateway forward).
            # user_id: ưu tiên header X-User-Id, fallback body.user_id (2-phase —
            # Gateway còn gửi body.user_id tới T03b), cuối cùng 'anon' (dev/smoke).
            # tenant_id: chỉ header (None khi anonymous/dev — chưa enforce tới T03b).
            hdr_user = request.headers.get("X-User-Id")
            hdr_tenant = request.headers.get("X-Tenant-Id")
            body_user = payload.get("user_id") if isinstance(
                payload.get("user_id"), str
            ) else None
            user_id = hdr_user or body_user or "anon"
            tenant_id = hdr_tenant or None
            # Sx07-F-debug Phiên 2026-05-26 — Explicit filter override (A1).
            # FE-injected chip filters (brand/category) propagated verbatim to
            # IcpState._filters. searching_by_text.parse_filters node detects
            # this and SKIPS LLM call → faster + precise.
            filters_override = payload.get("filters") if isinstance(
                payload.get("filters"), dict
            ) else None
            # S-10 text-entry (Intent 07 preset, e.g. home "Xem phân tích"):
            # optional text question that drives the analyze flow WITHOUT audio.
            # When present + dispatched to analyzing_by_voices, the STT node uses
            # it directly (skips Gemini). Absent → normal voice/audio path.
            text_query = payload.get("text_query") if isinstance(
                payload.get("text_query"), str
            ) else None
            span.set_attribute("ai.modality", modality)
            span.set_attribute("ai.mode", mode)
            span.set_attribute("ai.user_id", user_id)
            if tenant_id:
                span.set_attribute("ai.tenant_id", tenant_id)
            if entry_intent:
                span.set_attribute("ai.entry_intent", entry_intent)

            logger.info(
                "intent.received",
                request_id=request_id,
                modality=modality,
                mode=mode,
                content_length=len(content) if isinstance(content, str) else 0,
            )

            # Run classifier (S-02 stub Phase 1 → 'unknown'; S-04 router amended
            # to dispatch 'searching_by_text' on conditional edge).
            initial_state: dict[str, Any] = {
                "request_id": request_id,
                "modality": modality,
                "content": content,
                "mode": mode,
                "attempt_n": 1,
                "first_card_emitted": False,
                "intent": None,
                "confidence": None,
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                # S-05 T02 NEW per C-S05-F Path α LAW: entry_intent persists in
                # checkpointed state so _drive_graph_resume_async can recover
                # the correct graph compile target on resume (cart vs search).
                "entry_intent": entry_intent,
                # Sx05-3-CODE HOTFIX (D-S05-13 LAW): authenticated user_id
                # persisted in checkpointed state — survives interrupt/resume
                # boundary so resume nodes still operate on correct user cart.
                "user_id": user_id,
                # S-P0-01 T03a: tenant checkpointed → nodes đọc per-call qua
                # identity_kwargs(state) → MCP header; survives interrupt/resume.
                "tenant_id": tenant_id,
                # Sx07-F-debug Phiên 2026-05-26 — Filter override (A1).
                # When dict non-empty, parse_filters node uses these instead
                # of calling LLM. Shape: {category?: str, extra: {brand?: str}}.
                "_filters_override": filters_override,
                # S-10 NEW: preset text question for Intent 07 text-entry. When
                # set, analyzing_by_voices STT node skips Gemini and uses it.
                # None for all other flows → no behavior change (voice graph's
                # transcribe node ignores voice_text and reads audio content).
                "voice_text": text_query or None,
            }

            # Drive search graph async in background thread.
            _drive_graph_async(initial_state)

            # Stream SSE events forwarded from Redis pub/sub channel.
            def _sse_generator() -> Any:
                loop = asyncio.new_event_loop()
                try:
                    agen = _sse_subscribe_stream(request_id, tenant_id)
                    while True:
                        try:
                            msg = loop.run_until_complete(agen.__anext__())
                        except StopAsyncIteration:
                            break
                        yield msg
                finally:
                    loop.close()

            return Response(
                stream_with_context(_sse_generator()),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",  # disable proxy buffering
                    "X-Request-Id": request_id,
                },
            )

    @app.post("/intent/<rid>/resume")
    def intent_resume(rid: str) -> tuple[Any, int]:
        """Internal endpoint — Gateway forwards POST /action body here per D-S04-13
        LAW Pattern A interrupt+resume semantics.

        Body shape (forwarded from Gateway `intent-action.controller.ts`):
            {choice: 'accept'|'reject'|'retry_ai'|'continue_basic'|'add_to_cart'|'skip',
             value?: {product_id?: str, ...},
             _meta?: {attempt_n: int}}

        Per Q-Sx04-3-6 Option A LAW: thread_id = request_id (rid) — same namespace
        as POST /intent generated. RedisSaver restores graph state from
        `intent:checkpoint:{rid}` checkpoint automatically.

        Returns 202 Accepted immediately — graph resumes async in background;
        events continue flowing to same `sse:pubsub:{rid}` channel that the
        original /intent SSE consumer is already subscribed to (single
        EventSource stays open across interrupt+resume cycles).
        """
        with tracer.start_as_current_span("ai.intent.resume") as span:
            span.set_attribute("ai.request_id", rid)

            if not request.is_json:
                return jsonify({"error": "expected JSON body"}), 400

            payload = request.get_json(silent=True) or {}
            choice = payload.get("choice")
            value = payload.get("value")
            attempt_n = (payload.get("_meta") or {}).get("attempt_n", 1)

            if not choice:
                return jsonify({"error": "missing required field 'choice'"}), 400

            span.set_attribute("ai.resume.choice", choice)
            span.set_attribute("ai.resume.attempt_n", attempt_n)

            logger.info(
                "intent.resumed",
                request_id=rid,
                choice=choice,
                attempt_n=attempt_n,
            )

            # Resume value matches LangGraph Command(resume=<value>) contract;
            # graph nodes receive this via interrupt() return value.
            resume_value = {"choice": choice}
            if value is not None:
                resume_value["value"] = value
            if attempt_n is not None:
                resume_value["attempt_n"] = attempt_n

            # S-P0-01 T03a: tenant từ header (Gateway forward trên /resume nữa) —
            # cần để dựng thread_id `{tenant}:{rid}` khớp checkpoint của /intent +
            # dual-publish. Gateway intent-action.controller forward X-Tenant-Id.
            resume_tenant_id = request.headers.get("X-Tenant-Id") or None
            _drive_graph_resume_async(rid, resume_value, resume_tenant_id)

            return jsonify({"status": "accepted", "request_id": rid}), 202

    # Startup log — verifiable in smoke AC-7 (single line containing service=ai).
    logger.info(
        "service.started",
        port=int(os.environ.get("FLASK_RUN_PORT", "5001")),
        version=__version__,
    )

    # Keep import-time reference so unused-import lint doesn't strip router_graph
    # (used indirectly — its module-level singleton compile triggers classify_intent
    # registration that the search graph re-uses via subgraph dispatch).
    _ = router_graph

    return app
