# Log & Event Catalog

> Append-only registry. Mọi message name (operational log) và event_type (behavior event) phải có entry ở đây trước khi dùng trong code.

> **Registry append-only — entry mới phải đăng ký TRƯỚC khi dùng (CLAUDE.md DoD §5 +
> §11 Observability). Verify quality: S-AUDIT định kỳ (mỗi 10 slice / tháng). Single
> Home của registry log + behavior event — `07_BEHAVIOR_LOGS.md` đã hoà tan; mọi
> event_type sống ở đây + Zod schemas ở `packages/shared-types/src/behavior/`. SSE
> event catalog: source duy nhất = `packages/shared-types/src/sse/intent-stream.ts`
> (Zod), KHÔNG chép vào registry này (mầm drift).**

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs live code):
⚠️ Kafka CHƯA WIRE: KHÔNG có topic `icp.*` nào trong code, KHÔNG có kafkajs/@nestjs/microservices/
producer/consumer. "subscribe" thật = Redis pub/sub cho SSE (`sse:pubsub:{rid}`). → Mọi log/event do
WORKER phát (worker-payment/outbox/inventory/notif), `event.published/consumed` qua Kafka, `kafka.*`,
topic `icp.*` = CHƯA CODE (workers = skeleton; xem 01 §1). Log gateway/ai/mcp (auth/intent/MCP/Vespa/
vision/speech/tracker/SSE-pubsub) + Pino schema thì CÓ thật (xem 06). §B behavior event types = REAL ở
packages/shared-types/src/behavior/catalog.ts (PROPERTIES_SCHEMA_MAP). -->

## A. Operational Log Messages

> **Verified TRỰC TIẾP code 2026-06-09** — grep structlog `apps/ai`+`apps/mcp` = **90 event-name**; pino `apps/gateway` = **83 event-name**. **Tên event dưới = tên THẬT trong code.** Service: `gateway` (TS/pino) · `ai` (py/structlog) · `mcp` (py/structlog). Cột `fields` = mức spec (tên đã verify; payload chi tiết cần đọc từng call). **Worker logs + Kafka = 🟡 CHƯA CODE** (workers skeleton, Kafka chưa wire). **Graph→log mapping verified per-file:** analyze.*=analyzing_by_voices · voice.*=buying_by_voices · parse_filters/typo/per_product_reason/copurchase/mcp.error=searching_by_text · generate_description/import/vision_analyze.no_image=importing_by_images · recommend.*=recommend_by_images · cart.cleared_via_graph/cart_graph=cart_by_text · llm.*=tools/llm_client. *(Lưu ý: grep tên là line-based → có thể sót log multi-line; LLM đã đủ 9 tên gồm fallback_to_openai/json_parse_failed verified qua orchestration.)*

### Auth (gateway) ✅
`auth.login_succeeded` · `auth.login_failed` · `auth.logout_succeeded` · `auth.token_invalid` · `auth.token_refreshed` · `auth.refresh_rejected` · `auth.me_served` · `auth.password_reset_requested` · `auth.tenant_switch_rejected`.
- **reason values thật (bare):** `invalid_credentials` / `refresh_missing` / `session_not_found`.
- **`auth.tenant_switch_rejected.reason`:** `not_member` (S-P0-01 T02 — POST /auth/switch-tenant verify membership; ADR-046 amend c). Switch THÀNH CÔNG = `tenant.switched` (Tenant section).
- 🟡 **CHƯA CODE:** `auth.session_revoked`.

### Idempotency (gateway) ✅
`idempotency.cache_hit` · `cached_response_stored` · `lock_acquired` · `lock_conflict` · `lock_released_on_disconnect` · `lock_release_failed` · `cache_corrupted` · `cache_write_failed`.
- **Mirror set** cho `POST /intent/{id}/action`: `intent_action_idempotency.*` (8 tên y hệt).

