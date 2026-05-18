# PHASE 00 — Intent 06 (Pay Order by Text) Mockup Handoff

> **Status:** ✅ Complete · 9 mockup files (state 0 confirm + 8 edge states A-H)
> **Date:** 2026-05-17
> **Owner:** AI Agent · Phase 00 Mockup Lead
> **Next:** Phase 04 backend — orders + transactions + payment gateway integration.

---

## 0. TL;DR

Intent 06 (Pay Order) closes the **commerce loop**: từ cart (Intent 05) → confirm → pay → success → receipt. 9 states cover happy path + 5 critical payment edge cases (declined, timeout với idempotency retry, OTP 3DS verification, receipt detail).

**Migration:** 0 mới. V005 (payment metadata) đã apply rồi từ trước (`failure_reason`, `payment_method`, `metadata` JSONB).
**Schema extension:** 1 file TypeScript `order.ts`.
**Payment methods:** 5 — MoMo (default, −2% discount), VNPay QR, Bank Transfer (17 banks), COD (+15k phí), Mock (DEV only).

---

## 1. File Inventory

| # | State | File | Purpose |
|---|-------|------|---------|
| 1 | 0 — Confirm | `intent-06-state-0-confirm.html` | Review items + address + payment method + summary + checkout CTA. Step 2/3 stepper. |
| 2 | A — Address picker | `intent-06-state-A-address.html` | Bottom sheet với 3 saved addresses (Nhà riêng default / Cửa hàng / Nhà bố mẹ) + "Thêm địa chỉ mới" |
| 3 | B — Method picker | `intent-06-state-B-method.html` | Bottom sheet với 5 methods, MoMo selected (−2% discount badge), COD có +15k phí badge |
| 4 | C — Processing | `intent-06-state-C-processing.html` | Brain pulse strong + 4-phase progress (tạo đơn → cổng TT → xác thực → cập nhật) + trace ID footer |
| 5 | D — Success | `intent-06-state-D-success.html` | Brain với green check badge + confetti + order code + summary card + 2 CTA (Xem hoá đơn / Tiếp tục mua) |
| 6 | E — Card declined | `intent-06-state-E-declined.html` | Brain shake với red X badge + error code `E_INSUFFICIENT_BALANCE` + pending notice + 3 actions |
| 7 | F — Network timeout | `intent-06-state-F-timeout.html` | Yellow Wi-Fi off icon + idempotency shield card + auto-retry countdown 8s + "1/3 lần đã thử" |
| 8 | G — OTP 3DS | `intent-06-state-G-otp.html` | 6-digit OTP input (3 filled, 1 active cursor, 2 empty) + countdown 42s + resend/call hotline + 3DS security notice |
| 9 | H — Receipt | `intent-06-state-H-receipt.html` | Full invoice với QR code centered + Aida watermark + items + summary + 3 actions (PDF/Share/Email) + tracking CTA |

---

## 2. Field Audit

| UI element | Source | Status |
|---|---|---|
| Order summary items | Build from Redis cart at checkout | ✅ V001 |
| Shipping address | `addresses` table (V001) | ✅ V001 |
| Payment method selector | Hardcoded enum + provider config | ⏭️ STATIC |
| Order ID (UUID) | `orders.id` | ✅ V001 |
| Order code display | Format `#ORD-YYMMDD-XXXX` derived | ⚠️ DERIVED FE |
| Order status enum | `orders.status` enum | ✅ V001 |
| Real-time status updates | SSE `order.status.changed` events | ⚠️ DERIVED BE |
| Order totals (subtotal, discount, shipping, total) | `orders.*` columns | ✅ V001 |
| `created_at` / `paid_at` timestamps | `orders.*` | ✅ V001 |
| Transaction record | `transactions` table | ✅ V001 |
| Transaction `payment_method` | `transactions.payment_method` | ✅ V005 |
| Transaction `failure_reason` | `transactions.failure_reason` | ✅ V005 |
| Transaction `metadata` JSONB | `transactions.metadata` | ✅ V005 |
| Idempotency key | `transactions.metadata->>'idempotency_key'` | ✅ V005 |
| OTP 6-digit input | FE state + provider callback | ⚠️ DERIVED FE |
| Receipt QR code | Encode order_id + signature | ⚠️ DERIVED BE |
| MoMo wallet balance | Mock from provider response | ⏭️ STATIC |
| 3DS security notice | Hardcoded copy | ⏭️ STATIC |

