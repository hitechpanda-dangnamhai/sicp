# Phase 02 — Auth + Text Search (Intent 08 + 03)

> **Status:** ✅ **DONE** (auth + search by text verified vs code 2026-06-09). Phần production = §Auth hardening + §Search production.
> **Mục tiêu:** Intent 08 (login/logout/refresh) + Intent 03 (search by text, adaptive graph) end-to-end.
>
> **Cross-ref:** `03_API_CONTRACTS.md` §1.0/§1.1, `04_INTENT_SPECS.md` Intent 03, `02_DATA_MODEL.md` §2 (Vespa), `07_BEHAVIOR_LOGS.md`.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs apps/gateway/src/auth + apps/ai/.../searching_by_text.py):
- Search graph S-04 ĐÃ CODE THẬT (interrupt×4, AsyncRedisSaver, product_ready, co_purchase fixture, mode-based rank). Đánh DONE.
- DRIFT sửa: Vespa rank_profile thật = cross_encoder_rerank (mode ai_augmented) / baseline (basic_fallback), KHÔNG phải 'ai_augmented' rank profile như doc. mode (state) ≠ rank_profile (Vespa).
- co_purchase_lookup search = FIXTURE /app/infra/seed/co_purchase_category.json (category-level stub) — KHÁC analytics.co_purchased (Intent 02/04 on-the-fly). Giữ đúng code.
- Auth = 5 route thật (login/logout/me/refresh/forgot-password). bcrypt→bcryptjs. text.embed RETRACTED→Vespa native embed (đúng).
- XOÁ cruft S-04: Phiên Sx04/Sx04-3/Sx04-4 amendment narration, D-S04-NN, C-S04-N, MASTER_SLICE_BACKLOG line refs, Day1-7.
- THÊM production: rate-limit/lockout, refresh rotation+reuse-detection, CORS/CSP, personalized rank-profile (CHƯA CODE). -->

## Definition of Done — trạng thái thật (verified)

- [x] Login `/auth/login` → JWT (HS256, bcryptjs cost 10, secret≥32, exp `JWT_ACCESS_TTL_HOURS`=24); `/auth/me`; `/auth/logout` revoke session; `/auth/refresh` rotating; `/auth/forgot-password` ✅
- [x] Web login form + chat/search UI (route `auth`, `intent-03`) ✅
- [x] Intent 03 search adaptive graph (`searching_by_text.py`): Variant B (`mode=ai_augmented`) PhasesCard + understanding + per-product `product_ready` + match_score + reason; Variant A (`basic_fallback`) BM25 baseline ✅
- [x] Typo correction (`detect_typo` + `interrupt(typo_action)`), empty_state, graceful degrade (`generate_understanding` TimeoutError → `variant_degraded` + `interrupt(degrade_action)`) ✅
- [x] Vespa indexed products (CLIP 512-dim, embed native) + rank_profiles **`cross_encoder_rerank`** (augmented) / `baseline` (fallback) thật trong code ✅
- [x] SSE stream (status, products, final + phase_progress/understanding/typo_suggestion/variant_degraded/co_purchase_hint/empty_state/product_ready) qua Redis pub/sub `sse:pubsub:{rid}` ✅
- [x] Idempotency middleware POST/PUT/PATCH/DELETE (skip `/auth/login`) ✅
- [ ] Auth hardening (rate-limit, CORS/CSP, reuse-detection) — §Auth hardening (🟡)

## Scope

### A. Auth (Gateway only — `apps/gateway/src/auth`)

Cấu trúc (verified): `auth.{module,controller,service}.ts`, `jwt.strategy.ts`, `jwt-auth.guard.ts`, `domain/{user.entity,errors}.ts`, `application/{login,logout,refresh}.use-case.ts (+spec)`, `infrastructure/{postgres-user.repo,redis-session.store}.ts`, `dto/`.

Routes (5, verified): `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/refresh` · `POST /auth/forgot-password`.

