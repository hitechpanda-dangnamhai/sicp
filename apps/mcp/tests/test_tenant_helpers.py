# =============================================================================
# apps/mcp/tests/test_tenant_helpers.py — S-P0-01 T01
# =============================================================================
# Unit test cho 2 helper multi-tenant (PURE — không cần DB/Vespa):
#   - src/db.py            tenant_connection (UUID guard)
#   - src/tools/vespa_helpers.py  inject_tenant_filter / tenant_filter_clause
#
# Phần SET LOCAL → RLS isolation (cần DB) được phủ bởi:
#   infra/migrations/tests/test_v011_tenant_isolation.sh
#
# Run từ apps/mcp/:  pytest tests/test_tenant_helpers.py -v
# =============================================================================
from __future__ import annotations

import pytest

from src.db import tenant_connection
from src.tools.vespa_helpers import inject_tenant_filter, tenant_filter_clause

DEMO = "11111111-1111-1111-1111-111111111111"


# --- tenant_connection: UUID guard chạy TRƯỚC khi connect (không cần DB) -----

def test_tenant_connection_rejects_bad_uuid() -> None:
    with pytest.raises(ValueError, match="invalid tenant_id"):
        with tenant_connection("not-a-uuid"):
            pass  # pragma: no cover — không tới được


# --- tenant_filter_clause ----------------------------------------------------

def test_tenant_filter_clause_builds_expected() -> None:
    assert tenant_filter_clause(DEMO) == f'tenant_id contains "{DEMO}"'


def test_tenant_filter_clause_rejects_bad_uuid() -> None:
    with pytest.raises(ValueError):
        tenant_filter_clause("'; DROP TABLE products; --")


# --- inject_tenant_filter ----------------------------------------------------

def test_inject_into_where_before_limit() -> None:
    yql = 'select * from product where title contains "x" limit 10'
    out = inject_tenant_filter(yql, DEMO)
    assert out == (
        'select * from product where title contains "x" '
        f'and tenant_id contains "{DEMO}" limit 10'
    )


def test_inject_adds_where_when_absent() -> None:
    yql = "select * from product limit 5"
    out = inject_tenant_filter(yql, DEMO)
    assert out == f'select * from product where tenant_id contains "{DEMO}" limit 5'


def test_inject_without_limit_appends_at_end() -> None:
    yql = 'select * from product where foo contains "bar"'
    out = inject_tenant_filter(yql, DEMO)
    assert out.endswith(f'and tenant_id contains "{DEMO}"')


def test_inject_rejects_bad_uuid() -> None:
    with pytest.raises(ValueError):
        inject_tenant_filter("select * from product limit 1", "bad")
