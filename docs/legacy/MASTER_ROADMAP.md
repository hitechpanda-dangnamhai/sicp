# Master Roadmap — ICP (Production)

> **Version:** 2.0 (production re-cast — phase-based). **Supersedes** hackathon Step‑1 roadmap v1.x (5 Stage / 12 slice S‑00→S‑11).
> **Date:** 2026-06-09
> **Status:** ⭐ ACTIVE
> **Source of truth (theo thứ tự):** (1) query DB trực tiếp · (2) source code thật (đang phát triển — code hiện có = chuẩn) · (3) 14 file canonical đã reconcile. Baseline fingerprint **verified 2026-06-09** (tables 14+3part · matviews 3 · migrations 8 cao nhất V010 · MCP 37 · graph 6).
>
> **Mục đích:** Lộ trình tổng cấp dự án, tổ chức theo **7 Phase (00–06)** + **track Production Hardening** cross‑cutting. Mỗi hạng mục có trạng thái rõ (DONE / CHƯA CODE / TÙY CHỌN) + evidence + cross‑ref **tên file canonical**. KHÔNG plan task chi tiết — đó là `MASTER_SLICE_BACKLOG.md` + `phases/PHASE_0X_*.md`.
>
> **Lineage:** Dự án đã chuyển **Hackathon → Production** (ADR‑037). Roadmap tiền thân (5 Stage, "5–6 tuần", pitch/demo, slice S‑00..S‑11) = **SUPERSEDED**; bản đồ Stage→Phase giữ ở Appendix làm tham chiếu lịch sử.

---

## Legend trạng thái

| Ký hiệu | Nghĩa | Tiêu chí |
|---|---|---|
| ✅ **DONE** | Đã build, verified trong code/DB | có evidence (route/graph/table/migration…) |
| 🟡 **CHƯA CODE** | Có spec/cam kết (ADR/canonical), chưa build | là target roadmap |
| 🔵 **TÙY CHỌN** | Tối ưu / feature tương lai, **chưa cam kết** | grep repo = 0; giữ + "nên dùng khi…" |

Ưu tiên production: **P0** (bắt buộc trước go‑live) · **P1** (nên có) · **P2** (khi scale).

---

## Project Snapshot (verified 2026-06-09)

| Item | Value | Evidence / Source |
|---|---|---|
| Project | ICP — Intelligent Commerce Platform (8 intents, single‑screen AI commerce) | `00_CONTEXT.md` §1 |
| Định hướng | **Production** (không còn hackathon) | ADR‑037 (`DECISIONS.md`) |
| Stack | Next.js / NestJS / Flask+LangGraph / MCP server / Vespa / Postgres / Redis / (Kafka **CHƯA WIRE**) | `01_ARCHITECTURE.md` |
| DB | **14 bảng + 3 partition** (behavior_events_y2026m05/06/07), **3 matview** (analytics_daily/_category/_product_performance), **8 migration** (gap V004/V007, cao nhất **V010**) | query DB 2026-06-09 |
| Multi‑tenant | **0 cột `tenant_id`**; 10 bảng production VẮNG (tenants, tenant_memberships, payment_callbacks, consent_records, data_subject_requests, data_retention_policies, audit_log, tenant_ranking_weights, usage_events, usage_daily) | query DB — 🟡 CHƯA CODE |
| Code (gateway) | **25 route / 8 controller** (auth5/cart7/cards3/intent4/products1‑PATCH/track1/health2/dashboard2) | grep routes |
| Code (AI) | **6 LangGraph graph** (analyzing/buying/cart/importing/recommend/searching) + router skeleton | `ls graphs/intents` |
| Code (MCP) | **37 tool** registered | grep `register(` |
| Workers | **SKELETON** (chỉ `index.ts` + `shopee-mock-seed-worker.ts`) — 8 worker canonical 🟡 CHƯA CODE | `apps/workers/src` |
| Messaging | **Kafka CHƯA WIRE** — hiện chỉ Redis pub/sub SSE (`sse:pubsub:{rid}`) | `LOG_CATALOG.md` §A |
| Observability | **OTel ĐÃ implement** (NodeSDK + OTLP gRPC→otel‑collector:4317; Pino redact) + LGTM (Loki 2.9.4 / Tempo 2.4.1 / Prometheus v2.50.0 / Grafana 10.4.0) | `06_OBSERVABILITY.md` |
| Search | Vespa `product.sd` — **6 rank‑profile** (baseline/ai_augmented/hybrid/image_similarity/image_recommendation/cross_encoder_rerank; **không** `personalized`), CLIP 512‑dim, image_embedding embed **native** từ `image_description` | `02_DATA_MODEL.md` §2 |
| Codegen | Contract‑first **ĐÃ wire** (root `package.json`: openapi:export/generate/sync; `openapi.json` committed) | `05_CODING_CONVENTIONS.md` §8, `08_FE_BE_CONTRACT.md` |
| Auth/Sec baseline | bcryptjs cost 10 · JWT HS256, secret ≥32, exp 24h (`JWT_ACCESS_TTL_HOURS`) · Pino redact | `05_CODING_CONVENTIONS.md` §10 |
| ADR production | 037 Hackathon→Production · 038 Payment VNPay+Momo+ZaloPay thật · 039 Shopee crawler thật · 040 Multi‑tenant model #2 · 041 GDPR+Luật VN 2025 · 042 hash‑chain audit · 043 per‑tenant LTR · 044 usage metering | `DECISIONS.md` |

