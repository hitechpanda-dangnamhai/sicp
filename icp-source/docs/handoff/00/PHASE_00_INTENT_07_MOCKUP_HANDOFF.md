# Phase 00 — Intent 07 (Analyze Business by Voice) Mockup Handoff

> **Status:** ✅ Complete · 11 mockup files (2 hand-crafted golden + 9 builder-generated)
> **Date:** 2026-05-17
> **Owner:** AI Agent · Phase 00 Mockup Lead
> **Scope:** Mockup tĩnh cho Intent 07 — voice analytics modality với 3 chart types + drill-down expanded + insight-to-action.
> **Next:** Phase 05 backend (V003 insights + V006 analytics aggregations) — cần 2 migrations từ roadmap

---

## 0. TL;DR

Intent 07 (Analyze Business by Voice) đã được mockup đầy đủ với **wow factor 3 loại biểu đồ inline** (line / bar / donut) + drill-down full-screen + insight-driven action cards.

- **Migration mới:** 0 từ Intent 07 (V003 + V006 đã trong roadmap từ INTENT_AUDIT_REPORT).
- **Schema extensions:** 5 TypeScript schemas mới ở `packages/shared-types/src/analytics.ts`.
- **Patterns reused:** 100% từ Intent 02 (voice modality), Intent 01 (sparkline + action card + compact-expand), Intent 04 (chat thread layout).
- **Story arc:** Anh Nam, chủ tạp hóa HCMC, 30 ngày data, doanh thu giảm 8% do dầu ăn → action card "tạo khuyến mãi -10%".

---

## 1. File Inventory

| # | State | File | Purpose |
|---|---|---|---|
| 1 | 0 — Mic Idle | `intent-07-state-0-mic-idle.html` | Entry voice: brand splash + mic button + 3 example queries với badge LINE/BAR/DONUT |
| 2 | A — Listening | `intent-07-state-A-listening.html` | Orb pulse 180px + 3 ring expand + partial transcript "Aida ơi cho anh xem doanh thu" + timer |
| 3 | B — Analyzing | `intent-07-state-B-analyzing.html` | 4-phase loading checklist (STT → Intent + chart type → SQL query → Synthesis) + peek detected card |
| 4 | C — Chart Line ⭐ | `intent-07-state-C-chart-line.html` | **Golden happy path.** Revenue 30d line chart full grid + Y/X axis labels + peak annotation 1.32M + today marker |
| 5 | D — Chart Bar | `intent-07-state-D-chart-bar.html` | Top 5 categories bar chart full axis + dầu ăn -18% highlight badge inline |
| 6 | E — Chart Donut | `intent-07-state-E-chart-donut.html` | Tỷ trọng 5 danh mục donut simplified + legend bên cạnh + center label "24,5tr" |
| 7 | F — Empty | `intent-07-state-F-empty-no-data.html` | Cold start state — chưa có order. 3 CTA: tạo demo orders / import SP / xem hướng dẫn |
| 8 | G — Drilldown Expanded | `intent-07-state-G-drilldown-expanded.html` | Full-screen line chart + 4 stats grid + 7-day breakdown list với mini bars + 6 drill-down chips |
| 9 | H — Action Suggestion | `intent-07-state-H-action-suggestion.html` | 2 action cards: amber "dầu ăn giảm 18% → KM -10%" (caution) + green "nước tương trending → đặt 100 chai" (opportunity) |
| 10 | I — Clarify | `intent-07-state-I-clarify.html` | LLM hỏi lại khi câu "so sánh tháng này với trước" mơ hồ → 3 chip options (doanh thu / danh mục / top SP) |
| 11 | J — Error | `intent-07-state-J-error.html` | `E_ANALYTICS_TIMEOUT` với failed-orb shake + trace ID + 3 tips + retry/typing fallback |

**Builder script:** `build_intent_07.py` generate 9 secondary states từ shared `BASE_CSS` + common HTML pieces (`STATUS_BAR_HTML`, `app_header_html()`, `BOTTOM_BAR_HTML`, `AI_AVATAR_SVG`, `page_shell()`).

---

## 2. Field Audit (Section 7.x cho `09_FIELD_AUDIT.md`)

> Insert vào `09_FIELD_AUDIT.md` như Section 7.6 (sau Intent 07 Market Trend) hoặc Section 8 (new).

