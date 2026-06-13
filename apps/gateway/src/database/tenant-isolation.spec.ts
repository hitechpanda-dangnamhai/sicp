/**
 * apps/gateway/src/database/tenant-isolation.spec.ts
 *
 * S-P0-01 T02 — Integration test: RLS tenant isolation qua role icp_app
 * (NOBYPASSRLS) + helper `PgPool.withTenant()` (SET LOCAL app.tenant_id).
 *
 * Chứng minh acceptance slice "REST cross-tenant 404/0" ở tầng DB (tầng quyết
 * định isolation): cùng 1 connection icp_app, đổi tenant qua withTenant() →
 * chỉ thấy row của tenant đó; không set GUC → 0 row (fail-closed); ghi sai
 * tenant → RLS WITH CHECK chặn.
 *
 * **2 connection:**
 *   - superuser (BYPASSRLS): seed/teardown 2 tenant + behavior_events.
 *   - icp_app (NOBYPASSRLS): chạy withTenant() — đối tượng kiểm.
 *
 * Run từ host (cần Postgres up + V011 applied):
 *   DATABASE_URL_SUPER='postgresql://icp:icp_dev_password@localhost:5432/icp' \
 *   DATABASE_URL_APP='postgresql://icp_app:icp_app_dev_password@localhost:5432/icp' \
 *   pnpm --filter @icp/gateway test tenant-isolation
 *
 * KHÔNG mock — RLS chỉ kiểm được trên Postgres thật.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Pool } from 'pg';
import { PgPool } from './pg-pool.provider';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { TrackingRepository } from '../tracking/tracking.repository';
import type { BehaviorEvent } from '@icp/shared-types';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111'; // V011 backfill anchor
const TENANT_B = '22222222-2222-2222-2222-222222222222'; // seed phụ cho test
const EV_DEMO = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const EV_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
// Item 12: anonymous /track 2 X-Tenant-Id → 2 row tách isolation.
const EV2_DEMO = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const EV2_B = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

/** Fake express Request mang HEADER X-Tenant-Id (anonymous /track storefront). */
function reqWithTenantHeader(tenantId: string): Request {
  return {
    user: undefined,
    cookies: {},
    path: '/api/v1/track',
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'x-tenant-id' ? tenantId : undefined,
  } as unknown as Request;
}

/** Event tối thiểu hợp lệ cho behavior_events insert. */
function ev(eventId: string): BehaviorEvent {
  return {
    event_id: eventId,
    event_type: 'session.started',
    occurred_at: new Date().toISOString(),
    session_id: 'iso-track',
    app_version: '0.0.1-test',
    properties: {},
  } as unknown as BehaviorEvent;
}

const SUPER_URL =
  process.env.DATABASE_URL_SUPER ?? 'postgresql://icp:icp_dev_password@localhost:5432/icp';
const APP_URL =
  process.env.DATABASE_URL_APP ?? 'postgresql://icp_app:icp_app_dev_password@localhost:5432/icp';

/** Fake ConfigService trả DATABASE_URL = icp_app cho PgPool (test withTenant thật). */
function appConfig(): ConfigService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fake: any = {
    get<T>(key: string): T {
      if (key === 'DATABASE_URL') return APP_URL as T;
      return undefined as T;
    },
  };
  return fake as ConfigService;
}

async function seedEvent(sup: Pool, tenantId: string, eventId: string): Promise<void> {
  await sup.query(
    `INSERT INTO behavior_events
       (tenant_id, event_id, event_type, occurred_at, session_id, properties, app_version)
     VALUES ($1, $2, 'session.started', NOW(), 'iso-test', '{}'::jsonb, '0.0.1-test')
     ON CONFLICT (event_id, occurred_at) DO NOTHING`,
    [tenantId, eventId],
  );
}

