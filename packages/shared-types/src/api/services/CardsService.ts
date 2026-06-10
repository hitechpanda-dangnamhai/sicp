/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CardsService {
  /**
   * List pending action cards for current user
   * Returns cards in `pending` status sorted by `created_at` DESC. Per S-07 Intent 01: cards are emitted in-band via SSE during the import flow; this endpoint serves as a refresh/refetch source if the merchant returns to the page later.
   * @param limit
   * @returns any
   * @throws ApiError
   */
  public static cardsControllerList(
    limit: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/cards',
      query: {
        'limit': limit,
      },
    });
  }
  /**
   * Mark action card as accepted
   * Sets card.status = accepted + resolved_at = NOW(). Idempotent: duplicate requests return {updated: false}. Optional applied_value is merged into suggestion JSONB for audit.
   * @param id
   * @returns any
   * @throws ApiError
   */
  public static cardsControllerAccept(
    id: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/cards/{id}/accept',
      path: {
        'id': id,
      },
    });
  }
  /**
   * Mark action card as rejected
   * Sets card.status = rejected + resolved_at = NOW(). Idempotent: duplicate requests return {updated: false}.
   * @param id
   * @returns any
   * @throws ApiError
   */
  public static cardsControllerReject(
    id: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/cards/{id}/reject',
      path: {
        'id': id,
      },
    });
  }
}