| UI element | Field name | Source | Type | Derivation |
|---|---|---|---|---|
| Voice waveform | — | FE state (Web Audio Analyser RMS) | float 0-1 | Reuse Intent 02 `<OrbPulse>` |
| Live partial transcript | `text`, `is_partial` | Gemini STT stream SSE | string | Reuse Intent 02 `VoiceTranscriptionResultSchema` |
| STT confidence badge "✓ 96% rõ" | `confidence` | Gemini STT response | float 0-1 | FE format `Math.round(c*100) + "% rõ"` |
| User voice bubble timer | — | FE state (recording duration) | int sec | `formatDuration(elapsedMs)` |
| AI narrative text | `narrative_vi` | LLM synthesize từ chart data | string | **Derived BE** transient, max 200 char |
| Chart `type` (line/bar/donut) | `chart_type` | LLM intent classifier output | enum | **Derived BE** transient |
| Chart `title` | `title` | LLM compose | string | **Derived BE** transient |
| Chart `x_axis_label`, `y_axis_label` | `axes` | LLM compose | object | **Derived BE** transient |
| Chart series data points | `series[].data[]` | MCP `analytics.aggregate` query | array | ⚠️ **V006 MAT VIEW** `analytics_daily` / `analytics_daily_category` |
| Stat cells (Tổng / TB ngày / Tuần này) | `summary_stats` | Aggregation roll-up | object | **Derived BE** từ V006 |
| Stat delta % "+12% vs tháng trước" | `delta_pct` | Compare period_n vs period_n-1 | float | **Derived BE** từ V006 |
| Day breakdown list (state G) | `daily_breakdown[]` | V006 `analytics_daily` direct query | array | ✅ V006 |
| Peak annotation "1.32M ▲" | — | Max() over series | object | **Derived FE** từ series |
| Today marker dashed line | — | Date.now() position | x-coord | **Derived FE** |
| Drill-down chips state (active) | `drill_dimension` | FE state | enum | UI-only |
| Drill-down chip set | `available_drills[]` | LLM suggest | array | **Derived BE** transient |
| Insight card text "Dầu ăn giảm 18%" | `insight.summary_vi` | LLM detect anomaly | string | ⚠️ **V003 INSIGHTS** persist nếu user save |
| Insight severity (caution/opportunity) | `severity` | Policy engine evaluate | enum | ✅ V001 `policies` + ⚠️ **V003** |
| Action card (state H) | `action_cards[]` | Postgres `action_cards` table | array | ✅ V001 (existing) |
| Action card amber border-left | — | UI variant `.ac-amber` | CSS class | Reuse Cross-Intent §4 palette |
| Mini sparkline trong action card | — | series[-7:] last 7 days | SVG path | **Derived FE** + Cross-Intent §7 pattern |
| Clarify card (state I) | `clarify_question` | LLM ambiguity detection | object | **Derived BE** transient |
| Clarify chip options | `clarify_options[]` | LLM enumerate disambiguation | array | **Derived BE** transient |
| Empty state CTAs (state F) | — | Static FE config | enum | UI-only |
| Error code `E_ANALYTICS_TIMEOUT` | `error.code` | SSE error event | enum | **Derived BE** |
| Error trace ID | `error.trace_id` | OpenTelemetry context | string | Reuse `06_OBSERVABILITY.md` |
| Follow-up question chips | `followup_questions[]` | LLM suggest | array | **Derived BE** transient |

**Verdict:** ✅ **0 migration MỚI từ Intent 07.** V003 (insights) + V006 (analytics aggregations) đã có trong migration roadmap từ INTENT_AUDIT_REPORT.

---

## 3. Public Interfaces (Schema mới cần định nghĩa)

**TypeScript schemas tại `packages/shared-types/src/analytics.ts`:**

