/**
 * apps/gateway/src/auth/auth.service.ts
 *
 * AuthService — thin facade over 5 use-cases. Adds ops logging at the service
 * boundary (use-cases stay pure orchestration; service emits operational
 * logs per LOG_CATALOG.md).
 *
 * **Behavior event emission (S-03 T03 Phiên 33):**
 * Per S-03 DM-7 + C-14 RESOLVED, AuthService injects `TrackingService` and
 * emits 3 server-side behavior events via loopback `ingest()` call (NOT HTTP
 * self-call):
 *   - `auth.signed_in` post-login_succeeded
 *   - `auth.signed_out` post-logout_succeeded
 *   - `auth.password_reset_requested` post-forgotPassword
 *
 * **Fire-and-forget pattern:** `emitAuthEvent()` catches all errors and logs
 * `tracker.loopback_failed` warn — DOES NOT throw. Behavior event emission
 * MUST NOT break auth flow per ADR-014 design (catalog-first governance
 * tolerates analytics gaps; auth correctness is non-negotiable).
 *
 * S-03 T02 emit. Extended S-03 T03 Phiên 33 Batch 3 (+TrackingService inject
 * + emitAuthEvent helper + replace 2 TODO at login/logout) + Batch 4
 * (+ForgotPasswordUseCase + forgotPassword method + emit auth.password_reset_requested).
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoginUseCase, type LoginCommand, type LoginResult } from './application/login.use-case';
import { LogoutUseCase, type LogoutCommand } from './application/logout.use-case';
import { GetMeUseCase, type GetMeCommand } from './application/get-me.use-case';
import { RefreshUseCase, type RefreshCommand, type RefreshResult } from './application/refresh.use-case';
import { ForgotPasswordUseCase, type ForgotPasswordCommand } from './application/forgot-password.use-case';
import { TrackingService } from '../tracking/tracking.service';
import type { BehaviorEvent, BehaviorEventType, PropertiesFor } from '@icp/shared-types';
import { createLogger, type IcpLogPayload } from '../observability';
import type { MeResponse } from './domain/user.entity';
import {
  InvalidCredentialsError,
  TokenInvalidError,
  RefreshRejectedError,
} from './domain/errors';
import { createHash } from 'node:crypto';

@Injectable()
export class AuthService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'auth.service' });

  constructor(
    private readonly loginUC: LoginUseCase,
    private readonly logoutUC: LogoutUseCase,
    private readonly getMeUC: GetMeUseCase,
    private readonly refreshUC: RefreshUseCase,
    private readonly forgotPasswordUC: ForgotPasswordUseCase,
    private readonly tracking: TrackingService,
  ) {}

  async login(cmd: LoginCommand & { rememberMe: boolean }): Promise<LoginResult> {
    try {
      const result = await this.loginUC.execute({ email: cmd.email, password: cmd.password });
      const emailHash = this.hashEmail(cmd.email);
      this.log.info(
        {
          message: 'auth.login_succeeded',
          user_id: result.user.id,
          extras: {
            email_hash: emailHash,
            remember_me: cmd.rememberMe,
            jti_prefix: result.jti.slice(0, 8),
          },
        } as IcpLogPayload,
        'auth.login_succeeded',
      );
      // S-03 T03 — emit auth.signed_in behavior event (fire-and-forget)
      void this.emitAuthEvent(
        'auth.signed_in',
        { method: 'password' },
        result.user.id,
        result.jti,
      );
      return result;
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        this.log.warn(
          {
            message: 'auth.login_failed',
            extras: err.logExtras,
          } as IcpLogPayload,
          'auth.login_failed',
        );
      }
      throw err;
    }
  }

  async logout(cmd: LogoutCommand & { userId: string }): Promise<void> {
    await this.logoutUC.execute({ jti: cmd.jti });
    this.log.info(
      {
        message: 'auth.logout_succeeded',
        user_id: cmd.userId,
        extras: { jti_prefix: cmd.jti.slice(0, 8) },
      } as IcpLogPayload,
      'auth.logout_succeeded',
    );
    // S-03 T03 — emit auth.signed_out behavior event (fire-and-forget)
    void this.emitAuthEvent('auth.signed_out', {}, cmd.userId, cmd.jti);
  }

  async me(cmd: GetMeCommand): Promise<MeResponse> {
    try {
      const result = await this.getMeUC.execute(cmd);
      this.log.debug(
        {
          message: 'auth.me_served',
          user_id: cmd.userId,
        } as IcpLogPayload,
        'auth.me_served',
      );
      return result;
    } catch (err) {
      if (err instanceof TokenInvalidError) {
        this.log.warn(
          {
            message: 'auth.token_invalid',
            user_id: cmd.userId,
            extras: err.logExtras,
          } as IcpLogPayload,
          'auth.token_invalid',
        );
      }
      throw err;
    }
  }

  async refresh(cmd: RefreshCommand): Promise<RefreshResult> {
    try {
      const result = await this.refreshUC.execute(cmd);
      this.log.info(
        {
          message: 'auth.token_refreshed',
          user_id: result.user.id,
          extras: {
            old_jti_prefix: result.oldJti.slice(0, 8),
            new_jti_prefix: result.jti.slice(0, 8),
          },
        } as IcpLogPayload,
        'auth.token_refreshed',
      );
      return result;
    } catch (err) {
      if (err instanceof RefreshRejectedError) {
        this.log.warn(
          {
            message: 'auth.refresh_rejected',
            extras: err.logExtras,
          } as IcpLogPayload,
          'auth.refresh_rejected',
        );
      }
      throw err;
    }
  }

  /**
   * Stub forgot-password handler per S-03 C-03 (no SMTP, no DB query, no
   * user enumeration). Always succeeds. Emits ops log + behavior event.
   *
   * NEVER throws — controller layer catches any internal error and still
   * returns `{sent: true}` to client (prevent enumeration via error response).
   */
  async forgotPassword(cmd: ForgotPasswordCommand): Promise<void> {
    const result = await this.forgotPasswordUC.execute(cmd);
    // S-03 T03 — emit auth.password_reset_requested behavior event (fire-and-forget)
    // user_id = undefined (no session — anonymous endpoint per `03_API §1.1`)
    // session_id = 'system' literal (no jti available — pre-authentication flow)
    void this.emitAuthEvent(
      'auth.password_reset_requested',
      { email_hash: result.emailHash },
      undefined,
      'system',
    );
  }

  /**
   * Emit a behavior event via TrackingService loopback (NOT HTTP).
   *
   * Fire-and-forget pattern — catches all errors and logs `tracker.loopback_failed`
   * warn. NEVER throws. Behavior event emission failure must not break auth flow
   * per ADR-014 (catalog-first analytics tolerates gaps).
   *
   * @param eventType — must exist in `PROPERTIES_SCHEMA_MAP` (compile-time check)
   * @param properties — type-narrowed to schema for this event_type
   * @param userId — UUID of authenticated user (undefined for password_reset)
   * @param sessionId — jti for login/logout; literal `'system'` for password_reset
   */
  protected async emitAuthEvent<T extends BehaviorEventType>(
    eventType: T,
    properties: PropertiesFor<T>,
    userId: string | undefined,
    sessionId: string,
  ): Promise<void> {
    const event = {
      event_id: randomUUID(),
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      user_id: userId,
      session_id: sessionId,
      app_version: process.env.APP_VERSION ?? '0.0.1',
      properties,
    } as unknown as BehaviorEvent;

    try {
      await this.tracking.ingest({ events: [event] }, randomUUID());
    } catch (err) {
      this.log.warn(
        {
          message: 'tracker.loopback_failed',
          extras: {
            event_type: eventType,
            error: err instanceof Error ? err.message : String(err),
          },
        } as IcpLogPayload,
        'tracker.loopback_failed',
      );
      // Swallow — behavior event emission must not break auth flow
    }
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex').slice(0, 16);
  }
}
