/**
 * apps/gateway/src/dashboard/dto/dashboard-stats.dto.ts
 *
 * Response body shape for `GET /api/v1/dashboard/stats` — used by
 * `@ApiResponse({type: ...})` Swagger decorator to document response contract.
 *
 * Pattern: nestjs-zod `createZodDto` — same single-source-of-truth as auth DTOs
 * (mirror `auth/dto/auth-response.dto.ts`). Generates OpenAPI schema → consumed
 * by `pnpm openapi:export` → `@icp/shared-types` FE typed client (per C-17
 * LOCKED openapi.json sync pattern Phiên 33).
 *
 * Per S-03 D-10 (MAR-1 Q5 RESOLVED Phiên 34) — BE stub endpoint returns
 * hardcoded JSON values. No real DB query for now. Future slice may replace
 * with real aggregations from orders + inventory tables.
 *
 * **Shape:** (REAL DB aggregations per Sx08-J — was S-03 D-10 stub)
 *   - `orders_today: number` — COUNT paid orders today (HCMC tz), per merchant
 *   - `revenue_today: number` — SUM(orders.total) paid today VND, per merchant
 *   - `inventory_count: number` — SUM(products.stock) active, per merchant
 *     (tổng số lượng hàng còn — user CHỐT Sx08-J, KHÔNG phải số loại SKU)
 *   - `currency: 'VND'` (literal) — hardcoded for Vietnam market
 *
 * S-03 T03b emit (Phiên 36 Batch 1); DB-wired Sx08-J.
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DashboardStatsSchema = z.object({
  orders_today: z.number().int().nonnegative(),
  revenue_today: z.number().int().nonnegative(),
  inventory_count: z.number().int().nonnegative(),
  currency: z.literal('VND'),
});

export type DashboardStatsType = z.infer<typeof DashboardStatsSchema>;

export class DashboardStatsDto extends createZodDto(DashboardStatsSchema) {}
