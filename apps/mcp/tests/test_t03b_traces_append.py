# =============================================================================
# apps/mcp/tests/test_t03b_traces_append.py — S-P0-03/T03b (W-40)
# =============================================================================
# Test NHÚNG (cần DB live): traces.append INSERT llm_traces tenant-scoped +
# tenant-gate cross-tenant read assert (ADR-052).
#   1. append (identity A) → row trong llm_traces gắn tenant A; trace_id trả về.
#   2. Tenant-gate: identity B đọc trace của A → 0 row (RLS tenant_isolation).
#      identity A đọc → thấy (>0). RLS-aware: đọc qua tenant_connection (set
#      app.tenant_id) — KHÔNG super-pool (CLAUDE.md §5 AC-12).
#   3. status ngoài enum ('ok'/'error') → ValueError (V016 CHECK mirror, fail-fast).
#
# Seed/cleanup = superuser (bypass RLS). Skip nếu DB không reachable.
#
# Run từ apps/mcp/:  DATABASE_URL=postgresql://icp_app:icp_app_dev_password@\
#   localhost:5432/icp pytest tests/test_t03b_traces_append.py -v
# =============================================================================
from __future__ import annotations

import os

import psycopg
import pytest

from src.db import reset_request_identity, set_request_identity, tenant_connection
from src.tools.traces import append

SUPER = os.getenv("DATABASE_URL_MIGRATE", "postgresql://icp:icp_dev_password@localhost:5432/icp")
TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"


def _db_up() -> bool:
    try:
        with psycopg.connect(SUPER, connect_timeout=3):
            return True
    except Exception:  # noqa: BLE001
        return False


pytestmark = pytest.mark.skipif(not _db_up(), reason="DB not reachable")

_RID = "test-t03b-traces-append"


def _cleanup() -> None:
    with psycopg.connect(SUPER, autocommit=True) as conn:
        conn.execute("DELETE FROM llm_traces WHERE rid = %s", (_RID,))


@pytest.fixture(autouse=True)
def _around():
    _cleanup()
    yield
    _cleanup()


def _count_as(tenant: str) -> int:
    """Đếm trace _RID đọc DƯỚI identity `tenant` (RLS-aware via tenant_connection)."""
    with tenant_connection(tenant) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM llm_traces WHERE rid = %s", (_RID,))
            return int(cur.fetchone()[0])


def test_append_inserts_tenant_scoped_row() -> None:
    """append (identity A) → 1 row gắn tenant A + trace_id trả về."""
    tokens = set_request_identity(TENANT_A, None)
    try:
        out = append(
            {
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "status": "ok",
                "intent_type": "searching_by_text",
                "rid": _RID,
                "node": "generate_understanding",
                "tokens_in": 120,
                "tokens_out": 64,
                "cost_usd": 0.00011,
                "latency_ms": 410,
            }
        )
    finally:
        reset_request_identity(tokens)
    assert "trace_id" in out and out["trace_id"]
    # Verify tenant gắn đúng (super read).
    with psycopg.connect(SUPER, autocommit=True) as conn:
        row = conn.execute(
            "SELECT tenant_id::text, tokens_in, status FROM llm_traces WHERE rid = %s", (_RID,)
        ).fetchone()
    assert row is not None
    assert row[0] == TENANT_A
    assert row[1] == 120
    assert row[2] == "ok"


def test_tenant_gate_cross_tenant_read_blocked() -> None:
    """identity B KHÔNG đọc được trace của A (RLS); A đọc được. red-when-wrong:
    cùng query, chỉ khác tenant ctx → A=1, B=0."""
    tokens = set_request_identity(TENANT_A, None)
    try:
        append({"provider": "openai", "model": "gpt-4o-mini", "status": "ok", "rid": _RID})
    finally:
        reset_request_identity(tokens)
    assert _count_as(TENANT_A) == 1, "tenant A phải đọc được trace của chính mình"
    assert _count_as(TENANT_B) == 0, "CROSS-TENANT LEAK: tenant B đọc được trace A"


def test_status_out_of_enum_rejected() -> None:
    """status ngoài ('ok','error') → ValueError (fail-fast, mirror V016 CHECK)."""
    tokens = set_request_identity(TENANT_A, None)
    try:
        with pytest.raises(ValueError, match="status"):
            append({"provider": "gemini", "model": "x", "status": "fallback", "rid": _RID})
    finally:
        reset_request_identity(tokens)
    assert _count_as(TENANT_A) == 0, "row lỗi enum KHÔNG được insert"