---

## Intent ↔ Phase ↔ Code map

| Intent | Tên | Phase | Code thật | Trạng thái |
|---|---|---|---|---|
| 08 | Auth | PHASE_02 | gateway `auth.controller` (5 route) | ✅ DONE |
| 03 | Search by text | PHASE_02 | `searching_by_text.py` + `vespa.hybrid_search` | ✅ DONE |
| 01 | Import by images | PHASE_03 | `importing_by_images.py` + MCP vision/vespa/products/shopee | ✅ DONE |
| 05 | Cart by text | PHASE_04 | `cart_by_text.py` + cart controller (7 route) | ✅ DONE |
| 02 | Buy by voice | PHASE_04 | `buying_by_voices.py` | ✅ DONE (logic) |
| 06 | Pay | PHASE_04 | **không có** orders/payments controller, không payment MCP tool | 🟡 CHƯA CODE (ADR‑038) |
| 04 | Recommend by images | PHASE_05 | `recommend_by_images.py` | ✅ DONE |
| 07 | Analytics by voice | PHASE_05 | `analyzing_by_voices.py` + analytics MCP (10) + 3 matview | ✅ DONE |

> Intent 06 (pay) và 08 (auth) **không có LangGraph graph** — xử lý ở Gateway (đúng code: 6 graph, không paying/auth).

---

## Phase 00 — Design System & Visual Identity

**Goal:** Design tokens + component library + mockup ground‑truth cho toàn bộ FE.

- Mockup + design tokens v3 (MoMo‑inspired) = **reference LOCKED** (xem `phases/PHASE_00_DESIGN_SYSTEM.md`).
- ⚠️ Trạng thái build component library `apps/web` **chưa fingerprint trong phiên này** → verify trực tiếp khi chuẩn hoá `PHASE_00` (đánh DONE/CHƯA CODE theo code thật, không assume).

**Nâng cấp production (§5b):**
- 🟡 **P1** A11y + `prefers-reduced-motion` guard cho mọi animation (mockup dùng shimmer/slide‑up/pop nhiều) — nên dùng CSS media query + token. Cross‑ref `08_FE_BE_CONTRACT.md`.
- 🟡 **P1** Bundle budget enforce < 500KB gz/route (đã là budget ở `05 §11`) — nên gate trong CI (`next build` + size‑limit).
- 🔵 **P2** Design‑token contract test (token drift FE↔doc).

---

## Phase 01 — Infrastructure & Skeleton

**Goal:** Monorepo, 4 service skeleton, DB + migrations, observability, codegen pipeline.

