/**
 * apps/gateway/src/idempotency/idempotency.interceptor.ts
 *
 * S-P0-02/T04 (#31, thi hành ADR-049 amended) — idempotency chuyển từ MIDDLEWARE
 * sang INTERCEPTOR. Interceptor chạy SAU guard chain → scope key lấy từ JWT
 * VERIFIED (`req.user.id` + `req.tenant_id` do membership guard set), KHÔNG đọc
 * `x-tenant-id`/`x-user-scope` từ client (gỡ #31: trước đây MW chạy trước guard →
 * userId='anon' + tenantScope từ header client = thủng isolation).
 *
 * Ngữ nghĩa ADR-049 GIỮ NGUYÊN: per-route opt-in (@Idempotent), default OFF,
 * CẤM /auth/* (không gắn decorator). Lock 30s + cache 24h (standard) /
 * 5min (intent-action composite key {tenant}:{rid}:{attempt_n}, ADR-048).
 * Reuse message LOG_CATALOG cũ (idempotency.* / intent_action_idempotency.*).
 *
 * Cache-hit chỉ serve SAU auth+tenant-resolve (guard đã chạy). Request không JWT
 * → JwtAuthGuard 401 TRƯỚC interceptor → KHÔNG bao giờ chạm cache (acceptance 2).
 * SSE GET /stream không gắn @Idempotent → pass-through (không bị bắt).
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, of, tap } from 'rxjs';
import { RedisClient } from './redis.client';
import { createLogger } from '../observability';
import type { Logger } from 'pino';
import {
  IDEMPOTENT_METADATA,
  type IdempotencyStrategy,
  type IdempotentOptions,
} from './idempotent.decorator';

const LOCK_TTL_SECONDS = 30;
const CACHE_TTL_STANDARD = 86_400; // 24h
const CACHE_TTL_INTENT_ACTION = 300; // 5min (ADR-048)
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADER_NAME = 'idempotency-key';

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Key standard: scope {tenant}:{user} đều từ JWT-verified. tenant ∅ (cart
 * customer 0-membership) → 'notenant' (user verified vẫn cô lập cross-user). */
export function buildStandardKeys(
  tenantId: string | null | undefined,
  userId: string,
  idemKey: string,
): { cacheKey: string; lockKey: string } {
  const t = tenantId ?? 'notenant';
  return {
    cacheKey: `idem:cache:${t}:${userId}:${idemKey}`,
    lockKey: `idem:lock:${t}:${userId}:${idemKey}`,
  };
}

/** Key intent-action: composite {tenant}:{rid}:{attempt_n} (ADR-048). tenant từ
 * req.tenant_id verified (KHÔNG header). ∅ → không prefix (rid UUID toàn cục). */
export function buildIntentActionKeys(
  tenantId: string | null | undefined,
  rid: string,
  attemptN: number,
): { cacheKey: string; lockKey: string } {
  const prefix = tenantId ? `${tenantId}:` : '';
  return {
    cacheKey: `intent:action:${prefix}${rid}:${attemptN}`,
    lockKey: `intent:action:lock:${prefix}${rid}:${attemptN}`,
  };
}

/**
 * Tenant scope cho KEY standard (Plan KI#3): ƯU TIÊN `req.tenant_id` đã verified
 * (membership guard — intent/products/cards). Route customer KHÔNG có verified
 * tenant (cart, 0-membership ADR-046) → dùng X-Tenant-Id (active storefront).
 * An toàn: user_id trong key đã VERIFIED → header tenant client-influenced CHỈ
 * phân mảnh cache của chính user đó (KHÔNG đọc được cache user khác). Lý do CÓ
 * tenant trong key: cùng user mua 2 storefront khác tenant + cùng Idempotency-Key
 * → KHÔNG replay nhầm response tenant này cho tenant kia (correctness).
 */
export function tenantScopeFor(req: {
  tenant_id?: string | null;
  headers?: Record<string, unknown>;
}): string | null {
  if (req.tenant_id) return req.tenant_id; // verified (membership guard)
  const h = req.headers?.['x-tenant-id'];
  return typeof h === 'string' && TENANT_UUID_REGEX.test(h) ? h : null;
}

