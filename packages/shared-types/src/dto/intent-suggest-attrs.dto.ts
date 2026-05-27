/**
 * `@icp/shared-types/dto/intent-suggest-attrs.dto.ts`
 *
 * S-07 T02 NEW (Phiên Sx07-F per Q1 option iii-a → Sx07-G hotfix per C-S07-O):
 * Request/response shapes for `POST /api/v1/intent/{rid}/suggest-attrs` endpoint —
 * on-demand AI attribute suggestions for the Intent 01 PrefillForm chips editor.
 *
 * **Flow:**
 * 1. FE PrefillForm renders 4-5 attribute chips from `form_prefill.attributes`
 * 2. Merchant clicks "Thêm" button below chips
 * 3. FE POSTs `{ category, existing_attrs }` to this endpoint
 * 4. Gateway proxies to MCP `vision.suggest_attributes` (Gemini 2.5 Flash ~7s)
 * 5. AI returns 3 chip suggestions with example_values
 * 6. FE renders 3 new chips → merchant picks → expands value picker
 *
 * **Why a separate endpoint vs extending POST /intent:**
 * - Different semantics: not a new intent flow; just an LLM query tool
 * - Different idempotency: composite key NOT `intent:action:{rid}:{n}`;
 *   simple `idem:cache:{userId}:{idempotencyKey}` (base S-02 middleware)
 * - Different latency budget: 7s synchronous OK (no SSE stream needed) vs
 *   intent flow's interrupt-driven async
 *
 * @see slices/S-07_decisions-log.md C-S07-O (NEW Phiên Sx07-F) — on-demand
 *      AI chip suggestions, option iii-a (separate endpoint) RESOLVED
 * @see apps/mcp/src/tools/vision.py `suggest_attributes()` — MCP impl
 * @see apps/gateway/src/intent/intent-suggest-attrs.controller.ts — proxy
 * @see apps/web/src/features/import/use-ai-attribute-suggest.ts — FE hook
 *
 * S-07 T02 emit (Phiên Sx07-F).
 */

import { z } from 'zod';

/**
 * Request body for `POST /api/v1/intent/{rid}/suggest-attrs`.
 *
 * **Why include `category`** (already known on server from prior
 * `form_prefill` SSE event)? — defensive: server LangGraph state lives in
 * Redis `ai:checkpoint:{rid}` with TTL; if user pauses >15min then clicks
 * "Thêm", state may have expired. Client passes current category
 * authoritatively to avoid re-running vision.analyze just to re-derive.
 *
 * **Why `existing_attrs` is `Record<string, string>`:** Chips in PrefillForm
 * are all string-valued (merchant types text into picker). Empty `{}` is
 * valid (e.g., low-confidence vision result returned no attributes).
 */
export const IntentSuggestAttrsRequestSchema = z.object({
  /** Canonical category (or 'unknown') — drives LLM prompt context. */
  category: z.string().min(1).max(100),
  /** Attributes already shown in PrefillForm chips (LLM excludes duplicates). */
  existing_attrs: z.record(z.string(), z.string()).default({}),
});

export type IntentSuggestAttrsRequest = z.infer<typeof IntentSuggestAttrsRequestSchema>;

/**
 * Single suggested attribute chip — what FE renders as a tap-to-add chip.
 *
 * `example_values` (3 strings) help the merchant pick faster: a value-picker
 * dropdown shows these as quick-select options on chip expand. The merchant
 * can also free-type a custom value.
 */
export const SuggestedAttributeSchema = z.object({
  /** snake_case attribute key (e.g., 'taste_profile', 'origin'). */
  key: z.string().min(1).max(50),
  /** Vietnamese display label (e.g., 'Vị', 'Xuất xứ'). */
  label_vn: z.string().min(1).max(100),
  /** 2-3 example values for quick-pick UI (Vietnamese context). */
  example_values: z.array(z.string().max(100)).min(1).max(5),
});

export type SuggestedAttribute = z.infer<typeof SuggestedAttributeSchema>;

/**
 * Response body for `POST /api/v1/intent/{rid}/suggest-attrs` (HTTP 200).
 *
 * Empirically (Phiên Sx07-F Sx07-G hotfix verification 2026-05-26):
 * Gemini 2.5 Flash returns exactly 3 chips ~7.21s latency, EXCELLENT VN
 * context quality.
 */
export const IntentSuggestAttrsResponseSchema = z.object({
  suggested_attributes: z.array(SuggestedAttributeSchema).min(0).max(5),
});

export type IntentSuggestAttrsResponse = z.infer<typeof IntentSuggestAttrsResponseSchema>;
