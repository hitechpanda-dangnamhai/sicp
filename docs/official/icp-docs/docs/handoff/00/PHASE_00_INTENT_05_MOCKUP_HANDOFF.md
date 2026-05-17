# PHASE 00 — Intent 05 (View Cart) Mockup Handoff

> **Status:** ✅ Complete · 8 mockup files (state 0 happy + 7 edge states A-G)
> **Date:** 2026-05-17
> **Owner:** AI Agent · Phase 00 Mockup Lead
> **Next:** Phase 02 — backend skeleton. Phase 04 — Redis cart MCP tools.

---

## 0. TL;DR

Intent 05 (View Cart) đã được mockup đầy đủ theo **Style 1 — Full-screen page** với 8 states. Cart data lưu Redis key `cart:{user_id}` JSON với product snapshot inline (tránh JOIN khi load).

**Migration:** 0 mới. V004 (promotions) **đã skip** cho hackathon — discount hardcode trong response JSON.
**Schema extension:** 1 file TypeScript `cart.ts` cho schema cart + cart item.
**MCP tools cần:** 5 tools (`cart.get`, `cart.update_qty`, `cart.remove`, `cart.clear`, `cart.validate_stock`).

---

## 1. File Inventory

| # | State | File | Purpose |
|---|-------|------|---------|
| 1 | 0 — Happy | `intent-05-state-0-happy.html` | 4 items với qty stepper, promo input, summary, free-ship hint, checkout CTA |
| 2 | A — Loading | `intent-05-state-A-loading.html` | Skeleton 4 row shimmer + footer skeleton trong khi `cart.get` |
| 3 | B — Empty | `intent-05-state-B-empty.html` | Brain centered 160px + 3 CTA (Tìm / Chụp ảnh / Mua lại đơn cũ) + AI suggestion card |
| 4 | C — Update qty | `intent-05-state-C-update-qty.html` | Optimistic UI: qty 2→3 với spinner inline + "Đang đồng bộ" toast |
| 5 | D — Remove item | `intent-05-state-D-remove.html` | Swipe-to-delete pattern (red action bar lộ ra) + undo toast 3s countdown |
| 6 | E — Stock issue | `intent-05-state-E-stock-issue.html` | 1 item out-of-stock với red border-left + AI replacement suggestion card |
| 7 | F — Clear confirm | `intent-05-state-F-clear-confirm.html` | Modal bottom sheet "Xoá toàn bộ giỏ hàng?" + AI advice + 2 button |
| 8 | G — Promo applied | `intent-05-state-G-promo-applied.html` | Confetti animation + "Tiết kiệm 21.750₫" + promo badge + free-gift hint |

---

## 2. Field Audit

| UI element | Source | Status |
|---|---|---|
| Cart items list | Redis `cart:{user_id}` JSON | ✅ V001 |
| Per-item brand | Snapshot in cart entry (set khi add) | ⚠️ DERIVED BE |
| Per-item title | Snapshot in cart entry | ⚠️ DERIVED BE |
| Per-item image_url / image_gradient / icon_hint | Snapshot in cart entry | ⚠️ DERIVED BE |
| Per-item qty | Redis cart entry | ✅ |
| Per-item unit_price (snapshot at add time) | Redis cart entry | ✅ |
| Per-item original_price (for sale badge) | Snapshot | ⚠️ DERIVED BE |
| Per-item line_total | `qty × unit_price` | ⚠️ DERIVED FE |
| Subtotal | `sum(line_totals)` | ⚠️ DERIVED FE |
| Discount (promo) | Hardcoded response field hoặc V004 (skip) | ⏭️ STATIC |
| Shipping fee | Hardcoded 0đ (free-ship khi subtotal ≥ 100k) | ⏭️ STATIC |
| Total | `subtotal - discount + shipping` | ⚠️ DERIVED FE |
| Stock status flag per item | Live re-query Postgres khi load cart | ⚠️ DERIVED BE |
| Free-ship progress hint | FE compute: 100000 - subtotal | ⚠️ DERIVED FE |
| Promo code validation | Static check trên hardcoded codes table | ⏭️ STATIC |
| Free-gift hint (state G) | Hardcoded rule "đơn ≥ 200k → tặng dầu ăn 250ml" | ⏭️ STATIC |

**Verdict:** ✅ 0 migration. V004 skip.

---

## 3. Schema Extension

File: `packages/shared-types/src/cart.ts`

```typescript
import { z } from 'zod';

// Product snapshot — captured at add-to-cart time, NOT joined live
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

  // BE-derived at fetch time
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
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
```

