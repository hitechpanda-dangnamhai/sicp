# =============================================================================
# apps/mcp/src/tools/vision.py — vision.analyze tool (S-07 T01 NEW)
# =============================================================================
# S-07 T01.C.C1 (Phiên Sx07-D) — Gemini 2.5 Flash multimodal image analysis
# for Intent 01 import-by-image flow.
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
#   { category, attributes, ocr_text, confidence,
#     confidence_per_field, alternatives }
#
# Reference:
#   - slices/S-07_decisions-log.md C-S07-L + C-S07-J
#   - docs/03_API_CONTRACTS.md §5 vision.analyze
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

CANONICAL_CATEGORIES = (
    "nuoc_tuong", "tuong_ot", "dau_an", "mi_tom", "gia_vi", "sua",
    "banh_keo", "nuoc_giai_khat", "do_dong_hop", "gao", "banh_mi",
)


# ---------------------------------------------------------------------------
# Prompt template — note all literal {...} are escaped as {{...}} so that
# str.format(categories=...) only substitutes the single {categories}
# placeholder. The JSON schema example uses doubled braces.
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


register("vision.analyze", analyze)
