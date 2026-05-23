/**
 * apps/gateway/src/auth/infrastructure/postgres-session.repo.ts
 *
 * Postgres repository for `sessions` table per `02_DATA_MODEL §1` (post-V009).
 *
 * Operations:
 *   - create({...}):                    INSERT new session (login + refresh)
 *   - revoke(jti):                      UPDATE revoked_at = NOW() (logout)
 *   - revokeByRefreshHash(hash):        atomic UPDATE ... RETURNING for
 *                                        rotating refresh per S-03 C-06
 *   - findActiveByRefreshHash(hash):    SELECT for refresh use-case validation
 *   - findActiveByJti(jti):             JwtAuthGuard fallback when Redis miss
 *   - lastLoginAt(userId):              /auth/me display per S-03 C-05+C-07
 *
 * Concurrency note for revokeByRefreshHash:
 *   Atomic UPDATE ... WHERE revoked_at IS NULL ... RETURNING ensures only
 *   the first concurrent refresh attempt succeeds. Second attempt's UPDATE
 *   matches 0 rows → null returned → RefreshRejectedError thrown by use-case.
 *   Prevents race condition where 2 simultaneous refreshes both succeed.
 *
 * Index strategy:
 *   - jti UNIQUE → `idx_sessions_jti` (V001)
 *   - refresh_token_hash UNIQUE → `idx_sessions_refresh_token_hash` (V009)
 *   - user_id has FK but NO dedicated index (lastLoginAt full scan; Hackathon
 *     scale = 5 seed users × few sessions = fine). T01 Review Known Issue.
 *
 * OTel: pg.query spans auto-emitted.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { PgPool } from '../../database';
import type { Session } from '../domain/user.entity';

export interface CreateSessionInput {
  user_id: string;
  jti: string;
  refresh_token_hash: string;
  expires_at: Date;
  refresh_expires_at: Date;
}

@Injectable()
export class PostgresSessionRepository {
  constructor(private readonly pg: PgPool) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const result = await this.pg.query<Session>(
      `INSERT INTO sessions
         (user_id, jti, refresh_token_hash, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, jti, refresh_token_hash, issued_at,
                 expires_at, refresh_expires_at, revoked_at`,
      [
        input.user_id,
        input.jti,
        input.refresh_token_hash,
        input.expires_at,
        input.refresh_expires_at,
      ],
    );
    if (result.rows.length === 0) {
      throw new Error('sessions INSERT returned no rows — pg layer error');
    }
    return result.rows[0];
  }

  async revoke(jti: string): Promise<void> {
    await this.pg.query(
      `UPDATE sessions
          SET revoked_at = NOW()
        WHERE jti = $1
          AND revoked_at IS NULL`,
      [jti],
    );
  }

  /**
   * Atomic rotating refresh per S-03 C-06. Returns the revoked session row
   * (jti + user_id) if the refresh was active AND not yet revoked AND not
   * expired; null otherwise. Caller treats null as RefreshRejectedError.
   *
   * IMPORTANT: returns the OLD jti so use-case can DEL Redis session:{old_jti}.
   */
  async revokeByRefreshHash(
    refreshTokenHash: string,
  ): Promise<{ jti: string; user_id: string } | null> {
    const result = await this.pg.query<{ jti: string; user_id: string }>(
      `UPDATE sessions
          SET revoked_at = NOW()
        WHERE refresh_token_hash = $1
          AND revoked_at IS NULL
          AND refresh_expires_at > NOW()
        RETURNING jti, user_id`,
      [refreshTokenHash],
    );
    return result.rows[0] ?? null;
  }

  async findActiveByRefreshHash(refreshTokenHash: string): Promise<Session | null> {
    const result = await this.pg.query<Session>(
      `SELECT id, user_id, jti, refresh_token_hash, issued_at,
              expires_at, refresh_expires_at, revoked_at
         FROM sessions
        WHERE refresh_token_hash = $1
          AND revoked_at IS NULL
          AND refresh_expires_at > NOW()
        LIMIT 1`,
      [refreshTokenHash],
    );
    return result.rows[0] ?? null;
  }

  /**
   * JwtAuthGuard fallback when Redis miss — confirm PG session still active
   * (not revoked + access window not exceeded).
   */
  async findActiveByJti(jti: string): Promise<Session | null> {
    const result = await this.pg.query<Session>(
      `SELECT id, user_id, jti, refresh_token_hash, issued_at,
              expires_at, refresh_expires_at, revoked_at
         FROM sessions
        WHERE jti = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1`,
      [jti],
    );
    return result.rows[0] ?? null;
  }

  /**
   * /auth/me `last_login_at` = MAX(issued_at) of any non-revoked session for
   * the user. Returns null if user has no active session (shouldn't happen
   * for caller of /auth/me but defensive).
   *
   * Known Issue (T01 Review): no user_id index → full sequential scan. Demo
   * scale OK; Phase 6 add `CREATE INDEX idx_sessions_user_id ON sessions(user_id)`.
   */
  async lastLoginAt(userId: string): Promise<Date | null> {
    const result = await this.pg.query<{ last_login_at: Date | null }>(
      `SELECT MAX(issued_at) AS last_login_at
         FROM sessions
        WHERE user_id = $1
          AND revoked_at IS NULL`,
      [userId],
    );
    return result.rows[0]?.last_login_at ?? null;
  }
}