/** attempt_n từ body._meta.attempt_n (int >0), default 1. */
export function parseAttemptN(body: unknown): number {
  const meta = ((body as Record<string, unknown> | null)?._meta ?? {}) as Record<string, unknown>;
  const n = meta.attempt_n;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 1;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(
    private readonly redis: RedisClient,
    private readonly reflector: Reflector,
  ) {
    this.logger = createLogger({
      service: process.env.OTEL_SERVICE_NAME ?? 'gateway',
      version: process.env.APP_VERSION ?? '0.0.1',
      env: process.env.NODE_ENV ?? 'dev',
    }).child({ component: 'idempotency' });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const meta = this.reflector.getAllAndOverride<IdempotentOptions | undefined>(
      IDEMPOTENT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    // Default OFF — route không @Idempotent → pass-through (gồm SSE /stream).
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const strategy: IdempotencyStrategy = meta.strategy ?? 'standard';
    const comp = strategy === 'intent-action' ? 'intent_action_idempotency' : 'idempotency';

    // Validate Idempotency-Key (UUID v4) — giữ contract S-02.
    const idemKey = (req.headers[HEADER_NAME] as string | undefined)?.trim();
    if (!idemKey) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_FAILED', message: 'Missing required header: Idempotency-Key' },
      });
    }
    if (!UUID_V4_REGEX.test(idemKey)) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_FAILED', message: 'Idempotency-Key must be UUID v4 format' },
      });
    }

    const reqx = req as Request & { user?: { id?: string }; tenant_id?: string | null };
    const userId = reqx.user?.id;
    const tenantId = reqx.tenant_id ?? null;

    let cacheKey: string;
    let lockKey: string;
    let ttl: number;
    let logExtras: Record<string, unknown>;

    if (strategy === 'intent-action') {
      const rid = (req.params as Record<string, string | undefined>)?.rid;
      if (!rid) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_FAILED', message: 'Missing route param: rid (request_id)' },
        });
      }
      const attemptN = parseAttemptN(req.body);
      ({ cacheKey, lockKey } = buildIntentActionKeys(tenantId, rid, attemptN));
      ttl = CACHE_TTL_INTENT_ACTION;
      logExtras = { request_id: rid, attempt_n: attemptN, key_prefix: idemKey.slice(0, 8) };
    } else {
      // standard: user_id BẮT BUỘC verified (guard JwtAuthGuard đã chạy). Thiếu =
      // route opt-in idempotency mà KHÔNG có auth guard → cấu hình sai: KHÔNG cache
      // (pass-through) + cảnh báo, tránh scope key không xác định.
      if (!userId) {
        this.logger.warn({ message: 'idempotency.skipped_unauthenticated', extras: { path: req.path } });
        return next.handle();
      }
      // Plan KI#3: tenant scope = verified req.tenant_id (member route) hoặc
      // X-Tenant-Id active storefront (cart customer) — user_id verified đã chặn
      // cross-user; tenant trong key tránh replay nhầm cross-tenant cùng user.
      const tenantScope = tenantScopeFor({ tenant_id: tenantId, headers: req.headers as Record<string, unknown> });
      ({ cacheKey, lockKey } = buildStandardKeys(tenantScope, userId, idemKey));
      ttl = CACHE_TTL_STANDARD;
      logExtras = { user_id: userId, key_prefix: idemKey.slice(0, 8) };
    }

    // Step 1: Cache hit? → serve SAU auth (guard đã chạy).
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      let parsed: CachedResponse | undefined;
      try {
        parsed = JSON.parse(cached) as CachedResponse;
      } catch {
        this.logger.warn({ message: `${comp}.cache_corrupted`, extras: logExtras });
        await this.redis.del(cacheKey);
      }
      if (parsed) {
        this.logger.debug({ message: `${comp}.cache_hit`, extras: logExtras });
        for (const [name, value] of Object.entries(parsed.headers ?? {})) {
          res.setHeader(name, value);
        }
        res.setHeader('X-Idempotent-Replayed', 'true');
        // Status cached == @HttpCode route (chỉ cache 2xx) → Nest gửi of(body)
        // đúng status. Trả of() thay vì gọi next.handle() = short-circuit handler.
        return of(parsed.body);
      }
    }

    // Step 2: Acquire lock.
    const acquired = await this.redis.setnxWithTtl(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.warn({ message: `${comp}.lock_conflict`, extras: logExtras });
      throw new ConflictException({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Request with same Idempotency-Key is currently in flight',
          details: logExtras,
        },
      });
    }
    this.logger.debug({ message: `${comp}.lock_acquired`, extras: logExtras });

    // Step 3: capture body từ stream handler (thay patch res.json của MW).
    let capturedBody: unknown = undefined;

    // Step 4: cache (2xx) + release lock khi response finish (đọc res.statusCode
    // thật). Mirror MW: errors KHÔNG cache; lock luôn release.
    res.on('finish', () => {
      void (async () => {
        try {
          const status = res.statusCode;
          if (status >= 200 && status < 300 && capturedBody !== undefined) {
            const headersToCache: Record<string, string> = {};
            const ct = res.getHeader('content-type');
            if (typeof ct === 'string') headersToCache['content-type'] = ct;
            const payload: CachedResponse = { status, headers: headersToCache, body: capturedBody };
            await this.redis.setWithTtl(cacheKey, JSON.stringify(payload), ttl);
            this.logger.debug({ message: `${comp}.cached_response_stored`, extras: { ...logExtras, status } });
          }
        } catch (err) {
          this.logger.error({
            message: `${comp}.cache_write_failed`,
            error_message: err instanceof Error ? err.message : String(err),
            extras: logExtras,
          });
        } finally {
          try {
            await this.redis.del(lockKey);
          } catch (delErr) {
            this.logger.error({
              message: `${comp}.lock_release_failed`,
              error_message: delErr instanceof Error ? delErr.message : String(delErr),
              extras: logExtras,
            });
          }
        }
      })();
    });

    // Release lock nếu client disconnect giữa chừng (chưa finish).
    res.on('close', () => {
      if (!res.writableEnded) {
        void this.redis.del(lockKey).catch(() => undefined);
      }
    });

    return next.handle().pipe(tap((body) => (capturedBody = body)));
  }
}
