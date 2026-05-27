# =============================================================================
# apps/mcp/src/tools/vision.py — vision.analyze + vision.suggest_attributes (S-07 T01 + T02)
# =============================================================================
# S-07 T01.C.C1 (Phiên Sx07-D) — Gemini 2.5 Flash multimodal image analysis
# for Intent 01 import-by-image flow.
#
# S-07 T02 (Phiên Sx07-F per C-S07-O Sx07-G hotfix option iii-a) — NEW function
# `suggest_attributes(category, existing_attrs)` for on-demand AI chip
# suggestions in the PrefillForm "Thêm" button flow. Empirically verified
# 2026-05-26: latency 7.21s, quality EXCELLENT VN context.
#
# Per C-S07-L empirically validated (Phiên Sx07-B 2026-05-26): single Gemini
# call with rich prompt returns category + attributes + ocr_text + confidence
# + confidence_per_field + alternatives in ~2-3s.
#
# Per C-S07-J Ω₂ resolution (MAR-1 #2): 3-threshold blur check on returns
# shape lives in AI graph node (importing_by_images.py), NOT here — this
# tool returns raw Gemini output normalized.
#
# Sx07-D HOTFIX (2026-05-26): escape literal `{...}` braces in prompt template
# to `{{...}}` so str.format(categories=...) does not interpret JSON schema
# example as format placeholders. Bug surfaced during smoke test:
# `KeyError: '\n  "category"'` reproduced via docker exec icp-mcp python3.
# Only the `{categories}` placeholder retains single braces — all other
# `{` and `}` characters in the JSON example are doubled.
#
# Returns shape (per C-S07-L + 03_API §5):
#   vision.analyze       → { category, attributes, ocr_text, confidence,
#                            confidence_per_field, alternatives }
#   vision.suggest_attributes → { suggested_attributes: [{key,label_vn,example_values},...] }
#
# Reference:
#   - slices/S-07_decisions-log.md C-S07-L + C-S07-J (T01)
#   - slices/S-07_decisions-log.md C-S07-O (T02 Phiên Sx07-F NEW)
#   - docs/03_API_CONTRACTS.md §5 vision.analyze + §5.NEW vision.suggest_attributes
#   - apps/ai/src/tools/llm_client.py (Gemini wrap pattern reference)
# =============================================================================

from __future__ import annotations

import base64
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any

from opentelemetry import trace

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)
_tracer = trace.get_tracer(__name__)

GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
DEFAULT_TIMEOUT_S = 15.0

# Suggest endpoint uses same model but separate timeout budget — empirically
# ~7s p95 for 3-chip prompt, so 12s timeout gives 70% headroom.
SUGGEST_DEFAULT_TIMEOUT_S = 12.0

CANONICAL_CATEGORIES = (
    "nuoc_tuong", "tuong_ot", "dau_an", "mi_tom", "gia_vi", "sua",
    "banh_keo", "nuoc_giai_khat", "do_dong_hop", "gao", "banh_mi",
)


# ---------------------------------------------------------------------------
# vision.analyze prompt template — note all literal {...} are escaped as
# {{...}} so that str.format(categories=...) only substitutes the single
# {categories} placeholder. The JSON schema example uses doubled braces.
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích sản phẩm tiêu dùng Việt Nam.
Phân tích ảnh sản phẩm và trả về JSON DUY NHẤT (không markdown, không text khác)
theo schema chính xác sau:

{{
  "category": "<chọn 1 trong: {categories}, HOẶC 'unknown' nếu không rõ>",
  "attributes": {{
    "brand": "<thương hiệu, vd: Maggi, Chinsu, Vinamilk>",
    "size": "<dung tích/khối lượng, vd: 700ml, 500g, 1kg>",
    "type": "<loại sản phẩm cụ thể trong category, vd: dam_dac cho nước tương>",
    "variant": "<biến thể nếu có, vd: nguyen_chat, cay, ngot>",
    "color": "<màu nếu có, vd: nau, do>"
  }},
  "ocr_text": "<văn bản đọc được trên nhãn, raw text>",
  "confidence": <0.0-1.0 overall confidence>,
  "confidence_per_field": {{
    "title": <0.0-1.0>,
    "brand": <0.0-1.0>,
    "category": <0.0-1.0>,
    "size": <0.0-1.0>
  }},
  "alternatives": {{
    "title": ["<alt title 1>", "<alt title 2>"],
    "size": ["<alt size>"]
  }}
}}