```typescript
import { z } from 'zod';

// 1. Chart spec (LLM output)
export const ChartTypeSchema = z.enum(['line', 'bar', 'donut']);

export const ChartSeriesPointSchema = z.object({
  x: z.union([z.string(), z.number()]),         // date string or category name
  y: z.number(),
  label: z.string().optional(),                 // optional inline label
  highlight: z.boolean().optional(),            // mark for annotation
});

export const ChartSeriesSchema = z.object({
  name: z.string(),                              // "Doanh thu" / "Nước tương"
  color_hint: z.enum(['pink', 'orange', 'amber', 'lilac', 'green']).optional(),
  data: z.array(ChartSeriesPointSchema).min(1).max(60),
});

export const AnalyticsChartSpecSchema = z.object({
  chart_type: ChartTypeSchema,
  title: z.string().max(60),
  meta: z.string().max(80).optional(),          // "17/04 → 17/05/2026 · VND"
  x_axis_label: z.string().max(30).optional(),
  y_axis_label: z.string().max(30).optional(),
  series: z.array(ChartSeriesSchema).min(1).max(5),
  summary_stats: z.array(z.object({
    label: z.string().max(20),                  // "Tổng" / "TB/ngày" / "Tuần này"
    value: z.string().max(15),                  // formatted "24,5tr"
    delta_pct: z.number().nullable(),           // +12, -8, or null
    trajectory: z.enum(['up', 'down', 'flat']).nullable(),
  })).max(4),
  available_drills: z.array(z.object({
    key: z.string(),                            // "by_day", "by_category"
    label_vi: z.string().max(20),
  })).max(6),
});

// 2. Analytics response (full SSE payload)
export const AnalyticsInsightSchema = z.object({
  severity: z.enum(['info', 'opportunity', 'caution', 'critical']),
  summary_vi: z.string().max(200),              // "Dầu ăn giảm 18%..."
  related_metric: z.string(),                   // "category:dau_an"
  delta_pct: z.number().nullable(),
});

export const AnalyticsResponseSchema = z.object({
  chart: AnalyticsChartSpecSchema,
  narrative_vi: z.string().max(280),            // AI bubble text
  insights: z.array(AnalyticsInsightSchema).max(3),
  followup_questions: z.array(z.string().max(60)).max(4),
});

// 3. Clarify question (when ambiguous)
export const ClarifyOptionSchema = z.object({
  key: z.string(),
  label_vi: z.string().max(50),
  sublabel_vi: z.string().max(80).optional(),
  preview_chart_type: ChartTypeSchema.optional(),
});

export const AnalyticsClarifyQuestionSchema = z.object({
  question_vi: z.string().max(120),
  options: z.array(ClarifyOptionSchema).min(2).max(4),
  freeform_hint_vi: z.string().max(120).optional(),
});

// 4. SSE phase enum
export const AnalyzePhaseSchema = z.enum([
  'idle',
  'listening',
  'transcribing',       // STT streaming
  'intent_classifying', // LLM detect chart type + dimensions
  'querying',           // MCP analytics.aggregate via V006
  'synthesizing',       // LLM compose narrative + insights
  'clarifying',         // waiting user pick option
  'rendered',           // chart shown
  'drilldown',          // expanded view active
  'error',
  'empty',              // no data
]);

// 5. Error codes
export const AnalyzeErrorCodeSchema = z.enum([
  'E_NO_SPEECH',
  'E_TRANSCRIBE_FAILED',
  'E_LOW_CONFIDENCE_AUDIO',
  'E_INTENT_AMBIGUOUS',          // → trigger clarify state
  'E_ANALYTICS_TIMEOUT',         // V006 query > 5s
  'E_ANALYTICS_EMPTY',           // no data → state F
  'E_LLM_SYNTHESIS_FAILED',
  'E_VESPA_UNAVAILABLE',
]);
```

**SSE event names** (FE subscribe `/api/v1/intent/stream`):

- `analyze.phase.listening` → progress 0-10%
- `analyze.phase.transcribing` → 10-25%, payload `VoiceTranscriptionResultSchema` (partial)
- `analyze.phase.intent_classifying` → 25-40%
- `analyze.phase.querying` → 40-70%
- `analyze.phase.synthesizing` → 70-95%
- `analyze.clarify_needed` (payload `AnalyticsClarifyQuestionSchema`) → terminal nếu ambiguous
- `analyze.result` (payload `AnalyticsResponseSchema`) → terminal nếu OK
- `analyze.empty` (payload `{ reason: 'no_orders' | 'date_range_empty' }`) → terminal
- `analyze.error` (payload `{ code, message_vi, trace_id }`) → terminal

