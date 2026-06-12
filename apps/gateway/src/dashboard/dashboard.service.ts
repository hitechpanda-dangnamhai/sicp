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
import { DashboardInsightSchema, type DashboardInsightType } from './dto/dashboard-insight.dto';
import { McpClient } from '../clients/mcp.client';

@Injectable()
export class DashboardService {
  private readonly log = createLogger({
    service: 'gateway',
    version: process.env.APP_VERSION ?? '0.0.1',
    env: process.env.NODE_ENV ?? 'dev',
  }).child({ component: 'dashboard.service' });

  constructor(
    private readonly pg: PgPool,
    private readonly mcp: McpClient,
  ) {}

  /**
   * Aggregate dashboard KPIs for the given merchant from live DB tables.
   *
   * S-P0-01 T02 — chạy TRONG withTenant(tenantId): orders/products là bảng
   * tenant-scoped (RLS). Dưới role icp_app, SET LOCAL app.tenant_id ép RLS chỉ
   * thấy row của tenant này; WHERE user_id/merchant_id giữ scope theo merchant
   * TRONG tenant. tenantId=null (merchant chưa có shop) → trả KPI rỗng (không
   * query — withTenant đòi UUID).
   *
   * @param userId authenticated merchant id (orders.user_id / products.merchant_id)
   * @param tenantId active tenant từ URL (req.tenant_id, TenantMembershipGuard set)
   * @returns DashboardStatsType matching DashboardStatsSchema
   */
  async getStats(userId: string, tenantId: string | null): Promise<DashboardStatsType> {
    if (!tenantId) {
      const empty: DashboardStatsType = {
        orders_today: 0,
        revenue_today: 0,
        inventory_count: 0,
        currency: 'VND',
      };
      DashboardStatsSchema.parse(empty);
      return empty;
    }
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

    // Cả 2 query phải dùng CÙNG client trong transaction để chia sẻ GUC SET LOCAL.
    const [ordersRes, inventoryRes] = await this.pg.withTenant(tenantId, (client) =>
      Promise.all([
        client.query<{ orders_today: number; revenue_today: string }>(ordersSql, [userId]),
        client.query<{ inventory_count: string }>(inventorySql, [userId]),
      ]),
    );

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

  /**
   * Hero "AI VỪA PHÁT HIỆN" insight for the given merchant — REAL analytics.
   *
   * Calls analytics.detect_anomaly (same engine as /intent-07) and derives:
   *   - delta_pct   = merchant.delta_pct (recent 7d vs prior 7d, merchant-wide)
   *   - cause_count = # categories with severity != 'normal' (the "N nguyên nhân")
   *
   * No LLM, no hard-coded numbers (replaces HeroInsightCard 12% / 2 causes).
   * Defensive: any MCP/shape failure degrades to has_data=false so the home
   * page never errors on the hero card.
   */
  async getInsight(userId: string, tenantId: string | null): Promise<DashboardInsightType> {
    let insight: DashboardInsightType = {
      delta_pct: null,
      direction: 'flat',
      cause_count: 0,
      has_data: false,
    };

    try {
      // S-P0-01 T02c — identity header cho MCP (analytics.detect_anomaly = Postgres).
      const res = await this.mcp.call<{
        merchant?: { delta_pct?: number; recent_rev?: number; prior_rev?: number };
        categories?: Array<{ severity?: string }>;
      }>(
        'analytics.detect_anomaly',
        { merchant_id: userId, window_days: 7 },
        { userId, tenantId },
      );

      const merchant = res?.merchant;
      const categories = res?.categories ?? [];
      // has_data only when there is at least one category row AND a prior-period
      // baseline to compare against (else delta is meaningless / divide-by-zero).
      const hasData =
        categories.length > 0 && typeof merchant?.delta_pct === 'number';

      if (hasData) {
        const delta = merchant!.delta_pct as number;
        const causeCount = categories.filter(
          (c) => c.severity && c.severity !== 'normal',
        ).length;
        insight = {
          delta_pct: delta,
          direction: delta < -0.5 ? 'down' : delta > 0.5 ? 'up' : 'flat',
          cause_count: causeCount,
          has_data: true,
        };
      }
    } catch (err) {
      // Degrade gracefully — hero card shows neutral fallback, home stays up.
      this.log.warn(
        {
          message: 'dashboard.insight_degraded',
          extras: {
            user_id_prefix: userId.slice(0, 8),
            error: err instanceof Error ? err.message : String(err),
          },
        } as IcpLogPayload,
        'dashboard.insight_degraded',
      );
    }

    DashboardInsightSchema.parse(insight);

    this.log.info(
      {
        message: 'dashboard.insight_served',
        extras: {
          source: 'detect_anomaly',
          user_id_prefix: userId.slice(0, 8),
          delta_pct: insight.delta_pct,
          cause_count: insight.cause_count,
          has_data: insight.has_data,
        },
      } as IcpLogPayload,
      'dashboard.insight_served',
    );

    return insight;
  }
}
