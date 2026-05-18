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


## ADR-032 — Shopee price source: Postgres table + local seed worker

- **Status:** Accepted
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
  - shadcn không "install package" — phải `npx shadcn-ui@latest add <name>` để copy file. Lần đầu confuse, sau quen OK.
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
  - V001 SQL DDL có thể author với `image_embedding VECTOR(512)`.
  - Vespa `product.sd` có thể author với `tensor<float>(x[512])`.
  - Cần thêm dependency `openai/clip` hoặc `sentence-transformers/clip-ViT-B-32` 
    trong `apps/ai/pyproject.toml`.
- **Supersedes:** N/A (fills the gap surfaced by S-00 C7)