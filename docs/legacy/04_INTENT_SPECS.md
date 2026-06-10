# 04 — Intent Specs

> **Load khi:** code LangGraph subgraph, hoặc fix bug intent. Reference cho cả frontend khi build UI.

<!-- PRODUCTION RECONCILE (2026-06-09): Intent 06 → VNPay/MoMo thật (ADR-038, mockup
intent-06 đã có MoMo/VNPay/OTP/method); Intent 01 shopee = real crawl (ADR-039).
Cross-cutting: tenant context per-request (ADR-040), consent gating cho behavior
tracking (ADR-041), per-tenant learn-to-rank ở search/recommend (ADR-043). -->

> **Production cross-cutting (áp cho mọi intent):**
> - **Tenant context:** mọi request mang active tenant (header `X-Tenant-Id` hoặc JWT claim — xem `03 §1.0`); graph/tools scope theo `tenant_id`; products/orders/cart… của intent đều tenant-scoped.
> - **Consent gating:** behavior events (SSE tracker) chỉ ghi khi user có consent `behavior_tracking` (xem `03 §1.9`, `07_BEHAVIOR_LOGS`).
> - **Per-tenant ranking (ADR-043):** Intent 03/04 dùng Vespa rank-profile `personalized` với weights theo tenant (fallback `ai_augmented`).



Mỗi intent có format:
- **Modality demo** (1 trong 3, đã LOCKED ở `00_CONTEXT`)
- **Input contract**
- **Graph stages**
- **Tools used**
- **Events emitted**
- **Output contract** (SSE events Frontend nhận)
- **Error paths**

---

## Intent 01 — `importing_products_by_images`

### Modality demo: image (multipart upload)

### Input
```json
{ "modality": "image", "file": "<binary>", "hint": "import" }
```

### Graph stages
```
ENTRY
  └─► classify_intent (LLM)
       └─► [intent=importing_by_images] → IMPORT_GRAPH
             ├─► vision_analyze (vision.analyze)
             ├─► enrich (parallel)
             │     ├─► vespa.search_trend
             │     ├─► shopee.price_range
             |     ├─► gtrends.interest_over_time  ← (MỚI, market demand)
             │     # text.embed RETRACTED Phiên Sx04-1 per D-S04-10 LAW:
             │     # Vespa native embedder auto-generates text_embedding at
             │     # `vespa.index` time (no separate embed step). See
             │     # 02_DATA_MODEL.md §2.1.
             ├─► generate_description (LLM call)
             ├─► EMIT events.append(ProductDraftSuggested)
             └─► wait_user_input (return prefilled form via SSE)

USER ENTERS price, qty, title, then POST /intent/{rid}/action with {choice:'submit_draft', value: form}

CONTINUE
  ├─► validate (domain)
  ├─► EMIT events.append(ProductDraftSubmitted) — `vespa.compare_similar` MOVED to enrich phase
  │   per C-S07-C Φᶜ″ (no longer in CONTINUE — runs parallel with search_trend/price_range
  │   during enrich asyncio.gather, surfaces in form_prefill rendering)
  ├─► policies.find_matching → loop create cards
  └─► wait_user_input (return cards via SSE)

USER resolves cards → POST /intent/{rid}/action with {choice:'commit'}

COMMIT
  ├─► products.create (Postgres, idempotent)
  ├─► vespa.index
  ├─► EMIT events.append(ProductImported) + publish Kafka
  └─► return final
```

> **CODE verified `importing_by_images.py` — 9 node** (set qua `add_node`): `vision_analyze` · `enrich` · `generate_description` · `emit_prefill` · `emit_draft_event` · `find_policies` · `create_cards` · `emit_cards_interrupt` · `commit`. (Flow trên = logic-view; thứ tự thực thi theo edges chưa verify riêng.)

### Tools used
`vision.analyze`, `vespa.search_trend`, `shopee.price_range`, `vespa.compare_similar`, `policies.find_matching`, `cards.create`, `products.create`, `vespa.index`, `events.append`, `analytics.suggest_price`, `gtrends.interest_over_time`   # CODE verified (importing_by_images.py 2026-06-09: graph có gọi suggest_price + gtrends) — (text embedding now via Vespa native embedder at `vespa.index` time per D-S04-10 LAW — no separate `text.embed` tool needed)

> **Production (ADR-039 supersedes ADR-032):** code hiện tại `shopee.price_range` (`apps/mcp/src/tools/shopee.py`) query bảng **mock** `shopee_prices_mock` (crawler ghi rõ OUT OF SCOPE thời hackathon — verified). Production đổi **nguồn dữ liệu** sang bảng `shopee_prices` do worker `shopee-crawl` feed (crawl thật) — **tool name + response shape GIỮ NGUYÊN** (chỉ đổi `FROM shopee_prices_mock` → `shopee_prices`, thêm `is_stale=true` khi crawl fail → fallback last-known). Đây là **việc code chưa làm**. ⚠️ rủi ro ToS — xem ADR-039.

### Events emitted
- 🟡 `ProductDraftSuggested` (sau AI analyze) — **CHƯA EMIT trong code** (0 occurrence; design). Code emit THẬT: `ProductDraftSubmitted` (importing_by_images + policies.py:270) + `ProductImported` (importing:939 + products.py).
- `ProductDraftSubmitted` (sau user submit form)
- `ProductImported` (sau commit, kafka publish)

### SSE Output sequence
```
status: classifying
status: analyzing
tool_call: vision.analyze
tool_result: vision.analyze
tool_call: vespa.search_trend
tool_call: shopee.price_range
tool_call: gtrends.interest_over_time 
... (parallel results)
tool_result: vespa.search_trend
tool_result: shopee.price_range
tool_result: gtrends.interest_over_time 
status: synthesizing
partial_text: "Tôi đã phân tích..."
[FORM_PREFILL custom event: data: {title, category, attrs, suggested_price, ...}]
[MARKET_TREND custom event: data: {current_score, delta_pct, trajectory, series, related_rising}]
[SHOPEE_COMPARE custom event: data: {...}]   # publisher.publish_shopee_compare (importing_by_images.py:510) — ShopeeCompareCard; đủ 3 event S-07: form_prefill/market_trend/shopee_compare
status: awaiting_user_input

(after user submits form — per C-S07-D Option β2: SKIP status:validating;
 vespa.compare_similar already ran in enrich phase per C-S07-C Φᶜ″)
card: {action_type: SUGGEST_PRICE, ...}  ← 0..N cards (rationale rendered from policy rationale_template
                                            mustache pattern; policies.find_matching matches by event_type
                                            ProductDraftSubmitted + DSL context built from enrich data)
status: awaiting_user_input

(after user commits)
status: committing
products: [Product]
final: {text: "Đã nhập hàng thành công", product_id: "..."}
```

### Error paths
- `vision.analyze` Ω₂ 3-threshold check fires (overall `confidence<0.3` OR `category='unknown'` OR `max(confidence_per_field.values())<0.4`) → return error `E_VISION_BLUR` (renamed from `LOW_CONFIDENCE_IMAGE` per C-S07-F + Rule 6 mockup state-E line 393 literal), ask retake photo. Server-side per C-S07-J (NO client-side Canvas — no codebase precedent). Empirically validated Phiên Sx07-B+Sx07-D against blurry control image (GaussianBlur radius=18).
- Duplicate idempotency-key → return cached final result
- Vespa index fail → rollback products row (compensating delete). [`EXTERNAL_DOWN` = **STALE** — 0 occurrence apps/+packages/ → bỏ. Mã thật `importing_by_images` raise (verified per-graph): `E_VISION_BLUR`, `E_VISION_FAILED`, `VALIDATION_FAILED`]

---

## Intent 02 — `buying_products_by_voices`

### Modality demo: voice (audio upload)

### Input
```json
{ "modality": "voice", "file": "<audio binary>" }
```

