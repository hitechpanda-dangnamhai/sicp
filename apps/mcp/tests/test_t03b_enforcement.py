# =============================================================================
# apps/mcp/tests/test_t03b_enforcement.py — S-P0-01 T03b
# =============================================================================
# MCP tenant enforcement (PURE + Flask test_client — không cần DB/Redis):
#   - db.py contextvar identity (set/get/reset, fail-closed current_tenant)
#   - server.py /rpc fail-closed khi thiếu X-Tenant-Id (WHITELIST = ∅)
#   - server.py set contextvar từ header → dispatch thấy được
#   - cart.py re-key cart:{tenant}:{user} (cô lập cross-tenant qua key namespace)
#
# RLS isolation per-tool (SET LOCAL app.tenant_id → row filtering) phủ bởi
# infra/migrations/tests/test_v011_tenant_isolation.sh (cần DB).
#
# Run từ apps/mcp/:  pytest tests/test_t03b_enforcement.py -v
# =============================================================================
from __future__ import annotations

import pytest

from src.db import (
    current_tenant,
    current_user,
    reset_request_identity,
    set_request_identity,
)

TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"
USER = "33333333-3333-3333-3333-333333333333"


# --- db.py contextvar identity ------------------------------------------------

def test_contextvar_roundtrip() -> None:
    tokens = set_request_identity(TENANT_A, USER)
    try:
        assert current_tenant() == TENANT_A
        assert current_user() == USER
    finally:
        reset_request_identity(tokens)


def test_current_tenant_fail_closed_when_unset() -> None:
    # Defense cuối: rpc() đã chặn trước, nhưng getter vẫn raise nếu chưa set.
    with pytest.raises(PermissionError):
        current_tenant()


def test_current_user_none_when_unset() -> None:
    assert current_user() is None


def test_reset_restores_previous() -> None:
    tokens = set_request_identity(TENANT_A, USER)
    reset_request_identity(tokens)
    assert current_user() is None
    with pytest.raises(PermissionError):
        current_tenant()


# --- server.py /rpc fail-closed + whitelist ----------------------------------

def test_whitelist_is_empty() -> None:
    # ADR-047 note 2026-06-12: WHITELIST tool tenant-optional = ∅. Entry tương
    # lai phải đi qua test ĐỎ này + câu WHY.
    from src.server import _TENANT_OPTIONAL_WHITELIST

    assert _TENANT_OPTIONAL_WHITELIST == frozenset()


def _client():
    from src.server import create_app

    return create_app().test_client()


def test_rpc_fail_closed_missing_tenant_header() -> None:
    resp = _client().post(
        "/rpc",
        json={"jsonrpc": "2.0", "method": "system.list_tools", "params": {}, "id": 1},
    )
    assert resp.status_code == 400
    body = resp.get_json()
    assert body["error"]["message"] == "Tenant context required"
    assert body["id"] == 1


def test_rpc_passes_with_tenant_header() -> None:
    resp = _client().post(
        "/rpc",
        json={"jsonrpc": "2.0", "method": "system.list_tools", "params": {}, "id": 2},
        headers={"X-Tenant-Id": TENANT_A, "X-User-Id": USER},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert isinstance(body["result"], list)
    # contextvar reset sau request → getter raise lại (không rò sang request kế).
    with pytest.raises(PermissionError):
        current_tenant()


# --- cart.py re-key cart:{tenant}:{user} -------------------------------------

def test_cart_key_tenant_scoped() -> None:
    from src.tools.cart import _cart_key, _cart_lock_key

    tokens = set_request_identity(TENANT_A, USER)
    try:
        assert _cart_key(USER) == f"cart:{TENANT_A}:{USER}"
        assert _cart_lock_key(USER) == f"cart:{TENANT_A}:{USER}:lock"
    finally:
        reset_request_identity(tokens)


def test_cart_key_cross_tenant_isolation() -> None:
    from src.tools.cart import _cart_key

    t1 = set_request_identity(TENANT_A, USER)
    key_a = _cart_key(USER)
    reset_request_identity(t1)
    t2 = set_request_identity(TENANT_B, USER)
    key_b = _cart_key(USER)
    reset_request_identity(t2)
    # Cùng user, khác tenant → khác key Redis = không đọc được cart nhau.
    assert key_a != key_b
