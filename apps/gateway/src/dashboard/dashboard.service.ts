/**
 * apps/gateway/src/dashboard/dashboard.service.ts
 *
 * Dashboard service — REAL DB aggregations per Sx08-J (KING OF LAW: hoàn thiện
 * tính năng → query thật thay stub). Was S-03 D-10 stub returning hardcoded
 * 8/2.4M/142; replaced now that orders + order_items + products tables ship
 * data (S-05 Cart/Order + product inventory).
 *
 * **3 KPIs (scoped to authenticated merchant via userId):**
 *   - orders_today    = COUNT(orders) status='paid', created_at = today (TZ
 *                       Asia/Ho_Chi_Minh), user_id = merchant.
 *   - revenue_today   = COALESCE(SUM(orders.total), 0) same filter (paid only —
 *                       user CHỐT Sx08-J: doanh thu = đơn đã thanh toán thật).
 *   - inventory_count = COALESCE(SUM(products.stock), 0) status='active',
 *                       merchant_id = merchant (user CHỐT: tồn kho = tổng số
 *                       lượng hàng còn, KHÔNG phải số loại SP).
 *
 * **Timezone:** day boundary computed in Asia/Ho_Chi_Minh (parity với V006
 * analytics_daily MV: `DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')`).
 *
 * **DB access:** PgPool (S-02 T06) injected via DatabaseModule — pattern parity
 * với TrackingModule. `pool.query()` auto-emits OTel `pg.query` child span.
 *
 * **Defensive:** result rows COALESCE'd to 0 in SQL; parsed via Zod schema to
 * catch drift (throws if mismatch).
 *
 * Sx08-J emit (replace S-03 D-10 stub).
 */

import { Injectable } from '@nestjs/common';
import { PgPool } from '../database';
import { createLogger, type IcpLogPayload } from '../observability';
import { DashboardStatsSchema, type DashboardStatsType } from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'dashboard.service' });

  constructor(private readonly pg: PgPool) {}

  /**
   * Aggregate dashboard KPIs for the given merchant from live DB tables.
   *
   * @param userId authenticated merchant id (orders.user_id / products.merchant_id)
   * @returns DashboardStatsType matching DashboardStatsSchema
   */
  async getStats(userId: string): Promise<DashboardStatsType> {
    // Orders + revenue: paid orders created today (HCMC tz). Single row.
    const ordersSql = `
      SELECT
        COUNT(*)::int                      AS orders_today,
        COALESCE(SUM(total), 0)::bigint    AS revenue_today
      FROM orders
      WHERE user_id = $1
        AND status = 'paid'
        AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
            = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    `;
    // Inventory: total stock units across active products for this merchant.
    const inventorySql = `
      SELECT COALESCE(SUM(stock), 0)::bigint AS inventory_count
      FROM products
      WHERE merchant_id = $1
        AND status = 'active'
    `;

    const [ordersRes, inventoryRes] = await Promise.all([
      this.pg.query<{ orders_today: number; revenue_today: string }>(ordersSql, [userId]),
      this.pg.query<{ inventory_count: string }>(inventorySql, [userId]),
    ]);

    // pg returns BIGINT as string → Number() (values well within JS safe-int
    // for Hackathon scale: revenue/stock far below 2^53).
    const stats: DashboardStatsType = {
      orders_today: ordersRes.rows[0]?.orders_today ?? 0,
      revenue_today: Number(ordersRes.rows[0]?.revenue_today ?? 0),
      inventory_count: Number(inventoryRes.rows[0]?.inventory_count ?? 0),
      currency: 'VND',
    };

    // Defensive: parse via Zod schema to catch drift between query result and
    // schema definition. Throws if mismatch.
    DashboardStatsSchema.parse(stats);

    this.log.info(
      {
        message: 'dashboard.stats_served',
        extras: { source: 'db', user_id_prefix: userId.slice(0, 8) },
      } as IcpLogPayload,
      'dashboard.stats_served',
    );

    return stats;
  }
}
