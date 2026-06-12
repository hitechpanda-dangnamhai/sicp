# =============================================================================
# apps/mcp/src/tools/events.py — events.append tool (real Postgres INSERT)
# =============================================================================
# Real implementation (NOT stub) per PHASE_01_INFRA.md Day 5 + spec 03_API §5:
#   events.append:
#     params:
#       type: string
#       aggregate_type: string
#       aggregate_id: string
#       user_id?: string
#       payload: dict
#       metadata?: dict
#     returns: { event_id: string }
#
# V001 schema verified Phiên 25 (events table):
#   id UUID PK (auto gen_random_uuid)
#   type VARCHAR(80) NOT NULL
#   aggregate_type VARCHAR(40) NOT NULL
#   aggregate_id UUID NOT NULL
#   user_id UUID REFERENCES users(id)   ← NULLABLE ✓
#   payload JSONB NOT NULL
#   metadata JSONB DEFAULT '{}'
#   published_at TIMESTAMPTZ            ← NULL = chưa publish Kafka
#   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
#
# Phase 04 Kafka publish defers to apps/workers/ — T04 inserts with
# published_at = NULL (the unpublished flag).
#
# Reference:
#   - docs/phases/PHASE_01_INFRA.md Day 5 (emits 'event.appended' log)
#   - infra/migrations/V001__init.sql events table
#   - slices/S-02_decisions-log.md (no specific events decisions yet)
# =============================================================================

from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from src.db import current_tenant, tenant_connection
from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


def append(params: dict[str, Any]) -> dict[str, str]:
    """
    Append an event to Postgres events table (V001 schema).

    Args:
        params: {
            "type": str,                # event type (max 80 chars)
            "aggregate_type": str,      # entity type, max 40 chars
            "aggregate_id": str,        # UUID string
            "user_id": str | None,      # optional UUID
            "payload": dict,            # event data (JSONB)
            "metadata": dict | None,    # optional {ip, user_agent, request_id, ...}
        }

    Returns:
        {"event_id": "<uuid>"} — the auto-generated id from RETURNING clause.

    Raises:
        ValueError: missing required params or wrong types (JSON-RPC invalid_params).
        psycopg.Error: DB failure (JSON-RPC internal_error via dispatcher).
    """
    # --- Param validation (raises ValueError → JSON-RPC invalid_params) ---
    required = ("type", "aggregate_type", "aggregate_id", "payload")
    missing = [k for k in required if k not in params]
    if missing:
        raise ValueError(f"missing required params: {missing}")

    event_type = params["type"]
    aggregate_type = params["aggregate_type"]
    aggregate_id = params["aggregate_id"]
    user_id = params.get("user_id")  # nullable per V001
    payload = params["payload"]
    metadata = params.get("metadata", {})

    if not isinstance(event_type, str) or len(event_type) > 80:
        raise ValueError("'type' must be string ≤ 80 chars")
    if not isinstance(aggregate_type, str) or len(aggregate_type) > 40:
        raise ValueError("'aggregate_type' must be string ≤ 40 chars")
    if not isinstance(aggregate_id, str):
        raise ValueError("'aggregate_id' must be string (UUID format)")
    if not isinstance(payload, dict):
        raise ValueError("'payload' must be object (JSONB)")
    if metadata is not None and not isinstance(metadata, dict):
        raise ValueError("'metadata' must be object or null")
    if user_id is not None and not isinstance(user_id, str):
        raise ValueError("'user_id' must be string (UUID format) or null")

    # --- INSERT — psycopg auto-instrumented by OTel via opentelemetry-
    # instrumentation-psycopg (entry-point loaded by Dockerfile CMD wrapper).
    # The INSERT span becomes child of "mcp.tool.events.append" span from
    # tools/__init__.py dispatch() wrap → AC-10 verified.
    with tenant_connection(current_tenant()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO events (
                    type, aggregate_type, aggregate_id, user_id,
                    payload, metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id::text
                """,
                (
                    event_type,
                    aggregate_type,
                    aggregate_id,
                    user_id,
                    Jsonb(payload),
                    Jsonb(metadata or {}),
                ),
            )
            row = cur.fetchone()
            if row is None:
                # Should never happen with RETURNING — defensive guard.
                raise RuntimeError("INSERT returned no row")
            event_id = row[0]
        conn.commit()

    _logger.info(
        "event.appended",
        event_id=event_id,
        type=event_type,
        aggregate_type=aggregate_type,
    )
    return {"event_id": event_id}


# Register at import time per registry pattern.
register("events.append", append)