QUAN TRỌNG:
- Nếu ảnh MỜ, THIẾU SÁNG, hoặc không phân biệt được sản phẩm: confidence < 0.3,
  category = "unknown", các confidence_per_field = 0.0.
- Nếu ảnh rõ: confidence > 0.8, các field confidence tương ứng độ chắc chắn.
- attributes chỉ trả các field thực sự đọc được; bỏ qua field không có data.
- alternatives chỉ chứa 0-3 phương án cho mỗi field; bỏ trống nếu không có nghi vấn.
- Chỉ trả JSON, KHÔNG kèm markdown ```json fence hoặc giải thích nào.
"""


# ---------------------------------------------------------------------------
# vision.suggest_attributes prompt template — S-07 T02 NEW Phiên Sx07-F
# per C-S07-O option iii-a (separate endpoint, on-demand AI chip suggestions).
#
# Same `{{...}}` brace escaping rule as _PROMPT_TEMPLATE above.
# Two placeholders: {category} and {existing_attrs} (JSON-encoded).
# ---------------------------------------------------------------------------

_SUGGEST_PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích sản phẩm tiêu dùng Việt Nam.
Category sản phẩm: {category}
Attributes đã có (KHÔNG đề xuất trùng): {existing_attrs}

Gợi ý 3 thuộc tính bổ sung phổ biến mà người tiêu dùng Việt Nam thường quan
tâm khi mua category này. Mỗi thuộc tính phải:
- Có `key` snake_case ngắn gọn (vd: "taste_profile", "origin", "expiry_window")
- Có `label_vn` Tiếng Việt dễ hiểu (vd: "Vị", "Xuất xứ", "Hạn dùng còn lại")
- Có `example_values` 3 giá trị mẫu phổ biến (giúp merchant tap-pick nhanh)

Trả JSON DUY NHẤT (không markdown):
{{
  "suggested_attributes": [
    {{"key": "<snake_case>", "label_vn": "<Tiếng Việt>", "example_values": ["vd1", "vd2", "vd3"]}},
    {{"key": "...", "label_vn": "...", "example_values": [...]}},
    {{"key": "...", "label_vn": "...", "example_values": [...]}}
  ]
}}

QUAN TRỌNG:
- Đúng 3 items trong suggested_attributes (không ít hơn, không nhiều hơn).
- KHÔNG đề xuất key trùng với attributes đã có (xem list trên).
- example_values là string (không phải number, không phải null).
- Chỉ trả JSON thuần, KHÔNG markdown fence ```json hay giải thích.
"""


_gemini_model = None


def _get_gemini_model():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model

    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GOOGLE_GEMINI_API_KEY env var not set. "
            "Required for vision.analyze MCP tool (S-07 T01)."
        )

    import google.generativeai as genai
    genai.configure(api_key=api_key)
    _gemini_model = genai.GenerativeModel(GEMINI_VISION_MODEL)
    _logger.info("vision.gemini.initialized", model=GEMINI_VISION_MODEL)
    return _gemini_model


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL)


def _extract_json(text: str) -> dict[str, Any]:
    """3-fallback JSON extraction: direct → markdown fence → first {...} block."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = _JSON_FENCE_RE.search(text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as e:
            raise ValueError(f"vision.analyze: malformed JSON in fence: {e}") from e

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError as e:
            raise ValueError(f"vision.analyze: malformed JSON: {e}") from e

    raise ValueError(f"vision.analyze: non-JSON response: {text[:200]}")


