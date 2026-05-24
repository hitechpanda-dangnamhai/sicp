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


def _format_sse_message(event_type: str, data: dict[str, Any]) -> str:
    """Format a single SSE message per W3C EventSource spec.

    SSE format:
        event: <event_type>\n
        data: <json>\n
        \n
    """
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _sse_subscribe_stream(request_id: str) -> AsyncIterator[str]:
    """Subscribe to Redis pub/sub channel sse:pubsub:{request_id} and yield SSE
    messages forwarded by the graph (via redis_publisher).

    Per D-S04-13 LAW Option Z: AI service publishes; this endpoint just
    forwards published messages to the EventSource. In production the Gateway
    is what subscribes — but in dev / direct-call mode this endpoint also
    subscribes so smoke tests can drive the graph without Gateway hop.

    Cleanup:
        - On `final` event: break loop + close subscription
        - On timeout / client disconnect: caller handles via `stream_with_context`
    """
    channel = _SSE_PUBSUB_CHANNEL_TEMPLATE.format(request_id=request_id)
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
                publisher = RedisPublisher(redis_url=redis_url)
                try:
                    graph = compile_searching_by_text_graph(saver, publisher)
                    config = {"configurable": {"thread_id": request_id}}
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
                    err_pub = RedisPublisher(redis_url=redis_url)
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


def _drive_graph_resume_async(request_id: str, resume_value: Any) -> None:
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
                publisher = RedisPublisher(redis_url=redis_url)
                try:
                    graph = compile_searching_by_text_graph(saver, publisher)
                    config = {"configurable": {"thread_id": request_id}}
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
            span.set_attribute("ai.modality", modality)
            span.set_attribute("ai.mode", mode)

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
            }

            # Drive search graph async in background thread.
            _drive_graph_async(initial_state)

            # Stream SSE events forwarded from Redis pub/sub channel.
            def _sse_generator() -> Any:
                loop = asyncio.new_event_loop()
                try:
                    agen = _sse_subscribe_stream(request_id)
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

            _drive_graph_resume_async(rid, resume_value)

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
