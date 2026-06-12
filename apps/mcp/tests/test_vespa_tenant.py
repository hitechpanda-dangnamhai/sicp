# =============================================================================
# apps/mcp/tests/test_vespa_tenant.py — S-P0-01 T04
# =============================================================================
# Tenant isolation cho lớp Vespa + analytics matview (PURE — monkeypatch httpx /
# tenant_connection, KHÔNG cần Vespa/DB):
#   - vespa_helpers.inject_tenant_filter: chèn clause TRƯỚC order by/limit
#   - 4 query tool (hybrid_search/compare_similar/search_trend/image_nn): MỌI
#     outbound body có `tenant_id contains "<uuid>"` → cross-tenant 0 row
#   - vespa.index: ghi tenant_id vào doc fields (born tenant-scoped)
#   - fail-closed: tool thiếu tenant context → PermissionError
#   - partial_update_tenant: PUT + assign tenant_id ONLY (re-feed guard, ADR-036)
#   - analytics.aggregate: matview query filter tenant_id app-level (RLS không áp MV)
#
# Cross-tenant 0-row THẬT (cần Vespa live) phủ bởi e2e T05. Đây test cơ chế bảo
# đảm điều đó: mọi YQL mang filter tenant + fail-closed khi thiếu context.
#
# Run từ apps/mcp/:  pytest tests/test_vespa_tenant.py -v
# =============================================================================
from __future__ import annotations

from contextlib import contextmanager

import pytest

from src.db import reset_request_identity, set_request_identity
from src.tools import analytics, vespa
from src.tools.vespa_helpers import inject_tenant_filter

TENANT = "11111111-1111-1111-1111-111111111111"
USER = "33333333-3333-3333-3333-333333333333"
_TENANT_CLAUSE = f'tenant_id contains "{TENANT}"'


@pytest.fixture
def tenant_ctx():
    """Set request identity contextvar (mô phỏng rpc() sau header extract)."""
    tokens = set_request_identity(TENANT, USER)
    try:
        yield
    finally:
        reset_request_identity(tokens)


@pytest.fixture
def capture(monkeypatch):
    """Monkeypatch httpx.Client → capture outbound body của tool Vespa."""
    cap: dict = {}

    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"root": {"children": [], "fields": {"totalCount": 0}}}

    class _Client:
        def __init__(self, *a, **k) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a) -> bool:
            return False

        def post(self, url, json=None, headers=None):
            cap.update(method="POST", url=url, body=json)
            return _Resp()

        def put(self, url, json=None, headers=None):
            cap.update(method="PUT", url=url, body=json)
            return _Resp()

    monkeypatch.setattr(vespa.httpx, "Client", _Client)
    return cap


# --- inject_tenant_filter: order-by handling (T04 helper hardening) -----------

def test_inject_before_order_by() -> None:
    yql = (
        'select * from product where category contains "x" '
        "order by trend_score desc limit 10"
    )
    out = inject_tenant_filter(yql, TENANT)
    assert out == (
        'select * from product where category contains "x" '
        f"and {_TENANT_CLAUSE} order by trend_score desc limit 10"
    )


def test_build_yql_injects_when_tenant_passed() -> None:
    out = vespa._build_yql("milk", "baseline", 8, None, tenant_id=TENANT)
    assert _TENANT_CLAUSE in out


def test_build_yql_no_filter_without_tenant() -> None:
    # Pure builder không bật filter nếu thiếu tenant — enforcement nằm ở search()
    # (gọi current_tenant() fail-closed TRƯỚC khi build).
    out = vespa._build_yql("milk", "baseline", 8, None)
    assert "tenant_id" not in out


# --- 4 query tool: outbound body mang tenant filter --------------------------

def test_hybrid_search_body_has_tenant(tenant_ctx, capture) -> None:
    vespa.search({"query": "milk", "rank_profile": "baseline", "limit": 5})
    assert _TENANT_CLAUSE in capture["body"]["yql"]


def test_compare_similar_body_has_tenant_and_exact(tenant_ctx, capture) -> None:
    vespa.compare_similar({"product": {"title": "milk"}, "limit": 5})
    yql = capture["body"]["yql"]
    assert _TENANT_CLAUSE in yql
    assert "approximate:false" in yql  # structural pre-filter → exact NN


def test_search_trend_tenant_before_order_by(tenant_ctx, capture) -> None:
    vespa.search_trend({"category": "milk", "limit": 5})
    yql = capture["body"]["yql"]
    assert _TENANT_CLAUSE in yql
    # YQL hợp lệ: filter tenant nằm TRONG where, trước order by.
    assert yql.index("tenant_id contains") < yql.index("order by")


def test_image_nn_body_has_tenant_and_exact(tenant_ctx, capture) -> None:
    vespa.image_nearest_neighbor({"query_desc": "red bottle", "limit": 5})
    yql = capture["body"]["yql"]
    assert _TENANT_CLAUSE in yql
    assert "approximate:false" in yql


# --- vespa.index: ghi tenant_id ----------------------------------------------

def test_index_writes_tenant_id(tenant_ctx, capture) -> None:
    vespa.index({"product": {
        "id": "p-1", "merchant_id": "m-1", "title": "milk",
        "category": "milk", "price": 100, "stock": 1,
    }})
    assert capture["body"]["fields"]["tenant_id"] == TENANT


# --- fail-closed: thiếu tenant context → raise -------------------------------

def test_search_fail_closed_without_tenant(capture) -> None:
    with pytest.raises(PermissionError):
        vespa.search({"query": "milk", "rank_profile": "baseline"})


def test_index_fail_closed_without_tenant(capture) -> None:
    with pytest.raises(PermissionError):
        vespa.index({"product": {"id": "p-1", "title": "x", "category": "c"}})


# --- partial_update_tenant: PUT + assign ONLY (re-feed guard) -----------------

def test_partial_update_put_assign_only(capture) -> None:
    vespa.partial_update_tenant("p-1", TENANT)
    assert capture["method"] == "PUT"
    assert capture["body"] == {"fields": {"tenant_id": {"assign": TENANT}}}
    # ADR-036 guard: KHÔNG có title/description/embedding → không re-embed.
    assert set(capture["body"]["fields"].keys()) == {"tenant_id"}


def test_partial_update_rejects_bad_uuid() -> None:
    with pytest.raises(ValueError):
        vespa.partial_update_tenant("p-1", "not-a-uuid")


# --- analytics.aggregate: matview filter tenant app-level (RLS không áp MV) ---

def test_aggregate_scopes_matview_by_tenant(tenant_ctx, monkeypatch) -> None:
    executed: list[tuple[str, dict]] = []

    class _Cur:
        def __enter__(self):
            return self

        def __exit__(self, *a) -> bool:
            return False

        def execute(self, sql, params=None) -> None:
            executed.append((sql, params or {}))

        def fetchall(self) -> list:
            return []

        def fetchone(self) -> dict:
            return {}

    class _Conn:
        def cursor(self, *a, **k):
            return _Cur()

    @contextmanager
    def _fake_tc(_tid):
        yield _Conn()

    monkeypatch.setattr(analytics, "tenant_connection", _fake_tc)
    analytics.aggregate({"merchant_id": "m-1", "period": "month"})

    matview_calls = [(s, p) for s, p in executed if "analytics_daily" in s]
    assert matview_calls, "expected analytics_daily matview queries"
    for sql, params in matview_calls:
        assert "tenant_id = %(tid)s::uuid" in sql
        assert params.get("tid") == TENANT
