# Master Roadmap — ICP

> **Version:** 1.0 (Step 1 output)
> **Date:** 2026-05-18
> **Status:** ⭐ ACTIVE
> **Source:** ICP Workflow v1.3 (`docs/workflow/ICP_WORKFLOW_FINAL.md` Section 4 Step 1)
>
> **Mục đích:** Roadmap cấp cao toàn dự án ICP Hackathon 2026. Chia 5 Stages, mỗi Stage
> có goal cao cấp + cross-Stage dependency. **KHÔNG plan chi tiết task** — đó là việc của
> `MASTER_SLICE_BACKLOG.md` (Step 2) và `slices/S-XX_TASKLIST.md` (Step 5).
>
> **Scope:** 8 intents end-to-end (xem `00_CONTEXT.md` Section 4) + Phase 00 design system
> đã DONE + 5 migrations (V001-V003, V005-V006) + observability stack (LGTM) + 8 mockups
> intents đã LOCKED (75 HTML files).

---

## Project Snapshot

| Item | Value | Source |
|---|---|---|
| Project | ICP — Intelligent Commerce Platform | `00_CONTEXT.md` §1 |
| Demo target | Hackathon 2026, 8 intents, 1 màn hình | `00_CONTEXT.md` §1 |
| Tech stack LOCKED | Next.js 14 / NestJS 10 / Flask+LangGraph / Vespa / Postgres 16 / Redis 7 / Kafka (Redpanda) / MCP server | `00_CONTEXT.md` §2 |
| Phase 00 status | ✅ DONE — 75 HTML mockups + 8 Python builders + design tokens v3 MoMo Premium + 12 cross-intent patterns LOCKED | `PHASE_00_HANDOFF.md` |
| Migration scope | V001 (existing core) + V002 (product_enrichment) + V003 (insights) + V005 (payment_metadata) + V006 (analytics_aggregations) | `PHASE_00_HANDOFF.md` "Database changes planned" |
| Observability | OTel-first từ Phase 01 → LGTM stack self-hosted | ADR-011 |
| Brand identity | Aida — AI Brain anatomical SVG, tagline "Hiểu — Học — Hành động" | ADR-08-01 / `PHASE_00_HANDOFF.md` |
| Total estimated duration | ~5-6 tuần (Phase 01 đến Phase 06) — tương ứng 12 slices (S-00 → S-11) | `PHASE_01-06` specs |

---

## Stage 1 — Foundation (Tuần 1)

**Goal cấp cao:** Hạ tầng chạy được, design system code-ready, không có business logic.

**Tại sao Stage này trước:** Theo `PHASE_01_INFRA.md` DoD, cần: docker-compose stack
boots + 4 services skeleton + migrations applied + seed data + observability stack working
+ design tokens accessible. Tất cả phải có TRƯỚC khi build feature.

**Outputs cấp cao:**
- Repo monorepo (pnpm workspaces): `apps/{web, gateway, ai, mcp, workers}`, `packages/shared-types`, `infra/{migrations, vespa, otel, seed}`
- docker-compose 2 files: app stack + observability stack (LGTM)
- 4 services skeleton (web, gateway, ai, mcp) — `/health` respond
- React component library Phase 00 ráp xong (atoms + molecules — không feature)
- Design tokens CSS variables theo Design System v3 (MoMo Premium pink+orange)
- `<PhoneFrame>`, `<BottomBar>`, `<MainScroll>` built với 2 bugs fix locked (Cross-Intent Patterns §1+2)
- Behavior tracker SDK + `/track` endpoint skeleton
- OpenAPI codegen workflow (`pnpm openapi:sync`) operational

**Mockup evidence highlighted (Rule 6):**
- 75 HTML mockup tham chiếu Design System v3 — Stage 1 build component library = foundation
  cho mọi Stage sau
- `phone-frame` class xuất hiện 76 lần across 8/8 intents → `<PhoneFrame>` là atom CRITICAL
- `pulse-ring` xuất hiện 7/8 intents → keyframe utility CSS reusable
- `bottom-bar` solid bg + z-index 10 (Bug 1 fix) áp dụng 3+ intents có scroll content

**Cross-Stage dependencies:**
- Stage 1 OUTPUT blocks: Stage 2 (auth + search cần Gateway + AI + MCP skeleton)
- Stage 1 OUTPUT blocks: Stage 3 (cart + payment cần Kafka + workers skeleton)
- Stage 1 IS BLOCKED BY: nothing (Phase 00 đã done)

