/**
 * apps/gateway/src/products/products.module.ts
 *
 * S-07 T01.E.G NEW (Phiên Sx07-D per C-S07-N Option B).
 *
 * Wires:
 *   - ProductsController (1 endpoint: PATCH /api/v1/products/:id)
 *   - McpClient (via ClientsModule per codebase convention)
 *
 * Idempotency note (Sx07-D hotfix discovered 2026-05-26):
 *   IdempotencyMiddleware for PATCH /api/v1/products/:id is ALREADY registered
 *   globally in idempotency.module.ts line 38 (S-02 T01 baseline + 03_API §1
 *   declares this as 1 of 4 BẮT BUỘC routes). DO NOT re-apply here — duplicate
 *   middleware causes lock_acquired + lock_conflict back-to-back on same request,
 *   returning 409 IDEMPOTENCY_CONFLICT spuriously. This contrasts with cart.module
 *   + cards.module which DO apply IdempotencyMiddleware explicitly because their
 *   routes are NOT in the global allow-list (POST /api/v1/cart/* + POST /api/v1/cards/*
 *   are not declared in 03_API §1 mutating-endpoints catalog).
 *
 * Dependencies via DI:
 *   - ClientsModule exports McpClient
 *   - AuthModule exports JwtAuthGuard
 *   - IdempotencyModule imported only for transitively making the global
 *     middleware effective (no explicit forRoutes here)
 *
 * Reference:
 *   - slices/S-07_decisions-log.md C-S07-N Option B
 *   - apps/gateway/src/idempotency/idempotency.module.ts (global registration)
 *   - apps/gateway/src/cart/cart.module.ts (precedent: cart applies explicitly
 *     since global module doesn't cover cart routes)
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TenantModule } from '../tenant/tenant.module';

import { ProductsController } from './products.controller';

@Module({
  // TenantModule exports TenantResolverService — S-P0-01 T02c identity header.
  imports: [ClientsModule, IdempotencyModule, AuthModule, TenantModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
