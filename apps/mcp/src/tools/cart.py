# =============================================================================
# apps/mcp/src/tools/cart.py — 7 cart MCP tools per D-S05-01..05 LAW
# =============================================================================
# S-05 T02 (Phiên Sx05-2b — Backend Services Layer per handoff Section 6).
#
# Storage: Redis JSON snapshot pattern per D-S05-02 LAW.
#   Key:   cart:{user_id} → JSON string (Cart schema sans user_id wrapper —
#                            user_id is implicit from the key namespace)
#   TTL:   7 days (per handoff §2 verdict; refreshed on each write op)
#   Mutex: cart:{user_id}:lock TTL 5s for atomic read-modify-write ops
#          (best-effort SETNX guard; Hackathon scope — full row-locking
#          deferred to S-06+ when concurrent checkout race emerges).
#
# Schema source: packages/shared-types/src/cart.ts CartSchema (T01 ship,
#                Phiên Sx05-1 — verified 4075 B + Pattern A interrupt-aware
#                fields per D-S05-02 LAW câu #2 Option C).
#
# 7 tools registered per docs/03_API_CONTRACTS.md §5 + handoff §4
# (C-S05-A resolution 4→7 reconcile):
#   cart.get          — fetch + inline validate_stock per A4 + compute totals
#   cart.update_qty   — set qty for product_id (qty=0 → auto-remove); qty cap 99
#   cart.remove       — explicit remove single product (shortcut for qty=0)
#   cart.clear        — wipe entire cart Redis key (returns {cleared: true})
#   cart.validate_stock — re-query Postgres products WHERE id IN(...); return
#                       per-item {product_id, in_stock, available_stock}
#   cart.apply_promo  — fixture-based exact-match validate (case-insensitive);
#                       LLM typo correction NOT inside this tool — handled by
#                       AI graph caller if needed per D-S05-05 LAW
#   cart.remove_promo — clear cart.promo + recompute totals
#
# **Idempotency:** MCP tool handlers are sync per tools/__init__.py:38 Callable
# type. Gateway POST/PATCH/DELETE write endpoints are guarded by
# IdempotencyMiddleware (S-02 T01); this MCP layer trusts Gateway's
# idempotency gate. Direct MCP calls (smoke testing) skip this gate.
#
# **Empty-cart shape:** When cart:{user_id} Redis key is missing, return a
# valid empty Cart per CartSchema (user_id + empty items + totals.subtotal=0
# + nulls for promo/free_gift_hint/pending_interrupts/last_action_rid). NEVER
# return None — FE GET /cart always expects 200 + valid Cart JSON per A1
# mockup state-B empty.
#
# Reference:
#   - docs/03_API_CONTRACTS.md §5 (MCP Tool Specs LOCKED — JSON-RPC 2.0)
#   - docs/02_DATA_MODEL.md §5 Redis Key Patterns (cart:{user_id} post-T02
#     reconcile per C-S05-B HASH → JSON snapshot)
#   - slices/S-05_decisions-log.md D-S05-02 LAW + D-S05-05 LAW + C-S05-A/B/C
#   - packages/shared-types/src/cart.ts CartSchema (T01 ship)
#   - infra/seed/promo_codes.json (3 codes T01 ship)
#   - infra/seed/free_gift_rules.json (threshold 200000 T01 ship)
#   - apps/mcp/src/tools/products.py 117 LOC (Postgres connection pattern clone)
# =============================================================================
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psycopg
import redis
from psycopg.rows import dict_row

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)

# Storage constants per D-S05-02 LAW.
_CART_KEY_TEMPLATE = "cart:{user_id}"
_CART_LOCK_KEY_TEMPLATE = "cart:{user_id}:lock"
_CART_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days
_CART_LOCK_TTL_SECONDS = 5  # short — best-effort guard
_MAX_QTY_PER_ITEM = 99  # per D-S05-02 LAW + UI cap

# Free-ship threshold per ADR-05-08 + handoff §A1 (BE-computed at totals time).
_FREE_SHIP_THRESHOLD = 100_000  # VND
_SHIPPING_FEE_DEFAULT = 30_000  # VND when subtotal < threshold

# Fixture paths per handoff §6 + T01 ship.
_PROMO_FIXTURE_PATH = os.getenv(
    "PROMO_FIXTURE_PATH", "/app/infra/seed/promo_codes.json"
)
_FREE_GIFT_FIXTURE_PATH = os.getenv(
    "FREE_GIFT_FIXTURE_PATH", "/app/infra/seed/free_gift_rules.json"
)


