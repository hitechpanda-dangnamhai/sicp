"""LLM client — Gemini PRIMARY + OpenAI FALLBACK with per-call model selection.

S-04 T02 (Phiên Sx04-5 emit; refactored Phiên Sx04-X for O2 model split):
    - PRIMARY:  Gemini family via `google-generativeai` SDK
                (env: GOOGLE_GEMINI_API_KEY)
                * Default model: `gemini-2.5-flash`
                * Per-call override: `gemini-2.5-flash-lite` for background
                  classification tasks (detect_typo, parse_filters) — empirically
                  validated identical-or-better output quality at ~50-70%
                  lower latency than full Flash.
    - FALLBACK: OpenAI `gpt-4o-mini` via `openai` SDK (env: OPENAI_API_KEY)
                * Non-timeout transient errors only (rate limit, API down).
                * Per D-S04-14 LAW: timeout = degrade signal, NOT fallback trigger.
    - Per-node calibrated timeouts (D-S04-15 LAW amended Phiên Sx04-X per
      empirical measurement of Gemini inference time on Vietnamese prompts):
        detect_typo:            5s   (Flash-Lite ~1.3s typical)
        parse_filters:          5s   (Flash-Lite ~1.4s typical)
        generate_understanding: 14s  (Flash ~7-12s typical, output 270-310 chars)
        generate_reasons:       10s  (Flash ~3-5s per product, shorter output)
        DEFAULT (other calls):  10s
    - `MOCK_LLM_TIMEOUT=true` env override → ALL calls raise LLMTimeout
      immediately (smoke test degrade protocol).

Model selection rationale (O2 — Phiên Sx04-X):
    detect_typo + parse_filters use Flash-Lite because:
      1. Tasks are structured classification (typo confidence + category
         enum + filter extraction) — not requiring deep Vietnamese fluency
      2. Output is JSON, not user-facing text
      3. Background nodes blocking sequential pipeline → latency dominant
      4. Empirical A/B (n=10) shows Flash-Lite output identical or better
         (5/6 vs 4/6 correct on typo edge cases; 4/4 identical on filters)
    generate_understanding + generate_reasons keep Flash because:
      1. Output is user-facing Vietnamese natural language
      2. Mockup LOCKED strings require fluency (Rule 6 Mockup-is-LAW)
      3. Quality regression here = visible to demo judges

Reference:
    - slices/S-04_decisions-log.md D-S04-14 LAW Q-Sx04-4-2 sub-decision
    - slices/S-04_decisions-log.md D-S04-15 (Phiên Sx04-7 — Gemini model
      name update 1.5-flash → 2.5-flash via two-step verification)
    - slices/S-04_decisions-log.md D-S04-X (Phiên Sx04-X — O2 model split +
      empirical timeout calibration)
    - docs/phases/PHASE_02_AUTH_SEARCH.md §C deps + env vars
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import os
import time
from dataclasses import dataclass
from typing import Any

import structlog
from opentelemetry import trace

from ..observability.metrics import record_llm_metrics
from .llm_pricing import cost_usd
from .mcp_client import McpClient

_tracer = trace.get_tracer(__name__)
_logger = structlog.get_logger()


@dataclass(frozen=True)
class TraceContext:
    """Per-request context threaded from a graph node so the LLM client can write
    a durable trace (S-P0-03/T03b, ADR-054 §2). Built from graph `state` at the
    call site (analog to mcp_client.identity_kwargs). tenant_id None → emit skipped
    (trace is tenant-scoped; MCP requires X-Tenant-Id)."""

    tenant_id: str | None
    user_id: str | None = None
    intent_type: str | None = None
    rid: str | None = None
    node: str | None = None

    @classmethod
    def from_state(cls, state: Any, node: str | None = None) -> TraceContext:
        """Build from a graph state dict (+ optional calling node name)."""
        return cls(
            tenant_id=state.get("tenant_id"),
            user_id=state.get("user_id"),
            intent_type=state.get("intent"),
            rid=state.get("request_id"),
            node=node,
        )


# Request-scoped ambient TraceContext. main._drive_graph_async sets this ONCE at
# the top of the graph thread's event loop (before astream); every LLM call in
# that request inherits it via contextvar copy-on-task-create → generate_json
# emits a trace for EVERY call WITHOUT threading a param through ~10 graph call
# sites (W-40 "MỌI call"). Explicit trace_ctx arg still overrides when a caller
# wants per-node granularity. `node` is None for ambient (per-request, not per-call).
_ambient_trace_ctx: contextvars.ContextVar[TraceContext | None] = contextvars.ContextVar(
    "icp_llm_trace_ctx", default=None
)


def set_request_trace_context(ctx: TraceContext | None) -> contextvars.Token:
    """Set ambient TraceContext for the current request; returns reset token."""
    return _ambient_trace_ctx.set(ctx)


def reset_request_trace_context(token: contextvars.Token) -> None:
    """Reset ambient TraceContext (finally, to avoid leaking across requests)."""
    _ambient_trace_ctx.reset(token)


# Fire-and-forget trace-write failure counter (W-40). A trace-write failure must
# NEVER fail the request — we swallow + count. T03c (W-55) wires this to an OTel
# metric; for T03b a process-local counter + ops log `llm.trace.write_failed`
# proves the resilience invariant (kill-MCP → request completes, counter↑).
_trace_write_failures = 0


def get_trace_write_failures() -> int:
    """Process-local count of swallowed trace-write failures (test/diagnostic)."""
    return _trace_write_failures


def _gemini_usage(resp: Any) -> dict[str, int | None]:
    """Extract {tokens_in, tokens_out} from a Gemini response (usage_metadata)."""
    um = getattr(resp, "usage_metadata", None)
    if um is None:
        return {"tokens_in": None, "tokens_out": None}
    return {
        "tokens_in": getattr(um, "prompt_token_count", None),
        "tokens_out": getattr(um, "candidates_token_count", None),
    }


def _openai_usage(resp: Any) -> dict[str, int | None]:
    """Extract {tokens_in, tokens_out} from an OpenAI response (usage)."""
    u = getattr(resp, "usage", None)
    if u is None:
        return {"tokens_in": None, "tokens_out": None}
    return {
        "tokens_in": getattr(u, "prompt_tokens", None),
        "tokens_out": getattr(u, "completion_tokens", None),
    }

# Default model — full Flash for user-facing Vietnamese tasks.
DEFAULT_MODEL = "gemini-2.5-flash"

# Lightweight model — for background classification tasks.
# Empirically validated identical-or-better quality at ~50-70% lower latency.
LITE_MODEL = "gemini-2.5-flash-lite"

# Default timeout (10s) — applies when caller doesn't specify timeout_s.
# Per-node calibrated values are passed explicitly by graph nodes; see
# searching_by_text.py for the calibration table.
DEFAULT_TIMEOUT_S = 10.0


class LLMError(Exception):
    """Raised on LLM call failure (non-timeout)."""

    def __init__(self, message: str, *, code: str = "E_LLM_ERROR", provider: str | None = None):
        super().__init__(message)
        self.code = code
        self.provider = provider


class LLMTimeout(LLMError):
    """Raised on LLM timeout.

    Triggers D-S04-13 LAW degrade interrupt protocol at calling graph node
    (generate_understanding / parse_filters / generate_reasons).
    """

    def __init__(self, message: str = "LLM call exceeded timeout", provider: str | None = None):
        super().__init__(message, code="E_LLM_TIMEOUT", provider=provider)


class LLMRateLimited(LLMError):
    """Raised on LLM rate limit hit (429 / quota exceeded)."""

    def __init__(self, message: str = "LLM rate limit exceeded", provider: str | None = None):
        super().__init__(message, code="E_LLM_RATE_LIMITED", provider=provider)


def _mock_llm_timeout_enabled() -> bool:
    """Smoke-test env override — when True, ALL calls raise LLMTimeout
    immediately. Lets us verify degrade interrupt protocol without burning
    API quota or waiting timeout real.
    """
    return os.getenv("MOCK_LLM_TIMEOUT", "").lower() in ("true", "1", "yes")


class LLMClient:
    """Gemini PRIMARY + OpenAI FALLBACK LLM client with per-call model selection.

    Lazy-initialized SDK clients — first generate_json call constructs the
    underlying SDK clients. Gemini clients are cached per model_name so that
    Flash + Flash-Lite can coexist (re-use connection pool per model).
    """

    def __init__(self) -> None:
        # Cache Gemini GenerativeModel instances per model_name.
        # Both Flash and Flash-Lite (and any future models) cached separately.
        self._gemini_clients: dict[str, Any] = {}
        self._gemini_configured = False
        self._gemini_disabled = False
        self._openai_client: Any | None = None
        self._openai_disabled = False
        # Lazy MCP client for durable trace writes (traces.append). Short timeout
        # so a hung/dead MCP can't stall the request beyond the fire-and-forget
        # window. Test-injectable.
        self._trace_mcp_client: McpClient | None = None
        self._pending_traces: set[asyncio.Task[None]] = set()

    def _ensure_gemini(self, model_name: str) -> Any:
        """Return GenerativeModel for model_name, lazy-init and cache."""
        if self._gemini_disabled:
            return None
        if model_name in self._gemini_clients:
            return self._gemini_clients[model_name]

        api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            _logger.warning("llm.gemini.no_api_key")
            self._gemini_disabled = True
            return None

        try:
            import google.generativeai as genai  # type: ignore[import-untyped]

            # configure() is global to genai module — call once only.
            if not self._gemini_configured:
                genai.configure(api_key=api_key)
                self._gemini_configured = True

            client = genai.GenerativeModel(
                model_name=model_name,
                generation_config={
                    "temperature": 0.3,
                    "response_mime_type": "application/json",
                },
            )
            self._gemini_clients[model_name] = client
            _logger.info("llm.gemini.client_init", model=model_name)
            return client
        except Exception as e:  # noqa: BLE001
            _logger.warning("llm.gemini.init_failed", model=model_name, error=str(e))
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

    async def _call_gemini(
        self, prompt: str, timeout_s: float, model: str
    ) -> tuple[dict[str, Any], dict[str, int | None]]:
        client = self._ensure_gemini(model)
        if client is None:
            raise LLMError(f"Gemini not configured (model={model})", provider="gemini")

        with _tracer.start_as_current_span("llm.gemini.generate") as span:
            span.set_attribute("llm.provider", "gemini")
            span.set_attribute("llm.model", model)
            span.set_attribute("llm.timeout_s", timeout_s)

            # Wrap sync SDK call in asyncio.to_thread + asyncio.wait_for for timeout.
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(client.generate_content, prompt),
                    timeout=timeout_s,
                )
            except TimeoutError as e:
                raise LLMTimeout(
                    f"Gemini call exceeded {timeout_s}s (model={model})",
                    provider="gemini",
                ) from e

            usage = _gemini_usage(resp)
            text = getattr(resp, "text", None) or ""
            try:
                return json.loads(text), usage
            except (json.JSONDecodeError, TypeError) as e:
                _logger.warning(
                    "llm.gemini.json_parse_failed",
                    model=model,
                    text_preview=text[:200],
                )
                raise LLMError(
                    f"Invalid JSON from Gemini (model={model}): {e}",
                    provider="gemini",
                ) from e

    async def _call_openai(
        self, prompt: str, timeout_s: float
    ) -> tuple[dict[str, Any], dict[str, int | None]]:
        client = self._ensure_openai()
        if client is None:
            raise LLMError("OpenAI not configured", provider="openai")

        with _tracer.start_as_current_span("llm.openai.generate") as span:
            span.set_attribute("llm.provider", "openai")
            span.set_attribute("llm.model", "gpt-4o-mini")
            span.set_attribute("llm.timeout_s", timeout_s)

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
            except TimeoutError as e:
                raise LLMTimeout(
                    f"OpenAI call exceeded {timeout_s}s",
                    provider="openai",
                ) from e

            usage = _openai_usage(resp)
            text = resp.choices[0].message.content or ""
            try:
                return json.loads(text), usage
            except (json.JSONDecodeError, TypeError) as e:
                _logger.warning("llm.openai.json_parse_failed", text_preview=text[:200])
                raise LLMError(
                    f"Invalid JSON from OpenAI: {e}", provider="openai"
                ) from e

    def _trace_mcp(self) -> McpClient:
        """Lazy MCP client for traces.append (short timeout, fire-and-forget)."""
        if self._trace_mcp_client is None:
            url = os.getenv("MCP_URL", "http://mcp:5050/rpc")
            timeout_s = float(os.getenv("LLM_TRACE_MCP_TIMEOUT_S", "2.0"))
            self._trace_mcp_client = McpClient(url, timeout_s=timeout_s)
        return self._trace_mcp_client

    async def _emit_trace_safe(
        self,
        trace_ctx: TraceContext,
        *,
        provider: str,
        model: str,
        status: str,
        latency_ms: int,
        usage: dict[str, int | None] | None = None,
        error_code: str | None = None,
    ) -> None:
        """Write ONE durable trace via MCP traces.append. Swallows ALL errors —
        a trace-write failure must never fail the request (W-40 invariant). On
        failure: increment counter + ops log, return normally.

        ADR-003: the AI process NEVER touches Postgres directly — only via this
        MCP tool. tenant_id/user_id ride as X-Tenant-Id/X-User-Id headers."""
        global _trace_write_failures
        usage = usage or {"tokens_in": None, "tokens_out": None}
        tokens_in = usage.get("tokens_in")
        tokens_out = usage.get("tokens_out")
        try:
            await self._trace_mcp().call(
                "traces.append",
                {
                    "provider": provider,
                    "model": model,
                    "status": status,
                    "intent_type": trace_ctx.intent_type,
                    "rid": trace_ctx.rid,
                    "node": trace_ctx.node,
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "cost_usd": cost_usd(model, tokens_in, tokens_out),
                    "latency_ms": latency_ms,
                    "error_code": error_code,
                },
                tenant_id=trace_ctx.tenant_id,
                user_id=trace_ctx.user_id,
            )
        except Exception as e:  # noqa: BLE001
            _trace_write_failures += 1
            _logger.warning(
                "llm.trace.write_failed",
                provider=provider,
                model=model,
                error=str(e),
                count=_trace_write_failures,
            )

    def _record_trace(
        self,
        trace_ctx: TraceContext | None,
        *,
        provider: str,
        model: str,
        status: str,
        latency_ms: int,
        usage: dict[str, int | None] | None = None,
        error_code: str | None = None,
    ) -> None:
        """Record metrics + schedule a fire-and-forget trace write. NEVER raises
        (isolates the request from all trace/metric logic). No trace_ctx → skip;
        no tenant → metrics still recorded (observability, no RLS) but DB write
        skipped (tenant-scoped trace needs a tenant); no running loop → skip task."""
        if trace_ctx is None:
            return
        # W-55 metrics: cost/tokens/latency (own swallow; tenant label optional).
        record_llm_metrics(
            tenant_id=trace_ctx.tenant_id,
            intent=trace_ctx.intent_type,
            provider=provider,
            model=model,
            status=status,
            latency_ms=latency_ms,
            usage=usage,
        )
        # W-40 durable trace write — needs a tenant (RLS-scoped INSERT).
        if not trace_ctx.tenant_id:
            return
        try:
            loop = asyncio.get_running_loop()
            task = loop.create_task(
                self._emit_trace_safe(
                    trace_ctx,
                    provider=provider,
                    model=model,
                    status=status,
                    latency_ms=latency_ms,
                    usage=usage,
                    error_code=error_code,
                )
            )
            # Keep a ref so the task isn't GC'd mid-flight; discard when done.
            self._pending_traces.add(task)
            task.add_done_callback(self._pending_traces.discard)
        except Exception:  # noqa: BLE001 — scheduling must never fail the request.
            pass

    async def generate_json(
        self,
        prompt: str,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        model: str = DEFAULT_MODEL,
        *,
        trace_ctx: TraceContext | None = None,
    ) -> dict[str, Any]:
        """Generate JSON structured output via Gemini PRIMARY, OpenAI FALLBACK.

        Behavior:
            - MOCK_LLM_TIMEOUT=true → raise LLMTimeout immediately (no API call)
            - Try Gemini first (with specified model); on LLMTimeout → re-raise
              (degrade trigger per D-S04-14 LAW)
            - On non-timeout Gemini error → try OpenAI (transient resilience).
              Note: OpenAI fallback ignores `model` param (uses gpt-4o-mini).
            - If both fail → raise last LLMError

        Args:
            prompt:    Full prompt text (caller renders template with .format)
            timeout_s: Per-call timeout in seconds (caller passes node-calibrated
                       value per D-S04-15 LAW table; falls back to DEFAULT_TIMEOUT_S)
            model:     Gemini model name. Use LITE_MODEL for background
                       classification (detect_typo, parse_filters) per O2 split.
                       Default is DEFAULT_MODEL (full Flash) for user-facing tasks.

        Returns:
            Parsed JSON dict.

        Raises:
            LLMTimeout: when call exceeds timeout_s (triggers degrade interrupt)
            LLMError:   when both Gemini and OpenAI fail (non-timeout)
        """
        # Smoke-test mock — ALL calls timeout immediately (no real call → no trace).
        if _mock_llm_timeout_enabled():
            _logger.info("llm.mock_timeout", reason="MOCK_LLM_TIMEOUT env override")
            raise LLMTimeout(provider="mock")

        # Resolve trace context: explicit arg wins, else request-scoped ambient.
        if trace_ctx is None:
            trace_ctx = _ambient_trace_ctx.get()

        # Primary: Gemini with specified model. Trace EVERY provider attempt
        # (W-40 "ghi trace MỌI call cả fallback") — one row per attempt.
        t0 = time.monotonic()
        try:
            parsed, usage = await self._call_gemini(prompt, timeout_s, model)
            self._record_trace(
                trace_ctx, provider="gemini", model=model, status="ok",
                latency_ms=int((time.monotonic() - t0) * 1000), usage=usage,
            )
            return parsed
        except LLMTimeout as gemini_timeout:
            self._record_trace(
                trace_ctx, provider="gemini", model=model, status="error",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error_code=gemini_timeout.code,
            )
            # Timeout = degrade trigger; do NOT fall back to OpenAI per
            # D-S04-14 LAW (OpenAI fallback is for non-timeout transient
            # errors only — timeout is the WHOLE POINT of degrade signal).
            raise
        except LLMError as gemini_err:
            self._record_trace(
                trace_ctx, provider="gemini", model=model, status="error",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error_code=gemini_err.code,
            )
            _logger.warning(
                "llm.gemini.fallback_to_openai",
                model=model,
                error=str(gemini_err),
            )
            # Try OpenAI fallback for non-timeout errors.
            t1 = time.monotonic()
            try:
                parsed, usage = await self._call_openai(prompt, timeout_s)
                self._record_trace(
                    trace_ctx, provider="openai", model="gpt-4o-mini", status="ok",
                    latency_ms=int((time.monotonic() - t1) * 1000), usage=usage,
                )
                return parsed
            except LLMError as openai_err:
                self._record_trace(
                    trace_ctx, provider="openai", model="gpt-4o-mini", status="error",
                    latency_ms=int((time.monotonic() - t1) * 1000),
                    error_code=openai_err.code,
                )
                _logger.error(
                    "llm.both_failed",
                    model=model,
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