**MCP tools sẽ cần (Phase 05):**

- `analytics.aggregate({ merchant_id, dimension: 'day'|'category'|'product', date_range: [from, to], metric: 'revenue'|'orders'|'qty' })` — query V006 mat views với fallback raw query
- `analytics.detect_anomaly({ series_data, threshold_pct: 15 })` — return `AnalyticsInsightSchema[]`
- `intent.classify_analyze({ transcript })` — return `{ chart_type, dimensions, date_range, metrics, confidence }` hoặc `{ ambiguous: true, clarify: ClarifyQuestion }`

---

## 4. ADRs

### ADR-07-01 — Voice modality reuse từ Intent 02

**Decision:** State 0 (mic idle), A (listening), B (analyzing 4-phase), J (error orb) **kế thừa 100%** patterns từ Intent 02. Orb 180px `--grad-orb`, 3 pulse rings, partial transcript card, 4-phase loading checklist, failed-orb shake.

**Rationale:** Consistent voice UX xuyên 2 intent voice (02 buy + 07 analyze). Component `<OrbPulse>`, `<LivePartialTranscript>`, `<PhasesCard>` đã được extract ở Intent 02 ADR-02-03. Phase 05 import lại không cần build mới.

**Khác biệt duy nhất với Intent 02:**
- State 0 tagline đổi: "Mua hàng bằng giọng nói" → "Phân tích bằng giọng nói"
- 3 example queries đổi: voice-buy queries → analytics queries với badge LINE/BAR/DONUT
- 4 phases khác: STT → **Intent + chart type** → **SQL query V006** → Synthesis (vs STT → Parser → Vespa search → Cart prep)

---

### ADR-07-02 — Chart rendering style: Mix (Option C)

**Decision:** 3 chart types render khác nhau theo nature:
- **Line (state C, G):** Full grid + Y/X axis labels (3 levels 300K-1.5M), peak annotation tooltip, "today" marker dashed line
- **Bar (state D):** Full Y-axis labels + category labels axis X, inline delta badge "-18%" trên bar có thay đổi đáng kể
- **Donut (state E):** Simplified — chỉ % legend bên cạnh + center label tổng. KHÔNG có axis (vì share inherently relative)

**Rationale:**
- Line + bar cần axis vì user merchant Việt Nam quan tâm con số tuyệt đối ("thứ Tư bán bao nhiêu?")
- Donut là về tỷ trọng — thêm axis vô lý
- Production-ready feel cho demo wow factor — không phải sparkline tối giản
- Mỗi chart type render theo cách tự nhiên của nó (đây là cách Stripe, Linear, Vercel dashboard làm)

**Trade-off:** Code SVG không reuse 100% giữa 3 types. ~150 dòng SVG cho line + bar full, ~30 dòng donut. Acceptable.

---

### ADR-07-03 — 4-phase loading (vs 2-3 phase)

**Decision:** State B chia analyzing thành **4 phases riêng biệt**:
1. STT (Gemini speech-to-text)
2. Intent classify + chart type pick (LLM)
3. SQL query V006 (MCP `analytics.aggregate`)
4. LLM synthesize narrative + insights

**Rationale:**
- 4 phases vừa đủ để feel "AI đang suy nghĩ thông minh" — không quá ít (cảm giác trống), không quá nhiều (mệt mỏi)
- Mỗi phase có meta riêng (ms + label) → demo presenter có thể giải thích từng bước cho judge
- Peek card "Đã hiểu câu hỏi" hiện ra sau phase 2 → progressive disclosure, giảm cảm giác chờ

**Trade-off:** Code phức tạp hơn 2-phase. Acceptable cho demo flagship.

---

### ADR-07-04 — Persona "Anh Nam" + story arc "dầu ăn giảm 18%"

**Decision:** Pick canonical demo persona "Anh Nam" — chủ tạp hóa HCMC (đồng bộ với Intent 08 login welcome). 30 ngày data với story tension:
- Tuần 1-2: tăng đều (600K → 1.32M peak)
- Tuần 3: giảm nhẹ
- Tuần 4 (gần nhất): giảm 8% → trigger insight "dầu ăn -18%"
- → State H action card: "Tạo khuyến mãi -10%" + "Đặt thêm 100 chai nước tương" (positive opportunity)

