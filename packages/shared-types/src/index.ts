/**
 * `@icp/shared-types` — Single source of truth cho TypeScript types
 * dùng chung FE-BE.
 *
 * **Top-level exports (S-02 T02):**
 * - `primitives` — branded types + Zod schemas (UUID, IsoDate, Money)
 * - `dto/*` — request/response shapes (currently `error.dto`)
 *
 * **Deferred future folders (per `docs/08_FE_BE_CONTRACT.md` §3):**
 * - `domain/` — entity types (Product, Order, Cart, User, ...) → created
 *   per V-SLICE S-03+ when first entity emerges
 * - `events/` — Kafka event envelopes → created S-05/S-06 (Cart/Pay)
 * - `behavior/` — PropertiesMap event catalog → created **S-02 T06**
 * - `sse/` — SSE event types (10 types per `03_API §3`) → created **S-02 T07**
 *
 * **Auto-generated subpath (DO NOT EXPORT here):**
 * - `api/` — output from `pnpm openapi:sync` (openapi-typescript-codegen).
 *   Gitignored. Import via subpath `@icp/shared-types/api`:
 *   ```ts
 *   import { HealthService, OpenAPI } from '@icp/shared-types/api';
 *   ```
 *
 * @see docs/08_FE_BE_CONTRACT.md
 * @see docs/DECISIONS.md ADR-017 (codegen + Zod bridge)
 *
 * S-02 T02 emit (replaces S-00b T02 empty barrel).
 */

export * from './primitives';
export * from './dto';
