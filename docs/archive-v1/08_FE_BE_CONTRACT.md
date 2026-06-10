# 08 — Frontend ↔ Backend Contract

> **Load khi:** code API endpoint, DTO, frontend client, hoặc khi gặp drift FE/BE. Đây là doc về **cách FE và BE giữ đồng bộ** mà không phải gõ tay 2 lần.

<!-- PRODUCTION RECONCILE (2026-06-09, verified vs live shared-types):
Codegen ĐÃ WIRE THẬT (root package.json: openapi:export/generate/sync; openapi-typescript-codegen 0.29.0;
openapi.json committed). shared-types/src thật = api/(core,models,services) + behavior/ + dto/ + sse/ +
top-level cart.ts/products.ts/recommendations.ts/primitives.ts/index.ts. KHÔNG có domain/ và events/ dir
(rule 4 → sửa §3). Generated services = Auth/Dashboard/Health/Intent/Tracker (KHÔNG có ProductsService).
sse/intent-stream.ts + dto/error.dto.ts CÓ thật. tenant/consent ở client = greenfield (CHƯA CODE). -->

## 1. Vấn Đề Cần Giải Quyết

Trong dev đời thực hay xảy ra:

```
Backend đổi field: 'price' → 'price_vnd'
Frontend không biết → render NaN
Bug phát hiện sau khi merge → fix sau 2 tuần
```

ICP có 4 services, 8 intents, hàng chục endpoints → drift là **chắc chắn** nếu code tay 2 phía.

## 2. Strategy: Single Source of Truth

```
              ┌──────────────────────────────┐
              │  Source of Truth             │
              │  ─────────────────           │
              │  packages/shared-types/      │
              │  + OpenAPI 3.1 spec          │
              │  (auto-generated)            │
              └────┬──────────────┬──────────┘
                   │              │
       ┌───────────▼──┐      ┌────▼────────────┐
       │  Backend     │      │  Frontend       │
       │  (NestJS)    │      │  (Next.js)      │
       │              │      │                 │
       │  - Uses TS   │      │  - Uses TS      │
       │    types     │      │    types        │
       │  - Generates │      │  - Imports      │
       │    OpenAPI   │      │    auto-gen     │
       │    from code │      │    client       │
       └──────────────┘      └─────────────────┘
```

**Nguyên tắc vàng:** Định nghĩa types **1 nơi duy nhất** — `packages/shared-types/` — cả FE và BE import. Backend code tự sinh OpenAPI spec → frontend codegen API client.

## 3. Cấu Trúc Shared Types

```
packages/shared-types/
├── package.json
├── tsconfig.json
├── openapi.json             ← VERIFIED committed (codegen reproducibility + PR diff)
└── src/
    ├── index.ts              ← re-export everything
    ├── primitives.ts         ← UUID, ISO date, Money type aliases
    ├── products.ts           ← Product + ProductCreate/PatchSchema (Zod)  [VERIFIED: top-level, KHÔNG ở dto/]
    ├── cart.ts               ← Cart shape (S-05)
    ├── recommendations.ts    ← reco types (Intent 04)
    ├── dto/                  ← request/response shapes [VERIFIED]
    │   ├── error.dto.ts          ← standard error envelope (§4.3)
    │   ├── analytics.dto.ts
    │   └── intent-suggest-attrs.dto.ts
    ├── behavior/             ← event Zod schemas (07): auth/cart/import/nav/recommend/search/error-events + catalog.ts + tracker.ts
    ├── sse/                  ← SSE event types
    │   └── intent-stream.ts      ← [VERIFIED]
    └── api/                  ← API client GENERATED qua `pnpm openapi:sync` [VERIFIED]
        ├── core/                 ← ApiError, OpenAPI, request, CancelablePromise…
        ├── models/               ← DashboardStats/ForgotPassword/IntentRequest/Login/Me/TrackBatch Dto…
        └── services/             ← Auth/Dashboard/Health/Intent/Tracker Service

# ⚠️ KHÁC doc cũ (rule 4 — sửa theo code): KHÔNG có `domain/` (entities nằm ở top-level
#   products.ts/cart.ts/recommendations.ts) và KHÔNG có `events/` (Kafka envelope chưa tách ở shared-types).
#   `dto/product.dto.ts` (ví dụ dưới) → thật ở `products.ts`. `src/api/` committed
#   (verified grep `.gitignore`: KHÔNG có dòng loại trừ `api`); `openapi.json` committed.
```