**Rationale:**
- Story có **tension** (giảm) + **opportunity** (tăng) → đủ wow cho demo
- Số liệu cụ thể (24.5tr, 18%, 62%) trông real, không generic
- 2 action cards cho thấy AI biết cả tin xấu + tin tốt → balanced

**Demo presenter tip:** Voice command canonical = *"Aida ơi, cho anh xem doanh thu 30 ngày qua"* (5 từ, đủ ngắn để judge ghi nhớ).

---

### ADR-07-05 — Drill-down: full-screen expanded (State G), không inline modal

**Decision:** Tap "Mở rộng" trên chart → navigate sang State G **full-screen expanded** thay vì inline modal/bottom sheet.

**Rationale:**
- Đối xứng với pattern Intent 01 State H (Market Trend expanded) — đã LOCKED ở Cross-Intent §6
- Full-screen cho phép hiển thị 4 stats grid + 7-day breakdown list + 6 drill-down chips → đủ chỗ
- Modal hoặc bottom sheet sẽ bị crowded trên 414px

**Trade-off:** Lose context của AI bubble + insight card khi expand. Acceptable vì user đã có narrative ở state C trước đó.

---

### ADR-07-06 — Action cards palette: amber (caution) + green (opportunity)

**Decision:** State H có 2 action card variants:
- **Amber** (`--amber-500` border-left): "Dầu ăn giảm -18%" — caution non-critical, suggest hành động corrective
- **Green** (`--green-500` border-left): "Nước tương đang trending +6%" — opportunity, suggest hành động proactive

**Rationale:**
- Đã sẵn palette từ Cross-Intent §3 (Intent 01 v2 introduced)
- Amber/green = semantic chuẩn analytics (caution/positive) — universal sign language
- 2 variants song song show "AI biết cả tin xấu lẫn tốt" → balanced demo

**Naming clash note:** Amber ở đây = caution informational, khác SALE badge amber (commercial urgency). Cùng màu, khác semantic — đã document Cross-Intent §3.2.

---

### ADR-07-07 — Sparkline mini chart trong action card

**Decision:** Action card "dầu ăn giảm" có **mini sparkline 26px height** ngay trong body, show 7-day downward trajectory.

**Rationale:**
- Reuse pattern Cross-Intent §7 (đã extract từ Intent 01)
- Visual evidence ngay lập tức ("show, don't tell") — không cần đọc nhiều text
- Trade-off: action card cao hơn ~30px. Acceptable cho impact.

**Implementation:** SVG inline với gradient ID unique `spark-amber` (theo rule Cross-Intent §7 — mỗi sparkline ID khác nhau).

---

### ADR-07-08 — Clarify pattern: inline trong AI bubble (state I)

**Decision:** Khi câu hỏi mơ hồ ("so sánh tháng này với trước"), LLM emit `analyze.clarify_needed` → UI render **clarify card inline trong AI bubble** với 3 chip options + freeform hint.

**Rationale:**
- Đồng bộ Intent 02 clarify pattern (inline chip, không bottom sheet) — Cross-Intent consistency
- 3 options đủ cho 80% disambiguation cases analytics
- Freeform hint "Hoặc nói lại rõ hơn — VD: ..." cho power user

**Trade-off:** Chỉ giới hạn 3-4 options. Nếu cần > 4 → extend `fallback_to_full_list` field như Intent 02.

---

### ADR-07-09 — State F (empty) 3 CTAs, không chỉ message

**Decision:** Empty state (no orders) **không phải dead-end** — show 3 actionable CTAs:
1. **Primary (pink gradient):** "Thêm đơn hàng demo" — Aida tạo 20 đơn mẫu để demo ngay
2. **Secondary (orange):** "Nhập sản phẩm mới" — link sang Intent 01 (import flow)
3. **Tertiary (lilac):** "Xem hướng dẫn" — onboarding video / guide

**Rationale:**
- Hackathon demo có thể bắt đầu từ empty state — judge cần thấy có path forward
- Primary CTA giúp demo presenter "1 tap → có data" để chuyển sang state C
- 3 màu CTA theo palette đã có (pink/orange/lilac) — không invent màu mới

---

### ADR-07-10 — Mock data fixture cho V006 (hackathon)