# ---------------------------------------------------------------------------
# Connection helpers (clone products.py pattern)
# ---------------------------------------------------------------------------


def _get_dsn() -> str:
    """Return Postgres DSN from env. Clone of products.py:_get_dsn."""
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

    Sync (not async) per MCP tool handler signature contract
    (apps/mcp/src/tools/__init__.py:38 Callable[[dict], Any]).
    """
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        _REDIS_CLIENT = redis.from_url(
            _get_redis_url(), decode_responses=True
        )
    return _REDIS_CLIENT


def _cart_key(user_id: str) -> str:
    return _CART_KEY_TEMPLATE.format(user_id=user_id)


def _cart_lock_key(user_id: str) -> str:
    return _CART_LOCK_KEY_TEMPLATE.format(user_id=user_id)


def _now_iso() -> str:
    """ISO 8601 timestamp UTC for Cart.updated_at + CartItem.added_at."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Cart core helpers
# ---------------------------------------------------------------------------


def _empty_cart(user_id: str) -> dict[str, Any]:
    """Return a valid empty Cart shape per CartSchema (T01 ship).

    Called when cart:{user_id} Redis key missing OR after cart.clear.
    Must round-trip cleanly through cart.ts CartSchema Zod validation.
    """
    return {
        "user_id": user_id,
        "items": [],
        "updated_at": _now_iso(),
        "totals": {
            "subtotal": 0,
            "discount": 0,
            "shipping": 0,
            "total": 0,
        },
        "promo": None,
        "free_gift_hint": None,
        "pending_interrupts": None,
        "last_action_rid": None,
    }


def _load_cart(rc: redis.Redis, user_id: str) -> dict[str, Any]:
    """Load cart JSON from Redis OR return empty cart shape.

    Empty-cart contract: NEVER return None. FE GET /cart expects 200 + valid
    Cart JSON for both populated and empty cases.
    """
    raw = rc.get(_cart_key(user_id))
    if not raw:
        return _empty_cart(user_id)
    try:
        cart = json.loads(raw)
        # Defensive: ensure required top-level keys exist (forward-compat
        # for future schema additions; missing → fill with empty defaults).
        cart.setdefault("user_id", user_id)
        cart.setdefault("items", [])
        cart.setdefault("totals", {"subtotal": 0, "discount": 0, "shipping": 0, "total": 0})
        cart.setdefault("promo", None)
        cart.setdefault("free_gift_hint", None)
        cart.setdefault("pending_interrupts", None)
        cart.setdefault("last_action_rid", None)
        cart["updated_at"] = cart.get("updated_at") or _now_iso()
        return cart
    except json.JSONDecodeError as e:
        _logger.warning(
            "cart.corrupt_json",
            user_id=user_id,
            error=str(e),
            action="returning_empty_cart",
        )
        return _empty_cart(user_id)


def _save_cart(rc: redis.Redis, user_id: str, cart: dict[str, Any]) -> None:
    """Persist cart JSON to Redis with 7d TTL refresh.

    Best-effort 5s SETNX mutex to reduce race on rapid concurrent writes
    (e.g. user double-taps qty stepper); failure to acquire lock still
    proceeds to write (last-write-wins per Hackathon scope tolerance).
    """
    lock_key = _cart_lock_key(user_id)
    # Best-effort lock attempt; ignore result (true SETNX semantics needed
    # only for strict CAS; here we just want to log contention).
    acquired = rc.set(
        lock_key, "1", nx=True, ex=_CART_LOCK_TTL_SECONDS
    )
    if not acquired:
        _logger.warning(
            "cart.lock_contention",
            user_id=user_id,
            note="proceeding_anyway_last_write_wins",
        )
    try:
        cart["updated_at"] = _now_iso()
        rc.setex(_cart_key(user_id), _CART_TTL_SECONDS, json.dumps(cart))
    finally:
        try:
            rc.delete(lock_key)
        except Exception:  # noqa: BLE001
            pass


