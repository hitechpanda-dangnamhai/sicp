/**
 * apps/gateway/src/auth/infrastructure/redis-session.store.ts
 *
 * Redis key-value store for session cache (fast path for JwtAuthGuard).
 *
 * Key namespace: `session:{jti}` (NO collision with S-02 idempotency MW
 * which uses `idem:lock:*` and `idem:cache:*`).
 *
 * Value: JSON of `CachedSession` shape — denormalized subset of PG session +
 * user data (user_id, email, role, display_name). Avoids PG hop on every
 * authed request.
 *
 * TTL: matches JWT access TTL (env JWT_ACCESS_TTL_HOURS × 3600s). When TTL
 * expires naturally OR logout DEL fires, Guard falls back to PG check
 * (defense in depth — Redis miss ≠ session valid).
 *
 * Pattern parity with S-02 T01 `RedisClient` — reuses same singleton injected
 * via DI (no new Redis connection). Auth module declares `RedisClient` in
 * its imports via `IdempotencyModule` re-export.
 *
 * Pipeline note: SET + GET + DEL each = 1 round-trip. For Hackathon scale
 * (<100 RPS) no pipelining needed.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { RedisClient } from '../../idempotency/redis.client';
import type { CachedSession } from '../domain/user.entity';

@Injectable()
export class RedisSessionStore {
  constructor(private readonly redis: RedisClient) {}

  private key(jti: string): string {
    return `session:${jti}`;
  }

  async set(jti: string, session: CachedSession, ttlSeconds: number): Promise<void> {
    await this.redis.setWithTtl(this.key(jti), JSON.stringify(session), ttlSeconds);
  }

  async get(jti: string): Promise<CachedSession | null> {
    const raw = await this.redis.get(this.key(jti));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedSession;
    } catch {
      // Corrupted entry — delete + return null so Guard PG fallback runs.
      await this.redis.del(this.key(jti));
      return null;
    }
  }

  async del(jti: string): Promise<void> {
    await this.redis.del(this.key(jti));
  }
}