- **bcryptjs** cost 10 (verified `login.use-case.ts` `bcryptjs.compare`; `auth.service.spec` "D-01 bcryptjs cost 10 contract").
- JWT HS256, `JWT_SECRET` ≥32, exp 24h (`JWT_ACCESS_TTL_HOURS`); refresh = `JWT_REFRESH_TTL_DAYS` (`jwt.helper.ts` + `config/env.schema.ts`).
- Refresh **rotating** + revoke old (`sessions.refresh_token_hash` UNIQUE, V009): `/auth/refresh` issue new + revoke old (chống replay, OAuth 2.1 BCP).
- `JwtAuthGuard` verify cookie httpOnly; AI service tin `X-User-Id` Gateway forward (KHÔNG verify JWT ở AI; `auth.verify_jwt` MCP = STUB).

### B. Idempotency Middleware

`apps/gateway/src/common/idempotency.middleware.ts` — apply global POST/PUT/PATCH/DELETE, **skip `/auth/login`** (không cache password attempts). Redis SETNX + cache + lock-conflict 409. Log `idempotency.lock_acquired`/`cache_hit`/`lock_conflict`.

### C. Intent 03 — Search adaptive graph (`apps/ai/src/graphs/intents/searching_by_text.py`)

> ✅ **Implemented.** Adaptive single-endpoint + graceful degradation. State `mode ∈ {ai_augmented (default), basic_fallback}`. Checkpointer **`AsyncRedisSaver`** (`langgraph.checkpoint.redis.aio`, `from_conn_string(url, ttl)` async ctx ở `main.py`; TTL 30 + refresh_on_read). SSE transport = Redis pub/sub `sse:pubsub:{rid}` (`redis_publisher.py`). Gateway `ioredis.duplicate().subscribe()` forward SSE; `POST /intent/{rid}/action` → AI resume `Command(resume=...)`.

Nodes (verified `_node_*`):
1. `detect_typo` (ai_augmented) — LLM; confidence > 0.85 → `typo_suggestion` SSE + `interrupt({awaiting:'typo_action'})` → resume accept/reject.
2. `generate_understanding` (ai_augmented) — LLM; **TimeoutError** → flip `mode=basic_fallback` + `variant_degraded` SSE + `interrupt({awaiting:'degrade_action'})` → resume retry_ai (clear checkpoint, re-invoke) / continue_basic.
3. `parse_filters` — LLM structured (both modes); cross-language category ("soy sauce for pho" → nuoc_tuong); regex fallback Variant A.
4. `embed_query` — **Vespa native embed** (no MCP tool); pass-through; Variant A skip.
5. `hybrid_search` — MCP **`vespa.hybrid_search`**; **`rank_profile = 'cross_encoder_rerank' if mode=='ai_augmented' else 'baseline'`** *(code: cross_encoder_rerank thay LLM rerank Gemini, top-30 retrieved)*.
6. `generate_reasons` (ai_augmented) — LLM per-product parallel (2s/product, item-level degrade); per-product **`product_ready`** SSE emit + ops log `intent.first_card_emitted` (perceived-latency telemetry, paired FE `search.first_card_rendered`).
7. `rank_finalize` (both) — canonical `products` SSE (reconcile) + `interrupt({awaiting:'cart_action'})` ALWAYS (Option α, Gateway 60s timeout) → resume add_to_cart/skip.
8. `co_purchase_lookup` (conditional, IF `cart_trigger_product_id` set) — đọc **fixture** `COPURCHASE_FIXTURE_PATH=/app/infra/seed/co_purchase_category.json` (category-level stub, S-04) → `co_purchase_hint` SSE.
9. `no_product_ref` (branch, CODE verified) — khi query KHÔNG có tham chiếu sản phẩm (chào hỏi/không liên quan) → trả về sớm, không gọi Vespa (gate tương tự `is_product_reference` Intent 02).

