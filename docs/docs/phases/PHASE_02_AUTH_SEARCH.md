# Phase 02 — Auth + Text Search

> **Duration:** Tuần 2  
> **Mục tiêu:** Intent 08 (login/logout) + Intent 03 (search by text) chạy end-to-end.

## Tại sao chọn 2 intents này trước

- Auth là tiền đề mọi intent khác (Idempotency middleware cần userId)
- Search by text là intent **đơn giản nhất** về AI side, không cần vision/voice → test được pipeline LangGraph + MCP + Vespa cơ bản

## Definition of Done

- [ ] User login qua `/auth/login`, nhận JWT, gọi `/auth/me` thành công
- [ ] Logout invalidate session
- [ ] Trên web có form login + chat box
- [ ] Customer gõ "nước tương dưới 50k" trong chat → return 5+ products kèm reason
- [ ] Vespa indexed 50 mock products với cả text embedding
- [ ] SSE stream hoạt động (status, products, final events)
- [ ] Idempotency middleware test pass với 2 lần POST cùng key

## Scope chi tiết

### A. Auth (Gateway only, không qua AI)

Files cần tạo:
```
apps/gateway/src/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  jwt.strategy.ts
  jwt-auth.guard.ts
  domain/
    user.entity.ts
    errors.ts
  application/
    login.use-case.ts
    login.use-case.spec.ts
    logout.use-case.ts
    refresh.use-case.ts
  infrastructure/
    postgres-user.repo.ts
    redis-session.store.ts
  dto/
    login.dto.ts
```

Yêu cầu:
- Bcrypt cost 10
- JWT HS256, secret từ env, exp 24h
- Refresh token: random UUID, lưu hash trong sessions table, exp 30d
- Logout: revoke session (DEL redis + UPDATE PG)
- Middleware: `JwtAuthGuard` extract user, gắn vào `req.user`

### B. Idempotency Middleware

Files:
```
apps/gateway/src/common/
  idempotency.middleware.ts
  idempotency.middleware.spec.ts
```

Apply globally cho mọi POST/PUT/PATCH/DELETE (skip cho `/auth/login` để không cache password attempts).

### C. AI Service — Intent Router + Search Subgraph

Files:
```
apps/ai/src/
  main.py             ← Flask app, /intent endpoint, SSE handler
  state.py            ← IcpState
  graphs/
    router_graph.py   ← classify intent, dispatch to subgraph
    intents/
      __init__.py
      searching_by_text.py
  tools/
    mcp_client.py
    llm_client.py     ← wrapper cho Gemini + GPT
  prompts/
    intent_classifier.txt
    parse_search_query.txt
```

`router_graph.py`:
- Node 1: `classify` — gọi LLM với prompt template, return intent + confidence
- Conditional edge: dispatch to subgraph theo intent
- Node END: format final response

`searching_by_text.py`:
- Node 1: `parse_filters` — LLM structured output → {category?, price_max?, attrs?}
- Node 2: `embed_query` — gọi `text.embed` MCP tool
- Node 3: `hybrid_search` — gọi `vespa.hybrid_search`
- Node END: yield SSE events

### D. MCP Tools Phase 02

Thêm mới:
- `text.embed` (gọi Gemini text-embedding-004 hoặc tương đương)
- `vespa.hybrid_search`
- `vespa.index` (cho seed script)

### E. Web — Chat Screen Skeleton (RÁP từ Phase 00 components)

Tận dụng component library đã build ở Phase 00. Phase 02 chỉ:
- Wire `LoginForm` (đã có) vào auth flow thật
- Wire `ChatInput` + `ChatMessage` (đã có) vào SSE thật
- Connect `ProductGrid` + `ProductCard` (đã có) vào search results

Files:
```
apps/web/src/
  app/
    page.tsx              ← Main screen (đã có shell từ P00, wire data)
    auth/
      login/page.tsx      ← Wire LoginForm
  features/               ← (Phase 02 thêm)
    auth/
      use-login.ts        ← TanStack mutation gọi api.auth.login
      auth-context.tsx
    search/
      use-search-stream.ts ← SSE hook
```

**KHÔNG được tạo UI component mới ở đây** — nếu cần component thiếu, push back về Phase 00 doc, update, sau đó dùng.

Yêu cầu UX:
- Trang index: nếu chưa login → redirect `/auth/login`
- Sau login: chat box ready, gõ message → POST /intent (text), connect SSE, render products khi nhận event `products`
- StatusPill (P00 component) show streaming phase
- TraceId (P00 component) hiển thị trace ID nhỏ ở footer message

### F. Vespa Init

Script `scripts/vespa-init.sh`:
1. Deploy schema package từ `infra/vespa/`
2. Wait for ready
3. Sau seed script: bulk-feed 50 products kèm embedding (embedding generate by MCP tool `text.embed`)

### G. Behavior Tracker — Skeleton

Phase này dựng infrastructure cho behavior events. Events sẽ start flowing từ Phase 03+.

Files:
```
apps/gateway/src/tracking/
  tracking.controller.ts        ← POST /api/v1/track (batch)
  tracking.service.ts
  behavior-event.dto.ts         ← zod schema per event_type
  behavior-event.validator.ts

apps/workers/src/
  behavior-pg-sink.ts           ← consume icp.behavior.events → INSERT behavior_events
```