// S-P0-03/T01 (W-76): live-infra integration suite (real PG + RLS roles). Plain
// CI has no DB → opt in with RUN_DB_TESTS=1 (CI Postgres job lands in T01b) so
// the core pipeline stays green. Skipping at describe level avoids the beforeAll
// connect throwing and failing the suite.
const RUN_DB = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!RUN_DB)('S-P0-01 T02 — RLS tenant isolation (icp_app + withTenant)', () => {
  let sup: Pool;
  let appPool: PgPool;

  beforeAll(async () => {
    sup = new Pool({ connectionString: SUPER_URL });
    appPool = new PgPool(appConfig());

    // Seed tenant B (FK behavior_events.tenant_id → tenants).
    await sup.query(
      `INSERT INTO tenants (id, slug, name)
       VALUES ($1, 'iso-test-b', 'Isolation Test Shop B')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_B],
    );
    await seedEvent(sup, DEMO_TENANT, EV_DEMO);
    await seedEvent(sup, TENANT_B, EV_B);
  });

  afterAll(async () => {
    await sup.query(`DELETE FROM behavior_events WHERE event_id = ANY($1::uuid[])`, [
      [EV_DEMO, EV_B, EV2_DEMO, EV2_B],
    ]);
    await sup.query(`DELETE FROM tenants WHERE id = $1`, [TENANT_B]);
    await appPool.onModuleDestroy();
    await sup.end();
  });

  it('icp_app withTenant(demo) sees ONLY demo rows (not tenant B)', async () => {
    const rows = await appPool.withTenant(DEMO_TENANT, (c) =>
      c
        .query<{ event_id: string }>(
          `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV_DEMO, EV_B]],
        )
        .then((r) => r.rows),
    );
    const ids = rows.map((r) => r.event_id);
    expect(ids).toContain(EV_DEMO);
    expect(ids).not.toContain(EV_B);
  });

  it('icp_app withTenant(B) sees ONLY tenant B rows (cross-tenant demo = 0)', async () => {
    const rows = await appPool.withTenant(TENANT_B, (c) =>
      c
        .query<{ event_id: string }>(
          `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV_DEMO, EV_B]],
        )
        .then((r) => r.rows),
    );
    const ids = rows.map((r) => r.event_id);
    expect(ids).toContain(EV_B);
    expect(ids).not.toContain(EV_DEMO);
  });

  it('icp_app query WITHOUT withTenant() → strict 0 rows (V013 NULLIF, no throw)', async () => {
    // Query KHÔNG qua withTenant → GUC app.tenant_id chưa-set (conn mới) HOẶC
    // reset '' (conn tái dùng từ pool sau SET LOCAL+COMMIT). Sau V013 NULLIF
    // hardening: cả 2 → NULL → 0 row SILENTLY (KHÔNG throw). Đây là invariant
    // chặt, không phụ thuộc trạng thái pool (ADR-040 amend b).
    const r = await appPool.query<{ event_id: string }>(
      `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
      [[EV_DEMO, EV_B]],
    );
    expect(r.rows).toHaveLength(0);
  });

  it('icp_app with empty-string GUC explicit → strict 0 rows (NULLIF empty → NULL)', async () => {
    // Mô phỏng chính xác trạng thái pool reuse: GUC = '' (empty string, KHÔNG
    // unset). V011 policy cast ''::uuid sẽ THROW; V013 NULLIF('', '') → NULL →
    // 0 row. Dùng raw client role icp_app (KHÔNG qua withTenant để giữ GUC ''
    // trên CÙNG connection lúc SELECT) — KHÔNG đụng contract PgPool.
    const appRaw = new Pool({ connectionString: APP_URL });
    try {
      const client = await appRaw.connect();
      try {
        await client.query(`SET app.tenant_id = ''`);
        const r = await client.query<{ event_id: string }>(
          `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV_DEMO, EV_B]],
        );
        expect(r.rows).toHaveLength(0);
      } finally {
        client.release();
      }
    } finally {
      await appRaw.end();
    }
  });

  it('icp_app with VALID GUC → returns rows of that tenant only', async () => {
    // Đối chứng dương: GUC hợp lệ → thấy đúng row tenant, tenant_id khớp.
    const rows = await appPool.withTenant(DEMO_TENANT, (c) =>
      c
        .query<{ event_id: string; tenant_id: string }>(
          `SELECT event_id, tenant_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV_DEMO, EV_B]],
        )
        .then((r) => r.rows),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((x) => x.event_id)).toContain(EV_DEMO);
    expect(rows.every((x) => x.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it('anonymous /track with 2 different X-Tenant-Id → 2 rows isolated per tenant (resolver→repo→RLS)', async () => {
    // Resolve tenant từ HEADER (amend c: resolver header-only, no JWT).
    const resolver = new TenantResolverService();
    const repo = new TrackingRepository(appPool);

    // /track #1: X-Tenant-Id = demo → event EV2_DEMO.
    const t1 = resolver.resolve(reqWithTenantHeader(DEMO_TENANT));
    expect(t1).toEqual({ tenantId: DEMO_TENANT, source: 'header' });
    await repo.insertBatch([ev(EV2_DEMO)], t1.tenantId);

    // /track #2: X-Tenant-Id = B → event EV2_B.
    const t2 = resolver.resolve(reqWithTenantHeader(TENANT_B));
    expect(t2).toEqual({ tenantId: TENANT_B, source: 'header' });
    await repo.insertBatch([ev(EV2_B)], t2.tenantId);

    // Isolation: mỗi event chỉ thấy dưới withTenant của chính tenant nó.
    const demoIds = await appPool.withTenant(DEMO_TENANT, (c) =>
      c
        .query<{ event_id: string }>(
          `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV2_DEMO, EV2_B]],
        )
        .then((r) => r.rows.map((x) => x.event_id)),
    );
    expect(demoIds).toContain(EV2_DEMO);
    expect(demoIds).not.toContain(EV2_B);

    const bIds = await appPool.withTenant(TENANT_B, (c) =>
      c
        .query<{ event_id: string }>(
          `SELECT event_id FROM behavior_events WHERE event_id = ANY($1::uuid[])`,
          [[EV2_DEMO, EV2_B]],
        )
        .then((r) => r.rows.map((x) => x.event_id)),
    );
    expect(bIds).toContain(EV2_B);
    expect(bIds).not.toContain(EV2_DEMO);
  });

  it('icp_app cross-tenant WRITE is blocked by RLS WITH CHECK', async () => {
    // Trong context demo, cố INSERT row mang tenant_id = B → WITH CHECK vi phạm.
    await expect(
      appPool.withTenant(DEMO_TENANT, (c) =>
        c.query(
          `INSERT INTO behavior_events
             (tenant_id, event_id, event_type, occurred_at, session_id, properties, app_version)
           VALUES ($1, gen_random_uuid(), 'session.started', NOW(), 'iso-test', '{}'::jsonb, '0.0.1-test')`,
          [TENANT_B],
        ),
      ),
    ).rejects.toThrow();
  });
});