**Slice candidates (sẽ chi tiết ở Step 2):**
- S-00 Repo Reality Check (Q-GATE)
- S-01 UI Foundation (H-UI)
- S-02 Runtime Foundation (P-CAP)

**Risk highlighted:**
- Vespa startup phức tạp (handoff note: "Phase 01 risk Vespa cấu hình") → S-00 audit trước
- Component library framework chưa quyết (shadcn vs Mantine vs Tailwind thuần) — `PHASE_00_HANDOFF.md` Section "Câu hỏi mở" → human cần chốt trước S-01

---

## Stage 2 — First Runnable Flow (Tuần 2)

**Goal cấp cao:** First authenticated flow + first product discovery flow, smoke test cross-flow.

**Tại sao Stage này thứ 2:** Theo `PHASE_02_AUTH_SEARCH.md` rationale — Intent 08 (auth) +
Intent 03 (search) là **2 intent đơn giản nhất**, không cần vision/voice. Build trước để
test pipeline LangGraph + MCP + Vespa cơ bản. Auth là tiền đề cho mọi intent khác
(Idempotency middleware cần `userId`).

**Outputs cấp cao:**
- Intent 08 end-to-end: login form → JWT (HS256 exp 24h, Bcrypt cost 10) → `/auth/me` → logout
- Intent 03 end-to-end: text query → LangGraph router → MCP `text.embed` + `vespa.hybrid_search` → 5+ products kèm reason chip
- 2 variants Intent 03 implement: A (baseline BM25 — mockup width 138px) + B (AI-augmented — mockup width 172px với match badge + reason chip pink gradient)
- Idempotency middleware globally enabled cho mọi POST/PUT/PATCH/DELETE
- Behavior tracker emit 3 events: `session.started`, `auth.signed_in`, `search.performed`
- 50 mock products indexed vào Vespa với text embedding
- Grafana dashboard "Intent Performance" hiển thị p50/p95 latency

**Mockup evidence highlighted (Rule 6):**
- Intent 08: 7 states (splash brain / login form / loading / wrong password shake / network error / success greeting / logout confirm) — tất cả phải build
- Intent 03: 14 HTML states (2 variants × 7 states) — Variant B AI-augmented bắt buộc
  bao gồm: reason chip + sparkline badge "↑ TREND" + co-purchase category-level hint card
- Hidden complexity: `shimmer` class 69 lần, `slide-up` 139 lần, `pop` 101 lần → cần utility animations CSS với `prefers-reduced-motion` guard (per Rule 20 đề xuất)

**Cross-Stage dependencies:**
- Stage 2 OUTPUT blocks: Stage 3 (cart + payment cần authenticated user)
- Stage 2 OUTPUT blocks: Stage 4 (image AI cần `vespa.hybrid_search` foundation)
- Stage 2 IS BLOCKED BY: Stage 1 (auth cần JWT secret env, search cần Vespa schema deployed)

**Slice candidates:**
- S-03 First Auth Flow (V-SLICE)
- S-04 First Product Discovery (V-SLICE)

**Risk highlighted:**
- Intent 03 Variant B "co-purchase category-level" cần V006 materialized view chưa apply ở Phase 02 → mockup show co-purchase hint nhưng data có thể chưa có, dùng fixture tạm
- ADR-019 SSE auth qua cookie httpOnly — cần verify EventSource API hỗ trợ withCredentials đúng

---

## Stage 3 — Core Commerce Flows (Tuần 3)

**Goal cấp cao:** Cart + order + payment flow — full Kafka choreography.

**Tại sao Stage này thứ 3:** Theo `PHASE_04_BUY_CART_PAY.md`, đây là showcase
Choreography + Idempotency + Compensation. 3 intents (02 voice buy / 05 cart / 06 pay)
share infrastructure: Redis cart + Kafka topics `icp.orders.*` + 3 workers (payment / inventory / notification).

**Note:** S-08 First Voice AI tách RIÊNG sang Stage 4 (vì Intent 02 voice cần STT pipeline
đặc biệt + clarify flow phức tạp, không gộp với cart text). Stage 3 focus text-driven cart/pay.