Yêu cầu:
- `POST /api/v1/track` nhận batch tối đa 100 events, validate từng cái theo zod schema (tự sinh từ `PropertiesMap` TypeScript types ở `packages/shared-types/src/behavior.ts`)
- Enrich `received_at`, `ip_hash` (SHA256 + daily salt), drop bot user agents
- Kafka producer publish vào `icp.behavior.events`
- Worker consume → INSERT vào partition `behavior_events_yYYYYmMM`
- Drop event vô lệ → emit metric `icp.behavior.dropped{reason}`

Phase 02 chỉ track 3 events đầu:
- `session.started` (page load)
- `auth.signed_in` (server-side sau login)
- `search.performed` (server-side sau search response)

### H. Observability Tasks Phase 02

Mỗi feature trong phase phải có instrumentation đi kèm. KHÔNG để dồn xuống Phase 06:

- [ ] **Logs:** Login flow log `auth.login_succeeded` / `auth.login_failed` với schema ở `06_OBSERVABILITY.md` section 4
- [ ] **Logs:** Search flow log `intent.received` → `intent.classified` → `vespa.search_completed`
- [ ] **Metrics:** Counter `icp.intent.requests{intent, modality, status}` + histogram `icp.intent.duration{intent}`
- [ ] **Metrics:** Counter `icp.behavior.events_received{event_type}` + `icp.behavior.dropped{reason}`
- [ ] **Traces:** Span trace login đi qua gateway → MCP (`auth.verify_jwt`)
- [ ] **Traces:** Span trace search đi qua gateway → ai → mcp → vespa, đảm bảo cùng `trace_id`
- [ ] **Catalog:** Cập nhật `LOG_CATALOG.md` nếu thêm message/event mới
- [ ] **Grafana:** Tạo 1 dashboard nháp "Intent Performance" hiển thị `icp.intent.duration` p50/p95 theo intent

## Tasks ordering

### Day 1 — Auth backend
- Migrations đã có (Phase 01), wire repo
- LoginUseCase, JWT issuance, middleware
- Logger emit `auth.login_*` events với schema chuẩn
- Unit tests: 3 happy + 3 error
- Smoke: curl `/auth/login` → JWT, verify log xuất hiện trong Loki

### Day 2 — Auth frontend + Tracker SDK init
- Login form, AuthContext, persist token in httpOnly cookie (Set-Cookie từ gateway)
- Logout flow
- Protected route wrapping
- Tracker SDK gọi `session.started` khi page load, `auth.signed_in` (server-side log từ login handler)
- Verify trên Grafana: `behavior_events` table có rows mới

### Day 3 — Idempotency middleware + /track endpoint
- Idempotency: Implement + test (Redis SETNX, cache, lock conflict scenario), log `idempotency.*` events
- `POST /track` endpoint, zod validation per event_type
- `behavior-pg-sink` worker

### Day 4 — MCP tools cho search
- `text.embed` — wrapper Gemini embedding API, span + log `llm.generated`
- `vespa.hybrid_search` — POST to Vespa /search/, build YQL, span + log `vespa.search_completed`
- `vespa.index` — POST to Vespa /document/v1/

### Day 5 — Seed + index
- Seed script chạy: insert products vào PG, generate embedding, index vào Vespa
- Verify: query Vespa trực tiếp `curl /search/?yql=...`

### Day 6 — AI service search graph
- LangGraph router với 1 intent, mỗi node là 1 span
- SSE streaming
- Gateway proxies SSE từ AI service xuống client
- Server-side emit `search.performed` behavior event sau khi response gửi xong

### Day 7 — Web chat + smoke test
- Chat box UI
- Search e2e: login → gõ query → thấy products
- Demo internal

## Test scenarios

| ID | Scenario | Expected |
|---|---|---|
| AUTH-01 | Login with valid creds | 200 + JWT |
| AUTH-02 | Login wrong password | 401 |
| AUTH-03 | Use JWT to call /auth/me | 200 + user |
| AUTH-04 | Logout then reuse JWT | 401 |
| IDEM-01 | POST 2 lần same key in 5s | Same response |
| IDEM-02 | POST 2 lần concurrent same key | 1 thành công, 1 conflict 409 |
| SEARCH-01 | Query "nước tương" | >=5 products from category "nuoc_tuong" |
| SEARCH-02 | Query "X dưới 50k" | All results price <= 50000 |
| SEARCH-03 | Query nonsense "asdfgh" | 0 results, return helpful message |

## Public interfaces sẵn cho Phase 03

- Authenticated REST `/api/v1/*` (Bearer + Idempotency-Key)
- SSE protocol working
- MCP tools: text.embed, vespa.hybrid_search, vespa.index, auth.verify_jwt
- AI service `/intent` endpoint, router pattern thành hình
- Vespa schema deployed

## Câu hỏi pre-start

- [ ] Refresh token strategy: rotating hay long-lived single? (đề xuất rotating)
- [ ] JWT verify ở AI service không? (đề xuất KHÔNG, gateway verify rồi pass userId)

---

## Khi xong Phase 02

Tạo `PHASE_02_HANDOFF.md`. Phase 03 sẽ build trên auth + intent router.
