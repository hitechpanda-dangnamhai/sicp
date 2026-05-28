/**
 * apps/gateway/src/intent/dto/intent-action.dto.ts
 *
 * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW Pattern A interrupt+resume).
 *
 * Zod schema + DTO for `POST /api/v1/intent/:rid/action` request body.
 * Validates the `{choice, value?, _meta?}` payload that Gateway forwards to
 * AI internal `POST /intent/{rid}/resume` endpoint.
 *
 * **`choice` field semantic enum** (per `03_API_CONTRACTS.md §1.2` line 96-99
 * + S-05 T02 reconcile per D-S05-01 + D-S05-03 LAW):
 *   - Typo flow:     `'accept'` | `'reject'`
 *   - Degrade flow:  `'retry_ai'` | `'continue_basic'`
 *   - Cart flow:     `'add_to_cart'` | `'skip'`
 *   - Cart clear:    `'confirm_clear'` | `'cancel_clear'` (S-05 NEW)
 *   - Stock resolve: `'resolve_remove'` | `'resolve_replace'` (S-05 NEW)
 *   - Voice clarify: `'clarify_pick'` (S-08 NEW per D-S08-NN-B LAW)
 *
 * **`_meta.attempt_n` field** (per `03_API §1.2` line 95): monotonic integer
 * incremented by FE per logical retry. Used by Gateway
 * `IntentActionIdempotencyMiddleware` to build composite key
 * `intent:action:{rid}:{attempt_n}` (TTL 5min per `02_DATA_MODEL.md §5`).
 * Allows legitimate retry with different attempt_n while preventing accidental
 * double-action on rapid taps.
 *
 * Pattern: `nestjs-zod` `createZodDto()` per T01 + T06 convention.
 *
 * @see docs/03_API_CONTRACTS.md §1.2 (Pattern A semantics)
 * @see docs/02_DATA_MODEL.md §5 (Redis key namespace `intent:action:{rid}:{n}`)
 * @see slices/S-04_decisions-log.md D-S04-13 LAW Pattern A + Option α
 * @see slices/S-05_decisions-log.md D-S05-01 LAW Hybrid Routing + D-S05-03 LAW
 *      Pattern A Interrupt Reuse cho clear_confirm + stock_resolve
 * @see slices/S-08_decisions-log.md D-S08-NN-B LAW Voice Action Intent Enum
 *      (Phiên Sx08-D — +1 'clarify_pick' for Intent 02 voice buy clarify
 *      interrupt state-D chip-row inline Pattern A per MAR-1 Q1 LOCKED)
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const IntentActionSchema = z.object({
  /**
   * Optional card_id for action card response correlation. Used by V-SLICE
   * action card flows (S-04 typo card, degrade card, cart card all carry
   * implicit card_id via SSE event payload — explicit field reserved for
   * future S-06 action cards with multiple choices per card).
   */
  card_id: z.string().optional(),
  /**
   * Resume choice per D-S04-13 LAW 3 use cases + S-05 T02 +2 use cases +
   * S-08 T01 +1 use case:
   *   - Typo/degrade/cart-add: `accept` | `reject` | `retry_ai` |
   *     `continue_basic` | `add_to_cart` | `skip`
   *   - Cart-clear (S-05 NEW per D-S05-01 + D-S05-03 LAW): `confirm_clear` |
   *     `cancel_clear` — resumes the `clear_action` interrupt at
   *     cart_by_text.py:_node_clear_confirm_prompt
   *   - Stock-resolve (S-05 NEW per D-S05-04 LAW): `resolve_remove` |
   *     `resolve_replace` — resumes the `stock_action` interrupt at
   *     cart_by_text.py:_node_stock_issue_lookup. For `resolve_replace`,
   *     pass `value: {product_id, replacement_id}` (both required).
   *   - Voice clarify (S-08 NEW per D-S08-NN-B LAW): `clarify_pick` —
   *     resumes the `clarify_pick` interrupt at
   *     buying_by_voices.py:_node_route_resolution. Pass
   *     `value: {product_id: <picked_sku>}` (required) — identifies which
   *     candidate the user picked from the state-D chip-row inline UI
   *     per MAR-1 Q1 LOCKED mockup intent-02-state-D-clarify.html.
   */
  choice: z.enum([
    'accept',
    'reject',
    'retry_ai',
    'continue_basic',
    'add_to_cart',
    'skip',
    // S-05 T02 NEW per D-S05-01 + D-S05-03 LAW (Pattern A interrupt resume
    // choices for cart-domain entry intents in cart_by_text.py):
    'confirm_clear', // resume clear_action interrupt → cart.clear
    'cancel_clear', // resume clear_action interrupt → no-op
    'resolve_remove', // resume stock_action interrupt → cart.remove
    'resolve_replace', // resume stock_action interrupt → cart.remove + cart.update_qty
    // S-08 T01 NEW per D-S08-NN-B LAW (Pattern A interrupt resume choice for
    // Intent 02 voice buy clarify path — state-D chip-row inline UI per
    // MAR-1 Q1 LOCKED). Resume payload: {choice:'clarify_pick',
    // value:{product_id: <picked_sku>}}.
    'clarify_pick', // resume clarify interrupt → re-resolve voice items with picked product_id
  ]),
  /**
   * Optional value payload — shape depends on `choice`:
   *   - `add_to_cart` → `{product_id: string}` (required for co-purchase lookup)
   *   - `resolve_replace` (S-05 NEW) → `{product_id: string, replacement_id: string}`
   *     (both required: out-of-stock id + replacement id picked by FE from
   *     the stock_issue_ready event payload)
   *   - `resolve_remove` (S-05 NEW) → `{product_id: string}` (required —
   *     identifies which out-of-stock item to remove)
   *   - `clarify_pick` (S-08 NEW per D-S08-NN-B LAW) → `{product_id: string}`
   *     (required — SKU of candidate user picked from state-D chip-row)
   *   - `accept` (typo) / `confirm_clear` / `cancel_clear` → unused
   *   - others → unused
   *
   * Typed `unknown` for forward-compat with future choices.
   */
  value: z.record(z.unknown()).optional(),
  /**
   * Retry attempt metadata. FE increments `attempt_n` per logical retry
   * (e.g. user taps "Thử lại với AI" then "Dùng bản cơ bản" for same
   * request_id → attempt_n=1 then attempt_n=2).
   *
   * Default `attempt_n=1` if omitted (first action attempt).
   */
  _meta: z
    .object({
      attempt_n: z.number().int().positive(),
    })
    .optional(),
});

export class IntentActionDto extends createZodDto(IntentActionSchema) {}