**Decision:** Phase 05 cần seed fixture **30 ngày data** vào V001 `orders` + `order_items` để V006 mat view có data demo:
- 186 orders / 30 ngày (~6/ngày trung bình, spike cuối tuần ~10)
- 5 categories distribute: nước tương 32% / mì tôm 24% / dầu ăn 18% / sữa 14% / bánh kẹo 12%
- 24.5tr tổng / 30d ≈ 817K/ngày trung bình
- Story arc: week1-2 rising, week3 flat, week4 dầu ăn -18%

**Rationale:**
- Mat view rỗng → demo crash. Cần fixture realistic.
- Story arc lập sẵn để demo presenter không phải improvise.
- Fixture file: `infra/seed/analytics_30d_demo.sql`

**Trade-off:** Tốn ~50 dòng INSERT statements. Acceptable.

---

### ADR-07-11 — 3-loại-trend disambiguation (cross-intent)

**Decision:** Intent 07 dùng **"trend nội bộ"** (`analytics.trend_history` từ V006), **KHÔNG** mix với:
- `market_trend` (Google Trends) của Intent 01
- `trend_score` (Vespa behavior aggregator) của Intent 03 ProductCard

**Rationale:** Cross-Intent §10 đã lock — mỗi loại "trend" sống ở intent riêng. Intent 07 narrative dùng từ "doanh thu" / "danh mục giảm" thay vì "trending" để tránh confusion.

**Demo presenter brief:** Nếu judge hỏi "trend này khác trend Google ở Intent 01 thế nào?" → trả lời: "Đây là trend nội bộ shop của anh, dựa trên đơn hàng thực tế. Trend Google là toàn thị trường VN."

---

## 5. Phase 05 Implementation Tasks

### Migrations bắt buộc (đã trong roadmap, không thêm mới)

- [ ] **V003 — insights table** (priority P0)
  ```sql
  CREATE TABLE insights (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES users(id),
    severity VARCHAR(20) NOT NULL,             -- info/opportunity/caution/critical
    summary_vi TEXT NOT NULL,
    related_metric VARCHAR(80),                -- "category:dau_an", "product:p_123"
    delta_pct FLOAT,
    chart_spec JSONB,                          -- AnalyticsChartSpec snapshot
    is_saved BOOL DEFAULT false,               -- user save to dashboard
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ                     -- TTL 30d cho non-saved
  );
  CREATE INDEX ON insights(merchant_id, created_at DESC);
  ```
- [ ] **V006 — analytics aggregations** (priority P0, đã spec ở INTENT_AUDIT_REPORT)

### Backend (`apps/api`)

- [ ] Endpoint `POST /api/v1/analyze/start` với SSE init
- [ ] Endpoint `PUT /api/v1/analyze/:session/audio` chunked audio upload
- [ ] MCP tool `analytics.aggregate({ merchant_id, dimension, date_range, metric })`
  - Strategy: try V006 mat view first, fallback raw query nếu mat view stale
- [ ] MCP tool `analytics.detect_anomaly({ series_data, threshold_pct })`
- [ ] MCP tool `intent.classify_analyze` — Gemini Flash với system prompt + 8 few-shot examples tiếng Việt
- [ ] Endpoint `POST /api/v1/analyze/:session/clarify` để resolve ambiguous query
- [ ] Endpoint `POST /api/v1/analyze/:session/drilldown` re-query với dimension mới
- [ ] LLM synthesis prompt template `apps/api/prompts/analyze_synthesis_vi.txt`
- [ ] Worker `worker-analytics` refresh V006 mat views hourly: `REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily`
- [ ] Insight detector: nếu delta < -15% trong 7d → emit insight `severity: 'caution'`; nếu > +10% và rate-of-stock-out < 7d → `severity: 'opportunity'`
- [ ] Error mapping cho 8 error codes với Vietnamese messages

### Frontend (`apps/web/src/features/voice-analyze/`)

- [ ] Route `/analyze` → State 0 component
- [ ] **Reuse Intent 02 components:** `<OrbPulse>`, `<LivePartialTranscript>`, `<PhasesCard>` (đã extract)
- [ ] `<AnalyticsChartCard chart={ChartSpec} onExpand={...} />` — switch render theo `chart_type`
  - `<LineChart>` SVG component (180px height, full grid + axis)
  - `<BarChart>` SVG component (200px height, full Y-axis + category labels)
  - `<DonutChart>` SVG component (150px square + legend bên cạnh)
