/**
 * apps/gateway/src/intent/intent-policy.ts
 *
 * S-P0-01 T03e (ADR-050) — Per-intent membership policy (default-deny).
 *
 * Mirror LITERAL dispatch `apps/ai/src/main.py:326-398` ((modality, entry_intent/
 * hint) → graph → intent) → phân lớp membership. ADR-050 §2:
 *   - membership-required = {01 import, 07 analyzing}
 *   - customer-allowed (tenant strict + ownership T03c) = {02 buy, 03 search,
 *     04 recommend, 05 cart}
 *
 * ADR-050 §3 DEFAULT-DENY: tuple KHÔNG khớp customer-allowed → đòi membership.
 * WHY: hai bản đồ hai ngôn ngữ (TS guard ↔ Python dispatch) tất drift; chiều
 * fail này biến drift thành 403 NHÌN THẤY (customer có ticket) thay vì lỗ
 * security im lặng. Matrix sống trong CODE (KHÔNG DB policies — ADR-050 §5).
 */

/**
 * entry_intent hints route text-modality → cart_by_text (Intent 05, customer).
 * Mirror main.py:387 `entry_intent in ("cart_clear_confirm","cart_view_with_stock_check")`.
 */
const CART_HINTS = new Set<string>(['cart_clear_confirm', 'cart_view_with_stock_check']);

/**
 * entry_intent hints route text-modality → searching_by_text (Intent 03, the
 * dispatch `else` main.py:397). `undefined` (no hint) = classifier default search.
 *
 * KHÔNG gồm 'analyze' (voice-only discriminator main.py:368): text+'analyze' rơi
 * DEFAULT-DENY (ADR-050 §3) → membership. Đây là divergence CHỦ Ý khỏi literal
 * dispatch (literal route text+analyze→search) — chiều fail an toàn: customer gửi
 * tuple lạ nhận 403 nhìn thấy, không lọt thành intent membership im lặng.
 */
const SEARCH_HINTS = new Set<string>(['search', 'buy', 'recommend', 'import']);

/**
 * True = intent đòi tenant membership (tenant ∈ jwt.tenant_ids); false =
 * customer-allowed (chỉ cần tenant strict + ownership T03c). Đọc tuple thô từ
 * request body (chạy ở guard TRƯỚC Zod pipe) → coerce non-string về undefined.
 */
export function intentRequiresMembership(modality: unknown, hint: unknown): boolean {
  const m = typeof modality === 'string' ? modality : undefined;
  const h = typeof hint === 'string' ? hint : undefined;

  // main.py:330-358 — image: 'recommend'→recommend(04) customer; else→import(01) membership.
  if (m === 'image') return h !== 'recommend';
  // main.py:368-385 — voice: 'analyze'→analyzing(07) membership; else→buy(02) customer.
  if (m === 'voice') return h === 'analyze';
  // text (hoặc modality lạ → Zod pipe 400 sau guard): main.py:387-398.
  if (h !== undefined && CART_HINTS.has(h)) return false; // cart(05) customer
  if (h === undefined || SEARCH_HINTS.has(h)) return false; // search(03) customer
  // DEFAULT-DENY (ADR-050 §3): tuple text lạ (vd 'analyze') → membership.
  return true;
}