> **Co-purchase note:** search co_purchase_hint dùng **fixture category** (đúng code). KHÁC feature co-purchase Intent 02/04 = MCP `analytics.co_purchased` on-the-fly. Matview `co_purchase_matrix` = 🔵 TÙY CHỌN precompute (chưa cam kết, grep repo=0) — dùng khi on-the-fly chậm ở scale.

End-of-graph: `await saver.adelete_thread(rid)` sau `final` (fast cleanup).

### D. MCP Tools (search)

- `vespa.hybrid_search` — accepts `rank_profile`; response có `match_score` summary feature (augmented). Impl `apps/mcp/src/tools/vespa.py` (httpx → Vespa `:8080/search/` YQL `embed(@query, clip_multilingual)`).
- `vespa.index` — feed `/document/v1/`; embedding auto-generated bởi Vespa schema indexing expression (no client-side embed).
- ~~`text.embed`~~ **bỏ** — Vespa native embedder (CLIP-ViT-B-32-multilingual-v1, 512-dim) embed cả query lẫn index-time. Cross-ref `02 §2`.

Python deps (`apps/ai`): `langgraph-checkpoint-redis`, `redis` (async), `google-generativeai` (Gemini primary), `openai` (fallback). Gateway: `ioredis` (subscribe).

### E. Web — Search UI (ráp từ component library, verified tồn tại)

Components thật (`components/icp/`): `organisms/LoginForm`, `molecules/{ProductCardSearchB, SuggestedQueryChips, FollowupFilterChips, AddToCartConfirmCard, CoPurchaseHintCard, PhasesCard, AnalyzingPhasesCard, ...}`. Route `app/auth`, `app/intent-03`. Hook SSE (`product_ready` render vào slot pre-allocated theo `index`).

UX: chưa login → `/auth`; sau login → `/home`; tile "Tìm" → `/intent-03`; query → Variant B realtime; LLM timeout → ErrorCard 2 nút "Thử lại với AI"/"Dùng bản cơ bản".

### F. Vespa Init

Deploy schema `infra/vespa/` + bulk-feed products; embedding auto-generated bởi Vespa indexing expression (`input title ." " . input description | embed clip_multilingual`) — no client-side embed.

### G. Behavior Tracker

- `POST /api/v1/track` (batch ≤100, zod validate per event_type từ `shared-types/src/behavior/`) ✅ (`tracking.controller.ts`). Enrich `received_at`/`ip_hash`; drop bot UA; drop invalid → metric `icp.behavior.dropped{reason}`.
- 🟡 **CHƯA WIRE:** Kafka producer `icp.behavior.events` + worker `behavior-pg-sink` (apps/workers = skeleton). Persistence path hiện tại → verify (direct INSERT vào `behavior_events_yYYYYmMM` hay Redis); Kafka choreography = production target.
- Events Phase 02: `session.started`, `auth.signed_in`, `search.*` (catalog.ts có 31 event types thật).

### H. Observability (đi kèm feature, không dồn Phase 06)

- Logs: `auth.login_succeeded`/`failed`; `intent.received`→`intent.classified`→`vespa.search_completed` (+`intent.interrupted`/`resumed`/`degraded`/`first_card_emitted`).
- Metrics: `icp.intent.requests{intent,modality,status}` + duration histogram; `icp.behavior.events_received`/`dropped`.
- Traces: login gateway→MCP; search gateway→ai→mcp→vespa (cùng `trace_id`).
- Grafana: dashboard "Intent Performance" p50/p95.

## Test scenarios (giữ — production)

