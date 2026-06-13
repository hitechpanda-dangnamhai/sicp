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

from src.db import current_tenant
from src.observability import get_logger
from src.tools import register
from src.tools.vespa_helpers import inject_tenant_filter, tenant_filter_clause

_logger = get_logger(__name__)
_tracer = trace.get_tracer(__name__)
_propagator = TraceContextTextMapPropagator()

# Default timeout matches sync HTTP MCP architecture (D-S04-14 Q-Sx04-4-1 LAW):
# sub-200ms latency for typical Vespa search; 5s hard ceiling for resilience.
_DEFAULT_TIMEOUT_S = 5.0

# Allowed rank profiles per Vespa schema (product.sd lines 226-254 + image_*).
# S-09 Phiên Sx09-C: ADD `image_recommendation` per C-S09-R Option B parallel
# profile (KEEP image_similarity untouched). Profile exposes summary-features
# closeness(image_embedding) + attribute(trend_score) for sub_scores extraction.
_ALLOWED_RANK_PROFILES = {"baseline", "ai_augmented", "hybrid", "cross_encoder_rerank", "image_recommendation"}


def _vespa_url() -> str:
    """Resolve Vespa search endpoint from env (default docker-compose)."""
    return os.getenv("VESPA_URL", "http://vespa:8080/search/")


