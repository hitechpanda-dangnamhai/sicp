/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DashboardInsightDto } from '../models/DashboardInsightDto';
import type { DashboardStatsDto } from '../models/DashboardStatsDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DashboardService {
  /**
   * Get dashboard KPI stats — stub per S-03 D-10
   * Returns 200 with hardcoded JSON `{orders_today, revenue_today, inventory_count, currency: "VND"}` matching mockup StatBar text values. Requires icp_session cookie. Real DB aggregations defer to future slice when S-05 Cart/Order ships data. Per S-03 D-10 MAR-1 Q5 RESOLVED + DM-14.
   * @returns DashboardStatsDto
   * @throws ApiError
   */
  public static dashboardControllerGetStats(): CancelablePromise<DashboardStatsDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/dashboard/stats',
      errors: {
        401: `Missing or invalid icp_session cookie`,
      },
    });
  }
  /**
   * Get home hero AI insight — REAL analytics (S-10 detect_anomaly)
   * Returns `{delta_pct, direction, cause_count, has_data}` from analytics.detect_anomaly (merchant-wide 7d-vs-prior-7d + count of flagged categories). Replaces the hard-coded "giảm 12% / 2 nguyên nhân" in HeroInsightCard. Same engine as /intent-07 so numbers agree. Requires icp_session cookie.
   * @returns DashboardInsightDto
   * @throws ApiError
   */
  public static dashboardControllerGetInsight(): CancelablePromise<DashboardInsightDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/dashboard/insight',
      errors: {
        401: `Missing or invalid icp_session cookie`,
      },
    });
  }
}
