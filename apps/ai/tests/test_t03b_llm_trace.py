# =============================================================================
# apps/ai/tests/test_t03b_llm_trace.py — S-P0-03/T03b (W-40)
# =============================================================================
# Test NHÚNG — PURE (không DB/LLM/MCP thật). Verify durable-trace spine logic:
#   - TraceContext.from_state maps graph state → trace fields.
#   - llm_pricing.cost_usd: known/unknown model + missing tokens + env override.
#   - usage extraction từ Gemini/OpenAI response shapes.
#   - _emit_trace_safe: success → traces.append params + identity headers đúng;
#     FAILURE (kill-MCP) → KHÔNG raise + counter↑ (fire-and-forget invariant).
#   - generate_json: ghi trace MỌI attempt (gemini ok / gemini-err→openai ok);
#     trace-write lỗi KHÔNG làm generate_json fail (request HOÀN THÀNH).
#
# asyncio.run() trong test sync (cùng style test_t03a_tenant_propagation.py).
# Run từ apps/ai/:  PYTHONPATH=. pytest tests/test_t03b_llm_trace.py -v
# =============================================================================
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from src.tools import llm_client as llm
from src.tools.llm_client import LLMClient, LLMError, TraceContext, get_trace_write_failures
from src.tools.llm_pricing import cost_usd

TENANT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


# --- TraceContext ------------------------------------------------------------

def test_trace_context_from_state() -> None:
    ctx = TraceContext.from_state(
        {"tenant_id": TENANT, "user_id": USER, "intent": "searching_by_text", "request_id": "r1"},
        node="generate_understanding",
    )
    assert ctx == TraceContext(
        tenant_id=TENANT, user_id=USER, intent_type="searching_by_text",
        rid="r1", node="generate_understanding",
    )


# --- pricing -----------------------------------------------------------------

def test_cost_usd_known_model() -> None:
    # gemini-2.5-flash = (0.30, 2.50) per 1M → 1000 in + 500 out.
    c = cost_usd("gemini-2.5-flash", 1000, 500)
    assert c is not None
    assert abs(c - (1000 * 0.30 + 500 * 2.50) / 1_000_000) < 1e-12


def test_cost_usd_unknown_model_or_missing_tokens_is_none() -> None:
    assert cost_usd("no-such-model", 100, 50) is None
    assert cost_usd("gemini-2.5-flash", None, 50) is None
    assert cost_usd("gemini-2.5-flash", 100, None) is None


def test_cost_usd_env_override(monkeypatch) -> None:
    import src.tools.llm_pricing as p

    monkeypatch.setenv("LLM_PRICES_JSON", '{"custom-model": [1.0, 2.0]}')
    p._prices = None  # bust the once-loaded cache so the env override applies
    try:
        assert cost_usd("custom-model", 1_000_000, 1_000_000) == 3.0
    finally:
        p._prices = None  # restore default-loaded state for other tests


# --- usage extraction --------------------------------------------------------

def test_gemini_usage_extraction() -> None:
    resp = SimpleNamespace(
        usage_metadata=SimpleNamespace(prompt_token_count=120, candidates_token_count=64)
    )
    assert llm._gemini_usage(resp) == {"tokens_in": 120, "tokens_out": 64}
    assert llm._gemini_usage(SimpleNamespace()) == {"tokens_in": None, "tokens_out": None}


def test_openai_usage_extraction() -> None:
    resp = SimpleNamespace(usage=SimpleNamespace(prompt_tokens=200, completion_tokens=80))
    assert llm._openai_usage(resp) == {"tokens_in": 200, "tokens_out": 80}
    assert llm._openai_usage(SimpleNamespace()) == {"tokens_in": None, "tokens_out": None}


# --- _emit_trace_safe (fire-and-forget) --------------------------------------