**Verdict:** ✅ 0 migration mới. V005 đã apply trước đó.

---

## 3. Schema Extension

File: `packages/shared-types/src/order.ts`

```typescript
import { z } from 'zod';
import { CartItemSchema } from './cart';

export const PaymentMethodEnum = z.enum([
  'mock',          // DEV only
  'cod',           // Cash on delivery, +15k fee
  'vnpay',         // VNPay QR
  'momo',          // MoMo wallet, −2% discount
  'bank_transfer', // 17 banks via internet banking
]);

export const OrderStatusEnum = z.enum([
  'pending',     // Created, awaiting payment
  'processing',  // Payment gateway call in flight
  'paid',        // Payment confirmed
  'failed',      // Payment declined or timeout
  'cancelled',   // User cancelled
]);

export const ShippingAddressSchema = z.object({
  id: z.string().uuid(),
  recipient_name: z.string(),
  phone: z.string(),
  address_line: z.string(),
  ward: z.string(),
  district: z.string(),
  city: z.string(),
  is_default: z.boolean(),
  label: z.string().nullable(),  // "Nhà riêng" | "Cửa hàng" | custom
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  payment_method: PaymentMethodEnum,
  provider_tx_id: z.string().nullable(),   // External gateway ID
  status: z.enum(['pending', 'success', 'failed']),
  failure_reason: z.string().nullable(),
  metadata: z.record(z.unknown()),         // idempotency_key, retry_count, etc.
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  order_code: z.string(),                    // ORD-260517-A3F2
  user_id: z.string().uuid(),
  status: OrderStatusEnum,
  items: z.array(CartItemSchema),
  shipping_address: ShippingAddressSchema,
  totals: z.object({
    subtotal: z.number().int(),
    discount: z.number().int(),
    shipping: z.number().int(),
    method_bonus: z.number().int(),  // MoMo −2%, COD +15k
    total: z.number().int(),
  }),
  promo_code: z.string().nullable(),
  transactions: z.array(TransactionSchema),
  notes: z.string().nullable(),              // Note for delivery
  created_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable(),
  estimated_delivery: z.string().nullable(), // "20/05/2026"
});

export type Order = z.infer<typeof OrderSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
```

### SSE Event Stream

```
order.created           → { order_id, order_code, status: 'pending' }
order.processing        → { order_id, transaction_id }
order.otp_required      → { order_id, expires_in: 60 }   // for 3DS
order.paid              → { order_id, paid_at, estimated_delivery }
order.failed            → { order_id, failure_reason, error_code, can_retry: boolean }
order.timeout           → { order_id, retry_count, max_retries: 3 }
```

---

## 4. ADRs (Architecture Decision Records)

### ADR-06-01 — Order created TRƯỚC khi gọi payment gateway

**Decision:** Backend tạo `orders` row với `status='pending'` NGAY khi user tap "Đặt hàng & thanh toán", trước khi gọi MoMo/VNPay API.

**Rationale:**
1. **Resilience:** Nếu gateway timeout, order vẫn tồn tại — user có thể quay lại trang "Đơn hàng" và retry (state F).
2. **Idempotency:** Cùng order_id + idempotency_key → gateway không trừ tiền 2 lần dù FE retry.
3. **Audit trail:** Mọi attempt đều log vào `transactions` table → debug dễ.

**State E mockup minh họa:** "Đơn hàng #ORD-260517-A3F2 đã được tạo ở trạng thái pending. Anh có 15 phút để thanh toán lại."

**Tradeoff:** Pending orders cần cleanup cron (15 phút expire → status=cancelled).

---

### ADR-06-02 — Order code format `#ORD-YYMMDD-XXXX`

**Decision:** Display format derive từ UUID:
- Prefix `ORD-`
- Date `YYMMDD` (260517 = 17/05/2026)
- Suffix 4-char hash từ UUID first 4 hex (uppercase)

Example: `ORD-260517-A3F2` từ UUID `a3f2c89b-...`.

**Rationale:** UUID `a3f2c89b-d042-...` quá dài để user đọc/dictate. Code format ngắn, dễ nhớ, có date info → support hotline dễ tra cứu.

**Phase 02 task:** Add `order_code` STORED GENERATED column trong Postgres, hoặc compute trên FE từ UUID.

---

### ADR-06-03 — Idempotency key cho retry safety

