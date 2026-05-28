/**
 * apps/web/src/features/voice-buy/voice-action-poster.ts
 *
 * Thin voice-buy resume-action wrappers over the shared `postAction` utility.
 *
 * Slice:    S-08 Voice Buy (Intent 02) — V-SLICE
 * Task:     T02 FE Page Wire (Phiên Sx08-G) — NEW (B6)
 *
 * Source:   REUSE-IMPORT `postAction, IntentActionChoice, IntentActionBody` from
 *           `apps/web/src/features/search/action-poster.ts` (S-04 baseline +
 *           S-05/S-08 extends). That module already includes `clarify_pick`
 *           (11th choice, C-S08-O) + generic value/_meta shape — DO NOT clone the
 *           fetch logic.
 *
 * Decisions applied:
 * - §2.2: resume choice shapes — clarify_pick → {product_id};
 *   resolve_replace → {product_id, replacement_id}; resolve_remove → {product_id}.
 * - §2.2 W1: clarify chip-row read from voice_clarify_options SSE; resume ONLY
 *   sends {choice:'clarify_pick', value:{product_id}}.
 * - D-S04-13 LAW: action POST does NOT reopen EventSource (Option Z pub/sub);
 *   resume events arrive on the still-open stream. `_meta.attempt_n` increments
 *   per logical retry (caller-supplied).
 * - No React deps (pure utility).
 */

import {
  postAction,
  type IntentActionResponse,
} from '@/src/features/search/action-poster';

/**
 * state-D clarify pick — user selected a candidate chip.
 * Resume payload per §2.2: {choice:'clarify_pick', value:{product_id}}.
 */
export function postClarifyPick(
  rid: string,
  productId: string,
  attemptN: number,
): Promise<IntentActionResponse> {
  return postAction(rid, {
    choice: 'clarify_pick',
    value: { product_id: productId },
    _meta: { attempt_n: attemptN },
  });
}

/**
 * state-F resolve via replacement — user tapped "Thêm vào giỏ" on a suggestion.
 * Resume payload per §2.2: {choice:'resolve_replace', value:{product_id, replacement_id}}.
 */
export function postResolveReplace(
  rid: string,
  productId: string,
  replacementId: string,
  attemptN: number,
): Promise<IntentActionResponse> {
  return postAction(rid, {
    choice: 'resolve_replace',
    value: { product_id: productId, replacement_id: replacementId },
    _meta: { attempt_n: attemptN },
  });
}

/**
 * state-F resolve via removal — user chose to drop the out-of-stock item.
 * Resume payload per §2.2: {choice:'resolve_remove', value:{product_id}}.
 */
export function postResolveRemove(
  rid: string,
  productId: string,
  attemptN: number,
): Promise<IntentActionResponse> {
  return postAction(rid, {
    choice: 'resolve_remove',
    value: { product_id: productId },
    _meta: { attempt_n: attemptN },
  });
}

/**
 * state-C bulk add-to-cart confirm — user tapped "Thêm vào giỏ".
 * Resume payload per §2.2: {choice:'add_to_cart', value:{product_id}}.
 */
export function postAddToCart(
  rid: string,
  productId: string,
  attemptN: number,
): Promise<IntentActionResponse> {
  return postAction(rid, {
    choice: 'add_to_cart',
    value: { product_id: productId },
    _meta: { attempt_n: attemptN },
  });
}