### Graph stages (CODE verified `buying_by_voices.py` 2026-06-09 — 13 node)
```
ENTRY (router main.py → BUY_GRAPH)
  → load_voice_context         # Redis voice:context:{user_id} JSON, TTL 30min, FIFO 5 turns
                               #   (D-S08-NN-A Voice Session Memory — context-aware bulk parse)
  → speech_transcribe          # Gemini 2.5 Flash audio input (non-streaming; cosmetic streaming-feel)   ← [SỬA: load_voice_context TRƯỚC speech_transcribe — per add_edge thật START→load→transcribe]
  → parse_voice_intent         # LLM bulk-parse → voice action enum: add | remove | update_qty | query
                               #   (D-S08-NN-B; nhiều item/turn; inject context block 5 turns)
  → resolve_items              # vespa.hybrid_search per item; thresholds 0.85 high / 0.6 low (env-tunable)
  → route_resolution           # phân nhánh theo (action × match):
       ├─ add/update_qty resolved → bulk_cart_commit   # cart.update_qty, Redis pipeline multi-item
       ├─ remove                 → voice_cart_remove     # cart.update_qty qty=0 / remove
       ├─ query (recall)         → voice_recall          # đọc lịch sử voice_context — KHÔNG hit Vespa
       │                                                 #   ("sản phẩm hồi nãy", ordinal "cái thứ 2")
       └─ no match / ambiguous   → voice_no_match_alts    # đề xuất thay thế top-N
              → interrupt(clarify) → resume {choice} (POST /intent/{rid}/action)
  → reason_need                # LLM lý do/gợi ý (vì sao chọn)
  → co_purchase_lookup         # analytics.co_purchased — gợi ý mua kèm
  → save_voice_context         # ghi turn hiện tại vào FIFO (cho turn sau recall)
  → final
```
> **Voice session memory (D-S08-NN-A LAW):** load/save_voice_context = Redis `voice:context:{user_id}` FIFO 5 turns, TTL 30 phút → Siri-class continuity (recall ordinal/Q&A không cần Vespa). 4 voice action (add/remove/update_qty/query) per D-S08-NN-B. interrupt+resume Pattern A (reuse S-04 D-S04-13) cho clarify/no_match.

### Tools used
`speech.transcribe`, `vespa.hybrid_search`, `cart.get`, `cart.update_qty`, `analytics.co_purchased`, `events.append`   # CODE verified buying_by_voices.py. `speech.synthesize` (optional TTS) — graph hiện CHƯA gọi

### Events emitted
- 🟡 `IntentRecognized` (debug/analytics) — **CHƯA EMIT** (0 occurrence; design). `CartUpdated` = THẬT (redis_publisher.py:227).
- `CartUpdated`

### SSE Output sequence
```
status: transcribing
voice_transcribed: {text: "mua nước tương Maggi", ...}   # event SSE thật (S-08, buying_by_voices)
partial_text: "Bạn nói: mua nước tương Maggi"
status: searching
products: [5 candidates]
voice_clarify_options: {options: [...]}   # event SSE THẬT (S-08, code buying_by_voices) — doc cũ ghi "CHOICES" (stale)
status: awaiting_user_input

(after voice choice)
status: updating_cart
final: {text: "Đã thêm vào giỏ", cart: Cart}
```

### Error paths
- STT confidence < 0.5 → ask repeat
- Multiple ambiguous matches sau 2 clarifications → fallback to text mode
- Mã lỗi thật `buying_by_voices` raise (verified per-graph): `E_TRANSCRIBE_FAILED` (STT lỗi), `E_NO_SPEECH` (không có giọng nói), `E_INTENT_PARSE_FAILED` (LLM parse voice intent lỗi)

---

## Intent 03 — `searching_products_by_text`

### Modality demo: text

> **AMENDED S-04 Phiên Sx04 (D-S04-03 LAW)** — Adaptive Single Endpoint + Graceful
> Degradation. Variant B (`ai_augmented`) = default tier; Variant A (`baseline`)
> = fallback tier triggered by LLM timeout/error OR user explicit "Dùng bản cơ bản"
> button (mockup `intent-03B-state-C-error.html` line 173). Single graph, dual
> rank profiles (per `02_DATA_MODEL.md` §2), runtime degradation governed by
> `mode` state field.

> **AMENDED S-04 Phiên Sx04-3 (D-S04-13 LAW Pattern A + Option Z + Option α)** —
> Graph stages use LangGraph RedisSaver checkpointer (`intent:checkpoint:{rid}`
> TTL 30min refresh_on_read) + Pattern P2 dynamic `interrupt()` primitive
> (conditional pause only on trigger condition match). 3 interrupt points:
> (1) `detect_typo` on LLM confidence > 0.85; (2) `generate_understanding` or
> `generate_reasons` on `TimeoutError`/`LLMError`; (3) `rank_finalize` always
> at end (Option α — waits for cart action with 60s Gateway timeout default).
> SSE events transported via Redis pub/sub channel `sse:pubsub:{rid}`
> (Option Z architecture — AI service Python `redis.publish()`; Gateway
> NestJS `ioredis.duplicate().subscribe()` forwards to FE EventSource).
> Resume via `POST /intent/{rid}/action` → Gateway forwards → AI internal
> `POST /intent/{rid}/resume` calls `graph.astream(Command(resume=<choice>))`
> using same thread_id. See `03_API_CONTRACTS.md §1.2` Pattern A semantics +
> `02_DATA_MODEL.md §5` Redis keys + `LOG_CATALOG.md §A.Intent` interrupt/resume
> ops logs + `slices/S-04_decisions-log.md` D-S04-13 LAW full doc.

> **AMENDED S-04 Phiên Sx04-4 (D-S04-14 LAW Adaptive Progressive Streaming)** —
> `generate_reasons` node REWRITE: per-product LLM parallel calls each
> publish NEW `product_ready` SSE event immediately on completion (instead
> of buffering until all-done before single `products` event). Final
> `products` event STILL emitted at `rank_finalize` end with canonical
> full list (backward-compat — FE with no `product_ready` handler still
> works). Variant A unchanged (no LLM reasons → single-shot `products`
> event only). NEW paired telemetry: `intent.first_card_emitted` ops log
> (AI) + `search.first_card_rendered` behavior event (FE) for perceived-
> latency p50/p95 metric. See `03_API_CONTRACTS.md §3` ProductReadyEvent
> shape + `slices/S-04_decisions-log.md` D-S04-14 LAW full doc.

### Input
```json
{ "modality": "text", "content": "chai nước tuưng cho tô phở", "mode": "ai_augmented" }
```
**`mode` field semantic (S-04 NEW):**
- `'ai_augmented'` (default) — Variant B full graph with semantic understanding + reasons + co-purchase
- `'basic_fallback'` (degraded) — Variant A baseline graph BM25 only, no LLM reasoning
- Auto-degrade trigger: LLM timeout (`E_LLM_TIMEOUT`) at any LLM node → emit
  `variant_degraded` SSE event, fall through to Variant A continuation

### Graph stages (adaptive, single graph)

> **AMENDED Phiên Sx04-3 per D-S04-13 LAW** — Pattern P2 dynamic `interrupt()`
> calls inline within nodes (NOT static `interrupt_after` list at compile). 
> Conditional pause only when trigger condition matches → no waste round-trip
> when typo NOT detected / LLM NOT timeout / cart action NOT taken.

