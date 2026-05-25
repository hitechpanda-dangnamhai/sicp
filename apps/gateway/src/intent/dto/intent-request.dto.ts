/**
 * apps/gateway/src/intent/dto/intent-request.dto.ts
 *
 * Zod schema + DTO for `POST /api/v1/intent` request body.
 *
 * S-02 T07 emit. Mirrors `AiClient.PostIntentBody` shape (single source-of-truth
 * `apps/gateway/src/clients/ai.client.ts` from T05) for type symmetry through
 * the pipe.
 *
 * Pattern: `nestjs-zod` `createZodDto()` per T01 + T06 convention (NOT
 * class-validator — global pipe absent per main.ts comment).
 *
 * **S-04 T03 amendment (Phiên Sx04-8b per D-S04-03 LAW):** ADD optional `mode`
 * field. `'ai_augmented'` (default) for Intent 03 Variant B full graph;
 * `'basic_fallback'` for Variant A baseline graceful degrade tier. Other
 * intents currently ignore this field (Intent 03 first-need).
 *
 * **S-05 T02 amendment (Phiên Sx05-2 per C-S05-F Path α LAW):** EXTEND `hint`
 * enum +2 values (`cart_clear_confirm`, `cart_view_with_stock_check`). These
 * are explicit entry-intent overrides used by FE cart page to dispatch the
 * AI service to the cart_by_text.py graph (instead of the default
 * searching_by_text router-classifier path). Backward-compat preserved:
 * `hint=undefined` or pre-S-05 values continue routing via the S-04
 * classifier path. See decisions-log D-S05-01 LAW Hybrid Routing topology
 * + C-S05-F Path α resolution (Phiên Sx05-2-DISCOVER verify cmd #18-25).
 *
 * @see docs/03_API_CONTRACTS.md §1.2 (multipart for image/voice deferred V-SLICE;
 *      `mode` field S-04 NEW per D-S04-03 LAW; `hint` enum S-05 extend per
 *      C-S05-F Path α + D-S05-01 LAW)
 * @see slices/S-05_decisions-log.md D-S05-01 LAW + C-S05-F resolution
 */

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const IntentRequestSchema = z.object({
  modality: z.enum(['text', 'image', 'voice']),
  content: z.string().min(1).max(5000).optional(),
  /**
   * Graph entry hint — extension of S-04 4-value enum per S-05 T02 C-S05-F
   * Path α LAW (Phiên Sx05-2).
   *
   * - `'import'`/`'buy'`/`'search'`/`'recommend'` (S-04 ship) — currently
   *   informational FE hint only; routed via classifier downstream.
   * - `'cart_clear_confirm'` (S-05 NEW) — explicit entry-intent override
   *   for AI dispatch to `cart_by_text.py` cart_clear_confirm subgraph
   *   per D-S05-01/03 LAW Pattern A interrupt reuse.
   * - `'cart_view_with_stock_check'` (S-05 NEW) — explicit entry-intent
   *   override for AI dispatch to `cart_by_text.py`
   *   cart_view_with_stock_check subgraph per D-S05-04 LAW Vespa+LLM stock
   *   replacement.
   *
   * Backward-compat: `hint=undefined` → AI dispatches default
   * `searching_by_text` per existing classifier (S-04 router_graph heuristic).
   */
  hint: z
    .enum([
      'import',
      'buy',
      'search',
      'recommend',
      'cart_clear_confirm',
      'cart_view_with_stock_check',
    ])
    .optional(),
  /**
   * S-04 NEW per D-S04-03 LAW (Phiên Sx04-8b T03).
   * - `'ai_augmented'` (default) — Variant B full graph
   * - `'basic_fallback'` — Variant A baseline (user-explicit degrade)
   * Auto-degrade trigger (LLM timeout) handled server-side, NOT via this field.
   */
  mode: z.enum(['ai_augmented', 'basic_fallback']).optional().default('ai_augmented'),
});

export class IntentRequestDto extends createZodDto(IntentRequestSchema) {}
