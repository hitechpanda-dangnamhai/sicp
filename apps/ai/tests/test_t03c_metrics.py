# =============================================================================
# apps/ai/tests/test_t03c_metrics.py — S-P0-03/T03c (W-55)
# =============================================================================
# Test NHÚNG — PURE. Verify LLM cost/token/latency metrics:
#   - record_llm_metrics emits llm.cost.usd + llm.tokens(in/out) + llm.latency
#     với label tenant_id/intent/model/provider (InMemoryMetricReader).
#   - cost_usd computed từ pricing; tokens in/out tách direction label.
#   - NEVER raises (no SDK provider / bad input) — metrics KHÔNG fail request.
#
# Run từ apps/ai/:  PYTHONPATH=. pytest tests/test_t03c_metrics.py -v
# =============================================================================
from __future__ import annotations

import src.observability.metrics as m


def _reset_module_instruments() -> None:
    m._meter = None
    m._cost_counter = None
    m._tokens_counter = None
    m._latency_hist = None


def test_record_llm_metrics_emits_all_instruments(monkeypatch) -> None:
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import InMemoryMetricReader

    reader = InMemoryMetricReader()
    mp = MeterProvider(metric_readers=[reader])
    monkeypatch.setattr(m.metrics, "get_meter", lambda name: mp.get_meter(name))
    _reset_module_instruments()

    m.record_llm_metrics(
        tenant_id="11111111-1111-1111-1111-111111111111",
        intent="searching_by_text",
        provider="gemini",
        model="gemini-2.5-flash",
        status="ok",
        latency_ms=410,
        usage={"tokens_in": 1000, "tokens_out": 500},
    )

    data = reader.get_metrics_data()
    metrics_by_name: dict[str, object] = {}
    for rm in data.resource_metrics:
        for sm in rm.scope_metrics:
            for metric in sm.metrics:
                metrics_by_name[metric.name] = metric
    assert {"llm.cost.usd", "llm.tokens", "llm.latency"} <= set(metrics_by_name)

    # cost = (1000*0.30 + 500*2.50)/1e6 = 0.00155
    cost_pts = list(metrics_by_name["llm.cost.usd"].data.data_points)
    assert abs(cost_pts[0].value - (1000 * 0.30 + 500 * 2.50) / 1_000_000) < 1e-12
    assert cost_pts[0].attributes["tenant_id"] == "11111111-1111-1111-1111-111111111111"
    assert cost_pts[0].attributes["provider"] == "gemini"

    # tokens split by direction
    tok_dirs = {dp.attributes["direction"]: dp.value
                for dp in metrics_by_name["llm.tokens"].data.data_points}
    assert tok_dirs == {"in": 1000, "out": 500}
    _reset_module_instruments()


def test_record_llm_metrics_never_raises_without_sdk() -> None:
    """No SDK MeterProvider (API no-op meter) → record is a harmless no-op."""
    _reset_module_instruments()
    # Must not raise even with missing usage / unknown model (cost None).
    m.record_llm_metrics(
        tenant_id=None, intent=None, provider="openai", model="no-such-model",
        status="error", latency_ms=5, usage=None,
    )
    _reset_module_instruments()
