# =============================================================================
# apps/mcp/src/tools/speech.py — speech.transcribe (S-08 T01.A)
# =============================================================================
# S-08 T01.A (Phiên Sx08-D) — Gemini 2.5 Flash audio input for Intent 02
# voice buy flow. Clone-source vision.py SDK + ThreadPoolExecutor pattern
# (S-07 T01.C.C1 precedent) — Gemini SDK exposes sync `generate_content`;
# we wrap in ThreadPoolExecutor + future.result(timeout=) for canonical
# timeout enforcement (per Confusion Warning #2 Phiên Sx08-C handoff
# Section 2.4 — `generate_content_async` exists but is NOT used here).
#
# Per D-S08-NN-03 LAW: model = gemini-2.5-flash (NOT 1.5, NOT 2.0); audio
# input as inline Part {mime_type, data}; non-streaming (single response
# .text); confidence MAY be None per R-S08-1 (Gemini audio API does not
# always surface confidence — FE handles null gracefully, does NOT block
# state-B/C UI rendering).
#
# Per D-S08-NN-11 LAW: 4 error codes documented JSDoc-only in
# packages/shared-types/src/dto/error.dto.ts (NO new Zod enum, S-07
# E_VISION_BLUR precedent). This module raises RuntimeError with the
# code as message prefix; the AI graph node `_node_speech_transcribe`
# (buying_by_voices.py) catches RuntimeError and surfaces the code via
# the error.dto.ts ErrorResponse envelope.
#
# Returns shape (per S-08-T01_Sx08-C_SESSION_HANDOFF.md Section 2.2):
#   speech.transcribe → { text, confidence:null|float, duration_ms:int,
#                         language:str }
#
# Reference:
#   - slices/S-08_decisions-log.md D-S08-NN-03 (Gemini 2.5 Flash audio)
#   - slices/S-08_decisions-log.md D-S08-NN-11 (4 voice error codes JSDoc)
#   - apps/mcp/src/tools/vision.py L147-166 + L248-252 + L265-324 + L453
#     (clone-source SDK lazy-init + sync wrap + ThreadPoolExecutor +
#     register pattern — verified 1:1 Phiên Sx08-C source-audit)
#   - docs/03_API_CONTRACTS.md §5 (speech.transcribe spec post-T01.I
#     reconcile)
# =============================================================================

from __future__ import annotations

import base64
import os
from typing import Any

from opentelemetry import trace

from src.observability import get_logger
from src.tools import register

_logger = get_logger(__name__)
_tracer = trace.get_tracer(__name__)

# D-S08-NN-12 LAW (Phien Sx08-D4): speech STT migrated Gemini -> OpenAI.
# GEMINI_SPEECH_MODEL kept ONLY for backward-compat / log continuity; the
# transcribe path no longer calls Gemini (vision.py still uses Gemini).
GEMINI_SPEECH_MODEL = os.getenv("GEMINI_SPEECH_MODEL", "gemini-2.5-flash")
OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "gpt-4o-transcribe")
OPENAI_TTS_MODEL = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
OPENAI_TTS_VOICE = os.getenv("OPENAI_TTS_VOICE", "alloy")
DEFAULT_TIMEOUT_S = 15.0
DEFAULT_TTS_TIMEOUT_S = 20.0

_openai_client = None


def _get_openai_client(timeout_s: float):
    """Lazy-init OpenAI client with a NATIVE transport timeout + no retries.

    D-S08-NN-12: this is the fix for the Gemini hang -- OpenAI aborts the
    HTTP request at the transport layer, so the call can never block past
    timeout_s. Re-created when timeout differs so STT/TTS budgets differ.
    """
    global _openai_client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY env var not set. Required for speech.* MCP "
            "tools (D-S08-NN-12/13 OpenAI STT+TTS)."
        )
    from openai import OpenAI
    return OpenAI(api_key=api_key, timeout=timeout_s, max_retries=0)

# Below this byte size, audio is almost certainly silence / no real speech.
# Empirically: 16kbps webm at 0.5s ≈ 1000 bytes; we set MIN at 100 to catch
# edge cases (truncated upload, zero-length recording) and raise E_NO_SPEECH
# fast without burning a Gemini call.
MIN_AUDIO_BYTES = 100