- [ ] `<DrilldownExpandedView>` route `/analyze/drilldown/:metric` (full-screen state G)
- [ ] `<DayBreakdownList items={DailyData[]} />` component cho state G
- [ ] `<ActionCard variant="caution|opportunity" />` reuse từ Intent 01 v2 (`PHASE_00_CROSS_INTENT_PATTERNS.md` §4)
- [ ] `<MiniSparkline data={number[]} accent="amber|green" />` component (Cross-Intent §7)
- [ ] `<ClarifyChips question={ClarifyQuestion} />` reuse Intent 02
- [ ] `<EmptyAnalyticsState />` với 3 CTAs (state F)
- [ ] SSE consumer `useAnalyzeStream(sessionId)` → state machine 11 phases
- [ ] Fallback: nếu mic denied → redirect tới text input variant

### Shared types

- [ ] `packages/shared-types/src/analytics.ts` — 5 schemas ở Section 3 trên

### MCP / Infrastructure

- [ ] Few-shot prompt `apps/api/prompts/analyze_intent_classify_vi.txt` (8 examples)
- [ ] Mat view refresh job: cron hourly trong worker
- [ ] Fixture seed: `infra/seed/analytics_30d_demo.sql` (186 orders, story arc theo ADR-07-10)
- [ ] Rate limit: max 60s audio, max 3 concurrent analyze sessions per merchant

---

## 6. Known Issues / Tradeoffs

1. **SVG path hard-coded 30 data points** — nếu V006 trả về khác số ngày, path sẽ lệch. Phase 05 component `<LineChart>` phải dynamic generate path từ `series.data[]`.
2. **Donut segments cứng 5 categories** trong mockup — production có thể có 6-10 categories. UI cần auto-merge "Khác" cho top-5 + 1 "others" bucket.
3. **Mat view refresh lag** — nếu user vừa tạo đơn 10 phút trước, query có thể chưa thấy. Phase 05 cần fallback raw query khi data < 1h.
4. **LLM intent classifier accuracy** — câu "so sánh" không có ngữ cảnh (state I scenario) có thể trigger nhiều cách. 3 chip options chuẩn chỉ cover ~70% cases. Cần fine-tune fewshot.
5. **Drill-down chips state management** — tap chip → re-query toàn bộ, mất ~1.5s. Có thể cache result theo `(date_range, dimension)` ở Redis TTL 5min.
6. **Action card "Tạo khuyến mãi"** chưa wire vào flow — Phase 06 cần link sang Intent quản lý promotion (nếu có) hoặc just mock toast "Đã tạo".
7. **Empty state CTA "Thêm đơn hàng demo"** — Phase 05 cần endpoint `POST /api/v1/dev/seed-demo-orders` (chỉ enable trong dev/staging). Production: hide CTA này.
8. **Mobile responsive cho stat cells** — 3 stat cells với value 14px font có thể overflow trên màn 360px (Android nhỏ). Cần shrink xuống 12px hoặc stack vertical.
9. **Voice + chart ở demo:** Recording bằng voice + render chart sẽ tốn ~3-5s end-to-end. Phase 05 cần optimistic UI: chart skeleton ngay sau intent classify, fill data sau.
10. **Trace ID format `8b4f...a12`** trong error là mock — Phase 05 phải lấy từ OpenTelemetry context thật.

---

## 7. Visual QA Checklist