**✅ DONE (verified):**
- DB schema thật: 14 bảng + 3 partition; **8 migration applied** (cao nhất V010). *(gap V004/V007 — bị bỏ; migration mới bắt đầu **V011**.)*
- OTel **đã implement thật** + LGTM stack (version pinned — không `:latest`). Cross‑ref `06_OBSERVABILITY.md`.
- Codegen contract‑first **đã wire** (OpenAPI → TS `openapi-typescript-codegen` + Python `datamodel-code-generator`). Cross‑ref `05 §8`, `08`.
- 4 service skeleton + `/health` + `/ready` (gateway health controller 2 route).

**🟡 CHƯA CODE (committed):**
- **Kafka chưa wire** — chỉ Redis pub/sub SSE. Khi cần choreography đơn hàng/payment → wire Kafka (KafkaJS) + topic `icp.*`. Cross‑ref `01_ARCHITECTURE.md` §3, `LOG_CATALOG.md` §A. **P1**.
- **8 worker canonical** (card‑generator, payment‑consumer, inventory‑consumer, notification‑consumer, behavior‑aggregator, outbox, audit‑logger, shopee‑crawl) = skeleton. **P0–P1** tuỳ worker.

**Nâng cấp production (§5b):**
- 🟡 **P0** Migration forward‑only + rollback plan + backup/PITR (DR). Nên dùng: Flyway (đang dùng tracking) + `pg_dump`/WAL‑G.
- 🟡 **P1** Connection pool tuning (mặc định 10/service — `05 §9`) + timeout mọi I/O.
- 🟡 **P1** CI gate: `lint --max-warnings 0` + typecheck + `openapi:sync` drift check. Cross‑ref `05 §6`.
- 🔵 **P2** Outbox + DLQ pattern (khi Kafka wire) — nên dùng transactional outbox (ADR‑006).

---

## Phase 02 — Auth + Text Search (Intent 08 + 03)

**Goal:** Login/JWT + product discovery bằng text qua Vespa hybrid.

**✅ DONE (verified):**
- Auth: `auth.controller` 5 route (login/logout/me/refresh/forgot‑password); bcryptjs cost 10; JWT HS256 secret ≥32 exp 24h (env). Cross‑ref `03 §1.1`, `05 §10`.
- Search Intent 03: `searching_by_text.py` → `vespa.hybrid_search`; Vespa rank‑profile `baseline`/`ai_augmented`/`hybrid` thật. Cross‑ref `04 Intent03`, `02 §2`.

**🟡 CHƯA CODE (committed / production‑grade):**
- **Rate limiting / brute‑force lockout** trên `/auth/login` — **P0**. Nên dùng: `@nestjs/throttler` + đếm fail per (ip,email) qua Redis.
- **Refresh‑token rotation + reuse‑detection** — schema đã có `sessions.refresh_token_hash` UNIQUE (V009) → bật rotation. **P0**.
- **CORS chặt + security headers (helmet/CSP)** — **P0** (`05 §10` CORS allowlist).
- **Rank‑profile `personalized`** (per‑tenant LTR, ADR‑043) — 🟡 CHƯA CODE; Vespa hiện không có. Cross‑ref Production Hardening Track.

---

## Phase 03 — Import Products (Intent 01) + Events/Cards Pipeline

**Goal:** Import sản phẩm từ ảnh (multimodal) → Vespa + Events → Action Cards.

**✅ DONE (verified):**
- `importing_by_images.py` gọi MCP: `vision.analyze`/`suggest_attributes`, `vespa.index`/`image_nearest_neighbor`/`search_trend`, `products.create`/`get`/`update`, `shopee.price_range`, `analytics.suggest_price`, `gtrends.interest_over_time`, `policies.find_matching`, `cards.*`. Cross‑ref `04 Intent01`.
- Image storage = **base64 inline** `products.image_data` (V010) — không cần S3/V007. Cross‑ref `02 products`.
- Vespa `image_embedding` embed **native** từ `image_description` (KHÔNG cần `vision.embed` MCP). Cross‑ref `02 §2`, `03 §5`.
- Action Cards: `cards.controller` 3 route + bảng `action_cards` + `policies` (DSL). Cards pipeline thật.

