/**
 * apps/gateway/src/auth/application/login.use-case.ts
 *
 * Use-case: authenticate user + issue session.
 *
 * Flow per S-03 BRIEF DM-1 + decisions C-01 + C-02 + C-05:
 *   1. UserRepo.findByEmail → InvalidCredentialsError('user_not_found') if null
 *   2. bcryptjs.compare(plaintext, user.password_hash) → InvalidCredentialsError(
 *      'password_mismatch') if false
 *   3. Generate jti = randomUUID() — session identifier
 *   4. Generate rawRefreshToken = randomUUID() — sent in icp_refresh cookie
 *   5. refreshTokenHash = SHA-256 hex(rawRefreshToken) — what we PERSIST
 *   6. JwtHelper.sign({sub, email, role}, jti) → access JWT
 *   7. SessionRepo.create({user_id, jti, refresh_token_hash, expires_at, refresh_expires_at})
 *   8. RedisSessionStore.set(jti, {user_id, email, role, display_name}, ttl)
 *   9. Return tokens + computed user (with avatar_initials) for controller
 *      to set cookies + send body.
 *
 * `remember_me` is COOKIE BEHAVIOR ONLY (controller sets Max-Age). JWT TTL
 * is fixed by env per S-03 BRIEF AC-2 note. Refresh TTL also fixed.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { compare } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { PostgresUserRepository } from '../infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from '../infrastructure/postgres-session.repo';
import { PostgresMembershipRepository } from '../infrastructure/postgres-membership.repo';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { JwtHelper } from '../jwt.helper';
import { InvalidCredentialsError } from '../domain/errors';
import { computeAvatarInitials, type PublicUser } from '../domain/user.entity';
import type { Env } from '../../config/env.schema';

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  rawRefreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  user: PublicUser;
  jti: string;
  /**
   * S-P0-01 T02 (ADR-046 amend c) — danh sách tenant user là member (JWT claim).
   * KHÔNG phải active tenant. [] = customer global.
   */
  tenantIds: string[];
}

@Injectable()
export class LoginUseCase {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly users: PostgresUserRepository,
    private readonly sessions: PostgresSessionRepository,
    private readonly memberships: PostgresMembershipRepository,
    private readonly store: RedisSessionStore,
    private readonly jwt: JwtHelper,
    config: ConfigService<Env, true>,
  ) {
    const days = config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    this.refreshTtlSeconds = days * 86400;
  }

  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const emailHash = createHash('sha256').update(cmd.email).digest('hex').slice(0, 16);

    const user = await this.users.findByEmail(cmd.email);
    if (!user) {
      throw new InvalidCredentialsError('user_not_found', emailHash);
    }

    const passwordOk = await compare(cmd.password, user.password_hash);
    if (!passwordOk) {
      throw new InvalidCredentialsError('password_mismatch', emailHash);
    }

    // S-P0-01 T02 (ADR-046 amend c) — list memberships → JWT.tenant_ids. KHÔNG
    // resolve "default active" (active tenant = URL, không phải claim).
    const tenantIds = await this.memberships.findTenantIds(user.id);

    const jti = randomUUID();
    const rawRefreshToken = randomUUID();
    const refreshTokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const { token: accessToken, expiresAt: accessExpiresAt } = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, tenant_ids: tenantIds },
      jti,
    );
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    await this.sessions.create({
      user_id: user.id,
      jti,
      refresh_token_hash: refreshTokenHash,
      expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    });

    await this.store.set(
      jti,
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
      rawRefreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        avatar_initials: computeAvatarInitials(user.display_name),
      },
      jti,
      tenantIds,
    };
  }
}
