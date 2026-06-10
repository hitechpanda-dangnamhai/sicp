# ADR Index

> Append-only registry of all Architecture Decision Records.
> Status normalize: **Accepted** | **Superseded** | **Locked**.
> Status triển khai sống ở `MASTER_BACKLOG.md` — KHÔNG ở đây (CLAUDE.md §9).

| ADR | Tên | Status | Tóm tắt 1 dòng |
|---|---|---|---|
| [ADR-001](ADR-001.md) | Choose Vespa over Elasticsearch + pgvector | Accepted | Search engine hybrid BM25 + vector multimodal, ranking profile linh hoạt |
| [ADR-002](ADR-002.md) | Choreography (no Saga orchestrator) | Accepted | Order flow coordinate qua Kafka events, không Saga orchestrator service |
| [ADR-003](ADR-003.md) | MCP server as single I/O gateway for AI | Accepted | Mọi I/O của AI service đi qua MCP server (Python tự build) |
| [ADR-004](ADR-004.md) | Idempotency via Redis cache | Accepted | Redis SETNX lock TTL 30s + response cache TTL 24h, header Idempotency-Key |
| [ADR-005](ADR-005.md) | Voice STT/TTS qua Gemini API | Accepted | Quyết định gốc Gemini cho speech+vision (triển khai thật đã pivot OpenAI cho speech) |
| [ADR-006](ADR-006.md) | Outbox lite, not full transactional outbox | Accepted | Same-txn insert events row, publish Kafka post-commit, sweeper retry 30s |
| [ADR-007](ADR-007.md) | Single Flask app for all 8 intent subgraphs | Accepted | 1 Flask process chứa cả 8 subgraph, LangGraph router dispatch |
| [ADR-008](ADR-008.md) | Mock Shopee crawler (JSON file) | Superseded | Superseded by ADR-032 — JSON thiếu structure cho state D, chuyển sang Postgres table |
| [ADR-009](ADR-009.md) | Next.js single screen architecture | Accepted | 1 page `/` chứa chat + cart sidebar + result canvas, auth = modal |
| [ADR-010](ADR-010.md) | Hackathon scope cuts | Superseded | Superseded by ADR-037 — pivot sang production, các cut được reinstated |
| [ADR-011](ADR-011.md) | OpenTelemetry-first observability từ Phase 01 | Accepted | OTel SDK bootstrap mọi service, ship qua Collector → LGTM stack |
| [ADR-012](ADR-012.md) | Tách behavior logs khỏi operational logs | Accepted | Behavior events qua tracker SDK riêng, Kafka `icp.behavior.events`, sink Postgres+Vespa |
| [ADR-013](ADR-013.md) | Vespa partial-update cho behavioral signals | Accepted | Batch 5min aggregator + real-time path sau payment, partial-update API |
| [ADR-014](ADR-014.md) | Log message naming + Catalog registry | Accepted | Append-only `LOG_CATALOG.md` đăng ký mọi message name + behavior event type |
| [ADR-015](ADR-015.md) | Phase 00 Design System trước Phase 01 | Accepted | Phase 00 dedicated 3-5 ngày làm design tokens + component library + mockups trước |
| [ADR-016](ADR-016.md) | Brand: dark-first, violet + emerald + gold | Superseded | Superseded by ADR-020 + ADR-023 — dark theme bỏ, palette mới MoMo hồng-cam |
| [ADR-017](ADR-017.md) | OpenAPI codegen làm source of truth cho FE-BE contract | Accepted | Zod schemas SSOT, nestjs-zod bridge BE, openapi-typescript-codegen FE |
| [ADR-018](ADR-018.md) | TanStack Query + MSW cho FE data layer | Accepted | TanStack Query v5 cho mọi fetching (trừ SSE) + MSW mock cho Storybook/Playwright |
| [ADR-019](ADR-019.md) | SSE auth qua cookie httpOnly thay vì query string | Accepted | JWT trong cookie httpOnly secure SameSite=Lax, gateway verify cho REST + SSE |
| [ADR-020](ADR-020.md) | Mobile-first UI (supersedes ADR-016 dark theme) | Superseded | Partially Superseded by ADR-023 — viewport 390px giữ, palette Sky/Rose/Mango deprecated |
| [ADR-021](ADR-021.md) | One-screen all-in-one architecture cho 8 intents | Accepted | 1 main screen: chat thread + universal input + bottom sheet cart/payment + modal login |
| [ADR-022](ADR-022.md) | Phone frame wrapper cho desktop | Accepted | Desktop ≥1024px wrap mobile UI vào card 414px centered, giả lập phone frame |
| [ADR-023](ADR-023.md) | Design system v3 LOCKED: MoMo-Inspired Premium | Accepted | Palette Pink-600 dominant + Orange-500 accent + Amber/Rose gia vị, Be Vietnam Pro |
| [ADR-024](ADR-024.md) | Vespa Summary Fields Denormalization | Accepted | Mọi field hiển thị Product Card denormalize vào Vespa summary fields → 1 RTT |
| [ADR-025](ADR-025.md) | UI Field Audit Process | Accepted | Trước mockup intent mới phải audit visible elements vs `09_FIELD_AUDIT.md` |
| [ADR-031](ADR-031.md) | Thêm Google Trends như market-demand signal cho Intent 01 | Accepted | MCP tool `gtrends.interest_over_time` (mock fixture cho hackathon, prod = pytrends/SerpAPI) |
| [ADR-032](ADR-032.md) | Shopee price source: Postgres table + local seed worker | Superseded | Superseded by ADR-039 — schema giữ, data source từ seed worker chuyển sang real crawler |
| [ADR-033](ADR-033.md) | Component library: shadcn/ui + Tailwind CSS | Accepted | shadcn/ui (Radix + Tailwind CSS v3 copy-paste pattern) cho ownership styling 100% |
| [ADR-034](ADR-034.md) | Animation: Hybrid CSS-only + Framer Motion + canvas-confetti | Accepted | CSS keyframes ~80%, Framer Motion cho swipe/exit/layout, canvas-confetti cho success |
| [ADR-035](ADR-035.md) | State management: Zustand + TanStack Query + react-hook-form + Context + useState | Accepted | Phân chia rõ 5 tool theo loại state, Zustand cho cross-component high-frequency |
| [ADR-036](ADR-036.md) | Image embedding model + dimension | Locked | CLIP (ViT-B/32) 512 dim cho cả text/image, embeddings Vespa-only KHÔNG Postgres |
| [ADR-037](ADR-037.md) | Hackathon → Production pivot (umbrella) | Accepted | Pivot toàn dự án sang production SaaS; spawn ADR-038/039/040/041 |
| [ADR-038](ADR-038.md) | Payment: tích hợp thật VNPay + Momo (amended +ZaloPay) | Accepted | VNPay + Momo + ZaloPay online + COD/bank_transfer offline; SDK chính thức, payment-consumer worker |
| [ADR-039](ADR-039.md) | Shopee data source: real crawler (production) | Accepted | Worker `shopee-crawl` thật → bảng `shopee_prices`; có rủi ro ToS/pháp lý |
| [ADR-040](ADR-040.md) | Multi-tenant SaaS (tenant isolation) | Accepted | Mọi data thuộc 1 `tenant_id`; isolation ở DB (RLS) + cache + Vespa filter + Kafka header |
| [ADR-041](ADR-041.md) | Data privacy compliance: GDPR (EU) + Luật BVDLCN 2025 (VN) | Accepted | Consent + DSAR + retention + DPIA; KHÔNG log PII; tuân thủ song song GDPR + Luật 91/2025/QH15 |
| [ADR-042](ADR-042.md) | Tamper-evident audit log (hash-chain) | Accepted | Bảng `audit_log` per-tenant hash-chain (SHA256 prev_hash ‖ canonical_json), worker `audit-logger` |
| [ADR-043](ADR-043.md) | Per-tenant learn-to-rank / personalization | Accepted | Bảng `tenant_ranking_weights` + Vespa rank-profile `personalized` (inherits `ai_augmented`) |
| [ADR-044](ADR-044.md) | Per-tenant usage metering (billing SaaS) | Accepted | Bảng `usage_events` + rollup `usage_daily` per tenant; metrics ai_calls/searches/orders/storage_mb |
| [ADR-045](ADR-045.md) | Workflow v2 (dual-surface) + critical-path tenant-before-payment | Accepted | (a) Workflow v2 dual-surface + FACTS gate + Single Home; (b) P0 multi-tenant TRƯỚC payment |
| [ADR-046](ADR-046.md) | Tenant data model #2 — marketplace (users/sessions global) | Accepted | `users`/`sessions` global; merchant/staff qua `tenant_memberships`; mọi data khác tenant-scoped (RLS + app-level) |
| [ADR-047](ADR-047.md) | AI service trusts Gateway-forwarded identity (no JWT verify in AI/MCP) | Accepted | Gateway = perimeter; AI/MCP tin `X-User-Id` + `X-Tenant-Id`; enforce network isolation infra-level |

⚠️ **Gap:** ADR-026 … ADR-030 không tồn tại trong file gốc — không sinh số bù.
