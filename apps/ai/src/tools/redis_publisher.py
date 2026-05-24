"""Redis async publisher — publishes SSE events to `sse:pubsub:{request_id}`
channel per D-S04-13 LAW Option Z multi-channel SSE transport architecture.

S-04 T02 (Phiên Sx04-5) per D-S04-13 LAW Option Z + D-S04-14 LAW:
    - publish_sse(rid, event_type, data) — generic SSE event publisher
    - publish_product_ready(rid, item, index, total) — D-S04-14 LAW per-product
      progressive emit helper (Variant B generate_reasons node)
    - emit_first_card_emitted_log(rid, ...) — D-S04-14 LAW paired telemetry
      idempotency-guarded ops log (NOT a Redis publish — just structlog ops
      log via W3C traceparent)

Channel format: `sse:pubsub:{request_id}` per 02_DATA_MODEL.md §5 Redis keys.

Message format: each pub/sub message is a pre-formatted SSE block
    event: <event_type>\\ndata: <json>\\n\\n
matching W3C EventSource spec. Gateway forwards verbatim → FE EventSource
parses standard.

Each publish wraps OTel span `sse.published` per LOG_CATALOG.md §A.SSE Pub/Sub.

Reference:
    - slices/S-04_decisions-log.md D-S04-13 LAW Option Z sub-decision
    - slices/S-04_decisions-log.md D-S04-14 LAW Sub-decision 3 (Shape-2 NEW
      product_ready event) + Sub-decision 4 (Metric-2 paired telemetry
      idempotency guard)
    - docs/02_DATA_MODEL.md §5 Redis Key Patterns
    - docs/LOG_CATALOG.md §A.SSE Pub/Sub
"""

from __future__ import annotations

import json
import time
from typing import Any

import redis.asyncio as aioredis
import structlog
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()
_propagator = TraceContextTextMapPropagator()

# Channel template per 02_DATA_MODEL.md §5.
_CHANNEL_TEMPLATE = "sse:pubsub:{request_id}"


def _format_sse_block(event_type: str, data: dict[str, Any]) -> str:
    """Format SSE block per W3C EventSource spec.

    Format:
        event: <event_type>\\n
        data: <json>\\n
        \\n
    """
    json_data = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {json_data}\n\n"


def _capture_traceparent() -> str:
    """Capture current OTel context as W3C traceparent header value.

    Embedded in published events so downstream consumers (Gateway forwarder,
    FE behavior tracker) can link their spans into the same trace.
    """
    carrier: dict[str, str] = {}
    _propagator.inject(carrier=carrier)
    return carrier.get("traceparent", "")