**Outputs cấp cao:**
- Intent 05 (cart by text): full-screen page (mockup wins over PHASE_04 spec "sidebar") — qty stepper / swipe-to-delete + undo 3s / stock issue AI replacement / clear confirm modal / promo applied confetti / free-ship progress
- Intent 06 (payment by text): 9 states full coverage — confirm / address picker / method picker 5 options / processing brain pulse / success confetti / declined shake / network timeout idempotent retry / OTP 3DS 6-cell / receipt với QR
- 3 workers Kafka: `payment-consumer` (80% success rate mock), `inventory-consumer` (stock reserve + compensate), `notification-consumer` (Redis pub/sub → SSE)
- Kafka tracing pattern LOCKED: producer inject context, consumer extract — 1 trace duy nhất span gateway → kafka → 3 consumers → SSE → client
- Order code format `#ORD-YYMMDD-XXXX` (ADR-06-02)
- Idempotency middleware verified với 2 lần POST same key
- Migration V005 (payment_metadata) applied — `failure_reason`, `payment_method`, `provider_txn_id`, `metadata` JSONB

**Mockup evidence highlighted (Rule 6):**
- Intent 05: 8 states confetti animation cho promo applied — phải có
- Intent 06: state G OTP 3DS chưa có trong PHASE_04 spec → expand spec, build per mockup
- Method picker 5 options: MoMo (−2% bonus) / VNPay / Bank Transfer / COD (+15k fee) / Mock — ADR-06-09 lock semantic
- Confetti animation lib lựa chọn: canvas-confetti hoặc CSS keyframes — quyết ở S-05/S-06 brief

**Cross-Stage dependencies:**
- Stage 3 OUTPUT blocks: Stage 5 (analytics cần order data — `PHASE_05` mock seed 200 orders + 25K behavior events)
- Stage 3 OUTPUT blocks: Stage 4 voice buy (Intent 02) cần cart MCP tools — nhưng tách thứ tự execute Stage 3 trước
- Stage 3 IS BLOCKED BY: Stage 2 (auth + idempotency middleware)

**Slice candidates:**
- S-05 First Cart/Order Flow (V-SLICE)
- S-06 First Payment Flow (V-SLICE)

**Risk highlighted:**
- Cart UI conflict: mockup full-screen vs PHASE_04 spec sidebar → mockup wins per Rule 6 (ADR-05-01)
- OTP autofill chưa support Safari iOS (`PHASE_00_HANDOFF.md` note) → manual input fallback
- Mat view refresh lag cho Intent 07 analytics — nếu Stage 5 query order < 1h sau Stage 3 ship → cần raw query fallback

---

## Stage 4 — AI / Multimodal Flows (Tuần 4-5)

**Goal cấp cao:** Image AI + Voice AI + Recommendation — wow factor của hackathon demo.

**Tại sao Stage này thứ 4:** Theo `PHASE_03_IMPORT.md` Section "Tại sao Phase này quan trọng",
đây là **flagship feature**: multimodal vision + multi-tool agent + Event → Action Card
pipeline + form prefill UX. Cần Stage 1 (LangGraph + MCP foundation), Stage 2 (Vespa indexing
pattern, auth), Stage 3 (event publish + cart foundation cho voice buy).

**Outputs cấp cao:**
- Intent 01 (import by image): 11 states full coverage — capture / analyzing / form prefilled với Shopee compact + Market Trend compact / 2 variants suggestions (rising mint / falling amber) / Shopee expanded / blur error / low confidence / success / Trend expanded
  - 4 MCP tools mới: `vision.analyze`, `vespa.search_trend`, `shopee.price_range`, `gtrends.interest_over_time`
  - **Shopee price comparison source (human decision 2026-05-18):** Local Postgres table `shopee_prices_mock` + worker seed, NOT JSON file. Real crawler là project khác, OUT OF SCOPE ICP. Cần **ADR-032** propose override ADR-008.
  - LangGraph interrupt pattern: user submit form via `/intent/{rid}/action`, state lưu Redis, resume từ interrupt
  - Policy DSL evaluator + 5 policies + 2 new policies `MARKET_RISING_v1` / `MARKET_FALLING_v1`
  - 5 action card variants per `02_DATA_MODEL.md` policies table + 2 mới `SUGGEST_STOCK_UP` (mint) / `SUGGEST_WAIT_OR_REDUCE` (amber)
  - Image storage base64 inline `products.image_data` (ADR-01-01) — không cần V007 / S3