```
ENTRY
  ├─► classify_intent (cheap LLM or rule-based shortcut for V-SLICE 1)
  └─► [intent=searching_by_text] → SEARCH_GRAPH (single graph, dual mode)

SEARCH_GRAPH (LangGraph RedisSaver checkpointer thread_id=request_id):

  ├─► detect_typo (Variant B only) — LLM tool call.
  │     IF confidence > 0.85: publish `typo_suggestion` SSE event with
  │         corrected_query + 2 buttons (mockup intent-03B-state-F-typo.html
  │         lines 152-163) + `status: awaiting_user_input` event.
  │         Emit `intent.interrupted` ops log {awaiting: 'typo_action'}.
  │         CALL `interrupt({awaiting: 'typo_action'})` — graph pauses,
  │         RedisSaver checkpoint persists state.
  │         RESUME via Command(resume={choice: 'accept'|'reject'}):
  │           - 'accept' → set state.content=corrected_query, continue to
  │             generate_understanding with corrected query
  │           - 'reject' → keep state.content as-is, continue with original
  │         Emit `intent.resumed` ops log.
  │     ELSE (confidence ≤ 0.85 OR Variant A mode): no pause, continue.
  │
  ├─► generate_understanding (Variant B only) — LLM tool call. Publish
  │     `understanding` SSE event with semantic interpretation
  │     (mockup intent-03B-state-0-happy.html lines 152-164:
  │     "Đã hiểu ý anh — Anh cần nước tương đậm đặc phù hợp ăn phở").
  │     On TimeoutError (>2s) OR LLMError:
  │       1. Set state.mode='basic_fallback', state.degraded_from='ai_augmented',
  │          state.degraded_reason='llm_timeout' (or 'llm_error').
  │       2. Publish `variant_degraded` SSE event + `status: awaiting_user_input`.
  │          Emit `intent.degraded` + `intent.interrupted` ops logs
  │          {awaiting: 'degrade_action'}.
  │       3. CALL `interrupt({awaiting: 'degrade_action'})` — graph pauses.
  │       4. RESUME via Command(resume={choice: 'retry_ai'|'continue_basic'}):
  │            - 'retry_ai' → call `adelete_thread(rid)` to clear checkpoint
  │              + re-invoke `ai_augmented` mode from ENTRY (per Q-Sx04-3-7
  │              Option A LAW — clear checkpoint, reuse request_id)
  │            - 'continue_basic' → keep state.mode='basic_fallback', skip
  │              remaining Variant B LLM nodes (no parse_filters refinement,
  │              no generate_reasons), proceed to vespa_search with
  │              rank_profile='baseline'
  │     ELSE (success): continue to parse_filters with semantic_understanding
  │       attached to state.
  │
  ├─► parse_filters (LLM structured output) — Both modes. Output {category?,
  │     price_max?, attrs?}. Publish `phase_progress` SSE event with phase_id 0
  │     `done` + timing meta. Per Q-Sx04-3-1 LAW: prompt enhanced for
  │     cross-language category detection (English query "soy sauce for pho"
  │     → category='nuoc_tuong' via Gemini multilingual classification).
  │     On LLM timeout: degrade via state.mode flip (same protocol as
  │     generate_understanding above) → regex extraction fallback for Variant A.
  │
  ├─► embed_query (Variant B only) — Vespa native embedder (D-S04-10 LAW
  │     Phiên Sx04-1). NO-OP pass-through node — `embed(@query, clip_multilingual)`
  │     compiled into the YQL passed to `vespa.hybrid_search` next step.
  │     Embedding latency ~30ms inside Vespa container; see 02_DATA_MODEL.md §2.1.
  │     Variant A skips (no vector). No SSE event emitted (silent node).
  │
  ├─► hybrid_search — MCP tool `vespa.hybrid_search` (T02 ships implementation
  │     per C-S04-N — `apps/mcp/src/tools/vespa.py`) with
  │     `rank_profile = mode === 'ai_augmented' ? 'ai_augmented' : 'baseline'`.
  │     Filter `category` (from parse_filters output) applied to YQL `where`
  │     clause when present (cross-language category detection per Q-Sx04-3-1
  │     LAW). Publish `phase_progress` event phase_id 1 `active` then `done`
  │     with timing meta.
  │
  ├─► generate_reasons (Variant B only) — LLM per-product parallel calls,
  │     5s timeout per product (AMENDED Phiên Sx04-7 per D-S04-15 LAW —
  │     was 2s in Phiên Sx04-3 emit; bumped to 5s for VN→Google network
  │     latency reality where actual TTFB + inference combined typically
  │     measures 3-4s per call; 5s gives Gemini enough headroom while
  │     still firing degrade interrupt on TRUE hangs). Publish
  │     `phase_progress` event phase_id 2 `active` at node entry.
  │     **AMENDED Phiên Sx04-4 per D-S04-14 LAW (Adaptive Progressive Streaming):**
  │     For EACH product as its LLM `generate_reasons` call completes:
  │       1. Publish NEW `product_ready` SSE event:
  │            {item: Product+ {match_score, reason}, index: i, total: N}
  │          via redis_publisher → channel `sse:pubsub:{rid}`.
  │       2. On FIRST `product_ready` emission for this request_id (i=0
  │          OR first successful completion when out-of-order):
  │            emit ops log `intent.first_card_emitted`
  │            {request_id, time_to_first_card_ms, mode} for perceived-
  │            latency telemetry (paired with FE behavior event
  │            `search.first_card_rendered` per Q-Sx04-4-4 LAW).
  │     After ALL parallel calls settled (success OR timeout per-product):
  │       Publish `phase_progress` event phase_id 2 `done` with timing meta.
  │     On partial failure (some products succeed, some timeout): products
  │       that timed out get `product_ready` emitted WITHOUT reason (only
  │       match_score from Vespa); item-level graceful degrade — DO NOT
  │       pause graph.
  │     On full failure (ALL products timeout): mode flip + same interrupt
  │       protocol as generate_understanding (`variant_degraded` SSE event +
  │       `interrupt({awaiting: 'degrade_action'})` + resume via Command).
  │       No `product_ready` emitted (graph paused before any LLM completion).
  │
  ├─► rank_finalize — Both modes. Apply trend boost (Variant B) or BM25 only
  │     (Variant A). Publish `phase_progress` event phase_id 3 `done`.
  │     Publish `products` SSE event (canonical final list — backward-compat
  │     reconciliation per D-S04-14 LAW for FE that missed `product_ready`
  │     events OR doesn't subscribe to progressive handler):
  │       Variant B mode: {items: [Product+ {match_score: float, reason: string}],
  │                        mode: 'ai_augmented'}
  │       Variant A mode: {items: [Product], mode: 'basic_fallback'}
  │     Publish `status: awaiting_user_input` event.
  │     Emit `intent.interrupted` ops log {awaiting: 'cart_action'}.
  │     CALL `interrupt({awaiting: 'cart_action'})` — Option α LAW per
  │       Q-Sx04-3-5: ALWAYS pause at end of search graph; wait up to 60s for
  │       user cart action (Gateway-side timeout). RedisSaver checkpoint
  │       persists full state including products list.
  │     RESUME via Command(resume={choice: 'add_to_cart'|'skip', value?: {product_id}}):
  │       - 'add_to_cart' (FE user tap "+" on product card → POST /action with
  │         value.product_id): set state.cart_trigger_product_id = product_id
  │         → continue to co_purchase_lookup node (conditional edge)
  │       - 'skip' (60s Gateway timeout default, OR explicit user action like
  │         tab close / back navigation): proceed directly to final → END
  │
  ├─► [Conditional edge based on state.cart_trigger_product_id]
  │     IF state.cart_trigger_product_id IS SET:
  │       └─► co_purchase_lookup (Variant B only — Option α 2nd-stage continuation
  │             of same graph per D-S04-13 LAW; was originally documented as
  │             "POST-INTERACTION" pre-Sx04-3 but now integrated as conditional
  │             continuation node within graph topology):
  │             Read fixture JSON per `02_DATA_MODEL.md` §X.2 (S-04 stub)
  │             → S-10 V006 mat view replaces real. Publish `co_purchase_hint`
  │             SSE event with suggested_product + reason_template + rate_pct
  │             (mockup intent-03B-state-E-cart.html lines 221-251
  │             "68% khách mua kèm"). Continue to final.
  │     ELSE (state.cart_trigger_product_id IS NONE): skip to final.
  │
  └─► final — Publish `final` SSE event with summary + cleanup.
        On final emit: AI service calls `adelete_thread(rid)` to clear
        RedisSaver checkpoint (fast-path cleanup per Strategy β LAW).
        Gateway receives `final` event → closes SSE connection +
        unsubscribes from `sse:pubsub:{rid}` channel.
```