class _FakeMcp:
    """Records traces.append calls; optionally raises (simulate MCP down)."""

    def __init__(self, *, raise_exc: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._raise = raise_exc

    async def call(self, method: str, params: dict, *, tenant_id=None, user_id=None) -> Any:
        if self._raise is not None:
            raise self._raise
        self.calls.append(
            {"method": method, "params": params, "tenant_id": tenant_id, "user_id": user_id}
        )
        return {"trace_id": "fake-id"}


def test_emit_trace_safe_success_sends_correct_params() -> None:
    client = LLMClient()
    fake = _FakeMcp()
    client._trace_mcp_client = fake
    ctx = TraceContext(tenant_id=TENANT, user_id=USER, intent_type="searching_by_text",
                       rid="r1", node="generate_understanding")

    asyncio.run(
        client._emit_trace_safe(
            ctx, provider="gemini", model="gemini-2.5-flash", status="ok",
            latency_ms=410, usage={"tokens_in": 1000, "tokens_out": 500},
        )
    )

    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["method"] == "traces.append"
    assert call["tenant_id"] == TENANT and call["user_id"] == USER
    p = call["params"]
    assert p["provider"] == "gemini" and p["status"] == "ok"
    assert p["tokens_in"] == 1000 and p["tokens_out"] == 500
    assert p["cost_usd"] == (1000 * 0.30 + 500 * 2.50) / 1_000_000
    assert p["intent_type"] == "searching_by_text" and p["rid"] == "r1"


def test_emit_trace_safe_swallows_mcp_failure_and_counts() -> None:
    """kill-MCP: traces.append raises → _emit_trace_safe KHÔNG raise + counter↑."""
    client = LLMClient()
    client._trace_mcp_client = _FakeMcp(raise_exc=RuntimeError("MCP down"))
    ctx = TraceContext(tenant_id=TENANT)
    before = get_trace_write_failures()
    # must NOT raise
    asyncio.run(
        client._emit_trace_safe(ctx, provider="gemini", model="x", status="ok", latency_ms=1)
    )
    assert get_trace_write_failures() == before + 1


def test_record_trace_skips_when_no_tenant() -> None:
    """Không tenant → skip (trace tenant-scoped); KHÔNG raise, KHÔNG schedule."""
    client = LLMClient()

    async def _run() -> None:
        client._record_trace(TraceContext(tenant_id=None), provider="gemini",
                             model="x", status="ok", latency_ms=1)
        client._record_trace(None, provider="gemini", model="x", status="ok", latency_ms=1)

    asyncio.run(_run())
    assert len(client._pending_traces) == 0


# --- generate_json trace emission + resilience -------------------------------

async def _drain(client: LLMClient) -> None:
    if client._pending_traces:
        await asyncio.gather(*list(client._pending_traces))


def test_generate_json_emits_trace_on_gemini_success() -> None:
    client = LLMClient()
    fake = _FakeMcp()
    client._trace_mcp_client = fake

    async def _fake_gemini(prompt, timeout_s, model):
        return {"answer": "ok"}, {"tokens_in": 10, "tokens_out": 5}

    client._call_gemini = _fake_gemini  # type: ignore[assignment]
    ctx = TraceContext(tenant_id=TENANT, rid="r2", node="n", intent_type="searching_by_text")

    async def _run() -> dict:
        out = await client.generate_json("p", trace_ctx=ctx)
        await _drain(client)
        return out

    out = asyncio.run(_run())
    assert out == {"answer": "ok"}
    assert len(fake.calls) == 1
    assert fake.calls[0]["params"]["provider"] == "gemini"
    assert fake.calls[0]["params"]["status"] == "ok"
    assert fake.calls[0]["params"]["tokens_in"] == 10


def test_generate_json_traces_both_attempts_on_fallback() -> None:
    """gemini non-timeout error → openai ok ⇒ 2 trace rows (error gemini + ok openai)."""
    client = LLMClient()
    fake = _FakeMcp()
    client._trace_mcp_client = fake

    async def _fail_gemini(prompt, timeout_s, model):
        raise LLMError("boom", code="E_LLM_ERROR", provider="gemini")

    async def _ok_openai(prompt, timeout_s):
        return {"a": 1}, {"tokens_in": 7, "tokens_out": 3}

    client._call_gemini = _fail_gemini  # type: ignore[assignment]
    client._call_openai = _ok_openai  # type: ignore[assignment]
    ctx = TraceContext(tenant_id=TENANT, rid="r3", node="n")

    async def _run() -> dict:
        out = await client.generate_json("p", trace_ctx=ctx)
        await _drain(client)
        return out

    out = asyncio.run(_run())
    assert out == {"a": 1}
    providers = [(c["params"]["provider"], c["params"]["status"]) for c in fake.calls]
    assert ("gemini", "error") in providers
    assert ("openai", "ok") in providers


def test_generate_json_succeeds_even_when_trace_write_fails() -> None:
    """kill-MCP during call: trace write raises internally → request STILL completes."""
    client = LLMClient()
    client._trace_mcp_client = _FakeMcp(raise_exc=RuntimeError("MCP down mid-call"))

    async def _fake_gemini(prompt, timeout_s, model):
        return {"answer": "served"}, {"tokens_in": 1, "tokens_out": 1}

    client._call_gemini = _fake_gemini  # type: ignore[assignment]
    ctx = TraceContext(tenant_id=TENANT, rid="r4", node="n")
    before = get_trace_write_failures()

    async def _run() -> dict:
        out = await client.generate_json("p", trace_ctx=ctx)
        await _drain(client)
        return out

    out = asyncio.run(_run())
    assert out == {"answer": "served"}, "request phải HOÀN THÀNH dù trace-write lỗi"
    assert get_trace_write_failures() == before + 1
