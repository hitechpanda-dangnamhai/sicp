# Phase 00 — Intent 02 Mockup Handoff

> **Scope:** Mockup tĩnh cho **Intent 02 — Buy Products by Voice**, gồm main flow + 7 edge/secondary states. Phục vụ Phase 04 implementation reference.
> **Status:** Mockup-only. Không có code React, không có endpoint, không có migration.

---

## Đã làm được

- **Field audit Intent 02** đối chiếu UI ↔ data source theo `09_FIELD_AUDIT.md`:
  - Verdict: **0 migration mới** cần thêm. Tận dụng hết V001 (products) + V002 (attributes + embeddings) + Redis cart.
  - 5 schema extension TypeScript (voice transcription + bulk buy intent + clarify question + phase enum + error codes).
  - ADR-024 (Vespa rank_score normalized) đã có sẵn cho match_score badge.
- **Mockup main flow** Intent 02: Mic idle (entry) → Listening (orb pulse) → Transcribing & Parsing (4 phases) → Cart Ready Multi-item (3 sản phẩm + qty stepper + tổng tiền) → Add to cart bulk → Success.
- **Mockup 7 edge/secondary states**:
  - Listening với orb pulsing + live partial transcript
  - Transcribing với 4-phase progress: STT → LLM intent parser → Vespa search parallel → Cart prep
  - Clarify với inline bubble + chip options (1 món đã match + 1 món hỏi thêm)
  - Cart added success với bump animation + co-purchase suggestion
  - No match với 2 alternative products (similarity %)
  - Error E_TRANSCRIBE_FAILED với failed-orb visual + 3 tips + typing fallback
- **Decision UX locked**:
  - **Multi-item bulk parsing**: LLM extract array `[{product_query, quantity, unit}, ...]` từ 1 câu — wow factor cho demo
  - **Inline bubble + chip clarify**: đồng bộ chat-flow Intent 03/04 (không dùng bottom sheet)
  - **Orb pulsing waveform**: đồng bộ Aida brand `--grad-orb` (radial trắng-hồng-cam), không dùng bars classic
  - **Voice modality entry**: big mic button gradient pink-orange với pulse rings (signature Aida visual)
- **Visual nhất quán 100%** với Intent 01, 03, 04, 05, 06, 08 (cùng design system v3 MoMo-inspired, cùng phone frame 414×844px, cùng AI bubble pattern, cùng phase loading style).

## Module / file đã tạo

```
docs/mockups/intent-02/                                ← khuyến nghị đặt ở đây
  ├── intent-02-state-0-mic-idle.html                  → Entry: big mic + tips + 3 ví dụ câu (golden hand-crafted)
  ├── intent-02-state-A-listening.html                 → Orb pulsing + timer + partial transcript + cancel/stop
  ├── intent-02-state-B-transcribing.html              → 4-phase progress + sneak peek items detected
  ├── intent-02-state-C-cart-ready.html                → Happy path multi-item: 3 cards + qty stepper + total (golden hand-crafted)
  ├── intent-02-state-D-clarify.html                   → 1 matched + 1 ambiguous → inline chip options
  ├── intent-02-state-E-cart-added.html                → Success bump + cart pill float + co-purchase suggest
  ├── intent-02-state-F-no-match.html                  → "Em đoán bạn cần X" + 2 alt products with similarity %
  ├── intent-02-state-G-error.html                     → E_TRANSCRIBE_FAILED + failed-orb + tips + typing fallback
  └── build_intent_02.py                               → Builder script cho 6 state secondary (A, B, D-G)
```

Mỗi file HTML standalone, không phụ thuộc nhau, mở thẳng browser.

**Asset chia sẻ embed trong mỗi file:**
- SVG icon inline (Lucide-style stroke) — không dùng webfont CDN
- CSS tokens v3 (hồng-cam MoMo) hardcoded inline trong `<style>`
- Be Vietnam Pro + JetBrains Mono load từ Google Fonts
- Orb pulsing pattern (radial gradient + 3 expanding rings) — đồng bộ với golden-reference-mockup.html

## Public interfaces exposed (cho phase sau import)

**TypeScript schema mới cần định nghĩa ở `packages/shared-types/src/voice-buy.ts`:**