# Approximate bytes-per-second for typical browser MediaRecorder webm/opus
# output (≈16 kbps audio-only). Used for cosmetic duration_ms estimation
# only — Gemini API does not return real audio duration. FE displays this
# as a soft hint; it does NOT drive any business logic.
_BYTES_PER_SECOND_ESTIMATE = 2000

# Accepted MIME types — kept permissive because browser MediaRecorder
# fallback chains vary (Chrome → webm, Safari → mp4, older Android → wav).
_ACCEPTED_MIME_TYPES = (
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
)


_PROMPT_TEMPLATE = (
    "Transcribe the following audio in Vietnamese. Output ONLY the spoken "
    "text exactly as said, no commentary, no markdown, no quotes, no labels. "
    "If the audio is silent or unintelligible, output an empty string."
)


_gemini_model = None


def _mime_to_ext(mime_type: str) -> str:
    """OpenAI STT infers format from the filename extension we attach."""
    return {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "mp4",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
    }.get(mime_type, "webm")


def _call_openai_stt(
    audio_bytes: bytes, mime_type: str, lang: str, timeout_s: float
) -> str:
    """D-S08-NN-12: transcribe via OpenAI. Native timeout => no hang.

    Passes a named in-memory file (extension drives format detection) and
    a per-call timeout. language hint improves Vietnamese accuracy.
    """
    import io
    client = _get_openai_client(timeout_s)
    buf = io.BytesIO(audio_bytes)
    buf.name = f"audio.{_mime_to_ext(mime_type)}"
    resp = client.audio.transcriptions.create(
        model=OPENAI_STT_MODEL,
        file=buf,
        language=lang,
        response_format="text",
        timeout=timeout_s,
    )
    # response_format=text returns a plain string; be defensive if SDK
    # returns an object with .text.
    return resp if isinstance(resp, str) else getattr(resp, "text", "")


def transcribe(params: dict[str, Any]) -> dict[str, Any]:
    """JSON-RPC `speech.transcribe` handler — see module docstring for shape."""
    audio_b64 = params.get("audio_b64")
    if not isinstance(audio_b64, str) or not audio_b64:
        raise ValueError("'audio_b64' param required (base64-encoded audio)")

    mime_type = params.get("mime_type") or "audio/webm"
    if not isinstance(mime_type, str) or mime_type not in _ACCEPTED_MIME_TYPES:
        raise ValueError(
            f"'mime_type' must be one of {_ACCEPTED_MIME_TYPES}; got {mime_type!r}"
        )

    lang = params.get("lang") or "vi"
    if not isinstance(lang, str) or not lang:
        raise ValueError("'lang' must be a non-empty string (e.g. 'vi')")

    timeout_s = float(params.get("timeout_s") or DEFAULT_TIMEOUT_S)
    if timeout_s <= 0 or timeout_s > 60:
        raise ValueError("'timeout_s' must be in (0, 60]")

    # Strip data: URI prefix if FE sent one (browser MediaRecorder + FileReader
    # readAsDataURL produces "data:audio/webm;base64,...." — we want the bytes
    # only).
    if audio_b64.startswith("data:"):
        audio_b64 = audio_b64.split(",", 1)[1] if "," in audio_b64 else audio_b64
    try:
        audio_bytes = base64.b64decode(audio_b64, validate=True)
    except Exception as e:
        raise ValueError(f"Invalid base64 audio data: {e}") from e

    if len(audio_bytes) < MIN_AUDIO_BYTES:
        # E_NO_SPEECH per D-S08-NN-11 — surfaced via RuntimeError message
        # prefix; graph node catches and maps to error.dto.ts envelope.
        raise RuntimeError(
            f"E_NO_SPEECH: audio too small ({len(audio_bytes)} bytes); "
            "likely silence or truncated upload"
        )

    with _tracer.start_as_current_span("speech.openai.stt") as span:
        span.set_attribute("speech.model", OPENAI_STT_MODEL)
        span.set_attribute("speech.audio_bytes", len(audio_bytes))
        span.set_attribute("speech.mime_type", mime_type)
        span.set_attribute("speech.lang", lang)
        span.set_attribute("speech.timeout_s", timeout_s)

        # D-S08-NN-12: direct OpenAI call. Native transport timeout means
        # this can never hang (root-cause fix vs the Gemini ThreadPool
        # 'fake timeout' where the worker thread blocked forever).
        try:
            raw_text = _call_openai_stt(
                audio_bytes, mime_type, lang, timeout_s
            )
        except Exception as e:  # noqa: BLE001 — map any provider error
            _logger.error("speech.transcribe.failed", error=str(e))
            span.set_attribute("speech.status", "error")
            raise RuntimeError(
                f"E_TRANSCRIBE_FAILED: OpenAI STT failed: {e}"
            ) from e

        text = (raw_text or "").strip()
        if not text:
            span.set_attribute("speech.status", "no_speech")
            raise RuntimeError("E_NO_SPEECH: empty transcription from OpenAI")

        # duration_ms is approximate (bytes / 2000 ≈ seconds at 16kbps); see
        # _BYTES_PER_SECOND_ESTIMATE comment above. Confidence is None per
        # R-S08-1 — Gemini audio API does not return per-utterance confidence.
        duration_ms = int(len(audio_bytes) * 1000 / _BYTES_PER_SECOND_ESTIMATE)

        span.set_attribute("speech.status", "ok")
        span.set_attribute("speech.text_chars", len(text))
        span.set_attribute("speech.duration_ms", duration_ms)

        _logger.info(
            "speech.transcribed",
            text_chars=len(text),
            duration_ms=duration_ms,
            audio_bytes=len(audio_bytes),
            mime_type=mime_type,
            lang=lang,
        )
        return {
            "text": text,
            "confidence": None,  # R-S08-1: Gemini audio API does not surface confidence
            "duration_ms": duration_ms,
            "language": lang,
        }


