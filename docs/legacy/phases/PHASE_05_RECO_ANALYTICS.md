# Phase 05 — Recommendation (Image) + Analytics (Voice) (Intent 04 + 07)

> **Status:** ✅ **DONE** (recommend + analytics graphs verified vs code 2026-06-09). Phần production = §Production.
> **Mục tiêu:** Intent 04 (gợi ý theo ảnh) + Intent 07 (phân tích bằng giọng nói). Đủ 8 intents.
>
> **Cross-ref:** `04_INTENT_SPECS.md` Intent 04/07, `07_BEHAVIOR_LOGS.md` §6, `02_DATA_MODEL.md` (matviews, Vespa), `DECISIONS.md` ADR-043.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs recommend_by_images.py + analyzing_by_voices.py + analytics registry):
- recommend: vision.analyze+vespa.image_nearest_neighbor+analytics.co_purchased+analytics.product_corpus_size. KHÔNG vision.embed (Vespa native). vespa.nearest_neighbor→image_nearest_neighbor.
- analyzing: speech.transcribe+analytics.{aggregate,detect_anomaly,explain_trend,stock_snapshot,suggest_loan/promo/restock}+cart.get.
- analytics 10 tool thật (stock_snapshot CÓ THẬT). sales_by_month/trend_history = CHƯA CODE (không tồn tại). vision.embed = CHƯA CODE.
- §A vision.embed Gemini proxy + backfill = stale → Vespa native embed.
- §H co_purchase_matrix KHÔNG tồn tại (3 matview thật analytics_daily/_category/_product_performance); rank-profile hybrid_with_behavior KHÔNG tồn tại (6 profile thật; signals dùng bởi ai_augmented/cross_encoder_rerank). behavior-aggregator = skeleton CHƯA CODE.
- XOÁ cruft: Day1-7, Duration Tuần5, "Hackathon", demo talking points.
- THÊM production: behavior-aggregator worker, matview refresh job, personalized LTR (ADR-043), tenant-scoped analytics. -->

## Definition of Done — trạng thái thật (verified)

- [x] Upload ảnh → gợi ý kèm reason (recommend_by_images) ✅
- [x] "phân tích doanh thu nước tương 6 tháng" → chart + narrative (analyzing_by_voices) ✅
- [x] Image embedding indexed (Vespa **native** từ image_description — không backfill script) ✅
- [x] Co-purchase từ orders (analytics.co_purchased on-the-fly) ✅
- [ ] behavior-aggregator worker (Vespa signals) — 🟡 CHƯA CODE (worker skeleton)

## Scope

### A. Image Embedding — Vespa native (KHÔNG `vision.embed`)

> Vespa `product.sd` `image_embedding` embed **native** từ `image_description` (CLIP 512-dim) tại feed time — **không cần MCP `vision.embed` hay backfill script**. Recommend bằng ảnh dùng `vespa.image_nearest_neighbor` (truyền image_b64; Vespa embed query-side).

- ~~`vision.embed` (Gemini proxy / CLIP HF)~~ = 🟡 **CHƯA CODE** (doc cũ 768-dim/Gemini proxy = sai; không tồn tại MCP tool này). Cross-ref `02 §2`, `03 §5`.

### B. Intent 04 — Recommend graph (`recommend_by_images.py`) — verified

Tools thật: `vision.analyze` (category) + `vespa.image_nearest_neighbor` (visual similar) + `analytics.co_purchased` (co-bought) + `analytics.product_corpus_size`.

Flow: vision.analyze → image_nearest_neighbor (visual top-K) ∥ co_purchased(category) → **blend & rank** → LLM `attach_reasons` per item → return products + reasons.

> Blend (design): `composite = 0.5·visual_sim + 0.3·co_purchase + 0.2·trend_score` (trọng số trong code). `vespa.image_nearest_neighbor` (KHÔNG `vespa.nearest_neighbor`).

