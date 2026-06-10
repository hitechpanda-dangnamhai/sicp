# 05 — Coding Conventions

> **Load khi:** code mới, hoặc khi review code. Đảm bảo consistency giữa các service.

<!-- PRODUCTION RECONCILE v2 (2026-06-10, deep-verify vs code/DB sống — evidence-based, mọi claim kèm file:line/lệnh):
  ✅ KHỚP CODE: §1 (auth 3-lớp; module khác phẳng), §2 (layout ai; no config.py/exceptions.py),
     §4 (Vitest≠Jest; coverage.thresholds chưa config = code task), §5 (gateway Zod fail-fast),
     §8-TS (openapi codegen wired; shared.py absent), §8-behavior (Zod), §10-baseline (bcrypt/JWT/redact/CORS),
     §9 (FE EventSource; AI astream; gateway DB pool 10).
  §3d SỬA THEO CODE: §1 "KHÔNG có subdir"→nuance (một số module có dto/); §9 Gateway SSE (manual res.write,
     KHÔNG Observable/@Sse); §10 file-upload (ảnh persist DB; multipart deferred; MIME image không validate);
     §5 (Python ai = os.getenv per-need, KHÔNG fail-fast).
  🟡 CHƯA CODE (target/ADR): §8-Python codegen; §9 Kafka (outbox-only, defer S-06); toàn bộ §10 production block
     (tenant ADR-040 / consent-DSAR ADR-041 / audit ADR-042 / payment-IPN ADR-038); vnpay chưa trong CHECK.
  CONVENTION/GUIDANCE (không phải claim code, GIỮ): §6 git, §7 comments, §11 perf (SLO chưa đo), §12 naming (mới
     corroborate controller/use-case/entity/spec/snake_case; repo/port/page/python-test CHƯA đối chiếu).
  §3 errors: convention `DomainError`/`ProductNotFoundError` = minh hoạ; thực tế per-module (auth AuthDomainError;
     products NestJS HttpException) — annotate, không xoá. -->


## 1. TypeScript (Next.js + NestJS)

### Style
- ESLint + Prettier. Config: `eslint-config-prettier`, `eslint-plugin-import`, `@typescript-eslint/recommended`
- **No `any`** — dùng `unknown` rồi narrow
- **No default export** trừ Next.js pages/components yêu cầu
- **Functions > 50 lines** → split
- Async/await, không Promise chains

### Imports order
```ts
// 1. Node built-ins
import { randomUUID } from 'node:crypto';
// 2. External
import { Module } from '@nestjs/common';
// 3. Internal (alias)
import { Product } from '@icp/shared-types';
// 4. Relative
import { ProductRepo } from './ports/product-repo';
```

### File structure (NestJS module — clean-arch, convention/target)
```
products/
  products.module.ts
  products.controller.ts
  application/
    create-product.use-case.ts
    create-product.use-case.spec.ts
  domain/
    product.entity.ts
    errors.ts
  infrastructure/
    postgres-product.repo.ts
  dto/
    create-product.dto.ts
```

> **Verified vs code (2026-06-10, `find apps/gateway/src -maxdepth 2 -type d`):** layout 3-lớp trên là **target/convention**. Thực tế: **CHỈ `auth/`** có đủ `application/` + `domain/` + `infrastructure/` (+ `dto/`). Các module khác **để phẳng** (controller+service ở root): `products/`, `cards/` **không có subdir**; `cart/`, `dashboard/`, `intent/`, `tracking/` phẳng nhưng **có `dto/`**. (Module hạ tầng: `clients`,`config`,`database`,`health`,`idempotency`,`observability`.) Áp 3 lớp dần khi module phức tạp — xem `01 §2`.

### DTO validation
Dùng `class-validator`:
```ts
export class CreateProductDto {
  @IsString() @Length(3, 255) title!: string;
  @IsInt() @Min(0) price!: number;
  @IsObject() attributes!: Record<string, unknown>;
}
```

### Logging
Pino, JSON output:
```ts
logger.info({ event: 'product_created', product_id, user_id });
```
Không dùng `console.log` trong production code.

## 2. Python (Flask + LangGraph + MCP server)

### Style
- Black formatter, line length 100
- isort cho imports
- ruff cho linting
- **Type hints bắt buộc** cho tất cả public functions
- **Pydantic** cho mọi data validation, không dùng dataclass cho payload

### Structure (Flask app)
```
ai/
  src/
    main.py
    state.py
    graphs/
      router_graph.py
      intents/
    tools/
      mcp_client.py
      llm_client.py
      redis_publisher.py
    observability/
    prompts/
  tests/
    test_*.py
```