> **CODE verified `searching_by_text.py` — 10 node** (set qua `add_node`): `detect_typo` · `generate_understanding` · `no_product_ref` · `parse_filters` · `embed_query` · `hybrid_search` · `generate_reasons` · `rank_finalize` · `co_purchase_lookup` · `final`.
>
> **Edge topology** (verified `add_edge`/`add_conditional_edges`): `START → detect_typo → generate_understanding`, rồi router `_route_after_understanding` rẽ 3 nhánh —
> - `_skip_search_no_ref` → **`no_product_ref`**: query KHÔNG phải tham chiếu sản phẩm → phát SSE **`empty_state`** `{message, fallback_actions[widen_query|capture_image|create_product], suggested_queries}` (reuse `SseEmptyStateEvent`) + log `search.no_product_ref`, **bypass Vespa → END**.
> - `mode=='basic_fallback' & degraded_reason=='llm_timeout'` → `hybrid_search` (bỏ qua parse_filters/embed_query/generate_reasons).
> - còn lại → `parse_filters` (verified `_route_after_understanding` line 917 `return "parse_filters"`).
>
> Nhánh chính: `parse_filters → embed_query → hybrid_search → generate_reasons → rank_finalize →[cart_trigger]→ co_purchase_lookup | final`; `co_purchase_lookup → final → END`; `no_product_ref → END`. (Node `no_product_ref` trước thiếu trong doc — bổ sung §3b; `empty_state` khớp section "Empty state" phía dưới.)

### Tools used

**Variant B (`ai_augmented`):** `vespa.hybrid_search` (with
`rank_profile=ai_augmented`; YQL embeds `embed(@query, clip_multilingual)`
per D-S04-10 LAW — Vespa native CLIP-multilingual-512 embedder, no separate
embedding MCP tool), plus LLM calls for: typo detection, semantic
understanding, parse_filters, generate_reasons (per-product parallel).

**Variant A (`basic_fallback`):** `vespa.hybrid_search` (with
`rank_profile=baseline`). Optional regex parse_filters fallback (no LLM).

### Operational logs emitted
- `intent.received` (gateway) — `{intent_hint='search', modality='text'}`
- `intent.classified` (ai)    — `{intent='searching_by_text', confidence}`
- `intent.dispatched` (ai)    — `{intent, mode: 'ai_augmented'|'basic_fallback'}`
- `llm.generated` (ai/mcp)    — per LLM call: typo/understanding/parse_filters/reasons
- `mcp.tool_called` (ai)      — `{tool='vespa.hybrid_search'}` (text embedding handled inside Vespa per D-S04-10 LAW; no separate `text.embed` tool call)
- `vespa.search_completed` (mcp) — `{rank_profile, hits, duration_ms}`
- `intent.degraded` (ai, NEW Phiên Sx04) — when LLM timeout triggers mode flip,
  `{from_mode='ai_augmented', to_mode='basic_fallback', reason: 'llm_timeout'|'llm_error', node: 'understanding'|'reasons'|...}`
- `intent.completed` (ai)     — `{intent, duration_ms, final_mode}`
- (See `LOG_CATALOG.md` Section A Intent for full operational log catalog)

### Behavior events emitted (FE-side via tracker)
- `search.performed`             — `{query, filters, modality, result_count, mode}` (mode=ai_augmented|basic_fallback)
- `search.suggested_chip_tapped` (NEW S-04) — pre-query welcome chip tap (D-S04-07)
- `search.followup_filter_tapped` (NEW S-04) — Variant A AI followup chip tap (D-S04-08)
- `search.typo_corrected`        (NEW S-04) — user accepts/rejects typo correction
- `search.variant_degraded`      (NEW S-04) — fallback B→A triggered by LLM error
- `search.first_card_rendered`   (NEW Sx04-4 per D-S04-14 LAW) — `{request_id, time_to_first_card_ms, total_cards_expected, mode}`; FE emits at FIRST Product Card paint after first `product_ready` event arrives; paired with ops log `intent.first_card_emitted` for perceived-latency p50/p95 telemetry
- `search.result_impressed`      — per product card visible in carousel
- `search.result_clicked`        — product card tap (future cart click target — S-05)
- `cart.item_added`              — tap "+" stub per D-S04-09 (S-05 owns real cart)
- `nav.tile_clicked`             — Dashboard tile → /intent-03 entry (T03b LOCKED)
- (See `07_BEHAVIOR_LOGS.md` §3 Discovery + §3.8 NEW for full behavior catalog)

### SSE Output sequence

**Variant B happy path (`mode=ai_augmented`)** — AMENDED Phiên Sx04-4 per D-S04-14 LAW Adaptive Progressive Streaming:
```
status:         {phase: 'classifying'}
status:         {phase: 'analyzing'}
phase_progress: {phase_id: 0, label: 'Hiểu ngữ nghĩa câu hỏi', status: 'active'}
understanding:  {text: 'Anh cần nước tương đậm đặc phù hợp ăn phở...', highlighted_terms: ['nước tương đậm đặc']}
phase_progress: {phase_id: 0, status: 'done', meta: '412ms'}
status:         {phase: 'searching'}
phase_progress: {phase_id: 1, label: 'Tìm sản phẩm khớp nghĩa + tên', status: 'active'}
phase_progress: {phase_id: 1, status: 'done', meta: '158ms'}
phase_progress: {phase_id: 2, label: 'Viết lý do gợi ý cho từng món', status: 'active'}

[D-S04-14 LAW per-product progressive streaming — generate_reasons parallel LLM calls completing]
product_ready: {item: {...Product, match_score: 0.98, reason: 'Độ đậm cao, khách phở hay chọn nhất'}, index: 0, total: 8}
[Ops log: intent.first_card_emitted {request_id, time_to_first_card_ms: 480, mode: 'ai_augmented'}]
product_ready: {item: {...Product, match_score: 0.94, reason: '...'}, index: 1, total: 8}
product_ready: {item: {...Product, match_score: 0.91, reason: '...'}, index: 2, total: 8}
... (5 more product_ready events as each LLM call completes)
product_ready: {item: {...Product, match_score: 0.82, reason: '...'}, index: 7, total: 8}

phase_progress: {phase_id: 2, status: 'done', meta: '892ms'}
phase_progress: {phase_id: 3, label: 'Xếp hạng theo độ phù hợp', status: 'active'}
phase_progress: {phase_id: 3, status: 'done', meta: '34ms'}
status:         {phase: 'done'}
products:       {items: [{...product, match_score: 0.98, reason: 'Độ đậm cao, khách phở hay chọn nhất'}, ...], mode: 'ai_augmented'}
                # ^ Canonical final list (backward-compat reconciliation per D-S04-14 LAW)
final:          {text: 'Em tìm được 8 sản phẩm Maggi', filters_applied: {...}, mode: 'ai_augmented'}
```

**Note on Variant A path (mode=basic_fallback):** NO `product_ready` events emitted (no LLM reasons generation step) — single-shot `products` event only at rank_finalize end. D-S04-14 LAW progressive streaming is Variant B exclusive.

**Variant B typo flow (`intent-03B-state-F-typo.html`)** — AMENDED Phiên Sx04-3 per D-S04-13 LAW Pattern A interrupt+resume:
```
[AI publishes to sse:pubsub:{rid} → Gateway forwards to FE EventSource]
status:         {phase: 'analyzing'}
typo_suggestion:{original: 'mai gi', corrected: 'Maggi', confidence: 0.94,
                 actions: [{label: 'Đúng rồi', value: 'accept'},
                           {label: "Không, em tìm 'mai gi'", value: 'reject'}]}
status:         {phase: 'awaiting_user_input'}

[Graph PAUSE via interrupt({awaiting: 'typo_action'}); RedisSaver checkpoint persisted]
[Ops log: intent.interrupted {request_id, node: 'detect_typo', awaiting: 'typo_action'}]
[Gateway SSE connection STAYS OPEN; heartbeat 15s keeps alive]

(user taps "Đúng rồi" → FE: POST /intent/{request_id}/action
  Body: {choice: 'accept', _meta: {attempt_n: 1}}
  Header: Idempotency-Key: <uuid>-attempt-1
 → Gateway 202 + forward to AI internal POST /intent/{rid}/resume
 → AI: graph.astream(Command(resume={choice: 'accept'}), config={thread_id: rid})
 → Ops log: intent.resumed {request_id, node: 'detect_typo', resume_choice: 'accept'})

[Graph continues — publishes remaining events to SAME sse:pubsub:{rid} channel]
status:         {phase: 'analyzing'}
phase_progress: {phase_id: 0, label: 'Hiểu ngữ nghĩa câu hỏi', status: 'active'}
understanding:  {text: 'Anh đang tìm gia vị thương hiệu Maggi...', highlighted_terms: ['Maggi']}
phase_progress: {phase_id: 0, status: 'done', meta: '412ms'}
... (continues with parse_filters/hybrid_search/generate_reasons/rank_finalize as happy path)
```

