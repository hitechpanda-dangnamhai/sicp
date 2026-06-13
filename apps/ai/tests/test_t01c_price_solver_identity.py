"""S-P0-03/T01c-hotfix — _fetch_price_solver threads identity (regression test).

Pre-fix: _fetch_price_solver(mcp_client, context) referenced an undefined `state`
on the avg>0 path → NameError (NOT caught by `except McpError`), and identity
(X-Tenant-Id/X-User-Id, injected by mcp_client from state) never reached the
analytics.suggest_price RPC. Every MCP RPC must carry tenant identity (T03b
whitelist=∅), so dropping it would also fail the MCP tenant gate.

These tests assert: avg>0 no longer throws + identity kwargs are forwarded to
mcp_client.call; avg<=0 short-circuits with no RPC.
"""
import pytest

pytest.importorskip("langgraph")  # importing the graph module pulls langgraph

from src.graphs.intents.importing_by_images import _fetch_price_solver


class _FakeMcp:
    """Capture mcp_client.call(tool, params, **identity_kwargs) invocations."""

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def call(self, tool: str, params: dict, **kwargs) -> dict:
        self.calls.append((tool, params, kwargs))
        return {"recommended_price": 123456}


@pytest.mark.asyncio
async def test_avg_positive_threads_identity_no_nameerror() -> None:
    mcp = _FakeMcp()
    state = {"tenant_id": "11111111-1111-1111-1111-111111111111", "user_id": "u-1"}
    ctx = {"shopee_avg_price": 100000, "shopee_sample_count": 5, "trend_trajectory": "up"}

    res = await _fetch_price_solver(mcp, ctx, state)  # must NOT raise NameError

    assert res == {"recommended_price": 123456}
    assert len(mcp.calls) == 1
    tool, params, kwargs = mcp.calls[0]
    assert tool == "analytics.suggest_price"
    # identity forwarded → mcp_client injects X-Tenant-Id/X-User-Id headers.
    assert kwargs == {"tenant_id": state["tenant_id"], "user_id": state["user_id"]}
    assert params["shopee_avg_price"] == 100000


@pytest.mark.asyncio
async def test_avg_zero_short_circuits_no_rpc() -> None:
    mcp = _FakeMcp()
    state = {"tenant_id": "t-1", "user_id": "u-1"}

    res = await _fetch_price_solver(mcp, {"shopee_avg_price": 0}, state)

    assert res == {}
    assert mcp.calls == []  # no MCP RPC when there is no shopee price signal
