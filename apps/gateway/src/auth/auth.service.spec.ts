/**
 * apps/gateway/src/auth/auth.service.spec.ts
 *
 * S-03 T02 Integration test — AuthService end-to-end.
 * Extended S-03 T03 Phiên 33 Batch 6 (+3 NEW tests AC-12.a / AC-12.b / AC-12.c
 * for behavior event loopback emit + afterEach cleanup extend for
 * behavior_events).
 *
 * Strategy per Phiên 32 human decision: FULL REAL — Postgres + Redis +
 * bcryptjs + jsonwebtoken. No mocks. Catches SQL/JSON/cookie/crypto bugs
 * that mocks would hide. T03 extension wires real TrackingService +
 * TrackingRepository + ForgotPasswordUseCase to verify behavior_events
 * actually persist (fire-and-forget loopback path).
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
 *     keys session:* matching test-created jtis + DELETE behavior_events for
 *     test user_id OR session_id='system' (forgot-password row). Preserves
 *     S-02 idempotency cache (idem:* namespace untouched).
 *   - afterAll: close PG + Redis connections.
 *
 * Coverage maps to Task Pack ACs:
 *   - T02 baseline (7 tests):
 *     AC-1 login happy path → it('AC-1 ...')
 *     AC-2 rememberMe → it('AC-2 ...')
 *     AC-3 wrong password → it('AC-3 ...')
 *     AC-3.b unknown email → it('AC-3.b ...')
 *     AC-4 /auth/me → it('AC-4 ...')
 *     AC-5 logout invalidation → it('AC-5 ...')
 *     AC-6 rotating refresh + replay rejection → it('AC-6 ...')
 *   - T03 extension (3 tests):
 *     AC-12.a login emits auth.signed_in → it('AC-12.a ...')
 *     AC-12.b logout emits auth.signed_out → it('AC-12.b ...')
 *     AC-12.c forgotPassword emits + no user lookup → it('AC-12.c ...')
 *
 * Target: 10/10 PASS.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { compare } from 'bcryptjs';
import { PgPool } from '../database/pg-pool.provider';
import { RedisClient } from '../idempotency/redis.client';
import { JwtHelper } from './jwt.helper';
import { PostgresUserRepository } from './infrastructure/postgres-user.repo';
import { PostgresSessionRepository } from './infrastructure/postgres-session.repo';
import { PostgresMembershipRepository } from './infrastructure/postgres-membership.repo';
import { RedisSessionStore } from './infrastructure/redis-session.store';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { GetMeUseCase } from './application/get-me.use-case';
import { RefreshUseCase } from './application/refresh.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { SwitchTenantUseCase } from './application/switch-tenant.use-case';
import { TrackingRepository } from '../tracking/tracking.repository';
import { TrackingService } from '../tracking/tracking.service';
import { AuthService } from './auth.service';
import {
  InvalidCredentialsError,
  RefreshRejectedError,
  TenantSwitchRejectedError,
} from './domain/errors';

const TEST_EMAIL = 'merchant1@demo.icp';
const TEST_PASSWORD = 'demo1234';
const TEST_DISPLAY_NAME = 'Anh Nam';
/** V011 backfill anchor — merchant1 là owner tenant demo (S-P0-01). */
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';

/** Wait helper — give fire-and-forget loopback emit time to complete PG INSERT. */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const LOOPBACK_FLUSH_MS = 500;

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

