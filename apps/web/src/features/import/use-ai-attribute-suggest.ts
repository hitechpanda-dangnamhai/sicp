'use client';

/**
 * apps/web/src/features/import/use-ai-attribute-suggest.ts
 *
 * TanStack Query mutation hook for POST /api/v1/intent/{rid}/suggest-attrs —
 * on-demand AI attribute chip suggestions (C-S07-O Sx07-G hotfix).
 *
 * Slice:    S-07 First Image AI Import
 *           T02.C FE feature module (Phiên Sx07-F)
 *
 * **Endpoint contract** (verified Phiên Sx07-F live test):
 *   POST /api/v1/intent/{rid}/suggest-attrs
 *   Headers: Cookie icp_session, Idempotency-Key UUIDv4
 *   Body: { category: string, existing_attrs: Record<string,string> }
 *   Response 200: { suggested_attributes: [{key, label_vn, example_values[]}] × 3 }
 *   Latency: ~7s p50 (Gemini 2.5 Flash text-only call)
 *
 * Decisions applied:
 * - **C-S07-O option iii-a LOCK** (Phiên Sx07-F): Separate endpoint (NOT
 *   extending POST /intent body). Different idempotency namespace, different
 *   sync vs SSE semantics, different latency budget.
 * - **S-05 T03 precedent**: TanStack `useMutation` pattern (mirrors
 *   `use-cart-mutations.ts` `usePostCartItem` line 117-133); no `onSuccess`
 *   invalidateQueries (suggest-attrs is stateless — no FE cache to refresh).
 * - **W1 LOCK**: raw UUID v4 Idempotency-Key (S-02 base middleware handles
 *   `idem:cache:{userId}:{key}` namespace — no composite needed).
 * - **C-15** 'use client' — uses crypto.randomUUID + TanStack hook.
 *
 * **Why TanStack mutation (NOT plain fetch wrapper):**
 * - Built-in `isPending` / `error` state simplifies PrefillForm "Aida đang nghĩ..."
 *   spinner UI without manual useState boilerplate
 * - Consistent error-shape with existing FE patterns (S-03 auth + S-05 cart)
 * - Free retry-on-mount support if user dismisses + re-clicks "Thêm"
 *
 * @see apps/gateway/src/intent/intent-suggest-attrs.controller.ts (Gateway proxy)
 * @see apps/mcp/src/tools/vision.py `suggest_attributes()` (MCP Gemini call)
 * @see packages/shared-types/src/dto/intent-suggest-attrs.dto.ts (Zod schemas)
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type {
  IntentSuggestAttrsRequest,
  IntentSuggestAttrsResponse,
  SuggestedAttribute,
} from '@icp/shared-types';

/**
 * Variables passed to the mutation `mutate(...)` / `mutateAsync(...)` call.
 * Mirrors `IntentSuggestAttrsRequest` Zod schema.
 */
export interface SuggestAttrsVars {
  category: string;
  /** Existing attribute keys (LLM will exclude duplicates). Empty object OK. */
  existingAttrs: Record<string, string>;
}

/**
 * Hook variant — caller passes `rid` at hook setup time (typical PrefillForm
 * pattern: one rid per import flow session).
 *
 * **Usage:**
 * ```tsx
 * const aiSuggest = useAIAttributeSuggest(state.requestId);
 * const handleSuggestClick = async () => {
 *   const result = await aiSuggest.mutateAsync({
 *     category: 'nuoc_tuong',
 *     existingAttrs: { brand: 'Maggi', size: '200ml' },
 *   });
 *   // result.suggested_attributes = [{key, label_vn, example_values}, ...]
 *   setChips(result.suggested_attributes);
 * };
 * // aiSuggest.isPending → drive "Aida đang nghĩ..." spinner
 * // aiSuggest.error    → render error banner inline
 * ```
 *
 * @param rid request_id from POST /intent 202 response. If empty, mutation throws.
 */
export function useAIAttributeSuggest(
  rid: string,
): UseMutationResult<IntentSuggestAttrsResponse, Error, SuggestAttrsVars> {
  return useMutation<IntentSuggestAttrsResponse, Error, SuggestAttrsVars>({
    mutationFn: async (vars) => {
      if (!rid) {
        throw new Error('useAIAttributeSuggest: rid required (no active import flow)');
      }
      const idempotencyKey = crypto.randomUUID();
      const body: IntentSuggestAttrsRequest = {
        category: vars.category,
        existing_attrs: vars.existingAttrs,
      };
      const res = await fetch(
        `/api/v1/intent/${encodeURIComponent(rid)}/suggest-attrs`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        let errText = '';
        try {
          errText = await res.text();
        } catch {
          /* swallow */
        }
        throw new Error(
          `useAIAttributeSuggest ${rid} failed: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ''}`,
        );
      }
      return (await res.json()) as IntentSuggestAttrsResponse;
    },
    // No onSuccess invalidate — suggest-attrs is stateless (no FE query cache).
  });
}

/**
 * Adapter helper — convert mutation result to the array shape PrefillForm
 * `onRequestSuggestAttrs` prop expects (`Promise<SuggestedAttribute[]>`).
 *
 * Typical usage at page level:
 * ```tsx
 * const aiSuggest = useAIAttributeSuggest(state.requestId);
 *
 * const handleRequestSuggest = async (category: string, existingAttrs: Record<string,string>) => {
 *   const result = await aiSuggest.mutateAsync({ category, existingAttrs });
 *   return result.suggested_attributes;
 * };
 *
 * <PrefillForm
 *   onRequestSuggestAttrs={handleRequestSuggest}
 *   ...
 * />
 * ```
 *
 * Exported for re-use; tests can also assert the adapter contract in isolation.
 */
export function extractSuggestedAttrs(
  response: IntentSuggestAttrsResponse,
): SuggestedAttribute[] {
  return response.suggested_attributes ?? [];
}