def _build_yql(
    query: str, rank_profile: str, limit: int, category_filter: str | None,
    price_min: int | None = None, price_max: int | None = None,
    brand_filter: str | None = None,
    attribute_filter: dict[str, str] | None = None,
    tenant_id: str | None = None,
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

    # Sx07-F-debug Phiên 2026-05-26 — Attribute filter (chip re-search A1).
    # Vespa map<string,string> with struct-field key/value attribute indexing
    # (Session 16 schema) enables: attributes contains sameElement(
    #   key contains "size", value contains "500ml")
    # Multiple attrs combined with AND (each chip click adds clause).
    if attribute_filter:
        for k, v in attribute_filter.items():
            if not k or not v:
                continue
            safe_k = str(k).replace('"', '\\"')
            safe_v = str(v).replace('"', '\\"')
            where_parts.append(
                f'attributes contains sameElement('
                f'key contains "{safe_k}", value contains "{safe_v}"'
                f')'
            )

    where_clause = " and ".join(where_parts)
    yql = f"select * from product where {where_clause} limit {int(limit)}"
    # S-P0-01 T04 — tenant isolation chokepoint (ADR-040 amend iii). MỌI YQL của
    # hybrid_search đi qua đây → inject `and tenant_id contains "<uuid>"`. tenant_id
    # luôn được search() truyền từ current_tenant() (fail-closed); param mặc định
    # None chỉ phục vụ test pure builder không bật được nếu thiếu tenant.
    return inject_tenant_filter(yql, tenant_id) if tenant_id else yql


def _build_request_body(
    query: str, rank_profile: str, limit: int, category_filter: str | None,
    price_min: int | None = None, price_max: int | None = None,
    brand_filter: str | None = None,
    attribute_filter: dict[str, str] | None = None,
    tenant_id: str | None = None,
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
        "yql": _build_yql(query, rank_profile, limit, category_filter, price_min, price_max, brand_filter, attribute_filter, tenant_id),
        "query": query,
        "ranking.profile": rank_profile,
        # Phiên Sx04-7 fix: use default summary class to include all document
        # fields (title, description, price, category, image_url, ...) plus
        # summary-features from rank-profile. Replaces the previous
        # `"presentation.summaryFields": "*"` which was a no-op for the
        # ai_augmented rank-profile.
        "presentation.summary": "default",
        # Sx07-F-debug Phiên 2026-05-27 — Two embedders registered in Vespa
        # (clip_multilingual for vector retrieval + cross_encoder_tokenizer for
        # cross-encoder rerank). Must use EXPLICIT embedder ID syntax with @query
        # — bare `embed(query)` ambiguous between 2 embedders, Vespa errors:
        #   "Multiple embedders are provided but the string to embed is not quoted.
        #    Usage: embed(embedder-id, 'text')."
        # See infra/vespa/services.xml component declarations.
        "input.query(query_embedding)": "embed(clip_multilingual, @query)",
        "input.query(query_tokens)": "embed(cross_encoder_tokenizer, @query)",
        # Cross-encoder ONNX rerank inference ~500-800ms on CPU for 30 docs.
        # Vespa default query timeout 500ms times out at summary fetch step
        # ("No time left to get summaries"). 5s upper bound safe for hackathon
        # scale; production with batched/GPU inference can lower this.
        "timeout": "5s",
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
    attribute_filter: dict[str, str] | None,
    tenant_id: str,
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
        attribute_filter, tenant_id,
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
        if attribute_filter:
            span.set_attribute("vespa.attribute_filter_count", len(attribute_filter))

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

    # Sx07-F-debug Phiên 2026-05-26 — Accept attribute_filter param (chip
    # re-search A1). Dict {key: value} string pairs. Vespa map<string,string>
    # struct-field attribute indexing (Session 16 schema) makes this queryable.
    attribute_filter = params.get("attribute_filter")
    if attribute_filter is not None:
        if not isinstance(attribute_filter, dict):
            raise ValueError("'attribute_filter' must be dict or null")
        for k, v in attribute_filter.items():
            if not isinstance(k, str) or not isinstance(v, str):
                raise ValueError(
                    f"'attribute_filter' keys/values must be str; "
                    f"got key={type(k).__name__} value={type(v).__name__}"
                )

    url = _vespa_url()
    headers = _build_headers()

    # S-P0-01 T04 — resolve active tenant ONCE (fail-closed: raises if rpc() did
    # not set X-Tenant-Id) and thread through every cascade level so each Vespa
    # body carries `and tenant_id contains "<uuid>"`. Cross-tenant rows = 0.
    tenant_id = current_tenant()

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
        attribute_filter_keys=list(attribute_filter.keys()) if attribute_filter else None,
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
        attribute_filter=attribute_filter,
        tenant_id=tenant_id,
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
            attribute_filter=None,            # DROP value filter (Sx07-F)
            tenant_id=tenant_id,              # tenant NEVER dropped (isolation)
            level="retry_drop_value",
        )
        if l2_ok and l2_total > 0:
            items, total = l2_items, l2_total
            if brand_filter:
                degraded_filters.append("brand")
            if price_min is not None or price_max is not None:
                degraded_filters.append("price")
            if attribute_filter:
                degraded_filters.append("attributes")
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
            attribute_filter=None,
            tenant_id=tenant_id,              # tenant NEVER dropped (isolation)
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
            if attribute_filter and "attributes" not in degraded_filters:
                degraded_filters.append("attributes")
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

# =============================================================================
# S-07 T01.C.C6 (Phiên Sx07-D) — APPEND-ONLY block: 3 NEW Vespa MCP tools
# =============================================================================
# Per C-S07-A + C-S07-C Φᶜ″ + D-S04-10 LAW:
#   - vespa.compare_similar — CLIP nearestNeighbor via embed(query) YQL.
#       Runs in enrich phase 2 (PRE-submit, NOT post-submit) per C-S07-C Φᶜ″
#       Move-Compare-Similar-To-Enrich resolution.
#   - vespa.search_trend — category filter, ordered by trend_score DESC.
#   - vespa.index — Document API POST to upsert product after commit_product.
#       Vespa auto-embeds text_embedding from title+description per D-S04-10
#       LAW (indexing expression `embed clip_multilingual` in product.sd
#       line 200). Body OMITS text_embedding (auto-generated).
#       image_embedding NOT fed (S-09 territory per BRIEF Non-goals).
#
# Reference:
#   - slices/S-07_decisions-log.md C-S07-A (vespa.compare_similar/search_trend/index)
#   - slices/S-07_decisions-log.md C-S07-C Φᶜ″ (compare_similar location)
#   - slices/S-04_decisions-log.md D-S04-10 LAW (Vespa native CLIP 512-dim)
#   - infra/vespa/schemas/product.sd lines 199-205 (text_embedding indexing)
#   - infra/vespa/schemas/product.sd lines 226-254 (rank profiles)
#   - docs/03_API_CONTRACTS.md §5 (vespa.* tool specs, amended T01.G)
# =============================================================================


def _vespa_document_url(doc_id: str) -> str:
    """Resolve Vespa Document API endpoint (different from /search/ endpoint).

    Pattern: http://vespa:8080/document/v1/icp/product/docid/{doc_id}
    icp = application namespace, product = doctype, docid path key.
    """
    base = os.getenv("VESPA_DOCUMENT_URL", "http://vespa:8080/document/v1/icp/product/docid")
    return f"{base}/{doc_id}"


# ---------------------------------------------------------------------------
# vespa.compare_similar — CLIP nearestNeighbor
# ---------------------------------------------------------------------------

def compare_similar(params: dict[str, Any]) -> dict[str, Any]:
    """vespa.compare_similar MCP tool — CLIP nearestNeighbor for product fingerprint.

    Per D-S04-10 LAW: uses `embed(@query, clip_multilingual)` YQL to generate
    512-dim query embedding server-side; then nearestNeighbor against indexed
    text_embedding field.

    Per C-S07-C Φᶜ″: runs in enrich phase 2 (PRE-submit, NOT post-submit) to
    show merchant "Sinh dấu vân tay sản phẩm" early in flow.

    Args:
        params: {
          "product": {                  # vision.analyze result (subset)
            "title": str,               # composite query text
            "brand": str | None,        # optional — appended to query
            "size": str | None,         # optional — appended to query
            "category": str | None,     # optional — filter
          },
          "limit": int | None,          # default 10
        }

    Returns:
        {
          "similar_count": int,           # count of similar products found
          "aggregates": {                 # price stats from similar products
            "avg_price": int,
            "price_p25": int,             # 25th percentile
            "price_p75": int              # 75th percentile
          },
          "items": [                      # top-N similar (display-only)
            {id, title, price, match_score, ...},
            ...
          ]
        }
    """
    product = params.get("product")
    if not isinstance(product, dict):
        raise ValueError("'product' param required (object)")

    title = str(product.get("title") or "").strip()
    brand = str(product.get("brand") or "").strip()
    size = str(product.get("size") or "").strip()
    category = product.get("category")

    # Compose query text — title + brand + size (separated by spaces for embedder).
    query_parts = [p for p in (title, brand, size) if p]
    query_text = " ".join(query_parts)
    if not query_text:
        raise ValueError("'product' must contain at least one of: title, brand, size")

    limit = int(params.get("limit") or 10)
    if limit < 1 or limit > 50:
        raise ValueError("'limit' must be in [1, 50]")

    url = _vespa_url()
    headers = _build_headers()

    # YQL nearestNeighbor:
    #   select * from product where (category contains 'X' and)
    #     ({targetHits:10}nearestNeighbor(text_embedding, query_embedding))
    # input.query(query_embedding) = embed(@query, clip_multilingual)
    where_parts: list[str] = []
    if category and isinstance(category, str):
        safe_cat = category.replace('"', '\\"')
        where_parts.append(f'category contains "{safe_cat}"')
    # S-P0-01 T04 — approximate:false: tenant_id filter (inject below) is ALWAYS
    # a structural pre-filter now; HNSW approximate prunes candidates BEFORE the
    # filter → 0-hit combo bug (same root cause as image_nearest_neighbor Sx09-F).
    # Exact search keeps in-tenant recall correct. Corpus small → cost negligible.
    where_parts.append(
        f'({{targetHits:{limit},approximate:false}}nearestNeighbor(text_embedding, query_embedding))'
    )
    yql = f"select * from product where {' and '.join(where_parts)} limit {limit}"
    yql = inject_tenant_filter(yql, current_tenant())  # T04 tenant isolation

    body = {
        "yql": yql,
        "query": query_text,
        # Vespa embedder syntax: input.query(query_embedding) = embed(@query, clip_multilingual)
        "input.query(query_embedding)": "embed(query)",
        "ranking.profile": "ai_augmented",
        "hits": limit,
        "timeout": "3s",
    }

    with _tracer.start_as_current_span("vespa.compare_similar.call") as span:
        span.set_attribute("vespa.yql_len", len(yql))
        span.set_attribute("vespa.query_text", query_text[:80])
        span.set_attribute("vespa.category", category or "")
        try:
            with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
                resp = client.post(url, json=body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            _logger.warning(
                "vespa.compare_similar.http_error",
                error=str(e),
                query_text=query_text,
            )
            span.set_attribute("vespa.status", "http_error")
            # Graceful degrade: return empty result, NOT raise (caller may
            # asyncio.gather with return_exceptions; empty result simpler).
            return {
                "similar_count": 0,
                "aggregates": {"avg_price": 0, "price_p25": 0, "price_p75": 0},
                "items": [],
            }

        root = data.get("root", {})
        children = root.get("children", []) or []
        # Filter to product children (Vespa nests group nodes by default).
        product_hits = [c for c in children if c.get("id", "").startswith("id:icp:product")]
        total = int(root.get("fields", {}).get("totalCount", len(product_hits)))

        # Extract prices for aggregates
        prices: list[int] = []
        items: list[dict[str, Any]] = []
        for hit in product_hits[:limit]:
            fields = hit.get("fields", {})
            price = fields.get("price")
            if isinstance(price, (int, float)) and price > 0:
                prices.append(int(price))
            items.append({
                "id": fields.get("id", ""),
                "title": fields.get("title", ""),
                "price": int(price) if isinstance(price, (int, float)) else 0,
                "brand": fields.get("brand", ""),
                "match_score": float(hit.get("relevance", 0.0)),
            })

        # Aggregates (p25 / p75 simple percentile)
        if prices:
            sorted_prices = sorted(prices)
            n = len(sorted_prices)
            avg_price = sum(sorted_prices) // n
            p25_idx = max(0, n // 4)
            p75_idx = min(n - 1, (3 * n) // 4)
            price_p25 = sorted_prices[p25_idx]
            price_p75 = sorted_prices[p75_idx]
        else:
            avg_price = price_p25 = price_p75 = 0

        result = {
            "similar_count": total,
            "aggregates": {
                "avg_price": avg_price,
                "price_p25": price_p25,
                "price_p75": price_p75,
            },
            "items": items,
        }

        span.set_attribute("vespa.status", "ok")
        span.set_attribute("vespa.similar_count", total)
        _logger.info(
            "vespa.compare_similar.done",
            query_text=query_text,
            category=category,
            similar_count=total,
            avg_price=avg_price,
        )
        return result


# ---------------------------------------------------------------------------
# vespa.search_trend — category-only filter, ordered by trend_score
# ---------------------------------------------------------------------------

def search_trend(params: dict[str, Any]) -> dict[str, Any]:
    """vespa.search_trend MCP tool — category filter + order trend_score DESC.

    Per C-S07-A + 04_INTENT_SPECS Intent 01 enrich phase 3.

    Args:
        params: {
          "category": str,              # required — canonical category
          "limit": int | None,          # default 10, max 50
        }

    Returns:
        {
          "items": [                    # top-N by trend_score DESC
            {id, title, trend_score, price, sold_count, ...},
            ...
          ],
          "aggregates": {
            "window_days": int,         # advisory (always 7 — Vespa trend_score
                                         # is a snapshot, no time window in S-07)
            "top_count": int,
            "avg_trend_score": float
          }
        }
    """
    category = params.get("category")
    if not isinstance(category, str) or not category:
        raise ValueError("'category' param required (non-empty string)")

    limit = int(params.get("limit") or 10)
    if limit < 1 or limit > 50:
        raise ValueError("'limit' must be in [1, 50]")

    url = _vespa_url()
    headers = _build_headers()

    safe_cat = category.replace('"', '\\"')
    yql = (
        f'select * from product where category contains "{safe_cat}" '
        f'order by trend_score desc limit {limit}'
    )
    # T04 tenant isolation — helper chèn clause TRƯỚC `order by` (giữ YQL hợp lệ).
    yql = inject_tenant_filter(yql, current_tenant())
    body = {
        "yql": yql,
        "ranking.profile": "unranked",  # no relevance scoring; pure order_by
        "hits": limit,
        "timeout": "3s",
    }

    with _tracer.start_as_current_span("vespa.search_trend.call") as span:
        span.set_attribute("vespa.category", category)
        try:
            with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
                resp = client.post(url, json=body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            _logger.warning("vespa.search_trend.http_error", error=str(e), category=category)
            span.set_attribute("vespa.status", "http_error")
            return {
                "items": [],
                "aggregates": {"window_days": 7, "top_count": 0, "avg_trend_score": 0.0},
            }

        root = data.get("root", {})
        children = root.get("children", []) or []
        product_hits = [c for c in children if c.get("id", "").startswith("id:icp:product")]

        items: list[dict[str, Any]] = []
        trend_scores: list[float] = []
        for hit in product_hits[:limit]:
            fields = hit.get("fields", {})
            trend = float(fields.get("trend_score") or 0.0)
            trend_scores.append(trend)
            items.append({
                "id": fields.get("id", ""),
                "title": fields.get("title", ""),
                "category": fields.get("category", ""),
                "brand": fields.get("brand", ""),
                "price": int(fields.get("price") or 0),
                "trend_score": trend,
                "sold_count": int(fields.get("sold_count") or 0),
            })

        avg_trend = sum(trend_scores) / len(trend_scores) if trend_scores else 0.0
        result = {
            "items": items,
            "aggregates": {
                "window_days": 7,
                "top_count": len(items),
                "avg_trend_score": round(avg_trend, 4),
            },
        }
        span.set_attribute("vespa.status", "ok")
        span.set_attribute("vespa.top_count", len(items))
        _logger.info(
            "vespa.search_trend.done",
            category=category,
            top_count=len(items),
            avg_trend=avg_trend,
        )
        return result


# ---------------------------------------------------------------------------
# vespa.index — Document API POST (upsert)
# ---------------------------------------------------------------------------

def index(params: dict[str, Any]) -> dict[str, Any]:
    """vespa.index MCP tool — Document API POST to upsert product.

    Per D-S04-10 LAW: Vespa auto-embeds text_embedding from title+description
    via indexing expression `embed clip_multilingual` (product.sd line 200).
    Body OMITS text_embedding entirely.

    Per BRIEF Non-goals: image_embedding NOT fed (S-09 territory).

    Args:
        params: {
          "product": {                  # required — product DTO matching V001 schema
            "id": str,                  # UUID (also used as Vespa docid)
            "merchant_id": str,
            "title": str,
            "description": str | None,
            "category": str,
            "attributes": dict,
            "price": int,
            "stock": int,
            "brand": str | None,
            "image_url": str | None,
            "trend_score": float | None,
            ...
          }
        }

    Returns: {"indexed": bool, "doc_id": str}.
    """
    product = params.get("product")
    if not isinstance(product, dict):
        raise ValueError("'product' param required (object)")

    doc_id = product.get("id")
    if not isinstance(doc_id, str) or not doc_id:
        raise ValueError("'product.id' required (UUID string)")

    # Build Document API payload — flat fields shape per product.sd schema.
    # OMIT text_embedding (auto-generated) + image_embedding (S-09).
    # Coerce attributes to map<string,string> per Vespa schema.
    attrs_raw = product.get("attributes") or {}
    attrs_str = {str(k): str(v) for k, v in attrs_raw.items() if v not in (None, "")}

    fields: dict[str, Any] = {
        "id": doc_id,
        # S-P0-01 T04 — stamp active tenant from request context (fail-closed:
        # raises if X-Tenant-Id absent). New docs are born tenant-scoped; the
        # query helper's `tenant_id contains` filter then isolates them.
        "tenant_id": current_tenant(),
        "merchant_id": str(product.get("merchant_id") or ""),
        "title": str(product.get("title") or ""),
        "description": str(product.get("description") or ""),
        "category": str(product.get("category") or ""),
        "attributes": attrs_str,
        "price": int(product.get("price") or 0),
        "stock": int(product.get("stock") or 0),
        "brand": str(product.get("brand") or ""),
        "image_url": str(product.get("image_url") or ""),
        "trend_score": float(product.get("trend_score") or 0.0),
        "status": str(product.get("status") or "active"),
    }
    # Optional V002 enrichment fields — only include if present (avoid 0-defaults
    # overwriting real data on partial updates).
    for opt_field in ("rating_avg", "rating_count", "sold_count",
                       "image_gradient", "icon_hint", "original_price"):
        if opt_field in product and product[opt_field] is not None:
            fields[opt_field] = product[opt_field]

    payload = {"fields": fields}
    url = _vespa_document_url(doc_id)
    headers = _build_headers()

    with _tracer.start_as_current_span("vespa.index.call") as span:
        span.set_attribute("vespa.doc_id", doc_id)
        span.set_attribute("vespa.title", fields["title"][:80])
        try:
            with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
        except httpx.HTTPError as e:
            _logger.error(
                "vespa.index.http_error",
                error=str(e),
                doc_id=doc_id,
                title=fields["title"],
            )
            span.set_attribute("vespa.status", "http_error")
            # Raise — index failure breaks commit_product transactional outbox
            # invariant (per C-S07-M Option ❸: PG INSERT + events outbox row
            # already committed; Vespa failure leaves outbox unpublished, but
            # caller should know indexing failed so it can rollback or retry).
            raise RuntimeError(f"vespa.index failed for {doc_id}: {e}") from e

        span.set_attribute("vespa.status", "ok")
        _logger.info(
            "vespa.index.done",
            doc_id=doc_id,
            title=fields["title"],
        )
        return {"indexed": True, "doc_id": doc_id}


# ---------------------------------------------------------------------------
# Tenant backfill — Document-API PARTIAL-UPDATE (S-P0-01 T04)
# ---------------------------------------------------------------------------
# Stamp tenant_id lên doc HIỆN HỮU bằng HTTP PUT partial-update — CẤM re-feed
# (POST full doc). Re-feed regenerate text_embedding TỪ title/description và XÓA
# image_embedding (index() bỏ image_description) → mất vector S-09. ADR-036:
# embeddings sống Vespa-only, không reproduce từ PG. `assign` idempotent → re-run
# an toàn. KHÔNG đi qua rpc() (single-tenant fail-closed) — đây là thao tác di trú
# cross-tenant, mỗi doc nhận tenant_id RIÊNG đọc từ products.tenant_id (không blanket).
# Driver: apps/mcp/scripts/backfill_vespa_tenant.py.

def _tenant_partial_update_payload(tenant_id: str) -> dict[str, Any]:
    """Vespa partial-update body — assign tenant_id ONLY (no title/desc/embedding
    → không trigger re-embed, ADR-036). Validate UUID qua tenant_filter_clause."""
    tenant_filter_clause(tenant_id)  # tái dùng UUID guard — raise ValueError nếu rác
    return {"fields": {"tenant_id": {"assign": tenant_id}}}


def partial_update_tenant(doc_id: str, tenant_id: str) -> bool:
    """PUT partial-update stamping tenant_id on an existing Vespa product doc.

    Returns True on success; raises httpx.HTTPError on transport/HTTP failure
    (caller — backfill script — logs + tallies, does not abort batch)."""
    payload = _tenant_partial_update_payload(tenant_id)
    url = _vespa_document_url(doc_id)
    headers = _build_headers()
    with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
        resp = client.put(url, json=payload, headers=headers)
        resp.raise_for_status()
    return True


# ---------------------------------------------------------------------------
# vespa.image_nearest_neighbor — S-09 cross-modal CLIP visual recommendation
# ---------------------------------------------------------------------------
# NEW Phiên Sx09-C per D-S09-NN-A LAW + C-S09-C + C-S09-R Option B.
#
# Uses `image_recommendation` rank profile (ADD this slice per C-S09-R) which
# exposes summary-features:
#   - closeness(field, image_embedding) ∈ [0, 1]  → visual_sim sub-score
#   - attribute(trend_score) raw float            → trending_score sub-score
#
# Query pathway (cross-modal CLIP shared space per D-S09-NN-C LAW):
#   query_desc text → embed(@desc, clip_multilingual) → 512-d query vector
#   nearestNeighbor against indexed image_embedding (also 512-d, derived from
#   image_description via Vespa native indexing-time embed).
#
# AI graph blend_and_rank node (recommend_by_images.py Node 4) consumes
# `sub_scores.visual_sim + sub_scores.trend_score` returned here + attaches
# `collab_count` from analytics.co_purchased per D-S09-NN-A LAW weights:
#   composite = 0.5 * visual_sim + 0.3 * collab_count_norm + 0.2 * trend_score
#
# NO Vespa second-phase composite — would be overwritten by Python blend.

def image_nearest_neighbor(params: dict[str, Any]) -> dict[str, Any]:
    """vespa.image_nearest_neighbor MCP tool — cross-modal CLIP visual recommendation.

    Args:
        params: {
            "query_desc": str,              # required — text describing image
                                            # (built from vision.analyze output:
                                            #  f"{category} {attributes} {ocr_text}")
            "limit": int | None,            # default 30 (top 30 → AI graph picks top 10)
            "category_filter": str | None,  # optional — restrict to same category
        }

    Returns:
        {
            "items": [
                {
                    "id": str,
                    "product_id": str,           # alias for FE
                    "title": str,
                    "category": str,
                    "price": int,
                    "brand": str,
                    "image_url": str | None,
                    "match_score": float,        # first-phase = visual_sim
                    "sub_scores": {
                        "visual_sim": float,     # closeness(field, image_embedding)
                        "trend_score": float,    # attribute(trend_score)
                        # collab_count attached by AI graph from analytics.co_purchased
                    },
                },
                ...
            ],
            "total": int,                        # Vespa totalCount
        }

    Raises:
        ValueError: if 'query_desc' missing/empty or 'limit' out of range.
    """
    query_desc = params.get("query_desc")
    if not isinstance(query_desc, str) or not query_desc.strip():
        raise ValueError("'query_desc' param required (non-empty string)")

    limit = int(params.get("limit") or 30)
    if limit < 1 or limit > 100:
        raise ValueError("'limit' must be in [1, 100]")

    category_filter = params.get("category_filter")

    url = _vespa_url()
    headers = _build_headers()

    # YQL: nearestNeighbor(image_embedding, query_embedding)
    # input.query(query_embedding) = embed(@desc, clip_multilingual)
    where_parts: list[str] = []
    # Patch Phiên Sx09-F Defect 2 final: when category_filter present, use
    # approximate:false for nearestNeighbor — HNSW approximate prune candidates
    # BEFORE structural filter, causing 0-hits combo bug (verified Vespa direct
    # query). Exact search ensures all candidates visible to filter.
    # Trade-off: ~50-100ms slower for 68-product corpus (acceptable).
    # S-P0-01 T04 — approximate:false UNCONDITIONAL now: the injected tenant_id
    # filter is ALWAYS a structural pre-filter, so the Sx09-F combo bug (HNSW
    # prunes before structural filter → 0 hits) applies to EVERY call, not just
    # category-filtered ones. Was conditional on category_filter; widened to keep
    # in-tenant recall correct.
    nn_params = f"targetHits:{limit},approximate:false"
    if category_filter and isinstance(category_filter, str):
        safe_cat = category_filter.replace('"', '\\"')
        where_parts.append(f'category contains "{safe_cat}"')
    where_parts.append(
        f'({{{nn_params}}}nearestNeighbor(image_embedding, query_embedding))'
    )
    yql = f"select * from product where {' and '.join(where_parts)} limit {limit}"
    yql = inject_tenant_filter(yql, current_tenant())  # T04 tenant isolation

    body = {
        "yql": yql,
        "desc": query_desc,
        # Vespa embedder: input.query(query_embedding) = embed(clip_multilingual, @desc)
        # S-09 C-S09-V fix: services.xml has 2 embedders (clip_multilingual +
        # cross_encoder_tokenizer) → MUST use explicit embedder ID syntax.
        "input.query(query_embedding)": "embed(clip_multilingual, @desc)",
        "ranking.profile": "image_recommendation",
        "hits": limit,
        "timeout": "3s",
    }

    with _tracer.start_as_current_span("vespa.image_nearest_neighbor.call") as span:
        span.set_attribute("vespa.yql_len", len(yql))
        span.set_attribute("vespa.query_desc", query_desc[:80])
        span.set_attribute("vespa.category_filter", category_filter or "")
        span.set_attribute("vespa.rank_profile", "image_recommendation")
        try:
            with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
                resp = client.post(url, json=body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as e:
            _logger.warning(
                "vespa.image_nearest_neighbor.http_error",
                error=str(e),
                query_desc=query_desc[:80],
            )
            span.set_attribute("vespa.status", "http_error")
            # Graceful degrade per asyncio.gather return_exceptions pattern
            # (recommend_by_images.py Node 3 uses _safe helper from S-07).
            return {"items": [], "total": 0}

        root = data.get("root", {})
        children = root.get("children", []) or []
        product_hits = [
            c for c in children if c.get("id", "").startswith("id:icp:product")
        ]
        total = int(root.get("fields", {}).get("totalCount", len(product_hits)))

        items: list[dict[str, Any]] = []
        for hit in product_hits[:limit]:
            fields = hit.get("fields", {})
            summary_features = (
                hit.get("summaryfeatures") or hit.get("summary_features") or {}
            )

            # Extract sub-scores from summary-features (image_recommendation profile).
            # Vespa returns feature keys as `closeness(field, image_embedding)` literal.
            visual_sim_raw = (
                summary_features.get("closeness(field,image_embedding)")
                or summary_features.get("closeness(field, image_embedding)")
                or hit.get("relevance", 0.0)
            )
            trend_score_raw = (
                summary_features.get("attribute(trend_score)")
                or fields.get("trend_score", 0.0)
            )

            try:
                visual_sim = float(visual_sim_raw)
            except (TypeError, ValueError):
                visual_sim = 0.0
            try:
                trend_score = float(trend_score_raw)
            except (TypeError, ValueError):
                trend_score = 0.0

            product_id = (
                fields.get("id") or fields.get("doc_id") or hit.get("id", "")
            )
            items.append({
                "id": product_id,
                "product_id": product_id,  # FE alias
                "title": fields.get("title", ""),
                "category": fields.get("category", ""),
                "price": int(fields.get("price", 0)),
                "brand": fields.get("brand", ""),
                "image_url": fields.get("image_url"),
                "image_gradient": fields.get("image_gradient"),
                "match_score": visual_sim,  # first-phase = visual_sim
                "sub_scores": {
                    "visual_sim": visual_sim,
                    "trend_score": trend_score,
                    # collab_count attached downstream by AI graph from
                    # analytics.co_purchased per D-S09-NN-A LAW.
                },
            })

        span.set_attribute("vespa.status", "ok")
        span.set_attribute("vespa.total_hits", total)
        _logger.info(
            "vespa.image_nearest_neighbor.done",
            query_desc=query_desc[:80],
            category_filter=category_filter,
            total=total,
            returned=len(items),
        )
        return {"items": items, "total": total}


# Register at import time per MCP tools registry pattern.
register("vespa.compare_similar", compare_similar)
register("vespa.search_trend", search_trend)
register("vespa.index", index)
register("vespa.image_nearest_neighbor", image_nearest_neighbor)  # S-09 NEW per C-S09-C + D-S09-NN-A LAW
