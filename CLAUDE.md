# ICP — Luật cho Claude Code (đọc trước MỌI task)

> Workflow gốc: `docs/ICP_WORKFLOW_V2.md` · Thao tác: `docs/ICP_PLAYBOOK_V2.md`.
> File này là bản rút gọn THỰC THI — khi mâu thuẫn, WORKFLOW thắng.

## 1. Định hướng
- Slice đang active: `docs/slices/S-*.md` — ĐỌC TRƯỚC khi code bất kỳ task nào.
- Mọi việc thuộc về một slice. Không có commit "vô danh".

## 2. Nghi thức MỞ TASK (bắt buộc, trước dòng code đầu tiên)
1. `git log --oneline -20` — xem các task/slice gần nhất.
2. Đọc diff các task trước trong cùng slice (nếu có).
3. Đọc lại section Acceptance + Stop Conditions của slice file.
> "Đã có gì" = REPO tại giây này. Không phải doc. Không phải trí nhớ.

## 3. Sự thật
- CẤM tin docs về hiện trạng code. Grep/đọc code trước khi khẳng định bất kỳ điều gì.
- Khi nhận lệnh `📥 PULL` / `📥 RECON`: chế độ ĐỌC-ONLY, trả lời kèm path cho mỗi ý,
  không tìm thấy → nói "KHÔNG TÌM THẤY", cấm đoán, cấm sửa file.

## 4. STOP CONDITIONS — dừng và báo human khi cần:
- Đổi DB schema ngoài scope task đang làm
- Thêm dependency mới chưa approve
- Đổi CONTRACT hoặc BEHAVIOR của code dùng chung (file nhiều slice cùng đụng)
  — thêm-trong-khuôn (event type mới, log entry mới, route theo pattern sẵn) thì OK
- Đổi pattern đã LOCKED trong ADR (`docs/decisions/`)

## 5. DoD mọi task (mục nào N/A phải ghi rõ lý do trong report)
- [ ] Test NHÚNG trong task: unit cho logic + ≥1 integration cho luồng (không có "task test riêng")
- [ ] Timeout cho mọi I/O ngoài; retry/circuit-breaker nơi gọi payment/Vespa/LLM
- [ ] OTel span + log đúng `docs/LOG_CATALOG.md` (phát sinh entry mới → thêm vào catalog)
- [ ] Không log PII; secret qua env; validate input
- [ ] Idempotency nơi side-effect lặp được (IPN, webhook, consumer)
- [ ] Migration: forward-only, số kế tiếp theo FACTS, kèm rollback note trong commit body
- [ ] Sau V011: mọi query data path có tenant scope (RLS/tenant_id) + isolation test
- [ ] Task đổi bề mặt FACTS (migration/route/graph/MCP tool/page/test) → `bash scripts/gen-facts.sh` + commit `docs/FACTS.md` trong CÙNG squash commit (guard facts-drift chạy mỗi push, không chỉ lúc đóng slice)

## 6. COMMIT
- Trong task: commit nháp tuỳ ý. ĐÓNG TASK: **squash về đúng 1 commit**.
- Format (commit-lint enforce):
  - `S-XX/T0N: <làm gì, 1 dòng>` — body: quyết định ngầm · ADR ref · `breaking: KHÔNG|CÓ + lý do`
  - `S-XX/HOTFIX-NN: <triệu chứng> — <nguyên nhân gốc>`
  - `S-XX/REFACTOR-NN: <phạm vi> — behavior KHÔNG đổi`
  - `META: <docs|workflow|facts|ci>: <gì>`
- Comment tại chỗ cho quyết định KHÔNG hiển nhiên từ code
  (vd `// total tính lại mỗi lần, KHÔNG cache — giá realtime, ADR-0XX`).

## 7. ĐÓNG TASK — report bắt buộc, đúng format:
```
### REPORT S-XX/T0N
Files changed: <list>
Commands run + output chính: <build/test>
Tests: <pass/fail, tên test mới>
DoD: <từng mục ✓ hoặc N/A+lý do>
Known issues: <tự khai, kể cả nghi ngờ>
Đề xuất commit message: <theo format §6>
```

## 8. ĐÓNG SLICE (khi human xác nhận task cuối xong)
1. `bash scripts/gen-facts.sh` → FACTS.md mới
2. Sửa `docs/MASTER_BACKLOG.md`: 1 dòng status (+1 dòng episode nếu HOTFIX/REFACTOR)
3. Quyết định lớn phát sinh → draft ADR vào `docs/decisions/` + cập nhật `INDEX.md`
4. `mv docs/slices/S-XX.md docs/slices/archive/`
5. Commit `META: close S-XX` — nhắc human sync Project knowledge (FACTS + BACKLOG)

