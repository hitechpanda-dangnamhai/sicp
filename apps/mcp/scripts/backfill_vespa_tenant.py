#!/usr/bin/env python3
"""apps/mcp/scripts/backfill_vespa_tenant.py — S-P0-01 T04 one-time backfill.

Stamp `tenant_id` lên MỌI Vespa product doc HIỆN HỮU bằng Document-API
PARTIAL-UPDATE (KHÔNG re-feed). Mỗi doc nhận tenant_id RIÊNG đọc từ
products.tenant_id (Postgres = source of truth, V011 đã backfill demo).

Vì sao partial-update, KHÔNG re-feed (ADR-036): POST full doc sẽ regenerate
text_embedding từ title/description VÀ xóa image_embedding (index() bỏ
image_description) → mất vector. Embedding sống Vespa-only, không reproduce từ PG.
`assign` idempotent → chạy lại an toàn.

THỨ TỰ DEPLOY (bắt buộc):
  1. ./infra/vespa/deploy.sh                 — deploy product.sd CÓ field tenant_id TRƯỚC.
  2. python scripts/backfill_vespa_tenant.py — rồi mới backfill.
  Đảo thứ tự → PUT vào field chưa tồn tại = Vespa 400.

ROLE: DATABASE_URL_MIGRATE (BYPASSRLS) — đọc products MỌI tenant. Đây là di trú
cross-tenant CHỦ Ý (mỗi doc đúng tenant của nó), KHÔNG phải pollution kiểu
scripts/backfill-image-descriptions.ts (tombstone T03d). Bypass MCP rpc() vì
rpc() single-tenant fail-closed; tương tự infra/migrations/apply.sh chạy SQL.

Run từ apps/mcp/:  python scripts/backfill_vespa_tenant.py
"""
from __future__ import annotations

import os
import sys

import httpx
import psycopg

from src.observability import get_logger
from src.tools.vespa import partial_update_tenant

_logger = get_logger(__name__)


def _dsn() -> str:
    dsn = os.getenv("DATABASE_URL_MIGRATE")
    if not dsn:
        raise SystemExit(
            "DATABASE_URL_MIGRATE not set — superuser DSN required to read all tenants"
        )
    return dsn


def main() -> int:
    with psycopg.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, tenant_id FROM products ORDER BY id")
            rows = cur.fetchall()

    _logger.info("backfill_vespa_tenant.start", total=len(rows))
    ok = 0
    failed = 0
    for product_id, tenant_id in rows:
        doc_id = str(product_id)
        try:
            partial_update_tenant(doc_id, str(tenant_id))
            ok += 1
        except (httpx.HTTPError, ValueError) as exc:
            failed += 1
            _logger.error(
                "backfill_vespa_tenant.doc_failed", doc_id=doc_id, error=str(exc)
            )

    _logger.info("backfill_vespa_tenant.done", ok=ok, failed=failed, total=len(rows))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