**Variant B graceful degrade (`intent-03B-state-C-error.html`)** — AMENDED Phiên Sx04-3 per D-S04-13 LAW Pattern A interrupt+resume:
```
[AI publishes to sse:pubsub:{rid} → Gateway forwards to FE]
status:         {phase: 'analyzing'}
phase_progress: {phase_id: 0, label: 'Hiểu ngữ nghĩa câu hỏi', status: 'active'}
(LLM timeout @ generate_understanding — 2s exceeded; AI catches TimeoutError)
[Set state.mode='basic_fallback', state.degraded_reason='llm_timeout']
[Ops log: intent.degraded {from_mode: 'ai_augmented', to_mode: 'basic_fallback', reason: 'llm_timeout', node: 'generate_understanding'}]
variant_degraded:{from: 'ai_augmented', to: 'basic_fallback', reason: 'llm_timeout',
                  error_code: 'E_LLM_TIMEOUT', trace_id: 'b7e1...d042',
                  user_message: 'Mô hình AI phản hồi chậm. Em đang quá tải nên chưa viết được lý do gợi ý.',
                  retry_actions: [{label: 'Thử lại với AI', value: 'retry_ai'},
                                  {label: 'Dùng bản cơ bản', value: 'continue_basic'}]}
status:         {phase: 'awaiting_user_input'}

[Graph PAUSE via interrupt({awaiting: 'degrade_action'}); checkpoint persisted]
[Ops log: intent.interrupted {request_id, node: 'generate_understanding', awaiting: 'degrade_action'}]

(user taps "Dùng bản cơ bản" → POST /intent/{rid}/action
  Body: {choice: 'continue_basic', _meta: {attempt_n: 1}}
 → AI: graph.astream(Command(resume={choice: 'continue_basic'}), config={thread_id: rid})
 → state.mode='basic_fallback', skip Variant B LLM nodes)

[Graph continues Variant A path — same sse:pubsub:{rid} channel]
status:         {phase: 'searching'}
phase_progress: {phase_id: 1, label: 'Tìm sản phẩm khớp nghĩa + tên', status: 'active'}
phase_progress: {phase_id: 1, status: 'done', meta: '158ms'}
phase_progress: {phase_id: 3, label: 'Xếp hạng theo độ phù hợp', status: 'active'}
phase_progress: {phase_id: 3, status: 'done', meta: '34ms'}
products:       {items: [...products without match_score/reason], mode: 'basic_fallback'}
final:          {text: 'Tìm thấy 12 sản phẩm', mode: 'basic_fallback'}

(ALTERNATIVE — user taps "Thử lại với AI": POST /intent/{rid}/action
  Body: {choice: 'retry_ai', _meta: {attempt_n: 1}}
 → AI: redis_saver.adelete_thread(rid) [clear checkpoint per Q-Sx04-3-7 Option A LAW]
 → AI: re-invoke graph from ENTRY with original input + mode='ai_augmented'
 → Same request_id, same sse:pubsub:{rid} channel reused; full happy path replays)
```

**Variant A baseline path (`mode=basic_fallback`, explicit fallback initial OR post-degrade):**
```
status:         {phase: 'classifying'}
status:         {phase: 'searching'}
phase_progress: {phase_id: 1, label: 'Tìm sản phẩm', status: 'active'}
phase_progress: {phase_id: 1, status: 'done', meta: '158ms'}
products:       {items: [...products without match_score/reason], mode: 'basic_fallback'}
final:          {text: 'Tìm thấy 12 sản phẩm nước tương Maggi trong kho', filters_applied: {...}, mode: 'basic_fallback'}

NOTE: Variant A path also pauses at rank_finalize END for cart action
(Option α applies to BOTH Variant A + B per D-S04-13 LAW — only difference
is Variant A does NOT proceed to co_purchase_lookup even when cart action
received, since co_purchase_hint is Variant B exclusive).
```

**Co-purchase hint flow (Variant B Option α 2nd-stage cart action, mockup state-E)** — AMENDED Phiên Sx04-3 per D-S04-13 LAW:
```
[After rank_finalize publishes products + final NOT yet emitted]
status:         {phase: 'awaiting_user_input'}

[Graph PAUSE via interrupt({awaiting: 'cart_action'}) for up to 60s Gateway timeout]
[Ops log: intent.interrupted {request_id, node: 'rank_finalize', awaiting: 'cart_action'}]
[Gateway SSE connection STAYS OPEN; user browses carousel + reads products]

(user taps "+" on Maggi 700ml card → FE: TWO parallel calls
  1. POST /api/v1/track {events: [{type: 'cart.item_added', product_id, source: 'search_variant_b', ...}]}
     (audit trail to DB; Gateway tracking pipeline; no AI side-effect)
  2. POST /intent/{request_id}/action
     Body: {choice: 'add_to_cart', value: {product_id: 'maggi-700ml-id'}, _meta: {attempt_n: 1}}
     Header: Idempotency-Key: <uuid>-attempt-1
   → Gateway 202 + forward to AI internal POST /intent/{rid}/resume
   → AI: graph.astream(Command(resume={choice: 'add_to_cart', value: {product_id}}), config={thread_id: rid})
   → state.cart_trigger_product_id = 'maggi-700ml-id'
   → Conditional edge routes to co_purchase_lookup node)

[Graph continues — co_purchase_lookup publishes to sse:pubsub:{rid}]
co_purchase_hint:{rate_pct: 68, reason: 'Khách mua nước tương Maggi thường lấy kèm tương ớt',
                  suggested_product: {...Product Chin-su tương ớt 250g},
                  anchor_category: 'nuoc_tuong', suggested_category: 'tuong_ot'}
final:          {text: 'Em tìm được 12 sản phẩm Maggi', mode: 'ai_augmented'}

[AI calls adelete_thread(rid) — fast-path cleanup per Strategy β LAW]
[Gateway receives final → res.end() + unsubscribe from sse:pubsub:{rid}]
[Ops log: sse.pubsub.unsubscribed {reason: 'final_event'}]

(ALTERNATIVE — user does NOT tap "+" within 60s OR closes tab:
 → Gateway timeout fires: forwards Command(resume={choice: 'skip'}) to AI /resume
 → AI: state.cart_trigger_product_id stays None
 → Conditional edge skips co_purchase_lookup → goes directly to final
 → No co_purchase_hint event emitted; user just sees products + final.)
```

### Empty state (mockup `intent-03A-state-B-empty.html`)

When `vespa.hybrid_search` returns 0 results in either mode:
```
products:       {items: [], mode}
empty_state:    {message: 'Em đã tìm kỹ nhưng chưa có sản phẩm nào khớp với yêu cầu của anh.',
                 fallback_actions: [
                   {type: 'widen_query',     label: 'Tìm "nước mắm" tổng quát hơn', value: <widened_query>},
                   {type: 'capture_image',   label: 'Chụp ảnh để gợi ý sản phẩm'},     # decorative S-04 (S-07 owner)
                   {type: 'create_product',  label: 'Nhập sản phẩm mới vào kho'}        # decorative S-04 (S-07 owner)
                 ],
                 suggested_queries: ['Nước mắm Nam Ngư', 'Nước mắm Chinsu', 'Nước mắm 40 độ đạm']}
final:          {text: 'Chưa có trong kho', mode}
```

### Error paths
- LLM timeout @ Variant B nodes (understanding/reasons): degrade to Variant A
  via `variant_degraded` SSE event, user prompted retry/continue
