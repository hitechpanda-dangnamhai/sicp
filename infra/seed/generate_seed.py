#!/usr/bin/env python3
"""Generate analytics_30d_demo.sql — S-10 T01.A seed (expanded Feb 1 -> May 29 2026).

Design (verified against live DB Phiên Phase-2):
  - merchant = Anh Nam (merchant1@demo.icp); orders.user_id = merchant (shipped
    dashboard convention); orders.total = SUM(line items) so analytics_daily
    (SUM o.total) == sum of analytics_daily_category revenues (CS-A consistent).
  - additive: only seed-s10-* orders; existing 50 orders untouched (zero-blast S-09).
  - backdate Anh Nam created_at -> 8 months (loan tenure gate; idempotent guard).
  - last 14 days are EXPLICITLY controlled for the rolling_7d story-arc; Feb 1..
    May 15 is rich background for the monthly chart.

Story-arc targets (rolling_7d = recent 7d vs prior 7d):
  - dau_an  : ~ -18% revenue, volume-led (~80/20)
  - nuoc_tuong: rising; Maggi 700ml velocity -> restock reorder ~100 (stock 120)
  - dau_an contributes ~62% of merchant total decline
  - loan: tenure 8m + avg_monthly_revenue (last 30d) healthy -> eligible
Headline numbers are TARGETS; real numbers come from solvers over this seed.
"""
from __future__ import annotations

import datetime as dt
import math
import random

random.seed(20260529)

TODAY = dt.date(2026, 5, 29)
START = dt.date(2026, 2, 1)

# --- clean products (exclude DEBUG/Test rows seen in live DB) ----------------
# code -> (title, price, real_stock, category)
PRODUCTS = {
    # nuoc_tuong
    "nt_nangdau":  ("Nước tương Nàng Dâu 450ml", 21000, 85, "nuoc_tuong"),
    "nt_maggi":    ("Nước tương Maggi đậm đặc 700ml", 25500, 120, "nuoc_tuong"),
    "nt_cholimex": ("Nước Tương Đậu Nành Cholimex Hương Việt Thanh Vị Chai 500ml", 30500, 100, "nuoc_tuong"),
    "nt_leekum":   ("Nước tương Lee Kum Kee Premium 150ml", 55000, 35, "nuoc_tuong"),
    # dau_an
    "da_tuongan":  ("Dầu ăn Tường An Cooking Oil 1L", 52000, 90, "dau_an"),
    "da_simply":   ("Dầu ăn Simply hướng dương 1L", 65000, 50, "dau_an"),
    "da_olive":    ("Dầu olive Bertolli Extra Virgin 500ml", 185000, 25, "dau_an"),
    # mi_tom
    "mt_haohao":   ("Mì tôm Hảo Hảo tôm chua cay 75g", 4500, 500, "mi_tom"),
    "mt_omachi":   ("Mì Omachi sườn hầm ngũ quả 80g", 9500, 180, "mi_tom"),
    "mt_shin":     ("Mì Shin Ramyun Hàn Quốc 120g", 18000, 45, "mi_tom"),
    # sua
    "su_probi":    ("Sữa chua Vinamilk Probi nha đam 65ml × 4", 22000, 150, "sua"),
    "su_vinasoy":  ("Sữa hạt Vinasoy nguyên chất 1L", 28000, 80, "sua"),
    "su_vinamilk": ("Sữa tươi Vinamilk 100% không đường 1L", 32000, 250, "sua"),
    # banh_keo
    "bk_lays":     ("Snack khoai tây Lay's vị muối 95g", 18000, 110, "banh_keo"),
    "bk_bibica":   ("Bánh trung thu Bibica đậu xanh 200g", 38000, 80, "banh_keo"),
    "bk_haribo":   ("Kẹo dẻo Haribo Goldbears 200g", 65000, 50, "banh_keo"),
}
CATS = ["nuoc_tuong", "mi_tom", "dau_an", "sua", "banh_keo"]
BY_CAT = {c: [k for k, v in PRODUCTS.items() if v[3] == c] for c in CATS}

orders = []  # (seq, code, qty, unit_price, created_at_date)
_seq = [0]


def add(code, qty, unit_price, day):
    _seq[0] += 1
    orders.append((_seq[0], code, qty, unit_price, day))


