# =============================================================================
# apps/mcp/src/tools/products.py — products.get tool (real Postgres SELECT)
# =============================================================================
# Real implementation per PHASE_01_INFRA.md Day 5 + spec 03_API §5:
#   products.get:
#     params: { id: string }
#     returns: Product | null
#
# V001 schema verified Phiên 25 (products table):
#   id UUID PK
#   merchant_id UUID NOT NULL REFERENCES users(id)
#   title VARCHAR(255) + description TEXT + category VARCHAR(100)
#   attributes JSONB + price BIGINT (VND) + stock INT
#   image_url VARCHAR(500) + vespa_doc_id VARCHAR(100)
#   trend_score REAL + status VARCHAR(20)
#   created_at + updated_at TIMESTAMPTZ
#
# Maps to Product DTO per 03_API §2 (TypeScript canonical).
#
# Reference:
#   - docs/specs/03_API_CONTRACTS.md §2 (Product DTO) + §5 (products.get spec)
#   - infra/migrations/V001__init.sql products table
# =============================================================================

from __future__ import annotations

import os
from typing import Any

import psycopg
from psycopg.rows import dict_row

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


def _get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL env var not set")
    return dsn


def _row_to_product(row: dict[str, Any]) -> dict[str, Any]:
    """
    Map V001 products row → Product DTO (03_API §2).

    Field name mapping is mostly 1:1 — Postgres column names already match DTO.
    Type coercions:
      - UUID → str
      - TIMESTAMPTZ → ISO 8601 string (psycopg returns datetime; serialize)
      - BIGINT price → int (already int in psycopg)
      - REAL trend_score → float
    """
    return {
        "id": str(row["id"]),
        "merchant_id": str(row["merchant_id"]),
        "title": row["title"],
        "description": row.get("description"),
        "category": row["category"],
        "attributes": row.get("attributes") or {},
        "price": int(row["price"]),
        "stock": int(row["stock"]),
        "image_url": row.get("image_url"),
        "trend_score": float(row.get("trend_score") or 0.0),
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def get(params: dict[str, Any]) -> dict[str, Any] | None:
    """
    Fetch a single product by id.

    Args:
        params: {"id": str} — product UUID

    Returns:
        Product dict per 03_API §2 DTO, or None if not found.

    Raises:
        ValueError: missing/invalid 'id' param (JSON-RPC invalid_params).
        psycopg.Error: DB failure (JSON-RPC internal_error).
    """
    product_id = params.get("id")
    if not isinstance(product_id, str):
        raise ValueError("'id' param required (string UUID)")

    # psycopg auto-instrument creates child span under "mcp.tool.products.get"
    # — verifiable via Tempo (AC-10 family).
    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id, merchant_id, title, description, category,
                       attributes, price, stock, image_url, vespa_doc_id,
                       trend_score, status, created_at, updated_at
                FROM products
                WHERE id = %s
                """,
                (product_id,),
            )
            row = cur.fetchone()

    if row is None:
        _logger.info("product.not_found", product_id=product_id)
        return None

    _logger.info("product.fetched", product_id=product_id, title=row.get("title"))
    return _row_to_product(row)


# Register at import time per registry pattern.
register("products.get", get)
