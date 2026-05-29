# =============================================================================
# apps/mcp/tests/test_reasoning_engine.py
# =============================================================================
# Unit tests for the 5 math-first solvers (S-10 T01.B) per D-S10-NN-G LAW v2.0.
#
# Solvers are PURE (Option A, C-S10-NN-O) — no DB — so these are deterministic
# fixture tests with NO database / Redis required. Run from apps/mcp/:
#     pytest tests/test_reasoning_engine.py -v
#
# IMPORTANT — tests assert the FORMULA (authoritative), not the spec's illustrative
# narrative numbers. reasoning_engine_spec v2.0 worked examples contain rounded /
# inconsistent figures (surfaced Phase-2 Batch-1):
#   - explain_trend example "80/20, -18%" does NOT match its own qty/price inputs
#     (600->480, 18000->17280 actually yields 86/14, -23.2%). PVM identity holds.
#   - suggest_loan example "reputation 0.78 / 8tr" does not match formula+defaults
#     (0.59; capital depends on real unit_price). Demo headline numbers are a
#     SEED + ENV calibration target (T01.A / T01.K), not a formula change.
# =============================================================================
from __future__ import annotations

import os

import pytest

from src.tools.analytics import (
    explain_trend,
    suggest_loan,
    suggest_price,
    suggest_promo,
    suggest_restock,
)


# --- Solver 1: suggest_price -------------------------------------------------

def test_price_rising_trend_linear_scoring():
    r = suggest_price({
        "shopee_avg_price": 17500, "shopee_sample_count": 12,
        "trend_trajectory": "rising", "seller_type": None,
    })
    assert r["_trace"]["P_trend"] == 19250          # 17500 * 1.10
    assert r["_trace"]["seller_factor"] == 1.00      # None -> neutral
    assert r["suggested_price"] == round((17500 + 19250 + 17500) / 3)  # 18083
    assert r["confidence"] == round(12 / 17, 2)      # 0.71
    assert r["emitted"] is True                      # >= 0.6 gate


def test_price_falling_trend_negative_factor():
    r = suggest_price({"shopee_avg_price": 20000, "shopee_sample_count": 20,
                       "trend_trajectory": "falling"})
    assert r["_trace"]["trend_factor"] == -0.10
    assert r["_trace"]["P_trend"] == 18000


def test_price_confidence_gate_blocks_low_sample():
    r = suggest_price({"shopee_avg_price": 15000, "shopee_sample_count": 2,
                       "trend_trajectory": "stable"})
    assert r["confidence"] == round(2 / 7, 2)        # 0.29 < 0.6
    assert r["emitted"] is False


def test_price_seller_type_premium():
    r = suggest_price({"shopee_avg_price": 10000, "shopee_sample_count": 30,
                       "trend_trajectory": "stable", "seller_type": "premium"})
    assert r["_trace"]["seller_factor"] == 1.05
    assert r["_trace"]["P_seller"] == 10500


# --- Solver 2: suggest_promo -------------------------------------------------

def test_promo_drop18_elasticity_clamp():
    r = suggest_promo({"delta_pct": -18.0})
    assert r["promo_pct"] == 15                       # clamp(18/1.2=15, 5, 20)
    assert r["projected_recovery_pct"] == 18.0        # 15 * 1.2
    assert r["_trace"]["assumption"] == "demo"
    assert r["emitted"] is True


def test_promo_clamp_upper_bound():
    r = suggest_promo({"delta_pct": -50.0})           # 50/1.2 = 41.7 -> clamp 20
    assert r["promo_pct"] == 20


def test_promo_clamp_lower_bound():
    r = suggest_promo({"delta_pct": -3.0})            # 3/1.2 = 2.5 -> clamp 5
    assert r["promo_pct"] == 5


# --- Solver 3: suggest_restock ----------------------------------------------

def test_restock_spec_example():
    r = suggest_restock({"qty_7d": 35, "current_stock": 10})
    assert r["velocity_per_day"] == 5.0
    assert r["_trace"]["target_qty"] == 128           # ceil(5 * 17 * 1.5 = 127.5)
    assert r["reorder_qty"] == 118                     # 128 - 10
    assert r["days_left"] == 2                          # floor(10/5)
    assert r["emitted"] is True


def test_restock_story_arc_nuoc_tuong():
    # stock 52, ~5 days cover -> reorder ~100 (story-arc target)
    r = suggest_restock({"qty_7d": 42, "current_stock": 52})
    assert 95 <= r["reorder_qty"] <= 110               # ~101
    assert r["emitted"] is True


def test_restock_zero_velocity_no_emit():
    r = suggest_restock({"qty_7d": 0, "current_stock": 100})
    assert r["days_left"] is None                      # infinite cover
    assert r["reorder_qty"] == 0
    assert r["emitted"] is False


# --- Solver 4: explain_trend (Price-Volume-Mix) -----------------------------

