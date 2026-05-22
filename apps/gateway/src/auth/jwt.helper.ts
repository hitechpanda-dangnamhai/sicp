/**
 * apps/gateway/src/auth/jwt.helper.ts
 *
 * Raw `jsonwebtoken` HS256 helper — sign/verify access JWT.
 *
 * Why raw helper (not @nestjs/jwt or passport-jwt):
 *   - C-13 RESOLVED Phiên 32 — adding passport for one Guard is over-engineering
 *     for hackathon. Raw helper + custom Guard (jwt-auth.guard.ts) is simpler,
 *     fewer deps, full control over error mapping.
 *   - jsonwebtoken@^9 is widely audited + stable.
 *
 * Algorithm: HS256.
 * Secret: validated min 32 chars at env boot (env.schema.ts).
 * TTL: env-driven via JWT_ACCESS_TTL_HOURS (default 24).
 *
 * Payload shape per `02_DATA_MODEL §1 sessions.jti` linkage — `jti` field
 * carries session ID for revocation lookup in Guard + logout/refresh.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  sign,
  verify,
  JsonWebTokenError,
  TokenExpiredError,
  type SignOptions,
} from 'jsonwebtoken';
import type { Env } from '../config/env.schema';
import { TokenInvalidError } from './domain/errors';

export interface JwtPayload {
  sub: string;          // user.id (UUID)
  email: string;
  role: 'merchant' | 'customer' | 'admin';
  jti: string;          // session jti for revocation lookup
  iat: number;          // issued at (seconds)
  exp: number;          // expires at (seconds)
}

export type JwtPayloadInput = Pick<JwtPayload, 'sub' | 'email' | 'role'>;

@Injectable()
export class JwtHelper {
  private readonly secret: string;
  private readonly accessTtlSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('JWT_SECRET', { infer: true });
    const hours = config.get('JWT_ACCESS_TTL_HOURS', { infer: true });
    this.accessTtlSeconds = hours * 3600;
  }

  /**
   * Sign an access JWT.
   *
   * @param payload {sub, email, role} — user identity
   * @param jti     session jti (matches PG sessions.jti VARCHAR(64))
   * @returns       {token, expiresAt} — expiresAt is Date object for PG insert
   */
  sign(payload: JwtPayloadInput, jti: string): { token: string; expiresAt: Date } {
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: this.accessTtlSeconds,
      jwtid: jti,
    };
    // jsonwebtoken auto-fills iat + exp + jti from options; we pass only the
    // semantic payload (sub/email/role).
    const token = sign(payload, this.secret, options);
    const expiresAt = new Date(Date.now() + this.accessTtlSeconds * 1000);
    return { token, expiresAt };
  }

  /**
   * Verify an access JWT signature + expiry.
   *
   * @throws TokenInvalidError with specific reason for ops mapping
   */
  verify(token: string): JwtPayload {
    try {
      const decoded = verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || decoded === null) {
        // jsonwebtoken returns string only when JWT payload is itself a string;
        // our sign() always uses object payload — defense in depth.
        throw new TokenInvalidError('jwt_malformed');
      }
      const payload = decoded as JwtPayload;
      // Defensive shape check — fields jsonwebtoken sets vs we set
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.role !== 'string' ||
        typeof payload.jti !== 'string'
      ) {
        throw new TokenInvalidError('jwt_malformed');
      }
      return payload;
    } catch (err) {
      if (err instanceof TokenInvalidError) throw err;
      if (err instanceof TokenExpiredError) throw new TokenInvalidError('jwt_expired');
      if (err instanceof JsonWebTokenError) throw new TokenInvalidError('jwt_signature_invalid');
      throw new TokenInvalidError('jwt_malformed');
    }
  }

  /**
   * Access TTL in seconds — exposed for cookie Max-Age calc (when rememberMe).
   */
  getAccessTtlSeconds(): number {
    return this.accessTtlSeconds;
  }
}