### Example: `dto/product.dto.ts`

```typescript
import { z } from 'zod';

export const ProductCreateSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  category: z.string(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  image_url: z.string().url().optional(),
});

export type ProductCreateDTO = z.infer<typeof ProductCreateSchema>;

export const ProductPatchSchema = ProductCreateSchema.partial().extend({
  status: z.enum(['active', 'archived', 'draft']).optional(),
});
export type ProductPatchDTO = z.infer<typeof ProductPatchSchema>;
```

**Why Zod:** runtime validation FE-side + type inference → 1 file định nghĩa cả schema + type.

## 4. Backend Side — NestJS

### 4.1 Setup OpenAPI Generation

NestJS có Swagger module:

```typescript
// apps/gateway/src/main.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('ICP Gateway API')
    .setDescription('Intelligent Commerce Platform — REST API')
    .setVersion('0.0.1')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'jwt')
    .addServer('http://localhost:3001', 'Local dev')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);  // → http://localhost:3001/docs

  // Export OpenAPI JSON cho codegen
  if (process.env.EXPORT_OPENAPI === 'true') {
    const fs = await import('node:fs');
    fs.writeFileSync(
      '../../packages/shared-types/openapi.json',
      JSON.stringify(document, null, 2)
    );
    console.log('OpenAPI exported');
    process.exit(0);
  }

  await app.listen(3001);
}
```

### 4.2 DTO Validation từ Zod

Dùng `nestjs-zod` để bridge Zod ↔ NestJS:

```typescript
// apps/gateway/src/products/dto/create-product.dto.ts
import { createZodDto } from 'nestjs-zod';
import { ProductCreateSchema } from '@icp/shared-types';

export class CreateProductDto extends createZodDto(ProductCreateSchema) {}
```

Controller:
```typescript
@Post()
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'Idempotency-Key', required: true })
@ApiResponse({ status: 201, description: 'Product created', type: ProductDto })
@ApiResponse({ status: 400, type: ErrorResponseDto })
async create(@Body() dto: CreateProductDto): Promise<Product> {
  return this.useCase.execute(dto);
}
```

→ NestJS sẽ:
1. Validate body theo Zod schema (FE và BE cùng schema)
2. Generate OpenAPI doc với đúng spec
3. Type-check at compile time

### 4.3 Standard Response Shape

```typescript
// packages/shared-types/src/dto/error.dto.ts
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    request_id: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

NestJS global filter convert mọi exception sang shape này.

## 5. Frontend Side — Auto-Generated Client

### 5.1 Codegen Tools

**ĐÃ WIRE (verified 2026-06-09):** `openapi-typescript-codegen` (0.29.0). Scripts THẬT ở **root `package.json`**:

```bash
# root package.json (thật — rút gọn)
"scripts": {
  # export: chạy gateway trong docker compose (EXPORT_OPENAPI=true) rồi cp openapi.json ra packages/shared-types/
  "openapi:export":   "docker compose -f infra/docker-compose.yml -f infra/docker-compose.observability.yml exec -T -e EXPORT_OPENAPI=true gateway node /workspace/apps/gateway/dist/main.js; docker compose ... cp gateway:/workspace/packages/shared-types/openapi.json packages/shared-types/openapi.json",
  "openapi:generate": "pnpm --filter @icp/shared-types exec openapi --input openapi.json --output src/api --client fetch --useUnionTypes --exportCore true --exportServices true --exportModels true --indent 2",
  "openapi:sync":     "pnpm openapi:export && pnpm openapi:generate"
}
```
*(Gateway cũng có `openapi:export` dạng đơn `EXPORT_OPENAPI=true node dist/main.js`.)*

> ⚠️ **Verified:** services GENERATED thật = `AuthService, DashboardService, HealthService, IntentService, TrackerService` — **KHÔNG có `ProductsService`** (`/products` mới có `PATCH :id`, xem `03 §1.3`). Ví dụ dưới = `DashboardService` (1 trong 5 service thật).

Generated `packages/shared-types/src/api/services/DashboardService.ts` (1 trong 5 service THẬT):
```typescript
export class DashboardService {
  public static getStats(): CancelablePromise<DashboardStatsDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/dashboard/stats',
      errors: { 401: 'UNAUTHORIZED', 500: 'INTERNAL' },
    });
  }

  public static getInsight(): CancelablePromise<DashboardInsightDto> {
    // GET /api/v1/dashboard/insight
  }
}
```
*(Model `DashboardStatsDto` ở `api/models/` — verified codegen. `__request(OpenAPI, …)` + `CancelablePromise` từ `api/core/`.)*

### 5.2 Frontend Usage

```typescript
// apps/web/lib/api-client.ts   ← lib Ở ROOT (KHÔNG src/lib — verified 2026-06-09)
import { OpenAPI, DashboardService, IntentService } from '@icp/shared-types/api';

