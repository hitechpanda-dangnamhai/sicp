# =============================================================================
# apps/mcp/src/tools/vespa.py — vespa.hybrid_search tool (S-04 T02 NEW)
# =============================================================================
# S-04 T02 (Phiên Sx04-5) per C-S04-N resolution + D-S04-14 LAW Q-Sx04-4-1
# Sync HTTP MCP architecture.
#
# Was assumed S-02 deliverable per cross-slice docs but verified Phiên Sx04-3
# audit (Q-Sx04-3-1..9) that S-02 only shipped MCP framework + 3 first tools
# (auth.verify_jwt, events.append, products.get). vespa.hybrid_search ships
# here at S-04 T02.
#
# Architecture (D-S04-14 LAW Q-Sx04-4-1 Sync HTTP):
#   - Sync httpx POST → http://vespa:8080/search/ (env VESPA_URL configurable)
#   - YQL build with `embed(@query, clip_multilingual)` per D-S04-10 LAW
#     (Vespa native embedder — AI service writes NO embedding code)
#   - rank_profile param: 'baseline' (Variant A) or 'ai_augmented' (Variant B)
#   - Extract match_score from summary_features.secondPhase (Variant B only,
#     normalized 0-1 per product.sd line 247-249 secondPhase weighted formula)
#   - Return augmented products: {items: [Product+{match_score}], total: int}
#   - Single sync function, clean Tempo trace 2-span (mcp.tool.vespa.hybrid_search
#     parent → httpx HTTP span child)
#
# Vespa schema verified (infra/vespa/schemas/product.sd lines 223-254):
#   - baseline rank-profile: BM25 only, summary-features { bm25(title)
#     bm25(description) }
#   - ai_augmented rank-profile: secondPhase weighted, summary-features
#     { secondPhase bm25(title) closeness(field, text_embedding) }
#   - hybrid inherits ai_augmented (alias)
#
# Container info:
#   - image vespaengine/vespa:8, container_name icp-vespa
#   - hostname vespa in docker-compose network
#   - ports 8080 (search) + 19071 (config)
#   - default env MCP VESPA_URL=http://vespa:8080/search/
#
# Reference:
#   - slices/S-04_decisions-log.md C-S04-N + D-S04-14 LAW Q-Sx04-4-1
#   - docs/03_API_CONTRACTS.md §5 (vespa.hybrid_search T02 implementation spec)
#   - docs/02_DATA_MODEL.md §2 (Vespa rank-profile dual config)
#   - infra/vespa/schemas/product.sd (lines 223-254 rank profiles)
# =============================================================================

from __future__ import annotations

import os
from typing import Any

import httpx
from opentelemetry import trace
from opentelemetry.propagators.textmap import default_setter
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)
_tracer = trace.get_tracer(__name__)
_propagator = TraceContextTextMapPropagator()

# Default timeout matches sync HTTP MCP architecture (D-S04-14 Q-Sx04-4-1 LAW):
# sub-200ms latency for typical Vespa search; 5s hard ceiling for resilience.
_DEFAULT_TIMEOUT_S = 5.0

# Allowed rank profiles per Vespa schema (product.sd lines 226-254).
_ALLOWED_RANK_PROFILES = {"baseline", "ai_augmented", "hybrid"}


def _vespa_url() -> str:
    """Resolve Vespa search endpoint from env (default docker-compose)."""
    return os.getenv("VESPA_URL", "http://vespa:8080/search/")


