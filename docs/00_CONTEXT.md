# ICP — Project Context (v3.0)

> **Workflow v2 (ADR-045) — Single Home pointers.**
> Hiện trạng → `docs/FACTS.md` · Status → `docs/MASTER_BACKLOG.md` · Quyết định →
> `docs/decisions/` (xem `INDEX.md`) · Luật thực thi + DoD + coding conventions →
> `CLAUDE.md` · Registry log/event → `docs/LOG_CATALOG.md`.
> File này = **hiến pháp + bản đồ kiến trúc**, trỏ về nhà nào có fact gì (§4).
> KHÔNG lưu hiện trạng/status/version — đó là drift.

## §1 Identity & Mục tiêu Production

**Tên:** ICP — Intelligent Commerce Platform.
**Bản chất:** SaaS multi-tenant phục vụ chủ shop VN — 1 màn hình all-in-one,
nhập hàng / mua / phân tích bằng voice + image + text qua 8 intent AI.
**Đường đến go-live (ADR-045 + BACKLOG §1 Direction):** tenant (V011) → payment
(V011 ALTER) → compliance GDPR + Luật BVDLCN 2025 → auth hardening → DR → alerting.
**KHÔNG còn là demo hackathon** (ADR-037 pivot).
**Stack:** Next.js · NestJS · Flask + LangGraph (Python) · MCP server (Python) ·
Vespa · Postgres · Redis (RedisJSON) · Kafka Redpanda (dev) / managed (prod —
CHƯA WIRE). Version mọi cấp = PULL `package.json` / `pyproject.toml` /
`infra/docker-compose*.yml` — KHÔNG ghi tay ở đây (version drift là chắc, bao gồm
major).
**Vendor LLM (ADR-005 + Cập nhật triển khai):** text/reasoning Gemini Flash
primary → fallback OpenAI gpt-4o-mini · vision Gemini · speech STT/TTS OpenAI.

