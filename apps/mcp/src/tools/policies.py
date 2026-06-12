# =============================================================================
# apps/mcp/src/tools/policies.py — policies.find_matching tool (S-07 T01 NEW)
# =============================================================================
# Per C-S07-H + DATA_MODEL §4 + PHASE_03 §D: Policy DSL evaluator with JSONPath
# subset + mustache-like template renderer + matching engine.
#
# Policy schema (per V001 policies table + infra/seed/policies.json):
#   {
#     "code": str,                      # unique policy code
#     "description": str,
#     "rule_dsl": {
#       "trigger": str,                 # event type to match
#       "condition": {
#         "field": str,                 # JSONPath subset (dot-notation only)
#         "op": str,                    # ==, !=, >, >=, <, <=, in, contains, matches,
#                                       # lt_with_hot (compound for stock+trend)
#         "value": scalar | object      # value to compare (object for compound ops)
#       },
#       "action": {
#         "type": str,                  # SUGGEST_PRICE, SUGGEST_ATTRS, ...
#         "template": str               # template code for rationale rendering
#       }
#     },
#     "priority": int,                  # higher = first
#     "enabled": bool
#   }
#
# Returns shape:
#   [
#     {
#       "policy_id": str,               # UUID
#       "policy_code": str,
#       "action_type": str,
#       "template": str,                # template code only (rendering caller's job)
#       "rationale_context": dict       # available bindings for rationale render
#     },
#     ...
#   ]
#
# JSONPath subset (deliberate minimal scope — no library dep):
#   - Dot notation: "foo.bar.baz" → context["foo"]["bar"]["baz"]
#   - Returns None if any segment missing (treat as no-match for most ops)
#
# Operators supported:
#   ==, !=                  scalar equality
#   >, >=, <, <=            numeric comparison
#   in                      membership: value in field (field is list/string)
#   contains                opposite: field contains value
#   matches                 regex (re.search)
#   lt_with_hot             COMPOUND: field is dict {stock, trend_score},
#                            value is {stock_max, trend_min};
#                            matches if stock < stock_max AND trend_score >= trend_min
#
# Reference:
#   - docs/02_DATA_MODEL.md §3 Policy DSL spec
#   - infra/seed/policies.json (7 policies after T01.A.A2 AMEND)
#   - docs/phases/PHASE_03_IMPORT.md §D Policy DSL Evaluator scope
#   - slices/S-07_decisions-log.md C-S07-H (7 policies catalog)
# =============================================================================

from __future__ import annotations

import re
from typing import Any

from psycopg.rows import dict_row

from src.db import current_tenant, tenant_connection
from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# JSONPath subset (dot-notation only) — no library dependency
# ---------------------------------------------------------------------------

def _jsonpath_get(context: dict[str, Any], path: str) -> Any:
    """Walk dot-notation path through nested dict; return None if any segment missing.

    Example:
        _jsonpath_get({"a": {"b": 1}}, "a.b") → 1
        _jsonpath_get({"a": {"b": 1}}, "a.c") → None
    """
    if not path:
        return None
    cur: Any = context
    for segment in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(segment)
        else:
            return None
        if cur is None:
            return None
    return cur


# ---------------------------------------------------------------------------
# Operator evaluators
# ---------------------------------------------------------------------------

def _op_eq(field_val: Any, target: Any) -> bool:
    return field_val == target


def _op_ne(field_val: Any, target: Any) -> bool:
    return field_val != target


def _op_gt(field_val: Any, target: Any) -> bool:
    try:
        return float(field_val) > float(target)
    except (TypeError, ValueError):
        return False


def _op_ge(field_val: Any, target: Any) -> bool:
    try:
        return float(field_val) >= float(target)
    except (TypeError, ValueError):
        return False


def _op_lt(field_val: Any, target: Any) -> bool:
    try:
        return float(field_val) < float(target)
    except (TypeError, ValueError):
        return False


def _op_le(field_val: Any, target: Any) -> bool:
    try:
        return float(field_val) <= float(target)
    except (TypeError, ValueError):
        return False


def _op_in(field_val: Any, target: Any) -> bool:
    """field_val in target (target is list or string)."""
    if isinstance(target, (list, str, tuple, set)):
        return field_val in target
    return False


def _op_contains(field_val: Any, target: Any) -> bool:
    """field_val contains target (field is list or string)."""
    if isinstance(field_val, (list, str, tuple, set)):
        return target in field_val
    return False


def _op_matches(field_val: Any, target: Any) -> bool:
    """re.search(target, field_val) — both must be strings."""
    if not isinstance(field_val, str) or not isinstance(target, str):
        return False
    try:
        return bool(re.search(target, field_val))
    except re.error:
        return False