> **Verified vs code (2026-06-10, `ls apps/ai/src/` + `graphs/` + `tools/`):** khớp — `main.py`, `state.py`, `__init__.py`; `graphs/{router_graph.py, intents/}`; `tools/{mcp_client.py, llm_client.py, redis_publisher.py}`; `observability/`; `prompts/`. **KHÔNG có `config.py`/`exceptions.py`** (config qua env; xử lý lỗi per-need). ⚠️ Có nhiều file rác `*.bak-*` + `__pycache__` trong `src/` và `tools/` → nên cleanup/gitignore.

### Pydantic for DTOs
```python
from pydantic import BaseModel, Field

class ProductDraft(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    price: int = Field(ge=0)
    attributes: dict[str, str | int | bool] = Field(default_factory=dict)
```

### Logging
```python
import structlog
log = structlog.get_logger()
log.info("intent_classified", intent=intent, confidence=conf)
```

## 3. Errors

> **Verified vs code (2026-06-10, `grep class *Error`):** ví dụ `DomainError`/`ProductNotFoundError` dưới đây = **convention minh hoạ**. Thực tế tồn tại **2 pattern** (mẫu kiểm: auth + products; module phẳng khác chưa đối chiếu từng-cái):
> - **auth** (Clean-Arch): base **`AuthDomainError extends Error`** với `(code: string, message, logExtras?: Record<string, unknown>)` — cấu trúc trùng ý tưởng `DomainError(code, message, details)`, chỉ khác tên + scope per-module + param `logExtras`. Subclass semantic `InvalidCredentialsError`/`TokenInvalidError`/`RefreshRejectedError` (`auth/domain/errors.ts`); controller catch + map HTTP.
> - **products** (flat): ném NestJS `BadRequestException`/`NotFoundException`/`ForbiddenException`/`InternalServerErrorException` trực tiếp trong controller (`products.controller.ts:109,148,153,157,161`). **Không** có `ProductNotFoundError`.
> - **KHÔNG có base `DomainError` thống nhất cross-service.** Python: `McpError(Exception)`, `LLMError(Exception)` extend `Exception` trực tiếp.

Convention (target — base error type có `code`/`message`/`details`):

```ts
// TypeScript
export class DomainError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}
export class ProductNotFoundError extends DomainError {
  constructor(id: string) { super('PRODUCT_NOT_FOUND', `Product ${id} not found`, { id }); }
}
```

```python
# Python
class DomainError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}

class ProductNotFoundError(DomainError):
    def __init__(self, product_id: str):
        super().__init__("PRODUCT_NOT_FOUND", f"Product {product_id} not found", {"id": product_id})
```

## 4. Testing

### TypeScript
- **Vitest** (`vitest run`), file `*.spec.ts` cạnh source. Config: `apps/gateway/vitest.config.ts`, `apps/web/vitest.config.ts` *(verified 2026-06-10: cả hai tồn tại, `import 'vitest/config'`)*. **KHÔNG dùng Jest** — `jest` chỉ xuất hiện trong comment giải thích (C-09 thay jest) + matchers `@testing-library/jest-dom` (`apps/web/vitest.config.ts:28,40`).
- Unit test: domain logic, use cases (mock ports)
- Integration test: 1 file per controller (Supertest cho gateway)
- **Coverage (production):** target ≥ 70% tổng, ≥ 80% cho `domain`/`application`. Enforce qua `vitest.config` `coverage.thresholds` — *(verified 2026-06-10: `coverage`/`threshold` = 0 hit trong 2 config → **CHƯA cấu hình** = code task.)*

### Python
- Pytest, file `tests/test_*.py`
- Mock LLM calls, không call thật trong test
- Integration cho 1 happy path mỗi intent

### Test naming
```ts
describe('CreateProductUseCase', () => {
  it('persists product and emits ProductImported event', async () => {});
  it('rejects when title shorter than 3 chars', async () => {});
});
```

## 5. Configuration

Mọi config qua env vars.

> **Verified vs code (2026-06-10):**
> - **Gateway: ✅ fail-fast** — `config/env.schema.ts` định nghĩa Zod `EnvSchema = z.object({...})` (`:22`); `validateEnv()` chạy `EnvSchema.safeParse(raw)` (`:105`) và `throw new Error(...)` khi invalid (`:124`); `ConfigModule` import `validateEnv` (`config.module.ts:26`). Ví dụ `AppConfig`/`required()` dưới đây = **minh hoạ**; thực tế dùng **Zod**.
> - **Python (`apps/ai`): KHÔNG fail-fast** — dùng `os.getenv(KEY, DEFAULT)` per-need (`main.py:119` REDIS_URL, `:795` FLASK_RUN_PORT, MCP_URL, timeouts…); không `BaseSettings`/pydantic Settings; env thiếu → fallback default. *(`apps/mcp` chưa verify.)*

