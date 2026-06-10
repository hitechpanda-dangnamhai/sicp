# Decisions Log

> Append-only. Mỗi entry là một quyết định kiến trúc đã chốt. Format ADR (Architecture Decision Record) tối giản.
> Khi AI agent đề xuất change to docs, log vào đây với status `Proposed`, đợi human approve → `Accepted`.

---

## ADR-001 — Choose Vespa over Elasticsearch + pgvector
- **Status:** Accepted
- **Date:** 2026-XX-XX (cập nhật khi confirm)
- **Context:** Cần search engine hỗ trợ hybrid BM25 + vector, multi-modal embedding.
- **Decision:** Vespa.
- **Rationale:** Native support cả BM25 + ANN trong cùng query, ranking profile linh hoạt, dùng được cho cả product search và image recommendation.
- **Trade-offs:** Học curve cao hơn ES; cần Docker setup phức tạp hơn. Chấp nhận vì showcase tech là điểm wow Hackathon.

## ADR-002 — Choreography (no Saga orchestrator)
- **Status:** Accepted
- **Context:** Order flow cần coordinate payment, inventory, notification.
- **Decision:** Choreography qua Kafka events, không có Saga orchestrator service.
- **Rationale:** Đơn giản hơn cho Hackathon scope; mỗi consumer độc lập, dễ demo Event Sourcing.
- **Trade-offs:** Khó debug nếu chain dài; chấp nhận vì chỉ 3 consumers.
- **Compensation:** Nếu PaymentFailed sau StockReserved, inventory-consumer subscribe PaymentFailed và publish StockReleased.
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 Kafka choreography **CHƯA WIRE** — không có kafkajs/topic `icp.*`; hiện chỉ Redis pub/sub (`sse:pubsub:{rid}`) cho SSE. Choreography = design đích; consumers/workers **CHƯA CODE** (verified `apps/workers/src` chỉ có `shopee-mock-seed-worker.ts` + `index.ts`; không có consumer/outbox-relay file).

## ADR-003 — MCP server as single I/O gateway for AI
- **Status:** Accepted
- **Context:** LangGraph có thể gọi trực tiếp DB/Vespa/APIs, nhưng coupling cao.
- **Decision:** Mọi I/O của AI service đi qua MCP server (tự build, Python).
- **Rationale:** Tách concerns, dễ swap implementations, showcase MCP. Tool list LOCKED ở `03_API_CONTRACTS`.
- **Trade-offs:** Thêm 1 hop network; acceptable cho demo.

## ADR-004 — Idempotency via Redis cache
- **Status:** Accepted (clarified 2026-05-21 Phiên 22 via S-02 C-02)
- **Context:** Mutating endpoints phải idempotent để chống double-click, retry.
- **Decision:** Redis SETNX **lock TTL = 30 seconds** + **response cache TTL = 24 hours (86400s)**, header `Idempotency-Key` (UUID v4 từ client). Industry-std SETNX atomic pattern: short lock guards in-flight processing only (realistic handler max <30s); long cache provides retry idempotency safety.
- **Pseudocode reference:** `01_ARCHITECTURE.md §4` canonical — `redis.set(lockKey, '1', { NX: true, EX: 30 })` + `redis.setex(cacheKey, 86400, ...)`.
- **Clarification note (2026-05-21 Phiên 22):** Original decision wording "Redis SETNX lock + 24h response cache" was ambiguous — did not separate **lock TTL** from **cache TTL**. S-02 T01 surfaced this ambiguity (C-02) because the slice's `decisions-log.md` D-02 interpretation Phase 1 set both to 24h, conflicting with `01_ARCHITECTURE.md §4` canonical pseudocode `EX:30`. Rule 7 priority resolution: Source B (general spec canonical pseudocode) wins over Source A (ADR ambiguous). Industry-std SETNX has SHORT lock + LONG cache. This ADR row updated to make the split explicit; no behavioral change versus the canonical pseudocode that was the intended source-of-truth.
- **Trade-offs:** Cache 24h tốn RAM nhưng đủ cho demo. Lock 30s long enough cho realistic handler duration, short enough để self-recover if handler crashes without releasing lock.

## ADR-005 — Voice STT/TTS qua Gemini API
- **Status:** Accepted
- **Context:** Cần multimodal STT support tiếng Việt.
- **Decision:** Gemini 2.0 Flash cho cả vision và speech transcribe; nếu cần TTS dùng Google Cloud TTS (mock cũng OK).
- **Alternatives considered:** OpenAI Whisper API. Tradeoff: latency + cost. Gemini bundle cả vision + STT + classify trong 1 vendor.
- **Cập nhật triển khai (verified code 2026-06-09 — append-only, KHÔNG sửa Decision gốc):** triển khai thật đã tiến hoá KHÁC Decision gốc:
  - **Speech STT = OpenAI `gpt-4o-transcribe`** — `transcribe()` dùng `OPENAI_STT_MODEL`; hằng `GEMINI_SPEECH_MODEL` (=gemini-2.5-flash) **chỉ giữ cho backward-compat/log**, KHÔNG còn gọi Gemini cho STT. [`speech.py:54,140,190`]
  - **Speech TTS = OpenAI `gpt-4o-mini-tts`** (voice `alloy`) — `synthesize()` dùng `OPENAI_TTS_MODEL`; KHÔNG phải Google Cloud TTS. [`speech.py:243,276,302`]
  - **LLM text/reasoning = Gemini `gemini-2.5-flash` primary → fallback OpenAI `gpt-4o-mini`** — `generate_json()` thử `_call_gemini` trước; khi Gemini **LLMError** → log `llm.gemini.fallback_to_openai` → `_call_openai`. `LITE_MODEL` (`gemini-2.5-flash-lite`) cho background tasks, full Flash cho user-facing (per docstring). [`llm_client.py:255-308`]
  - **Vision = Gemini `gemini-2.5-flash`** (THẬT) — `analyze()`/`suggest_attributes()` gọi `genai.GenerativeModel(GEMINI_VISION_MODEL).generate_content([prompt, image])`; key `GOOGLE_GEMINI_API_KEY`; KHÔNG có OpenAI trong vision.py. [`vision.py:56,164,251,265,366`]
  → So Decision gốc: model **2.5** (không 2.0); **Speech STT+TTS đã chuyển OpenAI** (không còn Gemini STT, không Google TTS) → tinh thần "1 vendor Gemini" KHÔNG còn đúng cho speech; LLM = Gemini primary + fallback OpenAI.

## ADR-006 — Outbox lite, not full transactional outbox
- **Status:** Accepted
- **Context:** Đảm bảo event publish khớp với DB commit.
- **Decision:** Trong cùng DB transaction: insert business row + insert events row (published_at=NULL). Sau commit, publish Kafka và update published_at. Background sweeper retry mỗi 30s cho events chưa published.
- **Trade-offs:** Không phải XA transaction; có thể duplicate publish (consumers phải idempotent).
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 Outbox **WRITE có thật** (events `published_at=NULL` same-txn, MCP ghi); **relay→Kafka + sweeper CHƯA WIRE** (Kafka chưa nối). Consumer hiện = inline trong graph (cards).

