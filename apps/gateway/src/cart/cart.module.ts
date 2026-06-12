/**
 * apps/gateway/src/cart/cart.module.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-01 LAW Hybrid Cart Routing topology).
 *
 * Wires:
 *   - CartController (7 endpoints map 1:1 to MCP cart.* tools per D-S05-02 LAW)
 *   - CartService (MCP JSON-RPC client wrapper)
 *
 * Middleware:
 *   - IdempotencyMiddleware (S-02 T01) auto-covers POST /api/v1/intent +
 *     a few other write routes via idempotency.module.ts. For cart write
 *     endpoints (POST/PATCH/DELETE), apply same middleware on routes
 *     configured via NestModule.configure() below.
 *
 * Dependencies via DI:
 *   - IdempotencyModule exports RedisClient + IdempotencyMiddleware
 *   - AuthModule exports JwtAuthGuard (cookie-based auth per S-03 T02)
 *
 * Per D-S05-01 LAW Hybrid Routing:
 *   Direct REST endpoints (this module) handle: cart.get / cart.update_qty /
 *   cart.remove / cart.clear / cart.apply_promo / cart.remove_promo.
 *   Pattern A interrupt flows (clear-confirm + stock-resolve) go through
 *   the existing /api/v1/intent endpoint with hint='cart_clear_confirm' or
 *   'cart_view_with_stock_check' — NOT via this REST module.
 *
 * @see slices/S-05_decisions-log.md D-S05-01 LAW + D-S05-02 LAW
 * @see apps/gateway/src/intent/intent-action.controller.ts (reference for
 *      JwtAuthGuard + idempotency middleware composition pattern)
 */

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { IdempotencyMiddleware } from '../idempotency/idempotency.middleware';
import { TenantModule } from '../tenant/tenant.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  // TenantModule exports TenantResolverService — S-P0-01 T02c identity header.
  imports: [ClientsModule, IdempotencyModule, AuthModule, TenantModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply IdempotencyMiddleware (S-02 T01) to cart write endpoints. Read
    // endpoints (GET /cart) do not need Idempotency-Key per ADR-004 — only
    // mutations require dedup.
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: 'api/v1/cart/items', method: RequestMethod.POST },
        { path: 'api/v1/cart/items/:productId', method: RequestMethod.PATCH },
        { path: 'api/v1/cart/items/:productId', method: RequestMethod.DELETE },
        { path: 'api/v1/cart', method: RequestMethod.DELETE },
        { path: 'api/v1/cart/promo', method: RequestMethod.POST },
        { path: 'api/v1/cart/promo', method: RequestMethod.DELETE },
      );
  }
}
