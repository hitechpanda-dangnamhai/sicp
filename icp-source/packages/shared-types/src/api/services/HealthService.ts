/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthService {
  /**
   * Liveness probe
   * Returns 200 if process is up. No dependency checks.
   * @returns any Service is alive
   * @throws ApiError
   */
  public static healthControllerLiveness(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/health',
    });
  }
  /**
   * Readiness probe
   * Returns 200 if all dependencies are reachable. Returns 503 if any dep is down. Dependencies probed: postgres, redis, kafka, otel-collector, ai.
   * @returns any Service is ready
   * @throws ApiError
   */
  public static healthControllerReadiness(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/health/ready',
      errors: {
        503: `One or more deps unavailable`,
      },
    });
  }
}
