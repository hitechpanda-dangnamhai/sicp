/**
 * `@icp/shared-types` — Single source of truth cho TypeScript types
 * dùng chung FE-BE.
 *
 * **Top-level exports (root barrel — `@icp/shared-types`):**
 * - `primitives` — branded types + Zod schemas (UUID, IsoDate, Money)
 * - `dto/*` — request/response shapes (currently `error.dto` + S-07 T02 NEW `intent-suggest-attrs.dto`)
 * - `behavior/*` — PropertiesMap + BehaviorEventSchema + TrackBatch contracts
 *   (S-02 T06 emit; C-34 revision adds root re-export for BE CommonJS compat
 *   while keeping `./behavior` subpath for FE bundler tree-shaking)
 * - `sse/*` — IntentStream typed event schemas + EventMap (S-02 T07 emit;
 *   same dual access pattern as `behavior/` per C-32 LOCKED post-T06)
 * - `cart` — Cart entity Zod schemas + types (S-05 T01 emit per D-S05-02 LAW;
 *   same dual access pattern: subpath `@icp/shared-types/cart` for FE,
 *   root `@icp/shared-types` for BE CommonJS)
 * - `products` NEW S-07 T02 (Phiên Sx07-F per Q5 option b + C-S07-Q):
 *   `ProductDraftSchema` + `ProductSchema` + `CANONICAL_CATEGORIES` —
 *   FE PrefillForm zodResolver consumer; same dual access pattern.
 * - `recommendations` NEW S-09 T01 (Phiên Sx09-C per D-S09-NN-A LAW + C-S09-G/H):
 *   `RecommendedProductSchema` + `RecommendationResponseSchema` + `SubScoresSchema`
 *   + `MatchTypeSchema` + `RecommendationErrorCodeSchema` + `SIGNAL_WEIGHTS`
 *   const + `composeBySignal()` helper — Intent 04 image recommendation FE
 *   carousel + client-side filter chip re-rank consumer; same dual access.
 *
 * **Dual access pattern (S-02 T06 — C-34 RESOLVED, T07 extends to ./sse, T01 extends to ./cart, T02 S-07 extends to ./products):**
 * - **Frontend** (`apps/web`, Next.js bundler with `moduleResolution: bundler`):
 *   prefer subpath `import { BehaviorEventSchema } from '@icp/shared-types/behavior'`
 *   or `import { SseStatusEvent } from '@icp/shared-types/sse'` or
 *   `import { CartSchema } from '@icp/shared-types/cart'` or
 *   `import { ProductDraftSchema } from '@icp/shared-types/products'` for
 *   tree-shaking + clear consumer intent.
 * - **Backend** (`apps/gateway`, NestJS CommonJS with `moduleResolution: node`):
 *   subpath not resolvable due to classic `node` resolution + `"type":
 *   "module"` mismatch (TS1479/TS2307). Import via root:
 *   `import { BehaviorEventSchema, SseStatusEvent, CartSchema, ProductDraftSchema } from '@icp/shared-types'`.
 *   Tree-shaking not critical for BE (full bundle ships in container).
 *
 * **Deferred future folders (per `docs/08_FE_BE_CONTRACT.md` §3):**
 * - `domain/` — entity types (Order, User, ...) → created
 *   per V-SLICE when first entity emerges. NOTE: Cart entity ship as standalone
 *   `cart.ts` (S-05 T01 emit per D-S05-02 LAW); Product entity ship as standalone
 *   `products.ts` (S-07 T02 Phiên Sx07-F per Q5 option b); `domain/` folder
 *   convention deferred.
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
 * Patched S-05 T01 Phiên Sx05-1 (D-S05-02 LAW: cart.ts Cart entity Zod schema + dual access pattern).
 * Patched S-07 T02 Phiên Sx07-F (Q5 option b: products.ts ProductDraftSchema + dual access pattern).
 * Patched S-09 T01 Phiên Sx09-C (D-S09-NN-A LAW + C-S09-G/H: recommendations.ts Intent 04 schemas + dual access pattern).
 */

export * from './primitives';
export * from './dto';
export * from './behavior';
export * from './sse';
export * from './cart';
export * from './products';
export * from './recommendations';
