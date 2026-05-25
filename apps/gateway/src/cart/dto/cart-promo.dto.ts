/**
 * apps/gateway/src/cart/dto/cart-promo.dto.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-05 LAW LLM-assisted promo typo).
 *
 * Zod schema + DTO for `POST /api/v1/cart/promo` request body.
 *
 * Maps to MCP cart.apply_promo params {user_id, code}. Code is normalized
 * (uppercased + trimmed) inside MCP layer.
 *
 * **LLM typo correction is NOT done at this Gateway layer** — MCP returns
 * `{error: 'INVALID_CODE'}` on miss; Gateway propagates to FE which may
 * issue a separate retry via `/api/v1/intent` with `hint='cart_promo_typo'`
 * (out-of-scope Sx05-2; T03 + T04 owner decides FE retry UX).
 *
 * @see slices/S-05_decisions-log.md D-S05-05 LAW
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CartPromoSchema = z.object({
  code: z.string().min(1).max(50),
});

export class CartPromoDto extends createZodDto(CartPromoSchema) {}
