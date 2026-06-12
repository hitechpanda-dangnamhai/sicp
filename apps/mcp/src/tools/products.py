# =============================================================================
# apps/mcp/src/tools/products.py — products.get + products.create tools
# =============================================================================
# Real implementation per PHASE_01_INFRA.md Day 5 + spec 03_API §5:
#   products.get:
#     params: { id: string }
#     returns: Product | null
#   products.create (S-07 T01 NEW):
#     params: { merchant_id, title, category, attributes, price, stock,
#               image_data?, image_url?, idempotency_key? }
#     returns: { product_id, created: bool }
#
# V001 schema verified Phiên 25 (products table):
#   id UUID PK, merchant_id UUID NOT NULL REFERENCES users(id)
#   title VARCHAR(255), description TEXT, category VARCHAR(100)
#   attributes JSONB, price BIGINT (VND), stock INT
#   image_url VARCHAR(500), vespa_doc_id VARCHAR(100)
#   trend_score REAL, status VARCHAR(20)
#   created_at, updated_at TIMESTAMPTZ
#
# V002 enrichment (S-04 T01 Phiên Sx04-2):
#   brand, original_price, rating_avg, rating_count, sold_count,
#   image_gradient, icon_hint
#
# V010 inline base64 image (S-07 T01 Phiên Sx07-D per C-S07-B):
#   image_data TEXT NULL
#
# products.create OUTBOX PATTERN per C-S07-M Option ❸:
#   - Same transaction: INSERT products + INSERT events (ProductImported,
#     published_at=NULL outbox row)
#   - NO Kafka publish (defers to S-06 outbox-relay-worker per BRIEF)
#   - Idempotency: optional idempotency_key → ON CONFLICT DO NOTHING semantics
#     via guard on (merchant_id, title) — matches seed.ts Q-4 Path B pattern.
#
# Reference:
#   - docs/03_API_CONTRACTS.md §2 (Product DTO) + §5 (products.get/create spec)
#   - infra/migrations/V001__init.sql products table
#   - infra/migrations/V002__product_enrichment.sql
#   - infra/migrations/V010__image_data_inline.sql (S-07 T01.A.A1)
#   - slices/S-07_decisions-log.md C-S07-M Option ❸ (outbox-only defer S-06)
# =============================================================================

from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from src.db import current_tenant, tenant_connection
from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)


