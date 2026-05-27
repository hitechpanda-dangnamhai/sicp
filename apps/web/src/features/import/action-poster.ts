/**
 * apps/web/src/features/import/action-poster.ts
 *
 * Single fetch utility for `POST /api/v1/intent/{rid}/action` — S-07 Import
 * flow Pattern P2 interrupt resume (submit_draft → INTERRUPT #1, commit →
 * INTERRUPT #2).
 *
 * Slice:    S-07 First Image AI Import
 *           T02.C FE Page Wire (Phiên Sx07-F)
 *
 * **Cloned from** `apps/web/src/features/search/action-poster.ts` (136 LOC,
 * S-04 T05 emit). Identical fetch + Idempotency-Key + composite key contract.
 * Adds 2 NEW choice values (`submit_draft`, `commit`) to the IntentActionChoice
 * union for Intent 01 graph resume.
 *
 * Source:   apps/gateway/src/intent/intent-action.controller.ts:85 @Post(':rid/action')
 *           apps/ai/src/graphs/intents/importing_by_images.py:510-518 (INTERRUPT #1
 *           submit_draft check) + line 600+ (INTERRUPT #2 commit handler)
 *
 * Decisions applied:
 * - **D-S04-13 LAW**: Option Z Redis pub/sub → action POST does NOT reopen
 *   EventSource; same connection receives resume events via shared
 *   sse:pubsub:{rid} channel.
 * - **Warning #1** (handoff Section 2.4): Field name `choice` (canonical),
 *   NOT `action`. Verified 3-source-truth: gateway controller forwards
 *   `body.choice`; AI main.py:657 parses `payload.get("choice")`;
 *   importing_by_images.py:515 checks `choice == "submit_draft"`.
 * - **W1 LOCK** (Phiên Sx04-9b): Idempotency-Key is RAW UUID v4 client-side;
 *   middleware builds composite `intent:action:{rid}:{attempt_n}` server-side.
 *   DO NOT compose composite client-side.
 * - **C-S07-P** (deferred Phase 3): Gateway lacks ZodValidationPipe — invalid
 *   choice values pass-through OK (no 400). For T02 hackathon, FE sends only
 *   canonical values (`submit_draft` | `commit`).
 *
 * Cookie auth via `credentials: 'include'` per ADR-019 (httpOnly icp_session).
 */

/**
 * Choice union for S-07 Intent 01 Import flow resume.
 *
 * **S-07 NEW (2):**
 * - `submit_draft` — INTERRUPT #1 resume → BE validates draft + emits cards
 * - `commit`       — INTERRUPT #2 resume → BE products.create + vespa.index + final event
 *
 * **S-04 / S-05 baseline (10)** — kept for forward-compat passthrough; T02 FE
 * doesn't emit these for Intent 01 but the field exists in shared DTO:
 * - S-04 (6): accept | reject | retry_ai | continue_basic | add_to_cart | skip
 * - S-05 (4): confirm_clear | cancel_clear | resolve_remove | resolve_replace
 *
 * For `submit_draft`, `value` is the validated ProductDraft (mirrors
 * `@icp/shared-types/products` ProductDraftSchema):
 *   `{title, brand?, category, attributes, price, stock, sku?, description?, image_data?, image_url?}`
 * Per Warning #2: `brand` is TOP-LEVEL (NOT nested in attributes).
 *
 * For `commit`, `value` is empty (BE looks up draft from graph state).
 */
export type ImportIntentActionChoice =
  // S-07 NEW (Phiên Sx07-F per importing_by_images.py:510-518 + 600+)
  | 'submit_draft'
  | 'commit'
  // S-04 baseline (typo + degrade + cart-add flows)
  | 'accept'
  | 'reject'
  | 'retry_ai'
  | 'continue_basic'
  | 'add_to_cart'
  | 'skip'
  // S-05 T02 NEW (cart-domain Pattern A interrupt resume)
  | 'confirm_clear'
  | 'cancel_clear'
  | 'resolve_remove'
  | 'resolve_replace';

export interface ImportActionBody {
  choice: ImportIntentActionChoice;
  /**
   * Per-choice payload. For S-07:
   *   - `submit_draft` → validated ProductDraft (see ProductDraftSchema)
   *   - `commit`       → empty `{}` or undefined
   */
  value?: Record<string, unknown>;
  /**
   * D-S04-13 LAW monotonic counter; middleware reads to build composite
   * idempotency key namespace `intent:action:{rid}:{attempt_n}` (TTL 5min).
   *
   * Caller MUST increment per submit attempt. ImportState.attemptN is the
   * source of truth.
   */
  _meta?: { attempt_n: number };
}

export interface ImportActionResponse {
  request_id: string;
  status: 'accepted';
}

/**
 * POST /api/v1/intent/{rid}/action with UUID v4 Idempotency-Key.
 *
 * @param rid    request_id from prior POST /intent 202 response (REQUIRED; throws if empty)
 * @param body   action payload — choice + optional value + _meta.attempt_n
 * @returns      response { request_id, status: 'accepted' }
 * @throws       Error on HTTP non-2xx (with status code + body excerpt)
 *
 * **Example (S-07 submit_draft):**
 * ```ts
 * await postImportAction(state.requestId, {
 *   choice: 'submit_draft',
 *   value: {
 *     title: 'Maggi nước tương 200ml',
 *     brand: 'Maggi',                          // ← top-level per D-S04-11 LAW
 *     category: 'nuoc_tuong',
 *     attributes: { size: '200ml', type: 'dam_dac' },  // ← brand NOT here
 *     price: 25000,
 *     stock: 50,
 *     sku: 'MGI-NT-200',
 *     description: '...',
 *   },
 *   _meta: { attempt_n: state.attemptN },
 * });
 * ```
 *
 * **Example (S-07 commit):**
 * ```ts
 * await postImportAction(state.requestId, {
 *   choice: 'commit',
 *   _meta: { attempt_n: state.attemptN },
 * });
 * ```
 */
export async function postImportAction(
  rid: string,
  body: ImportActionBody,
): Promise<ImportActionResponse> {
  if (!rid) {
    throw new Error('postImportAction: rid required');
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
      `postImportAction ${rid} choice=${body.choice} failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
    );
  }

  return res.json() as Promise<ImportActionResponse>;
}