### C. Co-purchased SQL (`analytics.co_purchased`) — verified on-the-fly

```sql
WITH target_orders AS (
  SELECT DISTINCT o.id FROM orders o
  JOIN order_items oi ON oi.order_id=o.id
  JOIN products p ON p.id=oi.product_id
  WHERE p.category=$1 AND o.status='paid'
)
SELECT p.id, p.title, COUNT(*) AS freq
FROM order_items oi
JOIN target_orders t ON t.id=oi.order_id
JOIN products p ON p.id=oi.product_id
WHERE p.category != $1
GROUP BY p.id, p.title ORDER BY freq DESC LIMIT 20;
```

> Tính **on-the-fly** (không bảng/matview). Matview `co_purchase_matrix` precompute = 🔵 TÙY CHỌN (chưa cam kết, grep repo=0) — dùng khi on-the-fly chậm ở scale; reader = `co_purchased`.

### D. Intent 07 — Analytics graph (`analyzing_by_voices.py`) — verified

Tools thật: `speech.transcribe` + `analytics.{aggregate, detect_anomaly, explain_trend, stock_snapshot, suggest_loan, suggest_promo, suggest_restock}` + `cart.get`.

Flow (CODE verified, 8 node): speech_transcribe → **load_context** (Redis voice:context, voice memory reuse D-S08-NN-A) → classify_analyze (LLM: metric/dimension/time_range/filters/viz_hint) → execute_queries (analytics tools parallel) → build_insights (số liệu → chart_spec line/bar/pie) → narrate (LLM explain WHY) → **save_voice_context** → final. *(KHÔNG có node plan_queries/resolve_product_name riêng — đã gộp.)*

> `speech.synthesize(narrative)` (audio reply) = 🟡 CHƯA CODE (graph chưa gọi; backend tool có, FE deferred).

### E. Analytics MCP Tools — 10 tool thật (verified registry)

`analytics.aggregate` · `analytics.co_purchased` · `analytics.detect_anomaly` · `analytics.explain_trend` · `analytics.product_corpus_size` · `analytics.stock_snapshot` · `analytics.suggest_loan` · `analytics.suggest_price` · `analytics.suggest_promo` · `analytics.suggest_restock`.

- `aggregate`/`suggest_loan` đọc matview `analytics_daily`. Category-level đọc **raw** (comment code: `analytics_daily_category` over-count → tool dùng raw query).
- ~~`analytics.sales_by_month`~~, ~~`analytics.trend_history`~~ = 🟡 **CHƯA CODE** (không tồn tại). `stock_snapshot` = ✅ tồn tại thật.

### F. Web — Chart Renderer

Components thật: organism `ChartCard` + `charts/` (`components/icp/organisms/charts/`); `AnalyticsChartCard`/`DrillChipRow` (analytics). Library `recharts`. Auto-detect line/bar/pie từ chart_spec; dynamic từ `series.data[]` (không hard-code SVG path). Route `app/intent-04`, `intent-07`.

### G. Dev data seed (dev only)

Seed historical orders + behavior events (dev fixture cho analytics/reco có data). **Production:** dữ liệu thật + (multi-tenant) backfill `tenant_id`; không PII thật trong seed.

### H. Behavior Aggregator Worker — 🟡 CHƯA CODE (CORE production)

> `apps/workers/src/behavior-aggregator.ts` = **skeleton** (worker chưa implement). Là bridge behavior data → Vespa ranking signals.

Target (schedule ~5 phút):
1. Query `behavior_events` since last_run, GROUP BY (subject_id, event_type).
2. Update counters: impressions/clicks/add_to_cart/purchases (7d/30d) + time decay.
3. Derived: `ctr_7d`, `cvr_7d`, `velocity_score`, `trend_score`.
4. Bulk partial-update Vespa `/document/v1/<id>/update` (assign/increment).
5. **Refresh 3 matview thật** (`analytics_daily`/`analytics_daily_category`/`analytics_product_performance`) định kỳ (`REFRESH MATERIALIZED VIEW CONCURRENTLY`). *(KHÔNG có `co_purchase_matrix`.)*
6. Log run summary; last_run → Redis.

