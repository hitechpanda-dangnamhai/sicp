/**
 * apps/gateway/src/dashboard/dashboard.service.spec.ts
 *
 * S-P0-01 T02 — DashboardService unit test (multi-tenant scope guard).
 *
 * Lịch sử: bản S-03 T03b kiểm "stub hardcoded 8/2.4M/142" đã LỖI THỜI sau khi
 * Sx08-J viết lại getStats() thành query DB thật (PgPool + McpClient). T02 thêm
 * tham số `tenantId` + chạy qua `withTenant()`. Spec này giờ kiểm nhánh KHÔNG
 * cần DB: tenantId=null (merchant chưa có shop) → trả KPI rỗng, KHÔNG chạm pg.
 * Nhánh có-tenant (RLS scope thật) kiểm ở integration `tenant-isolation.spec.ts`
 * + smoke. Giữ 2 ca Zod defensive.
 *
 * Run từ host: pnpm --filter @icp/gateway test -- dashboard.service.spec
 */

import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import type { PgPool } from '../database';
import type { McpClient } from '../clients/mcp.client';
import { DashboardStatsSchema } from './dto/dashboard-stats.dto';

/** pg giả NÉM nếu bị gọi — chứng minh nhánh null-tenant không query DB. */
const throwingPg = {
  query: vi.fn(() => {
    throw new Error('pg.query must NOT be called on null-tenant path');
  }),
  withTenant: vi.fn(() => {
    throw new Error('withTenant must NOT be called on null-tenant path');
  }),
} as unknown as PgPool;
const noopMcp = {} as unknown as McpClient;

describe('DashboardService (S-P0-01 T02 — tenant scope guard)', () => {
  const service = new DashboardService(throwingPg, noopMcp);

  it('null tenant (no shop) → empty KPIs, no DB query', async () => {
    const stats = await service.getStats('user-1', null);

    expect(stats).toEqual({
      orders_today: 0,
      revenue_today: 0,
      inventory_count: 0,
      currency: 'VND',
    });
    expect(typeof stats.orders_today).toBe('number');
    // Schema-valid (service parse trước khi trả; re-parse defensive).
    expect(DashboardStatsSchema.parse(stats)).toEqual(stats);
  });

  it('rejects non-integer values via Zod schema (defensive)', () => {
    // Verify schema-level defense against future bugs (vd accidental float
    // return from real aggregation query) — catches BEFORE FE consumes.
    const invalidFloat = {
      orders_today: 8.5, // float → rejected (z.number().int())
      revenue_today: 2_400_000,
      inventory_count: 142,
      currency: 'VND' as const,
    };
    expect(() => DashboardStatsSchema.parse(invalidFloat)).toThrow();
  });

  it('rejects non-VND currency literal (defensive)', () => {
    // z.literal('VND') — only 'VND' string accepted; future locales add via
    // schema extension (NOT runtime).
    const invalidCurrency = {
      orders_today: 8,
      revenue_today: 2_400_000,
      inventory_count: 142,
      currency: 'USD', // rejected literal
    };
    expect(() => DashboardStatsSchema.parse(invalidCurrency)).toThrow();
  });
});