### Intent / AI dispatch (gateway + ai) ✅ — RECONCILE
- **Gateway:** `intent.received` · `intent.failed` · `intent.action_received` · `intent.action_failed` · `intent.suggest_attrs_received` · `intent.suggest_attrs_done` · `intent.suggest_attrs_failed` · `intent.sse_opened` · `intent.sse_session_missing` · `intent.sse_idle_timeout` · `intent.sse_idle_timeout_resume_failed`; `ai_client.initialized/health_ok/unhealthy/unreachable/intent_dispatched/intent_failed/intent_timeout/intent_resume_ok/intent_resume_failed`.
- **AI:** `intent.received` · `intent.classified` · `intent.checkpoint_cleaned` · `intent.checkpoint_cleanup_failed` · `intent.first_card_emitted` (verified `apps/ai/src/tools/redis_publisher.py:297` + `searching_by_text.py:614`; pair với §B `search.first_card_rendered` D-S04-14 LAW FE-side time-to-paint).
- 🟡 **CHƯA CODE (ops log target):** `intent.completed`/`intent.degraded`/`intent.unknown`/`intent.sse_closed`/`intent.sse_heartbeat_sent`. **Hiện code dùng:** dispatch=`ai_client.intent_dispatched`; interrupt/resume per-graph (`analyze.interrupt_clarify`/`analyze.resumed`); lifecycle=`intent.sse_idle_timeout`+`sse.pubsub.unsubscribed`; degrade=`analyze.classify.timeout_degrade`/`parse_filters.timeout_fallback`.

### SSE Pub/Sub (gateway) ✅
`sse.pubsub.subscribed` · `sse.pubsub.forwarded` · `sse.pubsub.unsubscribed` · `sse.pubsub.subscribe_failed`. 🟡 `sse.pubsub.published` (AI-side) chưa thấy log.

### MCP RPC layer (mcp) ✅ — RECONCILE
`rpc.received` · `rpc.parse_error` · `rpc.tenant_missing` · `tool.method_not_found` · `tool.invalid_params` · `tool.internal_error` · `tool.duplicate_registration` · `policies.unknown_op`.
- `mcp.error` = **ai** (emit trong `searching_by_text` khi MCP client lỗi).

### LLM (ai) ✅ — RECONCILE
`llm.gemini.client_init` · `llm.gemini.fallback_to_openai` · `llm.gemini.init_failed` · `llm.gemini.json_parse_failed` · `llm.gemini.no_api_key` · `llm.openai.init_failed` · `llm.openai.json_parse_failed` · `llm.openai.no_api_key` · `llm.mock_timeout`.

### Vision (mcp) ✅ — RECONCILE
`vision.analyze.failed` · `vision.analyze.parse_failed` · `vision.analyze.timeout` · `vision.suggest_attributes.failed` · `vision.suggest_attributes.timeout` · `vision.gemini.initialized`.
- 🟡 **CHƯA CODE:** `vision.embedded` (không có embed tool — embed ảnh native trong Vespa 512-d). Success path không log; chỉ `*.failed/timeout/parse_failed`.

### Speech (mcp) ✅ — RECONCILE
`speech.transcribe.failed` · `speech.transcribe.timeout` · `speech.synthesize.failed` · `speech.gemini.initialized`.

### Search graph (ai) ✅ — NEW (doc thiếu)
`parse_filters.timeout_fallback` · `typo.skipped_multiword` · `typo.timeout_skipped` · `per_product_reason.error`.

### Import graph (ai) ✅ — NEW
`generate_description.format_error` · `import.auto_commit_no_cards` · `vision_analyze.no_image`.

### Voice — buying_by_voices (ai) ✅ — NEW
`voice.transcribe.unexpected` · `voice.parse.unexpected` · `voice.reason_need.no_category` · `voice.reason_need.no_hits` · `voice.reason_need.vespa_error` · `voice.reason_need.unexpected` · `voice.recall_done` · `voice.unknown_action_route`.

### Voice — analyzing_by_voices (ai) ✅ — NEW
`analyze.transcribed` · `analyze.transcribe.preset_text` · `analyze.transcribe.unexpected` · `analyze.classify.prompt_missing` · `analyze.classify.timeout_degrade` · `analyze.classify.unexpected` · `analyze.context_loaded` · `analyze.context.malformed` · `analyze.context_saved` · `analyze.context_save_failed` · `analyze.queries_done` · `analyze.queries.unexpected` · `analyze.insights_built` · `analyze.insights.unexpected` · `analyze.narrated` · `analyze.narrate.prompt_missing` · `analyze.narrate.timeout_fallback` · `analyze.narrate.unexpected` · `analyze.interrupt_clarify` · `analyze.resumed` · `analyze.nodata` · `analyze.error_emitted`.

### Recommend graph (ai) ✅ — NEW
`recommend.vision.no_image` · `recommend.vision.mcp_error` · `recommend.saver.cleanup_error`.

### Co-purchase (ai — node `co_purchase_lookup` trong searching_by_text) ✅ — NEW
`copurchase.no_anchor_category` · `copurchase.no_fixture_match` · `copurchase.fixture_load_failed`.

