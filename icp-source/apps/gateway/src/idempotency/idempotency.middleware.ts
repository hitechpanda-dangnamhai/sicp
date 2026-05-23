/**
 * apps/gateway/src/idempotency/idempotency.middleware.ts
 *
 * NestJS middleware implementing Idempotency-Key pattern per ADR-004 +
 * docs/01_ARCHITECTURE.md §4.
 *
 * Flow per 01_ARCH §4 canonical pseudocode:
 *   1. Read header `Idempotency-Key` (UUID v4, client-generated)
 *   2. Check `idem:cache:{userId}:{key}` Redis
 *      → HIT: return cached response (status, body, headers) + log
 *        `idempotency.cache_hit`
 *   3. SETNX `idem:lock:{userId}:{key}` with EX:30 (LOCK TTL 30s — C-02)
 *      → FAIL: throw 409 IDEMPOTENCY_CONFLICT + log
 *        `idempotency.lock_conflict`
 *      → OK: log `idempotency.lock_acquired`, proceed handler
 *   4. After handler success: setex `idem:cache:...` 86400s
 *      (CACHE TTL 24h per ADR-004 + C-02) + log
 *      `idempotency.cached_response_stored`
 *   5. finally: DEL lock key (always, even on handler error — errors NOT
 *      cached)
 *
 * C-02 resolution applied (Phiên 21 2026-05-21):
 *   - Lock TTL = 30 seconds (per 01_ARCH §4 pseudocode, NOT 24h as
 *     originally phrased in D-02)
 *   - Cache TTL = 24 hours (per ADR-004 + 01_ARCH §4)
 *   - Industry-std SETNX pattern: short lock guards in-flight processing,
 *     long cache provides retry safety.
 *
 * Active route patterns per docs/03_API_CONTRACTS.md §1 BẮT BUỘC:
 *   - POST /api/v1/intent
 *   - POST /api/v1/products
 *   - PATCH /api/v1/products/:id
 *   - POST /api/v1/orders/checkout
 *
 * Route filtering wired in idempotency.module.ts via NestModule.configure().
 * This middleware activates on those 4 patterns; for other routes it is not
 * registered (no path check inside middleware itself — Nest router handles it).
 *
 * Sensitive data per 06_OBS §7: log `key_prefix` = first 8 chars of full
 * Idempotency-Key (full UUID is fine to log technically, but redaction-safe
 * habit aligns with future PII redactor middleware Phase 06).
 */

import {
  Injectable,
  NestMiddleware,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RedisClient } from './redis.client';
import { createLogger } from '../observability';
import type { Logger } from 'pino';

/** Lock TTL in seconds — per C-02 resolution (was 24h in D-02 original). */
const LOCK_TTL_SECONDS = 30;

/** Response cache TTL in seconds — 24 hours per ADR-004 + C-02. */
const CACHE_TTL_SECONDS = 86_400;

/** UUID v4 regex per RFC 4122. */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Header name (case-insensitive in HTTP; Express normalizes to lower). */
const HEADER_NAME = 'idempotency-key';

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger: Logger;

  constructor(private readonly redis: RedisClient) {
    this.logger = createLogger({
      service: process.env.OTEL_SERVICE_NAME ?? 'gateway',
      version: process.env.APP_VERSION ?? '0.0.1',
      env: process.env.NODE_ENV ?? 'dev',
    }).child({ component: 'idempotency' });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = (req.headers[HEADER_NAME] as string | undefined)?.trim();

    // Validate header presence + format. Caller MUST supply UUID v4.
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

    // Resolve userId scope. If unauthenticated request (e.g. anonymous
    // /intent before login), fall back to 'anon' bucket. Real userId comes
    // from JWT extracted by AuthGuard in S-03; T01 reads req['user']?.id if
    // an upstream guard has populated it.
    const userId =
      ((req as Request & { user?: { id?: string } }).user?.id as string | undefined) ??
      'anon';

    const lockKey = `idem:lock:${userId}:${key}`;
    const cacheKey = `idem:cache:${userId}:${key}`;
    const keyPrefix = key.slice(0, 8);

    // Step 1: Cache hit?
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      let parsed: CachedResponse;
      try {
        parsed = JSON.parse(cached) as CachedResponse;
      } catch {
        // Corrupted cache entry — log + treat as miss, proceed normally.
        this.logger.warn({
          message: 'idempotency.cache_corrupted',
          extras: { key_prefix: keyPrefix, user_id: userId },
        });
        await this.redis.del(cacheKey);
        // Fall through to lock attempt below.
        // (do not return)
      }
      // @ts-expect-error parsed is assigned in try; if catch ran, we fell through
      if (parsed) {
        this.logger.debug({
          message: 'idempotency.cache_hit',
          user_id: userId,
          extras: { key_prefix: keyPrefix },
        });
        res.status(parsed.status);
        for (const [name, value] of Object.entries(parsed.headers ?? {})) {
          res.setHeader(name, value);
        }
        // Mark response so downstream handlers can short-circuit (e.g. if
        // a controller checks `res.headersSent`).
        res.setHeader('X-Idempotent-Replayed', 'true');
        res.json(parsed.body);
        return;
      }
    }

    // Step 2: Acquire lock.
    const acquired = await this.redis.setnxWithTtl(lockKey, LOCK_TTL_SECONDS);
    if (!acquired) {
      this.logger.warn({
        message: 'idempotency.lock_conflict',
        user_id: userId,
        extras: { key_prefix: keyPrefix },
      });
      throw new ConflictException({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Request with same Idempotency-Key is currently in flight',
          details: { key_prefix: keyPrefix },
        },
      });
    }

    this.logger.debug({
      message: 'idempotency.lock_acquired',
      user_id: userId,
      extras: { key_prefix: keyPrefix },
    });

    // Step 3: Wrap response to capture body for caching.
    // Express patch: intercept res.json() to grab the payload.
    const originalJson = res.json.bind(res);
    let capturedBody: unknown = undefined;
    res.json = (body: unknown) => {
      capturedBody = body;
      return originalJson(body);
    };

    // Step 4: After response finished, cache (only on 2xx) + release lock.
    res.on('finish', async () => {
      try {
        const status = res.statusCode;
        // Cache successful responses only. Errors must NOT be cached —
        // retrying after a transient failure must hit the handler fresh.
        if (status >= 200 && status < 300 && capturedBody !== undefined) {
          const headersToCache: Record<string, string> = {};
          // Cache a minimal whitelist of headers (Content-Type is enough for
          // JSON APIs). Avoid caching auth/cookie/trace headers.
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
            message: 'idempotency.cached_response_stored',
            user_id: userId,
            extras: { key_prefix: keyPrefix, status },
          });
        }
      } catch (err) {
        this.logger.error({
          message: 'idempotency.cache_write_failed',
          user_id: userId,
          error_message: err instanceof Error ? err.message : String(err),
          extras: { key_prefix: keyPrefix },
        });
      } finally {
        // Always release lock — even if cache write failed.
        try {
          await this.redis.del(lockKey);
        } catch (delErr) {
          this.logger.error({
            message: 'idempotency.lock_release_failed',
            user_id: userId,
            error_message:
              delErr instanceof Error ? delErr.message : String(delErr),
            extras: { key_prefix: keyPrefix },
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
            message: 'idempotency.lock_released_on_disconnect',
            user_id: userId,
            extras: { key_prefix: keyPrefix },
          });
        } catch {
          // Ignore — best-effort cleanup.
        }
      }
    });

    next();
  }
}
