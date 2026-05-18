# Phase XX — Handoff (TEMPLATE)

> Copy file này thành `PHASE_XX_HANDOFF.md` sau khi xong mỗi phase, AI agent điền vào.
> Mục đích: phase sau load file này thay vì cả source code → tiết kiệm context.

## Phase summary
- **Phase:** XX
- **Duration thực tế:** X ngày
- **Status:** ✅ Done | ⚠️ Partial | ❌ Failed
- **Date:** YYYY-MM-DD

## Đã làm được
- [x] Feature 1: ...
- [x] Feature 2: ...
- [ ] Feature 3 (deferred to Phase YY)

## File / folder đã tạo

```
apps/gateway/src/auth/
  ├── auth.module.ts
  ├── auth.controller.ts
  └── application/
       └── login.use-case.ts
apps/ai/src/graphs/intents/
  └── importing_by_images.py
infra/migrations/
  └── V002__add_policies.sql
```

## Public interfaces exposed

### REST endpoints
- `POST /api/v1/auth/login` — body LoginDto → AuthTokens
- `GET /api/v1/products` — ...

### MCP tools added
- `auth.verify_jwt(token) → {user_id, role} | null`
- `text.embed(text) → {vector: float[768]}`

### Events added (Kafka topics & schemas)
- Topic `icp.users.activity`: `UserLoggedIn`, `UserLoggedOut`
- Topic `icp.products.events`: `ProductDraftSubmitted`

### Shared types added (packages/shared-types)
- `Product`, `ProductCreateDTO`
- `EventEnvelope<T, P>`
- ...

### Database changes
- New tables: users, sessions, products
- New indexes: idx_users_email, ...
- Seed data: 50 products in `infra/seed/products.json`

## Decisions phát sinh trong phase (đã append vào DECISIONS.md)

- **ADR-XXX** — Choose pg native driver over TypeORM
- **ADR-YYY** — Use Gemini text-embedding-004 for text embeddings (768-d)

## Bugs / nợ kỹ thuật
- ⚠️ `vespa.hybrid_search` chưa apply trend_score rerank (hardcoded 0)
- ⚠️ JWT refresh chưa rotate (still long-lived)
- ⚠️ Test coverage 45% (mục tiêu 60%)

## Cần lưu ý cho Phase tiếp theo
- Phase XX+1 sẽ extend `IcpState` thêm fields {voice_text, audio_blob}, đừng break compatibility
- Vespa schema chưa có `image_embedding` indexed bulk — Phase 05 sẽ làm backfill
- AuthGuard expect `req.user.id`, tất cả phase sau phải dùng `req.user.id` chứ không phải `req.userId`

## Câu hỏi mở (cần human quyết định trước Phase tiếp)
- [ ] Có nên thêm rate limiting trước Phase 04 (payment endpoints)?
- [ ] Có cần OpenTelemetry không?

## Khi load phase XX+1, AI chỉ cần thêm file này

Cùng với `00_CONTEXT.md` và `PHASE_(XX+1).md`, file handoff này thay thế cho việc đọc source code phase trước.
