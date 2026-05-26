# =============================================================================
# apps/mcp/src/tools/shopee.py — shopee.price_range tool (S-07 T01 NEW)
# =============================================================================
# Per ADR-032 + C-S07-A: query V008 shopee_prices_mock table (66 rows from
# shopee-mock-seed-worker + 1 V008 inline). Real Shopee crawler OUT OF SCOPE.
#
# Query strategy (2-tier with fallback):
#   1. Specific match: category + attributes JSONB containment (@>)
#      Example: category='nuoc_tuong' AND attributes @> '{"brand":"Maggi","size":"700ml"}'
#   2. Category-only fallback: category match WHERE attributes = '{}'
#      (the 11 category-only fixture rows for off-script brand/size combos)
#
# Returns shape (per 03_API §5 amend T01.G + C-S07-A):
#   {
#     "aggregates": {
#       "min_price": int,
#       "avg_price": int,
#       "max_price": int,
#       "sample_count": int,
#       "review_count": int
#     },
#     "samples": [
#       {"title": str, "store": str, "price": int, "rating": float|null, "sold_count": int},
#       ...
#     ],
#     "matched_via": "specific" | "category_fallback" | "no_match"
#   }
#
# Reference:
#   - docs/DECISIONS.md ADR-032 (Shopee mock Postgres table supersedes ADR-008)
#   - infra/migrations/V008__shopee_prices_mock.sql (table schema)
#   - slices/S-07_decisions-log.md C-S07-A Option ⓑ″ 66 rows + fallback
#   - docs/03_API_CONTRACTS.md §5 shopee.price_range (amended T01.G)
# =============================================================================

from __future__ import annotations

import json
import os
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


def _get_dsn() -> str:
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL env var not set")
    return dsn


def _empty_result(matched_via: str = "no_match") -> dict[str, Any]:
    """Return empty-but-valid shape when no fixture row matches."""
    return {
        "aggregates": {
            "min_price": 0,
            "avg_price": 0,
            "max_price": 0,
            "sample_count": 0,
            "review_count": 0,
        },
        "samples": [],
        "matched_via": matched_via,
    }


def _row_to_result(row: dict[str, Any], matched_via: str) -> dict[str, Any]:
    """Convert V008 row → API shape."""
    samples_raw = row.get("samples") or []
    if isinstance(samples_raw, str):
        samples_raw = json.loads(samples_raw)
    return {
        "aggregates": {
            "min_price": int(row["min_price"]),
            "avg_price": int(row["avg_price"]),
            "max_price": int(row["max_price"]),
            "sample_count": int(row["sample_count"]),
            "review_count": int(row.get("review_count") or 0),
        },
        "samples": samples_raw,
        "matched_via": matched_via,
    }


def price_range(params: dict[str, Any]) -> dict[str, Any]:
    """shopee.price_range MCP tool — Shopee market price reference lookup.

    Args:
        params: {
          "category": str,                # required — canonical category
          "attributes": dict | None,      # optional — {brand?, size?, variant?}
        }

    Returns: dict per C-S07-A shape.

    Raises:
        ValueError: missing 'category' or invalid types.
    """
    category = params.get("category")
    if not isinstance(category, str) or not category:
        raise ValueError("'category' param required (non-empty string)")

    attributes = params.get("attributes") or {}
    if not isinstance(attributes, dict):
        raise ValueError("'attributes' must be object or null")

    # Filter attributes to only brand+size (V008 fixture match keys per C-S07-A)
    # — additional attrs like type/color/variant are noise that prevent match.
    attrs_match = {k: str(v) for k, v in attributes.items() if k in ("brand", "size") and v}

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Tier 1: specific match (category + attributes @> filter)
            if attrs_match:
                cur.execute(
                    """
                    SELECT category, attributes, min_price, avg_price, max_price,
                           sample_count, review_count, samples
                    FROM shopee_prices_mock
                    WHERE category = %s AND attributes @> %s
                    LIMIT 1
                    """,
                    (category, Jsonb(attrs_match)),
                )
                row = cur.fetchone()
                if row is not None:
                    _logger.info(
                        "shopee.price_range.matched",
                        category=category,
                        attrs=attrs_match,
                        matched_via="specific",
                    )
                    return _row_to_result(row, matched_via="specific")

            # Tier 2: category-only fallback (attributes = '{}')
            cur.execute(
                """
                SELECT category, attributes, min_price, avg_price, max_price,
                       sample_count, review_count, samples
                FROM shopee_prices_mock
                WHERE category = %s AND attributes = '{}'::jsonb
                LIMIT 1
                """,
                (category,),
            )
            row = cur.fetchone()
            if row is not None:
                _logger.info(
                    "shopee.price_range.matched",
                    category=category,
                    attrs=attrs_match,
                    matched_via="category_fallback",
                )
                return _row_to_result(row, matched_via="category_fallback")

    # Tier 3: no match — return empty-but-valid shape (don't raise; graph degrades)
    _logger.info(
        "shopee.price_range.no_match",
        category=category,
        attrs=attrs_match,
    )
    return _empty_result(matched_via="no_match")


# Register at import time per MCP tools registry pattern.
register("shopee.price_range", price_range)