def _row_to_product(row: dict[str, Any]) -> dict[str, Any]:
    """
    Map V001+V002+V010 products row → Product DTO (03_API §2).
    """
    return {
        "id": str(row["id"]),
        "merchant_id": str(row["merchant_id"]),
        "title": row["title"],
        "description": row.get("description"),
        "category": row["category"],
        "attributes": row.get("attributes") or {},
        "price": int(row["price"]),
        "stock": int(row["stock"]),
        "image_url": row.get("image_url"),
        "trend_score": float(row.get("trend_score") or 0.0),
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


# ---------------------------------------------------------------------------
# products.get
# ---------------------------------------------------------------------------

def get(params: dict[str, Any]) -> dict[str, Any] | None:
    """Fetch a single product by id."""
    product_id = params.get("id")
    if not isinstance(product_id, str):
        raise ValueError("'id' param required (string UUID)")

    with tenant_connection(current_tenant()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id, merchant_id, title, description, category,
                       attributes, price, stock, image_url, vespa_doc_id,
                       trend_score, status, created_at, updated_at
                FROM products
                WHERE id = %s
                """,
                (product_id,),
            )
            row = cur.fetchone()

    if row is None:
        _logger.info("product.not_found", product_id=product_id)
        return None

    _logger.info("product.fetched", product_id=product_id, title=row.get("title"))
    return _row_to_product(row)


# ---------------------------------------------------------------------------
# products.create — S-07 T01 NEW per C-S07-M Option ❸ outbox-only
# ---------------------------------------------------------------------------

def create(params: dict[str, Any]) -> dict[str, Any]:
    """products.create MCP tool — INSERT product + emit ProductImported outbox event.

    Per C-S07-M Option ❸ outbox-only: same transaction INSERTs products +
    events (with published_at=NULL); NO Kafka publish (defers to S-06).

    Idempotency strategy (matches seed.ts Q-4 Path B):
      - Pre-check guard on (merchant_id, title) — V001 has no UNIQUE constraint
        on natural key (PK is gen_random_uuid). If a row matches, return that
        product_id without INSERT (created=false).
      - Caller may pass `idempotency_key` for client-side dedup tracking;
        worker logs it but does not store (no idempotency_keys table yet).

    Args:
        params: {
          "merchant_id": str,           # required — UUID FK users(id)
          "title": str,                 # required
          "category": str,              # required — canonical category
          "description": str | None,
          "attributes": dict,           # required (may be {})
          "price": int,                 # required — VND integer
          "stock": int,                 # required — units
          "image_data": str | None,     # optional — base64 inline (V010)
          "image_url": str | None,      # optional — VARCHAR(500)
          "brand": str | None,          # optional — V002 denorm
          "trend_score": float | None,  # optional — default 0
          "idempotency_key": str | None # optional — client-side tracking
        }

    Returns: {"product_id": str, "created": bool}.
    """
    required = ("merchant_id", "title", "category", "attributes", "price", "stock")
    missing = [k for k in required if k not in params]
    if missing:
        raise ValueError(f"missing required params: {missing}")

    merchant_id = params["merchant_id"]
    title = params["title"]
    category = params["category"]
    description = params.get("description")
    attributes = params["attributes"]
    price = params["price"]
    stock = params["stock"]
    image_data = params.get("image_data")
    image_url = params.get("image_url")
    brand = params.get("brand")
    trend_score = params.get("trend_score") or 0.0
    idempotency_key = params.get("idempotency_key")

    # --- Type validation ---
    if not isinstance(merchant_id, str):
        raise ValueError("'merchant_id' must be string (UUID)")
    if not isinstance(title, str) or not title or len(title) > 255:
        raise ValueError("'title' must be string 1..255 chars")
    if not isinstance(category, str) or len(category) > 100:
        raise ValueError("'category' must be string ≤ 100 chars")
    if description is not None and not isinstance(description, str):
        raise ValueError("'description' must be string or null")
    if not isinstance(attributes, dict):
        raise ValueError("'attributes' must be object")
    if not isinstance(price, int) or price < 0:
        raise ValueError("'price' must be non-negative integer (VND)")
    if not isinstance(stock, int) or stock < 0:
        raise ValueError("'stock' must be non-negative integer")
    if image_data is not None and not isinstance(image_data, str):
        raise ValueError("'image_data' must be base64 string or null")
    if image_url is not None and (not isinstance(image_url, str) or len(image_url) > 500):
        raise ValueError("'image_url' must be string ≤ 500 chars or null")
    if brand is not None and (not isinstance(brand, str) or len(brand) > 100):
        raise ValueError("'brand' must be string ≤ 100 chars or null")
    if idempotency_key is not None and not isinstance(idempotency_key, str):
        raise ValueError("'idempotency_key' must be string or null")

    # --- Transactional INSERT products + events outbox row ---
    with tenant_connection(current_tenant()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Idempotency pre-check guard per Q-4 Path B pattern.
            cur.execute(
                "SELECT id::text AS id FROM products WHERE merchant_id = %s AND title = %s LIMIT 1",
                (merchant_id, title),
            )
            existing = cur.fetchone()
            if existing is not None:
                _logger.info(
                    "product.create.duplicate_skip",
                    merchant_id=merchant_id,
                    title=title,
                    existing_id=existing["id"],
                    idempotency_key=idempotency_key,
                )
                return {"product_id": existing["id"], "created": False}

            # INSERT products — RETURNING id for outbox event payload.
            cur.execute(
                """
                INSERT INTO products
                  (merchant_id, title, description, category, attributes,
                   price, stock, image_url, image_data, brand, trend_score, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
                RETURNING id::text AS id
                """,
                (
                    merchant_id,
                    title,
                    description,
                    category,
                    Jsonb(attributes),
                    price,
                    stock,
                    image_url,
                    image_data,
                    brand,
                    trend_score,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError("INSERT products returned no row")
            product_id = row["id"]

            # OUTBOX: INSERT events (ProductImported) same transaction.
            # published_at OMITTED → defaults to NULL (the outbox unpublished flag).
            # Per C-S07-M Option ❸: NO Kafka publish here; S-06 outbox-relay-worker
            # picks up NULL rows and publishes to Redpanda.
            event_payload = {
                "product_id": product_id,
                "merchant_id": merchant_id,
                "title": title,
                "category": category,
                "attributes": attributes,
                "price": price,
                "stock": stock,
            }
            event_metadata: dict[str, Any] = {}
            if idempotency_key:
                event_metadata["idempotency_key"] = idempotency_key
            cur.execute(
                """
                INSERT INTO events
                  (type, aggregate_type, aggregate_id, user_id, payload, metadata)
                VALUES ('ProductImported', 'Product', %s, %s, %s, %s)
                """,
                (
                    product_id,
                    merchant_id,
                    Jsonb(event_payload),
                    Jsonb(event_metadata),
                ),
            )
        conn.commit()

    _logger.info(
        "product.created",
        product_id=product_id,
        merchant_id=merchant_id,
        title=title,
        category=category,
        outbox_event="ProductImported",
        idempotency_key=idempotency_key,
    )
    return {"product_id": product_id, "created": True}


# Register at import time per registry pattern.
register("products.get", get)


# --- S-07 T01.E products.update NEW per C-S07-N Option B (Phiên Sx07-D) ---
# Separate update path from products.create. Emits ProductUpdated outbox event.
# Partial update: any field omitted from params is preserved (PG COALESCE pattern).
# Returns full updated row snapshot so Gateway can call vespa.index downstream.

# Whitelist of fields the merchant may mutate via PATCH /api/v1/products/:id.
# Per C-S07-N: id, merchant_id, category, created_at, vespa_doc_id, rating_*,
# sold_count, trend_score are IMMUTABLE via this endpoint.
_UPDATABLE_FIELDS: tuple[str, ...] = (
    "title", "description", "attributes", "price", "stock",
    "image_url", "brand", "original_price", "status",
    "image_data", "image_gradient", "icon_hint",
)


def update(params: dict[str, Any]) -> dict[str, Any]:
    """products.update MCP tool — partial UPDATE + emit ProductUpdated outbox event.

    Per C-S07-N Option B (Phiên Sx07-D): separate endpoint from products.create.
    Same-transaction outbox pattern matches products.create (C-S07-M Option ❸).

    Args:
        params: {
          "product_id": str (UUID, required),
          "expected_merchant_id": str (UUID, required — ownership pre-check
                                       — caller asserts they verified user owns
                                       this product; tool re-verifies inside txn
                                       for defense-in-depth),
          # Any subset of _UPDATABLE_FIELDS (omit a field to keep current value):
          "title": str | None,
          "description": str | None,
          "attributes": dict | None,
          "price": int | None,
          "stock": int | None,
          "image_url": str | None,
          "brand": str | None,
          "original_price": int | None,
          "status": str | None,
          "image_data": str | None,
          "image_gradient": str | None,
          "icon_hint": str | None,
        }

    Returns:
        {
          "product_id": str,
          "updated": bool,                  # False if no fields changed
          "event_id": str | None,           # ProductUpdated outbox event_id
          "snapshot": {                     # Full updated row (Gateway → vespa.index)
            "id": str, "merchant_id": str, "title": str, "description": str,
            "category": str, "attributes": dict, "price": int, "stock": int,
            "image_url": str | None, "brand": str | None, "status": str,
            "trend_score": float, ...
          }
        }

    Raises:
        ValueError: invalid params (missing product_id / non-existent / FORBIDDEN).
    """
    product_id = params.get("product_id")
    expected_merchant_id = params.get("expected_merchant_id")
    if not isinstance(product_id, str) or not product_id:
        raise ValueError("'product_id' required (UUID string)")
    if not isinstance(expected_merchant_id, str) or not expected_merchant_id:
        raise ValueError("'expected_merchant_id' required (UUID string for ownership check)")

    # Collect updates: only include provided fields (None values are still
    # passed through — caller must omit field entirely to skip it).
    updates: dict[str, Any] = {}
    for field in _UPDATABLE_FIELDS:
        if field in params:
            updates[field] = params[field]

    # Lightweight field-level validation matching create() rules.
    if "title" in updates:
        title = updates["title"]
        if not isinstance(title, str) or not title.strip():
            raise ValueError("'title' must be non-empty string")
        if len(title) > 255:
            raise ValueError("'title' must be ≤ 255 chars")
    if "price" in updates:
        price = updates["price"]
        if not isinstance(price, int) or price < 0:
            raise ValueError("'price' must be non-negative integer (VND)")
    if "stock" in updates:
        stock = updates["stock"]
        if not isinstance(stock, int) or stock < 0:
            raise ValueError("'stock' must be non-negative integer")
    if "attributes" in updates and not isinstance(updates["attributes"], dict):
        raise ValueError("'attributes' must be object")
    if "image_url" in updates:
        iu = updates["image_url"]
        if iu is not None and (not isinstance(iu, str) or len(iu) > 500):
            raise ValueError("'image_url' must be string ≤ 500 chars or null")
    if "brand" in updates:
        br = updates["brand"]
        if br is not None and (not isinstance(br, str) or len(br) > 100):
            raise ValueError("'brand' must be string ≤ 100 chars or null")
    if "status" in updates:
        st = updates["status"]
        if not isinstance(st, str) or st not in ("active", "inactive", "archived"):
            raise ValueError("'status' must be one of: active, inactive, archived")

    # --- Transactional ownership check + UPDATE + outbox event ---
    with tenant_connection(current_tenant()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Defense-in-depth: re-verify ownership inside txn (Gateway already
            # checked but race conditions / future direct-MCP callers might skip).
            cur.execute(
                "SELECT merchant_id::text AS merchant_id FROM products WHERE id = %s",
                (product_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise ValueError(f"NOT_FOUND: product {product_id} does not exist")
            if row["merchant_id"] != expected_merchant_id:
                raise ValueError(
                    f"FORBIDDEN: product {product_id} owned by different merchant"
                )

            # No-op if no fields to update.
            if not updates:
                # Still return current snapshot so caller (Gateway) gets consistent shape.
                cur.execute(
                    """
                    SELECT id::text, merchant_id::text, title, description, category,
                           attributes, price, stock, image_url, brand, status,
                           original_price, trend_score, image_data
                    FROM products WHERE id = %s
                    """,
                    (product_id,),
                )
                snapshot = cur.fetchone() or {}
                _logger.info(
                    "product.update.noop",
                    product_id=product_id,
                    merchant_id=expected_merchant_id,
                )
                return {
                    "product_id": product_id,
                    "updated": False,
                    "event_id": None,
                    "snapshot": _normalize_snapshot(snapshot),
                }

            # Build SET clause dynamically. attributes column needs Jsonb wrap.
            set_fragments: list[str] = []
            values: list[Any] = []
            for field, value in updates.items():
                set_fragments.append(f"{field} = %s")
                if field == "attributes":
                    values.append(Jsonb(value))
                else:
                    values.append(value)
            # Always bump updated_at.
            set_fragments.append("updated_at = now()")
            values.append(product_id)

            cur.execute(
                f"""
                UPDATE products SET {", ".join(set_fragments)}
                WHERE id = %s
                RETURNING id::text, merchant_id::text, title, description, category,
                          attributes, price, stock, image_url, brand, status,
                          original_price, trend_score, image_data
                """,
                tuple(values),
            )
            snapshot = cur.fetchone()
            if snapshot is None:
                # Race: product deleted between SELECT and UPDATE — unlikely
                # but defensive.
                raise ValueError(f"NOT_FOUND: product {product_id} disappeared mid-update")

            # OUTBOX: INSERT events (ProductUpdated) same transaction.
            # Per C-S07-M Option ❸ + C-S07-N: published_at=NULL → S-06 worker picks up.
            cur.execute(
                """
                INSERT INTO events
                  (type, aggregate_type, aggregate_id, user_id, payload, metadata)
                VALUES ('ProductUpdated', 'Product', %s, %s, %s, %s)
                RETURNING id::text AS event_id
                """,
                (
                    product_id,
                    expected_merchant_id,
                    Jsonb({
                        "fields_changed": sorted(updates.keys()),
                        "new_values": {
                            k: (v if not isinstance(v, dict) else v)
                            for k, v in updates.items()
                            if k != "image_data"  # don't bloat event with raw bytes
                        },
                    }),
                    Jsonb({"source": "products.update"}),
                ),
            )
            event_row = cur.fetchone()
            event_id = event_row["event_id"] if event_row else None

            _logger.info(
                "product.update.done",
                product_id=product_id,
                merchant_id=expected_merchant_id,
                fields_changed=sorted(updates.keys()),
                event_id=event_id,
            )

            return {
                "product_id": product_id,
                "updated": True,
                "event_id": event_id,
                "snapshot": _normalize_snapshot(snapshot),
            }


def _normalize_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize DB row → vespa.index compatible product dict.

    Maps DB column names to vespa.index expected keys + handles NULLs.
    """
    if not row:
        return {}
    return {
        "id": row.get("id"),
        "merchant_id": row.get("merchant_id"),
        "title": row.get("title", ""),
        "description": row.get("description") or "",
        "category": row.get("category", ""),
        "attributes": row.get("attributes") or {},
        "price": row.get("price", 0),
        "stock": row.get("stock", 0),
        "image_url": row.get("image_url") or "",
        "brand": row.get("brand") or "",
        "status": row.get("status", "active"),
        "original_price": row.get("original_price"),
        "trend_score": float(row.get("trend_score") or 0.0),
        # image_data NOT included — Vespa schema doesn't index it (only inline
        # storage); keeping it out reduces re-index payload size.
    }


register("products.update", update)

register("products.create", create)
