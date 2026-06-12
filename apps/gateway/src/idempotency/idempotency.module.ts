/**
 * apps/gateway/src/idempotency/idempotency.module.ts
 *
 * S-P0-02/T04 (#31, ADR-049 amend): idempotency = INTERCEPTOR (chạy SAU guard),
 * KHÔNG middleware (chạy trước guard → userId='anon' + tenant từ header client).
 * Đăng ký IdempotencyInterceptor làm APP_INTERCEPTOR (global) — opt-in per-route
 * qua `@Idempotent()` decorator (default OFF, ADR-049). Route gắn decorator:
 *   POST /intent · POST /intent/:rid/action (strategy intent-action) ·
 *   POST/PATCH /products · POST /cards/:id/{accept,reject} · 6 cart writes.
 * CẤM /auth/* (không gắn decorator — ADR-049 replay attack).
 *
 * Vẫn export RedisClient (cart/intent... import). Reflector = Nest core global.
 */

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisClient } from './redis.client';

@Module({
  providers: [
    RedisClient,
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  exports: [RedisClient],
})
export class IdempotencyModule {}