```typescript
import { z } from 'zod';
import { SearchProductSchema } from './search';   // reuse Intent 03

// 1. Gemini STT output (streaming SSE)
export const VoiceTranscriptionResultSchema = z.object({
  text: z.string().max(500),
  confidence: z.number().min(0).max(1),          // 0..1 audio quality
  is_partial: z.boolean(),                       // true = streaming partial, false = final
  language: z.literal('vi-VN'),
  duration_ms: z.number().int().min(0),
});

// 2. LLM bulk-buy intent parser output
export const BuyItemQuerySchema = z.object({
  product_query: z.string().min(1).max(120),     // raw extracted phrase: "nước tương Maggi"
  quantity: z.number().int().min(1).max(999),
  unit: z.string().max(20).optional(),           // 'chai', 'thùng', 'hộp', ...
  raw_span: z.string().optional(),               // original substring in user utterance
});

export const BuyIntentSchema = z.object({
  items: z.array(BuyItemQuerySchema).min(1).max(10),
  raw_transcript: z.string(),
  parser_confidence: z.number().min(0).max(1),
});

// 3. Match result per item (after Vespa search)
export const ItemMatchSchema = z.object({
  query: BuyItemQuerySchema,
  status: z.enum(['matched', 'ambiguous', 'no_match']),
  matched_product: SearchProductSchema.optional(),   // when status = 'matched'
  match_score: z.number().min(0).max(1).optional(), // Vespa rank_score normalized
  candidates: z.array(SearchProductSchema).max(5).optional(),  // when status = 'ambiguous'
  alternatives: z.array(SearchProductSchema.extend({
    similarity: z.number().min(0).max(1),
  })).max(3).optional(),  // when status = 'no_match'
});

// 4. Clarify question (LLM-generated)
export const ClarifyQuestionSchema = z.object({
  for_item_index: z.number().int().min(0),       // index in BuyIntent.items
  question_vi: z.string().max(200),              // "Bạn muốn nước tương loại nào?"
  options: z.array(z.object({
    product_id: z.string().uuid(),
    label: z.string().max(80),                   // product name short
    price: z.number().int(),
    extra_info: z.string().max(40).optional(),   // "★ 4.9 · 8.5k đã bán"
  })).min(2).max(6),
  fallback_to_full_list: z.boolean(),            // if true, show "Xem tất cả X loại"
});

// 5. SSE phase enum
export const VoiceBuyPhaseSchema = z.enum([
  'idle',
  'listening',
  'transcribing',     // STT streaming partial → final
  'parsing',          // LLM intent parser
  'searching',        // Vespa search parallel per item
  'clarifying',       // waiting for user clarify
  'cart_ready',       // all items resolved, awaiting commit
  'committing',       // adding to Redis cart
  'added',            // success
  'error',
]);

// 6. Error codes
export const VoiceBuyErrorCodeSchema = z.enum([
  'E_NO_SPEECH',                // No audio detected / too short
  'E_TRANSCRIBE_FAILED',        // Gemini STT crashed
  'E_LOW_CONFIDENCE_AUDIO',     // STT confidence < 0.5
  'E_INTENT_PARSE_FAILED',      // LLM couldn't extract items
  'E_NO_MATCH',                 // All items no_match (full-empty)
  'E_VESPA_TIMEOUT',            // Search > 3s
  'E_PERMISSION_DENIED',        // Mic permission rejected
  'E_NETWORK',
]);

// 7. Cart commit request
export const CartBulkAddSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(20),
  source: z.literal('voice'),
  session_id: z.string(),
});
```

## SSE / API contract (Phase 04 sẽ implement)

**SSE events** (server-sent từ `/api/v1/voice-buy/sse`):

```
event: voice.phase
data: { phase: VoiceBuyPhase, progress: 0..1 }

event: voice.transcript_partial
data: { text: string, confidence: number }    // streaming during phase=transcribing

event: voice.transcript_final
data: VoiceTranscriptionResult

event: voice.intent_parsed
data: { intent: BuyIntent }                   // LLM emits, before search starts

event: voice.item_resolved
data: { index: number, match: ItemMatch }     // emitted per item (parallel)

event: voice.clarify_needed
data: { questions: ClarifyQuestion[] }        // 1 or more items need user input

event: voice.cart_ready
data: { matches: ItemMatch[], total_amount: number }

event: voice.error
data: { code: VoiceBuyErrorCode, message_vi: string, retry_hint?: string, trace_id: string }

event: voice.done
data: { session_id: string }
```

**REST endpoints:**