def _compute_totals(
    items: list[dict[str, Any]], promo: Optional[dict[str, Any]]
) -> dict[str, Any]:
    """Recompute Cart.totals per D-S05-02 LAW.

    - subtotal:  sum(qty * unit_price) for all in_stock=True items only.
                 Out-of-stock items DO NOT contribute to subtotal (mockup
                 state-E line ~191 shows out-of-stock line-total greyed out).
    - discount:  per promo.type:
                   'percent'  → subtotal * value/100, rounded down
                   'fixed'    → min(value, subtotal)
                   'shipping' → 0 (impacts shipping line instead)
                 No promo → 0.
    - shipping:  30k if subtotal < 100k threshold AND promo.type != 'shipping'.
                 0 otherwise (free-ship promo OR subtotal ≥ threshold).
                 Per ADR-05-08 + handoff §A1.
    - total:     subtotal - discount + shipping
    """
    subtotal = 0
    for item in items:
        if item.get("in_stock", True):
            subtotal += int(item.get("qty", 0)) * int(item.get("unit_price", 0))

    discount = 0
    shipping_override_free = False
    if promo:
        ptype = promo.get("type")
        pvalue = promo.get("value")
        if ptype == "percent" and isinstance(pvalue, (int, float)):
            discount = int(subtotal * float(pvalue) / 100.0)
        elif ptype == "fixed" and isinstance(pvalue, (int, float)):
            discount = min(int(pvalue), subtotal)
        elif ptype == "shipping":
            shipping_override_free = True

    if shipping_override_free or subtotal >= _FREE_SHIP_THRESHOLD or subtotal == 0:
        shipping = 0
    else:
        shipping = _SHIPPING_FEE_DEFAULT

    total = subtotal - discount + shipping
    if total < 0:
        total = 0

    return {
        "subtotal": int(subtotal),
        "discount": int(discount),
        "shipping": int(shipping),
        "total": int(total),
    }