**Decision:** Mỗi attempt thanh toán có `idempotency_key` UUID v4 (FE generate, persist trong sessionStorage). Gửi cùng key cho mọi retry attempt.

**Storage:** `transactions.metadata->>'idempotency_key'`.

**Backend logic:**
1. Check existing transaction với cùng `(order_id, idempotency_key)`.
2. Nếu có và status='success' → return cached response (đã pay rồi).
3. Nếu có và status='pending' → poll gateway để check.
4. Nếu chưa có → tạo mới, call gateway, lưu response.

**State F mockup minh họa:** card "Bảo vệ idempotency • Cùng mã = 1 giao dịch, không trừ 2 lần" với `idp_b7e1d042...` displayed.

**Rationale:** Payment double-charge là disaster cho user trust. Idempotency là industry standard (Stripe, Square, MoMo SDK đều support).

---

### ADR-06-04 — Brain identity reuse cho moments AI quan trọng

**Decision:** Brain icon xuất hiện ở 4 states quan trọng:
- **C Processing** (140-180px): brain pulse strong → "Em đang xử lý"
- **D Success** (160px) + green check badge → "Cảm ơn anh!"
- **E Declined** (140px) + red X badge + shake animation → "Em xin lỗi anh..."
- **G OTP** (120px) → "Em đợi anh nhập OTP"

**Rationale:**
1. **Brand consistency:** Brain = Aida. Mọi moment AI cần xuất hiện thì phải có brain.
2. **Emotional anchor:** Payment là moment căng thẳng (thành công hay thất bại đều cao trào) → brand presence quan trọng để giảm anxiety.
3. **Reuse từ Intent 08:** brain icon component đã introduce, reuse nhất quán.

**Tradeoff:** Brain nhiều nơi có thể bị nhàm. Mitigation: animate khác nhau (pulse strong khi processing, glow + check khi success, shake khi failed).

---

### ADR-06-05 — Confetti animation cho success moment

**Decision:** State D success có 4 confetti pieces (hồng/cam/xanh) fall từ top với stagger delay (0.3s, 0.5s, 0.4s, 0.7s).

**Rationale:**
1. **Positive reinforcement:** Thanh toán thành công là user goal — phải có visual reward.
2. **Memorable moment:** Hackathon judge scroll qua nhanh, confetti animation bắt mắt sẽ stop scroll.
3. **Lighter than full-screen confetti library:** chỉ 4 CSS divs, không cần `react-confetti` (overhead).

**State G mockup KHÔNG có confetti** vì 3DS chưa hoàn tất — confetti chỉ khi `status='paid'`.

---

### ADR-06-06 — Auto-retry với exponential backoff cho timeout

**Decision:** State F timeout auto-retry tối đa **3 lần** với delays **8s → 16s → 30s** (exponential).

UI display: "Đã thử 1/3 lần • em sẽ gửi tin nhắn nếu fail" + countdown circle SVG visible.

**Rationale:**
1. **UX không stuck:** user không phải tap retry manually nếu network blip thoáng qua.
2. **Tránh spam gateway:** exponential backoff respect rate limits của MoMo/VNPay.
3. **Fallback notification:** sau 3 lần fail → trigger email/SMS notification với link để retry sau (Phase 04 task).

**Manual override:** button "Thử lại ngay" cho phép user bypass countdown.

---

### ADR-06-07 — 3DS OTP UX

**Decision:** State G dùng 6 cells separately styled (mỗi cell 42×50px), KHÔNG dùng 1 long input.

**Layout:**
- Cell 0-2: filled (8, 4, 2) — solid border `#E91E63` với box-shadow ring.
- Cell 3: active (cursor blink) — solid border + ring.
- Cell 4-5: empty — dashed border `#FBCFE8`.

**Auto-advance:** focus tự nhảy sang cell tiếp theo khi gõ. Backspace lùi về cell trước.

**Rationale:**
1. **iOS native pattern:** matches iOS Messages OTP autofill from SMS — feel familiar.
2. **Visual progress:** user thấy đã gõ bao nhiêu số rõ ràng.
3. **Mistake recovery:** dễ thấy cell nào sai để sửa.

**3DS security notice card green:** "Đây là xác thực 3D Secure từ ngân hàng. Em không bao giờ hỏi mã OTP qua chat." — quan trọng để educate user về phishing.

---

### ADR-06-08 — Progress stepper "Step 2/3"