```
POST  /api/v1/voice-buy/start
                          → starts SSE stream, returns { session_id, sse_url }
                          → audio uploaded separately via PUT with chunked transfer

PUT   /api/v1/voice-buy/:session/audio    (Content-Type: audio/webm)
                          → streams audio bytes to STT

POST  /api/v1/voice-buy/:session/clarify
                          body: { for_item_index: number, selected_product_id: UUID }
                          → updates match, triggers re-resolve cart_ready

POST  /api/v1/voice-buy/:session/commit
                          body: CartBulkAddSchema['items']
                          → bulk insert into Redis cart, returns { cart_id, total }

POST  /api/v1/voice-buy/:session/cancel    (cleanup)
```

**MCP tools required (Phase 04):**

- `speech.transcribe` — Gemini 1.5 Flash STT với streaming partial output (đã có pattern từ Intent 03)
- `intent.parse_bulk_buy` — LLM (Gemini Flash) wrap với few-shot prompt tiếng Việt: input transcript → output `BuyIntent` JSON
- `vespa.search_product` — reuse Intent 03 query, gọi song song N queries qua Promise.all
- `policy.suggest_copurchase` — emit "62% khách mua X mua kèm Y" card sau khi cart commit (dùng V006 materialized view `analytics_daily_category`)

## ADRs (Architecture Decision Records)

### ADR-02-01 — Bulk multi-item parsing (Option B)

- **Quyết định:** LLM intent parser nhận transcript và output mảng items thay vì single item.
- **Lý do:** Use case chủ shop tạp hóa hay nói nguyên danh sách 1 lần ("nhập kho: gạo, nước mắm, đường, dầu ăn..."). Demo hackathon cần wow factor. Tận dụng được khả năng hiểu ngôn ngữ tự nhiên của LLM.
- **Trade-off:** Prompt engineering phức tạp hơn (cần few-shot examples cho parsing tiếng Việt: "2 chai" vs "1 thùng"). Edge case nhiều khi 1 transcript có mix matched/ambiguous/no_match. Response time chậm hơn ~500ms do parallel Vespa search.

### ADR-02-02 — Clarify dialog: inline bubble + chip options (Option A)

- **Quyết định:** Khi item ambiguous → AI emit `ClarifyQuestion` → UI render inline trong chat thread, dạng bubble màu nhạt với 2-4 chip option (mỗi chip có ảnh thumb 36px + tên + meta + giá).
- **Lý do:** Đồng bộ chat-flow xuyên Intent 01-08 (không intent nào dùng bottom sheet cho clarify). Không break momentum — user vẫn thấy được context (câu họ vừa nói + items khác đã match). Animation slide-in mượt.
- **Trade-off:** Chip giới hạn không gian. Nếu > 4 options thì có chip "Xem tất cả X loại" mở danh sách đầy đủ (subview).

### ADR-02-03 — Waveform: orb pulsing (Option B)

- **Quyết định:** State A dùng orb radial trắng-hồng-cam (180px) với 3 pulse ring expand outward, không dùng 24-bar classic.
- **Lý do:** 100% đồng bộ Aida brand `--grad-orb` (signature element trong design system v3, đã dùng Hero card chính). Premium feel như Siri 2024+. Tận dụng keyframe `pulseRing` + `orbBreathe` đã có sẵn.
- **Trade-off:** Không "familiar" bằng bars Voice Memo. Mitigate bằng text "Aida đang nghe..." kèm timer + label "ĐANG GHI ÂM" đỏ.

### ADR-02-04 — Voice modality entry: big mic CTA + tips

- **Quyết định:** State 0 là full-screen brand pink-orange với mic button 130px gradient + 3 ví dụ câu mẫu + 2 capability pill ("Hiểu tiếng Việt", "Mua nhiều món 1 lượt").
- **Lý do:** Onboarding moment — merchant lần đầu cần biết "feature làm gì + nói thế nào". 3 ví dụ câu là form of contract giữa user và AI: "nói thế này thì AI hiểu được". Đồng bộ với Intent 01 pattern (entry có examples + tips).
- **Trade-off:** Mất 1 màn riêng (không cho tap mic record liền). Acceptable cho user lần đầu — sau khi quen có thể skip qua thiết lập "shortcut" trên home.

### ADR-02-05 — Confidence indicator strategy

- **Quyết định:** Hiển thị 2 loại confidence khác nhau:
  - **STT audio confidence** (state B-C): badge "✓ 96% rõ" trên user voice bubble
  - **Vespa match score per item** (state C): badge "98% khớp" / "94% khớp" / "92% khớp" trên từng product card