OpenAPI.BASE = process.env.NEXT_PUBLIC_API_URL!;   // base = /api/v1
OpenAPI.WITH_CREDENTIALS = true;                   // cookie httpOnly (ADR-019) — KHÔNG bearer OpenAPI.TOKEN

// Codegen services THẬT (5): AuthService, DashboardService, HealthService, IntentService, TrackerService
export const api = { dashboard: DashboardService, intent: IntentService };
```

Component:
```typescript
'use client';
import { api } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

export function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.getStats(),   // GET /api/v1/dashboard/stats (codegen thật)
  });

  if (isLoading) return <Skeleton />;
  return <StatsPanel data={data} />;
}
```

> ⚠️ **Verified 2026-06-09:** codegen **KHÔNG có `ProductsService`** (products GET = CHƯA CODE) — ví dụ cũ `api.products.getProducts` SAI. Dùng 1 trong 5 service thật. Auth = **cookie httpOnly** (`WITH_CREDENTIALS=true`), KHÔNG đọc JWT trong JS. FE lib ở `apps/web/lib/` (root); `sse-client.ts` cũng ở đây.

**Compile-time safety:** thiếu field, sai type → TypeScript error ngay trong IDE.

## 6. SSE Streaming Type Safety

SSE không nằm trong OpenAPI spec, cần định nghĩa riêng. **Catalog mở rộng (verified `intent-stream.ts` 2026-06-09): 31 typed event** + `heartbeat` keepalive (no Zod, server emit ~15s). Baseline S-02 = 10 event (Zod minh hoạ dưới); +21 event qua S-04..S-10 — **danh sách đầy đủ 31 ở cuối §6**.

```typescript
// packages/shared-types/src/sse/intent-stream.ts
import { z } from 'zod';

// status.phase 7 values per C-37 LOCKED (superset of 03_API §3 minimal +
// V-SLICE first-need 'committing' S-06 + 'awaiting_user_input' S-04+)
export const SseStatusEvent = z.object({
  phase: z.enum([
    'classifying', 'analyzing', 'searching', 'synthesizing',
    'committing', 'awaiting_user_input', 'done',
  ]),
});

export const SsePartialTextEvent = z.object({
  delta: z.string(),
});

export const SseToolCallEvent = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
});

export const SseToolResultEvent = z.object({
  tool: z.string(),
  result_summary: z.string(),
});

// items typed unknown[] Phase 1; V-SLICE S-04 narrows to Product[] when
// domain/product.ts ships (deferred per §3 folder layout C-10).
export const SseProductsEvent = z.object({
  items: z.array(z.unknown()),
});

// Typed unknown Phase 1; V-SLICE replaces with ActionCardSchema from
// domain/action-card.ts.
export const SseCardEvent = z.unknown();

export const SseChartEvent = z.object({
  type: z.enum(['line', 'bar', 'pie']),
  title: z.string(),
  x_axis: z.string(),
  y_axis: z.string(),
  series: z.array(z.object({
    name: z.string(),
    data: z.array(z.number()),
  })),
});

