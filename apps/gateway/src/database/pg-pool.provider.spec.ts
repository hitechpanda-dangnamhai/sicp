/**
 * apps/gateway/src/database/pg-pool.provider.spec.ts
 *
 * S-P0-01 T01 — unit test cho PgPool.withTenant() (multi-tenant enforcement).
 *
 * Mock pg.Pool/PoolClient — verify transaction envelope đúng:
 *   BEGIN → set_config('app.tenant_id', $1, true) → fn → COMMIT, release().
 * Lỗi trong fn → ROLLBACK + release + rethrow. UUID sai → throw sớm.
 *
 * Run: pnpm --filter @icp/gateway test -- pg-pool.provider.spec
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pg trước khi import provider (constructor `new Pool()`).
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
const mockPool = {
  connect: vi.fn(async () => mockClient),
  on: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
};
vi.mock('pg', () => ({
  Pool: vi.fn(() => mockPool),
}));

import { PgPool } from './pg-pool.provider';

const DEMO = '11111111-1111-1111-1111-111111111111';

function makePgPool(): PgPool {
  const config = { get: (k: string) => (k === 'DATABASE_URL' ? 'postgres://x:y@h:5432/d' : undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PgPool(config as any);
}

describe('PgPool.withTenant (S-P0-01 T01)', () => {
  beforeEach(() => {
    mockClient.query.mockReset().mockResolvedValue({ rows: [] });
    mockClient.release.mockReset();
    mockPool.connect.mockClear();
  });

  it('wraps fn in BEGIN / set_config / COMMIT and releases the client', async () => {
    const pg = makePgPool();
    const out = await pg.withTenant(DEMO, async (client) => {
      await client.query('SELECT 1');
      return 'ok';
    });

    expect(out).toBe('ok');
    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toBe("SELECT set_config('app.tenant_id', $1, true)");
    expect(mockClient.query.mock.calls[1][1]).toEqual([DEMO]);
    expect(calls).toContain('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('ROLLBACKs and rethrows when fn throws, still releasing the client', async () => {
    const pg = makePgPool();
    await expect(
      pg.withTenant(DEMO, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid tenant_id format before opening a connection', async () => {
    const pg = makePgPool();
    await expect(pg.withTenant('not-a-uuid', async () => 1)).rejects.toThrow(/invalid tenant_id/);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });
});
