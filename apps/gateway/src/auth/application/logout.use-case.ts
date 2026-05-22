/**
 * apps/gateway/src/auth/application/logout.use-case.ts
 *
 * Use-case: invalidate session per S-03 BRIEF DM-3.
 *
 * Flow:
 *   1. RedisSessionStore.del(jti) — fast cache invalidation
 *   2. PostgresSessionRepository.revoke(jti) — UPDATE revoked_at = NOW()
 *      Persists revocation across Redis TTL expiry.
 *
 * Idempotent: re-running on already-revoked session no-ops (UPDATE WHERE
 * revoked_at IS NULL matches 0 rows; DEL on missing Redis key returns 0).
 *
 * Note: controller clears cookies via Set-Cookie Max-Age=0 (outside this
 * use-case scope — pure response-layer concern).
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { PostgresSessionRepository } from '../infrastructure/postgres-session.repo';
import { RedisSessionStore } from '../infrastructure/redis-session.store';

export interface LogoutCommand {
  jti: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: PostgresSessionRepository,
    private readonly store: RedisSessionStore,
  ) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    // Order: Redis DEL first (fast path invalidation for any inflight
    // Guard checks), then PG persist. If Redis fails but PG succeeds,
    // next Guard hit falls back to PG and sees revoked_at NOT NULL → 401.
    await this.store.del(cmd.jti);
    await this.sessions.revoke(cmd.jti);
  }
}
