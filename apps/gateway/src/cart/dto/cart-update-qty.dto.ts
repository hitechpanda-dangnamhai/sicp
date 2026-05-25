/**
 * apps/gateway/src/cart/dto/cart-update-qty.dto.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-02 LAW).
 *
 * Zod schema + DTO for `PATCH /api/v1/cart/items/:productId` request body.
 *
 * Maps to MCP cart.update_qty params {user_id, product_id, qty}. The
 * product_id comes from path param (NOT body), so body only contains qty.
 *
 * `qty=0` is allowed — MCP cart.update_qty treats qty=0 as auto-remove per
 * D-S05-02 LAW (sugar for cart.remove); FE may use either DELETE or
 * PATCH qty=0.
 *
 * @see slices/S-05_decisions-log.md D-S05-02 LAW
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CartUpdateQtySchema = z.object({
  /**
   * New qty. `0` → auto-remove (idempotent). Cap 99 per D-S05-02 LAW UI
   * stepper max. Negative values rejected by Zod min(0).
   */
  qty: z.number().int().min(0).max(99),
});

export class CartUpdateQtyDto extends createZodDto(CartUpdateQtySchema) {}