### Analytics MCP (mcp) ✅
`analytics.aggregate.done` · `analytics.detect_anomaly.done` · `analytics.stock_snapshot.done`.

### Products (gateway + mcp) ✅ — NEW
`products.update.vespa_reindex_failed` (gateway) · `product.fetched` · `product.not_found` (mcp).

### Dashboard (gateway) ✅ — NEW
`dashboard.stats_served` · `dashboard.insight_served` · `dashboard.insight_degraded`.

### Vespa (mcp) ✅ — RECONCILE
`vespa.search.http_error` · `vespa.search_trend.http_error`.
- 🟡 **CHƯA CODE:** `vespa.partial_update_completed` (worker-aggregator skeleton). Success path search không log; chỉ `*.http_error`.

### gtrends (mcp) ✅ — RECONCILE
`gtrends.fixture.loaded` (= **fixture/mock**; crawler thật ADR-039 CHƯA CODE).
- 🟡 **CHƯA CODE (target khi wire crawler thật ADR-039):** `gtrends.fetched`/`cache_hit`/`unavailable`/`rate_limited` — **nên dùng** khi thay fixture.

### Cards (mcp) ✅ — RECONCILE
`cards.list_pending.done` · `card.created` (verified `apps/mcp/src/tools/cards.py:152`).
- 🟡 `card.expired` (worker-cardgen) = **CHƯA CODE** (worker skeleton — BACKLOG §3 P1 #14). `card.accepted`/`card.rejected` = **behavior event** (§B), không phải ops log.

### Cart (gateway + ai) ✅ — RECONCILE
- **Gateway (REST):** `cart.get_received` · `cart.item_add_received` · `cart.item_remove_received` · `cart.qty_change_received` · `cart.clear_received` · `cart.promo_apply_received` · `cart.promo_remove_received` · `cart.mcp_error` · `cart.mcp_network_error` · `cart.mcp_timeout` · `cart.endpoint_error`.
- **AI (graph):** `cart.cleared_via_graph` · `cart_graph.unknown_entry_intent`.
- **MCP (cart tool):** `cart.promo_removed` · `cart.promo_fixture_load_failed` · `cart.free_gift_fixture_load_failed`.
- **Node names verified 6** (cart graph): clear_confirm_prompt/clear_execute/cart_view/stock_issue_lookup/stock_resolve/final — xem 04/PHASE_03.

### Outbox (mcp) ✅ — NEW
`event.appended` (verified `apps/mcp/src/tools/events.py:138`).
- Outbox WRITE đã code (same-txn `published_at=NULL`, ADR-006). Relay→Kafka + sweeper vẫn 🟡 CHƯA CODE (Kafka chưa wire — xem Domain Events banner dưới + BACKLOG §3 P1 #10/#11).

### Domain Events — 🟡 CHƯA CODE (giữ banner)
> Kafka chưa wire (không topic `icp.*`, không producer/consumer). `event.published/consumed/publish_retried/handler_failed` = **target** tới khi event bus + workers implement.

### Orders & Payments — 🟡 CHƯA CODE (giữ banner)
> workers (payment/inventory/notif consumer) = skeleton. Verified KHÔNG có `order.*`/`payment.*`/`stock.*`/`notification.*` trong gateway/ai/mcp → tất cả = **target**.

### System / Health (gateway + ai) ✅ — RECONCILE
`service.started` · `service.shutting_down` · `service.bootstrap_failed` · `service.shutdown_failed` · `redis.connected` · `redis.unavailable` · `db.pool_closed` · `db.pool_idle_client_error` · `env.validation_failed` · `openapi.exported` (gateway); `otel.shutdown_failed` (mcp).
- 🟡 **CHƯA CODE:** `kafka.consumer_lag_high` (Kafka chưa wire).

### Tracker / Behavior Ingest (gateway) ✅
`tracker.batch_received` · `tracker.batch_persisted` · `tracker.event_dropped` · `tracker.persist_failed` · `tracker.loopback_failed` · `tracker.loopback_skipped_no_tenant`; `db.behavior_partition_missing` · `db.pool_idle_client_error` · `db.pool_closed`.
- **`tracker.event_dropped.reason` (closed set):** `properties_schema_mismatch` / `occurred_at_future` / `occurred_at_too_old` (07_BEHAVIOR §9.2).
- **`tracker.loopback_skipped_no_tenant`** (S-P0-01 T02): loopback auth event (signed_in/out) của customer GLOBAL (JWT tenant_id=null, không context shop) → SKIP emit, KHÔNG persist NULL. KHÔNG áp dụng cho /track (đã resolve qua chain JWT→X-Tenant-Id→400, ADR-046 amend b).

### Tenant resolution (gateway) ✅ — NEW (S-P0-01 T02, amend c)
`tenant.resolved` · `tenant.context_missing` · `tenant.membership_denied` · `tenant.switched` · `tenant.landing_resolved`; `public.tenant_not_found`.
- **`tenant.resolved.source`:** `header` (ADR-046 amend c: active tenant = URL/X-Tenant-Id; JWT KHÔNG mang active tenant).
- **`tenant.context_missing`**: endpoint cần tenant nhưng thiếu X-Tenant-Id → 400 `TENANT_CONTEXT_MISSING` (CẤM silent drop / NULL persist).
- **`tenant.membership_denied`**: TenantMembershipGuard — URL tenant ∉ jwt.tenant_ids → 403 `TENANT_FORBIDDEN`.
- **`tenant.switched`** (fields: `from_tenant_id`, `to_tenant_id`, `session_id`): POST /auth/switch-tenant cập nhật sessions.last_active_tenant_id (KHÔNG re-issue token).
- **`tenant.landing_resolved.source` (closed set):** `last_active` | `onboarding` — GET /auth/landing redirect resolution.
- **`public.tenant_not_found`**: GET /public/tenant-by-slug/:slug không khớp tenant active → 404.

## B. Behavior Event Types

Từ `docs/archive-v1/07_BEHAVIOR_LOGS.md`. Format: `<domain>.<verb>`.

> **CODE (verified 2026-06-09):** nguồn sự thật = `packages/shared-types/src/behavior/catalog.ts` (`PROPERTIES_SCHEMA_MAP`) + các file `*-events.ts`. Event types đã có code: `session.started`, `product.viewed`, `cart.item_added/viewed/item_removed/qty_changed/cleared/promo_applied/promo_removed`, `auth.signed_in/signed_out/password_reset_requested`, `nav.tile_clicked/settings_section_opened`, `search.suggested_chip_tapped/followup_filter_tapped/typo_corrected/variant_degraded/first_card_rendered`, `product.import_started/import_completed/import_abandoned`, `card.shown`, `error.report_requested`… Catalog §B dưới đây phải khớp map này (event nào ở §B mà KHÔNG có trong map = CHƯA CODE).

### Session & Auth
| event_type | Required properties |
|---|---|
| `session.started` | `source: 'web'\|'mobile'` |
| `session.ended` | `duration_seconds: int` |
| `auth.signed_in` | `method: 'password'` |
| `auth.signed_out` | `{}` |
| `auth.password_reset_requested` | `email_hash: str` (SHA-256 hex truncated 16 chars per PII redact; S-03 C-03 stub Phase 02 — no real SMTP) |

### Discovery
*Extended S-04 Phiên Sx04 per D-S04-03/07/08 LAW — Intent 03 Variant B AI-augmented search adds 4 NEW events + augments existing 2 with `mode` field.*

| event_type | Required properties |
|---|---|
| `search.performed` | `query: str, filters: obj, modality, result_count: int, mode?: 'ai_augmented'\|'basic_fallback'` |
| `search.result_impressed` | `query, product_id, position: int, rank_profile?: str, mode?: 'ai_augmented'\|'basic_fallback'` |
| `search.result_clicked` | `query, product_id, position, dwell_ms_before_click?: int` |
| `search.result_dismissed` | `query, product_id, position` |
| `search.suggested_chip_tapped` | `chip_query: str, position: int` — **S-04 NEW** (pre-query welcome chip tap per D-S04-07) |
| `search.followup_filter_tapped` | `filter_label: str, applied_value: obj` — **S-04 NEW** (Variant A AI followup chip per D-S04-08) |
| `search.typo_corrected` | `original: str, corrected: str, accepted: bool` — **S-04 NEW** (Variant B typo confirm UX per D-S04-03) |
| `search.variant_degraded` | `from: 'ai_augmented', to: 'basic_fallback', reason: 'llm_timeout'\|'llm_error'\|'user_explicit', trace_id?: str` — **S-04 NEW** (Variant B → A fallback per D-S04-03) |
| `recommendation.shown` | `source: str, seed_product_id?, products: [{id, position, reason}]` |
| `recommendation.clicked` | `source, product_id, position` |
| `recommendation.dismissed` | `source, product_id, position` |

### Product Interaction
| event_type | Required properties |
|---|---|
| `product.viewed` | `product_id, source: str, dwell_ms?: int` |
| `product.zoomed` | `product_id` |
| `product.shared` | `product_id, channel: str` |

### Cart & Checkout
| event_type | Required properties |
|---|---|
| `cart.item_added` | `product_id, qty: int, unit_price: int, source: 'search'\|'search_variant_a'\|'search_variant_b'\|'reco'\|'voice'\|'direct', from_query?: str` — `source` enum extended S-04 Phiên Sx04 per D-S04-09 (Variant B mode source enables co-purchase hint triggering) |
| `cart.item_removed` | `product_id, qty_removed: int` |
| `cart.qty_changed` | `product_id, old_qty: int, new_qty: int` |
| `cart.viewed` | `item_count: int, total: int` |
| `cart.cleared` | `{}` |
| `cart.promo_applied` | `code: str, discount_amount: int, subtotal_before: int, subtotal_after: int` — **S-05 NEW Phiên Sx05-2 per D-S05-05 LAW** (promo code apply via MCP exact-match fast-path; LLM typo correction layer wired T03) |
| `cart.promo_removed` | `code: str` — **S-05 NEW Phiên Sx05-2** |
| `checkout.started` | `items: array, total: int` |
| `checkout.completed` | `order_id, items, total` |
| `checkout.failed` | `order_id, reason: str` |
| `checkout.cancelled` | `order_id, stage: 'pending'\|'processing'` |

### Merchant
| event_type | Required properties |
|---|---|
| `product.import_started` | `source: 'image'\|'voice'\|'text'` |
| `product.import_completed` | `product_id, category, price, was_prefilled: bool` |
| `product.import_abandoned` | `stage: 'form'\|'cards'` |
| `card.shown` | `card_id, action_type, event_id` |
| `card.accepted` | `card_id, action_type, applied_value?: any` |
| `card.rejected` | `card_id, action_type` |
| `card.expired` 🟡 | `card_id` — **CHƯA CODE** (KHÔNG trong catalog.ts) |

### Analytics
| event_type | Required properties |
|---|---|
| `analytics.queried` 🟡 | `metric, dimension, range_months: int, modality` — **CHƯA CODE** |
| `analytics.chart_viewed` 🟡 | `chart_type: str, duration_seconds: int` — **CHƯA CODE** |

### Navigation
*Added S-03 Phiên 30 C-07 — stub settings routes need event coverage for analytics. Extended Phiên 36 T03b per C-23 R1 + D-11 — Dashboard tile click event.*

| event_type | Required properties |
|---|---|
| `nav.settings_section_opened` | `section: 'notifications'\|'security'\|'help'` |
| `nav.tile_clicked` | `tile_id: 'nhap_hang'\|'phan_tich'\|'tim_san_pham'\|'mua_hang'\|'goi_y_san_pham'\|'gio_hang', intent_id: 'intent-01'\|'intent-02'\|'intent-03'\|'intent-04'\|'intent-05'\|'intent-07', source: 'hero_tile'\|'list_tile'` |

### Error
*Added S-03 Phiên 30 C-09 — user-initiated error report flow (state-D "Báo lỗi" button).*

| event_type | Required properties |
|---|---|
| `error.report_requested` | `trace_id: str, error_code: str` |

**Implementation status (verified `catalog.ts` 2026-06-09):** `PROPERTIES_SCHEMA_MAP` implement **31 event types**: auth(signed_in/signed_out/password_reset_requested) · card(accepted/rejected/shown) · cart(cleared/item_added/item_removed/promo_applied/promo_removed/qty_changed/viewed) · error.report_requested · intent.first_card_emitted · nav(settings_section_opened/tile_clicked) · product(import_abandoned/import_completed/import_started/viewed) · recommendation(clicked/dismissed/shown) · search(first_card_rendered/followup_filter_tapped/result_clicked/suggested_chip_tapped/typo_corrected/variant_degraded) · session.started.

> 🟡 **CHƯA CODE (designed, chưa trong catalog.ts — telemetry target, GIỮ làm spec, thêm vào catalog.ts+Zod khi build):** session.ended, search.performed, search.result_impressed, search.result_dismissed, product.zoomed, product.shared, checkout.started, checkout.completed, checkout.failed, checkout.cancelled. (checkout.* gắn payment Intent06 CHƯA CODE; search.performed/result_impressed/result_dismissed = impression/CTR telemetry; session.ended/product.zoomed/shared = engagement.) **+ `card.expired`, `analytics.queried`, `analytics.chart_viewed`** (ở §B tables — KHÔNG trong catalog.ts).

---

## C. Rules for Adding New Messages/Events

1. **Append-only** — Never rename. If schema changes, version: `event.v2`
2. **Naming check** — Must follow patterns:
   - Operational log: `<domain>.<noun>_<past_verb>` (snake_case)
   - Behavior event: `<domain>.<verb>` (lowercase)
3. **Propose first** — Add entry với status `[Proposed]`, human approve → remove tag
4. **Document fields** — Required + optional clearly
5. **Update code** — Add to TypeScript `PropertiesMap` (behavior) or constant (ops)

## D. Quick Look-up Index

### "Cái này log ở đâu?"

| Question | Look at |
|---|---|
| Service quá chậm? | `intent.completed.duration_ms` ops log → Tempo trace |
| Vespa miss data? | `vespa.search_completed.hits` ops log |
| Tại sao product này không lên top search? | Behavior: `search.result_clicked` vs `search.result_impressed` ratio |
| Tại sao card không được accept? | Behavior: `card.shown` vs `card.accepted/rejected` |
| Payment fail rate? | Ops metric `icp.payments.outcome` |
| User abandon ở đâu? | Behavior funnel: `product.viewed` → `cart.item_added` → `checkout.started` → `checkout.completed` |
| Tại sao behavior event không insert được? | Ops: `tracker.event_dropped.reason` (drift / bot filter) + `tracker.persist_failed` (DB error) + `db.behavior_partition_missing` (partition cần auto-create per pg_partman post-Phase 2) |
| SSE stream cookie auth fail? | Ops: `intent.sse_session_missing.warn` (missing icp_session cookie) — per D-05 + ADR-019 |
| SSE stream connection lifecycle? | Ops: `intent.sse_opened.info` + `intent.sse_closed.info` + `intent.sse_heartbeat_sent.debug` |
| Tại sao Variant B degrade về Variant A? | Ops: `intent.degraded.reason` + `intent.degraded.node` (which LLM node failed). FE side: behavior `search.variant_degraded.reason` correlated by `trace_id`. (S-04 NEW per D-S04-03) |
| User accept/reject typo correction? | Behavior: `search.typo_corrected.accepted: bool`. (S-04 NEW) |
| User taps pre-query welcome chip vs typing? | Behavior: `search.suggested_chip_tapped` count vs `search.performed` count. (S-04 NEW per D-S04-07) |
| Variant A AI followup filter chip CTR? | Behavior: `search.followup_filter_tapped` per filter_label. (S-04 NEW per D-S04-08) |
| Co-purchase hint conversion? | Behavior: `co_purchase_hint` SSE emitted (gateway log) vs subsequent `cart.item_added` with `source='search_variant_b'`. (S-04 NEW per D-S04-09) |
| Graph pause waiting user input? | Ops: `intent.interrupted.awaiting` enum (`typo_action`\|`degrade_action`\|`cart_action`). Paired with subsequent `intent.resumed.resume_choice` after user action. (S-04 NEW per D-S04-13 Pattern A) |
| SSE pub/sub channel forward latency? | Ops: `sse.pubsub.published` timestamp (AI) vs `sse.pubsub.forwarded` timestamp (Gateway) — diff = Redis pub/sub roundtrip. (S-04 NEW per D-S04-13 Option Z) |
| Why client disconnect before final? | Ops: `sse.pubsub.unsubscribed.reason` enum (`final_event` = normal close / `client_close` = browser tab close / `timeout` = idle > Gateway limit). (S-04 NEW per D-S04-13) |
| Perceived-latency p50/p95 time-to-first-card? | Ops: `intent.first_card_emitted.time_to_first_card_ms` (AI-side). Behavior: `search.first_card_rendered.time_to_first_card_ms` (FE-side paint). Diff = network + render latency. Grafana dashboard: `SELECT percentile_cont(0.50/0.95) WITHIN GROUP (ORDER BY time_to_first_card_ms) FROM behavior_logs WHERE event_type='search.first_card_rendered' AND mode='ai_augmented'`. (S-04 NEW Sx04-4 per D-S04-14 LAW Adaptive Progressive Streaming) |

---

**END OF CATALOG.**
