/**
 * apps/web/src/features/search/action-poster.ts
 *
 * Single fetch utility for `POST /api/v1/intent/{rid}/action` (D-S04-13 LAW Option Z resume).
 *
 * Slice:    S-04 First Product Discovery (baseline 6 choices)
 *           S-05 T03 EXTEND (Phiên Sx05-3) — IntentActionChoice 6→10 per BE T02 ship
 *
 * Task:     T05 FE Page Wire (Phiên Sx04-10)
 *           S-05 T03 (Phiên Sx05-3) — adds confirm_clear/cancel_clear/resolve_remove/resolve_replace
 *
 * Source:   apps/gateway/src/intent/intent-action.controller.ts:85 @Post(':rid/action')
 *           apps/gateway/src/intent/dto/intent-action.dto.ts:57-70 (T02 ship 10 choices)
 *           apps/gateway/src/intent/intent-action-idempotency.middleware.ts (UUID_V4_REGEX)
 *
 * Decisions applied:
 * - D-S04-13 LAW: Option Z Redis pub/sub → action POST does NOT reopen EventSource;
 *                 same connection receives resume events via shared sse:pubsub:{rid} channel.
 * - D-S05-01 + D-S05-03 LAW (S-05): Pattern A interrupt reuse for cart-domain entry intents
 *                 (cart_clear_confirm + cart_view_with_stock_check). Resume choices added:
 *                 confirm_clear | cancel_clear (clear-cart flow);
 *                 resolve_remove | resolve_replace (stock-issue flow).
 * - W1 LOCK (Phiên Sx04-9b): Idempotency-Key is RAW UUID v4 client-side; middleware
 *                            builds composite `intent:action:{rid}:{attempt_n}` server-side.
 *                            DO NOT compose composite client-side.
 * - C-15 NOT required: pure fetch utility, no React deps.
 *
 * Cookie auth via `credentials: 'include'` per ADR-019 (httpOnly icp_session).
 */

/**
 * Choice union per intent-action.dto.ts:57-70 verbatim (T02 ship Phiên Sx05-2b).
 *
 * S-04 baseline (6): accept | reject | retry_ai | continue_basic | add_to_cart | skip
 * S-05 NEW (4): confirm_clear | cancel_clear | resolve_remove | resolve_replace
 *
 * For `resolve_replace`, `value` is `{product_id: uuid, replacement_id: uuid}` (both required).
 * For `resolve_remove`, `value` is `{product_id: uuid}`.
 * For `confirm_clear` / `cancel_clear`, `value` unused.
 */
export type IntentActionChoice =
  // S-04 baseline (typo flow + degrade flow + cart-add flow)
  | 'accept'
  | 'reject'
  | 'retry_ai'
  | 'continue_basic'
  | 'add_to_cart'
  | 'skip'
  // S-05 T02 NEW per D-S05-01 + D-S05-03 LAW (cart-domain Pattern A interrupt resume)
  | 'confirm_clear'
  | 'cancel_clear'
  | 'resolve_remove'
  | 'resolve_replace';

export interface IntentActionBody {
  choice: IntentActionChoice;
  /** Per-choice payload (e.g., `{product_id}` for add_to_cart, `{product_id, replacement_id}` for resolve_replace). */
  value?: Record<string, unknown>;
  /** D-S04-13 LAW monotonic counter; middleware reads to build composite idempotency key. */
  _meta?: { attempt_n: number };
}

export interface IntentActionResponse {
  request_id: string;
  status: 'accepted';
}

/**
 * POST /api/v1/intent/{rid}/action with UUID v4 Idempotency-Key.
 *
 * @param rid    request_id from prior POST /intent 202 response (REQUIRED; throws if empty)
 * @param body   action payload — choice + optional value + _meta.attempt_n
 * @returns      response { request_id, status: 'accepted' }
 * @throws       Error on HTTP non-2xx (with status code in message)
 *
 * Example (S-04 Variant B add_to_cart trigger co_purchase_hint):
 * ```ts
 * await postAction(state.requestId, {
 *   choice: 'add_to_cart',
 *   value: { product_id: 'p_maggi_700ml' },
 *   _meta: { attempt_n: state.attemptN },
 * });
 * ```
 *
 * Example (S-05 Pattern A clear-cart confirm):
 * ```ts
 * await postAction(cartState.activeRid, {
 *   choice: 'confirm_clear',
 *   _meta: { attempt_n: cartState.attemptN },
 * });
 * ```
 *
 * Example (S-05 Pattern A stock-issue resolve via replacement):
 * ```ts
 * await postAction(cartState.activeRid, {
 *   choice: 'resolve_replace',
 *   value: { product_id: 'chinsu-250g', replacement_id: 'chinsu-500g' },
 *   _meta: { attempt_n: cartState.attemptN },
 * });
 * ```
 */
export async function postAction(
  rid: string,
  body: IntentActionBody,
): Promise<IntentActionResponse> {
  if (!rid) {
    throw new Error('postAction: rid required');
  }

  // W1 LOCK: raw UUID v4 only; middleware builds composite server-side.
  const idempotencyKey = crypto.randomUUID();

  const res = await fetch(`/api/v1/intent/${rid}/action`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errText = '';
    try {
      errText = await res.text();
    } catch {
      /* swallow secondary parse error */
    }
    throw new Error(
      `postAction ${rid} choice=${body.choice} failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
    );
  }

  return res.json() as Promise<IntentActionResponse>;
}
