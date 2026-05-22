/**
 * apps/gateway/src/auth/jwt-auth.guard.ts
 *
 * Custom NestJS Guard implementing `CanActivate`.
 *
 * Flow (per S-03 BRIEF DM-4 + decisions C-01 + C-06):
 *   1. Extract `req.cookies.icp_session` (cookie-parser MW populated globally
 *      in main.ts per C-13).
 *   2. If absent → 401 + log `auth.token_invalid{reason: missing_cookie}`.
 *   3. JwtHelper.verify() → catches expired/malformed/signature → 401 with
 *      specific log reason.
 *   4. Revocation check: RedisSessionStore.get(jti) HIT? → fallback PG
 *      SessionRepository.findActiveByJti(jti). Either confirms session still
 *      active OR rejects (revoked/not found) → 401.
 *   5. Attach `req.user = {id, email, role, display_name}` (typed via module
 *      augmentation below) → handler proceeds.
 *
 * Module augmentation target: `'express'` (not `'express-serve-static-core'`).
 * Augmenting the top-level express module re-exports Request with our
 * extension; works with @types/express@^4.17.21 + transitive
 * @types/express-serve-static-core dependency.
 *
 * S-03 T02 emit.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtHelper, type JwtPayload } from './jwt.helper';
import { RedisSessionStore } from './infrastructure/redis-session.store';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { TokenInvalidError } from './domain/errors';
import { createLogger, type IcpLogPayload } from '../observability';

export interface AuthedUser {
  id: string;
  email: string;
  role: 'merchant' | 'customer' | 'admin';
  display_name: string;
  jti: string;
}

/**
 * Augment Express `Request` to carry optional `user` field populated by
 * JwtAuthGuard. Downstream controllers expecting an authed request narrow
 * via `AuthedRequest` (where `user` is required) — see below.
 */
declare module 'express' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Helper type for controller handlers — narrows `user` to required.
 * Use as `@Req() req: AuthedRequest` after `@UseGuards(JwtAuthGuard)`.
 */
export type AuthedRequest = Request & { user: AuthedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'auth.guard' });

  constructor(
    private readonly jwt: JwtHelper,
    private readonly sessionStore: RedisSessionStore,
    private readonly sessionRepo: PostgresSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.['icp_session'] as string | undefined;

    if (!token || token.length === 0) {
      this.logInvalid('missing_cookie');
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing icp_session cookie' },
      });
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(token);
    } catch (err) {
      if (err instanceof TokenInvalidError) {
        const reason = (err.logExtras?.reason as string) ?? 'jwt_malformed';
        this.logInvalid(reason);
        throw new UnauthorizedException({
          error: { code: 'UNAUTHORIZED', message: 'Token invalid or expired' },
        });
      }
      throw err;
    }

    // Revocation check — try Redis fast path first.
    const cached = await this.sessionStore.get(payload.jti);
    let displayName = cached?.display_name ?? '';
    if (!cached) {
      // Redis miss → fallback PG (Redis TTL may have expired naturally, but
      // PG row may still be valid within its expires_at window).
      const session = await this.sessionRepo.findActiveByJti(payload.jti);
      if (!session) {
        this.logInvalid('session_revoked', payload.sub, payload.jti);
        throw new UnauthorizedException({
          error: { code: 'UNAUTHORIZED', message: 'Session revoked' },
        });
      }
      // Session valid per PG; do NOT rehydrate Redis here — that's the
      // login/refresh use-case responsibility. display_name unavailable
      // from session row alone; leave empty (controller use-cases call
      // findById for fresh data anyway when needed).
    }

    // Attach to req — downstream handlers read req.user.
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      display_name: displayName,
      jti: payload.jti,
    };

    return true;
  }

  private logInvalid(reason: string, userId?: string, jti?: string): void {
    this.log.warn(
      {
        message: 'auth.token_invalid',
        user_id: userId,
        extras: { reason, jti_prefix: jti?.slice(0, 8) },
      } as IcpLogPayload,
      'auth.token_invalid',
    );
  }
}
