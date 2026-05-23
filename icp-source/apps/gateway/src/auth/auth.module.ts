/**
 * apps/gateway/src/auth/auth.module.ts
 *
 * NestJS module wiring AuthController + AuthService + 5 use-cases + repos +
 * JwtHelper + JwtAuthGuard.
 *
 * Imports:
 *   - `DatabaseModule` — provides `PgPool` for 2 PG repos
 *   - `IdempotencyModule` — re-exports `RedisClient` (S-02 T01 design); we
 *     reuse the same singleton instead of opening a 2nd connection. This is
 *     intentional and matches Hackathon "keep simple" principle from
 *     idempotency/redis.client.ts comment block.
 *   - `TrackingModule` — provides `TrackingService` for behavior event loopback
 *     emit from AuthService (S-03 T03 + C-14 RESOLVED Phiên 33). AuthService
 *     emits `auth.signed_in` / `auth.signed_out` / `auth.password_reset_requested`
 *     via `TrackingService.ingest()` direct call (NOT HTTP loopback).
 *
 * Exports:
 *   - `JwtAuthGuard` — so downstream V-SLICEs (S-04..S-10) can `@UseGuards(JwtAuthGuard)`
 *     on their endpoints without re-wiring DI.
 *   - `JwtHelper` — same rationale for downstream sign/verify utilities.
 *   - `RedisSessionStore` + `PostgresSessionRepository` — **REQUIRED per C-24
 *     RESOLVED Phiên 36**: these are JwtAuthGuard's constructor params 2+3
 *     (see `jwt-auth.guard.ts` lines 73-77). NestJS DI scope rule — when
 *     consumer module `@UseGuards(JwtAuthGuard)` on its controller, the
 *     guard's constructor params resolve in the CONSUMER'S module context,
 *     NOT in this provider module's context. Exports must include ALL
 *     transitive deps. Latent S-03 T02 design omission surfaced T03b first
 *     cross-module consumer (DashboardModule); fix pattern LOCKED for all
 *     S-04..S-10 V-SLICE consumers.
 *
 * S-03 T02 emit. Extended S-03 T03 Phiên 33 Batch 3 (+TrackingModule import) +
 * Batch 4 (+ForgotPasswordUseCase provider per S-03 C-03 stub endpoint).
 * Extended S-03 T03b Phiên 36 (+2 export tokens RedisSessionStore +
 * PostgresSessionRepository per C-24).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtHelper } from './jwt.helper';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { GetMeUseCase } from './application/get-me.use-case';
import { RefreshUseCase } from './application/refresh.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { PostgresUserRepository } from './infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { RedisSessionStore } from './infrastructure/redis-session.store';

@Module({
  imports: [ConfigModule, DatabaseModule, IdempotencyModule, TrackingModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtHelper,
    JwtAuthGuard,
    LoginUseCase,
    LogoutUseCase,
    GetMeUseCase,
    RefreshUseCase,
    ForgotPasswordUseCase,
    PostgresUserRepository,
    PostgresSessionRepository,
    RedisSessionStore,
  ],
  exports: [JwtAuthGuard, JwtHelper, RedisSessionStore, PostgresSessionRepository],
})
export class AuthModule {}
