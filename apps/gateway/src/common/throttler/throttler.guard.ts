/**
 * apps/gateway/src/common/throttler/throttler.guard.ts
 *
 * S-P0-02/T03 W-60 — custom ThrottlerGuard:
 *  - getTracker: key theo authenticated user nếu có, else IP. LƯU Ý: guard
 *    global chạy TRƯỚC route-guard (JwtAuthGuard) nên với route auth-gated
 *    (intent) req.user CHƯA set tại tracker → key = IP ở perimeter. Đây là
 *    đúng tầng edge (brute-force = IP-based). True per-user/per-tenant quota =
 *    W-99/C-tenant (out of scope task này).
 *  - 429 envelope = HIỆN HÀNH `{ error: { code, message } }` + Retry-After
 *    (giây) — header do ThrottlerGuard base set trong handleRequest.
 */

import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Tracker key: 'u:<userId>' khi đã auth, else 'ip:<ip>'. PURE — unit-test được. */
export function resolveTracker(req: { user?: { id?: string }; ip?: string }): string {
  const userId = req.user?.id;
  return userId ? `u:${userId}` : `ip:${req.ip ?? 'unknown'}`;
}

@Injectable()
export class IcpThrottlerGuard extends ThrottlerGuard {
  private readonly log = new Logger(IcpThrottlerGuard.name);

  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(resolveTracker(req as Request & { user?: { id?: string } }));
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    // Base ThrottlerGuard set `Retry-After-<name>` (named, giây). Thêm header
    // CHUẨN `Retry-After` (giây) để client/proxy hiểu — task T03 yêu cầu.
    res.header('Retry-After', String(detail.timeToBlockExpire));
    this.log.warn(
      JSON.stringify({
        message: 'throttle.limit_exceeded',
        extras: {
          throttler: detail.key, // key = '<throttlerName>-<tracker-hash>'
          tracker: detail.tracker,
          method: req.method,
          path: req.path,
          ttl_ms: detail.timeToBlockExpire,
        },
      }),
    );
    throw new HttpException(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Quá nhiều request — thử lại sau (rate limit).',
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Re-export ThrottlerException để test/khác dùng nếu cần.
export { ThrottlerException };