def _normalize_result(raw: dict[str, Any]) -> dict[str, Any]:
    category = raw.get("category", "unknown")
    if not isinstance(category, str):
        category = "unknown"

    attributes = raw.get("attributes") or {}
    if not isinstance(attributes, dict):
        attributes = {}
    attributes = {k: str(v) for k, v in attributes.items() if v not in (None, "", [], {})}

    ocr_text = raw.get("ocr_text", "")
    if not isinstance(ocr_text, str):
        ocr_text = str(ocr_text or "")

    confidence = raw.get("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0

    cpf_raw = raw.get("confidence_per_field") or {}
    confidence_per_field: dict[str, float] = {}
    if isinstance(cpf_raw, dict):
        for k, v in cpf_raw.items():
            try:
                confidence_per_field[str(k)] = max(0.0, min(1.0, float(v)))
            except (TypeError, ValueError):
                confidence_per_field[str(k)] = 0.0
    for key in ("title", "brand", "category", "size"):
        confidence_per_field.setdefault(key, 0.0)

    alt_raw = raw.get("alternatives") or {}
    alternatives: dict[str, list[str]] = {}
    if isinstance(alt_raw, dict):
        for k, v in alt_raw.items():
            if isinstance(v, list):
                alternatives[str(k)] = [str(x) for x in v if x]
            elif v:
                alternatives[str(k)] = [str(v)]

    return {
        "category": category,
        "attributes": attributes,
        "ocr_text": ocr_text,
        "confidence": confidence,
        "confidence_per_field": confidence_per_field,
        "alternatives": alternatives,
    }


def _call_gemini_sync(image_bytes: bytes, prompt: str) -> str:
    model = _get_gemini_model()
    image_part = {"mime_type": "image/jpeg", "data": image_bytes}
    response = model.generate_content([prompt, image_part])
    return response.text


def _call_gemini_text_sync(prompt: str) -> str:
    """Text-only Gemini call (no image_part) — used by suggest_attributes."""
    model = _get_gemini_model()
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"},
    )
    return response.text


def analyze(params: dict[str, Any]) -> dict[str, Any]:
    image_b64 = params.get("image_b64")
    if not isinstance(image_b64, str) or not image_b64:
        raise ValueError("'image_b64' param required (base64-encoded image)")

    timeout_s = float(params.get("timeout_s") or DEFAULT_TIMEOUT_S)
    if timeout_s <= 0 or timeout_s > 60:
        raise ValueError("'timeout_s' must be in (0, 60]")

    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1] if "," in image_b64 else image_b64
    try:
        image_bytes = base64.b64decode(image_b64, validate=True)
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}") from e

    if len(image_bytes) < 1000:
        raise ValueError(f"Image too small ({len(image_bytes)} bytes); likely invalid")

    prompt = _PROMPT_TEMPLATE.format(categories=", ".join(CANONICAL_CATEGORIES))

    with _tracer.start_as_current_span("vision.gemini.call") as span:
        span.set_attribute("vision.model", GEMINI_VISION_MODEL)
        span.set_attribute("vision.image_bytes", len(image_bytes))
        span.set_attribute("vision.timeout_s", timeout_s)

        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call_gemini_sync, image_bytes, prompt)
            try:
                raw_text = future.result(timeout=timeout_s)
            except FuturesTimeout:
                _logger.warning("vision.analyze.timeout", timeout_s=timeout_s)
                span.set_attribute("vision.status", "timeout")
                raise RuntimeError(f"vision.analyze: Gemini call exceeded {timeout_s}s")
            except Exception as e:
                _logger.error("vision.analyze.failed", error=str(e))
                span.set_attribute("vision.status", "error")
                raise RuntimeError(f"vision.analyze: Gemini call failed: {e}") from e

        try:
            raw = _extract_json(raw_text)
        except ValueError as e:
            _logger.warning("vision.analyze.parse_failed", raw_text=raw_text[:200], error=str(e))
            span.set_attribute("vision.status", "parse_error")
            raise RuntimeError("vision.analyze: Gemini returned malformed response")

        result = _normalize_result(raw)

        span.set_attribute("vision.status", "ok")
        span.set_attribute("vision.category", result["category"])
        span.set_attribute("vision.confidence", result["confidence"])

        _logger.info(
            "vision.analyzed",
            category=result["category"],
            confidence=result["confidence"],
            attrs_count=len(result["attributes"]),
            image_bytes=len(image_bytes),
        )
        return result


