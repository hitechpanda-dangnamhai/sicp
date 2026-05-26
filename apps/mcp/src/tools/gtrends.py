# =============================================================================
# apps/mcp/src/tools/gtrends.py — gtrends.interest_over_time tool (S-07 T01 NEW)
# =============================================================================
# Per ADR-031 + C-S07-A: mock fixture-based Google Trends (~30 keywords pre-baked)
# for Intent 01 import-by-image flow. Real Google Trends API integration OUT OF
# SCOPE for ICP hackathon — separate project handles crawling.
#
# Returns shape (per 03_API §5 amend T01.G):
#   {
#     "trajectory": "rising" | "falling" | "stable",
#     "current_score": float,           # latest week interest 0-100
#     "delta_pct": float,               # % change vs window_days ago
#     "series": [float, ...],           # interest_over_time scores (length=window_days)
#     "related_rising": [str, ...],     # related queries trending up
#     "insight": str                    # human-readable summary (VN)
#   }
#
# Fixture lookup logic:
#   1. Exact match on `keyword` param against fixture[].keyword
#   2. Fallback: match on `category` param against fixture[].category
#   3. Last resort: return synthetic "stable" trajectory with neutral score
#
# Reference:
#   - docs/DECISIONS.md ADR-031 (Google Trends mock fixture)
#   - slices/S-07_decisions-log.md C-S07-A (gtrends.interest_over_time formalized)
#   - docs/03_API_CONTRACTS.md §5 gtrends.interest_over_time (amended T01.G)
#   - apps/mcp/src/fixtures/gtrends-mock.json (~30 keywords)
# =============================================================================

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)

# Fixture path — relative to apps/mcp/src/tools/ → apps/mcp/src/fixtures/
_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "gtrends-mock.json"

# Lazy-loaded fixture (loaded once per process)
_fixture_cache: list[dict[str, Any]] | None = None


def _load_fixture() -> list[dict[str, Any]]:
    """Load gtrends-mock.json once per process. Fails fast if missing."""
    global _fixture_cache
    if _fixture_cache is not None:
        return _fixture_cache

    if not _FIXTURE_PATH.exists():
        raise RuntimeError(
            f"gtrends-mock.json not found at {_FIXTURE_PATH}. "
            "T01.C.C10 fixture must be deployed."
        )

    with _FIXTURE_PATH.open(encoding="utf-8") as f:
        _fixture_cache = json.load(f)

    if not isinstance(_fixture_cache, list):
        raise RuntimeError("gtrends-mock.json must be a JSON array")

    _logger.info("gtrends.fixture.loaded", count=len(_fixture_cache))
    return _fixture_cache


def _compute_delta_pct(series: list[float]) -> float:
    """% change from first window slice to last (latest)."""
    if not series or len(series) < 2:
        return 0.0
    first = series[0]
    last = series[-1]
    if first == 0:
        return 100.0 if last > 0 else 0.0
    return round(((last - first) / first) * 100.0, 2)


def _trajectory_from_delta(delta_pct: float) -> str:
    """Classify trajectory per C-S07-A spec (>10% rising, <-10% falling, else stable)."""
    if delta_pct > 10.0:
        return "rising"
    if delta_pct < -10.0:
        return "falling"
    return "stable"


def _synthesize_neutral(keyword: str) -> dict[str, Any]:
    """Last-resort fallback when no fixture match — stable neutral trajectory."""
    return {
        "trajectory": "stable",
        "current_score": 50.0,
        "delta_pct": 0.0,
        "series": [50.0] * 7,
        "related_rising": [],
        "insight": f"Không có dữ liệu trend cho '{keyword}' — xu hướng ổn định",
    }


def interest_over_time(params: dict[str, Any]) -> dict[str, Any]:
    """gtrends.interest_over_time MCP tool.

    Args:
        params: {
          "keyword": str | None,        # primary lookup key (e.g. "Maggi 700ml")
          "category": str | None,       # fallback key (e.g. "nuoc_tuong")
          "window_days": int,           # default 7, max 30
        }

    Returns: dict per C-S07-A canonical shape.

    Raises:
        ValueError: missing both keyword AND category.
    """
    keyword = params.get("keyword")
    category = params.get("category")
    window_days = int(params.get("window_days") or 7)

    if not keyword and not category:
        raise ValueError("'keyword' or 'category' param required")

    if window_days < 1 or window_days > 30:
        raise ValueError("'window_days' must be in [1, 30]")

    fixture = _load_fixture()

    # 1. Exact keyword match
    entry: dict[str, Any] | None = None
    if keyword:
        for row in fixture:
            if row.get("keyword", "").lower() == keyword.lower():
                entry = row
                break

    # 2. Category fallback
    if entry is None and category:
        for row in fixture:
            if row.get("category") == category:
                entry = row
                break

    # 3. Synthesize neutral
    if entry is None:
        result = _synthesize_neutral(keyword or category or "unknown")
        _logger.info(
            "gtrends.no_match",
            keyword=keyword,
            category=category,
        )
        return result

    # Truncate series to window_days (fixture has up to 30 points)
    series_full = entry.get("series") or []
    series = series_full[-window_days:] if series_full else [50.0] * window_days

    delta_pct = _compute_delta_pct(series)
    trajectory = _trajectory_from_delta(delta_pct)
    current_score = float(series[-1]) if series else 50.0

    result = {
        "trajectory": trajectory,
        "current_score": current_score,
        "delta_pct": delta_pct,
        "series": series,
        "related_rising": list(entry.get("related_rising") or []),
        "insight": entry.get("insight") or f"Xu hướng {trajectory} cho '{entry.get('keyword', '')}'",
    }

    _logger.info(
        "gtrends.matched",
        keyword=keyword,
        category=category,
        trajectory=trajectory,
        delta_pct=delta_pct,
    )
    return result


# Register at import time per MCP tools registry pattern.
register("gtrends.interest_over_time", interest_over_time)
