/**
 * apps/gateway/src/cart/dto/cart-add-item.dto.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-02 LAW snapshot pattern).
 *
 * Zod schema + DTO for `POST /api/v1/cart/items` request body.
 *
 * Maps 1:1 to MCP `cart.update_qty` upsert-path params per D-S05-02 LAW.
 * Gateway forwards body to MCP cart.update_qty with qty>0 → ADD path.
 *
 * Snapshot field is OPTIONAL — when absent, MCP cart.py falls back to
 * Postgres products row lookup to populate the snapshot fields (defensive).
 * In production FE always passes snapshot to lock in display fields at
 * add-to-cart moment per ADR-05-02 (avoid post-mutation snapshot drift).
 *
 * @see packages/shared-types/src/cart.ts CartItemSnapshotSchema (T01 ship)
 * @see slices/S-05_decisions-log.md D-S05-02 LAW
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CartAddItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
  /**
   * Optional snapshot per CartItemSnapshotSchema. Defensive — if omitted,
   * MCP cart.py fetches snapshot fields from Postgres products row at
   * add-to-cart moment.
   */
  snapshot: z
    .object({
      title: z.string().optional(),
      brand: z.string().nullable().optional(),
      image_url: z.string().nullable().optional(),
      image_gradient: z.string().nullable().optional(),
      icon_hint: z.string().nullable().optional(),
      original_price: z.number().int().nullable().optional(),
    })
    .optional(),
});

export class CartAddItemDto extends createZodDto(CartAddItemSchema) {}
