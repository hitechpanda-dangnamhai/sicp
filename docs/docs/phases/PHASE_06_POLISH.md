# Phase 06 — Polish, Demo Prep, Pitch

> **Duration:** Tuần 6  
> **Mục tiêu:** Demo bóng bẩy, không bug trên happy path, pitch deck hoàn thiện.

## Definition of Done

- [ ] Demo script viết sẵn, tập 3 lần ≤ 8 phút
- [ ] Toàn bộ 8 intents chạy không lỗi với data seed sạch
- [ ] UI responsive, không jank khi streaming
- [ ] Pitch deck 10 slides
- [ ] Backup plan nếu Wi-Fi/API down
- [ ] README repo có gif demo

## Polish tasks

### A. UI Polish

- [ ] Loading states cho mọi async (skeleton, spinner)
- [ ] Empty states cho cart, results, cards
- [ ] Error toasts (sonner / shadcn toast)
- [ ] Streaming text typewriter effect (cosmetic, nhưng wow)
- [ ] Dark mode toggle
- [ ] Sounds optional: subtle "ding" khi card xuất hiện

### A2. Observability Polish (WOW factor cho ban giám khảo kỹ thuật)

Đến Phase 06 dashboards đã có draft từ các phase trước. Phase này finalize và làm "demo-able":

- [ ] **Grafana dashboard "Live Demo" — 1 màn hình duy nhất**:
  - Top-left: Service map (RED metrics) — gateway/ai/mcp/workers
  - Top-right: Intent latency p95 by intent (top 8 bar chart)
  - Mid-left: LLM token usage + estimated cost ($) realtime
  - Mid-right: Kafka consumer lag per topic
  - Bottom: Behavior funnel `product.viewed → cart.item_added → checkout.completed` conversion rate
- [ ] **Trace samples panel** — list 5 traces gần nhất, click → mở Tempo
- [ ] **Recording rules** Prometheus pre-aggregate metrics tốc độ cao
- [ ] **Alert rules** (chỉ console/Slack):
  - p95 intent duration > 5s for 5min
  - Payment success rate < 70% for 10min
  - Aggregator lag > 10min
- [ ] **Log redaction middleware** verified — không leak email/token trong Loki
- [ ] **LOG_CATALOG.md** đầy đủ mọi message dùng trong code (audit qua grep)
- [ ] **Backup mode** — script `make demo:freeze` snapshot Vespa + PG + Redis state để rollback nhanh nếu demo lỗi
- [ ] **Demo flag** — env var `ICP_DEMO_MODE=true` để:
  - Disable verbose logs
  - Force payment success rate 100% (vs 80% default)
  - Pre-load fixed time window cho analytics (deterministic numbers)

### B. Demo Script (gợi ý)

**00:00–00:30** — Hook
> "Anh là chủ shop tạp hóa, có 50 sản phẩm, không biết phân tích kinh doanh, đối thủ thì làm marketing AI. Chúng tôi xây ICP — trợ lý AI một màn hình."

**00:30–02:00** — Intent 01 (nhập hàng bằng ảnh)
- Chụp chai nước tương
- ICP analyze, prefill form
- Submit → 2 cards xuất hiện (PRICE_TOO_HIGH + TREND_FADING)
- Accept giảm giá, accept gợi ý sản phẩm khác
- Click Nhập hàng

**02:00–03:30** — Intent 03 + 05 + 02 (search + cart + buy voice)
- Khách hàng gõ "nước tương ngon dưới 50k"
- Add 1 sản phẩm vào giỏ qua text
- Nói "thêm 1 chai dầu ăn Tường An" → cart updated

**03:30–04:30** — Intent 06 (payment với choreography)
- Gõ "thanh toán"
- Show real-time order status pill chạy: pending → processing → paid
- (Backup: hoặc fail để show compensation)

**04:30–06:00** — Intent 07 (analytics voice)
- Merchant nói "phân tích trend nước tương 6 tháng qua"
- Chart line xuất hiện
- ICP đọc narrative TTS

**06:00–07:00** — Intent 04 (recommendation image)
- Khách chụp ảnh chai họ thấy ở quán → ICP recommend 10 sp similar
- Reason cho từng item

**07:00–08:00** — Tech wrap + Q&A
- 1 slide kiến trúc
- 1 slide highlight: LangGraph + MCP + Choreography + Multimodal
- Mời câu hỏi

### C. Pitch Deck Outline (10 slides)

1. **Title** — ICP, hackathon team name
2. **Problem** — Chủ shop nhỏ thiếu công cụ thông minh
3. **Solution** — 1 màn hình, voice/image/text, AI agent
4. **Demo screenshot** — main screen
5. **Highlight features** — 8 intents trên 1 hình
6. **Architecture** — diagram tổng quan đã vẽ
7. **AI Pipeline** — LangGraph + MCP + Multimodal
8. **Event-Driven** — Kafka choreography + Action Cards
9. **Tech Stack** — logos
10. **What's next + Q&A** — Roadmap nếu được đầu tư

### D. Demo Reliability

- [ ] Pre-load demo session: login sẵn, cart trống, seed data fresh
- [ ] Backup hardware: 2 laptop, 1 mobile (record demo trước)
- [ ] Backup mode: pre-recorded video 30s đoạn rủi ro (payment fail, voice transcribe vùng ồn)
- [ ] Disable verbose logs khi demo
- [ ] Disable hot reload
- [ ] Mute notifications

### E. Performance Audit

- [ ] Bundle size Next.js < 500KB
- [ ] First SSE event < 1s
- [ ] Voice transcribe < 3s cho audio 5s
- [ ] Vision analyze < 4s
- [ ] Vespa search < 200ms

Nếu chậm:
- Cache embedding (Redis với key = SHA256 của input)
- Pre-warm LLM client
- Connection pool tăng

### F. Documentation Final

- [ ] Root README với: pitch summary, architecture diagram, quickstart, demo script
- [ ] Demo gif 30s embed README
- [ ] `docs/` đầy đủ, link từ README
- [ ] CHANGELOG sumamry

### G. Submission Checklist

- [ ] Repo public + license MIT
- [ ] Slide deck PDF
- [ ] Demo video 3-5 phút unedited backup
- [ ] One-pager handout (text-only mô tả)
- [ ] Contact info team

## Tasks ordering

### Day 1 — UI polish round 1
### Day 2 — Demo script + rehearsal #1
### Day 3 — Bug fix based on rehearsal
### Day 4 — Pitch deck final + rehearsal #2
### Day 5 — Performance audit + final fixes
### Day 6 — Recording backup video, full doc pass
### Day 7 — Buffer day for emergencies, final rehearsal #3

## Risks during demo

| Risk | Mitigation |
|---|---|
| Internet down at venue | Hotspot backup, local LLM fallback nếu set up kịp |
| Gemini API rate limit | Pre-warm + cache, có 2nd API key |
| Vespa container crash | docker-compose restart trước demo |
| Voice transcribe fail vì noise | Mic gần miệng, đeo headset |
| Camera bị mờ | Pre-shot ảnh sản phẩm, có button "Use demo image" |

---

## Khi xong Phase 06

Project SHIP. Tạo `FINAL_HANDOFF.md` ghi:
- Toàn bộ feature đã ship
- Known bugs còn lại (nếu post-mortem)
- Future work ideas