## ADR-007 — Single Flask app for all 8 intent subgraphs
- **Status:** Accepted
- **Context:** Có thể split mỗi intent thành microservice riêng.
- **Decision:** 1 Flask app, 8 subgraphs trong cùng process. LangGraph router dispatch.
- **Rationale:** Hackathon scope, deployment đơn giản, share state easier.

## ADR-008 — Mock Shopee crawler ⚠️ SUPERSEDED by ADR-032
- **Status:** Superseded (2026-05-18) — see ADR-032 below
- **Context:** Crawl Shopee thật tốn effort + có risk legal.
- **Decision (original):** File JSON `infra/seed/shopee-mock.json` với ~200 products fake, MCP tool `shopee.price_range` query file này.
- **Why superseded:** Decision của human 2026-05-18 — JSON file thiếu data structure cho state D expanded panel (5 sample products với title/store/rating/sold_count). Chuyển sang Postgres table cho phép store sample data structured + worker seed idempotent. Xem ADR-032.
- **Trade-offs (original):** Không realistic; demo OK.

## ADR-009 — Next.js single screen architecture
- **Status:** Accepted
- **Context:** UX requirement: "1 màn hình, all-in-one".
- **Decision:** Next.js App Router, 1 page `/` chứa chat + cart sidebar + result canvas. Auth dùng modal overlay.
- **Rationale:** Demo focus, không phân tán user attention.

## ADR-010 — Hackathon scope cuts
- **Status:** ⚠️ **Superseded by ADR-037 (Hackathon→Production pivot)** — kept for historical reference. Individual cuts reinstated: realtime payment → ADR-038; multi-tenant → ADR-040; GDPR → ADR-041; full observability → ADR-037 (LGTM stack already deployed). Mock product count is now dev-seed only (see `00_CONTEXT.md` §9).
- **Context:** Tránh scope creep.
- **Decision:** Cut realtime payment, multi-tenant, GDPR, full observability. Mock 50 products.
- **Reference:** Section 8 của `00_CONTEXT.md` (nay là "Scope (Production)").

## ADR-011 — OpenTelemetry-first observability từ Phase 01
- **Status:** Accepted
- **Context:** Hackathon dễ bỏ qua observability, dồn về cuối. Nhưng cuối thì không kịp instrumentation đúng cách.
- **Decision:** OTel SDK bootstrap mọi service từ Phase 01. Logs/metrics/traces ship qua OTel Collector → LGTM stack (Loki + Tempo + Prometheus + Grafana) self-hosted qua docker-compose. Schema log chuẩn hóa ở `06_OBSERVABILITY.md`.
- **Rationale:** Vendor-neutral, instrument 1 lần dùng mọi backend. Trace cross-service là wow factor cho ban giám khảo kỹ thuật.
- **Trade-offs:** Tốn 1-2 ngày Phase 01 setup. Acceptable vì ROI cao (debug + demo).
- **Alternatives:** Datadog (cost), pino-only logs (mất trace), tự ghi log Postgres (không scale).

## ADR-012 — Tách behavior logs khỏi operational logs
- **Status:** Accepted
- **Context:** Ban đầu định trộn user behavior (click, view) vào logging system. Sau khi review thấy 2 concerns khác nhau hoàn toàn.
- **Decision:** Behavior events đi qua tracker SDK riêng (client + server-side emit), Kafka topic `icp.behavior.events`, sink vào Postgres `behavior_events` table + Vespa signal counters. Schema strict per event_type qua `PropertiesMap` TypeScript types. Operational logs giữ ở OTel/Loki, lifetime ngắn.
- **Rationale:** Behavior data là **training data**, lifetime forever, schema strict. Operational logs là diagnostic, lifetime short, schema loose. Trộn = mất cả hai.
- **Reference:** `07_BEHAVIOR_LOGS.md`.
- **Trade-offs:** Thêm 1 pipeline (tracker + sink worker). Hackathon cost ~2 ngày Phase 02. ROI: Vespa learn-to-rank + analytics realistic.

## ADR-013 — Vespa partial-update cho behavioral signals
- **Status:** Accepted
- **Context:** Cần đưa behavior counters vào Vespa rank profile để search/reco thông minh.
- **Decision:** 
  - **Batch path (Phase 05):** aggregator worker mỗi 5 phút SCAN `behavior_events` + UPSERT counters vào Vespa qua partial-update API (assign field values + derived metrics ctr/cvr/velocity_score).
  - **Real-time path (Phase 04):** sau `payment.charge_succeeded` → ngay lập tức `vespa.partial_update` increment `purchases_7d` để ranking phản ánh ngay.
  - Co-purchase matrix: Postgres materialized view, refresh hourly. Tools `analytics.co_purchased` query view này. *(⚠️ Cập nhật — verified code/DB 2026-06-09: HIỆN TẠI `analytics.co_purchased` tính on-the-fly từ `orders`+`order_items`+`products` (KHÔNG đọc matview). Matview `co_purchase_matrix` **KHÔNG xuất hiện ở đâu trong repo** (verified grep 2026-06-09: không code/SQL/docs/phases) → chỉ là **hướng tối ưu precompute TÙY CHỌN, chưa cam kết** (không thuộc V006). V006 thật tạo `analytics_daily`/`analytics_daily_category`/`analytics_product_performance`. Xem `02 §X.2` / `07 §6.4`.)*
- **Trade-offs:** 2 paths phức tạp hơn 1, nhưng demo cần show được "AI tự học" → real-time path cực wow.
- **Reference:** `07_BEHAVIOR_LOGS.md` section 6.

## ADR-014 — Log message naming + Catalog registry
- **Status:** Accepted
- **Context:** Multi-service dễ drift log message names. Trùng tên với schema khác nhau gây hỗn loạn khi query Loki.
- **Decision:** Tất cả message names + behavior event types phải đăng ký trong `LOG_CATALOG.md` trước khi dùng. Naming convention LOCKED:
  - Ops log: `<domain>.<noun>_<past_verb>` snake_case (ví dụ `payment.charge_succeeded`)
  - Behavior event: `<domain>.<verb>` (ví dụ `cart.item_added`)
- **Enforcement:** Catalog là append-only. Test linter (Phase 06) sẽ grep code → so với catalog → fail CI nếu drift.

---

## Template để thêm entry mới

```markdown
## ADR-NNN — Short title
- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD
- **Context:** Một paragraph mô tả vấn đề.
- **Decision:** Một paragraph quyết định.
- **Rationale:** Vì sao chọn cái này.
- **Trade-offs:** Cái gì hy sinh.
- **Alternatives considered:** (optional)
```