def _build_yql(
    query: str, rank_profile: str, limit: int, category_filter: str | None,
    price_min: int | None = None, price_max: int | None = None,
    brand_filter: str | None = None
) -> str:
    """Build YQL string with embed(@query, clip_multilingual) per D-S04-10 LAW.

    The `embed()` function inside YQL invokes the Vespa hugging-face-embedder
    component (CLIP-multilingual-512) at query-time inside Vespa container. AI
    service writes NO embedding code (D-S04-10 LAW retracted any `text.embed`
    MCP tool per C-S04-K).

    Variant B (ai_augmented + hybrid):
        - userQuery() against `text` field (BM25)
        - nearestNeighbor(text_embedding, query_embedding) for vector recall
    Variant A (baseline):
        - userQuery() against `text` field (BM25 only — no vector)

    Category filter applied as YQL `where` clause when present.
    """
    # Strict escaping — query goes as parameter @query, not inline.
    where_parts: list[str] = []

    if rank_profile in ("ai_augmented", "hybrid"):
        # Hybrid recall: BM25 OR vector neighbor.
        where_parts.append(
            "(userQuery() or "
            "({targetHits:50}nearestNeighbor(text_embedding, query_embedding)))"
        )
    else:
        # Baseline: BM25 only.
        where_parts.append("userQuery()")

    if category_filter:
        # Inline string literal — category_filter is whitelisted enum elsewhere.
        where_parts.append(f'category contains "{category_filter}"')

    # Phiên Sx04-12 fix — price filter clauses (LLM-extracted from query)
    if price_min is not None:
        where_parts.append(f'price >= {int(price_min)}')
    if price_max is not None:
        where_parts.append(f'price <= {int(price_max)}')

    # Phiên Sx04-12 fix — brand filter clause (LLM-extracted)
    # Vespa data stores brand UPPERCASE (e.g. "TUONG AN", "CAI LAN", "MAGGI")
    # but LLM extracts mixed case ("Tuong An"). Vespa `contains` is case-
    # SENSITIVE on string fields — must uppercase brand to match data.
    # Escape double-quotes to prevent YQL injection.
    if brand_filter:
        safe_brand = brand_filter.upper().replace('"', '\\"')
        where_parts.append(f'brand contains "{safe_brand}"')

    where_clause = " and ".join(where_parts)
    return f"select * from product where {where_clause} limit {int(limit)}"


def _build_request_body(
    query: str, rank_profile: str, limit: int, category_filter: str | None,
    price_min: int | None = None, price_max: int | None = None,
    brand_filter: str | None = None
) -> dict[str, Any]:
    """Build Vespa search request body per Vespa search REST API spec.

    Per D-S04-10 LAW: native CLIP embedder takes @query parameter directly.

    Phiên Sx04-7 fix: original Phiên Sx04-3 emit used
    `"presentation.summaryFields": "*"` which is the WRONG parameter name
    for selecting which document fields Vespa returns. `summaryFields`
    filters columns WITHIN a summary class (paired with summary-features);
    it does NOT switch the summary class itself. With it set to "*" but
    rank-profile `ai_augmented` defining a custom summary class that only
    exposes summary-features, the returned `fields` dict in each hit
    contained ONLY `summaryfeatures` — no `title`, `category`, `price`,
    etc. → `_hit_to_product` defaulted everything to empty string / 0 →
    AI graph downstream filter saw "no valid products" → emitted empty
    `products` SSE event.

    CORRECT parameter: `presentation.summary: "default"` — selects the
    default summary class which Vespa auto-generates to include ALL
    document fields, AND any summary-features defined by the active
    rank-profile (verified empirically Phiên Sx04-7 smoke test).
    """
    body: dict[str, Any] = {
        "yql": _build_yql(query, rank_profile, limit, category_filter, price_min, price_max, brand_filter),
        "query": query,
        "ranking.profile": rank_profile,
        # Phiên Sx04-7 fix: use default summary class to include all document
        # fields (title, description, price, category, image_url, ...) plus
        # summary-features from rank-profile. Replaces the previous
        # `"presentation.summaryFields": "*"` which was a no-op for the
        # ai_augmented rank-profile.
        "presentation.summary": "default",
        # Per D-S04-10 LAW: Vespa native embedder reads @query for CLIP encoding.
        # Embedder mapping: input query=@query → output query_embedding (compiled
        # by Vespa at search-time, not pre-embedded by AI service).
        "input.query(query_embedding)": f'embed(query)',
    }
    return body


def _extract_match_score(hit: dict[str, Any], rank_profile: str) -> float:
    """Extract match_score from Vespa hit per rank-profile.

    For ai_augmented / hybrid: summary_features.secondPhase normalized score
        (per product.sd lines 247-249 secondPhase weighted formula combining
        BM25 + closeness + trend_score).
    For baseline: bm25(title) value (un-normalized; FE renders as relative).

    Returns float in approximately [0.0, 1.0] for ai_augmented.
    """
    summary_features = hit.get("summaryfeatures") or hit.get("summary_features") or {}

    if rank_profile in ("ai_augmented", "hybrid"):
        # Try secondPhase first (the weighted combiner); fallback to relevance.
        score = summary_features.get("secondPhase")
        if score is None:
            score = hit.get("relevance", 0.0)
    else:
        # Baseline: use BM25 title as score signal.
        score = summary_features.get("bm25(title)") or hit.get("relevance", 0.0)

    try:
        return float(score)
    except (TypeError, ValueError):
        return 0.0


