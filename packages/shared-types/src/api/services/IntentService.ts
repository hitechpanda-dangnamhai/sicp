/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IntentRequestDto } from '../models/IntentRequestDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class IntentService {
  /**
   * Dispatch intent to AI service
   * Returns request_id for SSE stream pickup. See `GET /intent/stream`.
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static intentControllerDispatch(
    requestBody: IntentRequestDto,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/intent',
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * SSE stream of intent events
   * Emits 10 typed events (per 03_API §3) + heartbeat keepalive. Requires icp_session cookie.
   * @param id
   * @returns any
   * @throws ApiError
   */
  public static intentControllerStream(
    id: string,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/intent/stream',
      query: {
        'id': id,
      },
    });
  }
}
