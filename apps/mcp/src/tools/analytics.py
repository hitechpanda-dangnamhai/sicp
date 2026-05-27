# ============================================================================
# apps/mcp/src/tools/analytics.py
# ============================================================================
# analytics MCP tool module — S-09 NEW Phiên Sx09-C per C-S09-B + C-S09-Q.
#
# Slice: S-09 First Image-Based Product Recommendation (Intent 04 V-SLICE).
# Task:  T01 Infra + BE + Seed (Block 3 MCP tools, ~85 LOC).
#
# Provides 2 functions registered at import time:
#   - co_purchased(category, limit=20)
#       Postgres SQL per PHASE_05_RECO_ANALYTICS.md §C inline query joining
#       orders + order_items + products. Returns top N co-bought categories
#       với target_orders subquery filter (status='paid' + category match).
#       Consumed by recommend_by_images.py Node 3 parallel asyncio.gather
#       per D-S09-NN-A LAW (collab_count sub-score) — feeds blend_and_rank.
#
#   - product_corpus_size()
#       NEW per C-S09-Q mid-task amendment Phiên Sx09-B Câu hỏi 1.
#       Cached COUNT(*) of products with image_data populated. Redis cache
#       TTL 60s for dynamic phase_progress.meta string per C-S09-O ("Đang so
#       khớp với {N} sản phẩm shop..." — Vietnamese mockup-literal label).
#       Reuses cart.py:_get_redis_client + policies.py:_get_dsn patterns 1:1.
#
# Source references:
#   - docs/phases/PHASE_05_RECO_ANALYTICS.md §C (co_purchased SQL verbatim)
#   - slices/S-09_decisions-log.md C-S09-B + C-S09-O + C-S09-Q + C-S09-S
#   - slices/S-09_BRIEF.md Section 5.2 (Mid-task amendment C-S09-Q rationale)
#   - apps/mcp/src/tools/cart.py:107-122 (_get_redis_client singleton pattern)
#   - apps/mcp/src/tools/policies.py:74-80 (_get_dsn pattern)
#   - apps/mcp/src/tools/policies.py:297-310 (psycopg.connect ctx manager)
#
# Backward-compat: 100% additive (no existing tool signatures changed).
# ============================================================================
from __future__ import annotations

import os
from typing import Any, Optional

import psycopg
import redis
from psycopg.rows import dict_row

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers (clone from cart.py:94-122 + policies.py:74-80 — pattern-locked LAW)
# ---------------------------------------------------------------------------

def _get_dsn() -> str:
    """Return Postgres DSN from env. Clone of policies.py:_get_dsn."""
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL env var not set")
    return dsn


def _get_redis_url() -> str:
    """Return Redis URL from env (default localhost dev fallback)."""
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


_REDIS_CLIENT: Optional[redis.Redis] = None


def _get_redis_client() -> redis.Redis:
    """Return process-level singleton sync Redis client.

    Clone of cart.py:110-122 — same MCP tool handler signature contract
    (apps/mcp/src/tools/__init__.py:38 Callable[[dict], Any]).
    """
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        _REDIS_CLIENT = redis.from_url(
            _get_redis_url(), decode_responses=True
        )
    return _REDIS_CLIENT


# ---------------------------------------------------------------------------
# analytics.co_purchased — PHASE_05 §C SQL verbatim per C-S09-B
# ---------------------------------------------------------------------------

_CO_PURCHASED_SQL = """
WITH target_orders AS (
  SELECT DISTINCT o.id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE p.category = %(category)s AND o.status = 'paid'
)
SELECT p.id::text AS product_id,
       p.title,
       p.category,
       COUNT(*) AS freq
FROM order_items oi
JOIN target_orders t ON t.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE p.category != %(category)s
GROUP BY p.id, p.title, p.category
ORDER BY freq DESC
LIMIT %(limit)s;
"""


