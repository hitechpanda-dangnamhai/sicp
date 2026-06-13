"""LLM cost/token OTel metrics (S-P0-03/T03c, W-55).

Counters + histogram emitted alongside the durable trace write (same llm_client
sites as T03b). Export path: OTel SDK MeterProvider (observability/setup.py) →
OTLP gRPC → otel-collector metrics pipeline → prometheusremotewrite → Prometheus
(ADR-054 §2 cost spine, query-able dimension of per-intent cost).

Instruments (registered in docs/LOG_CATALOG.md §C before emit):
  - llm.cost.usd   Counter<float>   USD spent per call
  - llm.tokens     Counter<int>     tokens (label direction=in|out)
  - llm.latency    Histogram<int>   per-call latency (ms)
Labels: tenant_id, intent, model, provider (+ direction on tokens, status on
latency). tenant_id is intentional per ADR-054 (per-tenant cost) — accepted
cardinality cost; rollup recording rules (infra/otel) bound long-term storage.

record_llm_metrics swallows ALL errors — a metrics failure must never affect the
request (parity with the fire-and-forget trace write). instrument.add()/record()
are in-memory + non-blocking; OTLP export is async/batched by the reader.
"""

from __future__ import annotations

from typing import Any

from opentelemetry import metrics

from src.tools.llm_pricing import cost_usd

_meter: metrics.Meter | None = None
_cost_counter: metrics.Counter | None = None
_tokens_counter: metrics.Counter | None = None
_latency_hist: metrics.Histogram | None = None


def _instruments() -> tuple[metrics.Counter, metrics.Counter, metrics.Histogram]:
    """Lazy-create instruments against the active MeterProvider (no-op if SDK
    not initialized — get_meter returns an API no-op meter)."""
    global _meter, _cost_counter, _tokens_counter, _latency_hist
    if _meter is None:
        _meter = metrics.get_meter("ai.llm")
        _cost_counter = _meter.create_counter(
            "llm.cost.usd", unit="USD", description="LLM USD cost per call"
        )
        _tokens_counter = _meter.create_counter(
            "llm.tokens", unit="{token}", description="LLM tokens (direction=in|out)"
        )
        _latency_hist = _meter.create_histogram(
            "llm.latency", unit="ms", description="LLM call latency"
        )
    assert _cost_counter is not None and _tokens_counter is not None and _latency_hist is not None
    return _cost_counter, _tokens_counter, _latency_hist


def record_llm_metrics(
    *,
    tenant_id: str | None,
    intent: str | None,
    provider: str,
    model: str,
    status: str,
    latency_ms: int,
    usage: dict[str, int | None] | None = None,
) -> None:
    """Record cost/token/latency metrics for one LLM provider attempt. Never raises."""
    try:
        cost, tokens, latency = _instruments()
        usage = usage or {}
        tokens_in = usage.get("tokens_in")
        tokens_out = usage.get("tokens_out")
        attrs: dict[str, Any] = {
            "tenant_id": tenant_id or "unknown",
            "intent": intent or "unknown",
            "model": model,
            "provider": provider,
        }
        usd = cost_usd(model, tokens_in, tokens_out)
        if usd is not None:
            cost.add(usd, attrs)
        if tokens_in:
            tokens.add(tokens_in, {**attrs, "direction": "in"})
        if tokens_out:
            tokens.add(tokens_out, {**attrs, "direction": "out"})
        latency.record(latency_ms, {**attrs, "status": status})
    except Exception:  # noqa: BLE001 — metrics must never fail the request.
        pass
