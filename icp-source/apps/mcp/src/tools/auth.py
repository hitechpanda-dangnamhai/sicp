# =============================================================================
# apps/mcp/src/tools/auth.py — auth.verify_jwt tool stub
# =============================================================================
# Stub implementation per PHASE_01_INFRA.md Day 5 + spec 03_API §5:
#   auth.verify_jwt:
#     params: { token: string }
#     returns: { user_id: string, role: string } | null
#
# T04 scope: stub returns null for any token (real JWT verify = S-03 V-SLICE
# Auth ownership). Emits log events per Day 5: auth.token_verified /
# auth.token_invalid.
#
# Reference:
#   - docs/phases/PHASE_01_INFRA.md Day 5 (log events specified)
#   - docs/specs/03_API_CONTRACTS.md §5 auth section
#   - slices/S-02_BRIEF.md §4 (Non-Goals: NOT building auth/JWT business logic)
# =============================================================================

from __future__ import annotations

from typing import Any

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


def verify_jwt(params: dict[str, Any]) -> dict[str, str] | None:
    """
    Stub JWT verification — returns None for ALL tokens until S-03.

    Args:
        params: {"token": str}

    Returns:
        None — real verify defers to S-03. Caller (gateway) treats null as
        unauthenticated and rejects with 401 UNAUTHORIZED per 03_API §4.

    Raises:
        ValueError: if 'token' param missing or not string (JSON-RPC invalid_params).
    """
    token = params.get("token")
    if not isinstance(token, str):
        raise ValueError("'token' param required (string)")

    # Per spec: stub always returns None (S-03 real impl). Log distinguishes
    # 'received but unimplemented' vs 'real invalid' for future audit clarity.
    _logger.info(
        "auth.token_invalid",
        reason="stub_unimplemented",
        token_prefix=token[:8] if len(token) >= 8 else "(too_short)",
    )
    return None


# Register at import time per registry pattern in tools/__init__.py.
register("auth.verify_jwt", verify_jwt)
