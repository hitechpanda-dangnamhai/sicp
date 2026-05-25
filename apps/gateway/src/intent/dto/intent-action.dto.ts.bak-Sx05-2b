/**
 * apps/gateway/src/intent/dto/intent-action.dto.ts
 *
 * S-04 T03 NEW (Phiên Sx04-8b per D-S04-13 LAW Pattern A interrupt+resume).
 *
 * Zod schema + DTO for `POST /api/v1/intent/:rid/action` request body.
 * Validates the `{choice, value?, _meta?}` payload that Gateway forwards to
 * AI internal `POST /intent/{rid}/resume` endpoint.
 *
 * **`choice` field semantic enum** (per `03_API_CONTRACTS.md §1.2` line 96-99):
 *   - Typo flow:    `'accept'` | `'reject'`
 *   - Degrade flow: `'retry_ai'` | `'continue_basic'`
 *   - Cart flow:    `'add_to_cart'` | `'skip'`
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
  /** Resume choice per D-S04-13 LAW 3 use cases (typo/degrade/cart). */
  choice: z.enum([
    'accept',
    'reject',
    'retry_ai',
    'continue_basic',
    'add_to_cart',
    'skip',
  ]),
  /**
   * Optional value payload — shape depends on `choice`:
   *   - `add_to_cart` → `{product_id: string}` (required for co-purchase lookup)
   *   - `accept` (typo) → unused
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
