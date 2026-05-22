/**
 * apps/gateway/src/auth/auth.service.spec.ts
 *
 * S-03 T02 Integration test — AuthService end-to-end.
 *
 * Strategy per Phiên 32 human decision: FULL REAL — Postgres + Redis +
 * bcryptjs + jsonwebtoken. No mocks. Catches SQL/JSON/cookie/crypto bugs
 * that mocks would hide.
 *
 * Pre-conditions (test setup BUỘC):
 *   - Postgres + Redis up via docker-compose
 *   - V001..V009 migrations applied (T01 DONE)
 *   - Phase 01 seed loaded — seed user `merchant1@demo.icp` / `demo1234` exists
 *
 * Run from host:
 *   DATABASE_URL='postgresql://icp:icp_dev_password@localhost:5432/icp' \
 *   REDIS_URL='redis://localhost:6379' \
 *   JWT_SECRET='change_me_in_production_use_openssl_rand_base64_32' \
 *   pnpm --filter @icp/gateway test
 *
 * (C-11 workaround: localhost:5432 host-side override per T01 Bonus C-11.)
 *
 * Cleanup strategy:
 *   - afterEach: DELETE all sessions for merchant1@demo.icp + DEL Redis
 *     keys session:* matching test-created jtis. Preserves S-02 idempotency
 *     cache (idem:* namespace untouched).
 *   - afterAll: close PG + Redis connections.
 *
 * Coverage maps to Task Pack ACs:
 *   - AC-1 login happy path → it('AC-1 ...')
 *   - AC-2 rememberMe → it('AC-2 ...')
 *   - AC-3 wrong password → it('AC-3 ...')
 *   - AC-4 /auth/me with session → it('AC-4 ...')
 *   - AC-5 logout invalidation → it('AC-5 ...')
 *   - AC-6 rotating refresh + replay rejection → it('AC-6 ...')
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { compare, hash } from 'bcryptjs';
import { PgPool } from '../database/pg-pool.provider';
import { RedisClient } from '../idempotency/redis.client';
import { JwtHelper } from './jwt.helper';
import { PostgresUserRepository } from './infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { RedisSessionStore } from './infrastructure/redis-session.store';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { GetMeUseCase } from './application/get-me.use-case';
import { RefreshUseCase } from './application/refresh.use-case';
import { AuthService } from './auth.service';
import {
  InvalidCredentialsError,
  RefreshRejectedError,
} from './domain/errors';

const TEST_EMAIL = 'merchant1@demo.icp';
const TEST_PASSWORD = 'demo1234';
const TEST_DISPLAY_NAME = 'Anh Nam';

/**
 * Lightweight ConfigService stub returning env-driven values. Avoids the
 * full ConfigModule.forRoot boot path which would re-validate ALL env vars
 * + may complain about test runner missing OTEL_* defaults.
 */
function makeConfig(): ConfigService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeConfig: any = {
    get<T>(key: string): T {
      const v = process.env[key];
      switch (key) {
        case 'JWT_SECRET':
          return (v ?? 'change_me_in_production_use_openssl_rand_base64_32') as T;
        case 'JWT_ACCESS_TTL_HOURS':
          return Number(v ?? 24) as T;
        case 'JWT_REFRESH_TTL_DAYS':
          return Number(v ?? 30) as T;
        case 'DATABASE_URL':
          return (v ?? 'postgresql://icp:icp_dev_password@localhost:5432/icp') as T;
        case 'REDIS_URL':
          return (v ?? 'redis://localhost:6379') as T;
        case 'APP_VERSION':
          return (v ?? '0.0.1-test') as T;
        case 'NODE_ENV':
          return (v ?? 'test') as T;
        default:
          return v as T;
      }
    },
  };
  return fakeConfig as ConfigService;
}