register("speech.transcribe", transcribe)


def synthesize(params: dict[str, Any]) -> dict[str, Any]:
    """D-S08-NN-13 LAW: speech.synthesize — OpenAI TTS text -> audio.

    Params: { text:str, voice?:str, format?:str(mp3|opus|wav),
              timeout_s?:float }
    Returns: { audio_b64:str, mime:str, model:str, voice:str }

    Backend-only this session (T-a). FE TODO: play audio_b64 on SSE final
    (separate FE turn — graph wiring + FE player not in this patch).
    """
    text = params.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("'text' param required (non-empty string)")
    voice = params.get("voice") or OPENAI_TTS_VOICE
    fmt = params.get("format") or "mp3"
    if fmt not in ("mp3", "opus", "wav", "aac", "flac"):
        raise ValueError("'format' must be mp3|opus|wav|aac|flac")
    timeout_s = float(params.get("timeout_s") or DEFAULT_TTS_TIMEOUT_S)
    if timeout_s <= 0 or timeout_s > 60:
        raise ValueError("'timeout_s' must be in (0, 60]")

    mime = {"mp3": "audio/mpeg", "opus": "audio/ogg", "wav": "audio/wav",
            "aac": "audio/aac", "flac": "audio/flac"}[fmt]

    with _tracer.start_as_current_span("speech.openai.tts") as span:
        span.set_attribute("tts.model", OPENAI_TTS_MODEL)
        span.set_attribute("tts.voice", voice)
        span.set_attribute("tts.format", fmt)
        span.set_attribute("tts.text_chars", len(text))
        span.set_attribute("tts.timeout_s", timeout_s)
        try:
            client = _get_openai_client(timeout_s)
            resp = client.audio.speech.create(
                model=OPENAI_TTS_MODEL,
                voice=voice,
                input=text,
                response_format=fmt,
                timeout=timeout_s,
            )
            audio_bytes = resp.read()
        except Exception as e:  # noqa: BLE001
            _logger.error("speech.synthesize.failed", error=str(e))
            span.set_attribute("tts.status", "error")
            raise RuntimeError(
                f"E_TTS_FAILED: OpenAI TTS failed: {e}"
            ) from e

        span.set_attribute("tts.status", "ok")
        span.set_attribute("tts.audio_bytes", len(audio_bytes))
        _logger.info(
            "speech.synthesized",
            text_chars=len(text),
            audio_bytes=len(audio_bytes),
            voice=voice,
            fmt=fmt,
        )
        return {
            "audio_b64": base64.b64encode(audio_bytes).decode("ascii"),
            "mime": mime,
            "model": OPENAI_TTS_MODEL,
            "voice": voice,
        }


register("speech.synthesize", synthesize)
