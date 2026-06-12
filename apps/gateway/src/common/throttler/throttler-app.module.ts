/**
 * apps/gateway/src/common/throttler/throttler-app.module.ts
 *
 * S-P0-02/T03 W-60 — ThrottlerModule + Redis storage (counter sống qua restart
 * gateway, ACCEPTANCE #3). 2 throttler global: `short` (per-min) + `long`
 * (per-hour); per-route override ở decorator (@Throttle/@SkipThrottle).
 * Đăng ký IcpThrottlerGuard làm APP_GUARD (global).
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type { Env } from '../../config/env.schema';
import { IcpThrottlerGuard } from './throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get('THROTTLE_SHORT_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_SHORT_LIMIT', { infer: true }),
          },
          {
            name: 'long',
            ttl: config.get('THROTTLE_LONG_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LONG_LIMIT', { infer: true }),
          },
        ],
        // Redis storage — counter persist qua restart (≠ in-memory default).
        // Tạo connection riêng từ REDIS_URL (không couple DI với RedisClient).
        storage: new ThrottlerStorageRedisService(config.get('REDIS_URL', { infer: true })),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: IcpThrottlerGuard }],
})
export class ThrottlerAppModule {}