def _op_lt_with_hot(field_val: Any, target: Any) -> bool:
    """Compound: field_val={stock, trend_score}, target={stock_max, trend_min}.

    Matches: stock < stock_max AND trend_score >= trend_min.
    Used by LOW_STOCK_HOT_v1 policy.
    """
    if not isinstance(field_val, dict) or not isinstance(target, dict):
        return False
    try:
        stock = float(field_val.get("stock", 0))
        trend = float(field_val.get("trend_score", 0))
        stock_max = float(target.get("stock_max", 0))
        trend_min = float(target.get("trend_min", 0))
        return stock < stock_max and trend >= trend_min
    except (TypeError, ValueError):
        return False


_OPERATORS = {
    "==": _op_eq,
    "!=": _op_ne,
    ">": _op_gt,
    ">=": _op_ge,
    "<": _op_lt,
    "<=": _op_le,
    "in": _op_in,
    "contains": _op_contains,
    "matches": _op_matches,
    "lt_with_hot": _op_lt_with_hot,
}


def _eval_condition(condition: dict[str, Any], context: dict[str, Any]) -> bool:
    """Evaluate a single condition against context.

    Condition shape: {"field": str (jsonpath), "op": str, "value": Any}.
    Returns True if condition matches.
    """
    if not isinstance(condition, dict):
        return False

    field_path = condition.get("field")
    op_name = condition.get("op")
    target = condition.get("value")

    if not isinstance(field_path, str) or not isinstance(op_name, str):
        return False

    op_fn = _OPERATORS.get(op_name)
    if op_fn is None:
        _logger.warning("policies.unknown_op", op=op_name)
        return False

    # For compound ops (lt_with_hot), field_path may resolve to entire dict
    # rather than a scalar. _jsonpath_get returns whatever is at path.
    field_val = _jsonpath_get(context, field_path)
    if field_val is None and op_name not in ("!=",):
        # Field missing — most ops return False; != returns True (None != value).
        return False

    return op_fn(field_val, target)


# ---------------------------------------------------------------------------
# Mustache-like template renderer (NOT registered as tool; helper for cards.py)
# ---------------------------------------------------------------------------

_TEMPLATE_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}")


def render_template(template: str, context: dict[str, Any]) -> str:
    """Render `{{path.to.value}}` placeholders in template using context.

    Missing paths render as empty string (defensive — don't break demo).
    Public function for cards.py reuse during card generation.
    """
    def _replace(match: re.Match[str]) -> str:
        path = match.group(1)
        val = _jsonpath_get(context, path)
        if val is None:
            return ""
        if isinstance(val, (list, dict)):
            import json as _json
            return _json.dumps(val, ensure_ascii=False)
        return str(val)

    return _TEMPLATE_VAR_RE.sub(_replace, template)


# ---------------------------------------------------------------------------
# Main entry — policies.find_matching MCP tool
# ---------------------------------------------------------------------------

def find_matching(params: dict[str, Any]) -> list[dict[str, Any]]:
    """policies.find_matching MCP tool — load enabled policies matching trigger,
    evaluate condition against context, return matched ordered by priority DESC.

    Args:
        params: {
          "trigger": str,               # required — event type (e.g. "ProductDraftSubmitted")
          "context": dict,              # required — bindings for condition eval + template render
        }

    Returns:
        list of dicts:
          [
            {
              "policy_id": str,
              "policy_code": str,
              "action_type": str,
              "template": str,
              "rationale_context": dict   # echo of input context (for cards.py render)
            },
            ...
          ]
        Sorted by priority DESC (highest first).
    """
    trigger = params.get("trigger")
    context = params.get("context")

    if not isinstance(trigger, str) or not trigger:
        raise ValueError("'trigger' param required (non-empty string)")
    if not isinstance(context, dict):
        raise ValueError("'context' param required (object)")

    # Load enabled policies for this trigger from DB.
    with tenant_connection(current_tenant()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id::text AS id, code, rule_dsl, priority
                FROM policies
                WHERE enabled = true
                  AND rule_dsl->>'trigger' = %s
                ORDER BY priority DESC
                """,
                (trigger,),
            )
            policies = cur.fetchall()

    matches: list[dict[str, Any]] = []
    for pol in policies:
        rule_dsl = pol.get("rule_dsl") or {}
        condition = rule_dsl.get("condition") or {}
        action = rule_dsl.get("action") or {}

        if _eval_condition(condition, context):
            matches.append({
                "policy_id": pol["id"],
                "policy_code": pol["code"],
                "action_type": action.get("type", "UNKNOWN"),
                "template": action.get("template", ""),
                "rationale_context": context,
            })

    _logger.info(
        "policies.find_matching.done",
        trigger=trigger,
        evaluated=len(policies),
        matched=len(matches),
    )
    return matches


# Register at import time per MCP tools registry pattern.
register("policies.find_matching", find_matching)
