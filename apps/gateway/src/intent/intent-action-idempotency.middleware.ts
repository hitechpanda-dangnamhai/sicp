/**
 * apps/gateway/src/intent/intent-action-idempotency.middleware.ts
 *
 * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW + C-S04-N resolution).
 *
 * NestJS middleware implementing Idempotency-Key pattern for the
 * `POST /api/v1/intent/:rid/action` endpoint, with composite Redis key
 * `intent:action:{rid}:{attempt_n}` per `02_DATA_MODEL.md §5` (TTL 5min).
 *
 * **Why a SEPARATE middleware vs reusing existing `IdempotencyMiddleware`:**
 *
 * The base S-02 `IdempotencyMiddleware` hardcodes cache key namespace
 * `idem:cache:{userId}:{idempotencyKey}` for the 4 BẮT BUỘC routes per
 * `03_API_CONTRACTS.md §1` (POST /intent, POST /products, PATCH /products/:id,
 * POST /orders/checkout). The /action endpoint has DIFFERENT dedup semantics:
 *
 *   - Key MUST include `request_id` (`rid`) to scope dedup per intent session
 *   - Key MUST include `attempt_n` to allow legitimate retry with monotonic
 *     counter (e.g. user taps "Thử lại AI" then "Dùng bản cơ bản" for same rid)
 *   - TTL MUST be shorter (5min vs 24h) — action choices are session-scoped
 *
 * Refactoring base middleware to support per-route key strategy would risk
 * breaking S-02 baseline + S-03 paths already smoke PASS. This middleware
 * implements the same SETNX lock + cache pattern but with composite key
 * derivation from route params + body — clean separation, no S-02 regression
 * risk.
 *
 * **Flow** (mirrors S-02 `idempotency.middleware.ts` pattern):
 *   1. Read header `Idempotency-Key` (UUID v4) — same client convention
 *   2. Extract `rid` from URL params (`/intent/:rid/action`)
 *   3. Extract `attempt_n` from request body `_meta.attempt_n` (default 1)
 *   4. Build composite cache key: `intent:action:{rid}:{attempt_n}`
 *   5. Check cache HIT → return cached response + log
 *      `intent_action_idempotency.cache_hit`
 *   6. SETNX lock key: `intent:action:lock:{rid}:{attempt_n}` EX:30 (30s lock TTL)
 *      → FAIL: 409 IDEMPOTENCY_CONFLICT
 *      → OK: log `intent_action_idempotency.lock_acquired`, proceed handler
 *   7. After handler success (2xx): cache response (TTL 5min — 300s) + log
 *      `intent_action_idempotency.cached_response_stored`
 *   8. finally: DEL lock key (always, even on handler error)
 *
 * **Header behavior:** Idempotency-Key header is REQUIRED (validates UUID v4)
 * per existing S-02 contract — provides client-side retry detection. Composite
 * key combines this with `(rid, attempt_n)` so:
 *   - Same Idempotency-Key + same `(rid, attempt_n)` = cache hit (replay)
 *   - Same Idempotency-Key + DIFFERENT `attempt_n` = NEW lock, new dispatch
 *     (legitimate retry path per D-S04-13 LAW + 03_API §1.2 line 95)
 *
 * @see docs/02_DATA_MODEL.md §5 Redis key `intent:action:{rid}:{attempt_n}` TTL 5min
 * @see docs/03_API_CONTRACTS.md §1.2 (Pattern A semantics + attempt_n field)
 * @see apps/gateway/src/idempotency/idempotency.middleware.ts (base pattern)
 * @see slices/S-04_decisions-log.md D-S04-13 LAW + C-S04-N
 */

import {
  Injectable,
  NestMiddleware,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RedisClient } from '../idempotency/redis.client';
import { createLogger } from '../observability';
import type { Logger } from 'pino';

/** Lock TTL — short guard for in-flight processing. */
const LOCK_TTL_SECONDS = 30;

/** Cache TTL — 5 minutes per `02_DATA_MODEL.md §5` intent:action:{rid}:{n} entry. */
const CACHE_TTL_SECONDS = 300;

/** UUID v4 regex per RFC 4122 (matches S-02 base middleware). */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID v1-5 guard cho X-Tenant-Id key segment (S-P0-01 T03c F3, khớp resolver). */
const TENANT_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Header name (case-insensitive in HTTP; Express normalizes to lower). */
const HEADER_NAME = 'idempotency-key';

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

@Injectable()
export class IntentActionIdempotencyMiddleware implements NestMiddleware {
  private readonly logger: Logger;

