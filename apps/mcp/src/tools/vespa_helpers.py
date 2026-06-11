"""apps/mcp/src/tools/vespa_helpers.py — Vespa tenant-scope helper (S-P0-01 T01).

ADR-040 amendment (iii): MỌI YQL build phải đi qua helper trung tâm tự inject
`tenant_id` filter; CẤM tool gọi vespa query raw. Test bắt buộc: cross-tenant
search trả 0 row.

STATUS T01: stub khả dụng — `_build_yql` (vespa.py:88) CHƯA route qua đây;
product.sd CHƯA có field `tenant_id` (T04 thêm field + backfill PARTIAL-UPDATE
+ ép 6 tool vespa.* qua helper này). T01 chỉ cung cấp helper + test.
"""

from __future__ import annotations

import re

# UUID guard (đồng bộ với src/db.py).
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)

# match đuôi "... limit N" để chèn clause trước limit.
_LIMIT_RE = re.compile(r"\s+limit\s+\d+\s*$", re.IGNORECASE)
_WHERE_RE = re.compile(r"\bwhere\b", re.IGNORECASE)


def tenant_filter_clause(tenant_id: str) -> str:
    """YQL clause cô lập tenant. Vespa field `tenant_id type string` (T04).

    Escape dấu nháy đôi chống YQL injection (đồng bộ brand/attribute filter
    trong vespa.py:126).
    """
    if not _UUID_RE.match(tenant_id):
        raise ValueError(f"tenant_filter_clause: invalid tenant_id: {tenant_id!r}")
    safe = tenant_id.replace('"', '\\"')
    return f'tenant_id contains "{safe}"'


def inject_tenant_filter(yql: str, tenant_id: str) -> str:
    """Chèn `tenant_id contains "..."` vào YQL (AND vào where, trước limit).

    - Có `where` → nối ` and <clause>`.
    - Không `where` → thêm ` where <clause>`.
    - Có `limit N` ở cuối → chèn TRƯỚC limit (Vespa yêu cầu limit ở cuối).

    Idempotent về mặt an toàn: gọi 2 lần sẽ thêm 2 clause AND (vẫn đúng kết
    quả) — caller (T04) chỉ gọi đúng 1 lần trong builder trung tâm.
    """
    clause = tenant_filter_clause(tenant_id)

    m = _LIMIT_RE.search(yql)
    if m:
        head, tail = yql[: m.start()], yql[m.start():]
    else:
        head, tail = yql, ""

    if _WHERE_RE.search(head):
        head = f"{head} and {clause}"
    else:
        head = f"{head} where {clause}"

    return head + tail