## ADR-015 — Phase 00 Design System trước Phase 01
- **Status:** Accepted
- **Context:** Trước đây frontend code rải rác trong các phase feature → UI lệch chuẩn, mỗi phase 1 màu, không sang trọng.
- **Decision:** Tạo Phase 00 dedicated 3-5 ngày làm design tokens, component library, mockups TRƯỚC Phase 01.
- **Rationale:** Hackathon đánh giá UI 30%+, không thể "code chạy được" rồi style sau. Component library xong, các phase sau chỉ ráp.
- **Reference:** `phases/PHASE_00_DESIGN_SYSTEM.md`.
- **Trade-offs:** +5 ngày upfront. Tổng timeline kéo dài 5 → 6.5 tuần, acceptable.

## ADR-016 — Brand: dark-first, violet + emerald + gold
- **Status:** ⚠️ **Superseded by ADR-020 (dark theme replaced by mobile-first light) and ADR-023 (final design system v3 MoMo Premium)** — keep for historical reference only
- **Context:** Cần brand identity rõ ràng cho "AI Brain × Commerce × Finance".
- **Decision:** 
  - Dark-first surface stack (#0A0A12 base)
  - Primary: Electric violet (#6D45FF) — AI brain
  - Success: Emerald (#10C77F) — commerce/cart
  - Premium: Gold (#F2C455) — finance/money
  - Accent: Cyan (#22D3EE) — data/streaming
  - Fonts: Inter (body) + Space Grotesk (display) + JetBrains Mono (numbers/code)
- **Rationale:** Dark = premium + tech. Violet/cyan = AI aesthetic phổ biến (OpenAI Cohere Anthropic). Emerald/gold = commerce/finance signal. 3 màu chính + 2 accent = đủ phong phú nhưng không loè loẹt.
- **Reference:** `PHASE_00_DESIGN_SYSTEM.md` sections 1-2.

## ADR-017 — OpenAPI codegen làm source of truth cho FE-BE contract
- **Status:** Accepted
- **Context:** 4 services + 8 intents + dozens endpoints → drift FE/BE chắc chắn nếu code tay.
- **Decision:**
  - Zod schemas in `packages/shared-types` = single source of truth
  - `nestjs-zod` bridge → backend validate + auto OpenAPI gen
  - `openapi-typescript-codegen` → FE client auto-gen vào `packages/shared-types/src/api/`
  - Script `pnpm openapi:sync` bắt buộc chạy sau mỗi DTO change
  - CI verify drift bằng `git diff --exit-code generated/`
- **Rationale:** Compile-time safety FE side, runtime validation BE side, KHÔNG có manual sync. Lifetime trong Hackathon = ROI cực cao.
- **Reference:** `08_FE_BE_CONTRACT.md`.
- **Trade-offs:** Thêm 1 build step, dev workflow phức tạp hơn. Acceptable với Makefile shortcut.

## ADR-018 — TanStack Query + MSW cho FE data layer
- **Status:** Accepted
- **Context:** Cần caching, retry, optimistic update + dev experience tốt khi BE chưa sẵn.
- **Decision:**
  - TanStack Query v5 cho mọi data fetching (loại trừ SSE)
  - MSW cho mock backend trong Storybook + Playwright tests
  - Generated API client = thin wrapper, không gọi từ component trực tiếp
- **Trade-offs:** Bundle size +50KB. Acceptable.

## ADR-019 — SSE auth qua cookie httpOnly thay vì query string
- **Status:** Accepted
- **Context:** EventSource API không cho set Authorization header.
- **Decision:** JWT lưu trong cookie httpOnly secure SameSite=Lax. Gateway verify JWT từ cookie cho cả REST và SSE endpoints.
- **Rationale:** Đơn giản, an toàn, không leak token vào logs. Trade-off: cần CORS config đúng `credentials: include`.
- **Reference:** `08_FE_BE_CONTRACT.md` section 12.

## ADR-020 — Mobile-first UI (supersedes ADR-016 dark theme)
- **Status:** ⚠️ **Partially Superseded by ADR-023** — mobile-first concept retained (viewport 390px, phone frame, light surface); Sky/Rose/Mango/Mint/Lilac palette DEPRECATED — use ADR-023 MoMo Premium hồng-cam palette instead
- **Context:** Target user là chủ shop nhỏ Việt Nam, dùng điện thoại Android tầm giá thấp/trung. Dark theme dù sang trọng nhưng không phù hợp UX commerce phổ thông VN — khách hàng Việt quen với Shopee/Lazada/Tiki feel sáng sủa, tươi tắn.
- **Decision:**
  - Mobile-first: viewport target 390px iPhone 13. Desktop wrap UI vào phone frame centered (max-width 414px).
  - Light + pastel surface (#FFFFFF, #F7F9FC, #F0F4F8). KHÔNG dark mode trong Hackathon scope.
  - Palette tươi: Sky (#0EA5E9) primary + Rose (#F43F5E) alerts + Mango (#F59E0B) money + Mint (#10B981) success + Lilac (#8B5CF6) analytics.
  - Font Be Vietnam Pro cho diacritics đẹp.
  - PWA manifest cho phép "Add to Home Screen" → native feel.
- **Rationale:** Demo trên điện thoại sẽ giống native app, ban giám khảo cầm phone scan QR code Vercel preview là dùng được như real app. Light pastel tạo "đáng tin cậy + tươi mới" không khác Cash App / Revolut / N26 light mode.
- **Reference:** `PHASE_00_DESIGN_SYSTEM.md` (v2).

## ADR-021 — One-screen all-in-one architecture cho 8 intents
- **Status:** Accepted
- **Context:** Có thể tạo 8 page riêng cho 8 intents nhưng tốn thời gian + navigation phức tạp + slow demo.
- **Decision:** 1 main screen duy nhất:
  - **Chat thread** trung tâm — render kết quả conversational (intents 01, 02, 03, 04, 07) dưới dạng bubbles + inline cards/charts
  - **Universal input** dưới (text + camera + mic long-press) — intent classifier tự routing
  - **Quick chips** ở header — shortcut cho 4 use cases phổ biến
  - **Bottom sheet** (vaul library) cho Cart (intent 05) + Payment (intent 06)
  - **Modal** chỉ cho Login splash (intent 08) — one-time
  - **Bottom nav 4 tabs**: Home / Cart / Action Cards / Me
- **Rationale:** 1 surface = code ít hơn, demo nhanh hơn, story rõ hơn ("trợ lý AI một màn hình"). Inline rendering tận dụng được hết multimodal context.
- **Reference:** `PHASE_00_DESIGN_SYSTEM.md` section 4.

## ADR-022 — Phone frame wrapper cho desktop
- **Status:** Accepted
- **Context:** Web app mobile-first nhưng giám khảo có thể demo trên laptop. Stretch UI ra full-screen sẽ vỡ design + xấu.
- **Decision:** Desktop (>= 1024px) wrap mobile UI vào centered card 414px wide với rounded corners + drop shadow → giả lập phone frame. Background tinted xung quanh.
- **Trade-offs:** Mất desktop real estate. Chấp nhận vì target là mobile UX consistency.

## ADR-023 — Design system v3 LOCKED: MoMo-Inspired Premium
- **Status:** Accepted (FINAL — supersedes ADR-016 và iterations đầu của ADR-020)
- **Context:** Sau 5 iterations design (dark premium → pastel tươi → minimal mono → đa sắc tinh tế → MoMo-inspired enriched), user chốt v3 cuối cùng vì kết hợp được:
  - Cảm giác quen thuộc với app Việt phổ thông (MoMo signature pink)
  - Sang trọng/đẳng cấp cho giám khảo (gradient mềm, radial depth, shadow màu)
  - Đa sắc tinh tế (hồng dominant + cam accent + amber gia vị)
  - Tránh được "ghê" của dark mode và "trẻ con" của pastel rực
- **Decision:**
  - **Surface:** Nền gradient nhẹ `#FCE7F0 → #FEEEE0 → #FFF8F0`, KHÔNG trắng tinh
  - **Primary:** Pink-600 `#E91E63` (MoMo signature) dominant 70%
  - **Accent:** Orange-500 `#F97316` (HOT, AI, alerts) 20%
  - **Gia vị:** Amber `#F59E0B`, Rose `#F43F5E` 10%
  - **Text:** Deep maroon `#831447` KHÔNG dùng đen
  - **Shadow:** Pink-tinted shadows `rgba(233,30,99,0.x)` KHÔNG dùng shadow đen
  - **Font:** Be Vietnam Pro (Vietnamese diacritics)
  - **Signature elements LOCKED:**
    - Hero gradient hồng-cam 4-stop `#E91E63 → #EC4899 → #F472B6 → #FB923C`
    - AI orb radial `#FFF → #FFE4E6 → #FB923C` với pulse ring trắng
    - Voice mic gradient 3-màu hồng-hồng-cam, 42x42, shadow đậm
    - Stat bar 3 cells với gradient icon containers
    - Hero tiles 158px min-height với radial glow + tagline/mini chart
    - List rows với pill data + chevron container gradient
    - Bottom nav active = pill gradient ngang hồng-cam, font-weight 700
  - **Architecture LOCKED:** mobile-first, one-screen all-in-one, phone-frame wrapper desktop
- **Reference visual:** Mockup "icp_momo_premium_enriched_below" trong conversation
- **Rationale:**
  - Pink-600 là màu MoMo signature → instant familiarity với user Việt Nam phổ thông
  - Gradient mượt + radial glow + shadow màu = "premium" cho giám khảo, không clone Shopee flat
  - Stat bar realtime + mini chart trong tile + AI orb pulse → showcase được AI là trung tâm, không phải chatbot text
  - One-screen all-in-one đảm bảo demo nhanh (≤2 taps tới mọi intent)
- **Trade-offs:**
  - Mất "trẻ trung" tươi rói (pastel) — nhưng được "đẳng cấp ấn tượng" hơn
  - Dominant hồng có thể cảm giác feminine — nhưng MoMo đã chứng minh phù hợp universal Vietnamese audience
- **Phase impact:** Phase 00 v3 build component library theo spec này, các phase sau chỉ ráp, không design lại.

## ADR-024 — Vespa Summary Fields Denormalization
- **Status:** Accepted
- **Context:** Khi audit Intent 03 Search mockup, phát hiện UI cần các field `brand`, `rating_avg`, `sold_count`, `original_price`, `image_gradient`, `icon_hint` mà nếu chỉ có ở Postgres thì FE phải gọi 2 API (Vespa search → lấy IDs → Postgres bulk fetch). Latency ×2, complexity ×2.
- **Decision:** Mọi field hiển thị trên Product Card được **denormalize vào Vespa summary fields** khi index. Vespa response trả đầy đủ 1 lần, không cần JOIN Postgres post-search.
- **Trade-offs:**
  - Vespa schema "fat" hơn (15+ fields/document thay vì 10) → acceptable, Vespa designed cho this
  - Khi product update → cần re-index Vespa (existing pattern qua worker)
  - Tăng Vespa storage ~30% — không đáng kể với 50 mock products, scale fine với 1M+
- **Rationale:** 1 RTT thay vì 2, FE code đơn giản, hợp với MCP pattern (mọi I/O qua MCP tool, không split source)
- **Reference:** `02_DATA_MODEL.md` Vespa schema updated, `09_FIELD_AUDIT.md` mapping

## ADR-025 — UI Field Audit Process
- **Status:** Accepted
- **Context:** Trong design iteration Intent 03 Search, vẽ UI có `rating`, `sold_count`, `original_price` mà các fields này chưa tồn tại trong V001. Đây là **bug class** dễ lặp lại khi vẽ 7 intents nữa.
- **Decision:** Trước mỗi mockup intent mới:
  1. Vẽ UI draft
  2. Audit từng visible element vs `09_FIELD_AUDIT.md`
  3. Bổ sung migration V00X nếu thiếu
  4. Update Vespa schema nếu cần search-side display
  5. Update Zod schema trong `shared-types`
  6. Mới được present UI để confirm
- **Enforcement:** AI agent KHÔNG được vẽ UI mockup mà skip audit. Add vào critical constraints `00_CONTEXT.md`.
- **Migration tracking:**
  - V001 — initial (users, products, events, orders, ...)
  - V002 — product enrichment (brand, rating, sold_count, image fallback)
  - V003 — insights table (proactive AI hero card)
  - V00X+ — sẽ add khi audit intent kế tiếp


## ADR-031 — Thêm Google Trends như market-demand signal cho Intent 01

- **Decision:** Bổ sung MCP tool `gtrends.interest_over_time` 
  (mock cho hackathon, dùng fixture giống shopee.price_range).
- **Lý do:** Shopee cho biết "giá thị trường", chưa có signal "nhu cầu thị trường". 
  Merchant cần cả hai để quyết định nhập hàng.
- **Scope:** Intent 01 (Import) primary. Reuse được cho Intent 04 (Recommend) 
  và Intent 07 (Analytics) ở phase sau.
- **Alternative đã loại:**
  - TikTok hashtag count — API khó access, không có public endpoint
  - Shopee search volume — không có public API, chỉ có giá
- **Trade-off:** Thêm 1 external dependency. Hackathon dùng fixture 
  (~30 keywords pre-baked), prod thay bằng pytrends hoặc SerpAPI.


## ADR-032 — Shopee price source: Postgres table + local seed worker

- **Status:** ⚠️ **Superseded by ADR-039 (real Shopee crawler, production)** — kept for historical reference. The Postgres table + sample/aggregate schema is retained; only the *data source* changes from local seed worker to a real crawler pipeline (`shopee-crawl` worker). Seed worker is now dev/test only.
- **Date:** 2026-05-18
- **Supersedes:** ADR-008
- **Context:**
  - Mockup Intent 01 state B (compact card) + state D (expanded panel) yêu cầu hiển thị:
    - Aggregate price data (min/avg/max/sample_count/review_count)
    - 5 sample products với title, store name, rating, sold_count
  - Original ADR-008 đề xuất JSON file `infra/seed/shopee-mock.json` — phù hợp aggregates nhưng không lưu sample products structured → state D phải sinh fake at runtime → demo không deterministic.
  - Human decision (2026-05-18): "Sẽ làm thêm 1 worker tạo 1 bảng giá ảo của Shopee, và so sánh lấy từ bảng giá thôi, và seed data dữ liệu mẫu vào bảng giá đó để lấy lên so sánh."
- **Decision:**
  1. Tạo table Postgres `shopee_prices_mock` (V008 migration) với schema:
     - Aggregates: `min_price`, `avg_price`, `max_price`, `sample_count`, `review_count`
     - Samples: `samples JSONB` (array of {title, store, price, rating, sold_count})
     - Match key: `(category, attributes JSONB)` UNIQUE
  2. Worker `apps/workers/src/shopee-mock-seed-worker.ts` chạy 1 lần lúc startup, idempotent qua `ON CONFLICT DO NOTHING`. Seed ~200 rows covering 10 categories × ~20 attribute combos.
  3. MCP tool `shopee.price_range(category, attrs)` query Postgres table thay vì JSON file. Trả về aggregates + samples trong 1 SELECT.
- **Out of scope for ICP project:**
  - Real Shopee crawler — sẽ implement ở **project khác** (không phải ICP). Khi project đó ship, có thể disable seed worker và point MCP tool sang real data source.
- **Rationale:**
  - Mockup state D yêu cầu structured sample data → JSON file không scale
  - Demo determinism: seed 1 lần → mọi lần demo show same data
  - Table query với GIN index trên attributes JSONB nhanh + flexible
  - Worker pattern align với choreography philosophy (ADR-002)
  - Bảng `shopee_prices_mock` có schema chuẩn → audit trail tốt hơn JSON
- **Trade-offs:**
  - Cần 1 migration mới (V008) thay vì chỉ seed JSON
  - Worker startup logic thêm 1 dependency (chỉ chạy nếu table empty)
- **Reference:**
  - Migration: `infra/migrations/V008__shopee_prices_mock.sql`
  - Worker: `apps/workers/src/shopee-mock-seed-worker.ts` (sẽ implement ở slice S-07)
  - MCP tool spec update: `docs/01_ARCHITECTURE.md` Section 6
  - Schema doc: `docs/02_DATA_MODEL.md` Section "Mock external price reference"

---

## ADR-033 — Component library: shadcn/ui + Tailwind CSS

- **Status:** Accepted
- **Date:** 2026-05-18
- **Resolves:** Open question in `PHASE_00_HANDOFF.md` Section "Câu hỏi mở"
- **Context:**
  - Phase 00 đã LOCK 75 HTML mockup với CSS thuần (50+ CSS variables custom MoMo Premium pink+orange)
  - S-01 (UI Foundation) cần build React component library từ mockup
  - 3 options đã xem xét: shadcn/ui, Mantine, Tailwind thuần + Radix
  - Mockup analysis: cần custom heavy MoMo Premium tokens → ownership styling cao
  - Constraint: Bundle target < 500KB (PHASE_06_POLISH performance audit), mobile-first 390-414px viewport
- **Decision:** Sử dụng **shadcn/ui** (Radix UI primitives + Tailwind CSS, copy-paste pattern).
- **Library versions:**
  - **Next.js 14** App Router (LOCKED ở `00_CONTEXT.md` §2)
  - **Tailwind CSS v3** — start với v3 cho stable (shadcn fully supported); upgrade v4 sau hackathon nếu cần
  - **shadcn/ui** latest 2026-05
  - **Radix UI primitives** dependencies tự động cài qua shadcn CLI
- **Rationale:**
  - Mockup MoMo Premium custom rất nặng → cần ownership code styling 100% → shadcn copy-paste pattern phù hợp nhất
  - Bundle size hoàn hảo (tree-shake, chỉ ship component đã dùng)
  - Tiết kiệm 2-3 ngày S-01 vs Tailwind thuần (Dialog/Toast/Dropdown/Sheet/Accordion đã có sẵn từ shadcn)
  - Accessibility miễn phí (Radix handle ARIA, focus trap, keyboard nav)
  - Ecosystem chuẩn 2025-2026 cho Next.js 14 App Router — docs + community dồi dào
  - Mantine bị loại do bundle 80-150KB + theme system fight mockup custom
- **Component organization (LOCKED):**
  ```
  apps/web/components/
    ├── ui/          ← shadcn copy-paste (Button, Dialog, Toast, Sheet, Tabs, ...)
    ├── icp/         ← ICP-specific (BrainIcon, OrbPulse, MicButton, PhoneFrame, BottomBar)
    ├── layout/      ← Composition layouts (ChatThreadLayout, MainScroll)
    ├── cards/       ← ActionCard, ProductCard, AIBubble, UserBubble
    └── chat/        ← ChatThreadLayout
  ```
- **Trade-offs:**
  - shadcn không "install package" — phải `npx shadcn@latest add <name>` để copy file (CLI package renamed từ `shadcn-ui` sang `shadcn` 2024-09; old package deprecated). Lần đầu confuse, sau quen OK.
  - Component ICP-specific (BrainIcon, OrbPulse...) vẫn phải tự build — đây là constraint chung mọi option, không phải nhược điểm shadcn.
- **Reference:**
  - Setup: `apps/web/components/` + `apps/web/styles/tokens.css`
  - Phase 01 task: `PHASE_01_INFRA.md` Day 6 (update reference)
  - Slice owner: S-01 UI Foundation

---

## ADR-034 — Animation: Hybrid CSS-only + Framer Motion + canvas-confetti

- **Status:** Accepted
- **Date:** 2026-05-18
- **Resolves:** Open question in `PHASE_00_HANDOFF.md` Section "Câu hỏi mở"
- **Context:**
  - Phase 00 mockup phân tích frequency animation:
    - `pulse-ring` 7/8 intents, `slide-up` 139 lần, `pop` 101 lần, `shimmer` 69 lần, `pulse-dot` 42 lần (CSS keyframes — đơn giản)
    - Intent 05 swipe-to-delete + undo (cần gesture + spring physics — không thể CSS thuần)
    - Intent 05/06 confetti (cần particle system — specialized lib)
    - SPA state transitions (Intent 01/02/04/07) cần coordinate enter/exit React → cần lib
  - Constraint: Bundle < 500KB, `prefers-reduced-motion` guard mọi animation (Rule 20 đề xuất `PHASE_00_HANDOFF.md`)
- **Decision:** Hybrid approach — CSS-only chủ đạo, Framer Motion cho 4 use cases đặc biệt, canvas-confetti cho 2 states confetti.
- **Sử dụng theo use case (LOCKED):**

  | Animation use case | Tool |
  |---|---|
  | pulse-ring, shimmer, slide-up, pop, pulse-dot, spin, orb-pulse, brain-shake, typing-cursor, bubble-anim (~80% mockup) | **CSS keyframes** trong `globals.css` |
  | Intent 05 swipe-to-delete + undo | **Framer Motion** `useDrag` + `AnimatePresence` |
  | Intent 05/06 confetti success | **canvas-confetti** (~5KB lib) |
  | Enter/exit transitions giữa states React | **Framer Motion** `<AnimatePresence>` |
  | Layout animations (cart add/remove) | **Framer Motion** `<motion.div layout>` |
- **Library versions:**
  - **Framer Motion** v11+ (recommend dùng `framer-motion/m` lazy-load entry point → ~5KB initial)
  - **canvas-confetti** latest
- **prefers-reduced-motion guard (BẮT BUỘC mọi animation per Rule 20):**
  - CSS: `@media (prefers-reduced-motion: reduce) { .anim { animation: none; } }`
  - Framer: `useReducedMotion()` hook + conditional `animate` prop
  - Components MUST default disable: orb breathe, brain shake, confetti, pulse rings, ring expand
- **Rationale:**
  - Mockup hiện đã 100% CSS keyframes → tận dụng, không convert lãng phí
  - Framer chỉ load khi cần gesture/exit/layout → ~10-35KB bundle tuỳ lazy
  - canvas-confetti specialized lib tốt hơn tự code particle CSS
  - Motion One bị loại do React integration yếu + community nhỏ
- **Trade-offs:**
  - 2 mental models (CSS vs Framer) — dev phải biết khi nào dùng cái nào → document rõ trong `05_CODING_CONVENTIONS.md`
  - Bundle ~10-35KB Framer + ~5KB confetti = max ~40KB → vẫn dưới target
- **Migration mockup → React rule (LOCKED):**
  - Copy `@keyframes` definitions từ mockup vào `apps/web/styles/globals.css`
  - KHÔNG "improve" CSS animation sang Framer Motion (vi phạm Rule 6 MOCKUP IS LAW)
- **Reference:**
  - Setup: `apps/web/styles/globals.css` + `apps/web/lib/animations.ts`
  - Phase 01 task: animation utilities setup (S-01)
  - Slice owner: S-01 UI Foundation + later S-05/S-06 (confetti + swipe)

---

## ADR-035 — State management: Zustand for cross-component, TanStack Query for server, react-hook-form for forms, Context for low-frequency, useState for local

- **Status:** Accepted
- **Date:** 2026-05-18
- **Resolves:** Open question in `PHASE_00_HANDOFF.md` Section "Câu hỏi mở"
- **Context:**
  - ICP có 8 intents, 7-11 states mỗi intent → cần phân chia state rõ ràng
  - 5 loại state đã identify:
    1. Server data (TanStack Query đã LOCK `PHASE_01_INFRA.md`)
    2. Form state (react-hook-form đã LOCK `PHASE_03_IMPORT.md` §E)
    3. URL state (Next.js App Router built-in)
    4. Local component state (React useState)
    5. **Cross-component shared state** ← ADR này resolve
  - Cross-component cần ~3-4 stores: intent SSE session, voice recording, session memory ("cái thứ 2"), UI (toast queue + swipe undo)
  - Constraint: High-frequency state (SSE 20 events/s, voice partial transcript 5/s) → React Context loại do re-render storm
- **Decision:** Sử dụng **Zustand** cho cross-component shared state high-frequency.
- **Phân chia rõ ràng (LOCKED — sẽ document trong `05_CODING_CONVENTIONS.md`):**

  | Loại state | Tool | Lý do |
  |---|---|---|
  | Server data (products, cart, orders, user profile) | **TanStack Query** | Cache + refetch + invalidate + optimistic |
  | Form state (login, prefilled, address) | **react-hook-form** | Local form, validation, submit |
  | Auth status | **React Context** | Low-frequency change |
  | URL state (current intent, modal open) | **Next.js App Router** | Sharable, back button |
  | Local component state (toggle, hover) | **React useState** | Built-in, đơn giản |
  | **Cross-component shared high-frequency** | **Zustand** | Selector pattern, persist, ~1KB |
- **Stores đề xuất cho ICP (LOCKED initial scope, có thể thêm khi tới slice):**
  ```
  apps/web/stores/
    ├── intent-session.ts       ← Intent SSE streaming (requestId, phase, events)
    ├── voice-recording.ts      ← Intent 02 + 07 share (status, transcript, audioChunks)
    ├── session-memory.ts       ← "cái thứ 2" resolve (lastSearchProductIds) + persist sessionStorage
    └── ui.ts                   ← Toast queue, swipe-to-delete pending undo
  ```
- **Library versions:**
  - **Zustand** v5 latest (breaking change từ v4)
  - **Zustand middleware:** `persist` (cho session-memory), `devtools` (debug)
- **Anti-patterns (CẤM trong code review per Rule 5):**
  - ❌ KHÔNG để Zustand cache server data — đó là việc của TanStack Query
  - ❌ KHÔNG để Zustand quản lý form input — đó là việc của react-hook-form
  - ❌ KHÔNG để Zustand thay React.useState cho local toggle — overkill
  - ❌ KHÔNG dùng React Context cho high-frequency state (SSE, voice) — re-render storm
- **Next.js 14 App Router pattern (LOCKED):**
  - Store khai báo trong `stores/*.ts` (server component compatible)
  - Component dùng store PHẢI có `'use client'` directive
- **Rationale:**
  - Zustand API đơn giản nhất, learning curve thấp nhất → hackathon timeline OK
  - High-frequency state handle tốt qua selector (chỉ component đọc `s.field` re-render khi field thay đổi)
  - Bundle 1KB là lựa chọn non-zero rẻ nhất
  - Persist middleware built-in cho session memory
  - Redux Toolkit bị loại do boilerplate nặng + bundle 13KB
  - Context bị loại do re-render storm với high-frequency
  - Jotai loại do community nhỏ hơn + mental model atom khác Zustand
- **Trade-offs:**
  - Cần document rõ "khi nào dùng tool nào" để dev không abuse Zustand → `05_CODING_CONVENTIONS.md`
  - 5 tools state management song song (Zustand + TanStack Query + react-hook-form + Context + useState) — phân chia rõ là CRITICAL
- **Reference:**
  - Setup: `apps/web/stores/*.ts`
  - Phase 01 task: state management scaffolding (S-02)
  - Slice owner: S-02 Runtime Foundation (initial stores), S-08 + S-10 (voice store), S-05 (UI store)


  ### ADR-036: Image embedding model + dimension

- **Status:** Locked
- **Date:** 2026-05-18
- **Context:** Vespa schema `product.sd` cần field `image_embedding` 
  (per DoD-9 PHASE_01_INFRA.md) nhưng dimension không được spec ở đâu. 
  Phát hiện trong S-00 audit (conflict C7, Rule 5 STOP).
- **Decision:** Dùng **CLIP (ViT-B/32) với 512 dimensions** cho cả 
  `text_embedding` và `image_embedding` (multimodal — text và image 
  trong cùng không gian vector).
- **Rationale:** 
  - Intent 01 (import ảnh → tìm sản phẩm tương tự) là use case 
    chính của ICP — cần image search.
  - CLIP cho phép search text-to-image và image-to-image trong 
    cùng schema, không cần 2 model riêng.
  - 512 dim nhẹ hơn 768, query Vespa nhanh hơn.
- **Consequences:** 
  - ⚠️ **V001 SQL DDL: NO VECTOR columns** (per C12 LOCKED Option B in `decisions-log.md`, 2026-05-18 Phiên 3) — embeddings stored Vespa-only, NOT Postgres. Earlier wording suggesting `image_embedding VECTOR(512)` in V001 is OUTDATED — DO NOT use.
  - Vespa `product.sd` authored với `tensor<float>(x[512])` cho cả `text_embedding` + `image_embedding`. This is the single source of truth for embeddings.
  - Cần thêm dependency `openai/clip` hoặc `sentence-transformers/clip-ViT-B-32` 
    trong `apps/ai/pyproject.toml`.
- **Supersedes:** N/A (fills the gap surfaced by S-00 C7)
---

## ADR-037 — Hackathon → Production pivot (umbrella)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Supersedes:** ADR-010 (Hackathon scope cuts)
- **Context:** ICP không còn là demo hackathon mà trở thành sản phẩm production thật. Hệ quả là toàn bộ "scope cuts" trong ADR-010 phải được xem xét lại, và bộ doc (`00_CONTEXT` + `01`–`09` + `LOG_CATALOG`) phải chuẩn hoá theo production.
- **Decision:** Pivot toàn dự án sang production. `00_CONTEXT.md` lên v2.0 (mục tiêu = SaaS multi-tenant production; §8 đổi từ "Out of Scope (Hackathon)" sang "Scope (Production)"; §9 đổi từ "Mock Data" sang "Data & Seeding", seed = dev-only). Các quyết định con: ADR-038 (payment), ADR-039 (Shopee crawl), ADR-040 (multi-tenant), ADR-041 (data privacy). Observability production = LGTM/OTel stack **đã triển khai** (Loki/Grafana/Tempo/Prometheus), nên "full observability" không còn bị cut.
- **Rationale:** Tránh tình trạng hiến pháp + spec mang giả định hackathon (mock, console-only, no-tenant) trong khi mục tiêu là vận hành thật → drift và nợ kỹ thuật.
- **Trade-offs:** Tăng đáng kể scope & độ phức tạp (tenant isolation, payment thật, crawl, compliance). AI service **vẫn giữ single Flask app** (ADR-007 retained); tách sâu microservices deferred tới khi tải yêu cầu.
- **Reference:** `00_CONTEXT.md` v2.0 (§1, §3 pillar 10, §7, §8, §9, §10 #16/#17); `SESSION_HANDOFF_state.md`; `HANDOFF_PROMPT_production-docs-reconcile.md`.

## ADR-038 — Payment: tích hợp thật VNPay + Momo
- **Status:** Accepted (amended 2026-06-09: +ZaloPay)
- **Date:** 2026-06-09
- **Amendment 2026-06-09 (append-only):** Mở rộng provider online = **VNPay + Momo + ZaloPay**; offline = COD + chuyển khoản (bank_transfer); mock = dev/test. DB `chk_payment_method` (verified 2026-06-09) = {mock, momo, zalopay, bank_transfer, cod}; **`vnpay` CHƯA có trong CHECK → V011 ALTER thêm (CHƯA CODE)**. payment_method enum = {mock, momo, zalopay, vnpay, bank_transfer, cod}.
- **Context:** ADR-010 cut realtime payment (dùng mock). Production cần thanh toán thật cho Intent 06 (`paying_order_products_by_text`).
- **Decision:** Tích hợp **VNPay + Momo** qua SDK/API chính thức. Hỗ trợ khởi tạo thanh toán, callback/IPN xác thực chữ ký, đối soát (reconciliation), và refund cơ bản. Một `payment-consumer` worker xử lý event/callback bất đồng bộ; trạng thái đơn cập nhật qua domain events (`PaymentSucceeded`/`PaymentFailed`).
- **Rationale:** VNPay + Momo phủ phần lớn người dùng VN; cả hai có cổng sandbox để test.
- **Trade-offs:** Phải quản lý secret/chữ ký từng cổng, xử lý idempotency cho IPN (callback có thể bị gửi lặp), và edge case timeout/huỷ. Không tự xây cổng thanh toán.
- **Reference:** `01_ARCHITECTURE.md` (service boundary + workers), `02_DATA_MODEL.md` (bảng payment/transaction/IPN/refund), `03_API_CONTRACTS.md` (endpoints init/callback/IPN/refund + error codes), `04_INTENT_SPECS.md` (Intent 06), `LOG_CATALOG.md`.

## ADR-039 — Shopee data source: real crawler (production)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Supersedes:** ADR-032 (Postgres mock table + local seed worker)
- **Context:** ADR-032 dùng bảng `shopee_prices_mock` seed bởi worker local; ADR-008 (JSON file) đã superseded trước đó. Production cần dữ liệu giá Shopee thật.
- **Decision:** Lấy dữ liệu Shopee bằng **crawler thật** qua worker `shopee-crawl`, feed vào bảng `shopee_prices` (giữ nguyên schema aggregates + samples JSONB từ ADR-032 để không phá MCP tool `shopee.price_range`). Seed worker cũ chỉ còn dùng cho dev/test.
- **Rationale:** Demo determinism không còn là mục tiêu; cần giá thị trường thật để gợi ý giá chính xác.
- **Trade-offs / Rủi ro:** ⚠️ **Rủi ro ToS/pháp lý** khi crawl Shopee; cần xử lý rate-limit, anti-bot, và rà soát pháp lý trước khi bật production. Crawl không ổn định → cần fallback (cache last-known + đánh dấu `stale`). Quyết định cũ "Real crawler is OUT OF SCOPE / separate project" (ADR-008/032 + `01 §6`) **bị đảo ngược** theo chỉ đạo của người dùng.
- **Reference:** `01_ARCHITECTURE.md` §6 (MCP `shopee.price_range` + bỏ "out of scope"), `02_DATA_MODEL.md` (bảng `shopee_prices`), workers (`shopee-crawl`), `LOG_CATALOG.md`.

## ADR-040 — Multi-tenant SaaS (tenant isolation)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Supersedes:** phần "multi-tenant" bị cut trong ADR-010
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 **CHƯA CODE** — `tenants`/`tenant_memberships` chưa có; **0 `tenant_id`** trong DB + gateway (grep gateway tenant=0). Target migration V011.
- **Context:** Sản phẩm production phục vụ nhiều shop trên cùng hệ thống.
- **Decision:** Hệ thống là **SaaS multi-tenant**. Mọi dữ liệu thuộc về một `tenant_id`; isolation bắt buộc ở tầng DB (cột `tenant_id` + index, ưu tiên Row-Level Security), cache (key có tenant), search (filter tenant trong Vespa), và events (tenant trong payload + Kafka header). JWT mang `tenant_id`; trace context propagate `tenant_id`. **Không bao giờ** truy vấn cross-tenant.
- **Rationale:** Isolation là yêu cầu nền tảng của SaaS; nhúng từ schema sớm rẻ hơn retrofit về sau.
- **Trade-offs:** Migration lớn (thêm `tenant_id` gần như mọi bảng), mọi query phải scoped, tăng độ phức tạp test. Đây là thay đổi nặng nhất của pivot.
- **Reference:** `00_CONTEXT.md` §3 pillar 10 + §10 #16; `02_DATA_MODEL.md` (lớn nhất), `01_ARCHITECTURE.md`, `03_API_CONTRACTS.md`, `06_OBSERVABILITY.md`, `07_BEHAVIOR_LOGS.md`, `09_FIELD_AUDIT.md`.

## ADR-041 — Data privacy compliance: GDPR (EU) + Luật BVDLCN 2025 (VN)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Supersedes:** phần "GDPR" bị cut trong ADR-010
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 **CHƯA CODE** — `consent_records`/`data_subject_requests`/`data_retention_policies` chưa có; consent gating + DSAR chưa wire. Target V011.
- **Context:** ICP lưu PII (`users`: email/display_name; `orders`; `behavior_events` gắn user = profiling phục vụ recommendation/AI). Production phải tuân thủ pháp luật dữ liệu cá nhân.
- **Decision:** Tuân thủ theo **chuẩn châu Âu (GDPR)** đồng thời **Luật Bảo vệ dữ liệu cá nhân 2025 (Luật 91/2025/QH15) + Nghị định 356/2025/NĐ-CP** của VN (lưu ý: Nghị định 13/2023/NĐ-CP đã hết hiệu lực từ 01/01/2026). Triển khai: consent trước khi tracking PII (consent records), quyền truy cập/xóa của chủ thể dữ liệu (data subject requests), retention policy theo từng loại dữ liệu, DPIA cho profiling/AI, và KHÔNG log PII (chỉ định danh tối thiểu như `user_id`/`tenant_id`).
- **Rationale:** Bắt buộc về pháp lý; làm muộn tốn kém và rủi ro phạt.
- **Trade-offs:** Thêm consent flow, bảng/luồng data-subject-request, retention jobs; ràng buộc behavior tracking (chỉ track sau consent).
- **Open (chưa chốt):** retention period cụ thể từng loại dữ liệu; mức DPIA / vai trò DPO; chi tiết cơ chế chuyển dữ liệu xuyên biên giới.
- **Reference:** `00_CONTEXT.md` §3 pillar 10 + §10 #17; `02_DATA_MODEL.md` (consent/retention/DSAR), `05_CODING_CONVENTIONS.md` (security baseline), `07_BEHAVIOR_LOGS.md` (consent gating).

## ADR-042 — Tamper-evident audit log (hash-chain)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 **CHƯA CODE** — bảng `audit_log` chưa có; worker `audit-logger` **không tồn tại** (verified `apps/workers/src` chỉ có `shopee-mock-seed-worker` + `index`; KHÔNG có audit-logger file). Target V012.
- **Context:** Production cần audit "không thể chối/sửa" cho payment + compliance (GDPR/ADR-041). Bảng `events` (event-sourcing/outbox) và OTel logs không đảm bảo bất biến.
- **Decision:** Bảng MỚI `audit_log` (KHÔNG đụng `events`/outbox), ghi bởi worker `audit-logger` khi consume topics product/payment/user-activity. Mỗi bản ghi có `seq` monotonic **per-chain** + `prev_hash` + `hash = SHA256(prev_hash ‖ canonical_json(core))`. Chain **per-tenant** (NULL = platform chain), UNIQUE(tenant_id, seq). Có endpoint verify (re-compute chain → phát hiện sửa/xoá).
- **Rationale:** Hash-chain → bất kỳ chỉnh sửa nào làm gãy chain ⇒ tamper-evident; tách khỏi outbox để không phức tạp hoá event-sourcing.
- **Trade-offs:** Worker phải ghi tuần tự per-chain (contention nếu 1 tenant ghi rất nhiều); cần job verify định kỳ.
- **Reference:** `02_DATA_MODEL.md` §1.X (audit_log) + §6 (`icp.audit.recorded`); `01_ARCHITECTURE.md` (audit-logger); `LOG_CATALOG.md`.

## ADR-043 — Per-tenant learn-to-rank / personalization
- **Status:** Accepted
- **Date:** 2026-06-09
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 **CHƯA CODE** — `tenant_ranking_weights` chưa có; `product.sd` chưa có rank-profile `personalized` (mới 6 profile: baseline/ai_augmented/hybrid/image_similarity/image_recommendation/cross_encoder_rerank). Target V012.
- **Context:** Mỗi shop muốn ranking riêng theo hành vi khách của shop mình. Vespa hiện có signals per-product (đã = per-shop) nhưng dùng trọng số cố định trong `ai_augmented`.
- **Decision:** Bảng `tenant_ranking_weights` (per tenant: w_text/w_trend/w_behavior, model_version) fit định kỳ từ `behavior_events`. Vespa thêm rank-profile `personalized` (inherits `ai_augmented`) nhận `query(w_text|w_trend|w_behavior)`; Gateway/AI inject weights theo tenant vào YQL. `ai_augmented` GIỮ làm default/fallback khi shop chưa có weights.
- **Rationale:** Tách trọng số ra query-time inputs là pattern Vespa chuẩn → personalization per-tenant không cần nhân bản schema/model; tái dùng cross-encoder rerank (D-S04-18).
- **Trade-offs:** Cần job fit weights + lưu/đọc per tenant; cold-start (shop mới) dùng default.
- **Reference:** `02_DATA_MODEL.md` §1.X (tenant_ranking_weights) + §2 (rank-profile `personalized`); `07_BEHAVIOR_LOGS.md` (signals); `01_ARCHITECTURE.md` (ltr job).

## ADR-044 — Per-tenant usage metering (billing SaaS)
- **Status:** Accepted
- **Date:** 2026-06-09
- **Trạng thái triển khai (verified 2026-06-09):** 🟡 **CHƯA CODE** — `usage_events`/`usage_daily` chưa có. Target V012.
- **Context:** SaaS multi-tenant cần đo lường mức dùng từng shop để billing.
- **Decision:** Bảng `usage_events` (append: tenant_id, metric, quantity, occurred_at) + rollup `usage_daily` (tenant_id, day, metric, total). Metrics ví dụ: ai_calls, searches, orders, storage_mb. Ghi bởi worker (behavior-aggregator hoặc usage-aggregator); topic `icp.usage.metered`.
- **Rationale:** Tách raw events + rollup → vừa audit chi tiết vừa truy vấn billing nhanh; per-tenant từ đầu.
- **Trade-offs:** Thêm pipeline metering; cần định nghĩa metric chuẩn + chống double-count (idempotency).
- **Reference:** `02_DATA_MODEL.md` §1.X (usage_events/usage_daily) + §6 (`icp.usage.metered`); `LOG_CATALOG.md`.
