/**
 * apps/gateway/src/auth/auth.controller.ts
 *
 * S-03 T02 — Auth controller exposing 5 REST endpoints per `03_API_CONTRACTS §1.1`
 * (post Phase 1 inline reconcile):
 *
 *   POST /api/v1/auth/login            — issue session (NO Guard; reads body)
 *   POST /api/v1/auth/logout           — invalidate session (Guard required)
 *   GET  /api/v1/auth/me               — current user (Guard required)
 *   POST /api/v1/auth/refresh          — rotating refresh (custom cookie check, NO Guard)
 *   POST /api/v1/auth/forgot-password  — stub (NO Guard; reads body; S-03 T03)
 *
 * Cookie response shape per S-03 C-01 + ADR-019 LOCKED:
 *   - `icp_session`  httpOnly + SameSite=Lax  + Path=/                + Max-Age=accessTTL if rememberMe
 *   - `icp_refresh`  httpOnly + SameSite=Strict + Path=/api/v1/auth   + Max-Age=refreshTTL if rememberMe
 *   - Secure flag from env COOKIE_SECURE
 *
 * Manual span wrap per S-02 T07 pattern — each endpoint creates a
 * `gateway.auth.{verb}` span for OTel trace continuity. Child pg.query +
 * redis.command spans auto-emit via T01 setup.
 *
 * Idempotency MW: NOT applied per S-03 C-13 (per-route opt-in, /auth/* not
 * in MW route list).
 *
 * S-03 T02 emit. Extended S-03 T03 Phiên 33 Batch 4 (+POST /forgot-password
 * stub endpoint per S-03 C-03 + 03_API §1.1).
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { trace, context, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, MeResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto, ForgotPasswordResponseDto } from './dto/forgot-password.dto';
import {
  InvalidCredentialsError,
  RefreshRejectedError,
  TokenInvalidError,
} from './domain/errors';
import type { Env } from '../config/env.schema';

function getTracer(): Tracer {
  return trace.getTracer('gateway.auth.controller');
}

const COOKIE_SESSION = 'icp_session';
const COOKIE_REFRESH = 'icp_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  private readonly cookieSecure: boolean;
  private readonly refreshTtlSeconds: number;
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSecure = config.get('COOKIE_SECURE', { infer: true });
    this.refreshTtlSeconds = config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 86400;
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL_HOURS', { infer: true }) * 3600;
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /auth/login
  // ────────────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user (email + password) — issue session cookies',
    description:
      'Returns 200 with 2 Set-Cookie headers (icp_session SameSite=Lax + ' +
      'icp_refresh SameSite=Strict) and body {user: PublicUser}. NO tokens in body ' +
      'per ADR-019 + S-03 C-01.',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: LoginResponseDto['user'] }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.auth.login');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await this.authService.login({
          email: body.email,
          password: body.password,
          rememberMe: body.remember_me,
        });
        span.setAttribute('auth.user_id_prefix', result.user.id.slice(0, 8));
        this.setAuthCookies(res, result.accessToken, result.rawRefreshToken, body.remember_me);
        return { user: result.user };
      } catch (err) {
        if (err instanceof InvalidCredentialsError) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'invalid_credentials' });
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
          });
        }
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /auth/logout
  // ────────────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Invalidate current session',
    description:
      'Requires icp_session cookie. Clears both auth cookies (Max-Age=0) + DEL ' +
      'Redis session:{jti} + UPDATE PG sessions.revoked_at=NOW(). Idempotent.',
  })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 401 })
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.auth.logout');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        span.setAttribute('auth.user_id_prefix', req.user.id.slice(0, 8));
        await this.authService.logout({ jti: req.user.jti, userId: req.user.id });
        this.clearAuthCookies(res);
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /auth/me
  // ────────────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('icp_session')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns 200 with user shape including avatar_initials (server-computed) ' +
      'and last_login_at (MAX issued_at from sessions). Requires icp_session cookie.',
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiResponse({ status: 401 })
  async getMe(@Req() req: AuthedRequest): Promise<MeResponseDto> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.auth.me');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        span.setAttribute('auth.user_id_prefix', req.user.id.slice(0, 8));
        const result = await this.authService.me({ userId: req.user.id });
        return result as MeResponseDto;
      } catch (err) {
        if (err instanceof TokenInvalidError) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'session_not_found' });
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Session not found' },
          });
        }
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /auth/refresh
  // ────────────────────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotating refresh — exchange refresh cookie for new pair',
    description:
      'Reads icp_refresh cookie (NOT icp_session — separate path). Atomically ' +
      'revokes old refresh + issues new pair. Replay → 401. Per S-03 C-06.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Refresh token missing/expired/revoked' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.auth.refresh');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const rawRefresh = req.cookies?.[COOKIE_REFRESH] as string | undefined;
        if (!rawRefresh || rawRefresh.length === 0) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'refresh_missing' });
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Refresh cookie missing' },
          });
        }
        const result = await this.authService.refresh({ rawRefreshToken: rawRefresh });
        span.setAttribute('auth.user_id_prefix', result.user.id.slice(0, 8));
        // Use rememberMe semantics: refresh preserves persistence — if the
        // client had a long-lived refresh cookie, it expects new cookies to
        // also be long-lived. Phase 6 may add explicit `remember_me` flag
        // re-read from old session row. For T02 default: rememberMe=true so
        // new cookies persist (matches "refresh on background tab" UX).
        this.setAuthCookies(res, result.accessToken, result.rawRefreshToken, true);
        return { ok: true as const };
      } catch (err) {
        if (err instanceof RefreshRejectedError) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'refresh_rejected' });
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Refresh token rejected' },
          });
        }
        if (err instanceof UnauthorizedException) throw err;
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // POST /auth/forgot-password — S-03 T03 stub per S-03 C-03 + 03_API §1.1
  // ────────────────────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset — stub (no real SMTP)',
    description:
      'Per S-03 C-03 stub Phase 02. Always returns {sent: true} regardless of ' +
      'email existence (no user enumeration per OWASP). Emits ' +
      'auth.password_reset_requested behavior event for analytics tracking. NO ' +
      'database query, NO SMTP integration. Phase 6 productionization adds real ' +
      'email service + reset token table.',
  })
  @ApiResponse({ status: 200, type: ForgotPasswordResponseDto })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<{ sent: true }> {
    const tracer = getTracer();
    const span = tracer.startSpan('gateway.auth.forgot_password');
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        await this.authService.forgotPassword({ email: body.email });
        return { sent: true as const };
      } catch (err) {
        // Catch ALL errors — do NOT leak user existence via specific responses
        // per OWASP no-enumeration. Behavior event emission is fire-and-forget
        // (AuthService.forgotPassword never throws per service contract), but
        // defensive catch here handles any unforeseen runtime issues.
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        return { sent: true as const }; // Always return success
      } finally {
        span.end();
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Cookie helpers
  // ────────────────────────────────────────────────────────────────────────

  private setAuthCookies(
    res: Response,
    accessToken: string,
    rawRefreshToken: string,
    rememberMe: boolean,
  ): void {
    res.cookie(COOKIE_SESSION, accessToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
      ...(rememberMe ? { maxAge: this.accessTtlSeconds * 1000 } : {}),
    });
    res.cookie(COOKIE_REFRESH, rawRefreshToken, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      ...(rememberMe ? { maxAge: this.refreshTtlSeconds * 1000 } : {}),
    });
  }

  private clearAuthCookies(res: Response): void {
    res.cookie(COOKIE_SESSION, '', {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    res.cookie(COOKIE_REFRESH, '', {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: 0,
    });
  }
}
