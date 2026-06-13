/**
 * apps/gateway/src/database/seed-foundation.spec.ts
 *
 * S-P0-03/T02a (W-80 + W-75 seed-close) — Integration test: CI seed foundation
 * sau `ci-min.sql` có ≥2 tenant + ≥1 customer global, merchant1 id BẤT BIẾN,
 * và data tenant-scoped vẫn cô lập cross-tenant (tenant-gate ADR-052).
 *
 * **2 connection** (RLS-aware, bài học T01b):
 *   - superuser (BYPASSRLS): đọc tenants/users/memberships (bảng GLOBAL, KHÔNG
 *     RLS theo ADR-046) + seed/teardown product fixture tenant#2.
 *   - icp_app (NOBYPASSRLS) qua PgPool.withTenant(): kiểm RLS product isolation.
 *
 * Run (cần Postgres up + V011 + ci-min.sql seed):
 *   DATABASE_URL_SUPER='postgresql://icp:icp_dev_password@localhost:5432/icp' \
 *   DATABASE_URL_APP='postgresql://icp_app:icp_app_dev_password@localhost:5432/icp' \
 *   RUN_DB_TESTS=1 pnpm --filter @icp/gateway test seed-foundation
 *
 * KHÔNG mock — seed + RLS chỉ kiểm được trên Postgres thật.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PgPool } from './pg-pool.provider';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const DEMO2_TENANT = 'a2a2a2a2-0000-4000-8000-000000000002'; // ci-min.sql persistent
const MERCHANT1_ID = '19f25ecb-569d-459e-9e5d-a70a7cf15af6'; // FIXED (test_t05:30)
const MERCHANT2_ID = 'b2b2b2b2-0000-4000-8000-000000000002';
// Product fixture id riêng — KHÔNG đụng PROD_ID test_t05 (a5705705…).
const ISO_PROD = 'a2a20000-0000-4000-8000-0000000000f2';

const SUPER_URL =
  process.env.DATABASE_URL_SUPER ?? 'postgresql://icp:icp_dev_password@localhost:5432/icp';
const APP_URL =
  process.env.DATABASE_URL_APP ?? 'postgresql://icp_app:icp_app_dev_password@localhost:5432/icp';

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

// Opt-in qua RUN_DB_TESTS=1 (CI job integration-db) — plain CI no-DB stays green.
const RUN_DB = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!RUN_DB)('S-P0-03 T02a — seed foundation (≥2 tenant + customer + isolation)', () => {
  let sup: Pool;
  let appPool: PgPool;

  beforeAll(async () => {
    sup = new Pool({ connectionString: SUPER_URL });
    appPool = new PgPool(appConfig());

    // Product fixture cho tenant#2 (cross-tenant read isolation). Superuser
    // BYPASSRLS → gán tenant_id tường minh. merchant2 là member tenant#2.
    await sup.query(
      `INSERT INTO products (id, merchant_id, tenant_id, title, category, attributes, price, stock, status)
       VALUES ($1, $2, $3, 'T02a iso fixture', 'test', '{}'::jsonb, 10000, 5, 'active')
       ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id`,
      [ISO_PROD, MERCHANT2_ID, DEMO2_TENANT],
    );
  });

  afterAll(async () => {
    await sup.query(`DELETE FROM products WHERE id = $1`, [ISO_PROD]);
    await appPool.onModuleDestroy();
    await sup.end();
  });

  it('seed có ≥2 tenant (DEMO + demo2 persistent)', async () => {
    const r = await sup.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM tenants`);
    expect(Number(r.rows[0].n)).toBeGreaterThanOrEqual(2);
    const slugs = await sup.query<{ slug: string }>(
      `SELECT slug FROM tenants WHERE id = ANY($1::uuid[])`,
      [[DEMO_TENANT, DEMO2_TENANT]],
    );
    const got = slugs.rows.map((x) => x.slug);
    expect(got).toContain('demo');
    expect(got).toContain('demo2');
  });

  it('seed có ≥1 customer global (customer1@demo.icp, KHÔNG membership — ADR-046)', async () => {
    const r = await sup.query<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE email = 'customer1@demo.icp'`,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].role).toBe('customer');
    const m = await sup.query(
      `SELECT 1 FROM tenant_memberships WHERE user_id = $1`,
      [r.rows[0].id],
    );
    expect(m.rows).toHaveLength(0); // customer GLOBAL — không thuộc tenant nào
  });

  it('merchant1 id BẤT BIẾN (test_t05:30 hardcode) + member tenant DEMO', async () => {
    const r = await sup.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'merchant1@demo.icp'`,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].id).toBe(MERCHANT1_ID);
    const m = await sup.query(
      `SELECT 1 FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2`,
      [MERCHANT1_ID, DEMO_TENANT],
    );
    expect(m.rows).toHaveLength(1);
  });

  it('merchant2 owner tenant#2 (demo2)', async () => {
    const m = await sup.query<{ role: string }>(
      `SELECT role FROM tenant_memberships WHERE user_id = $1 AND tenant_id = $2`,
      [MERCHANT2_ID, DEMO2_TENANT],
    );
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].role).toBe('owner');
  });

  // Tenant-gate ADR-052: data-path seed → cross-tenant assert BẮT BUỘC.
  it('cross-tenant: withTenant(DEMO) KHÔNG thấy product tenant#2', async () => {
    const rows = await appPool.withTenant(DEMO_TENANT, (c) =>
      c
        .query<{ id: string }>(`SELECT id FROM products WHERE id = $1`, [ISO_PROD])
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(0); // RLS lọc — product thuộc demo2
  });

  it('cross-tenant: withTenant(demo2) THẤY đúng product tenant#2', async () => {
    const rows = await appPool.withTenant(DEMO2_TENANT, (c) =>
      c
        .query<{ id: string; tenant_id: string }>(
          `SELECT id, tenant_id FROM products WHERE id = $1`,
          [ISO_PROD],
        )
        .then((r) => r.rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(DEMO2_TENANT);
  });
});
