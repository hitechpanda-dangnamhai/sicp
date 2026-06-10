/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProductsService {
  /**
   * Update an existing product (owner-merchant only)
   * Partial update — omit any field to keep current value. Immutable: id, merchant_id, category, created_at, vespa_doc_id, rating_*, sold_count, trend_score. After PG commit (+ ProductUpdated outbox event emitted), Gateway orchestrates vespa.index re-index. PG commit always succeeds first; Vespa failure logs warning + response.indexed=false (S-06 outbox-relay-worker will retry downstream).
   * @param id Product UUID (must be owned by current merchant)
   * @returns any
   * @throws ApiError
   */
  public static productsControllerUpdate(
    id: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/products/{id}',
      path: {
        'id': id,
      },
    });
  }
}
