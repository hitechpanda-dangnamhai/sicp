/**
 * `@icp/shared-types` — Single source of truth cho TypeScript types
 * dùng chung FE-BE.
 *
 * **Top-level exports (root barrel — `@icp/shared-types`):**
 * - `primitives` — branded types + Zod schemas (UUID, IsoDate, Money)
 * - `dto/*` — request/response shapes (currently `error.dto`)
 * - `behavior/*` — PropertiesMap + BehaviorEventSchema + TrackBatch contracts
 *   (S-02 T06 emit; C-34 revision adds root re-export for BE CommonJS compat
 *   while keeping `./behavior` subpath for FE bundler tree-shaking)
 * - `sse/*` — IntentStream 10 typed event schemas + EventMap (S-02 T07 emit;
 *   same dual access pattern as `behavior/` per C-32 LOCKED post-T06)
 *
 * **Dual access pattern (S-02 T06 — C-34 RESOLVED, T07 extends to ./sse):**
 * - **Frontend** (`apps/web`, Next.js bundler with `moduleResolution: bundler`):
 *   prefer subpath `import { BehaviorEventSchema } from '@icp/shared-types/behavior'`
 *   or `import { SseStatusEvent } from '@icp/shared-types/sse'` for
 *   tree-shaking + clear consumer intent.
 * - **Backend** (`apps/gateway`, NestJS CommonJS with `moduleResolution: node`):
 *   subpath not resolvable due to classic `node` resolution + `"type":
 *   "module"` mismatch (TS1479/TS2307). Import via root:
 *   `import { BehaviorEventSchema, SseStatusEvent } from '@icp/shared-types'`.
 *   Tree-shaking not critical for BE (full bundle ships in container).
 *
 * **Deferred future folders (per `docs/08_FE_BE_CONTRACT.md` §3):**
 * - `domain/` — entity types (Product, Order, Cart, User, ...) → created
 *   per V-SLICE S-03+ when first entity emerges
 * - `events/` — Kafka event envelopes → created S-05/S-06 (Cart/Pay)
 *
 * **Auto-generated subpath (DO NOT EXPORT here):**
 * - `api/` — output from `pnpm openapi:sync` (openapi-typescript-codegen).
 *   Gitignored. Import via subpath `@icp/shared-types/api` (FE only — BE
 *   consumes via direct file imports if ever needed).
 *
 * @see docs/08_FE_BE_CONTRACT.md
 * @see docs/DECISIONS.md ADR-017 (codegen + Zod bridge)
 *
 * S-02 T02 emit. Patched S-02 T06 (C-34: dual access for behavior/).
 * Patched S-02 T07 (C-32 extension: dual access for sse/).
 */

export * from './primitives';
export * from './dto';
export * from './behavior';
export * from './sse';
