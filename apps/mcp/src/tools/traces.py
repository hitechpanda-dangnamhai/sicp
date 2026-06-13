# =============================================================================
# apps/mcp/src/tools/traces.py — traces.append tool (durable LLM trace INSERT)
# =============================================================================
# S-P0-03/T03b (W-40). Ghi 1 row llm_traces / LLM call (ADR-054 §2). AI gọi qua
# JSON-RPC `traces.append` — ADR-003: AI KHÔNG chạm DB trực tiếp, chỉ qua MCP.
#
# tenant_id KHÔNG nằm trong params — lấy từ identity contextvar (X-Tenant-Id,
# set bởi server.rpc()) qua current_tenant(). INSERT chạy trong tenant_connection
# → RLS policy tenant_isolation đảm bảo row gắn đúng tenant (tenant-scoped).
#
# V015 schema (llm_traces): id, tenant_id, intent_type, rid, node, provider,
#   model, tokens_in, tokens_out, cost_usd, latency_ms, status, error_code,
#   payload_ref, created_at. V016: CHECK status IN ('ok','error').
#
# KHÔNG raw prompt/response (ADR-041) — payload_ref NULL placeholder (C4-media).
#
# Reference:
#   - infra/migrations/V015__llm_traces.sql + V016__llm_traces_status_check.sql
#   - apps/mcp/src/tools/events.py (analog pattern)
#   - docs/decisions/ADR-054 §2 (cost/trace spine) · ADR-003 (AI→DB qua MCP)
# =============================================================================

from __future__ import annotations

from typing import Any

from src.db import current_tenant, tenant_connection
from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)

# V016 CHECK constraint enum — validate sớm (fail fast = JSON-RPC invalid_params
# thay vì DB CheckViolation = internal_error). Single Home = migration; mirror ở đây.
_VALID_STATUS = ("ok", "error")


def append(params: dict[str, Any]) -> dict[str, str]:
    """
    Append 1 LLM trace row vào llm_traces (V015 schema, tenant-scoped).

    Args:
        params: {
            "provider": str,         # 'gemini' | 'openai' (required)
            "model": str,            # model id (required)
            "status": str,           # 'ok' | 'error' (required, V016 CHECK)
            "intent_type": str|None, # graph intent
            "rid": str|None,         # request id (correlate Gateway→AI→MCP)
            "node": str|None,        # graph node phát call
            "tokens_in": int|None,   # usage_metadata
            "tokens_out": int|None,
            "cost_usd": float|None,  # tính từ bảng giá (AI side)
            "latency_ms": int|None,
            "error_code": str|None,  # khi status='error'
        }
        tenant_id = current_tenant() (X-Tenant-Id header) — KHÔNG từ params.

    Returns:
        {"trace_id": "<uuid>"} — id auto-gen từ RETURNING.

    Raises:
        ValueError: missing/invalid params (JSON-RPC invalid_params).
        PermissionError: tenant context chưa set (current_tenant fail-closed).
        psycopg.Error: DB failure (JSON-RPC internal_error via dispatcher).
    """
    # --- Param validation (raises ValueError → JSON-RPC invalid_params) ---
    required = ("provider", "model", "status")
    missing = [k for k in required if not params.get(k)]
    if missing:
        raise ValueError(f"missing required params: {missing}")

    provider = params["provider"]
    model = params["model"]
    status = params["status"]
    if not isinstance(provider, str) or len(provider) > 40:
        raise ValueError("'provider' must be string ≤ 40 chars")
    if not isinstance(model, str) or len(model) > 120:
        raise ValueError("'model' must be string ≤ 120 chars")
    if status not in _VALID_STATUS:
        raise ValueError(f"'status' must be one of {_VALID_STATUS}")

    intent_type = params.get("intent_type")
    rid = params.get("rid")
    node = params.get("node")
    tokens_in = params.get("tokens_in")
    tokens_out = params.get("tokens_out")
    cost_usd = params.get("cost_usd")
    latency_ms = params.get("latency_ms")
    error_code = params.get("error_code")

    for k, v in (("tokens_in", tokens_in), ("tokens_out", tokens_out), ("latency_ms", latency_ms)):
        if v is not None and not isinstance(v, int):
            raise ValueError(f"'{k}' must be int or null")
    if cost_usd is not None and not isinstance(cost_usd, (int, float)):
        raise ValueError("'cost_usd' must be number or null")

    # --- INSERT (tenant-scoped via RLS) — psycopg auto-instrumented by OTel.
    # tenant_id từ current_tenant() (header), KHÔNG params → ADR-040 boundary.
    with tenant_connection(current_tenant()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO llm_traces (
                    tenant_id, intent_type, rid, node, provider, model,
                    tokens_in, tokens_out, cost_usd, latency_ms, status, error_code
                )
                VALUES (
                    current_setting('app.tenant_id')::uuid,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id::text
                """,
                (
                    intent_type,
                    rid,
                    node,
                    provider,
                    model,
                    tokens_in,
                    tokens_out,
                    cost_usd,
                    latency_ms,
                    status,
                    error_code,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError("INSERT returned no row")
            trace_id = row[0]
        conn.commit()

    # row_id (NOT trace_id): the structlog processor owns the LOCKED `trace_id`
    # field (OTel span trace id) — naming our kwarg trace_id would be shadowed.
    _logger.info(
        "trace.appended",
        row_id=trace_id,
        provider=provider,
        model=model,
        status=status,
        intent=intent_type,
    )
    return {"trace_id": trace_id}


# Register at import time per registry pattern.
register("traces.append", append)