> **Vespa rank-profile:** signals (`impressions_7d`/`clicks_7d`/`purchases_7d/30d`/`ctr_7d`/`cvr_7d`/`velocity_score`/`dismissals_7d`) đã có trong `product.sd` và **được dùng bởi `ai_augmented`/`cross_encoder_rerank`** (search ai_augmented mode → cross_encoder_rerank). KHÔNG có profile `hybrid_with_behavior` (tên cũ sai). Không cần "switch default".

### I. Observability Phase 05

- Logs: `vespa.search_completed` (image_nearest_neighbor); `analytics.queried` per tool; `aggregator.run_completed{products_updated,duration_ms,events_processed}`/`run_failed` (khi worker built).
- Metrics: `icp.recommendation.served{source}`; `icp.recommendation.candidates{stage}`; `icp.aggregator.duration`/`products_updated`; `icp.vespa.signals.lag_seconds`.
- Behavior events (catalog.ts thật): `recommendation.shown/clicked/dismissed`.
- Grafana: "Recommendation Performance", "Vespa Signals Freshness". *(Bỏ panel "Co-Purchase Matrix heatmap" — matview không tồn tại.)*

## Test scenarios

| ID | Scenario | Expected | Trạng thái |
|---|---|---|---|
| RECO-01 | Upload ảnh nước tương | Top-K nước tương + co-bought | ✅ |
| RECO-02 | Ảnh category lạ | Pure visual top-K, no collab | ✅ |
| ANA-01 | "Doanh thu 6 tháng" | Line chart | ✅ |
| ANA-02 | "Tại sao Maggi giảm" | Chart + narrative (explain_trend) | ✅ |
| ANA-03 | "Hàng nào sắp hết" | Bar chart (stock_snapshot) | ✅ |
| ANA-04 | Voice không rõ | Clarify | ✅ |

## Public interfaces sẵn cho Phase 06

- 8 intents working end-to-end; chart rendering system; image similarity search proven.

---

## Production hardening (§5b)

| Hạng mục | Hiện trạng | Đề xuất + nên dùng gì | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **behavior-aggregator worker** | skeleton | implement (signals → Vespa partial update) | 🟡 CHƯA CODE | P1 |
| **Matview refresh job** | chưa có | cron `REFRESH MATERIALIZED VIEW CONCURRENTLY` 3 matview | 🟡 CHƯA CODE | P1 |
| **Per-tenant LTR `personalized` (ADR-043)** | 6 profile, không personalized | bảng `tenant_ranking_weights` + Vespa profile `personalized` (`query(w_text/w_trend/w_behavior)`); fit từ behavior_events; giữ cross_encoder_rerank fallback | 🟡 CHƯA CODE | P2 |
| **co_purchase_matrix precompute** | on-the-fly | matview khi scale (reader=co_purchased) | 🔵 TÙY CHỌN | P2 |
| **Tenant-scoped analytics** | matview no tenant_id | matview +tenant_id GROUP BY (per-shop) | 🟡 CHƯA CODE | P0 |
| **TTS audio reply (analytics)** | backend tool có | wire speech.synthesize → FE audio | 🔵 TÙY CHỌN | P2 |
| **vision.embed (nếu cần custom embed)** | Vespa native đủ | chỉ build nếu cần embed ngoài Vespa | 🔵 TÙY CHỌN | P2 |

---

## Khi Phase 05 hoàn tất

8 intents end-to-end. Production còn: behavior-aggregator + matview refresh + per-tenant LTR. Phase 06 = observability/ops/hardening.

---

**END — PHASE_05 (Production reconcile 2026-06-09).**
