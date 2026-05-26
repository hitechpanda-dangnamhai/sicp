# =============================================================================
# apps/mcp/src/tools/cards.py — cards.* tools (S-07 T01 NEW)
# =============================================================================
# Per C-S07-A + PHASE_03 §C/F: 3 MCP tools for action_cards table lifecycle.
# Table action_cards verified Phiên Sx07-D ALREADY EXISTS in V001 schema (no
# new migration needed):
#   id UUID PK, event_id UUID FK→events, policy_id UUID FK→policies,
#   user_id UUID FK→users, action_type VARCHAR(60), suggestion JSONB,
#   status VARCHAR(20) DEFAULT 'pending' CHECK (pending/accepted/rejected/expired),
#   expires_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ
#
# Tools:
#   cards.create         — INSERT new card with suggestion JSONB
#   cards.list_pending   — SELECT user's pending cards
#   cards.update_status  — UPDATE status to accepted/rejected + resolved_at=NOW()
#
# Reference:
#   - infra/migrations/V001__init.sql action_cards table
#   - docs/phases/PHASE_03_IMPORT.md §C (Card Generator Worker — inline in S-07
#     per Brief Non-goals deferred post-hackathon)
#   - docs/phases/PHASE_03_IMPORT.md §F (5 action_type variants for UI)
#   - slices/S-07_decisions-log.md C-S07-A (cards.* formalized in T01.C)
# =============================================================================

from __future__ import annotations

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


# Valid action_type values per PHASE_03 §F (5 variants — SUGGEST_PRICE,
# SUGGEST_ATTRS, SUGGEST_ALTERNATIVES, SUGGEST_CREDIT_LOAN, SUGGEST_PROMOTION)
# plus 2 added by C-S07-H policies (SUGGEST_WAIT_OR_REDUCE, SUGGEST_STOCK_UP).
# Schema-side: action_type is VARCHAR(60) — no CHECK constraint, so client-side
# validation provides safer feedback than letting bad values silently persist.
_VALID_ACTION_TYPES = frozenset({
    "SUGGEST_PRICE",
    "SUGGEST_ATTRS",
    "SUGGEST_ALTERNATIVES",
    "SUGGEST_CREDIT_LOAN",
    "SUGGEST_PROMOTION",
    "SUGGEST_WAIT_OR_REDUCE",
    "SUGGEST_STOCK_UP",
})

_VALID_STATUSES = frozenset({"accepted", "rejected", "expired"})