// S-P0-03/T01 (W-76): this is a live-infra integration suite (real PG + Redis).
// The plain CI gate runs with no DB → opt in with RUN_DB_TESTS=1 (locally or in
// the CI Postgres job T01b adds) so the core pipeline stays green without DB.
const RUN_DB = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!RUN_DB)('AuthService integration (real PG + Redis + bcryptjs + jsonwebtoken + TrackingService)', () => {
  let pool: Pool;
  let redis: Redis;
  let pgPool: PgPool;
  let redisClient: RedisClient;
  let jwtHelper: JwtHelper;
  let userRepo: PostgresUserRepository;
  let sessionRepo: PostgresSessionRepository;
  let membershipRepo: PostgresMembershipRepository;
  let sessionStore: RedisSessionStore;
  let trackingRepo: TrackingRepository;
  let trackingService: TrackingService;
  let forgotPasswordUC: ForgotPasswordUseCase;
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
    membershipRepo = new PostgresMembershipRepository(pgPool);
    sessionStore = new RedisSessionStore(redisClient);

    // T03 — Tracking layer (real PG insert path for loopback emit).
    trackingRepo = new TrackingRepository(pgPool);
    trackingService = new TrackingService(trackingRepo);

    const loginUC = new LoginUseCase(
      userRepo,
      sessionRepo,
      membershipRepo,
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
      membershipRepo,
      sessionStore,
      jwtHelper,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config as any,
    );
    forgotPasswordUC = new ForgotPasswordUseCase();
    const switchTenantUC = new SwitchTenantUseCase(membershipRepo, sessionRepo);

    authService = new AuthService(
      loginUC,
      logoutUC,
      getMeUC,
      refreshUC,
      forgotPasswordUC,
      switchTenantUC,
      trackingService,
    );

    // Pre-clean any orphan test data from prior runs.
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
    await pool.query(
      `DELETE FROM behavior_events WHERE user_id = $1 OR session_id = 'system'`,
      [testUserId],
    );
    await cleanRedisSessions(redis);
  });

  afterEach(async () => {
    // Clear sessions + behavior_events created during this test only.
    // session_id='system' covers forgot-password rows (no user_id, no jti).
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
    await pool.query(
      `DELETE FROM behavior_events WHERE user_id = $1 OR session_id = 'system'`,
      [testUserId],
    );
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
    // S-P0-01 T02 (ADR-046 amend c) — merchant1 là member tenant demo → tenant_ids
    // chứa DEMO (membership list, KHÔNG phải active claim).
    expect(result.tenantIds).toContain(DEMO_TENANT_ID);
    expect(payload.tenant_ids).toContain(DEMO_TENANT_ID);

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

    await authService.logout({ jti: login.jti, userId: login.user.id, tenantId: DEMO_TENANT_ID });

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

  // ──────────────────────────────────────────────────────────────────────
  // AC-12.a — Login emits auth.signed_in behavior event (T03 fire-and-forget)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-12.a: login emits auth.signed_in behavior event via TrackingService loopback', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
      // ADR-046 amend c: event tenant từ request (X-Tenant-Id). Spec truyền DEMO
      // để loopback persist (login ngoài storefront → null → skip emit).
      eventTenantId: DEMO_TENANT_ID,
    });

    // Wait for fire-and-forget loopback to complete PG INSERT
    await sleep(LOOPBACK_FLUSH_MS);

    const rows = await pool.query<{ event_type: string; user_id: string; session_id: string; properties: Record<string, unknown> }>(
      `SELECT event_type, user_id, session_id, properties FROM behavior_events
       WHERE event_type = 'auth.signed_in' AND user_id = $1`,
      [login.user.id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].session_id).toBe(login.jti);
    expect(rows.rows[0].properties).toEqual({ method: 'password' });
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-12.b — Logout emits auth.signed_out behavior event (T03 fire-and-forget)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-12.b: logout emits auth.signed_out behavior event with empty properties', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });
    await authService.logout({ jti: login.jti, userId: login.user.id, tenantId: DEMO_TENANT_ID });

    // Wait for both signed_in (from login) + signed_out (from logout) to flush
    await sleep(LOOPBACK_FLUSH_MS);

    const rows = await pool.query<{ event_type: string; user_id: string; session_id: string; properties: Record<string, unknown> }>(
      `SELECT event_type, user_id, session_id, properties FROM behavior_events
       WHERE event_type = 'auth.signed_out' AND user_id = $1`,
      [login.user.id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].session_id).toBe(login.jti);
    expect(rows.rows[0].properties).toEqual({});
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-12.c + AC-13 — forgotPassword emits behavior event + NO user lookup
  // ──────────────────────────────────────────────────────────────────────
  it('AC-12.c + AC-13: forgotPassword emits auth.password_reset_requested (persisted under resolved tenant), no DB user lookup', async () => {
    // Spy: UserRepo.findByEmail must NOT be called (no enumeration)
    const findByEmailSpy = vi.spyOn(userRepo, 'findByEmail');

    // S-P0-01 T02 (ADR-046 amend b): tenant resolve ở controller (X-Tenant-Id từ
    // storefront). Spec gọi service trực tiếp → truyền DEMO_TENANT_ID. Event giờ
    // PERSIST (revert drop): behavior_events.tenant_id = tenant resolve.
    await authService.forgotPassword({ email: TEST_EMAIL }, DEMO_TENANT_ID);

    // No user lookup — endpoint is anonymous, no DB query for enumeration (AC-13).
    expect(findByEmailSpy).not.toHaveBeenCalled();
    findByEmailSpy.mockRestore();

    // Wait for fire-and-forget loopback
    await sleep(LOOPBACK_FLUSH_MS);

    const rows = await pool.query<{ event_type: string; user_id: string | null; session_id: string; tenant_id: string; properties: Record<string, string> }>(
      `SELECT event_type, user_id, session_id, tenant_id, properties FROM behavior_events
       WHERE event_type = 'auth.password_reset_requested' AND session_id = 'system'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].user_id).toBeNull(); // No session yet — anonymous endpoint
    expect(rows.rows[0].session_id).toBe('system');
    expect(rows.rows[0].tenant_id).toBe(DEMO_TENANT_ID); // persisted under resolved tenant
    expect(rows.rows[0].properties.email_hash).toMatch(/^[0-9a-f]{16}$/);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-T02.a — switch-tenant (member): update landing hint + redirect_url,
  // NO token re-issue (ADR-046 amend c)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-T02.a: switchTenant (member) updates sessions.last_active_tenant_id + returns redirect_url, no token', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });
    const switched = await authService.switchTenant({
      userId: login.user.id,
      jti: login.jti,
      targetTenantId: DEMO_TENANT_ID,
    });
    expect(switched.tenantId).toBe(DEMO_TENANT_ID);
    expect(switched.slug).toBe('demo');
    expect(switched.redirectUrl).toBe('/s/demo');
    // KHÔNG re-issue token — switched không có accessToken (chỉ landing hint).
    expect((switched as Record<string, unknown>).accessToken).toBeUndefined();

    // Landing hint persisted ở session row.
    const row = await pool.query<{ last_active_tenant_id: string | null }>(
      `SELECT last_active_tenant_id FROM sessions WHERE jti = $1`,
      [login.jti],
    );
    expect(row.rows[0].last_active_tenant_id).toBe(DEMO_TENANT_ID);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC-T02.b — switch-tenant to a non-member tenant is rejected (authz)
  // ──────────────────────────────────────────────────────────────────────
  it('AC-T02.b: switchTenant to a tenant the user is NOT a member of throws TenantSwitchRejectedError', async () => {
    const login = await authService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      rememberMe: false,
    });
    const STRANGER_TENANT = '22222222-2222-2222-2222-222222222222';
    await expect(
      authService.switchTenant({
        userId: login.user.id,
        jti: login.jti,
        targetTenantId: STRANGER_TENANT,
      }),
    ).rejects.toBeInstanceOf(TenantSwitchRejectedError);
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