- **Lý do:** User cần biết 2 thứ khác nhau: (1) AI nghe rõ không (2) sản phẩm match có chính xác không. Tách 2 metric tránh nhầm lẫn.
- **Trade-off:** Thêm UI element. Acceptable — giúp build trust với AI accuracy.

### ADR-02-06 — Multi-item edge case: partial success (1/3 matched)

- **Quyết định:** Nếu BuyIntent có 3 items mà chỉ 2 matched + 1 ambiguous → emit `voice.clarify_needed` cho item ambiguous, UI render Card "Đã rõ 2/3" + ClarifyBubble cho 1 item còn lại. User resolve xong → cart_ready emit lại với cả 3 items.
- **Lý do:** Không bắt user phải nói lại từ đầu. Progressive disclosure: resolve từng cái một.
- **Trade-off:** State machine phức tạp hơn. Acceptable — better UX, especially với multi-item flow.

### ADR-02-07 — Mic permission strategy

- **Quyết định:** Trigger `navigator.mediaDevices.getUserMedia({audio:true})` khi user tap mic button lần đầu. Nếu denied → State G với code `E_PERMISSION_DENIED` + tips mở Settings.
- **Lý do:** Just-in-time permission > prompt-on-load. User hiểu lý do cần mic (vừa tap voice button).
- **Trade-off:** Nếu deny lần đầu thì khó re-prompt (browser block). Cần guide user mở Settings manually.

### ADR-02-08 — Cart commit: bulk vs sequential

- **Quyết định:** Add toàn bộ items vào Redis cart bằng 1 request `POST /commit` chứa array, không phải N requests sequential.
- **Lý do:** Atomic operation — nếu fail thì rollback toàn bộ, không có cart partial. Faster (~50ms vs ~300ms cho 3 items).
- **Trade-off:** Lock Redis cart key trong khoảng ngắn. Acceptable scale (< 100 RPS).

## Phase 04 implementation tasks

### Backend (`apps/api`)

- [ ] Endpoint `POST /api/v1/voice-buy/start` với SSE init
- [ ] Endpoint `PUT /api/v1/voice-buy/:session/audio` chunked audio upload → stream tới Gemini STT
- [ ] MCP tool `speech.transcribe` — Gemini 1.5 Flash STT với partial streaming
- [ ] MCP tool `intent.parse_bulk_buy` — Gemini Flash với system prompt + 5 few-shot examples tiếng Việt cho parsing
- [ ] Parallel Vespa search via Promise.all, 3 queries song song ~800ms total
- [ ] Per-item resolve logic: `matched_product` if rank_score > 0.85, `candidates[]` if 0.6 < score < 0.85, `alternatives[]` if score < 0.6
- [ ] Endpoint `POST /api/v1/voice-buy/:session/clarify` để resolve ambiguous item
- [ ] Endpoint `POST /api/v1/voice-buy/:session/commit` bulk Redis cart add
- [ ] Error handling cho 8 error codes với Vietnamese message_vi
- [ ] Co-purchase suggestion engine: query V006 `analytics_daily_category` materialized view, emit sau cart commit

### Frontend (`apps/web/src/features/voice-buy/`)

- [ ] Route `/voice-buy` → State 0 component
- [ ] `useMediaRecorder()` hook với MediaRecorder API + chunked upload
- [ ] `useAnalyserNode()` hook → calc RMS volume → CSS variable `--volume` cho orb scale realtime
- [ ] Component `<OrbPulse volume={0..1} />` — orb 180px + 3 ring pulse animation
- [ ] Component `<LivePartialTranscript text={string} cursor />` cho state A
- [ ] SSE consumer hook `useVoiceBuyStream(sessionId)` → state machine 10 phases
- [ ] Component `<ParsingPhasesCard />` cho state B với 4-phase checklist
- [ ] Component `<ItemMatchCard match={ItemMatch} />` với 3 visual variants (matched / ambiguous-trigger-clarify / alt-suggest)
- [ ] Component `<ClarifyChips question={ClarifyQuestion} />` cho state D
- [ ] Component `<QtyStepper value qtyMin=1 qtyMax=999 />` reuse Intent 06
- [ ] Component `<CartBumpPill count={number} />` floating overlay
- [ ] Toast với retry CTA cho state G
- [ ] Fallback: nếu mic denied → redirect tới Intent 03 (text search)

### MCP / Infrastructure