def co_purchased(params: dict[str, Any]) -> dict[str, Any]:
    """Top N products co-purchased với given category.

    Per PHASE_05_RECO_ANALYTICS.md §C verbatim SQL + C-S09-I (NO mat view
    for Hackathon, inline query — refresh deferred to S-11 polish).

    Args:
        params: {
            "category": str,          # required — source category to match
            "limit": int | None,      # default 20 (top N co-bought)
        }

    Returns:
        {
            "items": [
                {
                    "product_id": str,
                    "title": str,
                    "category": str,
                    "freq": int,          # COUNT(*) co-purchase frequency
                },
                ...
            ],
            "category": str,              # echo input for caller correlation
        }

    Raises:
        ValueError: if 'category' missing/empty.
        RuntimeError: if DATABASE_URL env var not set.
    """
    category = params.get("category")
    if not isinstance(category, str) or not category:
        raise ValueError("'category' param required (non-empty string)")
    limit = int(params.get("limit", 20))
    if limit < 1 or limit > 100:
        raise ValueError("'limit' must be in range [1, 100]")

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                _CO_PURCHASED_SQL,
                {"category": category, "limit": limit},
            )
            rows = cur.fetchall()

    # Normalize freq → int (psycopg may return Decimal for COUNT(*) depending
    # on driver version — coerce defensively).
    items = [
        {
            "product_id": r["product_id"],
            "title": r["title"],
            "category": r["category"],
            "freq": int(r["freq"]),
        }
        for r in rows
    ]

    _logger.info(
        "analytics.co_purchased.done",
        category=category,
        limit=limit,
        rows=len(items),
    )
    return {"items": items, "category": category}


# ---------------------------------------------------------------------------
# analytics.product_corpus_size — NEW per C-S09-Q (Câu hỏi 1 Phiên Sx09-B)
# ---------------------------------------------------------------------------
#
# Purpose: dynamic count of products với image_data populated, surfaced via
# phase_progress.meta field per C-S09-O ("Đang so khớp với {N} sản phẩm
# shop..." — mockup intent-04-state-A-loading.html line 265 designer-locked).
# AC6 amended từ `=55` → `>=50` (loose dynamic-aware) per session handoff.
#
# Redis cache TTL 60s — balance:
#   - Too short (1s): every recommendation call hits Postgres → wasteful
#   - Too long (1h): backfill scripts seed N more products → stale display
#   - 60s sweet spot per ai.client.ts:290 "intent:cache:{rid} TTL 60s" precedent
#
# Cache key: `analytics:corpus_size:image_data` — fixed key (singleton corpus
# state), not parameterized.

_CORPUS_CACHE_KEY = "analytics:corpus_size:image_data"
_CORPUS_CACHE_TTL_SECONDS = 60  # short cache for production observability balance


def product_corpus_size(params: dict[str, Any]) -> dict[str, Any]:
    """Count products with image_data NOT NULL. Cached 60s for dynamic
    phase_progress.meta string per C-S09-O + C-S09-Q.

    Args:
        params: {} (no parameters — singleton corpus count).

    Returns:
        {
            "count": int,         # COUNT(*) FROM products WHERE image_data NOT NULL
            "cached": bool,       # true if served from Redis, false if fresh PG hit
        }

    Raises:
        RuntimeError: if DATABASE_URL env var not set OR Redis unavailable.
    """
    rc = _get_redis_client()
    cached_value = rc.get(_CORPUS_CACHE_KEY)
    if cached_value is not None:
        count = int(cached_value)
        _logger.info(
            "analytics.product_corpus_size.done",
            count=count,
            cached=True,
        )
        return {"count": count, "cached": True}

    # Cache MISS → fresh Postgres hit
    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM products WHERE image_data IS NOT NULL"
            )
            row = cur.fetchone()
            count = int(row[0]) if row else 0

    # Populate cache for next 60s — reuse cart.py:218 setex pattern.
    rc.setex(_CORPUS_CACHE_KEY, _CORPUS_CACHE_TTL_SECONDS, str(count))

    _logger.info(
        "analytics.product_corpus_size.done",
        count=count,
        cached=False,
    )
    return {"count": count, "cached": False}


# ---------------------------------------------------------------------------
# Register at import time per MCP tools registry pattern (cart.py:end +
# policies.py:end precedent verified).
# ---------------------------------------------------------------------------

register("analytics.co_purchased", co_purchased)
register("analytics.product_corpus_size", product_corpus_size)
