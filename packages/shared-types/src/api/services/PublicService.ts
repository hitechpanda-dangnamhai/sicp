/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TenantBySlugResponseDto } from '../models/TenantBySlugResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PublicService {
  /**
   * Resolve tenant_id từ slug (public, no auth)
   * FE storefront /s/<slug> gọi 1 lần để lấy tenant_id rồi attach X-Tenant-Id cho request anonymous (tracking/public). KHÔNG auth, KHÔNG tenant context (bootstrap). 404 nếu slug không tồn tại hoặc tenant không active. ADR-046 amend (b).
   * @param slug DNS-safe tenant slug (a-z0-9-)
   * @returns TenantBySlugResponseDto
   * @throws ApiError
   */
  public static publicControllerTenantBySlug(
    slug: string,
  ): CancelablePromise<TenantBySlugResponseDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/public/tenant-by-slug/{slug}',
      path: {
        'slug': slug,
      },
      errors: {
        404: `Tenant not found or not active`,
      },
    });
  }
}