- [ ] **Bottom-bar test scroll lưng chừng**: scroll `main-scroll` state C/D/E/G/H/I positions 200, 300, 500, 800px — KHÔNG content lộ qua bottom-bar (đã pass automated grep)
- [ ] **Viewport responsive**: resize height 700-820px — phone-frame shrink với `max-height: calc(100vh - 48px)` (đã pass)
- [ ] State 0: mic button pulse 3 rings stagger, breathe animation rõ; tap → navigate state A
- [ ] State A: orb 180px pulse, partial transcript text typed + cursor blink, timer count up
- [ ] State B: 4 phases progress đúng thứ tự, spinner xoay phase active, peek card xuất hiện sau phase 2
- [ ] State C: chart line render đủ 30 data points, axis labels 300K-1.5M rõ, peak annotation "1.32M ▲" đúng vị trí, today marker cam dashed
- [ ] State D: 5 bars render đúng tỷ lệ (NT cao nhất, BK thấp nhất), badge "-18%" amber trên dầu ăn rõ
- [ ] State E: 5 segments donut đúng tỷ lệ (32/24/18/14/12), legend khớp màu, center text "24,5tr"
- [ ] State F: 3 CTAs với 3 icon background gradient khác nhau (pink primary / orange / lilac)
- [ ] State G: 4 stats grid 2×2, 7-day breakdown list mini bars + delta %, 6 drill-down chips
- [ ] State H: 2 action cards (amber + green), mini sparkline 26px trong card amber, 4 detail rows
- [ ] State I: 3 clarify options với 3 icon riêng (line/bar/bar-compare), freeform hint dashed border
- [ ] State J: failed-orb shake 2 cycles, error code monospace, 3 tips bullet point pink
- [ ] All states: phone frame 414×844 trên desktop, đáy bottom-bar dính frame (không trôi)
- [ ] All states: phù hợp `prefers-reduced-motion` — disable orbBreathe + errorShake + pulseRing
- [ ] Cross-ref: schemas Section 3 khớp ADR-07-01 reuse Intent 02 fields

---

## 8. Demo Flow v1

```
State 0 (mic idle, entry)
  └─► tap mic → State A (listening, orb pulse)
        └─► auto-stop sau 4s → State B (4-phase analyzing)
              ├─► phase 1-2 success → peek "Đã hiểu" hiển thị
              ├─► [LLM ambiguous] → State I (clarify với 3 chips)
              │     └─► tap chip → loop back B phase 3
              ├─► [V006 timeout] → State J (error)
              │     └─► tap "Thử lại" → loop B
              ├─► [no data] → State F (empty)
              │     └─► tap "Thêm demo orders" → seed → loop B
              └─► [success] → render chart inline (route theo chart_type):
                    ├─► chart_type=line → State C (revenue 30d)
                    ├─► chart_type=bar → State D (top categories)
                    └─► chart_type=donut → State E (share)
                    │
                    └─► tap "Mở rộng" → State G (drilldown expanded full-screen)
                    │     └─► tap drill chip → re-query → loop B
                    │
                    └─► tap "Xem gợi ý hành động" trên insight card → State H
                          ├─► tap "Tạo khuyến mãi -10%" → toast "Đã tạo" (mock)
                          └─► tap "Đặt thêm 100 chai" → toast (mock)
```

**Demo presenter tip:** Main flow show **State 0 → A → B → C** (line chart canonical) là đủ wow. Nếu có thời gian, tap "Mở rộng" → G để show drill-down depth, rồi quay lại tap insight → H để show "insight → action" loop.

---

## 9. References

- `00_CONTEXT.md` — project anchor (V003 + V006 trong roadmap)
- `INTENT_AUDIT_REPORT.md` — Intent 07 pre-audit (2 migrations đã spec)
- `PHASE_00_DESIGN_SYSTEM.md` — v3 MoMo tokens
- `PHASE_00_CROSS_INTENT_PATTERNS.md` — bottom-bar pattern §1, phone-frame §2, palette §3, action-card §4, sparkline §7, trend §10
- `PHASE_00_INTENT_02_MOCKUP_HANDOFF.md` — sibling voice modality (orb pulse, 4-phase, clarify pattern)
- `PHASE_00_INTENT_01_HANDOFF_DELTA.md` — action card amber/green palette extracted
- `PHASE_00_INTENT_04_MOCKUP_HANDOFF.md` — chat thread layout pattern reuse
- `09_FIELD_AUDIT.md` — Section 7.x update với 23 field rows mới (Section 2 trên)

---

**Handoff complete. Ready for Phase 05 backend (V003 + V006 + worker-analytics).**

**Generated:** 2026-05-17
**Mockup count:** 11 states (2 hand-crafted golden: 0, C + 9 builder-generated: A, B, D, E, F, G, H, I, J)
**Total HTML size:** ~212KB (standalone, no external assets except Google Fonts)
**Next intent to mockup:** Tất cả 8 intents đã xong (01-08). Phase 00 mockup complete.