### Redis Key Pattern

```
cart:{user_id}              → JSON string (Cart schema, sans user_id field)
cart:{user_id}:lock         → mutex for write operations (TTL 5s)
```

**TTL:** Không set TTL — cart persistent giữa sessions (refresh page giữ lại). Có thể set TTL 30 ngày nếu cần cleanup.

---

## 4. MCP Tools Required

| Tool | Input | Output | Notes |
|---|---|---|---|
| `cart.get` | `user_id` | `Cart` | Khi load, also validate_stock cho mỗi item |
| `cart.update_qty` | `user_id, product_id, qty` | `Cart` | `qty=0` → tự remove. Validate `qty ≤ 99` |
| `cart.remove` | `user_id, product_id` | `Cart` | Explicit remove single item |
| `cart.clear` | `user_id` | `{cleared: true}` | Delete entire cart key |
| `cart.validate_stock` | `user_id` | `{updates: [...]}` | Re-check stock, mark `in_stock=false` cho items hết hàng |
| `cart.apply_promo` | `user_id, code` | `Cart \| {error: 'INVALID_CODE'}` | Validate promo code → update Cart.promo field |
| `cart.remove_promo` | `user_id` | `Cart` | Clear promo field |

---

## 5. ADRs

### ADR-05-01 — Style chọn Full-screen page (không phải bottom sheet)

**Decision:** Cart UI là full-screen route `/cart`, không phải bottom sheet kéo lên từ chat.

**Rationale:**
1. **Hackathon-friendly screenshot:** judge nhìn 1 frame thấy đủ items + total + CTA.
2. **Continuity từ Intent 03/04:** state-E của cả hai đã có cart pill overlay "4 món · 125.500₫" — tap pill này dẫn tới page natural.
3. **Implementation đơn giản:** Next.js route bình thường, không cần Framer Motion gesture library.
4. **Edge states cần space:** swipe-delete, out-of-stock card, promo confetti đều cần screen real estate đầy đủ.

**Tradeoff:** Mất context conversation (user phải navigate đi khỏi chat). Mitigation: header "Quay lại" button rõ ràng, back action giữ chat state.

---

### ADR-05-02 — Product snapshot trong cart entry (không JOIN live)

**Decision:** Khi add item vào cart, snapshot `{title, brand, image_*, original_price}` vào cart entry. KHÔNG join Products table khi load cart.

**Rationale:**
1. **Latency:** Load cart 4 items = 1 Redis GET (~2ms). Live JOIN = 4 product lookups (~20-40ms).
2. **Price consistency:** `unit_price` snapshotted tại thời điểm add → "Em đã giữ giá" UX (subtitle header). Nếu price thay đổi sau, user vẫn pay theo giá lúc add.
3. **Resilience:** Product có thể bị delete khỏi catalog nhưng cart vẫn render được (snapshot lưu local).

**Tradeoff:** Snapshot stale nếu title/image đổi. Acceptable — title/image hiếm khi đổi sau khi product live.

**Stock check là exception:** `in_stock` flag MUST live re-query Postgres khi load (cart.validate_stock tool) — vì stock thay đổi liên tục.

---

### ADR-05-03 — Optimistic UI cho qty stepper

**Decision:** Tap +/- → cập nhật qty hiển thị NGAY LẬP TỨC (optimistic), gọi `cart.update_qty` background. Spinner inline + toast "Đang đồng bộ" hiển thị trong khi chờ.

**Rationale:**
1. **UX feel snappy:** không cần đợi 200-500ms để update.
2. **Common pattern:** Shopee/Lazada/Tiki đều làm thế này.
3. **Rollback path:** nếu BE fail (stock không đủ, network down), revert qty + show error toast.

**State C mockup minh họa:** qty đang 3 (đã update), spinner xoay thay cho số, toast "Cập nhật số lượng 2 → 3 món" với button Huỷ để rollback.

**Phase 02 task:** debounce 300ms — tránh spam BE khi user tap nhanh +++ liên tiếp.

---

### ADR-05-04 — Swipe-to-delete với undo toast 3s

**Decision:** Remove item dùng pattern swipe-left lộ red action bar (72px wide) → tap "Xoá" hoặc swipe đến end → confirm remove.

Sau khi remove, hiện toast 3s với button **Hoàn tác** ở top of list.

**Rationale:**
1. **Tránh accidental delete:** swipe đòi hỏi deliberate gesture.
2. **Undo path:** 3s đủ để user nhận ra đã xoá nhầm.
3. **Visual feedback rõ:** red bar xuất hiện cùng với swipe direction → user biết hành động sẽ là gì.