**Decision:** State 0 confirm có progress stepper 3-step ở top:
1. ✅ Giỏ hàng (Intent 05) — green check
2. **🔵 Xác nhận (current)** — pink gradient với "2"
3. ⚪ Hoàn tất — gray dashed

**Rationale:**
1. **Context awareness:** user biết đang ở đâu trong flow.
2. **Reduce abandonment:** thấy còn 1 step nữa → có động lực complete.
3. **Visual continuity:** giỏ hàng (Intent 05) → xác nhận (Intent 06 state 0) → hoàn tất (Intent 06 state D) = 1 mạch.

**Connector line** giữa các step có gradient từ green → pink → gray để show progress trực quan.

---

### ADR-06-09 — Method bonus display (MoMo −2%, COD +15k)

**Decision:** Mỗi payment method có **bonus/penalty** display rõ ràng:
- **MoMo:** badge green `−2%` (incentive)
- **COD:** badge amber `+15.000₫` (additional fee for COD logistics)
- **VNPay/Bank Transfer/Mock:** no badge (neutral)

**Rationale:**
1. **Transparency:** user thấy tổng impact của lựa chọn trước khi commit.
2. **Nudge:** MoMo discount encourage digital payment (reduce COD load cho merchant).
3. **No hidden fees:** COD +15k visible từ method picker, không phải surprise ở footer.

**Final summary state 0 reflect:** "Khuyến mãi MoMo −2.465₫" line riêng trong summary (calculated as 2% of 123.250₫).

---

### ADR-06-10 — Receipt với QR code + watermark

**Decision:** State H receipt có:
- **QR code 120×120 SVG** centered với Aida watermark "A" ở giữa.
- Order info grid 2-column (date, tx_id, method, recipient, address).
- Items list với thumbnails 32px + qty + price.
- Summary với 4 lines (subtotal/discount/MoMo bonus/shipping) + total gradient.
- 3 actions row: Tải PDF / Chia sẻ / Email.
- Sticky footer CTA: "Theo dõi đơn hàng" gradient pink-orange.

**Rationale:**
1. **Verifiable:** QR encode `{order_id, signature}` cho merchant scan khi giao hàng.
2. **Printable:** layout 1-column dễ in nếu user save PDF.
3. **Shareable:** user gửi receipt qua Zalo/Messenger cho người khác.

**QR code hand-coded SVG** (không CDN) — 120 rect cells tạo pattern. Realistic enough cho mockup.

---

## 5. Payment Methods Detail

| Method | Provider | Discount/Fee | Flow | Notes |
|---|---|---|---|---|
| **MoMo** (default) | MoMo OpenAPI | −2% | Deep link to MoMo app OR phone OTP | Most popular in VN, 30M+ users |
| **VNPay QR** | VNPay SDK | None | QR code → user scans với app banking | Universal support 40+ banks |
| **Bank Transfer** | Direct IB | None | Redirect to bank's IB page | Slower, requires user CAPTCHA |
| **COD** | Internal | +15.000₫ | No online payment, cash to shipper | Most trusted by VN customers |
| **Mock** | Internal stub | None | Auto-success after 2s | DEV/staging only, never production |

**Provider config hardcoded in Phase 04** — env vars cho API keys, không cần V008 migration.

---

## 6. Phase 04 Implementation Tasks

### Backend (NestJS)
- [ ] `OrderController` với endpoints:
  - `POST /api/v1/orders` — create order (status=pending)
  - `POST /api/v1/orders/:id/pay` — initiate payment
  - `POST /api/v1/orders/:id/verify-otp` — submit OTP for 3DS
  - `GET /api/v1/orders/:id` — fetch order detail
  - `GET /api/v1/orders/:id/receipt` — generate receipt
- [ ] `PaymentService` với 5 strategy classes (one per method).
- [ ] `IdempotencyMiddleware` check `(order_id, idempotency_key)` cache 24h.
- [ ] SSE endpoint `/api/v1/orders/:id/stream` cho real-time status.
- [ ] Cron job `pending_order_cleanup` chạy mỗi 5 phút, expire orders > 15 phút.
- [ ] Webhook receivers cho MoMo/VNPay callback → update `transactions.status`.

