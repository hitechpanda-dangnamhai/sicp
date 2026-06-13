/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IntentActionDto } from '../models/IntentActionDto';
import type { IntentRequestDto } from '../models/IntentRequestDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class IntentService {
  /**
   * Dispatch intent to AI service
   * Returns request_id for SSE stream pickup via GET /intent/stream?id=<rid>. S-04 T03: mode field selects Variant B (ai_augmented) or Variant A (basic_fallback) per D-S04-03 LAW Adaptive Single Endpoint. Sx05-3-CODE HOTFIX (D-S05-13 LAW): @UseGuards(JwtAuthGuard) added — req.user.id forwarded to AI as PostIntentBody.user_id so cart_by_text graph operates on correct authenticated cart. S-P0-01 T03e (ADR-050): IntentPolicyGuard thay TenantMembershipGuard — tenant strict mọi intent; membership-required (01 import/07 analyzing + default-deny) → owner ∈ tenant_ids (403); customer-allowed (02/03/04/05) PASS.
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
   * Forwards Redis pub/sub channel `sse:pubsub:{rid}` to FE EventSource. S-04 T03: 17 typed event types (10 S-02 + 7 S-04) per 03_API §3. S-P0-01 T03c: JwtAuthGuard (cookie httpOnly, EventSource auto-send) + rid ownership-check (user + tenant∈membership). KHÔNG TenantMembershipGuard — EventSource không set được X-Tenant-Id (ADR-019 constraint).
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
  /**
   * Resume interrupted intent graph with user choice
   * Forwards action body to AI service /intent/{rid}/resume endpoint. AI calls graph.astream(Command(resume=<choice>)) to continue from Pattern P2 interrupt checkpoint. SSE events flow back via existing GET /intent/stream connection (Option Z Redis pub/sub).
   * @param rid request_id from POST /intent response
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static intentActionControllerAction(
    rid: string,
    requestBody: IntentActionDto,
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/intent/{rid}/action',
      path: {
        'rid': rid,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
  /**
   * Request AI-suggested attribute chips for PrefillForm
   * On-demand Gemini 2.5 Flash call to suggest 3 additional attribute chips for the merchant to add via PrefillForm "Thêm" button. Synchronous ~7s; idempotent via Idempotency-Key header.
   * @param rid request_id (for traceability; graph state lookup not required)
   * @param requestBody
   * @returns any
   * @throws ApiError
   */
  public static intentSuggestAttrsControllerSuggestAttrs(
    rid: string,
    requestBody: {
      category: string;
      existing_attrs?: Record<string, string>;
    },
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/intent/{rid}/suggest-attrs',
      path: {
        'rid': rid,
      },
      body: requestBody,
      mediaType: 'application/json',
    });
  }
}
