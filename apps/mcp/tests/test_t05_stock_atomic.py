# =============================================================================
# apps/mcp/tests/test_t05_stock_atomic.py — S-P0-02/T05 W-85 (ADR-055)
# =============================================================================
# Test NHÚNG (cần DB live): products.decrement_stock atomic chống oversell.
#   1. Race: 2 thread trừ kho song song trên stock=1, lặp 50 vòng → mỗi vòng
#      đúng 1 thắng + 1 OUT_OF_STOCK, stock cuối = 0, KHÔNG BAO GIỜ âm.
#   2. Tenant-gate: identity tenant B trừ product tenant A → OUT_OF_STOCK
#      (RLS + tenant_id filter loại), stock KHÔNG đổi.
#
# Seed/reset/verify = superuser (bypass RLS); decrement = tool (tenant_connection
# RLS). Skip nếu DB không reachable.
#
# Run từ apps/mcp/:  DATABASE_URL=postgresql://icp_app:icp_app_dev_password@\
#   localhost:5432/icp pytest tests/test_t05_stock_atomic.py -v
# =============================================================================
from __future__ import annotations

import os
import threading

import psycopg
import pytest

from src.db import reset_request_identity, set_request_identity
from src.tools.products import decrement_stock

SUPER = os.getenv("DATABASE_URL_MIGRATE", "postgresql://icp:icp_dev_password@localhost:5432/icp")
TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"
MERCHANT = "19f25ecb-569d-459e-9e5d-a70a7cf15af6"  # merchant1@demo.icp (member tenant A)
PROD_ID = "a5705705-0000-4000-8000-000000000505"


def _db_up() -> bool:
    try:
        with psycopg.connect(SUPER, connect_timeout=3):
            return True
    except Exception:  # noqa: BLE001
        return False


pytestmark = pytest.mark.skipif(not _db_up(), reason="DB not reachable")


def _exec(sql: str, args: tuple = ()) -> None:
    with psycopg.connect(SUPER, autocommit=True) as conn:
        conn.execute(sql, args)


def _stock() -> int:
    with psycopg.connect(SUPER, autocommit=True) as conn:
        row = conn.execute("SELECT stock FROM products WHERE id = %s", (PROD_ID,)).fetchone()
        return int(row[0])


@pytest.fixture
def product():
    _exec(
        """
        INSERT INTO products (id, merchant_id, tenant_id, title, category, attributes, price, stock, status)
        VALUES (%s, %s, %s, 'T05 stock test', 'test', '{}'::jsonb, 10000, 1, 'active')
        ON CONFLICT (id) DO UPDATE SET stock = 1, tenant_id = EXCLUDED.tenant_id
        """,
        (PROD_ID, MERCHANT, TENANT_A),
    )
    yield PROD_ID
    _exec("DELETE FROM products WHERE id = %s", (PROD_ID,))


def _decrement_thread(tenant: str, out: list, idx: int) -> None:
    tokens = set_request_identity(tenant, MERCHANT)
    try:
        out[idx] = decrement_stock({"product_id": PROD_ID, "quantity": 1})
    except ValueError as e:  # OUT_OF_STOCK
        out[idx] = e
    finally:
        reset_request_identity(tokens)


def test_race_2concurrent_stock1_50loops(product) -> None:
    """2 trừ song song trên stock=1 × 50 vòng → 1 thắng + 1 OUT_OF_STOCK, stock=0."""
    for loop in range(50):
        _exec("UPDATE products SET stock = 1 WHERE id = %s", (PROD_ID,))
        out: list = [None, None]
        threads = [
            threading.Thread(target=_decrement_thread, args=(TENANT_A, out, i)) for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        wins = [r for r in out if isinstance(r, dict)]
        oos = [r for r in out if isinstance(r, ValueError) and "OUT_OF_STOCK" in str(r)]
        assert len(wins) == 1, f"loop {loop}: expected 1 win, got {out}"
        assert len(oos) == 1, f"loop {loop}: expected 1 OUT_OF_STOCK, got {out}"
        final = _stock()
        assert final == 0, f"loop {loop}: stock={final} (phải 0, KHÔNG BAO GIỜ âm)"
        assert final >= 0


def test_tenant_gate_cross_tenant_no_decrement(product) -> None:
    """Identity tenant B trừ product tenant A → OUT_OF_STOCK, stock KHÔNG đổi."""
    _exec("UPDATE products SET stock = 5 WHERE id = %s", (PROD_ID,))
    tokens = set_request_identity(TENANT_B, MERCHANT)
    try:
        with pytest.raises(ValueError, match="OUT_OF_STOCK"):
            decrement_stock({"product_id": PROD_ID, "quantity": 1})
    finally:
        reset_request_identity(tokens)
    assert _stock() == 5, "cross-tenant decrement KHÔNG được trừ kho tenant khác"
