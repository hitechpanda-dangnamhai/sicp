"""LLM token pricing — cost_usd computation for durable traces (S-P0-03/T03b).

ADR-054 §2 cost spine: `traces.append` stores cost_usd per LLM call. Rates are
USD per 1,000,000 tokens (input, output), keyed by model id.

Config source (DoD §5 "config qua env"):
    - Defaults below = published list prices snapshot (2026-06; documented, not
      authoritative billing — NFR §1 chốt số thật sau 2 tuần data).
    - Override via env LLM_PRICES_JSON = '{"<model>": [in_per_1m, out_per_1m]}'
      (merged over defaults) — lets ops correct prices without a deploy of code.

cost_usd(model, tokens_in, tokens_out) returns None when the model is unknown or
token counts are missing (provider didn't return usage_metadata) — a NULL cost
is honest; a wrong number is not.
"""

from __future__ import annotations

import json
import os

import structlog

_logger = structlog.get_logger()

# USD per 1,000,000 tokens: model -> (input_rate, output_rate).
_DEFAULT_PRICES: dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gpt-4o-mini": (0.15, 0.60),
}

_prices: dict[str, tuple[float, float]] | None = None


def _load_prices() -> dict[str, tuple[float, float]]:
    """Load price table once (defaults + LLM_PRICES_JSON env override)."""
    global _prices
    if _prices is not None:
        return _prices
    table = dict(_DEFAULT_PRICES)
    raw = os.getenv("LLM_PRICES_JSON")
    if raw:
        try:
            override = json.loads(raw)
            for model, pair in override.items():
                table[model] = (float(pair[0]), float(pair[1]))
        except (json.JSONDecodeError, ValueError, TypeError, KeyError, IndexError) as e:
            _logger.warning("llm.pricing.env_parse_failed", error=str(e))
    _prices = table
    return table


def cost_usd(model: str, tokens_in: int | None, tokens_out: int | None) -> float | None:
    """USD cost for a call. None when model unknown or token counts missing."""
    if tokens_in is None or tokens_out is None:
        return None
    rates = _load_prices().get(model)
    if rates is None:
        return None
    in_rate, out_rate = rates
    return (tokens_in * in_rate + tokens_out * out_rate) / 1_000_000.0