# ---------------------------------------------------------------------------
# 1) BACKGROUND  Feb 1 .. May 15  (rich monthly chart; NOT in rolling-7d window)
# ---------------------------------------------------------------------------
# month multiplier (Feb,Mar,Apr,May) per category -> growth story for chart
MONTH_MULT = {
    "nuoc_tuong": {2: 0.80, 3: 0.95, 4: 1.10, 5: 1.25},  # rising
    "mi_tom":     {2: 1.00, 3: 1.00, 4: 1.00, 5: 1.00},  # flat
    "dau_an":     {2: 1.00, 3: 1.05, 4: 1.05, 5: 0.98},  # slight late dip
    "sua":        {2: 0.90, 3: 0.95, 4: 1.00, 5: 1.08},  # gentle up
    "banh_keo":   {2: 1.00, 3: 0.92, 4: 1.00, 5: 1.10},
}
# base orders/day per category
BASE_PER_DAY = {"nuoc_tuong": 3.0, "mi_tom": 2.6, "dau_an": 1.9, "sua": 1.5, "banh_keo": 1.2}

d = START
while d <= TODAY - dt.timedelta(days=14):  # background ends before prior-7d window
    weekend = 1.35 if d.weekday() >= 5 else 1.0
    for c in CATS:
        n = BASE_PER_DAY[c] * MONTH_MULT[c][d.month] * weekend
        n_orders = max(0, int(round(n + random.uniform(-0.6, 0.6))))
        for _ in range(n_orders):
            code = random.choice(BY_CAT[c])
            _, price, _, _ = PRODUCTS[code]
            qty = random.choice([1, 1, 2, 2, 3, 4]) if price < 40000 else random.choice([1, 1, 1, 2])
            add(code, qty, price, d)
    d += dt.timedelta(days=1)

# ---------------------------------------------------------------------------
# 2) ROLLING-7d STORY-ARC  (explicit control of prior-7d vs recent-7d)
# ---------------------------------------------------------------------------
recent7 = [TODAY - dt.timedelta(days=i) for i in range(0, 7)]   # May 23..29
prior7 = [TODAY - dt.timedelta(days=i) for i in range(7, 14)]   # May 16..22


def spread(total_qty, days):
    """Split a quantity across days roughly evenly (deterministic)."""
    base = total_qty // len(days)
    rem = total_qty - base * len(days)
    out = [base] * len(days)
    for i in range(rem):
        out[i] += 1
    return out


# dau_an: prior7 = 40 @52000 (Tường An); recent7 = 34 @49800 -> -18.6%, ~80/20
for q, day in zip(spread(40, prior7), prior7):
    if q: add("da_tuongan", q, 52000, day)
for q, day in zip(spread(34, recent7), recent7):
    if q: add("da_tuongan", q, 49800, day)  # price dip drives the 20% price effect

# nuoc_tuong: rising; Maggi recent7 ~60 bottles -> reorder ~100 vs stock 120
for q, day in zip(spread(57, prior7), prior7):
    if q: add("nt_maggi", q, 25500, day)
for q, day in zip(spread(60, recent7), recent7):
    if q: add("nt_maggi", q, 25500, day)

# mi_tom: slight decline recent7 (contributes to merchant drop)
for q, day in zip(spread(150, prior7), prior7):
    if q: add("mt_haohao", q, 4500, day)
for q, day in zip(spread(120, recent7), recent7):
    if q: add("mt_haohao", q, 4500, day)

# sua: slight decline
for q, day in zip(spread(34, prior7), prior7):
    if q: add("su_vinamilk", q, 32000, day)
for q, day in zip(spread(31, recent7), recent7):
    if q: add("su_vinamilk", q, 32000, day)

# banh_keo: slight decline
for q, day in zip(spread(26, prior7), prior7):
    if q: add("bk_bibica", q, 38000, day)
for q, day in zip(spread(24, recent7), recent7):
    if q: add("bk_bibica", q, 38000, day)

# ===========================================================================
# SIMULATE V006 aggregations + solver inputs
# ===========================================================================
def rev_of(rows):
    return sum(q * p for (_, _, q, p, _) in rows)


def in_days(days):
    s = set(days)
    return [o for o in orders if o[4] in s]


prior_rows = in_days(prior7)
recent_rows = in_days(recent7)


def cat_rev(rows, cat):
    return sum(q * p for (_, code, q, p, _) in rows if PRODUCTS[code][3] == cat)


print("=" * 64)
print("TOTAL orders:", len(orders), "| order_items:", len(orders))
print("Total revenue (all):", f"{rev_of(orders):,}")

# monthly chart preview
print("\n--- MONTHLY revenue (chart D) ---")
for mo in (2, 3, 4, 5):
    mrows = [o for o in orders if o[4].month == mo]
    print(f"  2026-{mo:02d}: orders {len(mrows):4d}  revenue {rev_of(mrows):>12,}")

