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
 * Middleware registration:
 *   - Base `IdempotencyMiddleware` (S-02 T01) ALREADY covers POST /api/v1/intent
 *     via `idempotency.module.ts` line 36 — no change needed.
 *   - `IntentActionIdempotencyMiddleware` applies ONLY to
 *     `POST /api/v1/intent/:rid/action` — distinct composite key namespace.
 *   - NEW `/api/v1/intent/:rid/suggest-attrs` uses the BASE S-02
 *     IdempotencyMiddleware (simple `idem:cache:{userId}:{key}` namespace) —
 *     no composite key needed because this is NOT a graph resume action.
 *     Wired automatically via base idempotency.module RequestMethod.ALL coverage
 *     on `api/v1/*` POST routes (verified existing pattern S-02 T01).
 *
 * @see slices/S-04_decisions-log.md D-S04-13 LAW (Pattern A + Option α + composite key)
 * @see slices/S-07_decisions-log.md C-S07-O (Sx07-G hotfix — separate endpoint)
 * @see apps/gateway/src/idempotency/idempotency.module.ts (base S-02 middleware)
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
import { IntentActionIdempotencyMiddleware } from './intent-action-idempotency.middleware';
import { IntentActionController } from './intent-action.controller';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';
import { IntentSuggestAttrsController } from './intent-suggest-attrs.controller';

@Module({
  imports: [ClientsModule, IdempotencyModule, AuthModule],
  controllers: [
    IntentController,
    IntentActionController,
    IntentSuggestAttrsController,
  ],
  providers: [IntentService, IntentActionIdempotencyMiddleware],
})
export class IntentModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(IntentActionIdempotencyMiddleware)
      .forRoutes({
        path: 'api/v1/intent/:rid/action',
        method: RequestMethod.POST,
      });
  }
}
