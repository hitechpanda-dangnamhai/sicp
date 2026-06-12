/**
 * apps/gateway/src/intent/intent.module.ts
 *
 * S-02 T07 emit. S-04 T03 amendment (Phiên Sx04-8b per D-S04-13 LAW).
 * S-07 T02 amendment (Phiên Sx07-F per C-S07-O Sx07-G hotfix):
 *   ADD IntentSuggestAttrsController for POST /api/v1/intent/:rid/suggest-attrs.
 *
 * Wires:
 *   - IntentController (POST /api/v1/intent + GET /api/v1/intent/stream)
 *   - IntentActionController NEW S-04 T03 (POST /api/v1/intent/:rid/action)
 *   - IntentSuggestAttrsController NEW S-07 T02 (POST /api/v1/intent/:rid/suggest-attrs)
 *   - IntentService (AI dispatch + Redis cache)
 *   - IntentActionIdempotencyMiddleware NEW S-04 T03 (composite key
 *     `intent:action:{rid}:{attempt_n}` TTL 5min per `02_DATA_MODEL.md §5`)
 *
 * Dependencies via DI (S-04 T03 ADD AuthModule for JwtAuthGuard;
 *  S-07 T02 inherits — suggest-attrs also uses JwtAuthGuard + McpClient):
 *   - AiClient via ClientsModule (T05 exports)
 *   - McpClient via ClientsModule (T05 exports — used by suggest-attrs proxy)
 *   - RedisClient via IdempotencyModule (T01 line 28 exports)
 *   - JwtAuthGuard via AuthModule (S-03 T02 exports — used on /action + /suggest-attrs)
 *
 * Idempotency (S-P0-02/T04 #31 — interceptor, KHÔNG middleware):
 *   - POST /api/v1/intent → `@Idempotent()` (standard 24h).
 *   - POST /api/v1/intent/:rid/action → `@Idempotent({strategy:'intent-action'})`
 *     (composite key {tenant}:{rid}:{attempt_n} 5min, ADR-048).
 *   - POST /api/v1/intent/:rid/suggest-attrs = **KHÔNG idempotent** (đính chính
 *     KI#6 T04: comment cũ SAI — base middleware forRoutes `api/v1/intent` KHÔNG
 *     match sub-path nên suggest-attrs CHƯA TỪNG được cover thật). Candidate
 *     idempotent sau nếu cần (gắn @Idempotent()), không tạo task riêng.
 *
 * @see slices/S-04_decisions-log.md D-S04-13 LAW (Pattern A + Option α + composite key)
 * @see slices/S-07_decisions-log.md C-S07-O (Sx07-G hotfix — separate endpoint)
 * @see apps/gateway/src/idempotency/idempotency.module.ts (base S-02 middleware)
 */

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { IntentActionController } from './intent-action.controller';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';
import { IntentPolicyGuard } from './intent-policy.guard';
import { IntentSuggestAttrsController } from './intent-suggest-attrs.controller';

// S-P0-02/T04 (#31, ADR-049 amend): POST /intent = `@Idempotent()`, POST
// /intent/:rid/action = `@Idempotent({strategy:'intent-action'})` (composite key
// {tenant}:{rid}:{attempt_n} TTL 5min, ADR-048) — decorator + global
// IdempotencyInterceptor (SAU guard). KHÔNG còn IntentActionIdempotencyMiddleware.
@Module({
  imports: [ClientsModule, IdempotencyModule, AuthModule, TenantModule],
  controllers: [
    IntentController,
    IntentActionController,
    IntentSuggestAttrsController,
  ],
  providers: [IntentService, IntentPolicyGuard],
})
export class IntentModule {}