```ts
// NestJS (minh hoạ — thực tế Zod EnvSchema)
@Injectable()
export class AppConfig {
  readonly databaseUrl = required('DATABASE_URL');
  readonly redisUrl = required('REDIS_URL');
  readonly jwtSecret = required('JWT_SECRET');
  readonly kafkaBrokers = required('KAFKA_BROKERS').split(',');
}
```

Env files: `.env.example` checked in, `.env` gitignored.

## 6. Git

> *(Convention/guidance — không phải claim code/DB; giữ nguyên.)*

- Branch: `main` + feature branches `feat/...`, `fix/...`, `docs/...`
- Commit message: Conventional Commits
  ```
  feat(intent-01): add image analysis tool wiring
  fix(cart): handle qty zero as remove
  docs: update intent specs for buy flow
  ```
- PR: yêu cầu mô tả ngắn + checklist (`[x] tests`, `[x] docs updated`)

## 7. Comments & Documentation

> *(Convention/guidance — giữ nguyên.)*

- **JSDoc / docstring** cho public APIs, mô tả what + why, không what + how
- **Inline comments**: chỉ khi business rule không obvious
- **TODO**: format `// TODO(name, YYYY-MM-DD): description`
- **README** mỗi service `apps/<x>/README.md`: how to run, env vars, key endpoints

## 8. Shared types — contract-first codegen

Nguồn sự thật = **OpenAPI** do Gateway sinh (`@nestjs/swagger`; export bằng `pnpm --filter gateway openapi:export`).

**TypeScript (web, gateway): ✅ ĐÃ wire** — import từ `@icp/shared-types`:
```ts
import { Product, OrderPlaced } from '@icp/shared-types';
```
> **Verified vs code (2026-06-10):** root `package.json` có `openapi:export` (`:22`), `openapi:generate` (`:23`, `--output src/api`), `openapi:sync` (`:24`) + devDep `openapi-typescript-codegen@0.29.0` (`:27`). `git ls-files`: **`packages/shared-types/openapi.json` committed**; **`packages/shared-types/src/api/` generated + committed** (`core/`, `models/`, `services/`). **`apps/ai/src/types/shared.py` KHÔNG tồn tại** (không tracked). *(Observation: models generated mới phủ subset auth/dashboard/intent/tracker — Product/Cart/Cards DTO chưa thấy; chưa verify riêng.)*

**Python (ai, mcp): 🟡 CHƯA CODE** — mục tiêu sinh Pydantic từ **cùng OpenAPI** (vd `datamodel-code-generator`).
> **Verified vs code (2026-06-10):** `grep datamodel` toàn repo = 0; `grep openapi` trong Python ai+mcp = 0 → **chưa wire codegen Python**. Hiện Pydantic định nghĩa **per-need/manual** (§2). Mục tiêu: 1 OpenAPI → gen cả 2 phía, không drift cross-language.

> Behavior-event schemas (FE tracker): **✅ Zod, tách riêng** ở `packages/shared-types/src/behavior/*` — `catalog.ts`/`tracker.ts` `import { z } from 'zod'`, dùng `z.object`/`z.enum`/`z.infer` + `discriminatedUnion('event_type')`. Xem `07_BEHAVIOR_LOGS`. *(subpath export `@icp/shared-types/behavior/*` chưa verify trong package.json exports.)*

## 9. Async Patterns

### Streaming
> **Verified vs code (2026-06-10):**
> - **Gateway (§3d sửa):** **KHÔNG** dùng `Observable<MessageEvent>`/Nest `@Sse` (0 hit). Thực tế **manual SSE**: `intent.controller.ts:259 res.setHeader('Content-Type','text/event-stream')` + `:266/:278/:365 res.write(...)`, forward verbatim từ Redis pub/sub channel `sse:pubsub:{rid}` → FE (kiến trúc "Option Z"). Stream theo từng message (không buffer toàn bộ response).
> - **AI service: ✅** yield từ LangGraph stream API — `graph.astream(...)` (`main.py:45/380/548`) + generator `yield` SSE (`main.py:134/152/185`).
> - **Frontend: ✅** native `EventSource` — `web/lib/sse-client.ts:65 new EventSource(url, { withCredentials: true })` (hooks `use-cart-stream.ts`/`use-search-stream.ts`). KHÔNG dùng `fetch` cho streaming.