- Intent 02 (buy by voice): 8 states — mic idle / orb listening / 4-phase transcribing / cart ready multi-item / clarify ambiguous chip-row inline / cart added + co-purchase hint / no match alternatives / error E_TRANSCRIBE_FAILED
  - MCP `speech.transcribe` Gemini 2.0 Flash (ADR-05) + `intent.parse_bulk_buy` LLM extract array
  - MediaRecorder + chunked audio upload pattern
  - Session memory Redis key `intent:{userId}:{sessionId}` — resolve "cái thứ 2" → SKU
- Intent 04 (recommend by image): 7 states — happy / loading / empty / error / filter switched collab / cart added / re-upload append thread
  - MCP `vision.embed` (Gemini multimodal proxy → text embed kết quả, Option A simpler theo ADR `PHASE_05`)
  - Backfill script 50 products image embedding
  - Co-purchased SQL category-level (NOT product-level per ADR-04-01) — cần migration V006 + materialized view `co_purchase_matrix`
  - Blend score: `0.5*visual_sim + 0.3*co_purchase + 0.2*trend_score`

**Mockup evidence highlighted (Rule 6):**
- Intent 01 v2 đã có 2 visual bugs fixed (`PHASE_00_INTENT_01_HANDOFF_DELTA.md`) — Phase Frontend KHÔNG được reproduce
- Intent 02 + Intent 07 share 100% voice components: `<MicButton>`, `<OrbPulse>`, `<LivePartialTranscript>`, `<PhasesCard>`, `<AIBubble>`, `<UserBubble>` — extract ở S-01, reuse ở Stage 4 + Stage 5
- Intent 01 State C tách 2 variants (rising / falling) — Build Script Pattern §5 `scenario` param

**Cross-Stage dependencies:**
- Stage 4 OUTPUT blocks: Stage 5 analytics (Intent 07 reuse voice infrastructure từ Intent 02)
- Stage 4 IS BLOCKED BY: Stage 1 (LangGraph router + MCP), Stage 2 (vespa.hybrid_search), Stage 3 (cart MCP cho voice buy)

**Slice candidates:**
- S-07 First Image AI (V-SLICE) — Intent 01
- S-08 First Voice AI (V-SLICE) — Intent 02 only (Intent 07 tách sang Stage 5)
- S-09 Recommendation (V-SLICE) — Intent 04

**Risk highlighted:**
- **Conflict surfaced:** ADR-008 nói Shopee = JSON file, human decision 2026-05-18 chốt = Postgres table + local worker seed → **ADR-032 propose ở S-07 brief**, override ADR-008
- **Conflict surfaced:** PHASE_03_IMPORT spec không mention `gtrends.interest_over_time`, chỉ list 4 tools cũ → ADR-031 + mockup wins (priorities 1+2), expand phase spec ở S-07 planning
- Gemini API rate limit: pre-warm + 2nd API key (`PHASE_06_POLISH.md` risk matrix)
- Voice intent ambiguity sau 2 clarifications → fallback text mode (mockup state F no-match)
- Image embedding Option A (Gemini text embed proxy) accuracy có thể low vs CLIP — acceptable demo

---

## Stage 5 — Analytics + Demo Hardening (Tuần 5-6)

**Goal cấp cao:** Intent 07 analytics by voice + behavior aggregator + demo polish + pitch deck + fallback scripts.

**Tại sao Stage này cuối:** Intent 07 cần infrastructure đầy đủ: speech (Stage 4) + analytics
tools + Vespa rank profile với behavior signals (Phase 05 worker `behavior-aggregator`). Đồng
thời theo `PHASE_06_POLISH.md`, polish + demo prep cần tất cả 8 intents working trước.