# last 30 days -> loan avg_monthly_revenue
last30 = in_days([TODAY - dt.timedelta(days=i) for i in range(0, 30)])
avg_monthly_revenue = rev_of(last30)
print(f"\n--- LOAN input: last-30d revenue = {avg_monthly_revenue:,} ---")

# rolling-7d per category
print("\n--- ROLLING 7d (recent vs prior) per category ---")
merch_prev = rev_of(prior_rows)
merch_now = rev_of(recent_rows)
merch_delta = merch_now - merch_prev
for c in CATS:
    rp, rn = cat_rev(prior_rows, c), cat_rev(recent_rows, c)
    dpct = (rn - rp) / rp * 100 if rp else 0
    print(f"  {c:11} prior {rp:>10,}  recent {rn:>10,}  Δ {rn-rp:>+10,}  ({dpct:+.1f}%)")
print(f"  {'MERCHANT':11} prior {merch_prev:>10,}  recent {merch_now:>10,}  Δ {merch_delta:>+10,}")

# dau_an explain_trend (Tường An only, single product/price per window)
da_prev_rows = [o for o in prior_rows if o[1] == "da_tuongan"]
da_now_rows = [o for o in recent_rows if o[1] == "da_tuongan"]
qp = sum(q for (_, _, q, _, _) in da_prev_rows); pp = 52000
qn = sum(q for (_, _, q, _, _) in da_now_rows); pn = 49800
vol = (qn - qp) * pp
pri = (pn - pp) * qn
drev = qn * pn - qp * pp
denom = abs(vol) + abs(pri)
print("\n--- explain_trend (dau_an Tường An) ---")
print(f"  qty {qp}->{qn}  price {pp}->{pn}  Δrev% = {drev/(qp*pp)*100:.1f}%")
print(f"  volume_effect {vol:,} ({abs(vol)/denom*100:.0f}%)  price_effect {pri:,} ({abs(pri)/denom*100:.0f}%)")
da_delta_cat = cat_rev(recent_rows, "dau_an") - cat_rev(prior_rows, "dau_an")
contrib = abs(da_delta_cat) / abs(merch_delta) * 100 if merch_delta else 0
print(f"  category_contribution = |{da_delta_cat:,}| / |{merch_delta:,}| = {contrib:.0f}%")

# restock (Maggi recent7)
maggi_qty_7d = sum(q for (_, code, q, _, _) in recent_rows if code == "nt_maggi")
velocity = maggi_qty_7d / 7
target = math.ceil(velocity * (14 + 3) * 1.5)
reorder = max(0, target - 120)
print("\n--- restock (Maggi 700ml, stock 120) ---")
print(f"  qty_7d {maggi_qty_7d}  velocity {velocity:.2f}  target {target}  reorder {reorder}")

# loan (tenure 8 after backdate)
rep = 0.4 * min(8 / 12, 1) + 0.6 * min(avg_monthly_revenue / 30_000_000, 1)
print(f"\n--- loan: reputation = {rep:.2f}  eligible(tenure8,rising,vel>0)=True  emit={rep>=0.6} ---")

# ---- assertions (defensible ranges) ----
assert 150 <= len(orders) <= 1600, len(orders)
da_pct = drev / (qp * pp) * 100
assert -22 <= da_pct <= -14, ("dau_an Δ%", da_pct)
assert 72 <= abs(vol) / denom * 100 <= 88, ("volume share", abs(vol)/denom*100)
assert 50 <= contrib <= 75, ("contribution", contrib)
assert reorder >= 60, ("restock reorder", reorder)
assert rep >= 0.6, ("loan reputation", rep)
assert merch_delta < 0, ("merchant must decline recent7", merch_delta)
print("\n✅ STORY-ARC SIMULATION PASS — proceeding to emit SQL")

# ===========================================================================
# EMIT SQL
# ===========================================================================
def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


prod_rows = ",\n    ".join(
    f"({sql_str(code)}, (SELECT id FROM products WHERE merchant_id=(SELECT id FROM m) AND title={sql_str(PRODUCTS[code][0])}))"
    for code in PRODUCTS
)

od_rows = ",\n    ".join(
    f"({seq}, {sql_str(code)}, {qty}, {price}, TIMESTAMPTZ '{day.isoformat()} "
    f"{8 + (seq % 12):02d}:{(seq * 7) % 60:02d}:00+07')"
    for (seq, code, qty, price, day) in orders
)