**🟡 CHƯA CODE (committed):**
- **Shopee crawler thật → `shopee_prices`** (ADR‑039). Code hiện đọc `shopee_prices_mock` (V008); tool `shopee.price_range` giữ shape, đổi nguồn khi crawler online. Worker `shopee-crawl` = skeleton. ⚠️ rủi ro ToS/pháp lý. **P1**.
- **products `GET`/`POST`/`DELETE`** route (hiện chỉ `PATCH :id`). Cross‑ref `03 §1.3`. **P1**.

**Nâng cấp production (§5b):**
- 🟡 **P0** File upload: validate MIME + size, lưu tạm, không persist binary trong DB ngoài image_data (đã có ở `05 §10`).
- 🟡 **P1** Circuit breaker + retry cho call ngoài (Gemini vision, Vespa, Shopee). Nên dùng: backoff + breaker (opossum/tenacity).

---

## Phase 04 — Buy (Voice) + Cart + Payment (Intent 02 + 05 + 06)

**Goal:** Giỏ hàng, đặt đơn, thanh toán thật.

**✅ DONE (verified):**
- Cart Intent 05: `cart_by_text.py` + `cart.controller` 7 route (items GET/POST/PATCH/DELETE, clear, promo apply/remove); MCP `cart.*` (7) + `vespa.hybrid_search`. Tool **`cart.update_qty`** (không phải `cart.upsert`). Cross‑ref `04 Intent05`, `03 §1.3b`.
- Buy Intent 02: `buying_by_voices.py` + `cart.get` + `analytics.co_purchased`. `speech.synthesize` (TTS) = 🟡 CHƯA CODE (graph chưa gọi). Cross‑ref `04 Intent02`.
- DB: `orders` (idempotency_key UNIQUE), `order_items`, `transactions` (14 cột V005: payment_method/failure_reason/metadata/provider_txn_id/completed_at; **chưa refund**).

**🟡 CHƯA CODE (committed — Intent 06 Payment, ADR‑038):**
- **Payment VNPay + Momo + ZaloPay thật** (KHÔNG mock; offline COD/bank_transfer). Cần: orders/payments controller, init/callback/IPN/refund endpoints, MCP/worker payment‑consumer. payment_method enum = {mock,momo,zalopay,vnpay,bank_transfer,cod}; DB CHECK hiện thiếu vnpay (V011 ALTER). Cross‑ref `03 §1.8`, `04 Intent06`. **P0**.
- **Verify chữ ký IPN trước khi cập nhật order/transaction**; idempotent theo `dedup_key`; KHÔNG log payload nhạy cảm. Cross‑ref `05 §10` Payment. **P0**.
- **Bảng `payment_callbacks`** (1 txn ↔ N callback) + status `refunded` cho transactions/orders (V011). **P0**.

**Nâng cấp production (§5b):**
- 🟡 **P0** Idempotency mọi POST/PUT/PATCH/DELETE (orders đã có idempotency_key) → middleware global.
- 🟡 **P1** Circuit breaker cho VNPay/Momo + timeout + retry; outbox + DLQ khi Kafka wire.

---

## Phase 05 — Recommendation (Image) + Analytics (Voice) (Intent 04 + 07)

**Goal:** Gợi ý sản phẩm theo ảnh + phân tích kinh doanh bằng giọng nói.

**✅ DONE (verified):**
- Recommend Intent 04: `recommend_by_images.py` + `vespa.image_nearest_neighbor`/`compare_similar` + `analytics.co_purchased` + `analytics.product_corpus_size`. Cross‑ref `04 Intent04`.
- Analytics Intent 07: `analyzing_by_voices.py` + `analytics.*` (10 tool) + `cart.get`. **3 matview thật** (`analytics_daily`/_category/_product_performance, `WHERE status='paid'`, tz Asia/Ho_Chi_Minh). Cross‑ref `04 Intent07`, `07 §6`, `02 matviews`.
- Co‑purchase = **on‑the‑fly** qua MCP `analytics.co_purchased` (CTE orders+order_items+products). KHÔNG có bảng/matview tiền tính.

