/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CartAddItemDto } from '../models/CartAddItemDto';
import type { CartPromoDto } from '../models/CartPromoDto';
import type { CartUpdateQtyDto } from '../models/CartUpdateQtyDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CartService {
  /**
   * Fetch current user cart with inline stock validation
   * @returns any
   * @throws ApiError
   */
  public static cartControllerGetCart(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/cart',
    });
  }
  /**
   * Wipe entire cart (no-confirm path; use POST /intent with hint=cart_clear_confirm for interrupt UX)
   * @returns any
   * @throws ApiError
   */
  public static cartControllerClear(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/v1/cart',
    });
  }
  /**
   * Add item to cart or update qty if existing
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static cartControllerAddItem(
    requestBody: CartAddItemDto,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/cart/items',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Update item qty (qty=0 auto-removes)
   * @param productId Product UUID in cart
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static cartControllerUpdateQty(
    productId: string,
    requestBody: CartUpdateQtyDto,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/cart/items/{productId}',
      path: {
        'productId': productId,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Remove single item from cart (idempotent)
   * @param productId Product UUID in cart
   * @returns any
   * @throws ApiError
   */
  public static cartControllerRemoveItem(
    productId: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/v1/cart/items/{productId}',
      path: {
        'productId': productId,
      },
    });
  }
  /**
   * Apply promo code (exact match; LLM typo via FE retry)
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static cartControllerApplyPromo(
    requestBody: CartPromoDto,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/cart/promo',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Remove applied promo code (idempotent)
   * @returns any
   * @throws ApiError
   */
  public static cartControllerRemovePromo(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/v1/cart/promo',
    });
  }
}