**State D mockup minh họa:** item Chin-su đang swipe (translateX -72px), red bar lộ ra, đồng thời toast undo ở top với progress bar 3s.

**Phase 02 task:** dùng `react-swipeable` hoặc `framer-motion` cho swipe gesture. Auto-dismiss toast sau 3s, store removed item trong tmp state để hoàn tác.

---

### ADR-05-05 — Stock issue handling với AI replacement suggestion

**Decision:** Khi `cart.validate_stock` detect item hết hàng:
1. Item card đổi style: red border-left 3px + `#FFF7F7` bg.
2. Inline warning box bên trong card: "Đã hết hàng — em đề xuất bỏ khỏi giỏ" + button "Bỏ".
3. Hiển thị **AI replacement suggestion card** riêng (dashed border) gợi ý sản phẩm tương tự còn hàng.
4. Checkout button **disabled** với label "Cần xử lý món hết hàng" cho đến khi user remove hoặc replace.

**Rationale:** Stock-out là blocking issue cho checkout. Phải force user xử lý chứ không cho proceed với cart invalid.

**State E mockup minh họa:** Chin-su 250g hết hàng → AI gợi ý Chin-su 500g (chai lớn) với button "Thay" (refresh icon) để swap.

**Phase 02 task:**
- `MCP tool: products.find_similar(out_of_stock_product_id)` → return top 1-3 alternatives.
- LLM gen 1-line reason cho replacement (giống Intent 03 Variant B reason).

---

### ADR-05-06 — Modal confirm clear với AI advice

**Decision:** "Xoá hết" button không trigger destructive action ngay — mở modal bottom sheet với:
- Big red trash icon 64px + pulse ring.
- Số tiền sẽ mất ("4 món trị giá 140.500₫").
- **AI advice card:** "Nếu chỉ muốn bỏ vài món, anh hãy vuốt sang trái từng item thay vì xoá hết."
- 2 button: "Ở lại giỏ" (secondary) + "Xoá hết" (red gradient).

**Rationale:**
1. **Destructive action confirmation** là UX standard (iOS Human Interface Guidelines, Material Design).
2. **AI advice giáo dục user** về swipe-delete pattern — nudge sang hành vi ít destructive hơn.
3. **Show value lost** (số tiền) tạo cảm giác "đắn đo" → giảm accidental clear.

**State F mockup minh họa:** modal phủ blurred cart background phía sau, sheet trượt lên từ đáy với drag handle 36×4px ở top.

---

### ADR-05-07 — Promo code success với confetti + savings highlight

**Decision:** Apply promo thành công → animation confetti (3 pieces fall) + card "Áp mã thành công" với:
- Green check badge 42px (scale 0→1.2→1 elastic).
- "Tiết kiệm <amount>" gradient pink-orange highlight.
- Promo code monospace với background pill.

Trong footer: hiển thị promo pill "Mã SALE15 đã áp dụng" với button "Bỏ".

**Rationale:**
1. **Reward feedback:** áp mã là user action positive → reward animation tăng dopamine.
2. **Clear value comm:** savings amount là benefit chính → highlight gradient để bắt mắt.
3. **Removable:** promo pill có button "Bỏ" để user thử mã khác nếu cần.

**State G mockup minh họa:** 3 confetti pieces (hồng/cam/xanh) fall từ top of card, check badge animate scale-elastic, savings "21.750₫" gradient.

**Free-gift hint card** ở cuối list: "Mua thêm 52.500₫ nữa, em tặng anh 1 chai dầu ăn..." — upsell pattern, encourage tăng order value.

---

### ADR-05-08 — Free-ship progress indicator

**Decision:** Nếu subtotal đã ≥ 100k → hiện green box "Anh đã được miễn phí vận chuyển" trong footer summary.

Nếu subtotal < 100k → hiện progress bar "Mua thêm Xđ để được miễn phí vận chuyển" (TBD Phase 02).

**Rationale:** Free-ship là psychological trigger mạnh — user thường mua thêm để đạt threshold. Đây là tactic e-commerce phổ biến.

**Hardcode threshold 100.000₫** cho hackathon. Phase 02 nếu cần dynamic → ALTER `promotions` table hoặc env var.

---

## 6. Phase 02 Implementation Tasks