**🟡 CHƯA CODE / 🔵 TÙY CHỌN:**
- 🟡 **P1** Worker `behavior-aggregator` (cập nhật Vespa signals + refresh matview định kỳ) = skeleton. Cross‑ref `07 §6.2`.
- 🟡 **P1** Refresh matview định kỳ (`REFRESH MATERIALIZED VIEW CONCURRENTLY`) — hiện chưa có job.
- 🔵 **TÙY CHỌN (P2)** Matview `co_purchase_matrix` precompute — **chưa cam kết** (grep repo = 0). Nên dùng **khi** `analytics.co_purchased` on‑the‑fly chậm ở scale; reader vẫn = `co_purchased`. Cross‑ref `02 §X.2`, `07 §6.4`.
- 🟡 **P2** Vespa rank‑profile `personalized` (ADR‑043, per‑tenant LTR) — xem Production Hardening Track.

---

## Phase 06 — Polish / Observability / Operations

**Goal:** Quan sát, alerting, độ tin cậy vận hành (thay "demo prep" hackathon).

**✅ DONE (verified):**
- OTel traces/logs/metrics (gateway NodeSDK + ai/mcp instrument) → otel‑collector:4317; Pino 6 LOCKED redact fields + trace_id/span_id inject. LGTM pinned. Cross‑ref `06_OBSERVABILITY.md`.

**🟡 CHƯA CODE (production‑grade, §5b):**
- 🟡 **P0** Grafana **alerting + SLO/error‑budget** (thay "console‑only"). Nên dùng: Grafana Alerting + Prometheus rules. Cross‑ref `06 §3.4`.
- 🟡 **P1** `tenant_id` attribute trong log schema + span attr (khi multi‑tenant). Cross‑ref `06 §4/§9.3`.
- 🟡 **P1** Regex‑PII redactor (bổ sung Pino path‑redact đã có). **P1**.
- 🟡 **P1** Load test (k6) + runbook/on‑call. **P1**.
- 🟡 **P2** Dashboard per‑tenant + usage metering panel (ADR‑044).

---

## Production Hardening Track (cross‑cutting — ADR 038–044)