def _hit_to_product(hit: dict[str, Any], rank_profile: str) -> dict[str, Any]:
    """Map Vespa hit JSON → Product DTO + match_score augmentation.

    Per 03_API_CONTRACTS §2 (Product DTO) + S-04 T02 augmentation per
    D-S04-14 LAW Sub-decision 3 (match_score and reason allowed in Variant B).

    Vespa hit shape (per Vespa search API):
        {
          "id": "...",
          "relevance": float,
          "fields": {<document fields per product.sd schema>},
          "summaryfeatures": {<requested features>}
        }
    """
    fields = hit.get("fields", {})
    return {
        "id": fields.get("id") or fields.get("doc_id") or hit.get("id", ""),
        # Phiên Sx04-12 fix — product_id alias for FE SearchProductItem.product_id field
        "product_id": fields.get("id") or fields.get("doc_id") or hit.get("id", ""),
        "merchant_id": fields.get("merchant_id", ""),
        "title": fields.get("title", ""),
        # Phiên Sx04-12 fix — `name` alias for FE SearchProductItem.name (FE field naming)
        "name": fields.get("title", ""),
        "description": fields.get("description"),
        "category": fields.get("category", ""),
        "attributes": fields.get("attributes") or {},
        # Phiên Sx04-12 fix — brand top-level for FE SearchProductItem.brand (was strip)
        "brand": fields.get("brand", ""),
        "price": int(fields.get("price", 0)),
        # Phiên Sx04-12 fix — original_price for FE strikethrough rendering
        "original_price": int(fields.get("original_price", 0)) or None,
        "stock": int(fields.get("stock", 0)),
        "image_url": fields.get("image_url"),
        # Phiên Sx04-12 fix — image_gradient + image_icon for FE card visual fields
        "image_gradient": fields.get("image_gradient"),
        "image_icon": fields.get("icon_hint"),
        "trend_score": float(fields.get("trend_score", 0.0)),
        # Phiên Sx04-12 fix — rating + sold_count for FE optional rendering
        "rating": float(fields.get("rating_avg", 0.0)) or None,
        "rating_count": int(fields.get("rating_count", 0)) or None,
        "sold_count": int(fields.get("sold_count", 0)) or None,
        "status": fields.get("status", "active"),
        # S-04 T02 NEW augmentation (D-S04-14 LAW Variant B exception):
        "match_score": _extract_match_score(hit, rank_profile),
        # reason field populated downstream by AI generate_reasons node (per
        # 09_FIELD_AUDIT.md Anti-2 S-04 Variant B exception clause); included
        # here as null placeholder so the response shape is stable for FE.
    }


def _build_headers() -> dict[str, str]:
    """Inject W3C traceparent so Vespa-side OTel auto-instrumentation links
    the parent trace (Tempo 2-span: mcp.tool.vespa.hybrid_search → httpx).
    """
    headers: dict[str, str] = {"content-type": "application/json"}
    _propagator.inject(carrier=headers, setter=default_setter)
    return headers


def _call_vespa_once(
    *,
    query: str,
    rank_profile: str,
    limit: int,
    url: str,
    headers: dict[str, str],
    category_filter: str | None,
    brand_filter: str | None,
    price_min: int | None,
    price_max: int | None,
    level: str,
) -> tuple[list[dict[str, Any]], int, bool]:
    """Execute a single Vespa search call and parse the response.

    Helper for F2 cascading retry pattern (D-S04-X LAW). Called up to 3 times
    by `search()` at different cascade levels with progressively dropped
    filters. Each call creates a nested Tempo span for trace clarity.

    Args:
        query, rank_profile, limit: search params (constant across cascade levels)
        url, headers: pre-built (constant across cascade levels)
        category_filter, brand_filter, price_min, price_max: filters for THIS
            level (caller passes None for any filter dropped at this level)
        level: trace span suffix — one of "primary", "retry_drop_value",
            "retry_drop_all" — for Tempo span naming + log correlation

    Returns:
        (items, total, ok): items list + total count + success bool.
        ok=False signals HTTP error; caller should not cascade further on
        HTTP failure (Vespa is down — retrying same call is pointless).
    """
    body = _build_request_body(
        query, rank_profile, limit,
        category_filter, price_min, price_max, brand_filter,
    )

    span_name = "vespa.hybrid_search" if level == "primary" else f"vespa.hybrid_search.{level}"
    with _tracer.start_as_current_span(span_name) as span:
        span.set_attribute("vespa.url", url)
        span.set_attribute("vespa.rank_profile", rank_profile)
        span.set_attribute("vespa.limit", limit)
        span.set_attribute("vespa.cascade_level", level)
        if category_filter:
            span.set_attribute("vespa.category_filter", category_filter)
        if brand_filter:
            span.set_attribute("vespa.brand_filter", brand_filter)
        if price_min is not None:
            span.set_attribute("vespa.price_min", price_min)
        if price_max is not None:
            span.set_attribute("vespa.price_max", price_max)

        try:
            with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
                resp = client.post(url, json=body, headers=headers)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.HTTPError as e:
            _logger.error(
                "vespa.search.http_error",
                level=level,
                error=str(e),
            )
            span.record_exception(e)
            span.set_attribute("vespa.status", "http_error")
            return [], 0, False

        # Parse Vespa response shape (same logic as original search()).
        root = payload.get("root", {})
        children = root.get("children", []) or []
        hits = [
            c for c in children
            if c.get("id", "").startswith("id:") or "fields" in c
        ]
        if not hits:
            for c in children:
                if isinstance(c.get("children"), list):
                    hits.extend(c["children"])

        items = [_hit_to_product(h, rank_profile) for h in hits]
        total = int(root.get("fields", {}).get("totalCount", len(items)))

        span.set_attribute("vespa.result_count", len(items))
        span.set_attribute("vespa.total_count", total)
        span.set_attribute("vespa.status", "ok")

        return items, total, True


