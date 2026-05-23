/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
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
}