def _row_to_card(row: dict[str, Any]) -> dict[str, Any]:
    """Map action_cards row → API DTO."""
    return {
        "id": str(row["id"]),
        "event_id": str(row["event_id"]),
        "policy_id": str(row["policy_id"]),
        "user_id": str(row["user_id"]),
        "action_type": row["action_type"],
        "suggestion": row.get("suggestion") or {},
        "status": row["status"],
        "expires_at": row["expires_at"].isoformat() if row.get("expires_at") else None,
        "resolved_at": row["resolved_at"].isoformat() if row.get("resolved_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


# ---------------------------------------------------------------------------
# cards.create
# ---------------------------------------------------------------------------

def create(params: dict[str, Any]) -> dict[str, Any]:
    """cards.create MCP tool — INSERT a new action card.

    Args:
        params: {
          "event_id": str,              # required — UUID of triggering event
          "policy_id": str,             # required — UUID of matched policy
          "user_id": str,               # required — UUID of merchant (FK users)
          "action_type": str,           # required — one of _VALID_ACTION_TYPES
          "suggestion": dict,           # required — JSONB payload per action_type
          "expires_at": str | None,     # optional — ISO 8601 timestamp
        }

    Returns: {"card_id": str} — UUID of inserted row.
    """
    required = ("event_id", "policy_id", "user_id", "action_type", "suggestion")
    missing = [k for k in required if k not in params]
    if missing:
        raise ValueError(f"missing required params: {missing}")

    event_id = params["event_id"]
    policy_id = params["policy_id"]
    user_id = params["user_id"]
    action_type = params["action_type"]
    suggestion = params["suggestion"]
    expires_at = params.get("expires_at")

    if not isinstance(event_id, str):
        raise ValueError("'event_id' must be string (UUID)")
    if not isinstance(policy_id, str):
        raise ValueError("'policy_id' must be string (UUID)")
    if not isinstance(user_id, str):
        raise ValueError("'user_id' must be string (UUID)")
    if action_type not in _VALID_ACTION_TYPES:
        raise ValueError(
            f"'action_type' must be one of {sorted(_VALID_ACTION_TYPES)}; got {action_type!r}"
        )
    if not isinstance(suggestion, dict):
        raise ValueError("'suggestion' must be object (JSONB)")
    if expires_at is not None and not isinstance(expires_at, str):
        raise ValueError("'expires_at' must be string (ISO 8601) or null")

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO action_cards
                  (event_id, policy_id, user_id, action_type, suggestion, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id::text
                """,
                (
                    event_id,
                    policy_id,
                    user_id,
                    action_type,
                    Jsonb(suggestion),
                    expires_at,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError("INSERT action_cards returned no row")
            card_id = row[0]
        conn.commit()

    _logger.info(
        "card.created",
        card_id=card_id,
        action_type=action_type,
        event_id=event_id,
        policy_id=policy_id,
    )
    return {"card_id": card_id}


# ---------------------------------------------------------------------------
# cards.list_pending
# ---------------------------------------------------------------------------

def list_pending(params: dict[str, Any]) -> list[dict[str, Any]]:
    """cards.list_pending MCP tool — list pending cards for a user.

    Args:
        params: {
          "user_id": str,               # required — merchant UUID
          "limit": int | None,          # optional — default 50, max 200
        }

    Returns: list of card DTOs sorted by created_at DESC.
    """
    user_id = params.get("user_id")
    if not isinstance(user_id, str):
        raise ValueError("'user_id' param required (string UUID)")

    limit = int(params.get("limit") or 50)
    if limit < 1 or limit > 200:
        raise ValueError("'limit' must be in [1, 200]")

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id, event_id, policy_id, user_id, action_type,
                       suggestion, status, expires_at, resolved_at, created_at
                FROM action_cards
                WHERE user_id = %s AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()

    cards = [_row_to_card(row) for row in rows]
    _logger.info("cards.list_pending.done", user_id=user_id, count=len(cards))
    return cards


# ---------------------------------------------------------------------------
# cards.update_status
# ---------------------------------------------------------------------------

def update_status(params: dict[str, Any]) -> dict[str, Any]:
    """cards.update_status MCP tool — set status to accepted/rejected/expired.

    Args:
        params: {
          "card_id": str,               # required — UUID
          "status": str,                # required — accepted|rejected|expired
          "applied_value": dict | None, # optional — value merchant applied (for accepted)
        }

    Returns: {"card_id": str, "status": str, "updated": bool}.

    Idempotency: re-applying same status is a no-op (returns updated=false).
    """
    card_id = params.get("card_id")
    status = params.get("status")
    applied_value = params.get("applied_value")

    if not isinstance(card_id, str):
        raise ValueError("'card_id' param required (string UUID)")
    if status not in _VALID_STATUSES:
        raise ValueError(
            f"'status' must be one of {sorted(_VALID_STATUSES)}; got {status!r}"
        )
    if applied_value is not None and not isinstance(applied_value, dict):
        raise ValueError("'applied_value' must be object or null")

    with psycopg.connect(_get_dsn()) as conn:
        with conn.cursor() as cur:
            # Idempotent UPDATE: only update if currently pending.
            # If applied_value provided, merge into suggestion JSONB via ||
            # (Postgres concat overrides keys); otherwise leave suggestion alone.
            if applied_value is not None:
                cur.execute(
                    """
                    UPDATE action_cards
                    SET status = %s,
                        resolved_at = NOW(),
                        suggestion = suggestion || %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id::text
                    """,
                    (status, Jsonb({"applied_value": applied_value}), card_id),
                )
            else:
                cur.execute(
                    """
                    UPDATE action_cards
                    SET status = %s, resolved_at = NOW()
                    WHERE id = %s AND status = 'pending'
                    RETURNING id::text
                    """,
                    (status, card_id),
                )
            row = cur.fetchone()
            updated = row is not None
        conn.commit()

    _logger.info(
        "card.status_updated",
        card_id=card_id,
        status=status,
        updated=updated,
    )
    return {"card_id": card_id, "status": status, "updated": updated}


# Register at import time per MCP tools registry pattern.
register("cards.create", create)
register("cards.list_pending", list_pending)
register("cards.update_status", update_status)