def test_explain_trend_pvm_identity_holds():
    r = explain_trend({"qty_now": 480, "qty_prev": 600,
                       "price_now": 17280, "price_prev": 18000, "period": "rolling_7d"})
    t = r["_trace"]
    # identity: volume_effect + price_effect == ΔRevenue
    assert t["volume_effect"] + t["price_effect"] == t["rev_now"] - t["rev_prev"]
    assert r["direction"] == "down"
    assert r["top_driver"] == "volume"
    assert r["breakdown"][0]["pct"] + r["breakdown"][1]["pct"] == 100
    # formula-faithful (NOT the spec's stated 80/20): 86/14
    assert r["breakdown"][0]["pct"] == 86
    assert r["delta_revenue_pct"] == -23.2


def test_explain_trend_category_contribution_g1():
    r = explain_trend({"qty_now": 480, "qty_prev": 600, "price_now": 17280,
                       "price_prev": 18000, "delta_rev_category": -2505600,
                       "delta_rev_merchant": -4041290, "period": "rolling_7d"})
    assert r["category_contribution_pct"] == 62        # |2.5056M| / |4.0413M| * 100


def test_explain_trend_category_contribution_nullable():
    r = explain_trend({"qty_now": 100, "qty_prev": 80, "price_now": 1000, "price_prev": 1000})
    assert r["category_contribution_pct"] is None       # G.1 additive nullable
    assert r["direction"] == "up"


def test_explain_trend_period_default_env():
    r = explain_trend({"qty_now": 10, "qty_prev": 10, "price_now": 100, "price_prev": 100})
    assert r["period"] == os.getenv("TREND_PERIOD_DEFAULT", "rolling_7d")


# --- Solver 5: suggest_loan -------------------------------------------------

def test_loan_reputation_formula_default():
    # FORMULA: 0.4*(8/12) + 0.6*(16/30) = 0.5867 (NOT spec example 0.78)
    r = suggest_loan({"avg_monthly_revenue": 16_000_000, "tenure_months": 8,
                      "qty_7d": 35, "trend_trajectory": "rising",
                      "reorder_qty": 118, "unit_price": 35000})
    assert r["reputation"] == 0.59
    assert r["_trace"]["eligible"] is True              # gates pass
    # confidence 0.59 < default gate 0.6 -> not emitted with default env
    assert r["emitted"] is False
    assert r["_trace"]["amount_cap"] == 8_000_000        # 0.5 * 16M


def test_loan_emits_when_reputation_above_gate(monkeypatch):
    # demo-eligible path: tune saturation so a healthy merchant clears the gate
    monkeypatch.setenv("LOAN_REV_FULL", "20000000")
    r = suggest_loan({"avg_monthly_revenue": 16_000_000, "tenure_months": 8,
                      "qty_7d": 35, "trend_trajectory": "rising",
                      "reorder_qty": 118, "unit_price": 35000})
    assert r["reputation"] == 0.75                       # 0.4*0.667 + 0.6*0.8
    assert r["emitted"] is True
    assert 0 < r["suggested_amount"] <= 8_000_000
    assert r["term_months"] == 6


def test_loan_not_eligible_falling_trend():
    r = suggest_loan({"avg_monthly_revenue": 16_000_000, "tenure_months": 8,
                      "qty_7d": 35, "trend_trajectory": "falling",
                      "reorder_qty": 118, "unit_price": 35000})
    assert r["_trace"]["eligible"] is False
    assert r["emitted"] is False


def test_loan_not_eligible_short_tenure():
    r = suggest_loan({"avg_monthly_revenue": 16_000_000, "tenure_months": 2,
                      "qty_7d": 35, "trend_trajectory": "rising",
                      "reorder_qty": 118, "unit_price": 35000})
    assert r["_trace"]["eligible"] is False


def test_loan_cost_price_mode_precise(monkeypatch):
    monkeypatch.setenv("LOAN_REV_FULL", "20000000")
    r = suggest_loan({"avg_monthly_revenue": 16_000_000, "tenure_months": 8,
                      "qty_7d": 35, "trend_trajectory": "rising",
                      "reorder_qty": 118, "cost_price": 26000, "unit_price": 35000})
    assert r["_trace"]["mode"] == "cost_price"
    assert r["_trace"]["capital_need"] == 118 * 26000     # 3,068,000


# --- Cross-solver: determinism (same input -> same output) ------------------

@pytest.mark.parametrize("fn,params", [
    (suggest_price, {"shopee_avg_price": 17500, "shopee_sample_count": 12, "trend_trajectory": "rising"}),
    (suggest_promo, {"delta_pct": -18.0}),
    (suggest_restock, {"qty_7d": 35, "current_stock": 10}),
    (explain_trend, {"qty_now": 480, "qty_prev": 600, "price_now": 17280, "price_prev": 18000}),
    (suggest_loan, {"avg_monthly_revenue": 16_000_000, "tenure_months": 8, "qty_7d": 35,
                    "trend_trajectory": "rising", "reorder_qty": 118, "unit_price": 35000}),
])
def test_solver_is_deterministic(fn, params):
    assert fn(dict(params)) == fn(dict(params))