**Outputs cấp cao:**
- Intent 07 (analytics by voice): 11 states — mic idle / orb listening / 4-phase analyzing / chart line full grid (30 days) / chart bar full axis / chart donut simplified (5 categories + auto-merge "Khác") / empty no data / drilldown expanded / action suggestion (amber caution + green opportunity) / clarify chip / error E_ANALYTICS_TIMEOUT
  - Migration V006 (analytics_aggregations) — `analytics_daily` + `analytics_daily_category` materialized views
  - Worker `worker-analytics` refresh V006 hourly với `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - Worker `behavior-aggregator` schedule 5 phút: update Vespa partial signals (`impressions_7d`, `clicks_7d`, `purchases_7d`, `ctr_7d`, `velocity_score`, `trend_score`) → switch Vespa rank profile từ `hybrid` → `hybrid_with_behavior`
  - `<AnalyticsChartCard>` organism component switch render line/bar/donut từ chart_spec JSON — KHÔNG hard-code SVG path (Rule 19 đề xuất, dynamic from `series.data[]`)
  - Insight detector: delta < -15% / 7d → severity caution; > +10% AND stock < 7d → opportunity
  - Persona Anh Nam + story arc dầu ăn -18% (V006 fixture `analytics_30d_demo.sql` 186 orders)
- Seed augmentation: 200 historical orders + 25K behavior events (5K search.performed, 12K impressions, 3K clicks, 4K views, 1K add_to_cart, 200 checkout.completed) — `PHASE_05_RECO_ANALYTICS.md` §G
- Demo script viết sẵn 8 phút, tập 3 lần
- Pitch deck 10 slides
- Grafana "Live Demo" dashboard 1 màn hình: service map + intent latency + LLM tokens cost + Kafka lag + behavior funnel
- `ICP_DEMO_MODE=true` flag: disable verbose logs / force payment 100% success / pre-load deterministic analytics
- `make demo:freeze` snapshot script Vespa + PG + Redis state cho rollback
- Backup video 30s đoạn rủi ro (payment fail, voice noise transcribe)
- README + gif demo + license MIT + one-pager handout

**Mockup evidence highlighted (Rule 6):**
- Intent 07 **3 chart types confirmed** (verified bằng mockup analysis): state C line, state D bar, state E donut — `<AnalyticsChartCard>` MUST switch render dynamic
- `has_compact_expand` 10 states Intent 07 + `has_drilldown` 2 states → expand to full-screen pattern reused từ Intent 01 (Pattern §6)
- `has_filter_chips` 10 states Intent 07 → `<DrillChipRow>` component (chỉ Intent 07 nhưng wow → Rule 6 MOCKUP IS LAW, vẫn build)

**Cross-Stage dependencies:**
- Stage 5 IS BLOCKED BY: Stage 4 (Intent 02 voice infrastructure), Stage 3 (order data input cho analytics), Stage 1 (V006 + worker scaffolding)
- Stage 5 OUTPUT: final ship — không có Stage 6

**Slice candidates:**
- S-10 Analytics Flow (V-SLICE) — Intent 07 (tách khỏi S-08 Voice AI theo human decision)
- S-11 Demo Hardening (Q-GATE)

**Risk highlighted:**
- Mat view refresh lag — nếu user vừa tạo đơn 10 phút trước, V006 query có thể chưa thấy → fallback raw query khi data < 1h
- LLM intent classifier accuracy cho "phân tích / so sánh" chưa tune — 3 chip clarify cover ~70% cases (`PHASE_00_HANDOFF.md` debt) → cần fine-tune fewshot
- SVG path hard-coded 30 data points trong mockup Intent 07 chart line/bar — production V006 có thể trả khác số ngày → `<LineChart>` PHẢI dynamic
- Donut segments cứng 5 categories — production có thể 6-10 → auto-merge "Khác" top-5 + 1 bucket
- Co-purchase signal cần ≥50 orders cho confidence — Stage 5 seed 200 orders đủ
- Internet down at venue → hotspot backup + local LLM fallback (nếu set up kịp)

---

## Stage Summary Table

| Stage | Tuần | Goal | # Slices | P-priority |
|---|---|---|---|---|
| **Stage 1** Foundation | 1 | Hạ tầng + design system + skeleton 4 services | 3 (S-00, S-01, S-02) | P0 |
| **Stage 2** First Runnable | 2 | Intent 08 auth + Intent 03 search end-to-end | 2 (S-03, S-04) | P0 |
| **Stage 3** Core Commerce | 3 | Intent 05 cart + Intent 06 pay + Kafka choreography | 2 (S-05, S-06) | P1 |
| **Stage 4** AI/Multimodal | 4-5 | Intent 01 image + Intent 02 voice + Intent 04 recommend | 3 (S-07, S-08, S-09) | P1 |
| **Stage 5** Analytics + Demo | 5-6 | Intent 07 analytics + polish + pitch | 2 (S-10, S-11) | P0-final |
| **Total** | 5-6 tuần | 8 intents end-to-end | **12 slices** | |

---

## Cross-Stage Dependency Graph

```
                  Phase 00 DONE ✅
                        ↓
                ┌─── Stage 1 (Foundation) ───┐
                │   S-00 → S-01 → S-02       │
                └────────────┬───────────────┘
                             ↓
                ┌─── Stage 2 (First Runnable) ───┐
                │   S-03 ─┬─→ S-04              │
                └─────────│──────────────────────┘
                          ↓                ↓
              ┌─── Stage 3 (Commerce) ───┐  │
              │   S-05 ──→ S-06          │  │
              └────────┬─────────────────┘  │
                       ↓                    ↓
              ┌─── Stage 4 (AI/Multimodal) ───┐
              │   S-07 (Image)                │
              │   S-08 (Voice — needs cart)   │
              │   S-09 (Recommend — needs V006)│
              └────────┬──────────────────────┘
                       ↓
              ┌─── Stage 5 (Analytics+Demo) ───┐
              │   S-10 (reuses Voice from S-08)│
              │   S-11 (needs all 8 intents)   │
              └────────────────────────────────┘
                       ↓
                  SHIP 🚀
