/**
 * apps/gateway/src/idempotency/idempotent.decorator.ts
 *
 * S-P0-02/T04 (#31, ADR-049 amend) — đánh dấu route opt-in idempotency. Thay
 * cơ chế per-module `.forRoutes()` của middleware cũ bằng decorator + global
 * IdempotencyInterceptor (interceptor chạy SAU guard → scope key từ JWT-verified
 * `req.user.id` + `req.tenant_id`, KHÔNG đọc x-tenant-id/x-user-scope client).
 *
 * Default = OFF (ADR-049): route mutating mới phải gắn `@Idempotent()` explicit.
 * CẤM /auth/* (ADR-049 — replay password attack); KHÔNG gắn ở đó.
 */

import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA = 'icp:idempotent';

/** standard = 24h cache, key {tenant}:{user}:{idem-key}. intent-action = 5min,
 * composite key {tenant}:{rid}:{attempt_n} (ADR-048). */
export type IdempotencyStrategy = 'standard' | 'intent-action';

export interface IdempotentOptions {
  strategy?: IdempotencyStrategy;
}

/** Opt-in idempotency cho 1 route. `@Idempotent()` = standard; `@Idempotent({
 * strategy: 'intent-action' })` cho POST /intent/:rid/action. */
export const Idempotent = (opts: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_METADATA, { strategy: opts.strategy ?? 'standard' });
