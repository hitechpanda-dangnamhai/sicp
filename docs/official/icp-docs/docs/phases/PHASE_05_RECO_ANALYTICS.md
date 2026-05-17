# Phase 05 — Recommendation (Image) + Analytics (Voice)

> **Duration:** Tuần 5  
> **Mục tiêu:** Intent 04 (recommendation by image), Intent 07 (analytics by voice). Đóng đủ 8 intents.

## Definition of Done

- [ ] Customer upload ảnh sản phẩm họ thích → ICP trả 10 gợi ý kèm reason
- [ ] Merchant nói "phân tích doanh thu nước tương 6 tháng qua" → chart line + narrative
- [ ] Image embedding indexed cho 50 products (run once)
- [ ] Co-purchased data từ orders đủ cho collaborative filter

## Scope

### A. Image Embedding Pipeline

Vespa schema đã có `image_embedding` field từ Phase 01.

MCP `vision.embed`:
- Input: image_b64
- Implementation: 
  - Option A (simpler): dùng Gemini multimodal — pass image + prompt "Describe in 1 sentence" → text.embed kết quả → fake là image_embedding
  - Option B (better): dùng CLIP via Hugging Face Inference API
  - **Đề xuất Option A cho Hackathon** (simpler, no extra dependency)

Script `scripts/backfill-image-embeddings.ts`:
- Loop 50 products, fetch image_url, gen embedding, update Vespa

### B. Intent 04 Subgraph

`apps/ai/src/graphs/intents/recommend_by_images.py`:
1. `vision.embed` (image)
2. `vision.analyze` (để biết category)
3. Parallel:
   - `vespa.nearest_neighbor` (top 20 visual similar in same category)
   - `analytics.co_purchased(category)` (top items co-bought with this category)
4. `blend_and_rank`:
   - composite_score = 0.5 * visual_sim + 0.3 * co_purchase_count + 0.2 * trend_score
   - Take top 10
5. `attach_reasons` (LLM 1-shot: "Tại sao sản phẩm này similar?")
6. Return products + reasons

### C. Co-Purchased SQL

MCP `analytics.co_purchased`:
```sql
WITH target_orders AS (
  SELECT DISTINCT o.id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE p.category = $1 AND o.status = 'paid'
)
SELECT p.id, p.title, COUNT(*) as freq
FROM order_items oi
JOIN target_orders t ON t.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE p.category != $1
GROUP BY p.id, p.title
ORDER BY freq DESC
LIMIT 20;
```

### D. Intent 07 Subgraph — Analytics by Voice

`apps/ai/src/graphs/intents/analyzing_by_voices.py`:
1. `speech.transcribe`
2. `classify_analytics_intent` (LLM structured output):
   ```json
   {
     "metric": "revenue" | "qty" | "trend" | "stock",
     "dimension": "month" | "category" | "product",
     "filters": {"product_name"?, "category"?},
     "range_months": 6,
     "viz_hint": "line" | "bar" | "pie"
   }
   ```
3. `resolve_product_name` (nếu filters.product_name → vespa.hybrid_search top-1 → product_id)
4. `plan_queries` (LLM decides which analytics tools to call)
5. `execute_queries` (parallel)
6. `synthesize_narrative` (LLM với data context, explain WHY trend tăng/giảm)
7. `build_chart_spec`:
   ```json
   {
     "type": "line",
     "title": "Doanh thu nước tương Maggi",
     "x_axis": "Tháng",
     "y_axis": "VND",
     "series": [{"name": "Maggi", "data": [...]}]
   }
   ```
8. Optional: `speech.synthesize(narrative)` → audio reply
9. Return chart + narrative + audio_url

### E. Analytics MCP Tools

`apps/mcp/src/analytics/`:
- `sales_by_month.py`
- `trend_history.py` (Vespa query — store trend snapshots daily, but for Hackathon: fake from `products.trend_score` + random noise)
- `stock_snapshot.py`

### F. Web — Recharts Chart Renderer

Files:
```
apps/web/src/components/chart/
  chart-renderer.tsx    ← consume chart_spec JSON
  line-chart.tsx
  bar-chart.tsx
  pie-chart.tsx
```

Library: `recharts`. Component auto-detect type từ spec, render phù hợp.

### G. Mock Data Augmentation

Để analytics + recommendation có dữ liệu đẹp:
- Seed 200 orders trong 6 tháng qua (mỗi tháng ~30 orders)
- Phân bố: nước tương trend giảm dần, nước giải khát tăng dần, mì tôm flat
- Stock varied
- **Seed ~25K behavior events spread across 6 months** (xem `07_BEHAVIOR_LOGS.md` section 11):
  - `search.performed` × 5000 với queries phổ biến
  - `search.result_impressed` × 12000
  - `search.result_clicked` × 3000 (CTR ~25%)
  - `product.viewed` × 4000
  - `cart.item_added` × 1000
  - `checkout.completed` × 200 (mapping 1-1 với orders đã seed)
  - Phân bố theo timeline để aggregator output realistic trends

Script `scripts/seed-historical-orders.ts` + `scripts/seed-behavior-events.ts`.

### H. Behavior Aggregator Worker (CORE PHASE 05)

Đây là **bridge từ behavior data → Vespa ranking signals**, làm cho recommendation thông minh.

File: `apps/workers/src/behavior-aggregator.ts`

