/**
 * `@icp/shared-types/cart` — Cart entity types cho S-05 First Cart/Order Flow.
 *
 * **Scope:** Zod schemas + branded types cho Cart entity per D-S05-02 LAW
 * (Redis JSON Snapshot Cart Storage + 7 MCP Tools + Pattern A Interrupt-Aware Fields).
 *
 * **Storage:** Redis key `cart:{user_id}` JSON string (Cart schema sans user_id)
 * TTL 7d. Mutex `cart:{user_id}:lock` TTL 5s. See 02_DATA_MODEL.md §5
 * (post-T02 inline reconcile per C-S05-B).
 *
 * **Dual access pattern (S-02 T06 C-32 + C-34 LOCKED, S-05 T01 extends):**
 * - **Frontend** (`apps/web`, Next.js bundler): subpath
 *   `import { CartSchema, type Cart } from '@icp/shared-types/cart'`
 * - **Backend** (`apps/gateway`, NestJS CommonJS): root import
 *   `import { CartSchema } from '@icp/shared-types'` (root barrel re-exports)
 *
 * **Schema verbatim per D-S05-02 LAW (decisions-log line 50-96):** Em KHÔNG
 * substitute `UuidSchema`/`IsoDateSchema`/`MoneySchema` từ primitives.ts because
 * Rule 8 LAW (artifact integrity > stylistic DRY). D-S05-02 LAW literal verbatim
 * từ PHASE_00_INTENT_05_MOCKUP_HANDOFF.md §3 lines 64-119.
 *
 * **Pattern A interrupt-aware fields (NEW per D-S05-02 câu #2 Option C):**
 * - `pending_interrupts.clear_confirm_rid` — track active clear-cart interrupt
 * - `pending_interrupts.stock_issue_rid` — track active stock-resolve interrupt
 * - `pending_interrupts.stock_issue_product_ids` — array of product_ids awaiting resolve
 * - `last_action_rid` — link cart mutation to original LangGraph rid (Tempo trace continuity)
 *
 * @see slices/S-05_decisions-log.md Section 1 D-S05-02 LAW
 * @see docs/handoff/00/PHASE_00_INTENT_05_MOCKUP_HANDOFF.md §3
 * @see docs/mockups/intent-05/intent-05-state-0-happy.html (4 items + summary)
 * @see docs/mockups/intent-05/intent-05-state-E-stock-issue.html (in_stock false)
 * @see docs/mockups/intent-05/intent-05-state-G-promo-applied.html (promo + free_gift_hint)
 *
 * S-05 T01 emit (Phiên Sx05-1).
 */

import { z } from 'zod';

// Product snapshot — captured at add-to-cart time, NOT joined live (ADR-05-02 LOCKED)
export const CartItemSnapshotSchema = z.object({
  title: z.string(),
  brand: z.string().nullable(),
  image_url: z.string().nullable(),
  image_gradient: z.string().nullable(),   // "#FEF3C7,#FCD34D"
  icon_hint: z.string().nullable(),         // "i-bottle"
  original_price: z.number().int().nullable(),
});

export const CartItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
  unit_price: z.number().int().nonnegative(),
  added_at: z.string().datetime(),
  snapshot: CartItemSnapshotSchema,

  // BE-derived at fetch time (live re-query Postgres per ADR-05-02 stock exception)
  in_stock: z.boolean(),
  available_stock: z.number().int().nullable(),
});

export const CartSchema = z.object({
  user_id: z.string().uuid(),
  items: z.array(CartItemSchema),
  updated_at: z.string().datetime(),

  // Computed at response time (BE)
  totals: z.object({
    subtotal: z.number().int(),
    discount: z.number().int(),
    shipping: z.number().int(),
    total: z.number().int(),
  }),

  // Optional promo state
  promo: z.object({
    code: z.string(),
    label: z.string(),                 // "SALE15 giảm 15% toàn giỏ"
    discount_amount: z.number().int(),
  }).nullable(),

  // Optional free-gift hint
  free_gift_hint: z.object({
    threshold: z.number().int(),       // 200000
    progress: z.number().int(),        // current subtotal
    gift_label: z.string(),            // "Dầu ăn Tường An 250ml"
  }).nullable(),

  // D-S05-02 LAW NEW Pattern A interrupt-aware fields per câu #2 Option C:
  pending_interrupts: z.object({
    clear_confirm_rid: z.string().nullable(),
    stock_issue_rid: z.string().nullable(),
    stock_issue_product_ids: z.array(z.string()).nullable(),
  }).nullable(),
  last_action_rid: z.string().nullable(),
});

export type CartItemSnapshot = z.infer<typeof CartItemSnapshotSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