- [ ] Gemini API key cho STT + LLM intent parser
- [ ] Few-shot prompt template trong `apps/api/prompts/bulk_buy_intent_vi.txt` (5-10 examples)
- [ ] Redis cart schema: `cart:{user_id}` → hash of `{product_id: quantity}`
- [ ] Co-purchase query trong `apps/api/queries/copurchase.sql` (sử dụng V006)
- [ ] Rate limit: max 60s audio per session, max 10 items per BuyIntent

## Known issues / trade-offs

1. **Orb animation overhead** — 3 expanding rings + breathe core có thể tốn ~5% CPU trên low-end Android. Mitigate bằng `prefers-reduced-motion` media query (disable orbBreathe, keep pulse static).
2. **LLM parser sensitivity** — câu mà ngữ điệu kì lạ ("mua ấy ấy") có thể parse rỗng. Acceptable — emit State G `E_INTENT_PARSE_FAILED` với hint "Nói cụ thể hơn".
3. **Vespa parallel search có thể quá tải nếu user nói 10 items** — limit BuyIntent.items max 10 trong schema. Soft cap UI: "Aida hiểu tối đa 10 món/lần".
4. **STT confidence threshold 0.5** chưa tune trên audio tiếng Việt thực tế. Phase 04 cần test set 50 audio mẫu.
5. **Stat "96% rõ" trong user bubble** là display only — real STT confidence từ Gemini có thể không expose direct. Phase 04 confirm với API docs.
6. **Mic permission denied** → user phải mở Settings system, không có deep-link in-app. Phase 04 document fallback flow rõ.
7. **Floating cart pill bump animation** chỉ trigger 1 lần khi navigate vào State E. Nếu user back và quay lại, animation không replay (acceptable).
8. **"62% khách mua X cũng mua Y" copurchase signal** cần ít nhất 50 orders trong DB để confidence đủ. Hackathon mới start → fake data trong fixture đến khi có traffic.

## QA checklist (cho Phase 04 demo)

- [ ] State 0: tap mic button → permission prompt hiện, accept → chuyển State A
- [ ] State A: orb pulse breathe rõ, 3 ring expand staggered, timer count up từ 0:00
- [ ] State A: partial transcript text update mỗi 200ms với cursor blink
- [ ] State A: tap "DỪNG" → audio upload complete → chuyển State B
- [ ] State A: tap X (cancel) → cleanup audio buffer → back State 0
- [ ] State B: 4 phase progress đúng thứ tự, spinner xoay phase active
- [ ] State B: peek items detected hiện ra sau phase 2 (LLM parser done)
- [ ] State C: 3 mini-card render đúng items, qty stepper hoạt động ±
- [ ] State C: total amount tính realtime khi đổi qty
- [ ] State C: tap "Thêm vào giỏ" → loading 300ms → State E
- [ ] State D: ambiguous item hiển thị 3 chip options + chip "Xem tất cả"
- [ ] State D: tap 1 option → bubble collapse → emit clarify resolved → State C update
- [ ] State E: cart pill bump animation visible (scale 1→1.15→1)
- [ ] State E: co-purchase card "62% khách mua X..." chỉ hiện khi V006 có data
- [ ] State F: 2 alternative cards có similarity badge % rõ ràng
- [ ] State G: failed-orb shake animation visible, error code hiển thị
- [ ] State G: tap "Gõ tay thay" → redirect tới Intent 03
- [ ] All states: phone frame 414×844, render trên Safari iOS 17+, Chrome Android 12+
- [ ] All states: phù hợp `prefers-reduced-motion` (tắt orb breathe, giữ static)
- [ ] STT timeout > 5s → tự chuyển State G `E_TRANSCRIBE_FAILED`

## Liên kết tới Phase 04 (Implementation)

- Reference doc này khi build feature folder `apps/web/src/features/voice-buy/`
- Voice modality pattern lock ở đây → reuse 100% cho **Intent 07** (Analyze by Voice)
- Orb pulse component `<OrbPulse />` extract vào `apps/web/src/components/decor/OrbPulse.tsx` để reuse Intent 07
- ProductCard cho item-row reuse từ Intent 03 (search) — không cần build mới
- QtyStepper component đã có ở Intent 06 (cart) — reuse

---

**Generated:** 2026-05-17
**Mockup count:** 8 states (2 hand-crafted golden + 6 generated)
**Total HTML size:** ~129KB (standalone, no external assets except fonts)
**Next intent to mockup:** Intent 07 (Analyze by Voice) — reuse voice pattern + chart layer