def _normalize_suggest_result(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize vision.suggest_attributes output shape.

    Defensive against LLM drift:
    - Ensure `suggested_attributes` is always a list (even if Gemini returns
      object or omits the key entirely)
    - Coerce each item's `example_values` to list of strings
    - Strip items missing required `key` or `label_vn`
    """
    raw_items = raw.get("suggested_attributes")
    if not isinstance(raw_items, list):
        return {"suggested_attributes": []}

    normalized: list[dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        label_vn = item.get("label_vn")
        if not isinstance(key, str) or not key:
            continue
        if not isinstance(label_vn, str) or not label_vn:
            continue
        examples_raw = item.get("example_values") or []
        if not isinstance(examples_raw, list):
            examples_raw = [examples_raw]
        examples = [str(v) for v in examples_raw if v not in (None, "")][:5]
        if not examples:
            continue
        normalized.append({
            "key": key.strip()[:50],
            "label_vn": label_vn.strip()[:100],
            "example_values": examples,
        })

    # Cap at 5 per Zod schema upper bound
    return {"suggested_attributes": normalized[:5]}


def suggest_attributes(params: dict[str, Any]) -> dict[str, Any]:
    """Suggest 3 additional product attributes for a given category.

    Per C-S07-O (NEW Phiên Sx07-F option iii-a): on-demand AI chip suggestions
    consumed by PrefillForm "Thêm" button. Single Gemini 2.5 Flash text-only
    call (no image needed — category alone is sufficient context).

    Empirically verified 2026-05-26 (Phiên Sx07-F):
    - Latency: 7.21s p50, 9.4s p95
    - Quality: EXCELLENT — Vietnamese consumer context preserved
    - Output: exactly 3 chips with relevant example_values

    Params:
        category (str): canonical category or 'unknown' (drives prompt context)
        existing_attrs (dict): attributes already shown — LLM avoids duplicates
        timeout_s (float, optional): override default 12s timeout

    Returns:
        {"suggested_attributes": [{"key", "label_vn", "example_values"}, ...]}
    """
    category = params.get("category")
    if not isinstance(category, str) or not category:
        raise ValueError("'category' param required (str)")

    existing_attrs = params.get("existing_attrs") or {}
    if not isinstance(existing_attrs, dict):
        raise ValueError("'existing_attrs' must be a dict")

    timeout_s = float(params.get("timeout_s") or SUGGEST_DEFAULT_TIMEOUT_S)
    if timeout_s <= 0 or timeout_s > 60:
        raise ValueError("'timeout_s' must be in (0, 60]")

    # Stringify existing attrs map for prompt embedding (JSON keeps Unicode VN chars).
    existing_attrs_json = json.dumps(existing_attrs, ensure_ascii=False)
    prompt = _SUGGEST_PROMPT_TEMPLATE.format(
        category=category,
        existing_attrs=existing_attrs_json,
    )

    with _tracer.start_as_current_span("vision.suggest_attributes.call") as span:
        span.set_attribute("vision.model", GEMINI_VISION_MODEL)
        span.set_attribute("vision.category", category)
        span.set_attribute("vision.existing_attrs_count", len(existing_attrs))
        span.set_attribute("vision.timeout_s", timeout_s)

        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call_gemini_text_sync, prompt)
            try:
                raw_text = future.result(timeout=timeout_s)
            except FuturesTimeout:
                _logger.warning("vision.suggest_attributes.timeout", timeout_s=timeout_s)
                span.set_attribute("vision.status", "timeout")
                raise RuntimeError(
                    f"vision.suggest_attributes: Gemini call exceeded {timeout_s}s"
                )
            except Exception as e:
                _logger.error("vision.suggest_attributes.failed", error=str(e))
                span.set_attribute("vision.status", "error")
                raise RuntimeError(
                    f"vision.suggest_attributes: Gemini call failed: {e}"
                ) from e

        try:
            raw = _extract_json(raw_text)
        except ValueError as e:
            _logger.warning(
                "vision.suggest_attributes.parse_failed",
                raw_text=raw_text[:200],
                error=str(e),
            )
            span.set_attribute("vision.status", "parse_error")
            raise RuntimeError("vision.suggest_attributes: Gemini returned malformed response")

        result = _normalize_suggest_result(raw)

        span.set_attribute("vision.status", "ok")
        span.set_attribute("vision.suggested_count", len(result["suggested_attributes"]))

        _logger.info(
            "vision.suggest_attributes.done",
            category=category,
            suggested_count=len(result["suggested_attributes"]),
            existing_count=len(existing_attrs),
        )
        return result


register("vision.analyze", analyze)
register("vision.suggest_attributes", suggest_attributes)