### Backpressure
> **Verified vs code (2026-06-10):**
> - **Kafka consumer: 🟡 CHƯA CODE** — kiến trúc **outbox-only** (events ghi `published_at=NULL`), publish defer S-06 outbox-relay-worker (`mcp/events.py:23,26`; `importing_by_images.py:5,560`). `apps/workers/` mới là **scaffold** (`index.ts` comment "Kafka consumer workers" + `shopee-mock-seed-worker.ts`; KHÔNG có kafkajs/consumer/`commitOffsets`/`autoCommit`). `KAFKA_BROKERS` env = "future producer use" (`env.schema.ts:67-71`); health kafka = placeholder. ⇒ "manual commit sau khi handle xong message" = **target**.
> - **DB connection pool: 10** — gateway `database/pg-pool.provider.ts:47 max: 10` + `:54 new Pool(...)`. *("per service" mới verify gateway; pool của `apps/ai`/`apps/mcp` chưa check.)*

## 10. Security Baseline

> **Verified vs code (2026-06-10) — phần baseline ✅:**

- **bcryptjs** (pure-JS, no native binding — `seed.ts:17` "for CI") cost 10 cho password. Cost ở `infra/seed/seed.ts` (`:63 BCRYPT_COST=10 //D-01` → `:125 bcrypt.hash(pwd, BCRYPT_COST)`); login dùng `compare` từ bcryptjs (`auth/application/login.use-case.ts:27`); contract test "D-01 bcryptjs cost 10 contract" (`auth.service.spec.ts:163`). *(Runtime hashing mới thấy ở seed; chưa thấy đường signup hash.)*
- **JWT HS256**, sign + verify đều ép `HS256` (`auth/jwt.helper.ts:65` sign, `:83` verify `algorithms:['HS256']` → chặn alg-confusion). `JWT_SECRET` ≥ 32 chars (Zod `.min(32)` `config/env.schema.ts:41`). exp env-driven `JWT_ACCESS_TTL_HOURS` (comment helper "default 24"); refresh = `JWT_REFRESH_TTL_DAYS` (`env.schema.ts:46/52`).
- CORS chỉ allow origin cụ thể: `main.ts:116 enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' })` + `env.schema.ts:92 CORS_ORIGIN: z.string().default(...)`. KHÔNG wildcard `*`. (Prod: set `CORS_ORIGIN` = origin thật.)
- **File / image upload (§3d — sửa theo code):**
  - **Multipart upload = 🟡 deferred** (`main.ts:23`, `intent-request.dto.ts:34`). Ảnh gửi **base64 inline** trong field `content` của intent request (JSON), server strip `data:` prefix (`dto:53`).
  - **Size: ✅ enforce 2 lớp** — transport `app.useBodyParser('json', { limit: '10mb' })` (`main.ts:131`) + app-layer Zod `content: z.string().min(1).max(10_000_000)` (`dto:57`).
  - **MIME: ❌ KHÔNG validate server-side cho image** (`content` chỉ `z.string()`; FE bắt `file.type`). (Audio MIME có validate ở `mcp/tools/speech.py`.)
  - **Persist: ❌ ảnh ĐƯỢC lưu trong DB** — `products.image_data` (text) = base64, set ở `importing_by_images.py:967`; analytics đếm `COUNT(*) products WHERE image_data IS NOT NULL` (`mcp/analytics.py`). ⇒ mệnh đề cũ "store temporarily, không persist binary trong DB" **SAI** (lưu ý: type `text` base64, không phải `bytea`).
- **KHÔNG log** password, tokens, full JWT, authorization header — Pino `redact.paths` ở `observability/logger.ts` (`password`/`*.password`, `authorization`/`*.authorization`, `token`/`*.token`, `access_token`, `refresh_token`, `jwt`; `jti` cố ý giữ; censor `[REDACTED]`).
- **KHÔNG log PII** trừ định danh tối thiểu (`user_id`, `tenant_id`) — ⚠️ **chưa enforce trong redact** (list chỉ auth-secret; email/phone/name không có trong paths; comment code tự nhận "minimal list"). PII redactor middleware = 🟡 **CHƯA CODE** (planned Phase 06, comment `idempotency.middleware.ts:40-41`).

### Production (multi-tenant + GDPR + payment + audit)

> **Verified vs code/DB (2026-06-10): block này gần như TOÀN BỘ 🟡 CHƯA CODE (target/ADR).**

