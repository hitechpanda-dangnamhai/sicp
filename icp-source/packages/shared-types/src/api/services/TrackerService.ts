/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TrackBatchDto } from '../models/TrackBatchDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TrackerService {
  /**
   * Ingest behavior events batch
   * Accepts a batch of user behavior events from client tracker SDK. Validates each event against its event_type-specific properties schema; drops invalid or out-of-window events server-side (per 07_BEHAVIOR §9). Persists remaining via INSERT ... ON CONFLICT DO NOTHING (dedup by event_id+occurred_at PK).
   * @param requestBody Batch of behavior events (1-500 per request).
   * @returns any Batch accepted. Body reports accepted/dropped counts + request_id for log correlation.
   * @throws ApiError
   */
  public static trackingControllerIngest(
    requestBody: TrackBatchDto,
  ): CancelablePromise<{
    accepted: number;
    dropped: number;
    request_id: string;
  }> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/track',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Envelope validation failed (e.g. events array empty or >500 items).`,
      },
    });
  }
}