def _compute_free_gift_hint(subtotal: int) -> Optional[dict[str, Any]]:
    """Compute free_gift_hint per fixture lookup.

    Returns None when:
      - subtotal == 0 (empty cart — no hint relevant)
      - fixture missing or empty
      - subtotal already meets threshold (gift unlocked; hint deferred to S-06
        checkout flow per D-S05-06 LAW pattern)

    Returns hint dict when subtotal < threshold but > 0:
      {threshold: int, progress: int, gift_label: str}
    Per CartSchema free_gift_hint field shape (cart.ts T01 ship).
    """
    if subtotal <= 0:
        return None
    try:
        rules = json.loads(Path(_FREE_GIFT_FIXTURE_PATH).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        _logger.warning("cart.free_gift_fixture_load_failed", error=str(e))
        return None
    if not isinstance(rules, list) or not rules:
        return None
    # Take first active rule (handoff §6 single-rule scope; multi-rule
    # forward-compat preserved by array structure).
    for rule in rules:
        if not rule.get("active", True):
            continue
        threshold = int(rule.get("threshold", 0))
        if threshold <= 0 or subtotal >= threshold:
            continue
        return {
            "threshold": threshold,
            "progress": int(subtotal),
            "gift_label": str(rule.get("gift_label", "")),
        }
    return None


def _validate_stock_inline(
    conn: psycopg.Connection, items: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Re-query Postgres products table for stock status per A4 spec.

    For each cart item, set in_stock + available_stock based on current
    Postgres row. Item snapshot fields (title, brand, image_url, unit_price)
    are NOT mutated — they were captured at add-to-cart time per
    ADR-05-02 LOCKED.

    Items where product_id is missing from products table (deleted product)
    are flagged in_stock=False + available_stock=0 (graceful — FE renders
    them with "không còn bán" alert similar to out-of-stock).
    """
    if not items:
        return items

    product_ids = [item["product_id"] for item in items if item.get("product_id")]
    if not product_ids:
        return items

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, stock FROM products WHERE id = ANY(%s)",
            (product_ids,),
        )
        rows = {str(row["id"]): int(row["stock"]) for row in cur.fetchall()}

    for item in items:
        pid = item.get("product_id")
        if not pid or pid not in rows:
            item["in_stock"] = False
            item["available_stock"] = 0
        else:
            stock = rows[pid]
            item["available_stock"] = stock
            item["in_stock"] = stock > 0

    return items


def _fetch_product_snapshot(
    conn: psycopg.Connection, product_id: str
) -> Optional[dict[str, Any]]:
    """Fetch product fields needed for cart snapshot (used by upsert path).

    Returns dict matching CartItemSnapshotSchema (cart.ts T01 ship) or None
    if product_id not found.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, title, attributes, price, stock, image_url
            FROM products
            WHERE id = %s
            """,
            (product_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    attrs = row.get("attributes") or {}
    return {
        "title": str(row["title"]),
        "brand": attrs.get("brand"),
        "image_url": row.get("image_url"),
        "image_gradient": attrs.get("image_gradient"),
        "icon_hint": attrs.get("icon_hint"),
        "original_price": attrs.get("original_price"),
        # transient fields used only inside upsert (not in snapshot per se):
        "_unit_price": int(row["price"]),
        "_stock": int(row["stock"]),
    }


# ---------------------------------------------------------------------------
# 7 Tool handlers
# ---------------------------------------------------------------------------


def get(params: dict[str, Any]) -> dict[str, Any]:
    """cart.get {user_id} → Cart with inline validate_stock per A4.

    Always returns 200 + valid Cart shape per CartSchema. Empty-cart user
    returns the empty Cart shape (NEVER None or 404).
    """
    user_id = params.get("user_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required (UUID or session id string)")

    rc = _get_redis_client()
    cart = _load_cart(rc, user_id)

    if cart["items"]:
        # Re-validate stock + recompute totals on every read per A4 LAW.
        with psycopg.connect(_get_dsn()) as conn:
            cart["items"] = _validate_stock_inline(conn, cart["items"])
        cart["totals"] = _compute_totals(cart["items"], cart.get("promo"))
        cart["free_gift_hint"] = _compute_free_gift_hint(
            cart["totals"]["subtotal"]
        )

    _logger.info(
        "cart.get_returned",
        user_id=user_id,
        item_count=len(cart["items"]),
        subtotal=cart["totals"]["subtotal"],
    )
    return cart


def update_qty(params: dict[str, Any]) -> dict[str, Any]:
    """cart.update_qty {user_id, product_id, qty, snapshot?} → Cart.

    Behavior:
    - qty == 0: auto-remove the item (sugar for cart.remove).
    - qty > 99: clamped to 99 + warning log (defense — Gateway DTO validates
                upstream).
    - product_id not in cart: ADD (upsert path). Requires `snapshot` param
                              OR successful product fetch from Postgres.
                              Caller (Gateway POST /cart/items) is expected
                              to pass `snapshot` per D-S05-02 LAW snapshot
                              pattern; this MCP tool also fetches from PG
                              as defense if snapshot is omitted.
    - product_id in cart:    UPDATE qty in-place.

    Returns the fresh Cart shape with totals recomputed.
    """
    user_id = params.get("user_id")
    product_id = params.get("product_id")
    qty_raw = params.get("qty")
    snapshot_in = params.get("snapshot")

    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required (string)")
    if not isinstance(product_id, str) or not product_id:
        raise ValueError("'product_id' required (UUID string)")
    if not isinstance(qty_raw, int) or qty_raw < 0:
        raise ValueError("'qty' required (non-negative integer)")

    qty = qty_raw
    if qty > _MAX_QTY_PER_ITEM:
        _logger.warning(
            "cart.qty_clamped",
            user_id=user_id,
            product_id=product_id,
            requested=qty,
            clamped=_MAX_QTY_PER_ITEM,
        )
        qty = _MAX_QTY_PER_ITEM

    rc = _get_redis_client()
    cart = _load_cart(rc, user_id)

    # Find existing item.
    idx = next(
        (i for i, it in enumerate(cart["items"]) if it.get("product_id") == product_id),
        None,
    )

    if qty == 0:
        # Auto-remove path.
        if idx is not None:
            removed = cart["items"].pop(idx)
            _logger.info(
                "cart.item_auto_removed_on_zero_qty",
                user_id=user_id,
                product_id=product_id,
                prev_qty=removed.get("qty"),
            )
        # else: idempotent no-op (item already absent).
    elif idx is not None:
        # Update qty path.
        cart["items"][idx]["qty"] = qty
        _logger.info(
            "cart.qty_updated",
            user_id=user_id,
            product_id=product_id,
            new_qty=qty,
        )
    else:
        # Upsert (ADD) path — need full item shape.
        with psycopg.connect(_get_dsn()) as conn:
            pg_snap = _fetch_product_snapshot(conn, product_id)
        if not pg_snap:
            raise ValueError(
                f"product_id={product_id!r} not found in products table"
            )
        # Use caller-provided snapshot if present (handoff §3 CartItemSnapshot),
        # otherwise fall back to Postgres-derived snapshot.
        if isinstance(snapshot_in, dict):
            snapshot = {
                "title": snapshot_in.get("title") or pg_snap["title"],
                "brand": snapshot_in.get("brand") if "brand" in snapshot_in else pg_snap["brand"],
                "image_url": snapshot_in.get("image_url") if "image_url" in snapshot_in else pg_snap["image_url"],
                "image_gradient": snapshot_in.get("image_gradient") if "image_gradient" in snapshot_in else pg_snap["image_gradient"],
                "icon_hint": snapshot_in.get("icon_hint") if "icon_hint" in snapshot_in else pg_snap["icon_hint"],
                "original_price": snapshot_in.get("original_price") if "original_price" in snapshot_in else pg_snap["original_price"],
            }
        else:
            snapshot = {
                "title": pg_snap["title"],
                "brand": pg_snap["brand"],
                "image_url": pg_snap["image_url"],
                "image_gradient": pg_snap["image_gradient"],
                "icon_hint": pg_snap["icon_hint"],
                "original_price": pg_snap["original_price"],
            }
        new_item = {
            "product_id": product_id,
            "qty": qty,
            "unit_price": pg_snap["_unit_price"],
            "added_at": _now_iso(),
            "snapshot": snapshot,
            "in_stock": pg_snap["_stock"] > 0,
            "available_stock": pg_snap["_stock"],
        }
        cart["items"].append(new_item)
        _logger.info(
            "cart.item_added",
            user_id=user_id,
            product_id=product_id,
            qty=qty,
            unit_price=pg_snap["_unit_price"],
        )

    # Recompute totals on every mutation.
    with psycopg.connect(_get_dsn()) as conn:
        cart["items"] = _validate_stock_inline(conn, cart["items"])
    cart["totals"] = _compute_totals(cart["items"], cart.get("promo"))
    cart["free_gift_hint"] = _compute_free_gift_hint(cart["totals"]["subtotal"])

    _save_cart(rc, user_id, cart)
    return cart


def remove(params: dict[str, Any]) -> dict[str, Any]:
    """cart.remove {user_id, product_id} → Cart.

    Sugar over update_qty with qty=0. Idempotent — removing missing item
    is a no-op (returns current cart unchanged).
    """
    user_id = params.get("user_id")
    product_id = params.get("product_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required")
    if not isinstance(product_id, str) or not product_id:
        raise ValueError("'product_id' required")
    return update_qty({"user_id": user_id, "product_id": product_id, "qty": 0})


def clear(params: dict[str, Any]) -> dict[str, Any]:
    """cart.clear {user_id} → {cleared: true, user_id: <user_id>}.

    Deletes the cart:{user_id} Redis key entirely (Redis DEL). Subsequent
    cart.get returns empty cart shape from _empty_cart helper. Idempotent —
    deleting absent key returns same {cleared: true} response.
    """
    user_id = params.get("user_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required")

    rc = _get_redis_client()
    deleted = rc.delete(_cart_key(user_id))
    _logger.info(
        "cart.cleared", user_id=user_id, keys_deleted=int(deleted)
    )
    return {"cleared": True, "user_id": user_id}


def validate_stock(params: dict[str, Any]) -> dict[str, Any]:
    """cart.validate_stock {user_id} → {updates: [{product_id, in_stock, available_stock}]}.

    Re-queries Postgres for current stock. Does NOT mutate Redis cart state
    (the AI graph stock_issue_lookup node uses this to know which items
    need replacement candidates before resume).

    Returns updates list (NOT the cart) so caller can map updates → its
    own state machine. Empty list when cart is empty.
    """
    user_id = params.get("user_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required")

    rc = _get_redis_client()
    cart = _load_cart(rc, user_id)
    if not cart["items"]:
        return {"updates": []}

    with psycopg.connect(_get_dsn()) as conn:
        items = _validate_stock_inline(conn, cart["items"])

    updates = [
        {
            "product_id": it["product_id"],
            "in_stock": bool(it.get("in_stock", False)),
            "available_stock": int(it.get("available_stock", 0)),
        }
        for it in items
    ]
    _logger.info(
        "cart.validate_stock_returned",
        user_id=user_id,
        update_count=len(updates),
        out_of_stock_count=sum(1 for u in updates if not u["in_stock"]),
    )
    return {"updates": updates}


def apply_promo(params: dict[str, Any]) -> dict[str, Any]:
    """cart.apply_promo {user_id, code} → Cart | error per D-S05-05 LAW.

    Fast-path: case-insensitive exact match against infra/seed/promo_codes.json
    fixture (3 codes: SALE15 / FREESHIP / NEWUSER per T01 ship).

    LLM typo correction is NOT performed inside this MCP tool — it's handled
    by the Gateway/AI layer caller chain per D-S05-05 LAW (Gateway hands raw
    user input to this tool; if INVALID_CODE returned, caller may invoke a
    separate LLM-assisted retry via cart_promo_typo.txt prompt).

    Returns the fresh Cart with promo applied + totals recomputed on success.
    Returns {error: 'INVALID_CODE'} on miss (does NOT mutate cart).

    Edge case: applying same promo twice is idempotent (overwrites with same
    state, no error).
    """
    user_id = params.get("user_id")
    code_raw = params.get("code")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required")
    if not isinstance(code_raw, str) or not code_raw:
        raise ValueError("'code' required (non-empty string)")

    code_upper = code_raw.strip().upper()

    # Load fixture (cache miss is cheap — file ~1.4KB).
    try:
        promos = json.loads(Path(_PROMO_FIXTURE_PATH).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        _logger.error("cart.promo_fixture_load_failed", error=str(e))
        return {"error": "INVALID_CODE", "reason": "fixture_unavailable"}

    matched = next(
        (
            p for p in promos
            if isinstance(p, dict) and str(p.get("code", "")).upper() == code_upper
        ),
        None,
    )
    if not matched:
        _logger.info(
            "cart.promo_invalid", user_id=user_id, code=code_upper
        )
        return {"error": "INVALID_CODE"}

    rc = _get_redis_client()
    cart = _load_cart(rc, user_id)

    # Build promo state per CartSchema.promo field shape.
    promo_state = {
        "code": str(matched["code"]).upper(),
        "label": str(matched.get("label", "")),
        "type": matched.get("type"),  # internal — used by _compute_totals
        "value": matched.get("value"),  # internal — used by _compute_totals
        "discount_amount": 0,  # filled after compute below
    }
    # Pre-compute discount via _compute_totals dry-run.
    if cart["items"]:
        with psycopg.connect(_get_dsn()) as conn:
            cart["items"] = _validate_stock_inline(conn, cart["items"])
    new_totals = _compute_totals(cart["items"], promo_state)
    promo_state["discount_amount"] = int(new_totals["discount"])

    cart["promo"] = promo_state
    cart["totals"] = new_totals
    cart["free_gift_hint"] = _compute_free_gift_hint(new_totals["subtotal"])

    _save_cart(rc, user_id, cart)
    _logger.info(
        "cart.promo_applied",
        user_id=user_id,
        code=promo_state["code"],
        discount_amount=promo_state["discount_amount"],
    )
    return cart


def remove_promo(params: dict[str, Any]) -> dict[str, Any]:
    """cart.remove_promo {user_id} → Cart with promo=None + totals recomputed."""
    user_id = params.get("user_id")
    if not isinstance(user_id, str) or not user_id:
        raise ValueError("'user_id' required")

    rc = _get_redis_client()
    cart = _load_cart(rc, user_id)

    if cart.get("promo") is None:
        # Idempotent no-op.
        return cart

    cart["promo"] = None
    if cart["items"]:
        with psycopg.connect(_get_dsn()) as conn:
            cart["items"] = _validate_stock_inline(conn, cart["items"])
    cart["totals"] = _compute_totals(cart["items"], None)
    cart["free_gift_hint"] = _compute_free_gift_hint(cart["totals"]["subtotal"])

    _save_cart(rc, user_id, cart)
    _logger.info("cart.promo_removed", user_id=user_id)
    return cart


# ---------------------------------------------------------------------------
# Registration — fires at import time per registry pattern
# ---------------------------------------------------------------------------
register("cart.get", get)
register("cart.update_qty", update_qty)
register("cart.remove", remove)
register("cart.clear", clear)
register("cart.validate_stock", validate_stock)
register("cart.apply_promo", apply_promo)
register("cart.remove_promo", remove_promo)