describe('AuthService integration (real PG + Redis + bcryptjs + jsonwebtoken)', () => {
  let pool: Pool;
  let redis: Redis;
  let pgPool: PgPool;
  let redisClient: RedisClient;
  let jwtHelper: JwtHelper;
  let userRepo: PostgresUserRepository;
  let sessionRepo: PostgresSessionRepository;
  let sessionStore: RedisSessionStore;
  let authService: AuthService;
  let testUserId: string;

  beforeAll(async () => {
    const config = makeConfig();

    // Build infra layer with real connections.
    pgPool = new PgPool(config);
    // Cast to any to bypass private field access for direct query in cleanup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pool = (pgPool as any).pool as Pool;

    redisClient = new RedisClient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis = (redisClient as any).client as Redis;

    // Defensive — bcryptjs $2a$/$2b$ compatibility check on seed row.
    // If seed bcrypt prefix unknown / unset, fail-fast.
    const seedRow = await pool.query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [TEST_EMAIL],
    );
    if (seedRow.rows.length === 0) {
      throw new Error(
        `Seed user ${TEST_EMAIL} missing — run \`make seed\` before integration tests.`,
      );
    }
    testUserId = seedRow.rows[0].id;
    const seedOk = await compare(TEST_PASSWORD, seedRow.rows[0].password_hash);
    if (!seedOk) {
      throw new Error(
        `Seed password mismatch for ${TEST_EMAIL} — D-01 bcryptjs cost 10 contract violated.`,
      );
    }

    // Build domain + application layers.
    jwtHelper = new JwtHelper(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
    );
    userRepo = new PostgresUserRepository(pgPool);
    sessionRepo = new PostgresSessionRepository(pgPool);
    sessionStore = new RedisSessionStore(redisClient);
    const loginUC = new LoginUseCase(
      userRepo,
      sessionRepo,
      sessionStore,
      jwtHelper,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
    );
    const logoutUC = new LogoutUseCase(sessionRepo, sessionStore);
    const getMeUC = new GetMeUseCase(userRepo, sessionRepo);
    const refreshUC = new RefreshUseCase(
      userRepo,
      sessionRepo,
      sessionStore,
      jwtHelper,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
    );
    authService = new AuthService(loginUC, logoutUC, getMeUC, refreshUC);

    // Pre-clean any orphan test sessions from prior runs.
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
    await cleanRedisSessions(redis);
  });

  afterEach(async () => {
    // Clear sessions created during this test only.
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
    await cleanRedisSessions(redis);
  });

  afterAll(async () => {
    await pgPool.onModuleDestroy();
    await redisClient.onModuleDestroy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-1 — Login happy path
  // ──────────────────────────────────────────────────────────────────────
  it('AC-1: login with valid credentials issues tokens + persists session + caches Redis', async () => {
    const result = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });

    // Result shape
    expect(result.user.id).toBeTruthy();
    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.user.role).toBe('merchant');
    expect(result.user.display_name).toBe(TEST_DISPLAY_NAME);
    expect(result.user.avatar_initials).toBe('AN');
    expect(result.accessToken).toMatch(/^eyJ/); // JWT base64 header prefix
    expect(result.rawRefreshToken).toMatch(/^[0-9a-f-]{36}$/); // UUID v4
    expect(result.jti).toMatch(/^[0-9a-f-]{36}$/);

    // JWT verifies + payload correct
    const payload = jwtHelper.verify(result.accessToken);
    expect(payload.sub).toBe(result.user.id);
    expect(payload.email).toBe(TEST_EMAIL);
    expect(payload.role).toBe('merchant');
    expect(payload.jti).toBe(result.jti);

    // PG persisted
    const pgRow = await pool.query<{ jti: string; refresh_token_hash: string; revoked_at: Date | null }>(
      `SELECT jti, refresh_token_hash, revoked_at FROM sessions WHERE jti = $1`,
      [result.jti],
    );
    expect(pgRow.rows).toHaveLength(1);
    expect(pgRow.rows[0].revoked_at).toBeNull();
    expect(pgRow.rows[0].refresh_token_hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex

    // Redis cached
    const cached = await sessionStore.get(result.jti);
    expect(cached).not.toBeNull();
    expect(cached?.user_id).toBe(result.user.id);
    expect(cached?.email).toBe(TEST_EMAIL);
    expect(cached?.display_name).toBe(TEST_DISPLAY_NAME);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-2 — rememberMe semantics (cookie behavior is controller concern;
  // here we just confirm use-case accepts the flag and JWT TTL stays fixed)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-2: rememberMe=true does NOT affect JWT TTL (only cookie Max-Age)', async () => {
    const r1 = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });
    const r2 = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: true,
    });

    const p1 = jwtHelper.verify(r1.accessToken);
    const p2 = jwtHelper.verify(r2.accessToken);
    // exp - iat = TTL seconds; should be identical regardless of rememberMe
    expect(p1.exp - p1.iat).toBe(p2.exp - p2.iat);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-3 — Wrong password
  // ──────────────────────────────────────────────────────────────────────
  it('AC-3: wrong password throws InvalidCredentialsError + no session persisted', async () => {
    await expect(
      authService.login({
        email: TEST_EMAIL,
        password: 'wrong_password',
        rememberMe: false,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    // No session row for test user
    const rows = await pool.query(`SELECT 1 FROM sessions WHERE user_id = $1`, [testUserId]);
    expect(rows.rows).toHaveLength(0);
  });

  it('AC-3.b: unknown email throws InvalidCredentialsError (no user enumeration)', async () => {
    await expect(
      authService.login({
        email: 'nobody@example.invalid',
        password: 'whatever',
        rememberMe: false,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-4 — /auth/me with valid session
  // ──────────────────────────────────────────────────────────────────────
  it('AC-4: /auth/me returns user with avatar_initials + last_login_at after login', async () => {
    const loginResult = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });

    const me = await authService.me({ userId: loginResult.user.id });
    expect(me.id).toBe(loginResult.user.id);
    expect(me.email).toBe(TEST_EMAIL);
    expect(me.display_name).toBe(TEST_DISPLAY_NAME);
    expect(me.avatar_initials).toBe('AN');
    expect(me.last_login_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO8601
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-5 — Logout invalidation (DEL Redis + UPDATE PG revoked_at)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-5: logout removes Redis cache + sets PG revoked_at + subsequent guard PG-check fails', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });
    expect(await sessionStore.get(login.jti)).not.toBeNull();

    await authService.logout({ jti: login.jti, userId: login.user.id });

    // Redis gone
    expect(await sessionStore.get(login.jti)).toBeNull();

    // PG revoked_at NOT NULL
    const pgRow = await pool.query<{ revoked_at: Date | null }>(
      `SELECT revoked_at FROM sessions WHERE jti = $1`,
      [login.jti],
    );
    expect(pgRow.rows[0].revoked_at).not.toBeNull();

    // Guard fallback query findActiveByJti now returns null (revoked)
    const active = await sessionRepo.findActiveByJti(login.jti);
    expect(active).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-6 — Rotating refresh + replay rejection
  // ──────────────────────────────────────────────────────────────────────
  it('AC-6: refresh issues new pair + revokes old; replay with old refresh fails', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: true,
    });
    const oldJti = login.jti;
    const oldRefresh = login.rawRefreshToken;

    const refreshed = await authService.refresh({ rawRefreshToken: oldRefresh });

    // New session distinct from old
    expect(refreshed.jti).not.toBe(oldJti);
    expect(refreshed.rawRefreshToken).not.toBe(oldRefresh);
    expect(refreshed.oldJti).toBe(oldJti);

    // Old session row revoked_at NOT NULL
    const oldRow = await pool.query<{ revoked_at: Date | null }>(
      `SELECT revoked_at FROM sessions WHERE jti = $1`,
      [oldJti],
    );
    expect(oldRow.rows[0].revoked_at).not.toBeNull();

    // New session active
    const newRow = await pool.query<{ revoked_at: Date | null }>(
      `SELECT revoked_at FROM sessions WHERE jti = $1`,
      [refreshed.jti],
    );
    expect(newRow.rows[0].revoked_at).toBeNull();

    // Replay attack: same old refresh token → RefreshRejectedError
    await expect(
      authService.refresh({ rawRefreshToken: oldRefresh }),
    ).rejects.toBeInstanceOf(RefreshRejectedError);

    // Redis: old jti gone, new jti present
    expect(await sessionStore.get(oldJti)).toBeNull();
    expect(await sessionStore.get(refreshed.jti)).not.toBeNull();
  });
});

/**
 * Delete only `session:*` keys (NOT `idem:*` — preserves S-02 idem cache).
 */
async function cleanRedisSessions(redis: Redis): Promise<void> {
  const keys = await redis.keys('session:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
