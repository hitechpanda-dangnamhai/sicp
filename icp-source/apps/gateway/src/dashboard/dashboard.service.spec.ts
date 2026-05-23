/**
 * apps/gateway/src/dashboard/dashboard.service.spec.ts
 *
 * S-03 T03b Integration test — DashboardService stub.
 *
 * **Strategy per Phiên 36 user decision Option (A)** (mirror `auth.service.spec.ts`
 * vitest integration pattern). Since DashboardService is a stub (D-10 MAR-1
 * Q5 RESOLVED) with hardcoded JSON return — NO PG / Redis / external deps —
 * tests are simple shape verification + schema parse assertion. Controller-
 * level AC verify (AC-21 200 with cookie + AC-22 401 without) chuyển sang
 * Batch 6 `apps/gateway/test/smoke-dashboard.sh` per repo canonical pattern
 * (smoke-auth.sh / smoke-auth-events.sh / smoke-tracker.sh precedent).
 *
 * Pre-conditions: none (stub service has no I/O).
 *
 * Run from host:
 *   pnpm --filter @icp/gateway test -- dashboard.service.spec
 *
 * Coverage maps to Task Pack v1.1 ACs:
 *   - DM-14 stub endpoint shape verify → it('returns DashboardStats shape')
 *   - D-10 hardcoded values match mockup → it('matches mockup StatBar values')
 *   - Schema-shape resilience → it('parses cleanly through DashboardStatsSchema')
 *
 * Target: 3/3 PASS.
 *
 * S-03 T03b emit (Phiên 36 Batch 1).
 */

import { describe, it, expect } from 'vitest';
import { DashboardService } from './dashboard.service';
import { DashboardStatsSchema } from './dto/dashboard-stats.dto';

describe('DashboardService (S-03 T03b stub)', () => {
  const service = new DashboardService();

  it('returns DashboardStats shape with all required fields', async () => {
    const stats = await service.getStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('orders_today');
    expect(stats).toHaveProperty('revenue_today');
    expect(stats).toHaveProperty('inventory_count');
    expect(stats).toHaveProperty('currency');

    expect(typeof stats.orders_today).toBe('number');
    expect(typeof stats.revenue_today).toBe('number');
    expect(typeof stats.inventory_count).toBe('number');
    expect(typeof stats.currency).toBe('string');
  });

  it('matches mockup StatBar values per D-10 hardcoded contract', async () => {
    const stats = await service.getStats();

    // Per `golden-reference-mockup.html` StatBar text: "8 Đơn hôm nay" /
    // "2.4M Doanh thu" / "142 Tồn kho". 2.4M VND = 2_400_000 numeric.
    expect(stats.orders_today).toBe(8);
    expect(stats.revenue_today).toBe(2_400_000);
    expect(stats.inventory_count).toBe(142);
    expect(stats.currency).toBe('VND');
  });

  it('parses cleanly through DashboardStatsSchema (Zod shape lock)', async () => {
    const stats = await service.getStats();

    // Should NOT throw — service internal `DashboardStatsSchema.parse(stats)`
    // already validates, but external re-parse catches any future regression
    // where service returns raw object bypassing schema. Defensive layer.
    const parsed = DashboardStatsSchema.parse(stats);
    expect(parsed).toEqual(stats);
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