export const SseOrderUpdateEvent = z.object({
  order_id: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']),
});

export const SseFinalEvent = z.object({
  text: z.string(),
  summary: z.record(z.unknown()).optional(),
});

export const SseErrorEvent = z.object({
  code: z.string(),
  message: z.string(),
  retriable: z.boolean(),
});

// heartbeat NOT in map — transport keepalive only (C-36 LOCK). Browser
// EventSource still uses it for connection liveness + auto-reconnect.
export type IntentStreamEventMap = {
  status: z.infer<typeof SseStatusEvent>;
  partial_text: z.infer<typeof SsePartialTextEvent>;
  tool_call: z.infer<typeof SseToolCallEvent>;
  tool_result: z.infer<typeof SseToolResultEvent>;
  products: z.infer<typeof SseProductsEvent>;
  card: z.infer<typeof SseCardEvent>;
  chart: z.infer<typeof SseChartEvent>;
  order_update: z.infer<typeof SseOrderUpdateEvent>;
  final: z.infer<typeof SseFinalEvent>;
  error: z.infer<typeof SseErrorEvent>;
};

export type IntentStreamEventType = keyof IntentStreamEventMap;
```

> ⚠️ **`IntentStreamEventMap` thật = 31 event** (verified `intent-stream.ts` 2026-06-09; map ở trên chỉ hiện 10 baseline S-02). Đủ schema Zod sống trong code — đây là source-of-truth. Danh sách đầy đủ (nhóm theo feature):
>
> - **Core (S-02):** `status`, `partial_text`, `tool_call`, `tool_result`, `products`, `card`, `chart`, `order_update`, `final`, `error`
> - **Search/Intent03 (S-04):** `understanding`, `typo_suggestion`, `variant_degraded`, `phase_progress`, `product_ready`, `empty_state`, `co_purchase_hint`
> - **Import/Intent01 (S-07):** `form_prefill`, `market_trend`, `shopee_compare`
> - **Cart/Intent05 (S-05):** `cart_updated`, `cart_cleared`, `cart_view_ready`, `clear_confirm`, `clear_cancelled`, `stock_issue_ready`, `stock_issue_summary`
> - **Voice/Intent02 (S-08):** `voice_transcribed`, `voice_clarify_options`
> - **Analytics/Intent07 (S-10):** `analytics_cards`, `analytics_clarify`
>
> (+ `heartbeat` transport, không trong map.) FE EventSource switch phải handle đủ 31 + ignore unknown forward-compat.

### 6.1 SSE Client Wrapper

```typescript
// apps/web/lib/sse-client.ts  (NOT src/lib/ — repo path corrected C-39)
import type { IntentStreamEventMap, IntentStreamEventType } from '@icp/shared-types/sse';

type Handlers = {
  [K in IntentStreamEventType]?: (data: IntentStreamEventMap[K]) => void;
};

export function streamIntent(url: string, handlers: Handlers): () => void {
  const es = new EventSource(url, { withCredentials: true });

  (Object.keys(handlers) as IntentStreamEventType[]).forEach((evt) => {
    const handler = handlers[evt];
    if (!handler) return;
    es.addEventListener(evt, (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        (handler as (data: unknown) => void)(parsed);
      } catch (err) {
        console.error('SSE parse error', err);
      }
    });
  });

  return () => es.close();
}
```

Usage type-safe (cookie httpOnly auth per ADR-019 + D-05; endpoint hybrid pattern per C-38):
```typescript
// 1. POST mutation
const { request_id } = await fetch('/api/v1/intent', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({ modality: 'text', content: 'mua nước tương' }),
}).then((r) => r.json());

// 2. GET stream pickup
const close = streamIntent(`/api/v1/intent/stream?id=${request_id}`, {
  status: (e) => setPhase(e.phase),     // e.phase typed enum (7 values)
  products: (e) => setProducts(e.items),
  card: (card) => addCard(card),
  chart: (chart) => renderChart(chart),
  final: (final) => { setResult(final.text); close(); },
  error: (err) => toast.error(err.message),
});
```

## 7. Workflow Khi Code Đồng Bộ FE-BE

### 7.1 Order Bắt Buộc

```
1. Backend dev edits DTO trong packages/shared-types
   (or thêm endpoint controller mới với @Body() validated DTO)
        ↓