| ID | Scenario | Expected |
|---|---|---|
| AUTH-01..04 | login ok / wrong pw / me / logout reuse | 200+JWT / 401 / 200 / 401 |
| IDEM-01/02 | 2× same key / concurrent | same resp / 1 ok + 1×409 |
| SEARCH-01 | "nước tương" `ai_augmented` | ≥5 products + match_score + reason (rank_profile=cross_encoder_rerank) |
| SEARCH-02 | "nước tương dưới 50k" | price ≤ 50000 |
| SEARCH-03 | "asdfgh" | 0 results + `empty_state` SSE |
| SEARCH-04 | typo "mai gi" | `typo_suggestion` corrected='Maggi' + accept→re-run |
| SEARCH-05 | LLM timeout @generate_understanding | `variant_degraded` reason=llm_timeout → continue_basic = Variant A |
| SEARCH-06 | `mode=basic_fallback` | skip Variant B nodes; rank_profile=baseline; no match_score/reason |
| SEARCH-07 | add-to-cart từ Variant B | `co_purchase_hint` từ fixture category (anchor nuoc_tuong→tuong_ot) |
| SEARCH-08 | PhasesCard 4 phases | `phase_progress` phase_id 0..3 active→done |

## Public interfaces sẵn cho Phase 03

- Authenticated REST `/api/v1/*` (Bearer + Idempotency-Key); SSE qua Redis pub/sub working.
- MCP: `vespa.hybrid_search`, `vespa.index`, `auth.verify_jwt` (STUB). `text.embed` bỏ (Vespa native).
- AI `/intent` + `/intent/{rid}/action` (resume); router pattern; Vespa schema deployed.

---

## Auth hardening (production — §5b)

| Hạng mục | Hiện trạng | Đề xuất + nên dùng gì | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **Rate-limit / brute-force lockout** | chưa thấy trên `/auth/login` | `@nestjs/throttler` + đếm fail per (ip,email) qua Redis + lockout tạm | 🟡 CHƯA CODE | **P0** |
| **Refresh reuse-detection** | rotation đã có | phát hiện refresh token đã revoke bị tái dùng → revoke cả family (chống token theft) | 🟡 CHƯA CODE | **P0** |
| **CORS allowlist + security headers** | CORS cấu hình (`05 §10`) | helmet + CSP + HSTS; allowlist origin chặt | 🟡 CHƯA CODE | **P0** |
| **JWT secret rotation** | secret tĩnh env | rotate qua vault + kid header | 🔵 TÙY CHỌN | P1 |
| **Tenant context (ADR-040)** | 0 tenant_id | X-Tenant-Id header + JWT `tenant_id` claim → TenantContextGuard → RLS GUC; `users.email` global UNIQUE (`03 §1.0`) | 🟡 CHƯA CODE | **P0** |
| **Consent gating tracking (ADR-041)** | track chưa gate consent | chỉ track khi consent `behavior_tracking` (`03 §1.9`) | 🟡 CHƯA CODE | **P0** |

## Search production (§5b)

| Hạng mục | Hiện trạng | Đề xuất | Nhãn | Ưu tiên |
|---|---|---|---|---|
| **Rank-profile `personalized` (ADR-043)** | 6 profile, không personalized | per-tenant LTR weights (`query(w_text/w_trend/w_behavior)`); giữ cross_encoder_rerank/ai_augmented làm fallback | 🟡 CHƯA CODE | P2 |
| **Circuit breaker Vespa/LLM** | timeout per node | breaker + retry/backoff cho Vespa + Gemini/OpenAI | 🟡 CHƯA CODE | P1 |
| **co_purchase_matrix precompute** | fixture + on-the-fly | matview precompute khi scale (reader = analytics.co_purchased) | 🔵 TÙY CHỌN | P2 |
| **Redis HA** | single instance (RedisSaver+pub/sub SPOF) | Redis Sentinel/Cluster; fail-fast on Redis lost | 🟡 CHƯA CODE | P1 |

---

## Câu hỏi đã chốt (giữ — quyết định kỹ thuật)

- Refresh token: **rotating** (issue new + revoke old) chống replay (OAuth 2.1 BCP).
- JWT verify ở AI service: **KHÔNG** — Gateway verify cookie qua `JwtAuthGuard`; AI tin `X-User-Id` Gateway-forward (pattern cho mọi intent).

---

**END — PHASE_02 (Production reconcile 2026-06-09).**
