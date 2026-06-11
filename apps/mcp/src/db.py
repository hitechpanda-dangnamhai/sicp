"""apps/mcp/src/db.py — multi-tenant Postgres helper (S-P0-01 T01).

ADR-040 amendment (i): mọi query data path chạy trong txn có
`SET LOCAL app.tenant_id = <tenant>`. RLS policy `tenant_isolation` trên mọi
bảng tenant-scoped đọc GUC này → role icp_app (NOBYPASSRLS) chỉ thấy row đúng
tenant.

`tenant_connection` thay cho pattern `psycopg.connect(_get_dsn())` rải trong
các tool (products.py:96, ...). T03 wire toàn bộ Postgres tool qua đây.

STATUS T01: stub khả dụng — tool CHƯA chuyển qua (T03 migrate). Runtime
DATABASE_URL còn superuser tới khi cutover.
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

# UUID v1-5 guard trước khi bind vào set_config (defense-in-depth; set_config
# đã parameterized nên không injection, nhưng chặn input rác sớm).
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL env var not set")
    return dsn


@contextmanager
def tenant_connection(tenant_id: str) -> Iterator[psycopg.Connection]:
    """Yield một psycopg connection đã set `app.tenant_id` transaction-local.

    psycopg3 mặc định autocommit=False → execute đầu tiên mở transaction; khối
    `with conn` commit khi thoát (rollback nếu exception). `set_config(..., true)`
    (is_local=true) → GUC chỉ sống trong txn này, không rò sang lần dùng sau.

    Args:
        tenant_id: UUID tenant đang active (resolve từ JWT claim ở Gateway).

    Raises:
        ValueError: tenant_id sai format UUID.

    Example:
        with tenant_connection(tid) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM products WHERE id = %s", (pid,))
    """
    if not _UUID_RE.match(tenant_id):
        raise ValueError(f"tenant_connection: invalid tenant_id format: {tenant_id!r}")

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor() as cur:
            # is_local=true → reset cuối txn. %s bind an toàn (SET LOCAL không
            # nhận tham số nên dùng set_config()).
            cur.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))
        yield conn
