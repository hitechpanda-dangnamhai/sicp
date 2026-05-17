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

## ADR-003 — MCP server as single I/O gateway for AI
- **Status:** Accepted
- **Context:** LangGraph có thể gọi trực tiếp DB/Vespa/APIs, nhưng coupling cao.
- **Decision:** Mọi I/O của AI service đi qua MCP server (tự build, Python).
- **Rationale:** Tách concerns, dễ swap implementations, showcase MCP. Tool list LOCKED ở `03_API_CONTRACTS`.
- **Trade-offs:** Thêm 1 hop network; acceptable cho demo.

## ADR-004 — Idempotency via Redis cache
- **Status:** Accepted
- **Context:** Mutating endpoints phải idempotent để chống double-click, retry.
- **Decision:** Redis SETNX lock + 24h response cache, header `Idempotency-Key` (UUID v4 từ client).
- **Trade-offs:** Cache 24h tốn RAM nhưng đủ cho demo.

## ADR-005 — Voice STT/TTS qua Gemini API
- **Status:** Accepted
- **Context:** Cần multimodal STT support tiếng Việt.
- **Decision:** Gemini 2.0 Flash cho cả vision và speech transcribe; nếu cần TTS dùng Google Cloud TTS (mock cũng OK).
- **Alternatives considered:** OpenAI Whisper API. Tradeoff: latency + cost. Gemini bundle cả vision + STT + classify trong 1 vendor.

## ADR-006 — Outbox lite, not full transactional outbox
- **Status:** Accepted
- **Context:** Đảm bảo event publish khớp với DB commit.
- **Decision:** Trong cùng DB transaction: insert business row + insert events row (published_at=NULL). Sau commit, publish Kafka và update published_at. Background sweeper retry mỗi 30s cho events chưa published.
- **Trade-offs:** Không phải XA transaction; có thể duplicate publish (consumers phải idempotent).

## ADR-007 — Single Flask app for all 8 intent subgraphs
- **Status:** Accepted
- **Context:** Có thể split mỗi intent thành microservice riêng.
- **Decision:** 1 Flask app, 8 subgraphs trong cùng process. LangGraph router dispatch.
- **Rationale:** Hackathon scope, deployment đơn giản, share state easier.

## ADR-008 — Mock Shopee crawler
- **Status:** Accepted
- **Context:** Crawl Shopee thật tốn effort + có risk legal.
- **Decision:** File JSON `infra/seed/shopee-mock.json` với ~200 products fake, MCP tool `shopee.price_range` query file này.
- **Trade-offs:** Không realistic; demo OK.

## ADR-009 — Next.js single screen architecture
- **Status:** Accepted
- **Context:** UX requirement: "1 màn hình, all-in-one".
- **Decision:** Next.js App Router, 1 page `/` chứa chat + cart sidebar + result canvas. Auth dùng modal overlay.
- **Rationale:** Demo focus, không phân tán user attention.

## ADR-010 — Hackathon scope cuts
- **Status:** Accepted
- **Context:** Tránh scope creep.
- **Decision:** Cut realtime payment, multi-tenant, GDPR, full observability. Mock 50 products.
- **Reference:** Section 8 của `00_CONTEXT.md`.

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
  - Co-purchase matrix: Postgres materialized view, refresh hourly. Tools `analytics.co_purchased` query view này.
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
- **Status:** Accepted (đợi user confirm 3 questions)
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
- **Status:** Accepted (SUPERSEDES ADR-016)
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