## 9. Single Home — sửa đúng nhà, cấm sửa nhà máy sinh
| Fact | Nhà | Được sửa? |
|---|---|---|
| Status/episode | `docs/MASTER_BACKLOG.md` | ✔ (Pha C) |
| Hiện trạng code/DB | `docs/FACTS.md` | ✖ tay — chỉ gen-facts.sh |
| Quyết định + lý do | `docs/decisions/ADR-*.md` | ✔ append-only, KHÔNG chứa status |
| Contract | `docs/contracts/` + openapi pipeline | ✖ tay — chỉ codegen |
| Tri thức triển khai | CODE | ✔ — và đây là nhà duy nhất của nó |

## 10. Lệnh thường dùng
- Facts: `bash scripts/gen-facts.sh`
- Test: `<điền lệnh test của repo>`  · Migrate: `<điền>`  · OpenAPI sync: `<điền — npm run openapi:sync>`

## 11. Coding conventions (nén từ 05_CODING_CONVENTIONS — code thắng khi lệch)

### TypeScript
- ESLint+Prettier. KHÔNG `any` → `unknown` rồi narrow. KHÔNG default export (trừ Next.js page/component). Function >50 dòng → tách. Async/await, KHÔNG Promise chain.
- Imports: node built-ins → external → internal alias (`@icp/...`) → relative.
- DTO: NestJS `class-validator`; Python `Pydantic` (không dataclass cho payload).
- Logging: TS Pino JSON; Python structlog. CẤM `console.log` trong production code.

### Python (apps/ai, apps/mcp)
- Black line 100 · isort · ruff. Type hints bắt buộc cho public functions.
- Layout AI: `apps/ai/src/{main,state}.py + graphs/{router_graph,intents}/ + tools/{mcp_client,llm_client,redis_publisher}.py + observability/ + prompts/`. KHÔNG `config.py`/`exceptions.py`.

### Module structure (NestJS)
- Clean-arch 3 lớp (`application/`,`domain/`,`infrastructure/`,`dto/`) áp DẦN khi module phức tạp. Hiện: `auth/` đủ 3 lớp; `products/`,`cards/` phẳng KHÔNG subdir; `cart/`,`dashboard/`,`intent/`,`tracking/` phẳng có `dto/`. Module hạ tầng (`clients/`,`config/`,`database/`,`health/`,`idempotency/`,`observability/`) luôn phẳng.

### Errors
- Use-case ném domain error có `code`; transport map HTTP. Pattern per-module — auth: `AuthDomainError` base + subclass; products: NestJS `*Exception` trực tiếp. KHÔNG yêu cầu base class cross-service.

### Testing
- TS: **Vitest** (`*.spec.ts` cạnh source) — KHÔNG Jest (chỉ matcher `@testing-library/jest-dom` xuất hiện). Coverage target ≥70% tổng, ≥80% `domain`/`application`.
- Python: pytest (`tests/test_*.py`), mock LLM (không call thật), integration 1 happy path / intent.
- Test name: `it('<verb-phrase>...')`.

### Config
- Mọi config qua env vars. `.env.example` checked-in, `.env` gitignored.
- Gateway: **fail-fast** qua Zod `EnvSchema` (`apps/gateway/src/config/env.schema.ts`).
- AI Python: `os.getenv(KEY, DEFAULT)` per-need — KHÔNG fail-fast (chấp nhận hiện tại).

### Comments
- JSDoc/docstring cho public API: what + why.
- Inline chỉ khi business rule KHÔNG obvious từ code.
- TODO: `// TODO(name, YYYY-MM-DD): <description>`.
- Mỗi service: `apps/<x>/README.md` (how to run + env + key endpoints).

### Shared types / codegen
- OpenAPI do Gateway sinh là source of truth (`@nestjs/swagger`, lệnh `pnpm openapi:sync`). TS: import `@icp/shared-types`. Behavior schemas: Zod tại `packages/shared-types/src/behavior/*` (`discriminatedUnion('event_type')`).
- Đổi DTO → `pnpm openapi:sync` BẮT BUỘC trước commit; CI gate drift (`git diff --exit-code packages/shared-types/openapi.json packages/shared-types/src/api/`).
- FE: CẤM raw `fetch` cho REST endpoint — dùng generated services từ `@icp/shared-types/api` (wrap TanStack Query). Streaming/SSE qua `apps/web/lib/sse-client.ts` (`EventSource`) là ngoại lệ duy nhất.
- API URL versioned `/api/v1/...`. Field rename/remove = breaking → 2-phase (parallel field → FE migrate → remove old).

