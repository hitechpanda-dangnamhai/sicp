/**
 * apps/gateway/src/auth/auth.service.ts
 *
 * AuthService — thin facade over 4 use-cases. Adds ops logging at the service
 * boundary (use-cases stay pure orchestration; service emits operational
 * logs per LOG_CATALOG.md).
 *
 * Behavior event emission (auth.signed_in / auth.signed_out /
 * auth.password_reset_requested) is OUT OF T02 SCOPE — T03 will inject
 * TrackingService here once TrackingModule exports it. T02 emits ops logs
 * only (Loki-side), zero behavior event emission. Placeholder TODOs marked
 * inline for T03 hook points.
 *
 * S-03 T02 emit.
 */

import { Injectable } from '@nestjs/common';
import { LoginUseCase, type LoginCommand, type LoginResult } from './application/login.use-case';
import { LogoutUseCase, type LogoutCommand } from './application/logout.use-case';
import { GetMeUseCase, type GetMeCommand } from './application/get-me.use-case';
import { RefreshUseCase, type RefreshCommand, type RefreshResult } from './application/refresh.use-case';
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
      // TODO(T03): trackingService.emit('auth.signed_in', {user_id, method: 'password'})
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
    // TODO(T03): trackingService.emit('auth.signed_out', {user_id})
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

  private hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex').slice(0, 16);
  }
}