def search(params: dict[str, Any]) -> dict[str, Any]:
    """vespa.hybrid_search MCP tool handler.

    Per JSON-RPC 2.0 MCP framework (apps/mcp/src/tools/__init__.py register
    pattern): sync function, raises ValueError on bad params (mapped to JSON-RPC
    invalid_params), any other exception → JSON-RPC internal_error.

    Params:
        query:             str (required) — user search text
        rank_profile:      str (required) — 'baseline' | 'ai_augmented' | 'hybrid'
        limit:             int = 8       — max hits to return
        category_filter:   str | None    — optional category enum filter

    Returns:
        {items: List[Product+{match_score}], total: int}
    """
    # Param validation (strict — JSON-RPC invalid_params on miss).
    query = params.get("query")
    if not isinstance(query, str) or not query.strip():
        raise ValueError("'query' must be a non-empty string")

    rank_profile = params.get("rank_profile", "ai_augmented")
    if rank_profile not in _ALLOWED_RANK_PROFILES:
        raise ValueError(
            f"'rank_profile' must be one of {sorted(_ALLOWED_RANK_PROFILES)}; got {rank_profile!r}"
        )

    limit_raw = params.get("limit", 8)
    try:
        limit = int(limit_raw)
    except (TypeError, ValueError) as e:
        raise ValueError(f"'limit' must be int; got {limit_raw!r}") from e
    if limit <= 0 or limit > 100:
        raise ValueError(f"'limit' must be in (0, 100]; got {limit}")

    category_filter = params.get("category_filter")
    if category_filter is not None and not isinstance(category_filter, str):
        raise ValueError("'category_filter' must be string or null")

    # Phiên Sx04-12 fix — accept brand_filter param (LLM-extracted from query)
    brand_filter = params.get("brand_filter")
    if brand_filter is not None and not isinstance(brand_filter, str):
        raise ValueError("'brand_filter' must be string or null")

    # Phiên Sx04-12 fix — accept price_min / price_max for query-based filtering
    price_min = params.get("price_min")
    if price_min is not None:
        try:
            price_min = int(price_min)
            if price_min < 0:
                raise ValueError("'price_min' must be >= 0")
        except (TypeError, ValueError) as e:
            raise ValueError(f"'price_min' must be int or null; got {params.get('price_min')!r}") from e
    price_max = params.get("price_max")
    if price_max is not None:
        try:
            price_max = int(price_max)
            if price_max < 0:
                raise ValueError("'price_max' must be >= 0")
        except (TypeError, ValueError) as e:
            raise ValueError(f"'price_max' must be int or null; got {params.get('price_max')!r}") from e

    url = _vespa_url()
    headers = _build_headers()

    # Phiên Sx04-X fix: log all filters (was missing brand/price/limit).
    _logger.info(
        "vespa.search.request",
        query=query,
        rank_profile=rank_profile,
        limit=limit,
        category_filter=category_filter,
        brand_filter=brand_filter,
        price_min=price_min,
        price_max=price_max,
    )

    # ========================================================================
    # F2 Cascading Retry Architecture (D-S04-X LAW).
    # ========================================================================
    # Rationale: LLM `parse_filters` extracts filters that may not match the
    # data — most commonly brand (e.g. "Tam Thái Tử" is a Chin-Su product line
    # name, NOT a brand) but occasionally also category or price. A hard AND
    # filter clause yields 0 hits despite title BM25 matching.
    #
    # Cascade levels (each progressively drops more filters):
    #   L1 primary:           query + ALL filters (category + brand + price)
    #   L2 retry_drop_value:  query + category;  DROP brand + price
    #   L3 retry_drop_all:    query only;        DROP all filters
    #
    # Trigger logic:
    #   - L1 always runs.
    #   - L2 runs IFF total_L1 == 0 AND (brand or price filter present).
    #   - L3 runs IFF total still 0 after L1/L2 AND category filter present.
    #
    # Returns `degraded_filters: list[str]` listing dropped filter categories
    # — caller (S-04/S-07/S-08 AI graph) can decide UX (warn user, modify
    # understanding text, log telemetry). Empty list = happy path no degrade.
    # Field is ADDITIVE — caller that ignores it remains backward-compatible.
    #
    # Forward-compat: S-07 image import + S-08 voice buy reuse THIS tool with
    # the same cascade contract. Each slice decides its own UX based on
    # `degraded_filters` content.
    # ========================================================================

    # ---- LEVEL 1: primary search with ALL filters ----
    items, total, ok = _call_vespa_once(
        query=query,
        rank_profile=rank_profile,
        limit=limit,
        url=url,
        headers=headers,
        category_filter=category_filter,
        brand_filter=brand_filter,
        price_min=price_min,
        price_max=price_max,
        level="primary",
    )
    if not ok:
        # HTTP error in primary — Vespa down; retrying same call won't help.
        raise RuntimeError("Vespa search failed at primary level")

    degraded_filters: list[str] = []

    has_value_filters = bool(
        brand_filter or price_min is not None or price_max is not None
    )

    # ---- LEVEL 2: drop value filters (brand, price), KEEP category ----
    if total == 0 and has_value_filters:
        _logger.warning(
            "vespa.search.retry_drop_value_filters",
            query=query,
            rank_profile=rank_profile,
            kept_category=category_filter,
            dropped_brand=brand_filter,
            dropped_price_min=price_min,
            dropped_price_max=price_max,
        )
        l2_items, l2_total, l2_ok = _call_vespa_once(
            query=query,
            rank_profile=rank_profile,
            limit=limit,
            url=url,
            headers=headers,
            category_filter=category_filter,  # KEEP structural filter
            brand_filter=None,                # DROP value filter
            price_min=None,                   # DROP value filter
            price_max=None,                   # DROP value filter
            level="retry_drop_value",
        )
        if l2_ok and l2_total > 0:
            items, total = l2_items, l2_total
            if brand_filter:
                degraded_filters.append("brand")
            if price_min is not None or price_max is not None:
                degraded_filters.append("price")
            _logger.info(
                "vespa.search.retry_drop_value_response",
                query=query,
                result_count=len(items),
                total_count=total,
                degraded_filters=degraded_filters,
            )

    # ---- LEVEL 3: drop ALL filters (last-resort fallback) ----
    if total == 0 and category_filter:
        _logger.warning(
            "vespa.search.retry_drop_all_filters",
            query=query,
            rank_profile=rank_profile,
            dropped_category=category_filter,
            dropped_brand=brand_filter,
            dropped_price_min=price_min,
            dropped_price_max=price_max,
        )
        l3_items, l3_total, l3_ok = _call_vespa_once(
            query=query,
            rank_profile=rank_profile,
            limit=limit,
            url=url,
            headers=headers,
            category_filter=None,
            brand_filter=None,
            price_min=None,
            price_max=None,
            level="retry_drop_all",
        )
        if l3_ok and l3_total > 0:
            items, total = l3_items, l3_total
            # Mark category as dropped (additive — brand/price may already be in list)
            if "category" not in degraded_filters:
                degraded_filters.append("category")
            if brand_filter and "brand" not in degraded_filters:
                degraded_filters.append("brand")
            if (price_min is not None or price_max is not None) and "price" not in degraded_filters:
                degraded_filters.append("price")
            _logger.info(
                "vespa.search.retry_drop_all_response",
                query=query,
                result_count=len(items),
                total_count=total,
                degraded_filters=degraded_filters,
            )

    # ---- Final response logging ----
    _logger.info(
        "vespa.search.response",
        query=query,
        rank_profile=rank_profile,
        result_count=len(items),
        total_count=total,
        degraded_filters=degraded_filters,
    )

    return {
        "items": items,
        "total": total,
        # NEW field per F2 LAW — list of filter categories dropped during
        # cascade. Empty list = happy path. Caller can ignore safely.
        "degraded_filters": degraded_filters,
    }


# Register at import time per MCP tools registry pattern (see
# apps/mcp/src/tools/__init__.py register()).
register("vespa.hybrid_search", search)