### Async / streaming
- SSE:
  - Gateway: **manual** `res.setHeader('Content-Type','text/event-stream')` + `res.write(...)`, forward từ Redis pub/sub `sse:pubsub:{rid}`. KHÔNG Nest `Observable`/`@Sse`.
  - AI: `graph.astream(...)` + generator `yield`.
  - FE: native `EventSource` (`withCredentials: true`). KHÔNG `fetch` streaming.
- DB connection pool: max **10**/service.

### Security baseline
- bcryptjs **cost 10** cho password.
- JWT **HS256** (sign + verify ép `algorithms:['HS256']`). `JWT_SECRET` ≥32 chars. exp env-driven (`JWT_ACCESS_TTL_HOURS`/`JWT_REFRESH_TTL_DAYS`).
- CORS: allow origin cụ thể qua `CORS_ORIGIN`. KHÔNG `*`.
- Upload: ảnh base64 inline trong field `content`. Size 2 lớp: transport `useBodyParser('json', { limit: '10mb' })` + Zod `content.max(10_000_000)`. (MIME server-side cho image: chưa validate — xem BACKLOG §3 P0 #8.)
- Pino redact paths: `password`/`*.password`, `authorization`/`*.authorization`, `token`/`*.token`, `access_token`, `refresh_token`, `jwt` (giữ `jti`). PII rộng (email/phone/name) chưa enforce — xem BACKLOG §3 P1 #21.

### Observability (logs / traces / behavior)
- Log fields LOCKED mọi entry: `timestamp` (ISO8601 UTC), `level`, `service`, `trace_id`, `span_id`, `message`. Optional: `request_id`, `user_id`, `tenant_id` (V011), `intent`, `phase`, `duration_ms`, `ok`, `error_code`, `error_message`, `extras`. CẤM free-form (`User ${x} did...`).
- Log levels — ⚠️ enum khác nhau: Node Pino `trace/debug/info/warn/error/fatal` vs Python structlog `debug/info/warning/error/critical`. Khi query Loki → handle cả 2 (đồng bộ enum = BACKLOG §3 P2 #29).
- Span naming: `<layer>.<component>.<operation>`. Mọi span gắn `service.name/version` (Resource); `user.id`, `intent.type`, `request.id` khi có; `tenant.id` sau V011.
- Behavior events: emit qua tracker SDK (`packages/shared-types/src/behavior/tracker.ts`) → `POST /api/v1/track` (batch). 100% capture, KHÔNG sample. CẤM trộn vào ops log. Schema strict Zod per event_type → invalid event = drop + ops log `tracker.event_dropped.reason`. Rename schema = bump version `event.v2`.
- Mọi message name + event_type phải đăng ký `docs/LOG_CATALOG.md` (DoD §5) TRƯỚC khi emit.

### Performance budget (SLO target — chưa đo)
- API p95 < **500ms** (non-AI); AI first SSE < **1s**, full response < **8s**.
- FE bundle: < **500KB** gz/route. DB: index mọi field query, KHÔNG N+1.

### File naming
- TS: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.use-case.ts`, `*.entity.ts`, `*.dto.ts`, `*.spec.ts`. Adapter Postgres: `postgres-*.repo.ts` (auth dùng `.store.ts` — historical, OK).
- Python: `snake_case.py`; test `tests/test_*.py`.
- Next.js: `app/.../page.tsx`, `components/*.tsx`.

## 12. Nhận khối RECON/PULL từ Web (workflow v2 R2/R7)
- **Nhận diện**: input chứa "RECON" hoặc "PULL" + danh sách mục đánh số / gạch đầu dòng đọc-only về repo → kích hoạt mục này (mở rộng §3).
- **Mindset đọc-only** (TỰ bật, KHÔNG cần plan mode): CẤM edit / write / migration / install. Chỉ tool đọc: `view`/`grep`/`find`/`cat`/`ls`/`wc`/`psql \d`.
- **Format output**: ≤60 dòng (RECON) · ≤30 dòng (PULL). MỖI claim kèm `path:dòng`. Không thấy → "KHÔNG TÌM THẤY", cấm đoán. CẤM tự đề xuất fix — Web lo ở A1 DESIGN.
- **File dài** (vd "cat ADR-040"): tóm tắt 3-5 bullet + path, KHÔNG paste raw — giữ trần dòng; Web tự fetch nếu cần.