### Backend (NestJS)
- [ ] `CartController` với 7 endpoints map 1:1 với MCP tools above.
- [ ] `CartService` với Redis WATCH/MULTI/EXEC cho atomic update qty.
- [ ] `StockValidator` middleware: query Postgres `products.stock` cho tất cả items trong cart, set `in_stock` + `available_stock` per item.
- [ ] Hardcoded promo codes table: `SALE15` (15% off), `FREESHIP` (cancel shipping), `NEWUSER` (10k off).
- [ ] Hardcoded free-gift rules: `subtotal ≥ 200000 → "Dầu ăn Tường An 250ml"`.
- [ ] Free-ship threshold env var: `FREE_SHIP_THRESHOLD=100000`.

### Frontend (Next.js)
- [ ] `app/(commerce)/cart/page.tsx` — main cart route.
- [ ] `components/cart/CartItem.tsx` — item card với qty stepper + swipe-delete gesture.
- [ ] `components/cart/CartSummary.tsx` — sticky footer.
- [ ] `components/cart/EmptyCart.tsx` — empty state với brain illustration.
- [ ] `components/cart/StockWarning.tsx` — out-of-stock warning + replacement suggestion.
- [ ] `components/cart/ClearConfirmModal.tsx` — modal sheet với drag handle.
- [ ] `components/cart/PromoSuccessCard.tsx` — confetti + savings highlight.
- [ ] `hooks/useCart.ts` — React Query + optimistic updates + rollback on error.
- [ ] `hooks/useSwipeDelete.ts` — gesture detection với undo logic.
- [ ] State machine: idle → updating → success | rollback.

### Shared types
- [ ] `packages/shared-types/src/cart.ts` với CartSchema (như mục 3).

### Design system reuse
- [ ] Brain icon (size 36-160) đã được Intent 08 introduce — reuse component `<BrainIcon size={N}/>`.
- [ ] Status bar mock (đã có từ Intent 08).

---

## 7. Known Issues / Tradeoffs

1. **Snapshot stale price:** nếu product giảm giá sau khi user add, cart vẫn show old price. UX: cần button "Cập nhật giá mới" hoặc auto-sync khi product price thay đổi. Phase 02 deprioritize.

2. **No multi-device sync:** cart sync giữa devices của cùng user chưa real-time. Workaround: refetch on focus (`refetchOnWindowFocus: true` trong React Query).

3. **Promo single-use:** không support stacking nhiều promo codes. Acceptable cho hackathon.

4. **Free-gift hint chỉ category-level:** "tặng 1 chai dầu ăn 250ml" — không specify brand. Phase 02 nếu có time → join product table → suggest specific SKU còn hàng.

5. **Stock validation race condition:** giữa `validate_stock` (FE load) và `checkout` (FE submit), stock có thể đổi. Mitigation: re-validate trong Intent 06 checkout flow + show error nếu fail.

6. **Optimistic update có thể flicker** nếu BE response < 100ms — qty đã update local rồi response về cùng số → unnecessary re-render. Mitigation: compare prev/next state trước khi setState.

---

## 8. Visual QA Checklist

- [ ] State 0: 4 items với qty stepper hoạt động (+ là gradient pink, − là `#FCE7F3`).
- [ ] State 0: footer sticky với free-ship green box, summary 3 lines (subtotal/discount/shipping), total gradient pink-orange.
- [ ] State A: skeleton shimmer chạy mượt, footer cũng skeleton.
- [ ] State B: brain to 160px ở giữa, 3 CTA stack vertical, AI suggestion card dashed border.
- [ ] State C: 1 item có spinner thay qty, toast "Cập nhật số lượng" với Huỷ button.
- [ ] State D: 1 item translateX(-72px) lộ red action bar bên phải, undo toast với progress bar countdown.
- [ ] State E: 1 item border đỏ + warning box bên trong, AI replacement card dashed bên ngoài, checkout button disabled.
- [ ] State F: modal phủ blur background, drag handle top, big trash icon, AI advice card pink.
- [ ] State G: confetti 3 pieces fall, check badge elastic pop, "Tiết kiệm 21.750₫" gradient, promo pill trong footer.

---

## 9. References

- `00_CONTEXT.md` — project anchor
- `09_FIELD_AUDIT.md` — Redis cart pattern, snapshot rules
- `INTENT_AUDIT_REPORT.md` — Intent 05 pre-audit (0 migration, V004 optional)
- `PHASE_00_DESIGN_SYSTEM.md` — v3 MoMo tokens
- `PHASE_00_INTENT_03_MOCKUP_HANDOFF.md` — sibling (search by text, cart-pill teaser)
- `PHASE_00_INTENT_08_MOCKUP_HANDOFF.md` — sibling (brain icon source)

---

**Handoff complete. Cart loop is foundation for Intent 06 (Pay Order) — checkout button → next page.**