```

---

## Known Conflicts Surfaced (per Rule 7)

| # | Conflict | Sources | Resolution | Action |
|---|---|---|---|---|
| 1 | Cart UI layout | Mockup Intent 05 full-screen vs PHASE_04 sidebar | Mockup wins (priority 1) | Documented in ADR-05-01 — no action needed |
| 2 | Google Trends integration | ADR-031 + mockup Intent 01 State B vs PHASE_03_IMPORT spec | ADR + mockup win (priorities 1+2) | Expand PHASE_03 spec at S-07 brief |
| 3 | OTP 3DS state G | Mockup Intent 06 State G vs PHASE_04 silent | Mockup wins (priority 1) | Design OTP handler at S-06 brief |
| 4 | Intent 07 3 chart types | Mockup 3 charts (line+bar+donut) vs PHASE_05 generic "recharts" | Mockup wins → spec needs alignment | Verify chart_spec JSON schema at S-10 brief |
| 5 | **Shopee price source** | **Human decision 2026-05-18: Postgres table + local seed worker** vs **ADR-008 JSON file** | **Human decision wins → propose ADR-032 override ADR-008** | **Add ADR-032 at S-07 brief; design schema `shopee_prices_mock` table + seed worker** |

**Action for AI in future steps (Step 4 Slice Brief onwards):**
- Surface mỗi conflict trong Slice Brief Section "Risks"
- Propose ADR mới khi cần override
- Đợi human confirm trước khi code

---

## What This Roadmap Does NOT Specify

Per Rule 2 (No full detailed backlog upfront):

- ❌ Day-by-day tasks per slice → đó là Step 5 (`slices/S-XX_TASKLIST.md`)
- ❌ Specific file paths per component → đó là Step 7 (Task Pack)
- ❌ Estimate giờ per task → đó là Step 5 budgeting
- ❌ Final library choices (shadcn vs Mantine, Framer Motion vs CSS-only, Zustand vs Redux) → human chốt ở S-01 brief, theo open questions `PHASE_00_HANDOFF.md`
- ❌ Test coverage targets per slice → đó là Step 5/8

---

## Acceptance Criteria for This Roadmap

- [x] 5 Stages identified, mỗi Stage có goal cấp cao + rationale + cross-stage dependency
- [x] Mockup evidence highlighted per Stage (Rule 6 MOCKUP IS LAW)
- [x] Phase planning specs referenced (Tier 5b BẮT BUỘC)
- [x] Phase handoff retrospective referenced (Tier 5a)
- [x] Cross-Stage dependency graph drawn
- [x] Known conflicts surfaced per Rule 7 (5 conflicts identified)
- [x] Slice candidates listed but NOT detailed (defer to Step 2)
- [x] Risks per Stage articulated
- [ ] **Human approval** of Stage ordering — waiting

---

## Next Step

Sau khi human approve Stage ordering:
- **Step 2** — Create `MASTER_SLICE_BACKLOG.md` với 12 slices (S-00 → S-11), per Section 14.4.1 Slice ↔ Phase Spec Mapping
- **Step 3** — Human select first slice (recommend S-00 Repo Reality Check để audit thực tế trước khi commit Stage 1 sequence)

---

**END OF MASTER ROADMAP.**

**Generated:** 2026-05-18
**Version:** 1.0
**Authority:** Step 1 output of ICP Workflow v1.3
**Update policy:** Bump version khi human chốt thay đổi Stage order hoặc scope cuts mới