```
Schedule: every 5 minutes

Steps:
1. Query Postgres behavior_events since last_run timestamp
   GROUP BY (subject_id, event_type) 
   COUNT(*)

2. Update product counters in memory:
   - impressions_7d, clicks_7d, add_to_cart_7d, purchases_7d
   - impressions_30d, ...
   - Apply time decay: counters older than window → subtract

3. Compute derived metrics per product:
   - ctr_7d  = clicks_7d / max(impressions_7d, 1)
   - cvr_7d  = purchases_7d / max(clicks_7d, 1)
   - velocity_score = exp_smoothing(daily_purchases, alpha=0.3)
   - trend_score    = 0.3*ctr_7d + 0.4*velocity_score + 0.3*growth_30d

4. Bulk partial-update Vespa via /document/v1/<id>/update:
   {
     "fields": {
       "impressions_7d": { "assign": NEW_VALUE },
       "clicks_7d":      { "assign": NEW_VALUE },
       "ctr_7d":         { "assign": COMPUTED },
       "trend_score":    { "assign": COMPUTED },
       ...
     }
   }
   Vespa supports atomic operations: "increment", "assign", "add"

5. Refresh Postgres materialized view co_purchase_matrix (hourly, less frequent)

6. Log run summary: products_updated, duration_ms, last_run timestamp persisted to Redis
```

State persistence:
- Redis key `aggregator:last_run` → ISO timestamp
- Redis key `aggregator:counters:{product_id}` → JSON with all counters (cache để khỏi recalc từ đầu)

**Vespa rank profile được update** để dùng signals này — schema đã LOCK ở `07_BEHAVIOR_LOGS.md` section 6.1, rank profile `hybrid_with_behavior`. Phase 05 chỉ deploy lại schema + switch search default từ `hybrid` sang `hybrid_with_behavior`.

### I. Observability Phase 05

**Operational logs:**
- `vision.embedded` cho image embedding tool
- `vespa.search_completed` cho nearest_neighbor (separate metric label)
- `analytics.queried` cho mỗi analytics tool call
- `vespa.partial_update_completed` per product trong aggregator
- `aggregator.run_completed` với fields `{products_updated, duration_ms, events_processed}`
- `aggregator.run_failed` (error level)

**Metrics:**
- Counter `icp.recommendation.served{source=image/product/cart}`
- Histogram `icp.recommendation.candidates{stage=visual/collab/blended}` (số candidates each stage)
- Histogram `icp.aggregator.duration`
- Counter `icp.aggregator.products_updated`
- Gauge `icp.vespa.signals.lag_seconds` (now - aggregator.last_run)

**Behavior events:**
- `recommendation.shown` với `source`, `seed_product_id`, `products[].position`, `products[].reason`
- `recommendation.clicked` / `recommendation.dismissed` (track CTR của reco)
- `analytics.queried` / `analytics.chart_viewed`

→ Recommendation CTR là feedback loop quan trọng nhất. Sau demo, có thể show: "Reco CTR tăng 18% sau khi enable behavior signals".

**Grafana dashboards mới:**
- "Recommendation Performance": served vs clicked rate, by source
- "Vespa Signals Freshness": aggregator lag, last_run timestamp
- "Co-Purchase Matrix": top pairs heatmap (D3 in custom panel) — wow factor

## Tasks ordering

### Day 1 — Vision embed + backfill
- MCP `vision.embed` (gemini multimodal as proxy), span + log
- Backfill script chạy thành công cho 50 products
- Verify: Vespa search by image_embedding trả results đúng category

### Day 2 — Recommend subgraph
- LangGraph intent 04 với span hierarchy
- Blend + rank logic
- LLM reason generation per item (track tokens)
- Tracker: emit `recommendation.shown` server-side

### Day 3 — Co-purchased SQL + seed historical orders + behavior events
- 200 orders seed + 25K behavior events seed
- SQL tool `analytics.co_purchased`
- Materialized view `co_purchase_matrix` created + refreshed

### Day 4 — Behavior aggregator worker + Vespa schema update
- Update Vespa schema thêm signal fields + rank profile `hybrid_with_behavior`
- Implement aggregator worker
- Run 1 lần manually, verify Vespa fields updated correctly
- Switch search default sang `hybrid_with_behavior`

### Day 5 — Analytics tools + intent 07 subgraph
- 3 analytics SQL tools với span + log
- Intent 07 graph (analyze → plan → execute → synthesize)

### Day 6 — Chart renderer Web + voice analytics e2e
- Recharts components
- Chart spec → component mapping
- Tracker: emit `analytics.chart_viewed` với duration
- Voice transcribe trong intent 07, demo "phân tích trend nước tương"

### Day 7 — Recommendation UI + polish
- Image upload UI với "find similar" mode
- Reason display per product card
- Tracker: emit `recommendation.clicked` on card click

## Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| RECO-01 | Upload ảnh chai nước tương Maggi | Top 10 nước tương khác + 2-3 sp co-bought (mì tôm?) |
| RECO-02 | Upload ảnh category không có trong DB | Pure visual top 10, không có collab |
| ANA-01 | "Doanh thu 6 tháng qua" | Line chart 6 điểm |
| ANA-02 | "Tại sao Maggi giảm" | Chart + narrative đề cập trend score giảm |
| ANA-03 | "Hàng nào sắp hết" | Bar chart stock by product |
| ANA-04 | Voice quá ngắn/không rõ | Ask clarify |

## Public interfaces sẵn cho Phase 06

- Toàn bộ 8 intents working end-to-end
- Chart rendering system
- Image similarity search proven

---

## Khi xong Phase 05

Tạo `PHASE_05_HANDOFF.md`. Phase 06 chỉ là polish, không thêm feature.