2. Backend dev chạy: pnpm openapi:sync
   → Re-export OpenAPI JSON
   → Re-generate frontend API client
        ↓
3. Backend dev commit cả 3:
   - shared-types changes
   - openapi.json
   - generated api/ folder
        ↓
4. Frontend dev pull, IDE TypeScript ngay lập tức show error
   nếu component đang dùng API cũ
        ↓
5. Frontend fix component → commit
```

**KHÔNG được skip bước 2.** Nếu skip:
- Frontend không biết shape mới
- Backend test pass, frontend break

### 7.2 CI Enforcement

GitHub Actions:
```yaml
name: contract-check
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build --filter @icp/gateway
      - run: pnpm openapi:sync
      - run: git diff --exit-code packages/shared-types/openapi.json packages/shared-types/src/api/
        # Fail nếu generated files khác với committed files
```

→ PR sẽ fail nếu dev quên chạy `openapi:sync`. Bắt buộc rebuild trước merge.

## 8. Contract Testing (PACT-lite)

Chưa cần PACT framework đầy đủ (cân nhắc cho production sau). Mỗi endpoint quan trọng có 1 test file ở cả 2 phía:

### 8.1 Backend Side

```typescript
// apps/gateway/src/products/products.controller.contract.spec.ts
describe('Products contract', () => {
  it('POST /products returns Product matching ProductSchema', async () => {
    const res = await request(app).post('/api/v1/products')
      .set('Idempotency-Key', uuidv4())
      .set('Authorization', `Bearer ${jwt}`)
      .send(validProductCreateDto);

    expect(res.status).toBe(201);
    expect(() => ProductSchema.parse(res.body)).not.toThrow();
  });
});
```

### 8.2 Frontend Side — Mock Service Worker

```typescript
// apps/web/src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { ProductSchema } from '@icp/shared-types';

export const handlers = [
  http.post('/api/v1/products', async ({ request }) => {
    const body = await request.json();
    // Validate response matches schema
    const fakeProduct = generateFakeProduct(body);
    return HttpResponse.json(ProductSchema.parse(fakeProduct), { status: 201 });
  }),
];
```

→ Storybook + Playwright tests dùng MSW. Nếu schema FE đổi, mock fail → biết ngay.

## 9. Versioning & Breaking Changes

### 9.1 Strategy

- URL versioned `/api/v1/...` — toàn dự án dùng v1
- Field thêm = non-breaking, FE handle missing optional fields
- Field rename/remove = breaking → coordinate cross-team:
  1. Backend deploy parallel field (cả old + new)
  2. Frontend migrate sang new field
  3. Backend remove old field

### 9.2 Deprecation Markers

Trong shared-types:
```typescript
export const ProductSchema = z.object({
  // ...
  /** @deprecated Use price_vnd. Removed in v2. */
  price: z.number().optional(),
  price_vnd: z.number(),
});
```

OpenAPI sẽ pick up JSDoc `@deprecated` → Swagger UI hiển thị strikethrough.

## 10. Sequence — Khi Code 1 Feature Mới Có FE+BE

Lấy ví dụ thêm endpoint `POST /products/:id/duplicate`:

```
Step 1 — Define shape (10 min)
  - Edit packages/shared-types/src/dto/product.dto.ts
  - Add DuplicateProductSchema, DuplicateProductDTO

Step 2 — Backend implement (30 min)
  - Add DuplicateProductDto extends createZodDto(DuplicateProductSchema)
  - Add controller method với @ApiOperation, @ApiResponse decorators
  - Add use case, repo method
  - Unit test
  - Run: pnpm openapi:sync

Step 3 — Frontend consume (15 min)
  - api.products.duplicateProduct({ id, requestBody: {...} })  ← đã có sẵn từ codegen
  - Add button to ProductCard wired to mutation
  - Toast on success

Step 4 — E2E test (10 min)
  - Storybook story với MSW mock
  - Playwright test click duplicate → assert new product appears

