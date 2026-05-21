/**
 * apps/gateway/src/idempotency/redis.client.ts
 *
 * Singleton Redis client factory using ioredis.
 *
 * Why ioredis (not node-redis):
 *   - Mature, widely-used in NestJS ecosystem
 *   - Built-in connection retry + auto-reconnect (no manual logic needed)
 *   - Supports SETNX with EX option in single atomic command
 *
 * Why NOT @nestjs-modules/ioredis or @liaoliaots/nestjs-redis:
 *   - Adds 1 more dep + DI wrapping for a single Redis client
 *   - Hackathon scope: keep simple, direct ioredis instance is enough
 *
 * Future: when S-03+ adds session cookies + S-05+ adds rate-limiting, may
 * want to upgrade to @liaoliaots/nestjs-redis for multi-client support.
 * That migration is straightforward: this factory becomes a NestJS Provider.
 */

import Redis from 'ioredis';
import { Injectable, OnModuleDestroy, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisClient implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly nestLogger = new NestLogger(RedisClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, {
      // Lazy connect = don't block module init on Redis up; first command
      // will trigger connect. Pairs with health/ready endpoint reporting
      // redis status without crashing service on Redis down.
      lazyConnect: false,
      // Retry strategy: exponential up to 5 attempts then give up
      // (Idempotency middleware will surface error to caller as 503).
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: (err) => {
        // Reconnect on READONLY error (e.g. failover to replica).
        return err.message.includes('READONLY');
      },
    });

    this.client.on('error', (err) => {
      this.nestLogger.error(
        JSON.stringify({
          message: 'redis.unavailable',
          error_message: err.message,
        }),
      );
    });

    this.client.on('connect', () => {
      this.nestLogger.log(
        JSON.stringify({ message: 'redis.connected' }),
      );
    });
  }

  /**
   * Get the underlying ioredis instance. Use sparingly — prefer typed
   * methods below for common patterns.
   */
  raw(): Redis {
    return this.client;
  }

  /**
   * Atomic SETNX with TTL. Returns true if key was set (lock acquired),
   * false if key already exists (lock conflict).
   *
   * Used by Idempotency middleware to acquire processing lock per
   * docs/01_ARCHITECTURE.md §4.
   *
   * @param key full Redis key e.g. `idem:lock:u_123:abc-def`
   * @param ttlSeconds lock TTL in seconds (30s per C-02 amendment)
   */
  async setnxWithTtl(key: string, ttlSeconds: number): Promise<boolean> {
    // ioredis: `SET key value EX seconds NX` is atomic per Redis docs.
    // Returns 'OK' on success, null if NX fails.
    const result = await this.client.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Get cached value (string). Returns null if not found.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * SET with TTL. Used to store idempotency response cache.
   *
   * @param key full Redis key e.g. `idem:cache:u_123:abc-def`
   * @param value JSON-serialised response payload
   * @param ttlSeconds cache TTL in seconds (86400 = 24h per ADR-004)
   */
  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Delete a key. Idempotent — returns 0 if not found, no error.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Health check ping. Returns true if Redis responds PONG within 2s.
   * Used by HealthController readiness probe.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await Promise.race([
        this.client.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timeout')), 2000),
        ),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