## §2 Bản đồ kiến trúc (4 service + data flow + SSE)

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Web (apps/web)                                     │
│  · 1 màn hình all-in-one (chat thread + universal input +   │
│    bottom sheet cart/payment + 4-tab bottom nav)            │
│  · SSE consumer (EventSource, cookie httpOnly auth)         │
│  · TanStack Query cho REST (CẤM raw fetch — CLAUDE.md §11)  │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST/JSON + SSE (cookie auth, ADR-019)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  NestJS Gateway (apps/gateway)                              │
│  · Auth JWT HS256 + Tenant resolve (V011, ADR-040)          │
│  · IdempotencyMiddleware (Redis SETNX 30s + cache 24h,      │
│    ADR-004), áp per-route mutating                          │
│  · SSE proxy: manual res.write — KHÔNG dùng Nest            │
│    @Sse/Observable; forward Redis pub/sub `sse:pubsub:{rid}`│
│  · Rate limiting per tenant + user (BACKLOG §3 P0 #5)       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal HTTP/JSON
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  AI Service (apps/ai) — Flask + LangGraph (ADR-007)         │
│  · Intent classifier + dispatch tới subgraph                │
│  · 6 subgraph: importing/buying/searching/recommend/cart/   │
│    analyzing. Intent 06 paying + 08 auth: KHÔNG graph       │
│    (Gateway + workers)                                      │
│  · graph.astream(...) → yield SSE → publish Redis pub/sub   │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP protocol (JSON-RPC 2.0, stdio/HTTP)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Server (apps/mcp) — Single I/O gateway (ADR-003)       │
│  · Tool registry — Postgres + Vespa + Redis + Gemini/OpenAI │
│    + Shopee fixture + Google Trends                         │
│  · LangGraph CẤM gọi trực tiếp DB/Vespa/external            │
│  · Outbox WRITE (ADR-006): same-txn events row              │
│    (published_at=NULL); relay→Kafka pending (BACKLOG #11)   │
└─────────────────────────────────────────────────────────────┘

  Kafka topic `icp.*` ── CHƯA WIRE ──► Workers (apps/workers)
    Planned (BACKLOG §3 P1 #12): card-generator · payment-consumer ·
    inventory-consumer · notification-consumer · behavior-aggregator ·
    outbox-relay · audit-logger · shopee-crawl.
    Hiện tại: chỉ skeleton (`index.ts` docstring + `shopee-mock-seed-worker.ts`).
```

**Data flow chính (event sourcing lite + outbox, ADR-006):**
1. Use case ghi business row + events row (`published_at=NULL`) trong cùng txn.
2. Outbox-relay worker đọc events chưa published → publish Kafka → set `published_at` (CHƯA CODE).
3. Consumer (worker) ack → apply policy → tạo ActionCard hoặc publish derived event.
4. Action card pipeline hiện chạy **inline trong graph** `importing_by_images.py:751` (gọi `mcp_client.call("cards.create", ...)`), không qua worker — chuyển sang `card-generator` worker khi Kafka wire.

**SSE flow (cookie auth ADR-019):**
1. FE `POST /api/v1/intent` (idempotent, cookie auth) → Gateway dispatch sang AI service.
2. AI `graph.astream(...)` → publish payload JSON vào Redis pub/sub `sse:pubsub:{rid}`.
3. FE mở `GET /api/v1/intent/stream?id={rid}` (EventSource) → Gateway subscribe Redis → forward `res.write(...)` vào SSE stream.
4. 31 SSE event type — source duy nhất = `packages/shared-types/src/sse/intent-stream.ts` (Zod). KHÔNG chép catalog vào docs (mầm drift).

**Service boundary — ai sở hữu gì:**

| Concern | Owner |
|---|---|
| JWT verify · tenant resolve · idempotency · rate limit · SSE proxy | Gateway |
| Intent classification · multi-tool orchestration · LLM call | AI Service |
| DB write (Products/Orders/Events/Cards) · Vespa index · Gemini/OpenAI/Shopee call · outbox WRITE | MCP server |
| Payment init (VNPay/Momo/ZaloPay) | Gateway (ADR-038) |
| Payment callback/IPN verify + reconcile | `payment-consumer` worker (CHƯA CODE) |
| Audit hash-chain (cross-topic) | `audit-logger` worker (CHƯA CODE, ADR-042) |
| Outbox relay (events → Kafka) | `outbox-relay` worker (CHƯA CODE) |
| Behavior aggregation → Vespa signals / matview refresh | `behavior-aggregator` (CHƯA CODE) |
| Shopee price crawl → `shopee_prices` | `shopee-crawl` worker (CHƯA CODE, ADR-039) |
| Tenant isolation (RLS + scope mọi query) | All services (V011, ADR-040 + ADR-046) |
| Data privacy (consent/retention/DSAR), no-PII-log | Gateway + dedicated handlers (ADR-041) |

## §3 Pillars / Nguyên tắc bất biến (LOCKED)

1. **Clean Architecture (target)** — 3 lớp `domain` / `application` / `infrastructure`; domain không import infra. Áp DẦN khi module phức tạp (CLAUDE.md §11).
2. **Event Sourcing lite + Outbox** — bảng `events` append-only, same-txn outbox write (ADR-006). Audit + driver cho action cards.
3. **Choreography (no orchestrator)** — consumers tự subscribe Kafka topic + react (ADR-002). Hiện Kafka chưa wire → outbox + Redis pub/sub SSE thay thế (BACKLOG #10/#11).
4. **Idempotency** — mọi mutating endpoint nhận `Idempotency-Key` (UUID v4) → Redis SETNX lock 30s + response cache 24h (ADR-004).
5. **MCP-first tool calling** — mọi I/O của AI service đi qua MCP (ADR-003). CẤM LangGraph gọi trực tiếp Postgres/Vespa/external.
6. **OpenTelemetry-first** — mọi service emit OTel logs/metrics/traces → Collector → LGTM (ADR-011). Schema + registry: CLAUDE.md §11 Observability + `docs/LOG_CATALOG.md`.
7. **Behavior tracking tách ops log** — user events qua tracker SDK → `POST /api/v1/track` → Postgres `behavior_events` (Kafka + Vespa signals + matview = target qua aggregator, BACKLOG #12). Strict Zod schema per event_type, 100% capture (ADR-012).
8. **Contract-first FE↔BE** — Zod schemas ở `packages/shared-types/` = SOT. NestJS auto-OpenAPI; `pnpm openapi:sync` BẮT BUỘC sau đổi DTO; CI drift gate (ADR-017).
9. **Design system LOCKED — mobile-first MoMo Premium** — viewport 390px, 1 màn hình all-in-one, phone-frame wrap desktop. Palette Pink-600 `#E91E63` + Orange-500 `#F97316` (ADR-023). CẤM hardcode color/font.
10. **Multi-tenant + GDPR compliance** — SaaS model #2 marketplace: `users`/`sessions` global; mọi data khác tenant-scoped, RLS + scope app-level (ADR-040 + ADR-046). GDPR + Luật BVDLCN 2025 (Luật 91/2025/QH15 + NĐ 356/2025): consent gating trước tracking, DSAR, retention (ADR-041). KHÔNG log PII trừ định danh tối thiểu (`user_id`/`tenant_id`).

**Critical constraints cho AI code:** xem CLAUDE.md §4 STOP CONDITIONS + §5 DoD +
§11 Coding conventions. 5 cấm đặc biệt cho ICP (bổ sung CLAUDE.md):
(a) CẤM bypass MCP từ LangGraph;
(b) CẤM hard-code business rules — phải qua bảng `policies` (DSL);
(c) CẤM track behavior event mới chưa có Zod ở `packages/shared-types/src/behavior/catalog.ts`;
(d) CẤM vẽ UI element chưa audit field theo quy trình ADR-025;
(e) MỌI query data path scope theo `tenant_id` sau V011 (CLAUDE.md DoD §5 đã ghi).

## §4 Cấu trúc repo + Bản đồ docs (Single Home mở rộng)

**Repo layout (verified live):**

```
icp/
  CLAUDE.md                    ← luật thực thi (Workflow v2, đọc đầu mọi task)
  scripts/gen-facts.sh         ← máy sinh FACTS
  docs/                        ← hiến pháp + bản đồ + status + ADR
  apps/{web,gateway,ai,mcp,workers}   ← 4 service + workers (skeleton)
  packages/shared-types/       ← Zod SOT + generated OpenAPI client (`src/api/`)
  infra/{docker-compose*.yml,otel/,vespa/schemas/,migrations/,seed/}
  .github/workflows/guards.yml ← facts-drift + commit-lint CI gate
```

**Single Home — ai là nhà của fact gì (CLAUDE.md §9 mở rộng):**

| Fact | Nhà | Sửa thế nào |
|---|---|---|
| Identity + kiến trúc bất biến + bản đồ docs | `docs/00_CONTEXT.md` (file này) | Tay, có ADR mới |
| Hiện trạng code/DB (route/bảng/tool/version) | `docs/FACTS.md` | KHÔNG tay — chỉ `bash scripts/gen-facts.sh` |
| Status + queue P0/P1/P2 + slice registry + done | `docs/MASTER_BACKLOG.md` | Tay, đóng task |
| Quyết định + lý do | `docs/decisions/ADR-*.md` + `INDEX.md` | Append-only, KHÔNG chứa status |
| Luật thực thi + DoD + coding conventions | `CLAUDE.md` | Tay, có ADR mới |
| Registry log message + behavior event | `docs/LOG_CATALOG.md` | Append TRƯỚC khi emit (CLAUDE.md DoD §5) |
| Contract (OpenAPI + types) | `packages/shared-types/openapi.json` + `src/api/` | Máy sinh `pnpm openapi:sync` |
| Tri thức triển khai (code hoạt động ra sao) | CODE | PULL khi cần (CLAUDE.md §3) |
| Fossil docs v1 | `docs/archive-v1/` (`README.md` map) | Read-only, T08 normalize references |

## §5 Glossary (chỉ thuật ngữ cần)

- **Tenant** — 1 shop trên SaaS (model #2 marketplace, ADR-046); data tenant-scoped theo `tenant_id`. `users`/`sessions` là account global.
- **Tenant membership** — quan hệ user↔tenant cho merchant/staff (RBAC); bảng `tenant_memberships`. Customer global KHÔNG có membership.
- **Audit log (hash-chain)** — bảng `audit_log` tamper-evident: `prev_hash`+`hash` SHA256 chain per-tenant (ADR-042).
- **Per-tenant LTR** — ranking riêng từng shop qua `tenant_ranking_weights` + Vespa rank-profile `personalized` (ADR-043).
- **Usage metering** — đo mức dùng per-tenant cho billing SaaS (ADR-044).
- **Domain Event** — fact đã xảy ra (immutable), lưu `events` table + publish Kafka (vd `OrderPlaced`).
- **Behavior Event** — user action client-side (click/view/dismiss), lưu `behavior_events`. KHÁC domain event. Drive recommendation/LTR.
- **Operational Log** — diagnostic record (info/warn/error), structured JSON, qua OTel → Loki. KHÔNG drive logic.
- **Action Card** — gợi ý hành động AI sinh ra cho user quyết định; status: pending|accepted|rejected|expired.
- **Policy** — rule DSL trong DB (JSON), map event type → action template.
- **Intent** — phân loại ý định người dùng, 1 trong 8 enum (xem §6).
- **MCP tool** — function expose qua MCP protocol (JSON-RPC 2.0), LangGraph gọi để I/O.
- **Choreography** — pattern multi-service phối hợp qua events, không có central coordinator (ADR-002).
- **PII / DPIA** — dữ liệu cá nhân / Data Protection Impact Assessment (GDPR + Luật BVDLCN 2025).
- **PULL / RECON** — chế độ ĐỌC-ONLY tra cứu code (CLAUDE.md §3). RECON = khảo sát slice; PULL = câu hỏi đơn lẻ.

## §6 8 Intents (LOCKED enum)

| ID | Intent (enum value) | Modality | Graph file (`apps/ai/src/graphs/intents/`) |
|---|---|---|---|
| 01 | `importing_products_by_images` | image | `importing_by_images.py` |
| 02 | `buying_products_by_voices` | voice | `buying_by_voices.py` |
| 03 | `searching_products_by_text` | text | `searching_by_text.py` |
| 04 | `recommendation_products_by_images` | image | `recommend_by_images.py` |
| 05 | `viewing_cart_products_by_text` | text | `cart_by_text.py` |
| 06 | `paying_order_products_by_text` | text | (KHÔNG graph — Gateway + workers) |
| 07 | `analyzing_by_voices` | voice | `analyzing_by_voices.py` |
| 08 | `login_logout_by_text` | text | (KHÔNG graph — Gateway auth controller) |

Giá trị enum LOCKED. Tên file graph có thể rút gọn (vd `importing_by_images.py`)
nhưng `intent.type` enum phải đúng cột "Intent".

---

**END.** File này = hiến pháp + bản đồ. Thay đổi = quyết định lớn → ADR mới.