sql = f"""-- ============================================================================
-- infra/seed/analytics_30d_demo.sql  (S-10 T01.A — Phase 2 Batch 2)
-- ============================================================================
-- Seed {len(orders)} paid orders (1 item each) for merchant Anh Nam
-- (merchant1@demo.icp) spanning 2026-02-01 .. 2026-05-29 for rich analytics +
-- a controlled rolling-7d story-arc (dau_an decline / nuoc_tuong rising / loan).
--
-- ADDITIVE + idempotent + zero-blast:
--   - touches ONLY seed-s10-* orders (existing 50 orders untouched).
--   - re-runnable: deletes prior seed-s10-* first (CASCADE -> order_items).
--   - backdates Anh Nam created_at to 8 months ONLY if still fresh (<3m) so the
--     loan tenure gate (>=3m) can fire. Guarded -> idempotent.
--   - orders.total = qty*unit_price (single line) -> analytics_daily (SUM total)
--     stays consistent with analytics_daily_category (SUM qty*unit_price).
--   - NO schema change. NO product/stock mutation.
-- Source-verified: live DB (orders empty for Anh Nam, mat views present),
--   dashboard.service.ts (orders.user_id = merchant), V006 column defs.
-- ============================================================================

BEGIN;

-- (a) loan tenure: backdate merchant created_at (guarded, idempotent)
UPDATE users
   SET created_at = NOW() - INTERVAL '8 months'
 WHERE email = 'merchant1@demo.icp'
   AND created_at > NOW() - INTERVAL '3 months';

-- (b) idempotent cleanup of any prior S-10 seed run
DELETE FROM orders WHERE idempotency_key LIKE 'seed-s10-%';

-- (c) bulk insert orders + order_items (linked by seq via idempotency_key)
WITH m AS (
  SELECT id FROM users WHERE email = 'merchant1@demo.icp'
),
prod(code, id) AS (
  VALUES
    {prod_rows}
),
od(seq, code, qty, unit_price, created_at) AS (
  VALUES
    {od_rows}
),
ins AS (
  INSERT INTO orders (user_id, status, total, idempotency_key, created_at)
  SELECT (SELECT id FROM m), 'paid', od.qty * od.unit_price,
         'seed-s10-' || od.seq, od.created_at
  FROM od
  RETURNING id, idempotency_key
)
INSERT INTO order_items (order_id, product_id, qty, unit_price)
SELECT ins.id, prod.id, od.qty, od.unit_price
FROM ins
JOIN od   ON od.seq = split_part(ins.idempotency_key, '-', 3)::int
JOIN prod ON prod.code = od.code;

COMMIT;

-- (d) refresh V006 materialized views (plain; CONCURRENTLY needs unique idx on all 3)
REFRESH MATERIALIZED VIEW analytics_daily;
REFRESH MATERIALIZED VIEW analytics_daily_category;
REFRESH MATERIALIZED VIEW analytics_product_performance;

-- (e) self-verify the story-arc after seed (run + eyeball)
\\echo === VERIFY: monthly revenue (chart D) ===
SELECT to_char(day,'YYYY-MM') AS month, SUM(revenue)::bigint AS revenue, SUM(orders_count) AS orders
FROM analytics_daily
WHERE merchant_id=(SELECT id FROM users WHERE email='merchant1@demo.icp')
GROUP BY 1 ORDER BY 1;

\\echo === VERIFY: rolling 7d category (recent vs prior) ===
WITH m AS (SELECT id FROM users WHERE email='merchant1@demo.icp')
SELECT category,
       SUM(revenue) FILTER (WHERE day > CURRENT_DATE - 7)  AS recent7,
       SUM(revenue) FILTER (WHERE day <= CURRENT_DATE - 7 AND day > CURRENT_DATE - 14) AS prior7
FROM analytics_daily_category
WHERE merchant_id=(SELECT id FROM m) AND day > CURRENT_DATE - 14
GROUP BY category ORDER BY category;

\\echo === VERIFY: Maggi qty_7d (restock input) ===
SELECT title, qty_7d, qty_30d
FROM analytics_product_performance
WHERE merchant_id=(SELECT id FROM users WHERE email='merchant1@demo.icp')
  AND title LIKE 'Nước tương Maggi%';

\\echo === VERIFY: merchant 30d revenue (loan input) + tenure ===
SELECT (SELECT round(EXTRACT(EPOCH FROM (NOW()-created_at))/2592000.0,1)
          FROM users WHERE email='merchant1@demo.icp') AS tenure_months,
       SUM(revenue)::bigint AS rev_30d
FROM analytics_daily
WHERE merchant_id=(SELECT id FROM users WHERE email='merchant1@demo.icp')
  AND day > CURRENT_DATE - 30;
"""

with open("/home/claude/work/analytics_30d_demo.sql", "w") as f:
    f.write(sql)
print("\nSQL written:", "/home/claude/work/analytics_30d_demo.sql")
print("SQL size (KB):", round(len(sql) / 1024, 1))
