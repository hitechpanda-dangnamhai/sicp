/**
 * apps/gateway/src/idempotency/idempotency.module.ts
 *
 * NestJS module registering Idempotency middleware on 4 BẮT BUỘC routes
 * per docs/03_API_CONTRACTS.md §1:
 *   - POST   /api/v1/intent
 *   - POST   /api/v1/products
 *   - PATCH  /api/v1/products/:id
 *   - POST   /api/v1/orders/checkout
 *
 * NOTE: The actual controllers for these routes are NOT in T01 scope (they
 * belong to S-03 auth flow + S-04+ V-SLICEs). T01 only registers middleware
 * + Redis client; routes will activate the middleware when downstream slices
 * add their controllers.
 *
 * This is intentional: register middleware infra in T01 (slice S-02 P-CAP =
 * capability foundation), let V-SLICE consumers add business logic later.
 * No 404 issue — middleware only runs when route matches; missing controllers
 * just mean route doesn't exist, request gets standard NestJS 404.
 */

import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { IdempotencyMiddleware } from './idempotency.middleware';
import { RedisClient } from './redis.client';

@Module({
  providers: [IdempotencyMiddleware, RedisClient],
  exports: [RedisClient, IdempotencyMiddleware],
})
export class IdempotencyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        // POST /api/v1/intent
        { path: 'api/v1/intent', method: RequestMethod.POST },
        // POST /api/v1/products
        { path: 'api/v1/products', method: RequestMethod.POST },
        // PATCH /api/v1/products/:id
        { path: 'api/v1/products/:id', method: RequestMethod.PATCH },
        // POST /api/v1/orders/checkout
        { path: 'api/v1/orders/checkout', method: RequestMethod.POST },
      );
  }
}