| Track | ADR | Trạng thái | Migration | Ưu tiên | Ghi chú / nên dùng gì |
|---|---|---|---|---|---|
| Payment VNPay/Momo/ZaloPay thật | 038 | 🟡 CHƯA CODE | V011 (`payment_callbacks`, status `refunded`, ALTER chk_payment_method +vnpay) | P0 | online momo/zalopay/vnpay + offline cod/bank_transfer; verify IPN signature; idempotent dedup_key; no‑log payload. DB CHECK hiện thiếu vnpay |
| Shopee crawler thật | 039 | 🟡 CHƯA CODE | (đổi nguồn `shopee_prices_mock`→`shopee_prices`) | P1 | worker `shopee-crawl`; rủi ro ToS |
| Multi‑tenant (model #2 marketplace) | 040 | 🟡 CHƯA CODE | V011 (tenants, tenant_memberships, +`tenant_id` 10 bảng) | P0 | tenant resolve = hybrid (X‑Tenant‑Id header + JWT claim → TenantContextGuard → RLS GUC `app.current_tenant`); `users.email` global UNIQUE; orders.idempotency_key→UNIQUE(tenant_id, idempotency_key). Cross‑ref `03 §1.0`, `05 §10` |
| GDPR + Luật VN 2025 | 041 | 🟡 CHƯA CODE | V011 (consent_records, data_subject_requests, data_retention_policies) | P0 | behavior tracking chỉ chạy khi có consent; access/erasure + retention. Cross‑ref `03 §1.9`, `07` |
| Hash‑chain audit | 042 | 🟡 CHƯA CODE | V011 (`audit_log`, immutable, no update/delete) | P1 | worker `audit-logger` ghi hash‑chain per‑tenant (`hash = H(prev_hash‖canonical(row))`); verify endpoint re‑compute. Cross‑ref `06`, `LOG_CATALOG` |
| Per‑tenant LTR / personalization | 043 | 🟡 CHƯA CODE | V011 (`tenant_ranking_weights`) | P2 | Vespa rank‑profile `personalized` (`query(w_text/w_trend/w_behavior)`); giữ `ai_augmented` làm fallback. Cross‑ref `02 §2`, `07` |
| Usage metering (billing SaaS) | 044 | 🟡 CHƯA CODE | V011 (`usage_events` append‑only + `usage_daily` rollup) | P2 | metrics: ai_calls/searches/orders/storage. Cross‑ref `02`, `01` |

**Migration roadmap:** mọi tiến độ production gom vào **V011** (tenant + payment ext + GDPR + 3 wow), hoặc tách V011 (tenant/payment/GDPR) + V012 (wow audit/LTR/usage) nếu cần atomic nhỏ. Forward‑only + RLS policies + backfill seed. Cross‑ref `02_DATA_MODEL.md` §1.X.

---

## Cross‑phase dependency graph

```
            Phase 00 (Design System)
                     ↓
            Phase 01 (Infra: DB/migrations/OTel/codegen) ── nền tảng
                     ↓
   ┌────────── Phase 02 (Auth + Search) ──────────┐
   │                                              │
   ↓                                              ↓
 Phase 03 (Import + Cards)              Phase 05 (Reco + Analytics)
   │                                              ↑ (signals/matview)
   ↓                                              │
 Phase 04 (Cart + Buy + Payment) ─────────────────┘
                     ↓
            Phase 06 (Observability/Ops/Hardening)
                     ↓
     Production Hardening Track (tenant/GDPR/payment/audit/LTR/usage)
                     ↓
                  GO‑LIVE 🚀
```

---

## Phase status summary

| Phase | Nội dung | Lõi DONE? | Production gap chính | P0 |
|---|---|---|---|---|
| 00 | Design System | tokens/mockup LOCKED; FE build = verify | a11y, bundle gate | — |
| 01 | Infra | DB/OTel/codegen ✅ | Kafka wire, workers, backup/DR, CI gate | DR/backup |
| 02 | Auth + Search | ✅ | rate‑limit, token rotation, CORS/CSP | rate‑limit, rotation, CORS |
| 03 | Import + Cards | ✅ | shopee crawler thật, products CRUD, breaker | upload validate |
| 04 | Cart + Buy + Pay | cart/buy ✅; **pay 🟡** | VNPay/Momo thật + IPN + refund | payment, idempotency |
| 05 | Reco + Analytics | ✅ | behavior‑aggregator, refresh job, LTR | — |
| 06 | Polish/Obs/Ops | OTel ✅ | alerting/SLO, PII redactor, load test | alerting |
| Track | Hardening | 🟡 toàn bộ | tenant/GDPR/payment/audit/LTR/usage | tenant, GDPR, payment |

---

## Appendix — Hackathon Stage→Phase lineage (SUPERSEDED, tham chiếu)

Roadmap cũ chia 5 Stage / 12 slice (S‑00..S‑11). Đã thay bằng phase‑based (ADR‑037). Bản đồ tương đương:

| Stage cũ | ≈ Phase | Slice cũ |
|---|---|---|
| Stage 1 Foundation | Phase 00–01 | S‑00, S‑01, S‑02 |
| Stage 2 First Runnable | Phase 02 | S‑03 (auth+dashboard), S‑04 (search) |
| Stage 3 Core Commerce | Phase 04 | S‑05 (cart), S‑06 (pay) |
| Stage 4 AI/Multimodal | Phase 03, 05 | S‑07 (import), S‑08 (voice buy), S‑09 (recommend) |
| Stage 5 Analytics+Demo | Phase 05–06 | S‑10 (analytics), S‑11 (hardening, thay "demo") |

> Các artefact hackathon đã loại khỏi roadmap production: "5–6 tuần", pitch deck, `ICP_DEMO_MODE`, demo script, "80% payment success mock", `co_purchase_matrix` là "real source", `vision.embed` Gemini proxy, ADR‑032 "override ADR‑008" (Shopee out‑of‑scope) — tất cả mâu thuẫn code/ADR‑037..044.

---

**END OF MASTER ROADMAP (Production v2.0).**
**Generated:** 2026-06-09 · evidence‑based, đối chiếu trực tiếp DB/code.