### Frontend (Next.js)
- [ ] `app/(commerce)/checkout/page.tsx` — main route, state machine với 9 states.
- [ ] `components/checkout/AddressPicker.tsx` — bottom sheet với drag handle.
- [ ] `components/checkout/MethodPicker.tsx` — 5 method cards với selected state.
- [ ] `components/checkout/OrderSummary.tsx` — sticky footer.
- [ ] `components/checkout/ProcessingState.tsx` — brain pulse + 4-phase progress.
- [ ] `components/checkout/SuccessState.tsx` — brain + check + confetti.
- [ ] `components/checkout/DeclinedState.tsx` — brain + X + shake + error display.
- [ ] `components/checkout/TimeoutState.tsx` — Wi-Fi off + idempotency card + countdown.
- [ ] `components/checkout/OtpState.tsx` — 6-cell input + countdown SVG.
- [ ] `components/checkout/ReceiptView.tsx` — QR + items + summary + actions.
- [ ] `hooks/usePayment.ts` — state machine với SSE subscription.
- [ ] `hooks/useIdempotency.ts` — generate + persist key in sessionStorage.

### Shared types
- [ ] `packages/shared-types/src/order.ts` với schemas (mục 3).

### Payment provider integration
- [ ] MoMo OpenAPI client (REST API, không phải SDK).
- [ ] VNPay sandbox testing.
- [ ] Mock provider always-success cho demo.
- [ ] Webhook signature verification (HMAC).

---

## 7. Known Issues / Tradeoffs

1. **Pending order TTL** — 15 phút có thể quá ngắn cho COD (user cần thời gian gọi vận chuyển). Cân nhắc 30 phút cho COD specifically.

2. **OTP autofill chưa support trên web** — iOS native autofill từ SMS chỉ work cho `input[autocomplete="one-time-code"]`. Phase 04 verify hoạt động trên Safari iOS.

3. **QR code SVG hardcoded** trong mockup — Phase 04 cần generate dynamic từ order data với `qrcode` library.

4. **Receipt PDF generation** — không thuộc Phase 00. Phase 04 dùng `puppeteer` hoặc `react-pdf` để render từ data.

5. **Idempotency key lifecycle** — sessionStorage clear khi user close tab. Mitigation: cũng lưu vào URL query param `?idp=...` để recover từ deep link.

6. **5 payment methods có thể overwhelm** — A/B test giữa "Show all 5" vs "Show top 2 + 'Xem thêm'". Hackathon dùng full 5 để demo capabilities.

7. **VAT calculation** chưa explicit trong total breakdown — assumption "VAT đã bao gồm trong giá". Phase 04 nếu cần show VAT line riêng → extend `totals` schema.

---

## 8. Visual QA Checklist

- [ ] State 0: stepper 3-step gradient connector visible, MoMo card selected với check icon, summary 4 lines (tạm tính / discount / shipping / MoMo bonus).
- [ ] State A: bottom sheet drag handle visible, 3 addresses with default badge on first, "Thêm địa chỉ mới" dashed button.
- [ ] State B: 5 methods với icons rõ, MoMo selected, COD có +15k badge, Mock có DEV badge.
- [ ] State C: brain pulse strong với glow lớn, 4 phases (2 done green, 1 active pink ring, 1 pending gray).
- [ ] State D: brain với green check bottom-right, 4 confetti pieces fall stagger, order code monospace.
- [ ] State E: brain shake animation, red X badge, error code `E_INSUFFICIENT_BALANCE`, pending notice yellow.
- [ ] State F: Wi-Fi off yellow icon, idempotency card với shield green, countdown circle 8s, "1/3 lần".
- [ ] State G: 6 OTP cells (3 filled 8/4/2, 1 active với cursor blink, 2 empty), countdown ring 42s, 3DS notice green.
- [ ] State H: QR code centered với Aida "A" watermark, order code uppercase, 3 action buttons (PDF/Share/Email).

---

## 9. References

- `00_CONTEXT.md` — project anchor (V005 payment metadata)
- `09_FIELD_AUDIT.md` — orders/transactions schema
- `INTENT_AUDIT_REPORT.md` — Intent 06 pre-audit
- `PHASE_00_DESIGN_SYSTEM.md` — v3 MoMo tokens
- `PHASE_00_INTENT_05_MOCKUP_HANDOFF.md` — sibling (cart → pay transition)
- `PHASE_00_INTENT_08_MOCKUP_HANDOFF.md` — brain icon source

---

**Handoff complete. Commerce loop is CLOSED: Login → Search → Cart → Pay. Ready for hackathon demo.**
