"""Redis async publisher — publishes SSE events to `sse:pubsub:{request_id}`
channel per D-S04-13 LAW Option Z multi-channel SSE transport architecture.

S-04 T02 (Phiên Sx04-5) per D-S04-13 LAW Option Z + D-S04-14 LAW:
    - publish_sse(rid, event_type, data) — generic SSE event publisher
    - publish_product_ready(rid, item, index, total) — D-S04-14 LAW per-product
      progressive emit helper (Variant B generate_reasons node)
    - emit_first_card_emitted_log(rid, ...) — D-S04-14 LAW paired telemetry
      idempotency-guarded ops log (NOT a Redis publish — just structlog ops
      log via W3C traceparent)

S-05 T02 amendment (Phiên Sx05-2 per D-S05-01/03 LAW + D-S05-11 LAW):
    - publish_cart_event(rid, event_type, payload) — thin wrapper over
      publish_sse enforcing cart-domain event-type prefix whitelist
      (`cart_`, `clear_`, `stock_issue_`). Used by `cart_by_text.py` graph
      nodes to emit the 7 NEW S-05 SSE events: clear_confirm / cart_cleared /
      clear_cancelled / stock_issue_ready / stock_issue_summary / cart_updated
      / cart_view_ready.

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
    - slices/S-05_decisions-log.md D-S05-01/03 LAW (Hybrid Cart Routing
      + Pattern A Interrupt Reuse for clear-confirm + stock-resolve)
      + D-S05-11 LAW (minimal trigger + FE refetch pattern)
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

# S-05 T02 (Phiên Sx05-2): cart-domain event prefix whitelist for
# publish_cart_event guard. Any event_type NOT starting with one of these
# prefixes raises ValueError before publishing (defense-in-depth so a typo
# like 'card_cleared' fails loud rather than silently emitting an
# undocumented event into the SSE catalog).
_CART_EVENT_PREFIXES: tuple[str, ...] = ("cart_", "clear_", "stock_issue_")


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

    def __init__(self, redis_url: str, tenant_id: str | None = None) -> None:
        self._redis_url = redis_url
        # S-P0-01 T03a (ADR-048 amend c + ADR-040 iv): dual-publish — kênh cũ
        # `sse:pubsub:{rid}` (Gateway hiện subscribe) LUÔN giữ + kênh mới
        # `sse:pubsub:{tenant}:{rid}` khi có tenant. Gateway switch sang kênh mới
        # ở T03b → KHÔNG cần deploy atomic 2 service. tenant None (anonymous/dev)
        # → chỉ kênh cũ.
        self._tenant_id = tenant_id
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
                        "typo_suggestion", "product_ready", "final",
                        "clear_confirm", "cart_updated").
                        Must match one of 24 LOCKED types per 03_API §3
                        (17 S-02/S-04 + 7 S-05 T02 NEW post-reconcile).
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

            # S-P0-01 T03a: dual-publish kênh tenant-scoped (chỉ khi có tenant).
            # Return = subscriber_count kênh CŨ (giữ contract caller; Gateway hiện
            # subscribe kênh cũ). Kênh mới log riêng để verify rollout.
            if self._tenant_id:
                tenant_channel = (
                    f"sse:pubsub:{self._tenant_id}:{request_id}"
                )
                tenant_subs = await client.publish(tenant_channel, block)
                span.set_attribute("sse.tenant_channel", tenant_channel)
                span.set_attribute("sse.tenant_subscriber_count", tenant_subs)
                _logger.info(
                    "sse.published",
                    request_id=request_id,
                    event_type=event_type,
                    channel=tenant_channel,
                    subscriber_count=int(tenant_subs),
                    tenant_id=self._tenant_id,
                )

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

    # ========================================================================
    # S-05 T02 helpers (Phiên Sx05-2 — Cart Domain Events)
    # ========================================================================

    async def publish_cart_event(
        self,
        request_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> int:
        """Publish a cart-domain SSE event per D-S05-01/03 LAW.

        Thin wrapper over `publish_sse` that enforces an event-type prefix
        whitelist for the 7 NEW S-05 T02 cart-domain event types. Defense-in-
        depth so typos like ``'card_cleared'`` or undocumented events
        ``'fake_cart_event'`` raise ValueError before publishing, instead of
        silently polluting the SSE event catalog.

        Whitelisted event types (per S-05 T02 emit + 03_API §3 catalog 17→24
        post-reconcile per C-S05-D resolution):
            - clear_confirm     — Pattern A interrupt UX (D-S05-01/03 LAW)
            - cart_cleared      — terminal post-cart.clear (D-S05-11 LAW)
            - clear_cancelled   — user cancel clear (no-op)
            - stock_issue_ready    — per-item progressive (D-S05-04 LAW)
            - stock_issue_summary  — pre-interrupt summary signal
            - cart_updated      — terminal post-cart-mutation (D-S05-11 LAW)
            - cart_view_ready   — terminal happy-path no stock issue

        Args:
            request_id: same rid namespace as publish_sse.
            event_type: must start with one of `cart_`, `clear_`, or
                `stock_issue_` (whitelist). Mismatched prefix raises
                ValueError before publish.
            payload:    event-specific payload matching the corresponding
                Zod schema in `@icp/shared-types/sse intent-stream.ts`
                (SseClearConfirmEvent / SseCartUpdatedEvent / etc).

        Returns:
            Number of subscribers that received the message.

        Raises:
            ValueError: when event_type doesn't match cart-domain prefix
                whitelist (defensive guard against typo / unauthorized event
                emit). Caller (graph node) should never trigger this in
                normal operation — if it fires, fix the caller's event_type
                string literal.

        Example:
            >>> await publisher.publish_cart_event(
            ...     rid, "clear_confirm",
            ...     {"item_count": 4, "subtotal": 175000,
            ...      "user_message": "Em sẽ xoá 4 món trị giá 175.000₫ khỏi giỏ.",
            ...      "advice": "Nếu chỉ muốn bỏ vài món, anh hãy vuốt..."}
            ... )
            >>> # → publishes "event: clear_confirm\\ndata: {...}\\n\\n" to
            >>> #   channel "sse:pubsub:{rid}".
        """
        if not event_type.startswith(_CART_EVENT_PREFIXES):
            raise ValueError(
                f"publish_cart_event: event_type={event_type!r} not in "
                f"cart-domain prefix whitelist (allowed prefixes: "
                f"{_CART_EVENT_PREFIXES}). Use publish_sse() directly for "
                f"non-cart events."
            )
        return await self.publish_sse(request_id, event_type, payload)

    # ========================================================================
    # D-S04-14 LAW paired telemetry (Phiên Sx04-4)
    # ========================================================================

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

    # --- S-07 T01.D NEW per C-S07-D + C-S07-L (Phiên Sx07-D) ---
    # 3 thin helpers reusing publish_sse primitive for Intent 01 import flow.
    # Per C-S07-D: 3 NEW SSE event types form_prefill/market_trend/shopee_compare
    # added to IntentStreamEventMap (24 → 27 entries via T01.F shared-types
    # patch). Per C-S07-L: form_prefill includes confidence_per_field +
    # alternatives for state-F yellow badge + alt-chip rendering.

    async def publish_form_prefill(self, request_id: str, data: dict) -> None:
        """Publish form_prefill SSE event (Intent 01 state-B render trigger).

        Per C-S07-D + C-S07-L: data shape matches SseFormPrefillEvent Zod schema
        in packages/shared-types/src/sse/intent-stream.ts.
        Required keys: category, attributes, ocr_text, confidence,
        confidence_per_field. Optional: alternatives, suggested_price, title,
        description (passthrough fields per z.record permissive shape).
        """
        await self.publish_sse(request_id, "form_prefill", data)

    async def publish_market_trend(self, request_id: str, data: dict) -> None:
        """Publish market_trend SSE event (Intent 01 state-B TrendCard render).

        Per C-S07-D: data shape matches SseMarketTrendEvent Zod schema.
        Required: trajectory (rising/falling/stable), current_score, delta_pct,
        series (list[float]), related_rising (list[str]). Optional: insight.
        """
        await self.publish_sse(request_id, "market_trend", data)

    async def publish_shopee_compare(self, request_id: str, data: dict) -> None:
        """Publish shopee_compare SSE event (Intent 01 state-B ShopeeCompareCard render).

        Per C-S07-D + C-S07-A: data shape matches SseShopeeCompareEvent Zod schema.
        Required: aggregates {min_price, avg_price, max_price, sample_count,
        review_count}, samples (list of {title, store, price, rating, sold_count}).
        Optional: matched_via (specific/category_fallback/no_match).
        """
        await self.publish_sse(request_id, "shopee_compare", data)

    async def close(self) -> None:
        """Close underlying Redis async client. Safe to call multiple times."""
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:  # noqa: BLE001
                pass
            self._client = None
