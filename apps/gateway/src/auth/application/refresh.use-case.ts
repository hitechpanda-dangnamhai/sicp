/**
 * apps/gateway/src/auth/application/refresh.use-case.ts
 *
 * Use-case: rotating refresh per S-03 BRIEF DM-5 + S-03 C-06.
 *
 * Flow (per OAuth 2.1 BCP rotating refresh):
 *   1. Hash incoming raw refresh token → SHA-256 hex
 *   2. SessionRepo.revokeByRefreshHash(hash) — atomic UPDATE ... WHERE
 *      revoked_at IS NULL AND refresh_expires_at > NOW() ... RETURNING jti, user_id
 *      → null if not found OR already revoked OR expired → RefreshRejectedError
 *   3. RedisSessionStore.del(oldJti) — invalidate fast cache for old session
 *   4. UserRepo.findById(user_id) — need email/role/display_name for new JWT
 *   5. Generate new jti + new rawRefreshToken + new refreshTokenHash
 *   6. JwtHelper.sign new access JWT
 *   7. SessionRepo.create new session row
 *   8. RedisSessionStore.set new cache entry
 *   9. Return new tokens + user for controller to set cookies
 *
 * Replay attack: 2nd refresh with SAME old token → step 2 UPDATE matches 0 rows
 * (revoked_at already NOT NULL from 1st refresh) → null → 401.
 *
 * Concurrent refresh (rare): atomic UPDATE serializes — first wins, second
 * sees revoked → 401. Both clients had valid token momentarily but only one
 * gets new pair. Acceptable trade-off vs. allowing both = sliding window
 * attack window.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PostgresUserRepository } from '../infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from '../infrastructure/postgres-session.repo';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { JwtHelper } from '../jwt.helper';
import { RefreshRejectedError } from '../domain/errors';
import { computeAvatarInitials, type PublicUser } from '../domain/user.entity';
import type { Env } from '../../config/env.schema';

export interface RefreshCommand {
  rawRefreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  rawRefreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  user: PublicUser;
  jti: string;
  oldJti: string;
}

@Injectable()
export class RefreshUseCase {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly users: PostgresUserRepository,
    private readonly sessions: PostgresSessionRepository,
    private readonly store: RedisSessionStore,
    private readonly jwt: JwtHelper,
    config: ConfigService<Env, true>,
  ) {
    const days = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    this.refreshTtlSeconds = days * 86400;
  }

  async execute(cmd: RefreshCommand): Promise<RefreshResult> {
    const oldHash = createHash('sha256').update(cmd.rawRefreshToken).digest('hex');

    const revoked = await this.sessions.revokeByRefreshHash(oldHash);
    if (!revoked) {
      // null could mean: hash unknown, already revoked, or expired. All map
      // to client error (caller MUST re-login). Distinguish via secondary
      // lookup ONLY if observability requires — Phase 6.
      throw new RefreshRejectedError('refresh_unknown');
    }

    // Old session row now revoked_at = NOW(). DEL Redis fast-path for old jti
    // so any in-flight Guard call sees miss → PG fallback → revoked → 401.
    await this.store.del(revoked.jti);

    const user = await this.users.findById(revoked.user_id);
    if (!user) {
      // User deleted concurrently — refresh succeeded revoking old session
      // but no user to issue new one. Treat as rejected.
      throw new RefreshRejectedError('refresh_unknown');
    }

    const newJti = randomUUID();
    const newRawRefreshToken = randomUUID();
    const newRefreshHash = createHash('sha256').update(newRawRefreshToken).digest('hex');

    const { token: accessToken, expiresAt: accessExpiresAt } = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      newJti,
    );
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    await this.sessions.create({
      user_id: user.id,
      jti: newJti,
      refresh_token_hash: newRefreshHash,
      expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    });

    await this.store.set(
      newJti,
      {
        user_id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
      },
      this.jwt.getAccessTtlSeconds(),
    );

    return {
      accessToken,
      rawRefreshToken: newRawRefreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        avatar_initials: computeAvatarInitials(user.display_name),
      },
      jti: newJti,
      oldJti: revoked.jti,
    };
  }
}