class RedisPublisher:
    """Async Redis pub/sub SSE publisher.

    Constructed per graph instance (one publisher serves all nodes within a
    request). Async client connection lazy-initialized on first publish().

    Per D-S04-13 LAW Option Z: this publishes ONLY; Gateway is the subscriber
    that forwards to FE EventSource. AI service is fire-and-forget.
    """

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._client: aioredis.Redis | None = None

    async def _ensure_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._client

    async def publish_sse(
        self, request_id: str, event_type: str, data: dict[str, Any]
    ) -> int:
        """Publish a single SSE event to `sse:pubsub:{request_id}` channel.

        Args:
            request_id: UUID; matches RedisSaver thread_id namespace.
            event_type: SSE `event:` field value (e.g. "understanding",
                        "typo_suggestion", "product_ready", "final").
                        Must match one of 17 LOCKED types per 03_API §3.
            data:       SSE `data:` field payload (serialized JSON).

        Returns:
            Number of pub/sub subscribers that received the message (Redis
            PUBLISH return; 0 means no subscriber attached — graph still
            proceeds but events are dropped).
        """
        client = await self._ensure_client()
        channel = _CHANNEL_TEMPLATE.format(request_id=request_id)
        block = _format_sse_block(event_type, data)

        with _tracer.start_as_current_span("sse.published") as span:
            span.set_attribute("sse.event_type", event_type)
            span.set_attribute("sse.channel", channel)
            span.set_attribute("sse.request_id", request_id)

            subscriber_count = await client.publish(channel, block)
            span.set_attribute("sse.subscriber_count", subscriber_count)

            _logger.info(
                "sse.published",
                request_id=request_id,
                event_type=event_type,
                channel=channel,
                subscriber_count=subscriber_count,
            )
            return int(subscriber_count)

    # ========================================================================
    # D-S04-14 LAW helpers (Phiên Sx04-4 Adaptive Progressive Streaming)
    # ========================================================================

    async def publish_product_ready(
        self,
        request_id: str,
        item: dict[str, Any],
        index: int,
        total: int,
    ) -> int:
        """Publish per-product `product_ready` SSE event per D-S04-14 LAW
        Sub-decision 3 (Shape-2 NEW event type) Q-Sx04-4-3a.

        Payload shape per ProductReadyEvent spec (`03_API_CONTRACTS.md §3`):
            {item: Product+{match_score, reason?}, index: int (0-based),
             total: int (from hybrid_search result count)}

        Emitted by Variant B `generate_reasons` node as EACH per-product LLM
        call completes (asyncio.as_completed). Final canonical `products` event
        STILL emitted at `rank_finalize` end with full list (backward-compat
        reconciliation — FE without `product_ready` handler still works).

        On per-product LLM timeout: item still emitted via this helper but
        WITHOUT `reason` field (item-level graceful degrade); only `match_score`
        from Vespa is present (per spec line 303-306).

        Args:
            request_id: same rid namespace.
            item:       Product DTO + {match_score: float, reason?: string}
                        — shape identical to one element of products.items[i].
            index:      0-based position in original hybrid_search order.
            total:      total result count from hybrid_search.

        Returns:
            Number of subscribers that received the message.
        """
        return await self.publish_sse(
            request_id,
            "product_ready",
            {"item": item, "index": index, "total": total},
        )

    def emit_first_card_emitted_log(
        self,
        request_id: str,
        *,
        time_to_first_card_ms: int,
        total_cards_expected: int,
        mode: str,
    ) -> None:
        """Emit `intent.first_card_emitted` ops log via structlog per D-S04-14
        LAW Sub-decision 4 (Q-Sx04-4-4 Metric-2 paired telemetry).

        **NOT a Redis publish — pure structlog ops log.** Caller (generate_reasons
        node) is responsible for the idempotency guard: invoke this method ONLY
        once per request_id, on FIRST successful per-product `product_ready`
        emission. State flag `state.first_card_emitted: bool` enforces this in
        the searching_by_text.py graph.

        The paired FE behavior event `search.first_card_rendered` is emitted by
        FE tracker (T05 + T06) on first Product Card paint useEffect detection.
        AI-side timestamp + FE-side timestamp diff = network + render latency.

        Demo target per D-S04-14 LAW: p50 ≤ 500ms, p95 ≤ 800ms.

        Args:
            request_id:             UUID per /intent invocation.
            time_to_first_card_ms:  Elapsed ms from generate_reasons entry to
                                    first product_ready publish.
            total_cards_expected:   Total products in hybrid_search result.
            mode:                   'ai_augmented' (Variant B) — D-S04-14 LAW
                                    is Variant B exclusive (Variant A has no
                                    LLM reasons step → no progressive streaming
                                    → no first_card log).
        """
        traceparent = _capture_traceparent()
        _logger.info(
            "intent.first_card_emitted",
            request_id=request_id,
            time_to_first_card_ms=time_to_first_card_ms,
            total_cards_expected=total_cards_expected,
            mode=mode,
            traceparent=traceparent,
            # Wall-clock timestamp ms for cross-service correlation with FE
            # `search.first_card_rendered` behavior event timestamp.
            wall_clock_ms=int(time.time() * 1000),
        )

    async def close(self) -> None:
        """Close underlying Redis async client. Safe to call multiple times."""
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:  # noqa: BLE001
                pass
            self._client = None