- Vespa timeout: emit `error` SSE event with `code: 'E_MCP_ERROR', retriable: true` [doc cũ ghi `EXTERNAL_DOWN` — STALE, không có trong code; `searching_by_text` raise thật `E_MCP_ERROR` cho lỗi MCP/Vespa + `E_LLM_TIMEOUT`]
- 0 results: emit `empty_state` SSE event (see above), no error code
- Classification confidence < 0.5: fall through to literal text search (no
  parse_filters), Variant B disabled this query (forced `basic_fallback`)

---

## Intent 04 — `recommendation_products_by_images`

### Modality demo: image

### Input
```json
{ "modality": "image", "file": "<binary>", "hint": "recommend" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent (sử dụng hint)
  └─► [intent=recommendation_by_images] → RECO_GRAPH
        ├─► (embedding ảnh = NATIVE trong Vespa, 512-d CLIP ADR-036 — `vision.embed` CHƯA CODE, không gọi qua MCP)
        ├─► vision.analyze (để biết category, gating)
        ├─► parallel:
        │    ├─► vespa.image_nearest_neighbor (visual similar)
        │    └─► analytics.co_purchased(category) [SQL]
        ├─► blend_and_rank (composite score)
        └─► return products
```

> **Verified `recommend_by_images.py` (5 node, 0 interrupt):** `vision_analyze` → `build_query_desc` → `parallel_fetch` (vespa.image_nearest_neighbor ∥ analytics.co_purchased) → `blend_and_rank` → `attach_reasons`. (Stages trên là mô tả logic; tên node code = 5 node này.)

### Tools used
`vision.analyze`, `vespa.image_nearest_neighbor`, `analytics.co_purchased`, `analytics.product_corpus_size`   # CODE verified recommend_by_images.py. `vision.embed` CHƯA CODE — embed ảnh native trong Vespa

### Events emitted
- 🟡 `RecommendationServed` — **CHƯA EMIT trong code** (0 occurrence; design/forward-looking)

### SSE Output sequence
```
status: analyzing
status: searching_similar
status: blending
product_ready: {item, index, total}   # per-item progressive (recommend_by_images publish_product_ready) — emit dần khi attach_reasons xong từng món
products: [10 recommendations with reason]   # bulk final (backward-compat)
final: {text: "Đây là 10 gợi ý dựa trên hình bạn gửi", reason_per_item: [...]}
```

### Error paths
- No category match (vision confidence low) → fallback to pure visual similarity
- Cold start (zero co-purchased) → use only visual similarity
- Mã lỗi thật `recommend_by_images` raise (verified per-graph): `E_VISION_BLUR`, `E_VISION_TIMEOUT`, `VALIDATION_FAILED`

---

## Intent 05 — `viewing_cart_products_by_text` (Hybrid Routing per D-S05-01 LAW)

> **REWRITE Phiên Sx05-2 atomic per C-S05-D resolution.** Old AI subtype-classify graph (S-04 era) DEPRECATED per D-S05-01 LAW + Rule 6 MOCKUP IS LAW (mockup 8 cart states show UI-direct REST actions, NOT NL chat input within cart page). New architecture = **Hybrid Routing**: high-frequency UI ops bypass AI graph (Direct REST `/api/v1/cart/*`); confirm-required or LLM-required flows go through AI graph `cart_by_text` 2 entry intents. Old graph preserved below for audit trail.

### Modality demo: text + UI-direct

### Architecture: Hybrid Routing (NEW S-05)

**Path 1 — Direct REST (high-frequency ops, optimistic UI per D-S05-07 LAW):**
- `GET /api/v1/cart` — cart view
- `POST /api/v1/cart/items` — add item with snapshot
- `PATCH /api/v1/cart/items/:id` — qty stepper +/- (qty=0 → auto-remove)
- `DELETE /api/v1/cart/items/:id` — swipe-to-delete single item
- `POST /api/v1/cart/promo` — promo code apply (exact-match fast-path per D-S05-05 LAW)
- `DELETE /api/v1/cart/promo` — promo code remove

Bypasses AI graph entirely. FE uses TanStack Query with optimistic updates + Redis JSON snapshot persistence (D-S05-02 LAW).

**Path 2 — AI graph `cart_by_text` (interrupt-required flows):**
2 entry intents (dispatched via `hint` field in `POST /intent` per C-S05-F Path α main.py extract):

#### Entry intent A — `hint=cart_clear_confirm` (D-S05-09 + D-S05-10 LAW)
```
ENTRY
  └─► clear_confirm_prompt
        ├─► cart.get MCP → get item_count + subtotal
        ├─► emit status SSE {status: 'awaiting_user_input'}
        ├─► emit clear_confirm SSE {item_count, subtotal, user_message, advice}
        │   # user_message BE-templated Vietnamese per D-S05-10 LAW _format_vnd helper
        │   # e.g. "Em sẽ xoá 1 món trị giá 51.000₫ khỏi giỏ. Hành động này không thể hoàn tác."
        │   # NO actions[] field per D-S05-09 LAW (FE hardcodes button labels per mockup)
        └─► interrupt({"awaiting": "clear_action"})   # Pattern A reuse per D-S05-03 LAW

USER POST /intent/{rid}/action {choice: 'confirm_clear'|'cancel_clear'}

RESUME
  ├─► [confirm_clear] → cart.clear MCP → emit cart_cleared SSE (minimal trigger per D-S05-11 LAW) → END
  └─► [cancel_clear] → emit clear_cancelled SSE → END
```

#### Entry intent B — `hint=cart_view_with_stock_check` (D-S05-04 LAW)
```
ENTRY
  └─► cart_view
        ├─► cart.get MCP
        ├─► cart.validate_stock → identify out-of-stock items
        ├─► [any out-of-stock] → loop per item:
        │     └─► stock_issue_lookup (per item):
        │           ├─► vespa.hybrid_search exclude category+brand (8s soft-timeout per R-S05-2)
        │           ├─► [Vespa hit] → LLM reason via cart_stock_replacement_reason.txt (8s soft-timeout)
        │           ├─► [Vespa null OR LLM timeout] → fixture fallback (cart_stock_replacement.json per C-S05-E Path a)
        │           ├─► emit stock_issue_ready SSE {product_id, replacement, reason}  # replacement=null if both fallbacks fail
        │           └─► interrupt({"awaiting": "stock_action", "product_id": "..."})

USER POST /intent/{rid}/action {choice: 'resolve_remove'|'resolve_replace', value: {product_id}}

RESUME (per interrupt)
  ├─► [resolve_remove] → cart.remove MCP
  ├─► [resolve_replace] → atomic cart.remove + cart.update_qty (replacement product)
  └─► emit cart_updated SSE (minimal trigger per D-S05-11 LAW) → loop next stock_action OR END

[no out-of-stock] → emit cart_view_ready SSE → END
```

> **CODE verified `cart_by_text.py` — 6 node** (set qua `add_node`): `clear_confirm_prompt` (fn `n_clear_prompt`) · `clear_execute` (= bước RESUME `confirm_clear` → `cart.clear`) · `cart_view` (fn `n_cart_view`) · `stock_issue_lookup` (fn `n_stock_lookup`) · `stock_resolve` (= bước RESUME `resolve_remove`/`resolve_replace`) · `final`. Doc cũ ghi node-id bịa (`_node_*`) → đã sửa về node-id thật; 3 node `clear_execute`/`stock_resolve`/`final` trước chỉ mô tả inline nay nêu rõ. (Thứ tự edges chưa verify riêng.)

### Tools used (Hybrid Routing)
**Direct REST path:** Gateway `/api/v1/cart/*` 7 endpoints → CartService → MCP JSON-RPC `cart.{get|update_qty|remove|clear|validate_stock|apply_promo|remove_promo}`
**AI graph path:** `cart.get` / `cart.update_qty` / `cart.remove` / `cart.clear` / `cart.validate_stock` / `vespa.hybrid_search`, `events.append`

### Events emitted (SSE — 7 NEW S-05 events per Phiên Sx05-2a + D-S05-09/10/11 LAW)
- `clear_confirm` — Pattern A interrupt prompt (D-S05-09 + D-S05-10)
- `clear_cancelled` — minimal trigger
- `cart_cleared` — minimal trigger (D-S05-11)
- `cart_updated` — minimal trigger (D-S05-11)
- `cart_view_ready` — minimal trigger
- `stock_issue_ready` — per-item progressive streaming (D-S05-04)
- `stock_issue_summary` — tổng hợp sau khi resolve (D-S05-11) [doc cũ ghi `stock_action_resolved` — SAI, không ∈ catalog 31; code cart_by_text phát `stock_issue_summary`]

