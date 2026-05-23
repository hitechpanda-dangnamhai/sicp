/**
 * apps/gateway/src/dashboard/dashboard.service.ts
 *
 * Stub Dashboard service per S-03 D-10 (MAR-1 Q5 RESOLVED Phiên 34) — returns
 * hardcoded JSON values matching DashboardStatsSchema. NO real DB query.
 *
 * **Why stub now (rationale per D-10):**
 *   - Mockup `golden-reference-mockup.html` StatBar (3 KPIs: 8 orders / 2.4M
 *     revenue / 142 inventory) needs functional BE endpoint for FE TanStack
 *     Query useStats hook (AC-25 + DM-14).
 *   - Real aggregations (SUM/COUNT from orders + order_items + products) defer
 *     to future slice when respective V-SLICEs ship data (S-05 Cart/Order +
 *     product inventory updates).
 *   - Stub allows AC-21 (BE endpoint with JwtAuthGuard) + AC-22 (401 without)
 *     to verify FULL auth + endpoint plumbing now, NOT block on DB schema.
 *
 * **Pattern parity with `auth/application/forgot-password.use-case.ts`** (S-03
 * T03 Phiên 33 stub precedent) — `@Injectable()` + `createLogger().child()` +
 * async method even though logic sync (consistent service interface +
 * future-proof when real DB query added).
 *
 * **Log:** `dashboard.stats_served` info-level — captures observability signal
 * for analytics (which users hit dashboard, how often). NO PII in extras
 * (user_id is request-scoped, NOT logged here — controller already records on
 * span attribute per C-28 manual span pattern).
 *
 * S-03 T03b emit (Phiên 36 Batch 1).
 */

import { Injectable } from '@nestjs/common';
import { createLogger, type IcpLogPayload } from '../observability';
import { DashboardStatsSchema, type DashboardStatsType } from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'dashboard.service' });

  /**
   * Return hardcoded dashboard stats per D-10 stub.
   *
   * Values chosen to match mockup `golden-reference-mockup.html` StatBar text:
   *   - orders_today=8 → matches mockup "8 Đơn hôm nay"
   *   - revenue_today=2400000 → matches mockup "2.4M Doanh thu" (VND)
   *   - inventory_count=142 → matches mockup "142 Tồn kho"
   *
   * @returns DashboardStatsType matching DashboardStatsSchema
   */
  async getStats(): Promise<DashboardStatsType> {
    const stats: DashboardStatsType = {
      orders_today: 8,
      revenue_today: 2_400_000,
      inventory_count: 142,
      currency: 'VND',
    };

    // Defensive: parse via Zod schema to catch any future drift between
    // hardcoded literal and schema definition (vd if schema gains a new
    // required field but stub forgot to update). Throws if mismatch.
    DashboardStatsSchema.parse(stats);

    this.log.info(
      {
        message: 'dashboard.stats_served',
        extras: { source: 'stub' },
      } as IcpLogPayload,
      'dashboard.stats_served',
    );

    return stats;
  }
}
