/**
 * apps/gateway/src/cards/cards.module.ts
 *
 * S-07 T01.E NEW (Phiên Sx07-D per C-S07-A).
 *
 * Wires:
 *   - CardsController (3 endpoints: GET /api/v1/cards + POST :id/accept + POST :id/reject)
 *   - McpClient (provided via ClientsModule per codebase convention verified
 *     Phiên Sx07-D — clients.module.ts is the centralized DI module for all
 *     upstream HTTP clients; cards.module.ts MUST import ClientsModule rather
 *     than provide McpClient locally — same pattern as cart.module.ts).
 *
 * Dependencies via DI:
 *   - ClientsModule exports McpClient (added T01.E amendment to clients.module.ts)
 *   - AuthModule exports JwtAuthGuard (cookie-based auth per S-03 T02)
 *   - IdempotencyModule exports IdempotencyMiddleware (S-02 T01) — applied
 *     to POST routes via NestModule.configure() below
 *
 * Idempotency route paths use literal `api/v1/cards/...` per codebase
 * convention (no setGlobalPrefix in main.ts; cart.module.ts uses same
 * literal-path style).
 *
 * Reference:
 *   - slices/S-07_decisions-log.md C-S07-A (cards.* MCP tools formalized)
 *   - apps/gateway/src/cart/cart.module.ts (precedent pattern S-05 T02)
 *   - apps/gateway/src/clients/clients.module.ts (S-02 T05 + S-07 T01.E amend)
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TenantModule } from '../tenant/tenant.module';

import { CardsController } from './cards.controller';

// S-P0-02/T04 (#31): idempotency accept/reject = `@Idempotent()` decorator trên
// route + global IdempotencyInterceptor (SAU guard) — KHÔNG còn middleware forRoutes.
@Module({
  // TenantModule exports TenantResolverService — S-P0-01 T02c identity header.
  imports: [ClientsModule, IdempotencyModule, AuthModule, TenantModule],
  controllers: [CardsController],
})
export class CardsModule {}