Step 5 — Commit + push, CI verifies contract sync
```

**Tổng 65 min, có cả test, không drift.**

## 11. Anti-Patterns (KHÔNG được làm)

### ❌ Anti-1: Định nghĩa types riêng ở FE
```typescript
// apps/web/src/types/product.ts   ← KHÔNG
type Product = {
  id: string;
  title: string;
  price: number;
};
```
→ Drift chắc chắn.

### ❌ Anti-2: `any` để bypass type errors
```typescript
const product = res.body as any;  // KHÔNG
```
→ Mất hết lợi ích.

### ❌ Anti-3: Frontend gọi raw `fetch` thay vì generated client
```typescript
fetch('/api/v1/products', { ... });  // KHÔNG, bypass codegen
```
→ Không có safety, không biết khi backend đổi.

### ❌ Anti-4: Backend export OpenAPI thủ công ở development
```bash
# KHÔNG dùng: trỏ Swagger UI và copy-paste JSON
```
→ Phải có script `openapi:sync` automated.

### ❌ Anti-5: Skip migration step khi đổi DTO
→ FE break im lặng. CI phải catch.

## 12. SSE Authentication Trick

Vấn đề: `EventSource` không cho set Authorization header.

**Giải pháp 1 (đơn giản):** JWT trong cookie httpOnly, `withCredentials: true`. Gateway đọc cookie để verify.

**Giải pháp 2 (cho mobile, không có cookie):** Pass JWT trong query param khi connect:
```
GET /api/v1/intent/stream?token=eyJhbG...&request_id=abc
```
Backend extract từ query, verify, sau đó stream. KHÔNG log query string vào ops log (PII).

Đề xuất: dùng **giải pháp 1**.

## 13. Phase Mapping

| Phase | What |
|---|---|
| **Phase 00** | Shared-types skeleton + Zod schemas đầu tiên (User, Product) — chưa cần codegen |
| **Phase 01** | NestJS Swagger setup, script `openapi:sync`, generated API client folder structure, MSW init |
| **Phase 02** | Auth endpoints (login/logout/me) + Search endpoint + Track endpoint với full type chain. Đây là phase FIRST CI contract check |
| **Phase 03** | Intent stream SSE types LOCKED. ProductCreate, Card schemas full |
| **Phase 04** | Order, Cart, Transaction types. Order SSE stream |
| **Phase 05** | ChartSpec types, Recommendation reason types |
| **Phase 06** | Audit shared-types coverage, remove any drift, OpenAPI version bump to 0.1.0 stable |

## 14. Tooling Summary

| Tool | Purpose | Phase |
|---|---|---|
| `zod` | Schema definition + runtime validation | P00 |
| `nestjs-zod` | Bridge Zod → NestJS validation pipe | P01 |
| `@nestjs/swagger` | Auto-generate OpenAPI từ decorators | P01 |
| `openapi-typescript-codegen` | Generate FE client từ OpenAPI | P01 |
| `@tanstack/react-query` | FE data fetching + caching | P02 |
| `msw` | Mock backend cho FE dev + tests | P00 |
| `playwright` | E2E test | P06 |
| `ladle` hoặc `storybook` | Component dev environment | P00 |

## 15. Quick Reference Cheat Sheet

```
Backend dev đổi DTO?
  ↓
1. Edit packages/shared-types/src/dto/<thing>.ts
2. cd apps/gateway && pnpm openapi:sync (or root: pnpm openapi:sync)
3. Verify generated apps/web có files mới
4. Commit cả 3: shared-types, openapi.json, generated api/
5. Push PR, CI runs contract-check → green

Frontend dev cần dùng API?
  ↓
1. import { api } from '@/lib/api-client'
2. api.<service>.<method>(...)  ← IDE autocomplete đầy đủ
3. Wrap với useQuery/useMutation từ TanStack
4. TypeScript guarantee shape

Streaming intent?
  ↓
1. import { streamIntent } from '@/lib/sse-client'
2. streamIntent(url, { status, partial_text, products, card, ... })  ← handlers fully typed
3. Component reactive update theo events
```

---

**END OF FE-BE CONTRACT DOC.**