### Error paths
- AC9 verified live: 10/10 assertions PASS via 66+ smoke assertions (Phiên Sx05-2c)
- LLM timeout 8s → graceful degrade per R-S05-2 (replacement=null acceptable)
- Promo INVALID_CODE → Gateway returns 400 (LLM typo layer T03 separate)
- Pattern A interrupt resume race → idempotency middleware `intent:action:{rid}:{attempt_n}` Redis TTL 5min protection

### Cross-reference
- Live AC verification: `S-05-T02_REPORT.md` Section 2
- Pattern A precedent: `S-04 D-S04-13 LAW` (searching_by_text.py — 973 LOC reference impl)
- Code emit: `apps/ai/src/graphs/intents/cart_by_text.py` (verified 2026-06-09: **6 node** = `clear_confirm_prompt`, `clear_execute`, `cart_view`, `stock_issue_lookup`, `stock_resolve`, `final` + 2 interrupt `clear_action`/`stock_action`). *(Entry A: clear_confirm_prompt→[interrupt clear_action]→clear_execute; Entry B: cart_view→stock_issue_lookup→[interrupt stock_action]→stock_resolve→final. Doc cũ ghi "5 nodes" thiếu `final`.)*
- Mockup ground truth: `docs/mockups/intent-05/intent-05-state-{0..G}.html` (8 states per Rule 6 LAW)

---

<details>
<summary>⚠️ DEPRECATED — Old Intent 05 AI subtype-classify graph (S-04 era; preserved for audit trail per C-S05-D resolution)</summary>

### Old Modality demo: text

### Old Input
```json
{ "modality": "text", "content": "thêm 2 chai sp #5 vào giỏ" }
```

### Old Graph stages
```
ENTRY
  ├─► classify_intent (subtype: ADD | REMOVE | UPDATE_QTY | VIEW | CLEAR)
  └─► [intent=cart_*] → CART_GRAPH
        ├─► extract_entities (LLM: product reference, qty, op)
        ├─► resolve_product_ref (nếu "#5" = ordinal in last search, lookup from session memory)
        ├─► branch on subtype:
        │    ├─► ADD/UPDATE → cart.update_qty
        │    ├─► REMOVE → cart.remove
        │    ├─► VIEW → cart.get
        │    └─► CLEAR → cart.clear
        └─► EMIT CartUpdated, return final
```

### Old Tools used
`cart.get` / `cart.update_qty` / `cart.remove` / `cart.clear`, `products.get`, `events.append`

### Old Events emitted
- `CartUpdated` (mỗi lần thay đổi)

### Old SSE Output sequence
```
status: parsing
status: updating_cart  (hoặc viewing)
final: {text: "Giỏ hàng đã cập nhật", cart: Cart}
```

### Old Error paths
- Product reference không resolve được → ask clarify
- Qty <= 0 → reject với VALIDATION_FAILED

**Reason for deprecation:** Mockup 8 cart states (verified Phiên Sx05 Command files state-0 through state-G) show UI-direct REST actions (qty stepper +/-, swipe-to-delete, header "Xoá hết" → modal, promo input "Áp dụng", "Bỏ" button, "Thay" CTA) — KHÔNG có NL chat input within cart page. Per Rule 6 MOCKUP IS LAW (priority 1) + Rule 7 mockup (priority 1) > general spec 04_INTENT_SPECS (priority 5). Hybrid topology wins per D-S05-01 LAW.

</details>

---

## Intent 06 — `paying_order_products_by_text`

> ⚠️ **CHƯA CODE (verified 2026-06-09):** Intent 06 **KHÔNG có graph file** (paying KHÔNG có subgraph — xem §Common cuối doc). Toàn bộ orders/checkout/payment **CHƯA CODE** ở gateway (0 `orders`/`payments` controller, 0 checkout route — verified grep). `PAY_GRAPH` dưới = **flow logic ĐÍCH** do Gateway + workers (`payment-consumer`) xử lý, KHÔNG phải LangGraph. `orders.create` **KHÔNG phải MCP tool thật** (registry chỉ có `products.create/get/update`) — orders ghi tầng dưới. Payment provider payload/ack phải verify SDK khi code. Đây là spec **wow-production**.

### Modality demo: text

### Input
```json
{ "modality": "text", "content": "thanh toán" }
```

### Graph stages
```
ENTRY
  ├─► classify_intent (subtype: PAY | CANCEL | VIEW_INVOICE)
  └─► [intent=paying_*] → PAY_GRAPH
        ├─► [PAY] branch:
        │    ├─► cart.get(user)
        │    ├─► validate (items > 0, stock OK)
        │    ├─► create Order in PG (status=pending, idempotency-key locked)
        │    ├─► publish OrderPlaced to Kafka
        │    └─► return order_id → FE gọi POST /orders/:id/pay {provider} (03 §1.8)
        │         → redirect/deeplink VNPay|MoMo; SSE chờ payment-consumer xác thực IPN
        ├─► [CANCEL] branch:
        │    ├─► fetch Order
        │    ├─► [status != pending] → reject
        │    ├─► update status=cancelled
        │    └─► publish OrderCancelled
        └─► [VIEW_INVOICE] branch:
             └─► return order detail
```

Consumer chain (separate workers, không nằm trong AI graph):
- `payment-consumer` nhận `OrderPlaced` → khởi tạo thanh toán **VNPay/MoMo/ZaloPay** (ADR-038) qua `POST /orders/:id/pay`; khi provider gọi `POST /payments/:provider/ipn` (verify chữ ký + idempotent `dedup_key`, ghi `payment_callbacks`) → publish `PaymentCompleted` | `PaymentFailed`. **KHÔNG còn mock charge.**
- `inventory-consumer` nhận `OrderPlaced` → reserve stock; sau `PaymentCompleted` → commit; sau `PaymentFailed`/timeout → release (`StockReleased`).
- `audit-logger` ghi audit-log hash-chain cho payment events (ADR-042).
- Gateway lắng SSE: order status đổi → push qua client.

**Payment methods (mockup intent-06 state-B-method = LAW):**
- Online gateway (ADR-038): **VNPay**, **MoMo/Ví**, **ZaloPay** → `POST /orders/:id/pay {provider}` → redirect/deeplink → OTP phía provider (mockup state-G) → IPN.
- Offline (không gateway): **COD / chuyển khoản bank / tiền mặt** → set `order.payment_method` trực tiếp, xác nhận thủ công.
- Refund: merchant `POST /payments/:txnId/refund` (03 §1.8) → status `refunded`.

### Tools used
`cart.get`, `orders.create`, `events.append` (NestJS gateway + `payment-consumer` worker, không qua AI service). Payment init/IPN/refund = REST endpoints `03 §1.8` (KHÔNG qua MCP).

### Events emitted (& consumed)
- Emit: `OrderPlaced`, `OrderCancelled`, `PaymentRefunded`
- Consume (workers): `PaymentCompleted`, `PaymentFailed`, `StockReserved`, `StockReleased`

### SSE Output sequence
```
status: building_order
order_update: {order_id, status: 'pending'}
status: awaiting_payment_method               # mockup state-B chọn VNPay/MoMo/ZaloPay/COD…
order_update: {order_id, redirect_url}        # online: redirect/deeplink (mockup state-C processing)

(async sau IPN provider → payment-consumer)
order_update: {order_id, status: 'paid'}      # mockup state-D success / state-H receipt
final: {text: "Thanh toán thành công"}

OR:
order_update: {order_id, status: 'failed', reason: "declined|timeout"}  # mockup state-E / state-F
final: {text: "Thanh toán thất bại"}
```

