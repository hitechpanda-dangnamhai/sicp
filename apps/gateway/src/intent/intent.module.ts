/**
 * apps/gateway/src/intent/intent.module.ts
 *
 * S-02 T07 emit. Wires:
 *   - IntentController (POST + GET stream routes)
 *   - IntentService (AI dispatch + Redis cache + SSE generator)
 *
 * Dependencies via DI (no new providers needed):
 *   - AiClient via ClientsModule (T05 exports)
 *   - RedisClient via IdempotencyModule (T01 line 28 exports)
 *
 * Idempotency middleware (T01) already covers POST /api/v1/intent
 * (idempotency.module.ts line 36) — no extra middleware wiring.
 */

import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { IntentController } from './intent.controller';
import { IntentService } from './intent.service';

@Module({
  imports: [ClientsModule, IdempotencyModule],
  controllers: [IntentController],
  providers: [IntentService],
})
export class IntentModule {}