  constructor(private readonly redis: RedisClient) {
    this.logger = createLogger({
      service: process.env.OTEL_SERVICE_NAME ?? 'gateway',
      version: process.env.APP_VERSION ?? '0.0.1',
      env: process.env.NODE_ENV ?? 'dev',
    }).child({ component: 'intent_action_idempotency' });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 1. Validate Idempotency-Key header (UUID v4 required).
    const key = (req.headers[HEADER_NAME] as string | undefined)?.trim();
    if (!key) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing required header: Idempotency-Key',
        },
      });
    }
    if (!UUID_V4_REGEX.test(key)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Idempotency-Key must be UUID v4 format',
        },
      });
    }

    // 2. Extract rid from URL params. Route pattern is /intent/:rid/action so
    //    Express populates req.params.rid. Defensive null-check below.
    const rid = (req.params as Record<string, string | undefined>)?.rid;
    if (!rid) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing route param: rid (request_id)',
        },
      });
    }

    // 3. Extract attempt_n from body._meta.attempt_n (default 1 if not provided).
    //    Body parsing already happened upstream (NestJS pipe) — req.body is JSON.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const meta = (body._meta ?? {}) as Record<string, unknown>;
    const attemptN =
      typeof meta.attempt_n === 'number' && Number.isInteger(meta.attempt_n) && meta.attempt_n > 0
        ? meta.attempt_n
        : 1;

    // 4. Build composite keys per `02_DATA_MODEL.md §5` + S-P0-01 T03c F3 re-key
    //    tenant-scope (ADR-040 iv): `intent:action:{tenant}:{rid}:{attempt_n}`.
    //    Tenant đọc TỪ HEADER X-Tenant-Id (action đi qua fetch nên có header;
    //    MW chạy TRƯỚC guard — #31 ngoài scope — nên không có req.tenant_id).
    //    Đây là namespace dedup defense-in-depth; CÔ LẬP tenant THẬT do
    //    ownership-check ở controller (F2). Header thiếu/không UUID → key không
    //    tenant-prefix (graceful — rid là UUID toàn cục, dedup vẫn đúng).
    const tenantHeader = (req.headers['x-tenant-id'] as string | undefined)?.trim();
    const tenantPrefix =
      tenantHeader && TENANT_UUID_REGEX.test(tenantHeader) ? `${tenantHeader}:` : '';
    const cacheKey = `intent:action:${tenantPrefix}${rid}:${attemptN}`;
    const lockKey = `intent:action:lock:${tenantPrefix}${rid}:${attemptN}`;
    const keyPrefix = key.slice(0, 8);

    // 5. Cache hit check.
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      let parsed: CachedResponse | undefined;
      try {
        parsed = JSON.parse(cached) as CachedResponse;
      } catch {
        this.logger.warn({
          message: 'intent_action_idempotency.cache_corrupted',
          extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
        });
        await this.redis.del(cacheKey);
        // Fall through to lock attempt.
      }
      if (parsed) {
        this.logger.debug({
          message: 'intent_action_idempotency.cache_hit',
          extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
        });
        res.status(parsed.status);
        for (const [name, value] of Object.entries(parsed.headers ?? {})) {
          res.setHeader(name, value);
        }
        res.setHeader('X-Idempotent-Replayed', 'true');
        res.json(parsed.body);
        return;
      }
    }

    // 6. Acquire composite lock.
    const acquired = await this.redis.setnxWithTtl(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.warn({
        message: 'intent_action_idempotency.lock_conflict',
        extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
      });
      throw new ConflictException({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message:
            'Action with same request_id + attempt_n is currently being processed',
          details: { request_id: rid, attempt_n: attemptN },
        },
      });
    }

    this.logger.debug({
      message: 'intent_action_idempotency.lock_acquired',
      extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
    });

    // 7. Wrap response to capture body for caching.
    const originalJson = res.json.bind(res);
    let capturedBody: unknown = undefined;
    res.json = (responseBody: unknown) => {
      capturedBody = responseBody;
      return originalJson(responseBody);
    };

    // 8. After response finished, cache (2xx only) + release lock.
    res.on('finish', async () => {
      try {
        const status = res.statusCode;
        if (status >= 200 && status < 300 && capturedBody !== undefined) {
          const headersToCache: Record<string, string> = {};
          const ct = res.getHeader('content-type');
          if (typeof ct === 'string') {
            headersToCache['content-type'] = ct;
          }
          const payload: CachedResponse = {
            status,
            headers: headersToCache,
            body: capturedBody,
          };
          await this.redis.setWithTtl(
            cacheKey,
            JSON.stringify(payload),
            CACHE_TTL_SECONDS,
          );
          this.logger.debug({
            message: 'intent_action_idempotency.cached_response_stored',
            extras: {
              key_prefix: keyPrefix,
              request_id: rid,
              attempt_n: attemptN,
              status,
            },
          });
        }
      } catch (err) {
        this.logger.error({
          message: 'intent_action_idempotency.cache_write_failed',
          error_message: err instanceof Error ? err.message : String(err),
          extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
        });
      } finally {
        try {
          await this.redis.del(lockKey);
        } catch (delErr) {
          this.logger.error({
            message: 'intent_action_idempotency.lock_release_failed',
            error_message:
              delErr instanceof Error ? delErr.message : String(delErr),
            extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
          });
        }
      }
    });

    // Also release lock on connection close (client disconnected mid-flight).
    res.on('close', async () => {
      if (!res.writableEnded) {
        try {
          await this.redis.del(lockKey);
          this.logger.debug({
            message: 'intent_action_idempotency.lock_released_on_disconnect',
            extras: { key_prefix: keyPrefix, request_id: rid, attempt_n: attemptN },
          });
        } catch {
          // Ignore — best-effort cleanup.
        }
      }
    });

    next();
  }
}
