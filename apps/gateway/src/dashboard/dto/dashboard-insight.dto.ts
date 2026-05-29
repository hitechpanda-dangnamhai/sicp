/**
 * apps/gateway/src/dashboard/dto/dashboard-insight.dto.ts
 *
 * DTO for GET /api/v1/dashboard/insight — the home "AI VỪA PHÁT HIỆN" hero card.
 *
 * Replaces the previously HARD-CODED "Doanh thu tuần này giảm 12% / 2 nguyên
 * nhân" in HeroInsightCard.tsx with REAL analytics from the same engine the
 * /intent-07 analysis uses (analytics.detect_anomaly), so the headline number
 * and the drill-down numbers always agree (D-S10-NN-G: every figure traces to a
 * formula + input). LLM is NOT involved — pure engine output.
 *
 * Fields:
 *   - delta_pct        merchant-wide revenue change, recent 7d vs prior 7d
 *                      (detect_anomaly.merchant.delta_pct). Sign carries
 *                      direction (negative = down). null if no data.
 *   - direction        'down' | 'up' | 'flat' derived from delta_pct.
 *   - cause_count      number of categories flagged severity != 'normal'
 *                      (caution OR opportunity) — the "N nguyên nhân chính".
 *   - has_data         false when the merchant has no anomaly rows (e.g. <
 *                      enough orders) → FE shows a neutral fallback.
 */
import { z } from 'zod';

export const DashboardInsightSchema = z.object({
  delta_pct: z.number().nullable(),
  direction: z.enum(['down', 'up', 'flat']),
  cause_count: z.number().int().min(0),
  has_data: z.boolean(),
});

export type DashboardInsightType = z.infer<typeof DashboardInsightSchema>;

/** Swagger response shape (kept in sync with the zod schema above). */
export class DashboardInsightDto {
  delta_pct!: number | null;
  direction!: 'down' | 'up' | 'flat';
  cause_count!: number;
  has_data!: boolean;
}