### Error paths
- Empty cart → `VALIDATION_FAILED`
- Stock insufficient (race) → `INSUFFICIENT_STOCK`, compensating event `StockReleased`
- Provider declined → `PAYMENT_FAILED` (mockup state-E declined)
- Provider timeout 30s → mark failed + compensate (mockup state-F timeout)
- IPN chữ ký sai → `SIGNATURE_INVALID` (log, KHÔNG cập nhật order)
- Cross-tenant order access → `CROSS_TENANT`

---

## Intent 07 — `analyzing_by_voices`

### Modality demo: voice

### Input
```json
{ "modality": "voice", "file": "<audio binary>" }
```

### Graph stages (CODE verified `analyzing_by_voices.py` 2026-06-09 — 8 node)
```
ENTRY (router → ANALYTICS_GRAPH)
  → load_context          # Redis voice:context (voice session memory, reuse D-S08-NN-A)
  → speech_transcribe          ← [SỬA: load_context TRƯỚC speech_transcribe — per add_edge thật START→load→transcribe]
  → classify_analyze      # LLM: metric / dimension / time_range / filters / viz_hint
  → execute_queries       # parallel analytics tools (CODE verified — KHÔNG sales_by_month/trend_history):
                          #   analytics.aggregate · detect_anomaly · explain_trend · stock_snapshot
                          #   · suggest_loan · suggest_promo · suggest_restock  (+ cart.get khi cần)
  → build_insights        # tổng hợp số liệu → insight + chart_spec (line/bar/pie)
  → narrate               # LLM narrative (explain WHY trend)  [speech.synthesize = ĐÃ CODE (OpenAI TTS thật, registered, `apps/mcp/src/tools/speech.py:243`) — narrate CHƯA gọi → chưa wire vào graph + FE chưa phát audio_b64]
  → save_voice_context
  → final
```
> ⚠️ `analytics.sales_by_month` / `analytics.trend_history` = **CHƯA CODE** (không tồn tại trong registry). Tool thật: aggregate/detect_anomaly/explain_trend/stock_snapshot/suggest_{loan,promo,restock} (+ co_purchased/product_corpus_size/suggest_price). Voice memory load/save_context reuse D-S08-NN-A.

### Tools used
`speech.transcribe`, `cart.get`, `analytics.*` (aggregate/detect_anomaly/explain_trend/stock_snapshot/suggest_loan/suggest_promo/suggest_restock — CODE verified analyzing_by_voices.py). `speech.synthesize` (optional TTS) — graph hiện CHƯA gọi

### Events emitted
- `AnalyticsQueried` (light, only for usage stats)

### SSE Output sequence
```
status: transcribing
partial_text: "Bạn nói: phân tích trend nước tương 6 tháng"
status: querying
tool_result: analytics.aggregate (summary)
tool_result: analytics.explain_trend (summary)
status: synthesizing
chart: {type:'line', title, x_axis, y_axis, series:[{name, data}]}
partial_text: "Nước tương Maggi giảm 35% do..."
final: {text: '...full narrative', chart_id}
```

### Error paths
- Empty data → return text-only "Chưa đủ dữ liệu"
- Range > 24 months → reject hoặc truncate
- Mã lỗi thật `analyzing_by_voices` raise (verified per-graph): `E_ANALYTICS_TIMEOUT` (analytics query timeout), `E_TRANSCRIBE_FAILED`, `E_NO_SPEECH`

---

## Intent 08 — `login_logout_by_text`

### Modality demo: text (form / chat)

### Input
```json
{ "modality": "text", "content": "đăng nhập email a@b.com password ..." }
```

OR direct REST: `POST /auth/login { email, password }`

### Graph stages
Đây intent đơn giản nhất, **KHÔNG cần đi qua AI service** trong happy path. Gateway xử lý trực tiếp.

```
NestJS /auth/login:
  ├─► validate dto
  ├─► fetch user from PG by email
  ├─► bcrypt.compare(password, hash)
  ├─► [fail] → 401 UNAUTHORIZED
  ├─► generate JWT (jti, exp 24h)
  ├─► insert sessions row
  ├─► SET redis session:{jti} (TTL = exp)
  ├─► publish UserLoggedIn (Kafka)
  └─► return tokens
```

Logout:
```
NestJS /auth/logout:
  ├─► verify JWT
  ├─► DEL redis session:{jti}
  ├─► UPDATE sessions SET revoked_at = NOW()
  ├─► publish UserLoggedOut
  └─► 204
```

> **Verified 2026-06-09:** tokens giao qua **Set-Cookie httpOnly** (`icp_session` SameSite=Lax + `icp_refresh` SameSite=Strict, xem `03 §1.1`) — KHÔNG trả token trong body. **bcryptjs cost 10** + `sessions` row + Redis `session:{jti}` = CÓ THẬT. `publish UserLoggedIn/Out (Kafka)` = 🟡 **CHƯA WIRE** (Kafka chưa wire — hiện emit behavior `auth.signed_in`/`signed_out` + `auth.password_reset_requested`).

Chỉ khi user gõ trong chat "đăng nhập" thì AI service phát hiện intent này và prompt user mở form login UI (không xử lý credentials qua AI).

### Tools used (nếu qua AI path)
`auth.verify_jwt` — 🟡 **STUB** (verified `apps/mcp/src/tools/auth.py:29`: `return None` cho MỌI token đến S-03; gateway coi null = chưa auth → 401 UNAUTHORIZED). Tool đã `register` nhưng **chưa verify thật**.

### Events emitted
- ✅ **Behavior events** (THẬT — qua TrackingService loopback → INSERT `behavior_events`; verified `auth.service.ts`): `auth.signed_in` (post-login :79), `auth.signed_out` (post-logout :110), `auth.password_reset_requested` (post forgot-password :181).
- 🟡 `UserLoggedIn` / `UserLoggedOut` (Kafka domain events) = **CHƯA WIRE** (Kafka chưa wire — code không emit; behavior events ở trên thay thế tạm).

### SSE / Response
Direct REST 200/204, không SSE.

### Error paths
- Wrong creds → 401
- User not found → 401 (không leak)
- JWT expired → 401 với `code: TOKEN_EXPIRED`

---

## Common: Intent Classifier Prompt Template

```
Bạn là intent classifier cho hệ thống ICP. Phân loại user input vào 1 trong:
- importing_by_images
- importing_by_voices
- importing_by_text
- buying_by_images
- buying_by_voices
- buying_by_text
- searching_by_images
- searching_by_voices
- searching_by_text
- recommendation_by_images
- recommendation_by_voices
- recommendation_by_text
- cart_by_images
- cart_by_voices
- cart_by_text
- paying_by_images
- paying_by_voices
- paying_by_text
- analyzing_by_images
- analyzing_by_voices
- analyzing_by_text
- login
- logout
- unknown

# Ghi chú: đây là TAXONOMY label classifier (router output), KHÔNG phải graph files.
#   `paying_*`, `login`, `logout` → Gateway/workers xử lý (KHÔNG có subgraph). Chỉ 6 intent
#   (importing_by_images, buying_by_voices, searching_by_text, recommend_by_images, cart_by_text,
#   analyzing_by_voices) có graph thật — xem `01 §5`.

Modality: {modality}
Hint từ frontend (nếu có): {hint}
User input: {content}

Trả về JSON: {intent: string, confidence: float, entities: {...}}
```

Confidence < 0.5 → fallback ask user.

> **CODE verified (router thật, lệnh #29):** template 24-label LLM classifier ở trên = **TAXONOMY DESIGN/đích** (🟡 chưa code đầy đủ). LIVE: `apps/ai/src/graphs/router_graph.py::classify_intent` = **heuristic** (S-04 T02 amend, `router_graph.py:49`): `modality=='text' & content non-empty → 'searching_by_text' (conf 0.95)`, else `'unknown' (0.0)` — baseline Phase-1 "luôn unknown" ĐÃ bị amend; dispatch subgraph thật ở `main.py` theo **modality + FE `hint`/entry_intent**, emit log `intent.classified`. CHƯA có LLM 24-label trả `{intent,confidence,entities}` chạy thật — các label "không-graph" (importing_by_voices, buying_by_text, searching_by_voices, paying_by_text, recommendation_by_text…) = **0 occurrence trong code**.

---

**END OF INTENT SPECS DOC.**
