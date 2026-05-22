/**
 * apps/gateway/src/auth/auth.module.ts
 *
 * NestJS module wiring AuthController + AuthService + 4 use-cases + repos +
 * JwtHelper + JwtAuthGuard.
 *
 * Imports:
 *   - `DatabaseModule` — provides `PgPool` for 2 PG repos
 *   - `IdempotencyModule` — re-exports `RedisClient` (S-02 T01 design); we
 *     reuse the same singleton instead of opening a 2nd connection. This is
 *     intentional and matches Hackathon "keep simple" principle from
 *     idempotency/redis.client.ts comment block.
 *
 * Exports:
 *   - `JwtAuthGuard` — so downstream V-SLICEs (S-04..S-10) can `@UseGuards(JwtAuthGuard)`
 *     on their endpoints without re-wiring DI.
 *
 * S-03 T02 emit.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtHelper } from './jwt.helper';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { GetMeUseCase } from './application/get-me.use-case';
import { RefreshUseCase } from './application/refresh.use-case';
import { PostgresUserRepository } from './infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { RedisSessionStore } from './infrastructure/redis-session.store';

@Module({
  imports: [ConfigModule, DatabaseModule, IdempotencyModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtHelper,
    JwtAuthGuard,
    LoginUseCase,
    LogoutUseCase,
    GetMeUseCase,
    RefreshUseCase,
    PostgresUserRepository,
    PostgresSessionRepository,
    RedisSessionStore,
  ],
  exports: [JwtAuthGuard, JwtHelper],
})
export class AuthModule {}
