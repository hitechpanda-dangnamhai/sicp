# 05 — Coding Conventions

> **Load khi:** code mới, hoặc khi review code. Đảm bảo consistency giữa 4 services.

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

### File structure (NestJS module)
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
    graphs/
      router_graph.py
      intents/
        importing_by_images.py
    tools/
      mcp_client.py
    state.py
    config.py
    exceptions.py
  tests/
    test_*.py
```

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

Mỗi service có module `errors.py` / `errors.ts` định nghĩa domain error types.

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
- Jest, file `*.spec.ts` cạnh source
- Unit test: domain logic, use cases (mock ports)
- Integration test: 1 file per controller, use Supertest
- Coverage target: 60% (Hackathon)

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

Mọi config qua env vars. Service có `config.ts` / `config.py` validate khi startup, fail-fast.

```ts
// NestJS
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

- Branch: `main` + feature branches `feat/...`, `fix/...`, `docs/...`
- Commit message: Conventional Commits
  ```
  feat(intent-01): add image analysis tool wiring
  fix(cart): handle qty zero as remove
  docs: update intent specs for buy flow
  ```
- PR: yêu cầu mô tả ngắn + checklist (`[x] tests`, `[x] docs updated`)

## 7. Comments & Documentation

- **JSDoc / docstring** cho public APIs, mô tả what + why, không what + how
- **Inline comments**: chỉ khi business rule không obvious
- **TODO**: format `// TODO(name, YYYY-MM-DD): description`
- **README** mỗi service `apps/<x>/README.md`: how to run, env vars, key endpoints

## 8. Imports cho shared-types

Mọi service (web, gateway, ai-client-types) đều import từ:
```ts
import { Product, OrderPlaced } from '@icp/shared-types';
```

Python side: tự maintain copy trong `apps/ai/src/types/shared.py`, sync manually (Hackathon scope, không generate cross-language).

## 9. Async Patterns

### Streaming
- Gateway: `Observable<MessageEvent>` (Nest SSE), không buffer entire response
- AI service: yield từ LangGraph stream API
- Frontend: `EventSource`, KHÔNG dùng `fetch` cho streaming

### Backpressure
- Kafka consumer: manual commit sau khi handle xong message
- DB connection pool: 10 connections default per service

## 10. Security Baseline

- Bcrypt cost 10 cho password
- JWT HS256, secret >= 32 chars, exp 24h
- CORS chỉ allow origins cụ thể
- File upload: validate MIME type + size, store temporarily, không persist binary trong DB
- KHÔNG log password, tokens, full JWT
- KHÔNG log PII trừ user_id

## 11. Performance Budget

- API p95 < 500ms (non-AI endpoints)
- AI endpoint first SSE event < 1s, full response < 8s
- DB query: index everything queried, never N+1
- Frontend bundle (Next.js): < 500KB gzipped per route

## 12. File & Folder Naming Cheat Sheet

| What | Example |
|---|---|
| NestJS module | `products.module.ts` |
| NestJS service | `products.service.ts` |
| NestJS controller | `products.controller.ts` |
| Use case | `create-product.use-case.ts` |
| Entity | `product.entity.ts` |
| Port | `product-repo.port.ts` |
| Adapter | `postgres-product.repo.ts` |
| DTO | `create-product.dto.ts` |
| Test | `*.spec.ts` |
| Next.js page | `app/page.tsx`, `app/products/page.tsx` |
| Next.js component | `components/product-card.tsx` |
| Python module | `snake_case.py` |
| Python test | `tests/test_*.py` |

---

**END OF CONVENTIONS DOC.**
