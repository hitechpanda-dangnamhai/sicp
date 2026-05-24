"""LLM client — Gemini PRIMARY + OpenAI FALLBACK per D-S04-14 LAW (Q-Sx04-4-2).

S-04 T02 (Phiên Sx04-5):
    - PRIMARY:  Gemini `gemini-2.5-flash` via `google-generativeai` SDK
                (env: GOOGLE_GEMINI_API_KEY)
    - FALLBACK: OpenAI  `gpt-4o-mini`     via `openai` SDK
                (env: OPENAI_API_KEY)
    - 5s timeout per call; raises LLMTimeout on exceed.
      (Phiên Sx04-7 amendment: original 2s timeout was too aggressive for
      VN→Google network latency — TTFB Gemini API from VN typically
      1-2s + inference 0.5-2s = 2-4s actual call time. 5s gives Gemini
      enough room while still triggering interrupt protocol on true hangs.)
    - `MOCK_LLM_TIMEOUT=true` env override → ALL calls raise LLMTimeout
      immediately (for smoke testing degrade interrupt protocol per
      D-S04-13 LAW Pattern A without burning real API quota).

Phiên Sx04-7 fix amendment (2026-05-24) — two-step model name correction:
    Step 1 (intermediate): Original Phiên Sx04-5 emit used `gemini-1.5-flash`
        which was valid at emit time per Q-Sx04-4-2 audit. By smoke-test
        time, Google had retired this exact model name on v1beta endpoint
        → 404 NotFound on generateContent call.

    Step 2 (final): Tried `gemini-2.0-flash` as direct replacement, but
        per Google Cloud retirement matrix (effective March 6, 2026)
        gemini-2.0-flash is "only available for existing customers" — new
        API keys / new projects get 404 "no longer available to new users".

    FINAL CHOICE: `gemini-2.5-flash` — recommended-for-new-projects per
        Google's current retirement matrix. Same multilingual support,
        same JSON-mode support, same family behavior as 2.0-flash so
        prompts in `apps/ai/src/prompts/*.txt` are expected to work
        without modification.

    NOTE: `google-generativeai` package itself is deprecated (Google
    recommends migrating to `google-genai`). Deferring that migration to
    Phiên Sx04-8 or later — model name swap is sufficient for unblock.

Rationale per D-S04-14 LAW Q-Sx04-4-2 LAW:
    - VN multilingual native (cross-language Q-Sx04-3-1 LAW "soy sauce for
      pho" → nuoc_tuong works out-of-the-box)
    - Free tier RPD generous (scrappy startup signal)
    - Vietnamese hackathon judges familiar with Gemini brand
    - Fallback resilience for demo

Structured output mode (JSON):
    - Gemini: response_mime_type='application/json' + response_schema (when
              provided) → enforces well-formed JSON
    - OpenAI: response_format={'type': 'json_object'}

Reference:
    - slices/S-04_decisions-log.md D-S04-14 LAW Q-Sx04-4-2 sub-decision
    - slices/S-04_decisions-log.md D-S04-15 (Phiên Sx04-7 — Gemini model
      name update 1.5-flash → 2.5-flash via two-step verification)
    - docs/phases/PHASE_02_AUTH_SEARCH.md §C deps + env vars
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import structlog
from opentelemetry import trace

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()

# 5s timeout per call (Phiên Sx04-7 amendment per D-S04-15; was 2s in D-S04-13
# LAW + D-S04-14 LAW emit time, increased to accommodate VN→Google network
# round-trip latency observed in smoke tests).
DEFAULT_TIMEOUT_S = 5.0


class LLMError(Exception):
    """Raised on LLM call failure (non-timeout)."""

    def __init__(self, message: str, *, code: str = "E_LLM_ERROR", provider: str | None = None):
        super().__init__(message)
        self.code = code
        self.provider = provider


class LLMTimeout(LLMError):
    """Raised on LLM timeout (>5s default).

    Triggers D-S04-13 LAW degrade interrupt protocol at calling graph node
    (generate_understanding / parse_filters / generate_reasons).
    """

    def __init__(self, message: str = "LLM call exceeded 5s timeout", provider: str | None = None):
        super().__init__(message, code="E_LLM_TIMEOUT", provider=provider)


class LLMRateLimited(LLMError):
    """Raised on LLM rate limit hit (429 / quota exceeded)."""

    def __init__(self, message: str = "LLM rate limit exceeded", provider: str | None = None):
        super().__init__(message, code="E_LLM_RATE_LIMITED", provider=provider)


def _mock_llm_timeout_enabled() -> bool:
    """Smoke-test env override — when True, ALL calls raise LLMTimeout
    immediately. Lets us verify degrade interrupt protocol without burning
    API quota or waiting 5s real.
    """
    return os.getenv("MOCK_LLM_TIMEOUT", "").lower() in ("true", "1", "yes")


class LLMClient:
    """Gemini PRIMARY + OpenAI FALLBACK LLM client.

    Lazy-initialized SDK clients — first generate_json call constructs the
    underlying Gemini + OpenAI clients. Both kept as instance state across
    calls for connection reuse (Gemini ~50ms per cold connect overhead).
    """

    def __init__(self) -> None:
        self._gemini_client: Any | None = None
        self._openai_client: Any | None = None
        self._gemini_disabled = False
        self._openai_disabled = False

    def _ensure_gemini(self) -> Any:
        if self._gemini_disabled:
            return None
        if self._gemini_client is not None:
            return self._gemini_client

        api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            _logger.warning("llm.gemini.no_api_key")
            self._gemini_disabled = True
            return None

        try:
            import google.generativeai as genai  # type: ignore[import-untyped]

            genai.configure(api_key=api_key)
            self._gemini_client = genai.GenerativeModel(
                # Phiên Sx04-7 fix (two-step):
                # 1. Original Sx04-5: "gemini-1.5-flash" — retired by Google
                #    on v1beta endpoint.
                # 2. Intermediate Sx04-7 attempt: "gemini-2.0-flash" — also
                #    rejected for NEW projects per Google retirement matrix
                #    effective March 6, 2026.
                # 3. FINAL: "gemini-2.5-flash" — recommended-for-new-projects
                #    per current matrix, same family behavior.
                model_name="gemini-2.5-flash",
                generation_config={
                    "temperature": 0.3,
                    "response_mime_type": "application/json",
                },
            )
            return self._gemini_client
        except Exception as e:  # noqa: BLE001
            _logger.warning("llm.gemini.init_failed", error=str(e))
            self._gemini_disabled = True
            return None

    def _ensure_openai(self) -> Any:
        if self._openai_disabled:
            return None
        if self._openai_client is not None:
            return self._openai_client

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            _logger.warning("llm.openai.no_api_key")
            self._openai_disabled = True
            return None

        try:
            from openai import AsyncOpenAI  # type: ignore[import-untyped]

            self._openai_client = AsyncOpenAI(api_key=api_key)
            return self._openai_client
        except Exception as e:  # noqa: BLE001
            _logger.warning("llm.openai.init_failed", error=str(e))
            self._openai_disabled = True
            return None

    async def _call_gemini(self, prompt: str, timeout_s: float) -> dict[str, Any]:
        client = self._ensure_gemini()
        if client is None:
            raise LLMError("Gemini not configured", provider="gemini")

        with _tracer.start_as_current_span("llm.gemini.generate") as span:
            span.set_attribute("llm.provider", "gemini")
            span.set_attribute("llm.model", "gemini-2.5-flash")

            # Wrap sync SDK call in asyncio.to_thread + asyncio.wait_for for timeout.
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(client.generate_content, prompt),
                    timeout=timeout_s,
                )
            except asyncio.TimeoutError as e:
                raise LLMTimeout(provider="gemini") from e

            text = getattr(resp, "text", None) or ""
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError) as e:
                _logger.warning("llm.gemini.json_parse_failed", text_preview=text[:200])
                raise LLMError(f"Invalid JSON from Gemini: {e}", provider="gemini") from e

    async def _call_openai(self, prompt: str, timeout_s: float) -> dict[str, Any]:
        client = self._ensure_openai()
        if client is None:
            raise LLMError("OpenAI not configured", provider="openai")

        with _tracer.start_as_current_span("llm.openai.generate") as span:
            span.set_attribute("llm.provider", "openai")
            span.set_attribute("llm.model", "gpt-4o-mini")

            try:
                resp = await asyncio.wait_for(
                    client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                    ),
                    timeout=timeout_s,
                )
            except asyncio.TimeoutError as e:
                raise LLMTimeout(provider="openai") from e

            text = resp.choices[0].message.content or ""
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError) as e:
                _logger.warning("llm.openai.json_parse_failed", text_preview=text[:200])
                raise LLMError(f"Invalid JSON from OpenAI: {e}", provider="openai") from e

    async def generate_json(
        self, prompt: str, timeout_s: float = DEFAULT_TIMEOUT_S
    ) -> dict[str, Any]:
        """Generate JSON structured output via Gemini PRIMARY, OpenAI FALLBACK.

        Behavior:
            - MOCK_LLM_TIMEOUT=true → raise LLMTimeout immediately (no API call)
            - Try Gemini first; on LLMTimeout → re-raise (degrade trigger)
            - On non-timeout Gemini error → try OpenAI (transient resilience)
            - If both fail → raise last LLMError

        Args:
            prompt:    Full prompt text (caller renders template with .format)
            timeout_s: Per-call timeout in seconds (default 5.0s per Phiên
                Sx04-7 D-S04-15 amendment of D-S04-13 LAW; was 2.0s originally)

        Returns:
            Parsed JSON dict.

        Raises:
            LLMTimeout: when call exceeds timeout_s (triggers degrade interrupt)
            LLMError:   when both Gemini and OpenAI fail (non-timeout)
        """
        # Smoke-test mock — ALL calls timeout immediately.
        if _mock_llm_timeout_enabled():
            _logger.info("llm.mock_timeout", reason="MOCK_LLM_TIMEOUT env override")
            raise LLMTimeout(provider="mock")

        # Primary: Gemini.
        try:
            return await self._call_gemini(prompt, timeout_s)
        except LLMTimeout:
            # Timeout = degrade trigger; do NOT fall back to OpenAI (per D-S04-14
            # LAW, OpenAI fallback is for non-timeout transient errors only —
            # timeout is the WHOLE POINT of triggering graceful degrade).
            raise
        except LLMError as gemini_err:
            _logger.warning("llm.gemini.fallback_to_openai", error=str(gemini_err))
            # Try OpenAI fallback for non-timeout errors.
            try:
                return await self._call_openai(prompt, timeout_s)
            except LLMError as openai_err:
                _logger.error(
                    "llm.both_failed",
                    gemini_error=str(gemini_err),
                    openai_error=str(openai_err),
                )
                raise


# Module-level singleton client (lazy SDK init inside).
_singleton: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Return process-level singleton LLMClient instance.

    Per-request graph nodes call this to share underlying SDK clients +
    connection pools across the request's parallel per-product LLM calls.
    """
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton
