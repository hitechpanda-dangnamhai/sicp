# =============================================================================
# apps/ai/tests/test_t03a_tenant_propagation.py — S-P0-01 T03a
# =============================================================================
# Test nhúng cho AI-side additive header + dual-publish + re-key (ADR-047 amend
# 2026-06-12 / ADR-048 c / ADR-040 iv). PURE — không DB/LLM/Redis thật:
#   - mcp_client: identity_kwargs + _build_headers + call() inject X-Tenant-Id/
#                 X-User-Id header (header presence Gateway→AI→MCP).
#   - redis_publisher: dual-publish kênh cũ + sse:pubsub:{tenant}:{rid}.
#   - main._scoped_id: RedisSaver thread_id `{tenant}:{rid}` scope.
#   - voice:context key: `voice:context:{tenant}:{user}` (buying + analyzing).
#
# asyncio.run() trong test sync — repo CHƯA cấu hình pytest asyncio_mode
# (tránh phụ thuộc marker; cùng style test_tenant_helpers.py thuần).
#
# Run từ apps/ai/:  PYTHONPATH=. pytest tests/test_t03a_tenant_propagation.py -v
# =============================================================================
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from src.tools.mcp_client import McpClient, identity_kwargs
from src.tools.redis_publisher import RedisPublisher

TENANT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


# --- identity_kwargs ---------------------------------------------------------

def test_identity_kwargs_extracts_from_state() -> None:
    assert identity_kwargs({"tenant_id": TENANT, "user_id": USER}) == {
        "tenant_id": TENANT,
        "user_id": USER,
    }


def test_identity_kwargs_missing_keys_are_none() -> None:
    assert identity_kwargs({}) == {"tenant_id": None, "user_id": None}


# --- McpClient._build_headers ------------------------------------------------

def test_build_headers_injects_tenant_and_user() -> None:
    c = McpClient("http://mcp:5050/rpc")
    h = c._build_headers(tenant_id=TENANT, user_id=USER)
    assert h["X-Tenant-Id"] == TENANT
    assert h["X-User-Id"] == USER
    assert h["content-type"] == "application/json"


def test_build_headers_omits_tenant_when_none() -> None:
    c = McpClient("http://mcp:5050/rpc")
    h = c._build_headers(tenant_id=None, user_id=USER)
    assert "X-Tenant-Id" not in h
    assert h["X-User-Id"] == USER


# --- McpClient.call() forwards identity as headers on outbound POST ----------

class _FakeHttpResp:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "result": {"ok": True}, "id": "x"}


class _FakeHttpClient:
    def __init__(self) -> None:
        self.captured_headers: dict[str, str] = {}

    async def post(self, url: str, json: Any, headers: dict[str, str]) -> _FakeHttpResp:
        self.captured_headers = headers
        return _FakeHttpResp()


def test_call_sends_tenant_user_headers_outbound() -> None:
    c = McpClient("http://mcp:5050/rpc")
    fake = _FakeHttpClient()
    c._client = fake  # bypass real httpx
    asyncio.run(
        c.call("cart.get", {"user_id": USER}, tenant_id=TENANT, user_id=USER)
    )
    assert fake.captured_headers["X-Tenant-Id"] == TENANT
    assert fake.captured_headers["X-User-Id"] == USER


def test_call_without_tenant_omits_header_outbound() -> None:
    c = McpClient("http://mcp:5050/rpc")
    fake = _FakeHttpClient()
    c._client = fake
    asyncio.run(c.call("vespa.hybrid_search", {"query": "x"}))
    assert "X-Tenant-Id" not in fake.captured_headers


# --- RedisPublisher dual-publish ---------------------------------------------

class _FakeRedis:
    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []

    async def publish(self, channel: str, block: str) -> int:
        self.published.append((channel, block))
        return 1


def test_dual_publish_emits_both_channels_when_tenant() -> None:
    pub = RedisPublisher("redis://x", tenant_id=TENANT)
    fake = _FakeRedis()
    pub._client = fake  # bypass real aioredis
    asyncio.run(pub.publish_sse("rid-1", "understanding", {"a": 1}))
    channels = [c for c, _ in fake.published]
    assert "sse:pubsub:rid-1" in channels  # kênh cũ — Gateway hiện subscribe
    assert f"sse:pubsub:{TENANT}:rid-1" in channels  # kênh mới T03a
    assert len(channels) == 2


def test_single_publish_old_channel_only_when_no_tenant() -> None:
    pub = RedisPublisher("redis://x", tenant_id=None)
    fake = _FakeRedis()
    pub._client = fake
    asyncio.run(pub.publish_sse("rid-2", "final", {"b": 2}))
    channels = [c for c, _ in fake.published]
    assert channels == ["sse:pubsub:rid-2"]


def test_dual_publish_returns_old_channel_subscriber_count() -> None:
    # Contract: return = subscriber_count kênh CŨ (caller hiện đọc số này).
    pub = RedisPublisher("redis://x", tenant_id=TENANT)
    pub._client = _FakeRedis()
    n = asyncio.run(pub.publish_sse("rid-3", "products", {}))
    assert n == 1


# --- main._scoped_id (RedisSaver thread_id scope) ----------------------------

def test_scoped_id_prefixes_tenant() -> None:
    pytest.importorskip("langgraph")  # src.main kéo theo langgraph runtime dep
    from src.main import _scoped_id

    assert _scoped_id(TENANT, "rid-9") == f"{TENANT}:rid-9"


def test_scoped_id_falls_back_to_plain_rid_when_anonymous() -> None:
    pytest.importorskip("langgraph")
    from src.main import _scoped_id

    assert _scoped_id(None, "rid-9") == "rid-9"


# --- voice:context key re-key (buying + analyzing) ---------------------------

def test_voice_context_key_tenant_scoped_buying() -> None:
    pytest.importorskip("langgraph")  # graph module kéo theo langgraph runtime dep
    from src.graphs.intents.buying_by_voices import _voice_context_key

    assert _voice_context_key(USER, TENANT) == f"voice:context:{TENANT}:{USER}"
    assert _voice_context_key(USER) == f"voice:context:{USER}"  # dev fallback


def test_voice_context_key_tenant_scoped_analyzing() -> None:
    pytest.importorskip("langgraph")
    from src.graphs.intents.analyzing_by_voices import _voice_context_key

    assert _voice_context_key(USER, TENANT) == f"voice:context:{TENANT}:{USER}"
    assert _voice_context_key(USER) == f"voice:context:{USER}"