- **Tenant isolation (ADR-040): 🟡 CHƯA CODE.** DB: `pg_policies` = 0 rows (0 RLS policy); `information_schema` cột `%tenant%` = 0; `pg_tables` = 17 bảng, **không có bảng `tenants`**. Code: `grep current_tenant|tenant_id|set_config` `.ts/.sql` = 0. ⇒ Khi triển khai: mọi repo/query scope theo `tenant_id` (RLS GUC `app.current_tenant` + scope app-level); KHÔNG query cross-tenant; tenant resolve ở Gateway (`03 §1.0`).
- **Consent / DSAR (ADR-041): 🟡 CHƯA CODE.** `grep consent|dsar|erasure|behavior_tracking` `.ts/.py/.sql` = 0 liên quan; không bảng `consent`/`dsar`. ⇒ Khi triển khai: behavior tracking chỉ chạy khi có consent `behavior_tracking`; hỗ trợ access/erasure + retention; xem `03 §1.9`. *(Behavior tracker đã có — bảng `behavior_events` partitioned theo tháng — nhưng chưa có consent-gate.)*
- **Payment (ADR-038):** payment_method enum (**target**) = `{mock, momo, zalopay, vnpay, bank_transfer, cod}`. **DB `chk_payment_method` (live, 2026-06-10) = `{mock, momo, zalopay, bank_transfer, cod}`**, constraint ở `infra/migrations/V005__payment_metadata.sql:20-21` (khớp DB, no drift). **`vnpay` CHƯA có trong CHECK** (`grep vnpay` `.sql/.ts` = 0) → 🟡 cần migration mới ALTER thêm `vnpay` (đề xuất V011 — max hiện tại = V010, numbering có gap V004/V007). **IPN signature verify + idempotency = 🟡 CHƯA CODE** (`grep ipn|dedup_key|verifySignature` = 0; `momo`/`zalopay` chỉ ở enum + MoMo color palette `tailwind.config`). Khi triển khai: verify chữ ký IPN VNPay/Momo/ZaloPay TRƯỚC khi cập nhật order/transaction; idempotent theo `dedup_key`; KHÔNG log payload thanh toán nhạy cảm. (Bảng `orders`/`order_items`/`transactions` đã tồn tại.)
- **Audit (ADR-042): 🟡 CHƯA CODE.** DB: không bảng `audit*` nào (17 bảng); `to_regclass(audit_log/audit_logs)` = NULL. Code: `grep audit` `.ts/.py/.sql` chỉ ra comment (review-process + ghi chú "audit trail" như `V001:233` giữ `transactions` no-cascade) — không `AuditLogger`/hash-chain. ⇒ Khi triển khai: `audit-logger` ghi hash-chain bất biến; KHÔNG cho update/delete trên `audit_log`.

## 11. Performance Budget

> *(SLO/target runtime — chưa đo bằng load-test/bundle-analysis trong session này; giữ làm mục tiêu.)*

- API p95 < 500ms (non-AI endpoints)
- AI endpoint first SSE event < 1s, full response < 8s
- DB query: index everything queried, never N+1
- Frontend bundle (Next.js): < 500KB gzipped per route

## 12. File & Folder Naming Cheat Sheet

> *(Convention. Đã corroborate thực tế 2026-06-10: `*.controller.ts`, `*.use-case.ts`, `*.entity.ts`, `*.spec.ts`, `snake_case.py`. CHƯA đối chiếu từng-cái: `*.repo.ts` adapter (auth dùng `.store.ts`), `*-repo.port.ts`, Next.js `page.tsx`/`components/*.tsx`, Python `tests/test_*.py`.)*

| What | Example | Đối chiếu |
|---|---|---|
| NestJS module | `products.module.ts` | convention |
| NestJS service | `products.service.ts` | convention |
| NestJS controller | `products.controller.ts` | ✅ thấy |
| Use case | `create-product.use-case.ts` | ✅ thấy (`login.use-case.ts`) |
| Entity | `product.entity.ts` | ✅ thấy (`user.entity.ts`) |
| Port | `product-repo.port.ts` | convention (chưa thấy) |
| Adapter | `postgres-product.repo.ts` | convention (chưa thấy `.repo.ts`) |
| DTO | `create-product.dto.ts` | convention |
| Test (TS) | `*.spec.ts` | ✅ thấy |
| Next.js page | `app/page.tsx`, `app/products/page.tsx` | convention (chưa đối chiếu) |
| Next.js component | `components/product-card.tsx` | convention (chưa đối chiếu) |
| Python module | `snake_case.py` | ✅ thấy |
| Python test | `tests/test_*.py` | convention (chưa thấy) |

---

**END OF CONVENTIONS DOC.** *(Standardized v2 — 2026-06-10, evidence-based vs code/DB sống. Nhãn: ✅ khớp · 🟡 CHƯA CODE · §3d sửa theo code · convention/guidance giữ.)*
